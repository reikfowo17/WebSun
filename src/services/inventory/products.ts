import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { REPORT_STATUS, DIFF_REASON_OPTIONS, ReportStatus, DiffReason, ReportSummary, ReportDetail, ReviewResult, BulkReviewResult, InventoryProduct, MasterItem } from "./types";
export async function getMasterItems(): Promise<{ success: boolean; items: MasterItem[] }> {
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
                sp: p.sp || '',
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
}
export async function addMasterItem(product: {
    barcode: string;
    name: string;
    sp?: string;
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
                p_sp: product.sp || null,
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
}
export async function updateMasterItem(id: string, data: {
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
}
export async function deleteMasterItem(id: string, userRole?: string): Promise<{ success: boolean; error?: string }> {
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
}
export async function importProducts(products: Array<{
    barcode: string;
    name: string;
    unit?: string;
    category?: string;
    sp?: string;
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
                    sp: p.sp?.trim() || '',
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
}





