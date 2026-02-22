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
    }

