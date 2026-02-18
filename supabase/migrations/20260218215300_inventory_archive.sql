-- ============================================================================
-- INVENTORY ARCHIVE SYSTEM
-- Migrates old inventory data to Supabase Storage to keep DB lean
-- Pattern: Hot (DB, 7 days) → Cold (Storage, forever)
-- ============================================================================

-- 1. Create Storage bucket for archived inventory data
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'inventory-archive',
    'inventory-archive',
    false,
    5242880,  -- 5MB per file (more than enough for daily JSON ~50KB)
    ARRAY['application/json']
)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS policies for the archive bucket
-- Allow authenticated users to read archive files
CREATE POLICY "Authenticated users can read archive files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'inventory-archive');

-- Allow service_role to insert/update/delete archive files (Edge Function uses service_role)
CREATE POLICY "Service role can manage archive files"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'inventory-archive');

-- 3. Create archive log table to track what's been archived
CREATE TABLE IF NOT EXISTS inventory_archive_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    archive_date DATE NOT NULL UNIQUE,
    file_path TEXT NOT NULL,
    total_items INTEGER NOT NULL DEFAULT 0,
    total_stores INTEGER NOT NULL DEFAULT 0,
    file_size_bytes INTEGER,
    archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    purged_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'ARCHIVED' CHECK (status IN ('ARCHIVED', 'PURGED', 'FAILED')),
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_archive_log_date ON inventory_archive_log(archive_date);
CREATE INDEX IF NOT EXISTS idx_archive_log_status ON inventory_archive_log(status);

-- 4. Create summary table for quick dashboard stats (monthly aggregation)
CREATE TABLE IF NOT EXISTS inventory_daily_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    summary_date DATE NOT NULL,
    store_code TEXT NOT NULL,
    shift INTEGER NOT NULL CHECK (shift BETWEEN 1 AND 3),
    total_items INTEGER NOT NULL DEFAULT 0,
    matched_count INTEGER NOT NULL DEFAULT 0,
    missing_count INTEGER NOT NULL DEFAULT 0,
    over_count INTEGER NOT NULL DEFAULT 0,
    pending_count INTEGER NOT NULL DEFAULT 0,
    total_system_stock NUMERIC DEFAULT 0,
    total_actual_stock NUMERIC DEFAULT 0,
    total_diff NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(summary_date, store_code, shift)
);

CREATE INDEX IF NOT EXISTS idx_daily_summary_date ON inventory_daily_summary(summary_date);
CREATE INDEX IF NOT EXISTS idx_daily_summary_store ON inventory_daily_summary(store_code);

-- 5. RLS for new tables
ALTER TABLE inventory_archive_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_daily_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read archive log"
ON inventory_archive_log FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role manages archive log"
ON inventory_archive_log FOR ALL TO service_role USING (true);

CREATE POLICY "Authenticated users can read daily summary"
ON inventory_daily_summary FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role manages daily summary"
ON inventory_daily_summary FOR ALL TO service_role USING (true);

