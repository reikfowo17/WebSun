import { supabase, isSupabaseConfigured } from '../lib/supabase';

// ===========================================================================
// TYPES
// ===========================================================================

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

// ===========================================================================
// INVENTORY SERVICE
// ===========================================================================

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
                    .eq('shift', shift);

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
        userId?: string
    ): Promise<{ success: boolean }> {
        if (!id || !field) {
            return { success: false };
        }

        if (isSupabaseConfigured()) {
            try {
                const updateData: Record<string, any> = {
                    [field]: value,
                    updated_at: new Date().toISOString(),
                };

                // Auto-calculate diff and status for stock changes
                if (field === 'actual_stock' && value !== null) {
                    const { data: itemData } = await supabase
                        .from('inventory_items')
                        .select('system_stock')
                        .eq('id', id)
                        .single();

                    const item = itemData as any;
                    if (item) {
                        const diff = Number(value) - (item.system_stock || 0);
                        updateData.diff = diff;
                        updateData.status = diff === 0 ? 'MATCHED' : (diff < 0 ? 'MISSING' : 'OVER');
                        updateData.checked_by = userId;
                        updateData.checked_at = new Date().toISOString();
                    }
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
        // Input validation
        if (!storeCode || !shift || !userId) {
            return { success: false, message: 'Thiếu thông tin bắt buộc' };
        }

        if (isSupabaseConfigured()) {
            try {
                // Get store ID
                const { data: store } = await supabase
                    .from('stores')
                    .select('id')
                    .eq('code', storeCode)
                    .single();

                if (!store) {
                    return { success: false, message: 'Cửa hàng không tồn tại' };
                }

                // Get current inventory items
                const { data: items, error: itemsError } = await supabase
                    .from('inventory_items')
                    .select('*')
                    .eq('store_id', store.id)
                    .eq('shift', shift);

                if (itemsError) throw itemsError;
                if (!items || items.length === 0) {
                    return { success: false, message: 'Không có dữ liệu kiểm kê' };
                }

                // Create history records
                const checkDate = new Date().toISOString().split('T')[0];
                const historyItems = items.map((item: any) => ({
                    store_id: store.id,
                    product_id: item.product_id,
                    shift: shift,
                    check_date: checkDate,
                    system_stock: item.system_stock,
                    actual_stock: item.actual_stock,
                    diff: item.diff,
                    status: item.status,
                    note: item.note,
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
                        check_date: checkDate,
                        shift: shift,
                        submitted_by: userId,
                        status: 'PENDING'
                    }, { onConflict: 'store_id,check_date,shift' });

                if (reportError) console.error('[Inventory] Report creation warning:', reportError);

                return {
                    success: true,
                    message: `Đã lưu lịch sử kiểm kê (${items.length} SP)`
                };
            } catch (e: any) {
                console.error('[Inventory] Submit report error:', e);
                return { success: false, message: 'Lỗi: ' + e.message };
            }
        }
        return { success: false, message: 'Database disconnected' };
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
        unit?: string;
        category?: string;
    }): Promise<{ success: boolean; error?: string }> {
        if (!product.barcode || !product.name) {
            return { success: false, error: 'Mã barcode và tên sản phẩm là bắt buộc' };
        }

        if (isSupabaseConfigured()) {
            try {
                const { error } = await supabase
                    .from('products')
                    .insert([{
                        barcode: product.barcode,
                        name: product.name,
                        unit: product.unit || '',
                        category: product.category || '',
                    }]);

                if (error) throw error;
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

        if (isSupabaseConfigured()) {
            try {
                // Get store ID
                const { data: store } = await supabase
                    .from('stores')
                    .select('id')
                    .eq('code', storeCode)
                    .single();

                if (!store) {
                    return { success: false, message: 'Cửa hàng không tồn tại' };
                }

                // Get all products
                const { data: products } = await supabase
                    .from('products')
                    .select('id');

                if (!products || products.length === 0) {
                    return { success: false, message: 'Không có sản phẩm' };
                }

                // Create inventory items
                const today = new Date().toISOString().split('T')[0];
                const inventoryItems = products.map((p: any) => ({
                    store_id: store.id,
                    product_id: p.id,
                    shift: shift,
                    check_date: today,
                    system_stock: 0,
                    actual_stock: null,
                    status: 'PENDING' as const,
                }));

                const { error } = await supabase
                    .from('inventory_items')
                    .insert(inventoryItems);

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

    async getReports(filters?: { storeId?: string; status?: string; date?: string }): Promise<{ success: boolean; reports: any[] }> {
        if (isSupabaseConfigured()) {
            try {
                let query = supabase
                    .from('inventory_reports')
                    .select(`
                        id,
                        store_id,
                        check_date,
                        shift,
                        status,
                        created_at,
                        submitted_by ( name ),
                        approved_by ( name ),
                        stores ( code, name )
                    `)
                    .order('created_at', { ascending: false });

                if (filters?.storeId && filters.storeId !== 'ALL') {
                    query = query.eq('stores.code', filters.storeId);
                }
                if (filters?.status && filters.status !== 'ALL') query = query.eq('status', filters.status);
                if (filters?.date && filters.date !== 'today') query = query.eq('check_date', filters.date);

                const { data: reports, error } = await query;
                if (error) throw error;

                const enhancedReports = await Promise.all(reports.map(async (r: any) => {
                    const { data: stats } = await supabase
                        .from('inventory_report_stats')
                        .select('*')
                        .eq('store_id', r.store_id || '')
                        .eq('check_date', r.check_date)
                        .eq('shift', r.shift)
                        .single();

                    return {
                        id: r.id,
                        date: r.check_date,
                        store: r.stores?.name || 'Unknown',
                        storeId: r.stores?.code,
                        shift: r.shift,
                        employee: r.submitted_by?.name || 'Unknown',
                        status: r.status,
                        approvedBy: r.approved_by?.name,

                        totalItems: stats?.total_items || 0,
                        matched: stats?.matched_items || 0,
                        missing: stats?.missing_items || 0,
                        over: stats?.over_items || 0,
                        missingValue: 0
                    };
                }));

                return { success: true, reports: enhancedReports };
            } catch (e) {
                console.error('Get reports error', e);
                return { success: false, reports: [] };
            }
        }
        return { success: false, reports: [] };
    },

    async updateReportStatus(reportId: string, status: 'APPROVED' | 'REJECTED', userId: string): Promise<{ success: boolean }> {
        if (isSupabaseConfigured()) {
            try {
                const updateData: any = { status };
                if (status === 'APPROVED') {
                    updateData.reviewed_by = userId;
                    updateData.reviewed_at = new Date().toISOString();
                }

                const { error } = await supabase
                    .from('inventory_reports')
                    .update(updateData)
                    .eq('id', reportId);

                if (error) throw error;
                return { success: true };
            } catch (e) {
                return { success: false };
            }
        }
        return { success: false };
    }
};

export default InventoryService;
