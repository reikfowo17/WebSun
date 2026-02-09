import { supabase, isSupabaseConfigured } from '../lib/supabase';

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

    // ======================= MASTER ITEM MANAGEMENT =======================

    async updateMasterItem(id: string, data: {
        name?: string;
        barcode?: string;
        unit?: string;
        category?: string;
        unit_price?: number;
    }): Promise<{ success: boolean; error?: string }> {
        if (!id) return { success: false, error: 'ID sản phẩm không hợp lệ' };

        if (isSupabaseConfigured()) {
            try {
                const { error } = await supabase
                    .from('products')
                    .update({
                        ...data,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', id);

                if (error) throw error;
                return { success: true };
            } catch (e: any) {
                console.error('[Inventory] Update master item error:', e);
                return { success: false, error: 'Không thể cập nhật: ' + e.message };
            }
        }
        return { success: false, error: 'Database disconnected' };
    },

    async deleteMasterItem(id: string): Promise<{ success: boolean; error?: string }> {
        if (!id) return { success: false, error: 'ID sản phẩm không hợp lệ' };

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
                const errors: string[] = [];
                let imported = 0;

                // Process in batches of 100
                const batchSize = 100;
                for (let i = 0; i < products.length; i += batchSize) {
                    const batch = products.slice(i, i + batchSize).map(p => ({
                        barcode: p.barcode?.trim(),
                        name: p.name?.trim(),
                        unit: p.unit?.trim() || '',
                        category: p.category?.trim() || '',
                        unit_price: p.unit_price || 0
                    })).filter(p => p.barcode && p.name);

                    if (batch.length === 0) continue;

                    const { error, data } = await supabase
                        .from('products')
                        .upsert(batch, { onConflict: 'barcode', ignoreDuplicates: false })
                        .select();

                    if (error) {
                        errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
                    } else {
                        imported += data?.length || 0;
                    }
                }

                return {
                    success: errors.length === 0,
                    imported,
                    errors
                };
            } catch (e: any) {
                console.error('[Inventory] Import products error:', e);
                return { success: false, imported: 0, errors: [e.message] };
            }
        }
        return { success: false, imported: 0, errors: ['Database disconnected'] };
    },

    // ======================= STORE MANAGEMENT =======================

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
        is_active?: boolean;
        shifts_enabled?: number[];
    }): Promise<{ success: boolean; error?: string }> {
        if (!id) return { success: false, error: 'ID cửa hàng không hợp lệ' };

        if (isSupabaseConfigured()) {
            try {
                const { error } = await supabase
                    .from('stores')
                    .update({
                        ...data,
                        updated_at: new Date().toISOString()
                    })
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
                        is_active: true
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
};

export default InventoryService;

