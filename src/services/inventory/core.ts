import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { REPORT_STATUS, DIFF_REASON_OPTIONS, ReportStatus, DiffReason, ReportSummary, ReportDetail, ReviewResult, BulkReviewResult, InventoryProduct, MasterItem, NV_ALLOWED_FIELDS, ADMIN_ALLOWED_FIELDS, REVIEW_ALLOWED_ROLES } from "./types";
export async function getItems(store: string, shift: number): Promise<{ success: boolean; products: InventoryProduct[] }> {
    if (!store || !shift || shift < 1 || shift > 3) {
        return { success: false, products: [] };
    }

    if (isSupabaseConfigured()) {
        try {
            const { data: serverDate } = await supabase.rpc('get_inventory_date', { p_shift: shift });
            const dateStr = serverDate || new Date().toISOString().split('T')[0];

            const { data, error } = await supabase
                .from('inventory_items')
                .select(`
            id,
            system_stock,
            actual_stock,
            diff,
            status,
            note,
            shift,
            diff_reason,
            snapshot_at,
            products (
              id,
              name,
              sp,
              barcode
            ),
            stores!inner (
              code
            )
          `)
                .eq('stores.code', store)
                .eq('shift', shift)
                .eq('check_date', dateStr);

            if (error) throw error;

            const products: InventoryProduct[] = (data || []).map((item: any) => ({
                id: item.id,
                productName: item.products?.name || '[Đã xóa]',
                sp: item.products?.sp || '',
                barcode: item.products?.barcode || '',
                systemStock: item.system_stock || 0,
                actualStock: item.actual_stock,
                diff: item.diff || 0,
                status: item.status || 'PENDING',
                note: item.note || '',
                diffReason: item.diff_reason || null,
                snapshotAt: item.snapshot_at || null,
            }));

            return { success: true, products };
        } catch (e) {
            console.error('[Inventory] Get items error:', e);
            return { success: false, products: [] };
        }
    }
    return { success: false, products: [] };
}
export async function updateItem(id: string, field: string, value: any, userId?: string, userRole?: 'ADMIN' | 'EMPLOYEE'): Promise<{ success: boolean }> {
    if (!id || !field) {
        return { success: false };
    }

    const allowedFields = userRole === 'ADMIN'
        ? ADMIN_ALLOWED_FIELDS as readonly string[]
        : NV_ALLOWED_FIELDS as readonly string[];
    if (!allowedFields.includes(field)) {
        console.error(`[Inventory] SEC: Blocked update to '${field}' by role '${userRole || 'unknown'}'`);
        return { success: false };
    }

    if (field === 'actual_stock' && value !== null && value !== '') {
        const numVal = Number(value);
        if (isNaN(numVal) || numVal < 0 || numVal > 99999) {
            console.error(`[Inventory] SEC: Invalid actual_stock value: ${value}`);
            return { success: false };
        }
    }

    if (field === 'note' && typeof value === 'string' && value.length > 500) {
        console.error(`[Inventory] SEC: Note too long: ${value.length} chars`);
        return { success: false };
    }

    if (field === 'diff_reason' && value !== null) {
        const validReasons = DIFF_REASON_OPTIONS.map(r => r.value);
        if (!validReasons.includes(value)) {
            console.error(`[Inventory] SEC: Invalid diff_reason: ${value}`);
            return { success: false };
        }
    }

    if (isSupabaseConfigured()) {
        try {
            const updateData: Record<string, any> = {
                [field]: value,
                updated_at: new Date().toISOString(),
            };

            if (field === 'actual_stock' && value !== null && value !== '') {
                const numVal = Number(value);
                updateData[field] = numVal;
                updateData.checked_by = userId;
                updateData.checked_at = new Date().toISOString();
            } else if (field === 'actual_stock' && (value === null || value === '')) {
                updateData[field] = null;
                
            }

            const { error } = await supabase
                .from('inventory_items')
                .update(updateData)
                .eq('id', id);

            if (error) throw error;
            return { success: true };
        } catch (e) {
            console.error('[Inventory] Update error:', e);
            return { success: false };
        }
    }
    return { success: false };
}
export async function submitReport(storeCode: string, shift: number, userId: string): Promise<{ success: boolean; message?: string }> {
    if (!storeCode || !shift || !userId) {
        return { success: false, message: 'Thiếu thông tin bắt buộc' };
    }
    if (shift < 1 || shift > 3) {
        return { success: false, message: 'Ca không hợp lệ' };
    }

    if (isSupabaseConfigured()) {
        try {
            const { data: store } = await supabase
                .from('stores')
                .select('id')
                .eq('code', storeCode)
                .single();

            if (!store) {
                return { success: false, message: 'Cửa hàng không tồn tại' };
            }

            const { data: serverDate } = await supabase.rpc('get_inventory_date', { p_shift: shift });
            const today = serverDate || new Date().toISOString().split('T')[0];
            const { data: existingReport } = await supabase
                .from('inventory_reports')
                .select('id, status')
                .eq('store_id', store.id)
                .eq('check_date', today)
                .eq('shift', shift)
                .maybeSingle();

            if (existingReport) {
                return { success: false, message: `Báo cáo đã được nộp (${existingReport.status}). Không thể nộp lại.` };
            }

            const { data: items, error: itemsError } = await supabase
                .from('inventory_items')
                .select('*')
                .eq('store_id', store.id)
                .eq('shift', shift)
                .eq('check_date', today);

            if (itemsError) throw itemsError;
            if (!items || items.length === 0) {
                return { success: false, message: 'Không có dữ liệu kiểm kê' };
            }

            const checkedItems = items.filter((i: any) => i.actual_stock !== null);

            const historyItems = items.map((item: any) => ({
                store_id: store.id,
                product_id: item.product_id,
                shift: shift,
                check_date: today,
                system_stock: item.system_stock,
                actual_stock: item.actual_stock,
                diff: item.diff,
                status: item.status,
                note: item.note,
                diff_reason: item.diff_reason || null,
                checked_by: userId,
            }));

            const { error: histError } = await supabase
                .from('inventory_history')
                .upsert(historyItems, {
                    onConflict: 'store_id,product_id,check_date,shift',
                });

            if (histError) throw histError;

            const { error: reportError } = await supabase
                .from('inventory_reports')
                .upsert({
                    store_id: store.id,
                    check_date: today,
                    shift: shift,
                    submitted_by: userId,
                    submitted_at: new Date().toISOString(),
                    status: 'PENDING'
                }, { onConflict: 'store_id,check_date,shift' });

            if (reportError) console.error('[Inventory] Report creation warning:', reportError);

            return {
                success: true,
                message: `Đã lưu lịch sử kiểm kê (${checkedItems.length}/${items.length} SP)`
            };
        } catch (e: any) {
            console.error('[Inventory] Submit report error:', e);
            return { success: false, message: 'Lỗi hệ thống khi nộp báo cáo. Vui lòng thử lại.' };
        }
    }
    return { success: false, message: 'Database disconnected' };
}
export async function getReportStatus(storeCode: string, shift: number): Promise<{ submitted: boolean; report?: { submittedBy: string; submittedAt: string; status: string } }> {
    if (!storeCode || !shift || !isSupabaseConfigured()) {
        return { submitted: false };
    }

    try {
        const { data: serverDate } = await supabase.rpc('get_inventory_date', { p_shift: shift });
        const today = serverDate || new Date().toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('inventory_reports')
            .select(`
                    id,
                    status,
                    submitted_at,
                    created_at,
                    stores!inner ( code ),
                    users!inventory_reports_submitted_by_fkey ( name )
                `)
            .eq('stores.code', storeCode)
            .eq('check_date', today)
            .eq('shift', shift)
            .maybeSingle();

        if (error) throw error;

        if (data) {
            return {
                submitted: true,
                report: {
                    submittedBy: (data as any).users?.name || 'Nhân viên',
                    submittedAt: (data as any).submitted_at || (data as any).created_at || '',
                    status: (data as any).status || 'PENDING'
                }
            };
        }

        return { submitted: false };
    } catch (e) {
        console.error('[Inventory] Check report status error:', e);
        return { submitted: false };
    }
}
export async function createStore(data: {
    name: string;
    code: string;
}): Promise<{ success: boolean; error?: string }> {
    if (!data.name || !data.code) {
        return { success: false, error: 'Tên và mã cửa hàng là bắt buộc' };
    }

    if (isSupabaseConfigured()) {
        try {
            const { error } = await supabase
                .from('stores')
                .insert([{
                    name: data.name,
                    code: data.code.toUpperCase(),
                }]);

            if (error) throw error;
            return { success: true };
        } catch (e: any) {
            console.error('[Inventory] Create store error:', e);
            return { success: false, error: 'Không thể tạo cửa hàng: ' + e.message };
        }
    }
    return { success: false, error: 'Database disconnected' };
}
export async function reviewReport(reportId: string, status: ReportStatus, reviewerId: string, reason?: string, userRole?: string): Promise<ReviewResult> {
    if (!reportId || !status || !reviewerId) {
        return { success: false, message: 'Thiếu thông tin bắt buộc' };
    }

    if (userRole && !REVIEW_ALLOWED_ROLES.includes(userRole as any)) {
        console.error(`[Inventory] SEC: Unauthorized review attempt by role '${userRole}'`);
        return { success: false, message: 'Chỉ Admin/Manager mới có quyền duyệt báo cáo' };
    }

    if (!isSupabaseConfigured()) {
        return { success: false, message: 'Database disconnected' };
    }

    try {
        const { data: report, error: fetchErr } = await supabase
            .from('inventory_reports')
            .select('store_id, check_date, shift, status')
            .eq('id', reportId)
            .single();
        if (fetchErr) throw fetchErr;

        if (report.status !== REPORT_STATUS.PENDING) {
            return {
                success: false,
                message: `Báo cáo đã được xử lý (${report.status === REPORT_STATUS.APPROVED ? 'đã duyệt' : 'đã từ chối'}). Vui lòng refresh.`
            };
        }

        const { data: updated, error } = await supabase
            .from('inventory_reports')
            .update({
                status,
                reviewed_by: reviewerId,
                reviewed_at: new Date().toISOString(),
                rejection_reason: reason || null
            })
            .eq('id', reportId)
            .eq('status', REPORT_STATUS.PENDING)
            .select('id');

        if (error) throw error;
        if (!updated || updated.length === 0) {
            return { success: false, message: 'Báo cáo đã được xử lý bởi người khác. Vui lòng refresh.' };
        }
        let stockUpdateFailed = false;
        if (status === REPORT_STATUS.APPROVED && report) {
            const { error: stockErr } = await supabase.rpc(
                'apply_approved_stock_update',
                {
                    p_store_id: report.store_id,
                    p_check_date: report.check_date,
                    p_shift: report.shift
                }
            );
            if (stockErr) {
                console.error('[Inventory] CRITICAL: Stock update RPC failed:', stockErr);
                stockUpdateFailed = true;
            }
        }

        return {
            success: true,
            stockUpdateFailed,
            message: stockUpdateFailed
                ? 'Đã duyệt báo cáo nhưng cập nhật tồn kho thất bại. Vui lòng liên hệ admin.'
                : undefined
        };
    } catch (e: any) {
        console.error('[Inventory] Review report error:', e);
        return { success: false, message: e.message };
    }
}
export async function bulkReviewReports(reportIds: string[], status: ReportStatus, reviewerId: string, reason?: string, userRole?: string): Promise<BulkReviewResult> {
    if (!reportIds.length) {
        return { success: false, processed: 0, failed: 0, stockWarnings: [], errors: ['Không có báo cáo để xử lý'] };
    }

    if (userRole && !REVIEW_ALLOWED_ROLES.includes(userRole as any)) {
        return { success: false, processed: 0, failed: 0, stockWarnings: [], errors: ['Không có quyền duyệt báo cáo'] };
    }

    const results = await Promise.allSettled(
        reportIds.map(id => reviewReport(id, status, reviewerId, reason, userRole))
    );

    let processed = 0;
    let failed = 0;
    const stockWarnings: string[] = [];
    const errors: string[] = [];

    results.forEach((result, idx) => {
        if (result.status === 'fulfilled' && result.value.success) {
            processed++;
            if (result.value.stockUpdateFailed) {
                stockWarnings.push(reportIds[idx]);
            }
        } else {
            failed++;
            const msg = result.status === 'fulfilled' ? result.value.message : 'Lỗi hệ thống';
            if (msg) errors.push(msg);
        }
    });

    return {
        success: processed > 0,
        processed,
        failed,
        stockWarnings,
        errors: [...new Set(errors)] // Deduplicate
    };
}
export async function getOverview(date: string): Promise<{
    success: boolean;
    stats?: {
        totalStores: number;
        completedStores: number;
        inProgressStores: number;
        pendingStores: number;
        issuesCount: number;
    };
    stores?: Array<{
        id: string;
        code: string;
        name: string;
        color: string;
        shift: number;
        employee: {
            id: string;
            name: string;
        } | null;
        progress: {
            total: number;
            checked: number;
            matched: number;
            missing: number;
            over: number;
            percentage: number;
        };
        reportStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
        lastUpdate: string | null;
    }>;
}> {
    if (!date || !isSupabaseConfigured()) {
        return { success: false };
    }

    try {
        const prevDate = new Date(date + 'T00:00:00');
        prevDate.setDate(prevDate.getDate() - 1);
        const yesterdayStr = prevDate.toISOString().slice(0, 10);

        const { data: storesOverview, error } = await supabase
            .from('inventory_overview_dashboard')
            .select('*')
            .in('check_date', [date, yesterdayStr]);

        if (error) throw error;

        const stores = (storesOverview || []).map((store: any) => {
            const percentage = store.total_items > 0 ? Math.round((store.checked_items / store.total_items) * 100) : 0;
            return {
                id: store.store_id,
                code: store.store_code,
                name: store.store_name,
                color: '#6B7280',
                shift: store.shift || 1,
                employee: store.employee_id ? {
                    id: store.employee_id,
                    name: store.employee_name || 'Nhân viên'
                } : null,
                progress: {
                    total: store.total_items,
                    checked: store.checked_items,
                    matched: store.matched_items,
                    missing: store.missing_items,
                    over: store.over_items,
                    percentage
                },
                reportStatus: store.report_status || null,
                lastUpdate: store.last_update ? new Date(store.last_update).toISOString() : null
            };
        }).filter((store: any) => store.progress.total > 0);

        const deduped = new Map<string, any>();
        for (const s of stores) {
            const key = `${s.code}-${s.shift}`;
            const existing = deduped.get(key);
            if (!existing) {
                deduped.set(key, s);
            } else {
                const preferDate = s.shift === 3 ? yesterdayStr : date;
                const sDate = (storesOverview || []).find((r: any) =>
                    r.store_code === s.code && r.shift === s.shift && r.check_date === preferDate
                );
                if (sDate) {
                    const pct = sDate.total_items > 0 ? Math.round((sDate.checked_items / sDate.total_items) * 100) : 0;
                    deduped.set(key, {
                        ...s,
                        progress: {
                            total: sDate.total_items,
                            checked: sDate.checked_items,
                            matched: sDate.matched_items,
                            missing: sDate.missing_items,
                            over: sDate.over_items,
                            percentage: pct,
                        },
                        reportStatus: sDate.report_status || null,
                    });
                }
            }
        }
        const finalStores = Array.from(deduped.values());

        const stats = {
            totalStores: finalStores.length,
            completedStores: finalStores.filter((s: any) => s.reportStatus === 'APPROVED').length,
            inProgressStores: finalStores.filter((s: any) => s.reportStatus === 'PENDING' || (s.progress.checked > 0 && !s.reportStatus)).length,
            pendingStores: finalStores.filter((s: any) => s.progress.checked === 0 && !s.reportStatus).length,
            issuesCount: finalStores.reduce((sum: number, s: any) => sum + s.progress.missing + s.progress.over, 0)
        };

        return {
            success: true,
            stats,
            stores: finalStores
        };
    } catch (e: any) {
        console.error('[Inventory] Get overview error:', e);
        return { success: false };
    }
}

