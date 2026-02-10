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
                console.log('[Inventory] Adding product:', product);

                // Check current session
                const { data: { session } } = await supabase.auth.getSession();
                console.log('[Inventory] Current session:', session?.user?.id ? 'Logged in' : 'Not logged in');

                const { data, error } = await supabase
                    .from('products')
                    .insert([{
                        barcode: product.barcode,
                        name: product.name,
                        unit: product.unit || '',
                        category: product.category || '',
                    }])
                    .select();

                if (error) {
                    console.error('[Inventory] Insert error details:', {
                        message: error.message,
                        code: error.code,
                        details: error.details,
                        hint: error.hint
                    });
                    throw error;
                }

                console.log('[Inventory] Product added successfully:', data);
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
                console.log('[Inventory] Updating product:', id, data);

                const { error } = await supabase
                    .from('products')
                    .update(data) // updated_at auto-updated by trigger
                    .eq('id', id);

                if (error) {
                    console.error('[Inventory] Update error:', error);
                    throw error;
                }

                console.log('[Inventory] Product updated successfully');
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
    },

    async getReports(status?: string, storeCode?: string): Promise<{ success: boolean; reports?: any[] }> {
        if (isSupabaseConfigured()) {
            try {
                let query = supabase
                    .from('inventory_reports')
                    .select(`
                        id,
                        check_date,
                        shift,
                        status,
                        created_at,
                        stores!inner (
                            id,
                            code,
                            name
                        ),
                        users!inventory_reports_submitted_by_fkey (
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

                // Get stats for each report
                const reportsWithStats = await Promise.all((data || []).map(async (report: any) => {
                    const { data: items } = await supabase
                        .from('inventory_history')
                        .select('status')
                        .eq('store_id', report.stores.id)
                        .eq('shift', report.shift)
                        .eq('check_date', report.check_date);

                    const stats = (items || []).reduce((acc: any, item: any) => {
                        acc.total++;
                        if (item.status === 'MATCHED') acc.matched++;
                        if (item.status === 'MISSING') acc.missing++;
                        if (item.status === 'OVER') acc.over++;
                        return acc;
                    }, { total: 0, matched: 0, missing: 0, over: 0 });

                    return {
                        id: report.id,
                        store: report.stores.code,
                        shift: report.shift,
                        date: report.check_date,
                        submittedBy: report.users?.name || 'Unknown',
                        submittedAt: report.created_at,
                        status: report.status,
                        ...stats
                    };
                }));

                return { success: true, reports: reportsWithStats };
            } catch (e) {
                console.error('[Inventory] Get reports error:', e);
                return { success: false, reports: [] };
            }
        }
        return { success: false, reports: [] };
    },

    async reviewReport(
        reportId: string,
        status: 'APPROVED' | 'REJECTED',
        reviewerId: string,
        reason?: string
    ): Promise<{ success: boolean; message?: string }> {
        if (!reportId || !status || !reviewerId) {
            return { success: false, message: 'Thiếu thông tin bắt buộc' };
        }

        if (isSupabaseConfigured()) {
            try {
                const { error } = await supabase
                    .from('inventory_reports')
                    .update({
                        status,
                        reviewed_by: reviewerId,
                        reviewed_at: new Date().toISOString(),
                        rejection_reason: reason || null
                    })
                    .eq('id', reportId);

                if (error) throw error;
                return { success: true };
            } catch (e: any) {
                console.error('[Inventory] Review report error:', e);
                return { success: false, message: e.message };
            }
        }
        return { success: false, message: 'Database disconnected' };
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
                .select('id, code, name, bg_color, color')
                .eq('active', true)
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

            // Build store progress map
            const stores = (storesData || []).map(store => {
                // Get items for this store
                const storeItems = (itemsData || []).filter(item => item.store_id === store.id);

                // Get report for this store (assuming 1 report per store per day)
                const storeReport = (reportsData || []).find(r => r.store_id === store.id);

                // Calculate progress
                const total = storeItems.length;
                const checked = storeItems.filter(item => item.actual_stock !== null).length;
                const matched = storeItems.filter(item => item.status === 'MATCHED').length;
                const missing = storeItems.filter(item => item.status === 'MISSING').length;
                const over = storeItems.filter(item => item.status === 'OVER').length;
                const percentage = total > 0 ? Math.round((checked / total) * 100) : 0;

                // Get last update time
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
                    color: store.color || '#6B7280',
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
    }
};


export default InventoryService;

