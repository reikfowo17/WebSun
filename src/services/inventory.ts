import { supabase, isSupabaseConfigured } from '../lib/supabase';

const NV_ALLOWED_FIELDS = ['actual_stock', 'note', 'diff_reason'] as const;
const ADMIN_ALLOWED_FIELDS = [...NV_ALLOWED_FIELDS, 'system_stock', 'status'] as const;

export const REPORT_STATUS = {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
} as const;
export type ReportStatus = typeof REPORT_STATUS[keyof typeof REPORT_STATUS];

const REVIEW_ALLOWED_ROLES = ['ADMIN', 'MANAGER'] as const;

export const DIFF_REASON_OPTIONS = [
    { value: 'DAMAGED', label: 'Hàng hỏng', icon: 'broken_image' },
    { value: 'EXPIRED', label: 'Hết hạn', icon: 'event_busy' },
    { value: 'LOST', label: 'Mất mát', icon: 'search_off' },
    { value: 'MISCOUNT', label: 'Nhầm lẫn nhập/xuất', icon: 'swap_horiz' },
    { value: 'IN_TRANSIT', label: 'Đang vận chuyển', icon: 'local_shipping' },
    { value: 'OTHER', label: 'Khác', icon: 'more_horiz' },
] as const;

export type DiffReason = typeof DIFF_REASON_OPTIONS[number]['value'];

export interface ReportSummary {
    id: string;
    storeId: string;
    store: string;
    shift: number;
    date: string;
    submittedBy: string;
    submittedAt: string;
    status: ReportStatus;
    total: number;
    matched: number;
    missing: number;
    over: number;
    reviewedBy: string | null;
    reviewedAt: string | null;
    rejectionReason: string | null;
}

export interface ReportDetail {
    id: string;
    store_code: string;
    store_name: string;
    shift: number;
    check_date: string;
    status: ReportStatus;
    submitted_by: string;
    submitted_at: string;
    reviewed_by?: string;
    reviewed_at?: string;
    rejection_reason?: string;
    total_items: number;
    matched_items: number;
    missing_items: number;
    over_items: number;
}

export interface ReviewResult {
    success: boolean;
    message?: string;
    stockUpdateFailed?: boolean;
}

export interface BulkReviewResult {
    success: boolean;
    processed: number;
    failed: number;
    stockWarnings: string[];
    errors: string[];
}

export interface InventoryProduct {
    id: string;
    productName: string;
    pvn: string;
    barcode: string;
    systemStock: number;
    actualStock: number | null;
    diff: number;
    status: 'PENDING' | 'MATCHED' | 'MISSING' | 'OVER';
    note: string;
    diffReason?: DiffReason | null;
    snapshotAt?: string | null;
}

export interface MasterItem {
    id: string;
    name: string;
    pvn: string;
    barcode: string;
    category: string;
    unit: string;
    unitPrice: number;
}

