import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { REPORT_STATUS, DIFF_REASON_OPTIONS, ReportStatus, DiffReason, ReportSummary, ReportDetail, ReviewResult, BulkReviewResult, InventoryProduct, MasterItem } from "./types";
export async function syncKiotVietStock(storeCode: string, shift: number): Promise<{ success: boolean; message?: string; synced?: number }> {
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

        const { data: dateData } = await supabase.rpc('get_inventory_date', { p_shift: shift });
        const today = dateData || new Date().toISOString().split('T')[0];
        const { data: items } = await supabase
            .from('inventory_items')
            .select('id, product_id, products(barcode)')
            .eq('store_id', store.id)
            .eq('shift', shift)
            .eq('check_date', today);

        if (!items || items.length === 0) {
            return { success: false, message: 'Chưa có danh sách kiểm. Hãy yêu cầu Admin phân phối trước.' };
        }

        const now = new Date().toISOString();
        const updates: { id: string; system_stock: number }[] = [];
        for (const item of items) {
            const barcode = (item as any).products?.barcode;
            if (barcode && stockMap[barcode] !== undefined) {
                updates.push({ id: item.id, system_stock: stockMap[barcode] });
            }
        }

        if (updates.length > 0) {
            const ids = updates.map(u => u.id);
            const stockGroups = new Map<number, string[]>();
            for (const u of updates) {
                const existing = stockGroups.get(u.system_stock) || [];
                existing.push(u.id);
                stockGroups.set(u.system_stock, existing);
            }

            const batchPromises = Array.from(stockGroups.entries()).map(([stock, itemIds]) =>
                supabase
                    .from('inventory_items')
                    .update({ system_stock: stock, snapshot_at: now })
                    .in('id', itemIds)
            );
            await Promise.all(batchPromises);
        }

        const syncedCount = updates.length;

        return {
            success: true,
            synced: syncedCount,
            message: `Đã đồng bộ ${syncedCount}/${items.length} sản phẩm từ KiotViet`
        };
    } catch (e: any) {
        console.error('[Inventory] KiotViet sync error:', e);
        return { success: false, message: 'Lỗi: ' + e.message };
    }
}

