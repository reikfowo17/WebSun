import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface RecoveryItem {
    id: string;
    store_id: string;
    store_name?: string;
    product_id: string;
    product_name?: string;
    barcode?: string;
    check_date: string;
    missing_qty: number;
    unit_price: number;
    total_amount: number;
    reason: string;
    status: string;
    note: string;
    created_at: string;
}

export interface ScannedItem {
    product_id: string;
    product_name?: string;
    barcode?: string;
    check_date: string;
    missing_qty: number;
    unit_price: number;
    total_amount: number;
}

export const RecoveryService = {
    async scanForDiscrepancies(
        storeCode: string,
        monthStr: string
    ): Promise<{ success: boolean; items: ScannedItem[] }> {
        if (isSupabaseConfigured()) {
            try {
                // Get store ID
                const { data: store } = await supabase
                    .from('stores')
                    .select('id')
                    .eq('code', storeCode)
                    .single();

                if (!store) throw new Error('Cửa hàng không tồn tại');

                // Calculate date range for the month
                const [year, month] = monthStr.split('-');
                const startDate = `${year}-${month}-01`;
                const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];

                // Query inventory_history for negative diffs
                const { data: history, error } = await supabase
                    .from('inventory_history')
                    .select(`
            id,
            check_date,
            diff,
            product_id,
            products (
              name,
              barcode,
              price
            )
          `)
                    .eq('store_id', store.id)
                    .lt('diff', 0)
                    .gte('check_date', startDate)
                    .lte('check_date', endDate);

                if (error) throw error;

                const items: ScannedItem[] = (history || []).map((h: any) => ({
                    product_id: h.product_id,
                    product_name: h.products?.name,
                    barcode: h.products?.barcode,
                    check_date: h.check_date,
                    missing_qty: Math.abs(h.diff),
                    unit_price: h.products?.price || 0,
                    total_amount: Math.abs(h.diff) * (h.products?.price || 0)
                }));

                return { success: true, items };
            } catch (e: any) {
                console.error('[Recovery] Scan error:', e);
                return { success: false, items: [] };
            }
        }

        return { success: false, items: [] };
    },

    async createRecoveryItems(
        storeCode: string,
        items: ScannedItem[]
    ): Promise<{ success: boolean; message: string }> {
        if (isSupabaseConfigured()) {
            try {
                const { data: store } = await supabase
                    .from('stores')
                    .select('id')
                    .eq('code', storeCode)
                    .single();

                if (!store) throw new Error('Cửa hàng không tồn tại');

                const toInsert = items.map(item => ({
                    store_id: store.id,
                    product_id: item.product_id,
                    check_date: item.check_date,
                    missing_qty: item.missing_qty,
                    unit_price: item.unit_price,
                    reason: '',
                    status: 'TRUY THU'
                }));

                const { error } = await supabase
                    .from('recovery_items')
                    .insert(toInsert);

                if (error) throw error;
                return { success: true, message: `Đã tạo ${items.length} phiếu truy thu` };
            } catch (e: any) {
                console.error('[Recovery] Create error:', e);
                return { success: false, message: e.message };
            }
        }

        return { success: false, message: 'Database disconnected' };
    },

    async getRecoveryItems(
        storeCode: string
    ): Promise<{ success: boolean; items: RecoveryItem[] }> {
        if (isSupabaseConfigured()) {
            try {
                let query = supabase
                    .from('recovery_items')
                    .select(`
            id,
            store_id,
            product_id,
            check_date,
            missing_qty,
            unit_price,
            total_amount,
            reason,
            status,
            note,
            created_at,
            products (name, barcode),
            stores!inner (code, name)
          `)
                    .order('check_date', { ascending: false });

                if (storeCode && storeCode !== 'ALL') {
                    query = query.eq('stores.code', storeCode);
                }

                const { data, error } = await query;
                if (error) throw error;

                const items: RecoveryItem[] = (data || []).map((i: any) => ({
                    id: i.id,
                    store_id: i.store_id,
                    store_name: i.stores?.name,
                    product_id: i.product_id,
                    product_name: i.products?.name,
                    barcode: i.products?.barcode,
                    check_date: i.check_date,
                    missing_qty: i.missing_qty,
                    unit_price: i.unit_price,
                    total_amount: i.total_amount,
                    reason: i.reason,
                    status: i.status,
                    note: i.note || '',
                    created_at: i.created_at
                }));

                return { success: true, items };
            } catch (e) {
                console.error('[Recovery] Get items error:', e);
                return { success: false, items: [] };
            }
        }

        return { success: false, items: [] };
    },

    async updateRecoveryItem(
        id: string,
        updates: Partial<RecoveryItem>
    ): Promise<{ success: boolean }> {
        if (isSupabaseConfigured()) {
            const { error } = await supabase
                .from('recovery_items')
                .update(updates)
                .eq('id', id);
            return { success: !error };
        }
        return { success: false };
    }
};

export default RecoveryService;