-- 6. Function to generate daily summary from inventory_items
CREATE OR REPLACE FUNCTION generate_daily_summary(target_date DATE DEFAULT CURRENT_DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
    summary_count INTEGER;
BEGIN
    -- Insert/update summary for each store+shift combination
    INSERT INTO inventory_daily_summary (
        summary_date, store_code, shift,
        total_items, matched_count, missing_count, over_count, pending_count,
        total_system_stock, total_actual_stock, total_diff
    )
    SELECT
        target_date,
        s.code,
        ii.shift,
        COUNT(*)::INTEGER,
        COUNT(*) FILTER (WHERE ii.status = 'MATCHED')::INTEGER,
        COUNT(*) FILTER (WHERE ii.status = 'MISSING')::INTEGER,
        COUNT(*) FILTER (WHERE ii.status = 'OVER')::INTEGER,
        COUNT(*) FILTER (WHERE ii.status = 'PENDING')::INTEGER,
        COALESCE(SUM(ii.system_stock), 0),
        COALESCE(SUM(ii.actual_stock), 0),
        COALESCE(SUM(ii.diff), 0)
    FROM inventory_items ii
    JOIN stores s ON ii.store_id = s.id
    WHERE ii.created_at::DATE = target_date
    GROUP BY s.code, ii.shift
    ON CONFLICT (summary_date, store_code, shift)
    DO UPDATE SET
        total_items = EXCLUDED.total_items,
        matched_count = EXCLUDED.matched_count,
        missing_count = EXCLUDED.missing_count,
        over_count = EXCLUDED.over_count,
        pending_count = EXCLUDED.pending_count,
        total_system_stock = EXCLUDED.total_system_stock,
        total_actual_stock = EXCLUDED.total_actual_stock,
        total_diff = EXCLUDED.total_diff;

    GET DIAGNOSTICS summary_count = ROW_COUNT;

    result := jsonb_build_object(
        'success', true,
        'date', target_date,
        'summaries_upserted', summary_count
    );

    RETURN result;
END;
$$;

-- 7. Function to purge old inventory items (called after archive is confirmed)
CREATE OR REPLACE FUNCTION purge_old_inventory_items(days_to_keep INTEGER DEFAULT 7)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    cutoff_date DATE;
    deleted_count INTEGER;
BEGIN
    cutoff_date := CURRENT_DATE - days_to_keep;

    -- Only purge if the data has been archived
    IF NOT EXISTS (
        SELECT 1 FROM inventory_archive_log
        WHERE archive_date <= cutoff_date
        AND status = 'ARCHIVED'
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No archived data found before cutoff date. Archive first before purging.'
        );
    END IF;

    -- Delete old inventory items
    DELETE FROM inventory_items
    WHERE created_at::DATE <= cutoff_date
    AND created_at::DATE IN (
        SELECT archive_date FROM inventory_archive_log
        WHERE status = 'ARCHIVED'
    );

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    -- Update archive log status
    UPDATE inventory_archive_log
    SET purged_at = NOW(), status = 'PURGED'
    WHERE archive_date <= cutoff_date
    AND status = 'ARCHIVED';

    RETURN jsonb_build_object(
        'success', true,
        'cutoff_date', cutoff_date,
        'deleted_items', deleted_count
    );
END;
$$;

-- 8. Function to build archive JSON payload for a given date
CREATE OR REPLACE FUNCTION build_archive_json(target_date DATE DEFAULT CURRENT_DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
    store_data JSONB := '{}'::jsonb;
    store_rec RECORD;
    shift_int INTEGER;
    shift_items JSONB;
    total_count INTEGER := 0;
    store_count INTEGER := 0;
BEGIN
    -- Build per-store, per-shift data
    FOR store_rec IN
        SELECT DISTINCT s.code as store_code
        FROM inventory_items ii
        JOIN stores s ON ii.store_id = s.id
        WHERE ii.created_at::DATE = target_date
        ORDER BY s.code
    LOOP
        store_count := store_count + 1;
        DECLARE
            store_shifts JSONB := '{}'::jsonb;
        BEGIN
            FOR shift_int IN 1..3 LOOP
                SELECT COALESCE(jsonb_agg(
                    jsonb_build_object(
                        'product_name', p.name,
                        'barcode', p.barcode,
                        'pvn', p.pvn,
                        'system_stock', ii.system_stock,
                        'actual_stock', ii.actual_stock,
                        'diff', ii.diff,
                        'status', ii.status,
                        'note', COALESCE(ii.note, ''),
                        'diff_reason', ii.diff_reason
                    )
                    ORDER BY p.name
                ), '[]'::jsonb)
                INTO shift_items
                FROM inventory_items ii
                JOIN stores s ON ii.store_id = s.id
                JOIN products p ON ii.product_id = p.id
                WHERE ii.created_at::DATE = target_date
                AND s.code = store_rec.store_code
                AND ii.shift = shift_int;

                IF shift_items != '[]'::jsonb THEN
                    store_shifts := store_shifts || jsonb_build_object(
                        'shift_' || shift_int, shift_items
                    );
                    total_count := total_count + jsonb_array_length(shift_items);
                END IF;
            END LOOP;

            IF store_shifts != '{}'::jsonb THEN
                store_data := store_data || jsonb_build_object(
                    store_rec.store_code, store_shifts
                );
            END IF;
        END;
    END LOOP;

    result := jsonb_build_object(
        'date', target_date,
        'exported_at', NOW(),
        'total_items', total_count,
        'total_stores', store_count,
        'stores', store_data
    );

    RETURN result;
END;
$$;

COMMENT ON FUNCTION build_archive_json IS 'Builds a complete JSON snapshot of all inventory_items for a given date, structured by store and shift. Used by Edge Function for archival.';
COMMENT ON FUNCTION generate_daily_summary IS 'Aggregates inventory_items into daily summaries per store/shift for dashboard analytics.';
COMMENT ON FUNCTION purge_old_inventory_items IS 'Deletes inventory_items older than N days, but only if they have been archived first.';
COMMENT ON TABLE inventory_archive_log IS 'Tracks which dates have been archived to Storage and/or purged from the DB.';
COMMENT ON TABLE inventory_daily_summary IS 'Pre-aggregated daily stats per store/shift for fast dashboard queries.';
