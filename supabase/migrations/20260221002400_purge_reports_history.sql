-- ============================================================================
-- PURGE OLD REPORTS & HISTORY
-- Extends the archive pipeline to clean up inventory_reports and
-- inventory_history tables, preventing DB bloat over time.
--
-- Retention policy:
--   inventory_reports (APPROVED/REJECTED): 30 days (configurable)
--   inventory_history: 30 days (configurable)
--   inventory_reports (PENDING): NEVER purged (must be reviewed first)
-- ============================================================================

-- ── 1. Purge old reports (only APPROVED/REJECTED) ──

CREATE OR REPLACE FUNCTION purge_old_reports(days_to_keep INT DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    cutoff_date DATE;
    deleted_count INT;
    pending_kept INT;
BEGIN
    cutoff_date := CURRENT_DATE - days_to_keep;

    -- Count PENDING reports that will be kept (safety check)
    SELECT COUNT(*) INTO pending_kept
    FROM inventory_reports
    WHERE status = 'PENDING';

    -- Delete only APPROVED/REJECTED reports older than cutoff
    -- PENDING reports are NEVER auto-purged
    DELETE FROM inventory_reports
    WHERE status IN ('APPROVED', 'REJECTED')
      AND check_date < cutoff_date;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RAISE NOTICE '[Archive] Purged % old reports (cutoff: %, pending kept: %)',
        deleted_count, cutoff_date, pending_kept;

    RETURN jsonb_build_object(
        'deleted_reports', deleted_count,
        'cutoff_date', cutoff_date::TEXT,
        'pending_kept', pending_kept
    );
END;
$$;

-- ── 2. Purge old history items ──

CREATE OR REPLACE FUNCTION purge_old_history(days_to_keep INT DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    cutoff_date DATE;
    deleted_count INT;
BEGIN
    cutoff_date := CURRENT_DATE - days_to_keep;

    -- Delete history items older than cutoff
    -- Use check_date (not created_at) to match build_archive_json source
    DELETE FROM inventory_history
    WHERE check_date < cutoff_date;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RAISE NOTICE '[Archive] Purged % old history items (cutoff: %)',
        deleted_count, cutoff_date;

    RETURN jsonb_build_object(
        'deleted_history_items', deleted_count,
        'cutoff_date', cutoff_date::TEXT
    );
END;
$$;

-- ── 3. Build report metadata JSON for archive (Option A) ──
-- Snapshots report data for a given date before purging

CREATE OR REPLACE FUNCTION build_report_metadata_json(target_date DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', r.id,
                'store_code', s.code,
                'store_name', s.name,
                'shift', r.shift,
                'check_date', r.check_date::TEXT,
                'status', r.status,
                'submitted_by', su.name,
                'submitted_at', r.submitted_at,
                'reviewed_by', rv.name,
                'reviewed_at', r.reviewed_at,
                'rejection_reason', r.rejection_reason,
                'created_at', r.created_at
            )
            ORDER BY r.check_date, s.code, r.shift
        ),
        '[]'::JSONB
    ) INTO result
    FROM inventory_reports r
    LEFT JOIN stores s ON s.id = r.store_id
    LEFT JOIN users su ON su.id = r.submitted_by
    LEFT JOIN users rv ON rv.id = r.reviewed_by
    WHERE r.check_date = target_date;

    RETURN jsonb_build_object(
        'date', target_date::TEXT,
        'total_reports', jsonb_array_length(result),
        'reports', result
    );
END;
$$;

-- ── 4. Grant execute permissions ──

GRANT EXECUTE ON FUNCTION purge_old_reports(INT) TO service_role;
GRANT EXECUTE ON FUNCTION purge_old_history(INT) TO service_role;
GRANT EXECUTE ON FUNCTION build_report_metadata_json(DATE) TO service_role;
