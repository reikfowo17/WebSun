import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { REPORT_STATUS, DIFF_REASON_OPTIONS, ReportStatus, DiffReason, ReportSummary, ReportDetail, ReviewResult, BulkReviewResult, InventoryProduct, MasterItem } from "./types";
export async function distributeToStore(storeCode: string, shift: number): Promise<{ success: boolean; message?: string }> {
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
    }
export async function getStores(): Promise<{ success: boolean; stores: any[] }> {
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
    }
export async function updateStore(id: string, data: {
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
    }



