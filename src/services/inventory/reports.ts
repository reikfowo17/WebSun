import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { REPORT_STATUS, DIFF_REASON_OPTIONS, ReportStatus, DiffReason, ReportSummary, ReportDetail, ReviewResult, BulkReviewResult, InventoryProduct, MasterItem } from "./types";
export async function getMonitoringStats(date: string): Promise<{ success: boolean; data: any[] }> {
    if (isSupabaseConfigured()) {
        try {
            const { data: overview, error } = await supabase
                .from('inventory_overview_dashboard')
                .select('*')
                .eq('check_date', date);

            if (error) throw error;

            const stats = (overview || []).map((row: any) => {
                const total = row.total_items || 0;
                const checked = row.checked_items || 0;
                const issues = (row.missing_items || 0) + (row.over_items || 0);

                let status = 'PENDING';
                if (total > 0) {
                    if (checked === total) status = 'COMPLETED';
                    else if (checked > 0) status = 'IN_PROGRESS';
                }
                if (issues > 0 && status === 'COMPLETED') status = 'ISSUE';

                return {
                    id: row.store_code,
                    name: row.store_name,
                    status,
                    progress: checked,
                    total,
                    issues,
                    shift: row.shift || 1,
                    staff: row.employee_name || '--'
                };
            });

            return { success: true, data: stats };
        } catch (e) {
            console.error('Monitoring stats error:', e);
            return { success: false, data: [] };
        }
    }
    return { success: false, data: [] };
}
export async function getReports(status?: string, storeCode?: string): Promise<{ success: boolean; reports: ReportSummary[] }> {
    if (!isSupabaseConfigured()) {
        return { success: false, reports: [] };
    }

    try {
        let query = supabase
            .from('inventory_reports')
            .select(`
                    id,
                    check_date,
                    shift,
                    status,
                    created_at,
                    reviewed_at,
                    rejection_reason,
                    stores!inner (
                        id,
                        code,
                        name
                    ),
                    users!inventory_reports_submitted_by_fkey (
                        name
                    ),
                    reviewer:users!inventory_reports_reviewed_by_fkey (
                        name
                    )
                `)
            .order('created_at', { ascending: false });

        if (status && status !== 'ALL') {
            query = query.eq('status', status);
        }

        if (storeCode && storeCode !== 'ALL') {
            query = query.eq('stores.code', storeCode);
        }

        const { data, error } = await query;
        if (error) throw error;

        const reportsList = data || [];
        const storeIds = [...new Set(reportsList.map((r: any) => r.stores?.id).filter(Boolean))];
        const { data: allStats } = storeIds.length > 0
            ? await supabase
                .from('inventory_report_stats')
                .select('store_id, check_date, shift, total_items, matched_items, missing_items, over_items')
                .in('store_id', storeIds)
            : { data: [] };

        // Create a lookup map for stats
        interface StatRow { store_id: string; check_date: string; shift: number; total_items: number; matched_items: number; missing_items: number; over_items: number; }
        const statsMap = new Map<string, StatRow>();
        (allStats || []).forEach((s: any) => {
            const key = `${s.store_id}_${s.check_date}_${s.shift}`;
            statsMap.set(key, s as StatRow);
        });

        const reportsWithStats: ReportSummary[] = reportsList.map((report: any) => {
            const key = `${report.stores?.id}_${report.check_date}_${report.shift}`;
            const stats = statsMap.get(key);

            return {
                id: report.id,
                storeId: report.stores?.id || '',
                store: report.stores?.code || '',
                shift: report.shift,
                date: report.check_date,
                submittedBy: report.users?.name || 'Unknown',
                submittedAt: report.created_at,
                status: report.status as ReportStatus,
                total: stats?.total_items || 0,
                matched: stats?.matched_items || 0,
                missing: stats?.missing_items || 0,
                over: stats?.over_items || 0,
                reviewedBy: report.reviewer?.name || null,
                reviewedAt: report.reviewed_at || null,
                rejectionReason: report.rejection_reason || null
            };
        });

        return { success: true, reports: reportsWithStats };
    } catch (e) {
        console.error('[Inventory] Get reports error:', e);
        return { success: false, reports: [] };
    }
}
export async function getReportDetail(reportId: string): Promise<{ success: boolean; report?: any }> {
    if (!isSupabaseConfigured()) {
        return { success: false };
    }

    try {
        const { data, error } = await supabase
            .from('inventory_reports')
            .select(`
                    id,
                    store_id,
                    shift,
                    check_date,
                    status,
                    submitted_by,
                    submitted_at,
                    reviewed_by,
                    reviewed_at,
                    rejection_reason,
                    stores!inner (code, name),
                    submitter:users!inventory_reports_submitted_by_fkey (name),
                    reviewer:users!inventory_reports_reviewed_by_fkey (name)
                `)
            .eq('id', reportId)
            .single();

        if (error) throw error;

        let items: any[] | null = null;

        const { data: liveItems } = await supabase
            .from('inventory_items')
            .select('status, diff')
            .eq('store_id', data.store_id)
            .eq('check_date', data.check_date)
            .eq('shift', data.shift);

        if (liveItems && liveItems.length > 0) {
            items = liveItems;
        } else {
            const { data: histItems } = await supabase
                .from('inventory_history')
                .select('status, diff')
                .eq('store_id', data.store_id)
                .eq('check_date', data.check_date)
                .eq('shift', data.shift);
            items = histItems;
        }

        const total_items = items?.length || 0;
        const matched_items = items?.filter((i: any) => i.status === 'MATCHED').length || 0;
        const missing_items = items?.filter((i: any) => i.diff !== null && i.diff < 0).length || 0;
        const over_items = items?.filter((i: any) => i.diff !== null && i.diff > 0).length || 0;
        const reportData = data as any;

        const report = {
            id: reportData.id,
            store_code: reportData.stores?.code || '',
            store_name: reportData.stores?.name || '',
            shift: reportData.shift,
            check_date: reportData.check_date,
            status: reportData.status,
            submitted_by: reportData.submitter?.name || 'Unknown',
            submitted_at: reportData.submitted_at || reportData.created_at || new Date().toISOString(),
            reviewed_by: reportData.reviewer?.name,
            reviewed_at: reportData.reviewed_at,
            rejection_reason: reportData.rejection_reason,
            total_items,
            matched_items,
            missing_items,
            over_items
        };

        return { success: true, report };
    } catch (e: any) {
        console.error('[Inventory] Get report detail error:', e);
        return { success: false };
    }
}