export async function getReportItems(storeId: string, checkDate: string, shift: number): Promise<{
    success: boolean;
    items?: Array<{
        id: string;
        product_name: string;
        barcode: string;
        category: string;
        system_stock: number;
        actual_stock: number | null;
        diff: number | null;
        status: string;
        note: string | null;
        diff_reason: string | null;
    }>;
}> {
    if (!isSupabaseConfigured()) return { success: false };

    try {
        const { data, error } = await supabase
            .from('inventory_items')
            .select(`
                    id,
                    system_stock,
                    actual_stock,
                    diff,
                    status,
                    note,
                    diff_reason,
                    products (
                        name,
                        barcode,
                        category
                    )
                `)
            .eq('store_id', storeId)
            .eq('check_date', checkDate)
            .eq('shift', shift)
            .order('created_at', { ascending: true });

        if (error) throw error;

        const items = (data || []).map((item: any) => ({
            id: item.id,
            product_name: item.products?.name || '[Đã xóa]',
            barcode: item.products?.barcode || '',
            category: item.products?.category || '',
            system_stock: item.system_stock ?? 0,
            actual_stock: item.actual_stock,
            diff: item.diff,
            status: item.status || 'PENDING',
            note: item.note,
            diff_reason: item.diff_reason,
        }));

        return { success: true, items };
    } catch (e: any) {
        console.error('[Inventory] Get report items error:', e);
        return { success: false };
    }
}
export async function deleteReport(reportId: string): Promise<{ success: boolean; message?: string }> {
    if (!reportId) return { success: false, message: 'Missing report ID' };
    if (!isSupabaseConfigured()) return { success: false, message: 'Database disconnected' };

    try {
        const { data: report, error: fetchErr } = await supabase
            .from('inventory_reports')
            .select('id, store_id, check_date, shift, status')
            .eq('id', reportId)
            .single();

        if (fetchErr || !report) return { success: false, message: 'Báo cáo không tồn tại' };

        const safeDel = async (table: string, filters: Record<string, any>) => {
            try {
                let q = supabase.from(table).delete();
                for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
                const { error } = await q;
                if (error) {
                    console.warn(`[Inventory] Cascade delete from '${table}' warning:`, error.message);
                }
            } catch (e: any) {
                console.warn(`[Inventory] Cascade delete from '${table}' failed:`, e.message);
            }
        };



        if (report.store_id && report.check_date && report.shift) {
            await safeDel('inventory_history', {
                store_id: report.store_id,
                check_date: report.check_date,
                shift: report.shift
            });
        }

        const { error: delErr } = await supabase
            .from('inventory_reports')
            .delete()
            .eq('id', reportId);

        if (delErr) throw delErr;

        return { success: true };
    } catch (e: any) {
        console.error('[Inventory] Delete report error:', e);
        return { success: false, message: 'Lỗi hệ thống khi xóa báo cáo' };
    }
}











