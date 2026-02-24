-- ============================================================================
-- ADMIN RESET DISTRIBUTION
-- SECURITY DEFINER RPC to bypass RLS for admin delete operations
-- on inventory_items and inventory_reports tables.
-- ============================================================================

CREATE OR REPLACE FUNCTION admin_reset_distribution(
    p_store_id UUID,
    p_shift INT,
    p_check_dates TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_items INT := 0;
    deleted_reports INT := 0;
    approved_date TEXT;
BEGIN
    -- Safety: check for APPROVED reports first
    SELECT r.check_date::TEXT INTO approved_date
    FROM inventory_reports r
    WHERE r.store_id = p_store_id
      AND r.shift = p_shift
      AND r.check_date = ANY(p_check_dates::DATE[])
      AND r.status = 'APPROVED'
    LIMIT 1;

    IF approved_date IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Báo cáo ngày ' || approved_date || ' đã DUYỆT — không thể reset'
        );
    END IF;

    -- Delete reports (non-APPROVED)
    DELETE FROM inventory_reports
    WHERE store_id = p_store_id
      AND shift = p_shift
      AND check_date = ANY(p_check_dates::DATE[])
      AND status != 'APPROVED';

    GET DIAGNOSTICS deleted_reports = ROW_COUNT;

    -- Delete inventory items
    DELETE FROM inventory_items
    WHERE store_id = p_store_id
      AND shift = p_shift
      AND check_date = ANY(p_check_dates::DATE[]);

    GET DIAGNOSTICS deleted_items = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'deleted_items', deleted_items,
        'deleted_reports', deleted_reports,
        'message', 'Đã xóa ' || deleted_items || ' mục phân phối'
    );
END;
$$;

-- Grant execute to authenticated users (admin check is done at app level)
GRANT EXECUTE ON FUNCTION admin_reset_distribution(UUID, INT, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_reset_distribution(UUID, INT, TEXT[]) TO anon;