export const InventoryService = {
    async getItems(
        store: string,
        shift: number
    ): Promise<{ success: boolean; products: InventoryProduct[] }> {
        if (!store || !shift || shift < 1 || shift > 3) {
            return { success: false, products: [] };
        }

        if (isSupabaseConfigured()) {
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
            shift,
            products (
              id,
              name,
              pvn,
              barcode
            ),
            stores!inner (
              code
            )
          `)
                    .eq('stores.code', store)
                    .eq('shift', shift)
                    .eq('check_date', new Date().toISOString().split('T')[0]);

                if (error) throw error;

                const products: InventoryProduct[] = (data || []).map((item: any) => ({
                    id: item.id,
                    productName: item.products?.name || '',
                    pvn: item.products?.pvn || '',
                    barcode: item.products?.barcode || '',
                    systemStock: item.system_stock || 0,
                    actualStock: item.actual_stock,
                    diff: item.diff || 0,
                    status: item.status || 'PENDING',
                    note: item.note || '',
                }));

                return { success: true, products };
            } catch (e) {
                console.error('[Inventory] Get items error:', e);
                return { success: false, products: [] };
            }
        }
        return { success: false, products: [] };
    },

    async updateItem(
        id: string,
        field: string,
        value: any,
        userId?: string,
        userRole?: 'ADMIN' | 'EMPLOYEE'
    ): Promise<{ success: boolean }> {
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
                    // Convert to integer for DB (actual_stock is INT column)
                    updateData[field] = Number(value);

                    const { data: itemData } = await supabase
                        .from('inventory_items')
                        .select('system_stock')
                        .eq('id', id)
                        .single();

                    const item = itemData as any;
                    if (item) {
                        // diff is a GENERATED column (COALESCE(actual_stock,0) - system_stock)
                        // Do NOT include it in updateData — PostgreSQL computes it automatically
                        const diff = Number(value) - (item.system_stock || 0);
                        updateData.status = diff === 0 ? 'MATCHED' : (diff < 0 ? 'MISSING' : 'OVER');
                        updateData.checked_by = userId;
                        updateData.checked_at = new Date().toISOString();
                    }
                } else if (field === 'actual_stock' && (value === null || value === '')) {
                    // Clearing actual_stock — reset status
                    updateData[field] = null;
                    updateData.status = 'PENDING';
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
    },

    async submitReport(
        storeCode: string,
        shift: number,
        userId: string
    ): Promise<{ success: boolean; message?: string }> {
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

                const today = new Date().toISOString().split('T')[0];
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

                // Create history records
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
                    .insert(historyItems);

                if (histError) throw histError;

                // Create or update Report record
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
                return { success: false, message: 'Lỗi: ' + e.message };
            }
        }
        return { success: false, message: 'Database disconnected' };
    },

    async getReportStatus(
        storeCode: string,
        shift: number
    ): Promise<{ submitted: boolean; report?: { submittedBy: string; submittedAt: string; status: string } }> {
        if (!storeCode || !shift || !isSupabaseConfigured()) {
            return { submitted: false };
        }

        try {
            const today = new Date().toISOString().split('T')[0];

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
    },

    async getMasterItems(): Promise<{ success: boolean; items: MasterItem[] }> {
        if (isSupabaseConfigured()) {
            try {
                const { data, error } = await supabase
                    .from('products')
                    .select('*')
                    .order('name');

                if (error) throw error;

                const items: MasterItem[] = (data || []).map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    pvn: p.pvn || '',
                    barcode: p.barcode,
                    category: p.category || '',
                    unit: p.unit || '',
                    unitPrice: p.unit_price || 0,
                }));

                return { success: true, items };
            } catch (e) {
                console.error('[Inventory] Get master items error:', e);
                return { success: false, items: [] };
            }
        }
        return { success: false, items: [] };
    },

    async addMasterItem(product: {
        barcode: string;
        name: string;
        pvn?: string;
        unit?: string;
        category?: string;
    }): Promise<{ success: boolean; error?: string }> {
        if (!product.barcode || !product.name) {
            return { success: false, error: 'Mã barcode và tên sản phẩm là bắt buộc' };
        }

        if (isSupabaseConfigured()) {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    return { success: false, error: 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.' };
                }

                const { data, error } = await supabase.rpc('admin_insert_product', {
                    p_barcode: product.barcode,
                    p_name: product.name,
                    p_unit: product.unit || '',
                    p_category: product.category || '',
                    p_pvn: product.pvn || null,
                });

                if (error) {
                    console.error('[Inventory] RPC insert error:', error);
                    throw error;
                }

                const result = data as any;
                if (!result?.success) {
                    return { success: false, error: result?.error || 'Lỗi không xác định' };
                }
                return { success: true };
            } catch (e: any) {
                console.error('[Inventory] Add master item error:', e);
                return { success: false, error: 'Không thể thêm sản phẩm: ' + e.message };
            }
        }
        return { success: false, error: 'Database disconnected' };
    },

    async distributeToStore(
        storeCode: string,
        shift: number
    ): Promise<{ success: boolean; message?: string }> {
        if (!storeCode || !shift) {
            return { success: false, message: 'Thiếu thông tin bắt buộc' };
        }
        if (shift < 1 || shift > 3) {
            return { success: false, message: 'Ca không hợp lệ (1-3)' };
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

                const { data: products } = await supabase
                    .from('products')
                    .select('id, barcode');

                if (!products || products.length === 0) {
                    return { success: false, message: 'Không có sản phẩm' };
                }

                const today = new Date().toISOString().split('T')[0];
                const inventoryItems = products.map((p: any) => ({
                    store_id: store.id,
                    product_id: p.id,
                    shift: shift,
                    check_date: today,
                    system_stock: 0,
                    actual_stock: null,
                    diff_reason: null,
                    status: 'PENDING' as const,
                    snapshot_at: null,
                }));

                const { error } = await supabase
                    .from('inventory_items')
                    .upsert(inventoryItems, {
                        onConflict: 'store_id,product_id,shift,check_date',
                        ignoreDuplicates: true
                    });

                if (error) throw error;

                return {
                    success: true,
                    message: `Đã phân phối ${products.length} sản phẩm`
                };
            } catch (e: any) {
                console.error('[Inventory] Distribute error:', e);
                return { success: false, message: 'Lỗi: ' + e.message };
            }
        }
        return { success: false, message: 'Database disconnected' };
    },

    async syncKiotVietStock(
        storeCode: string,
        shift: number
    ): Promise<{ success: boolean; message?: string; synced?: number }> {
        if (!storeCode || !shift) {
            return { success: false, message: 'Thiếu thông tin' };
        }

        if (!isSupabaseConfigured()) {
            return { success: false, message: 'Database disconnected' };
        }

        try {
            // Call Edge Function to get stock map
            const { data: fnData, error: fnErr } = await supabase
                .functions.invoke('kiotviet-stock', {
                    body: { storeCode }
                });

            if (fnErr || !fnData?.stockMap) {
                console.error('[Inventory] KiotViet sync error:', fnErr, fnData);
                return { success: false, message: fnData?.error || 'Không thể kết nối KiotViet' };
            }

            const stockMap: Record<string, number> = fnData.stockMap;

            // Get store ID
            const { data: store } = await supabase
                .from('stores')
                .select('id')
                .eq('code', storeCode)
                .single();

            if (!store) {
                return { success: false, message: 'Cửa hàng không tồn tại' };
            }

            // Get current inventory items with barcode
            const today = new Date().toISOString().split('T')[0];
            const { data: items } = await supabase
                .from('inventory_items')
                .select('id, product_id, products(barcode)')
                .eq('store_id', store.id)
                .eq('shift', shift)
                .eq('check_date', today);

            if (!items || items.length === 0) {
                return { success: false, message: 'Chưa có danh sách kiểm. Hãy yêu cầu Admin phân phối trước.' };
            }

            // Update system_stock for each item
            const now = new Date().toISOString();
            let syncedCount = 0;

            for (const item of items) {
                const barcode = (item as any).products?.barcode;
                if (barcode && stockMap[barcode] !== undefined) {
                    await supabase
                        .from('inventory_items')
                        .update({ system_stock: stockMap[barcode], snapshot_at: now })
                        .eq('id', item.id);
                    syncedCount++;
                }
            }

            return {
                success: true,
                synced: syncedCount,
                message: `Đã đồng bộ ${syncedCount}/${items.length} sản phẩm từ KiotViet`
            };
        } catch (e: any) {
            console.error('[Inventory] KiotViet sync error:', e);
            return { success: false, message: 'Lỗi: ' + e.message };
        }
    },

    async getMonitoringStats(date: string): Promise<{ success: boolean; data: any[] }> {
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
    },

    async updateMasterItem(id: string, data: {
        name?: string;
        barcode?: string;
        unit?: string;
        category?: string;
        unit_price?: number;
    }, userRole?: string): Promise<{ success: boolean; error?: string }> {
        if (!id) return { success: false, error: 'ID sản phẩm không hợp lệ' };
        if (userRole !== 'ADMIN') {
            console.error(`[Inventory] SEC-4: Unauthorized updateMasterItem by role '${userRole}'`);
            return { success: false, error: 'Chỉ Admin mới có quyền sửa sản phẩm' };
        }

        if (isSupabaseConfigured()) {
            try {
                const { error } = await supabase
                    .from('products')
                    .update(data)
                    .eq('id', id);

                if (error) {
                    console.error('[Inventory] Update error:', error);
                    throw error;
                }
                return { success: true };
            } catch (e: any) {
                console.error('[Inventory] Update master item error:', e);
                return { success: false, error: 'Không thể cập nhật: ' + e.message };
            }
        }
        return { success: false, error: 'Database disconnected' };
    },

    async deleteMasterItem(id: string, userRole?: string): Promise<{ success: boolean; error?: string }> {
        if (!id) return { success: false, error: 'ID sản phẩm không hợp lệ' };
        if (userRole !== 'ADMIN') {
            console.error(`[Inventory] Unauthorized deleteMasterItem by role '${userRole}'`);
            return { success: false, error: 'Chỉ Admin mới có quyền xóa sản phẩm' };
        }

        if (isSupabaseConfigured()) {
            try {
                const { error } = await supabase
                    .from('products')
                    .delete()
                    .eq('id', id);

                if (error) throw error;
                return { success: true };
            } catch (e: any) {
                console.error('[Inventory] Delete master item error:', e);
                return { success: false, error: 'Không thể xóa: ' + e.message };
            }
        }
        return { success: false, error: 'Database disconnected' };
    },

    async importProducts(products: Array<{
        barcode: string;
        name: string;
        unit?: string;
        category?: string;
        unit_price?: number;
    }>): Promise<{ success: boolean; imported: number; errors: string[] }> {
        if (!products?.length) {
            return { success: false, imported: 0, errors: ['Không có dữ liệu để import'] };
        }

        if (isSupabaseConfigured()) {
            try {
                const cleanProducts = products
                    .map(p => ({
                        barcode: p.barcode?.trim(),
                        name: p.name?.trim(),
                        unit: p.unit?.trim() || '',
                        category: p.category?.trim() || '',
                    }))
                    .filter(p => p.barcode && p.name);

                if (cleanProducts.length === 0) {
                    return { success: false, imported: 0, errors: ['Không có dữ liệu hợp lệ'] };
                }

                // Use SECURITY DEFINER function to bypass RLS
                const { data, error } = await supabase.rpc('admin_upsert_products', {
                    p_products: cleanProducts,
                });

                if (error) {
                    console.error('[Inventory] RPC import error:', error);
                    return { success: false, imported: 0, errors: [error.message] };
                }

                const result = data as any;
                return {
                    success: result?.success ?? false,
                    imported: result?.imported ?? 0,
                    errors: result?.errors || [],
                };
            } catch (e: any) {
                console.error('[Inventory] Import products error:', e);
                return { success: false, imported: 0, errors: [e.message] };
            }
        }
        return { success: false, imported: 0, errors: ['Database disconnected'] };
    },

    async getStores(): Promise<{ success: boolean; stores: any[] }> {
        if (isSupabaseConfigured()) {
            try {
                const { data, error } = await supabase
                    .from('stores')
                    .select('*')
                    .order('name');

                if (error) throw error;
                return { success: true, stores: data || [] };
            } catch (e) {
                console.error('[Inventory] Get stores error:', e);
                return { success: false, stores: [] };
            }
        }
        return { success: false, stores: [] };
    },

    async updateStore(id: string, data: {
        name?: string;
        code?: string;
        address?: string;
    }): Promise<{ success: boolean; error?: string }> {
        if (!id) return { success: false, error: 'ID cửa hàng không hợp lệ' };

        if (isSupabaseConfigured()) {
            try {
                const { error } = await supabase
                    .from('stores')
                    .update(data)
                    .eq('id', id);

                if (error) throw error;
                return { success: true };
            } catch (e: any) {
                console.error('[Inventory] Update store error:', e);
                return { success: false, error: 'Không thể cập nhật: ' + e.message };
            }
        }
        return { success: false, error: 'Database disconnected' };
    },

    async createStore(data: {
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
    },

    /** C1-FIX: Trả về ReportSummary[] thay vì any[] */
    async getReports(status?: string, storeCode?: string): Promise<{ success: boolean; reports: ReportSummary[] }> {
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
    },

    async getReportDetail(reportId: string): Promise<{ success: boolean; report?: any }> {
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
    },

    async reviewReport(
        reportId: string,
        status: ReportStatus,
        reviewerId: string,
        reason?: string,
        userRole?: string
    ): Promise<ReviewResult> {
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
    },

    async bulkReviewReports(
        reportIds: string[],
        status: ReportStatus,
        reviewerId: string,
        reason?: string,
        userRole?: string
    ): Promise<BulkReviewResult> {
        if (!reportIds.length) {
            return { success: false, processed: 0, failed: 0, stockWarnings: [], errors: ['Không có báo cáo để xử lý'] };
        }

        if (userRole && !REVIEW_ALLOWED_ROLES.includes(userRole as any)) {
            return { success: false, processed: 0, failed: 0, stockWarnings: [], errors: ['Không có quyền duyệt báo cáo'] };
        }

        const results = await Promise.allSettled(
            reportIds.map(id => this.reviewReport(id, status, reviewerId, reason, userRole))
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
    },

    async getOverview(date: string): Promise<{
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
            // Get all stores with their inventory items for the date
            const { data: storesData, error: storesError } = await supabase
                .from('stores')
                .select('id, code, name')
                .order('code');

            if (storesError) throw storesError;

            // Get all inventory items for the date
            const { data: itemsData, error: itemsError } = await supabase
                .from('inventory_items')
                .select('store_id, shift, status, actual_stock, updated_at')
                .eq('check_date', date);

            if (itemsError) throw itemsError;

            // Get all reports for the date
            const { data: reportsData, error: reportsError } = await supabase
                .from('inventory_reports')
                .select(`
                    id,
                    store_id,
                    shift,
                    status,
                    created_at,
                    users!inventory_reports_submitted_by_fkey (
                        id,
                        name
                    )
                `)
                .eq('check_date', date);

            if (reportsError) throw reportsError;

            const stores = (storesData || []).map(store => {
                const storeItems = (itemsData || []).filter(item => item.store_id === store.id);
                const storeReport = (reportsData || []).find(r => r.store_id === store.id);
                const total = storeItems.length;
                const checked = storeItems.filter(item => item.actual_stock !== null).length;
                const matched = storeItems.filter(item => item.status === 'MATCHED').length;
                const missing = storeItems.filter(item => item.status === 'MISSING').length;
                const over = storeItems.filter(item => item.status === 'OVER').length;
                const percentage = total > 0 ? Math.round((checked / total) * 100) : 0;
                const lastUpdate = storeItems.length > 0
                    ? storeItems.reduce((latest, item) => {
                        const itemTime = new Date(item.updated_at || 0).getTime();
                        return itemTime > latest ? itemTime : latest;
                    }, 0)
                    : null;

                return {
                    id: store.id,
                    code: store.code,
                    name: store.name,
                    color: '#6B7280',
                    shift: storeItems[0]?.shift || 1,
                    employee: (storeReport?.users && typeof storeReport.users === 'object' && 'id' in storeReport.users) ? {
                        id: (storeReport.users as any).id,
                        name: (storeReport.users as any).name
                    } : null,
                    progress: {
                        total,
                        checked,
                        matched,
                        missing,
                        over,
                        percentage
                    },
                    reportStatus: storeReport?.status || null,
                    lastUpdate: lastUpdate ? new Date(lastUpdate).toISOString() : null
                };
            }).filter(store => store.progress.total > 0); // Only show stores with distributed items

            // Calculate overall stats
            const stats = {
                totalStores: stores.length,
                completedStores: stores.filter(s => s.reportStatus === 'APPROVED').length,
                inProgressStores: stores.filter(s => s.reportStatus === 'PENDING' || (s.progress.checked > 0 && !s.reportStatus)).length,
                pendingStores: stores.filter(s => s.progress.checked === 0 && !s.reportStatus).length,
                issuesCount: stores.reduce((sum, s) => sum + s.progress.missing + s.progress.over, 0)
            };

            return {
                success: true,
                stats,
                stores
            };
        } catch (e: any) {
            console.error('[Inventory] Get overview error:', e);
            return { success: false };
        }
    },

    async getReportComments(reportId: string): Promise<{ success: boolean; comments?: any[] }> {
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
    },

    async addReportComment(
        reportId: string,
        comment: string,
        userId?: string
    ): Promise<{ success: boolean; error?: string }> {
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
    },

    async updateReportComment(
        commentId: string,
        newComment: string
    ): Promise<{ success: boolean; error?: string }> {
        if (!isSupabaseConfigured()) {
            return { success: false, error: 'Database not configured' };
        }

        if (!newComment || newComment.trim().length === 0) {
            return { success: false, error: 'Comment cannot be empty' };
        }

        try {
            const { error } = await supabase
                .from('inventory_report_comments')
                .update({ comment: newComment.trim() })
                .eq('id', commentId);

            if (error) throw error;
            return { success: true };
        } catch (e: any) {
            console.error('[Inventory] Update comment error:', e);
            return { success: false, error: 'Cannot update comment: ' + e.message };
        }
    },

    async deleteReportComment(commentId: string): Promise<{ success: boolean; error?: string }> {
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
    },

    async getReportItems(storeId: string, checkDate: string, shift: number): Promise<{
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
                product_name: item.products?.name || 'N/A',
                barcode: item.products?.barcode || '',
                category: item.products?.category || '',
                system_stock: item.system_stock ?? 0,
                actual_stock: item.actual_stock,
                diff: item.diff,
                status: item.status || 'UNCHECKED',
                note: item.note,
                diff_reason: item.diff_reason,
            }));

            return { success: true, items };
        } catch (e: any) {
            console.error('[Inventory] Get report items error:', e);
            return { success: false };
        }
    },

    async deleteReport(reportId: string): Promise<{ success: boolean; message?: string }> {
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

            await safeDel('inventory_report_comments', { report_id: reportId });

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
            return { success: false, message: e.message };
        }
    }
};


export default InventoryService;

