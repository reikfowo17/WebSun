import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { REPORT_STATUS, DIFF_REASON_OPTIONS, ReportStatus, DiffReason, ReportSummary, ReportDetail, ReviewResult, BulkReviewResult, InventoryProduct, MasterItem } from "./types";
export async function getMonitoringStats(date: string): Promise<{ success: boolean; data: any[] }> {
        if (isSupabaseConfigured()) {
            try {
                const { data: stores } = await supabase.from('stores').select('id, code, name');
                if (!stores) return { success: false, data: [] };

                const { data: items } = await supabase
                    .from('inventory_items')
                    .select('store_id, status, diff, check_date, shift, actual_stock')
                    .eq('check_date', date);

                const stats = stores.map(store => {
                    const storeItems = items?.filter((i: any) => i.store_id === store.id) || [];
                    const total = storeItems.length;
                    const checked = storeItems.filter((i: any) => i.actual_stock !== null).length;
                    const issues = storeItems.filter((i: any) => i.diff !== 0).length;

                    let status = 'PENDING';
                    if (total > 0) {
                        if (checked === total) status = 'COMPLETED';
                        else if (checked > 0) status = 'IN_PROGRESS';
                    }
                    if (issues > 0 && status === 'COMPLETED') status = 'ISSUE';

                    const currentShift = storeItems.length > 0 ? Math.max(...storeItems.map((i: any) => i.shift || 1)) : 1;

                    return {
                        id: store.code,
                        name: store.name,
                        status: status,
                        progress: checked,
                        total: total,
                        issues: issues,
                        shift: currentShift,
                        staff: '--'
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

            // Get item counts from history
            const { data: items } = await supabase
                .from('inventory_history')
                .select('status, diff')
                .eq('store_id', data.store_id)
                .eq('check_date', data.check_date)
                .eq('shift', data.shift);

            const total_items = items?.length || 0;
            const matched_items = items?.filter((i: any) => i.status === 'MATCHED').length || 0;
            const missing_items = items?.filter((i: any) => i.diff < 0).length || 0;
            const over_items = items?.filter((i: any) => i.diff > 0).length || 0;

            // Cast to any to handle Supabase join types
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
export async function getReportComments(reportId: string): Promise<{ success: boolean; comments?: any[] }> {
        if (!isSupabaseConfigured()) {
            return { success: false };
        }

        try {
            const { data, error } = await supabase
                .from('inventory_report_comments')
                .select(`
                    id,
                    comment,
                    created_at,
                    updated_at,
                    users (
                        id,
                        name
                    )
                `)
                .eq('report_id', reportId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const comments = (data || []).map((c: any) => ({
                id: c.id,
                comment: c.comment,
                created_at: c.created_at,
                updated_at: c.updated_at,
                user_name: c.users?.name || 'Unknown',
                user_id: c.users?.id
            }));

            return { success: true, comments };
        } catch (e: any) {
            console.error('[Inventory] Get comments error:', e);
            return { success: false };
        }
    }
export async function addReportComment(reportId: string, comment: string, userId?: string): Promise<{ success: boolean; error?: string }> {
        if (!isSupabaseConfigured()) {
            return { success: false, error: 'Database not configured' };
        }

        if (!comment || comment.trim().length === 0) {
            return { success: false, error: 'Comment cannot be empty' };
        }

        try {
            let resolvedUserId = userId;
            if (!resolvedUserId) {
                const { data: { session } } = await supabase.auth.getSession();
                resolvedUserId = session?.user?.id;
            }
            if (!resolvedUserId) {
                return { success: false, error: 'Not logged in' };
            }
            const { error } = await supabase
                .from('inventory_report_comments')
                .insert([{
                    report_id: reportId,
                    user_id: resolvedUserId,
                    comment: comment.trim()
                }]);

            if (error) {
                console.error('[Inventory] Add comment error:', error);
                throw error;
            }
            return { success: true };
        } catch (e: any) {
            console.error('[Inventory] Add comment error:', e);
            return { success: false, error: 'Cannot add comment: ' + e.message };
        }
    }
export async function deleteReportComment(commentId: string): Promise<{ success: boolean; error?: string }> {
        if (!isSupabaseConfigured()) {
            return { success: false, error: 'Database not configured' };
        }

        try {
            const { error } = await supabase
                .from('inventory_report_comments')
                .delete()
                .eq('id', commentId);

            if (error) throw error;
            return { success: true };
        } catch (e: any) {
            console.error('[Inventory] Delete comment error:', e);
            return { success: false, error: 'Cannot delete comment: ' + e.message };
        }
    }






