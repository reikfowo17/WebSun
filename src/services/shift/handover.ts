import { supabase } from '../../lib/supabase';
import type { HandoverProduct, ShiftInventoryHandover } from '../../types/shift';

export const HandoverService = {
    async getProductTemplates(storeId?: string): Promise<HandoverProduct[]> {
        let query = supabase
            .from('shift_handover_products')
            .select('*')
            .eq('is_active', true)
            .order('sort_order');

        if (storeId) {
            query = query.or(`store_ids.cs.{${storeId}},store_ids.is.null`);
        }

        const { data } = await query;
        return data || [];
    },

    async initFromTemplates(
        shiftId: string,
        templates: HandoverProduct[],
        userId: string,
        previousHandover?: { product_template_id: string; actual_qty: number }[]
    ): Promise<ShiftInventoryHandover[]> {
        const prevMap = new Map<string, number>();
        if (previousHandover) {
            for (const item of previousHandover) {
                if (item.product_template_id) {
                    prevMap.set(item.product_template_id, Number(item.actual_qty) || 0);
                }
            }
        }

        const inserts = templates.map(t => ({
            shift_id: shiftId,
            product_template_id: t.id,
            product_name: t.product_name,
            barcode: t.barcode,
            system_qty: prevMap.get(t.id) || 0,
            actual_qty: null as unknown as number,
            checked_by: userId,
            checked_at: new Date().toISOString(),
        }));

        if (inserts.length === 0) return [];

        const { data, error } = await supabase
            .from('shift_inventory_handover')
            .insert(inserts)
            .select();
        if (error) throw new Error(error.message);
        return data || [];
    },

    async getItems(shiftId: string): Promise<ShiftInventoryHandover[]> {
        const { data } = await supabase
            .from('shift_inventory_handover')
            .select('*')
            .eq('shift_id', shiftId)
            .order('created_at');
        return data || [];
    },

    async syncKiotVietHandover(storeId: string, shiftId: string): Promise<{ success: boolean; message?: string; synced?: number }> {
        if (!storeId || !shiftId) return { success: false, message: 'Thiếu thông tin' };
        try {
            const { data: store, error: storeErr } = await supabase
                .from('stores')
                .select('code, kiotviet_branch_name')
                .eq('id', storeId)
                .single();
            if (storeErr || !store || !store.code) return { success: false, message: 'Không tìm thấy cửa hàng' };

            const branchName = store.kiotviet_branch_name || store.code;
            const { data: fnData, error: fnErr } = await supabase.functions.invoke('kiotviet-stock', {
                body: { storeCode: store.code, branchName: branchName }
            });

            if (fnErr || !fnData?.stockMap) {
                return { success: false, message: fnData?.error || 'Không thể kết nối KiotViet' };
            }

            const stockMap: Record<string, number> = fnData.stockMap;
            const items = await this.getItems(shiftId);
            if (!items.length) return { success: false, message: 'Chưa có sản phẩm nào' };

            const updates: { id: string; system_qty: number }[] = [];
            for (const item of items) {
                if (item.barcode && stockMap[item.barcode] !== undefined) {
                    updates.push({ id: item.id, system_qty: stockMap[item.barcode] });
                }
            }

            if (updates.length > 0) {
                 const stockGroups = new Map<number, string[]>();
                for (const u of updates) {
                    const existing = stockGroups.get(u.system_qty) || [];
                    existing.push(u.id);
                    stockGroups.set(u.system_qty, existing);
                }

                const batchPromises = Array.from(stockGroups.entries()).map(([stock, itemIds]) =>
                    supabase
                        .from('shift_inventory_handover')
                        .update({ system_qty: stock })
                        .in('id', itemIds)
                );
                await Promise.all(batchPromises);
            }

            return { success: true, synced: updates.length, message: `Đã đồng bộ ${updates.length}/${items.length} sản phẩm` };
        } catch (e: any) {
            return { success: false, message: e.message || 'Lỗi hệ thống' };
        }
    },

    async updateItem(id: string, updates: Partial<ShiftInventoryHandover>): Promise<ShiftInventoryHandover> {
        const { difference, ...cleanUpdates } = updates as any;
        const { data, error } = await supabase
            .from('shift_inventory_handover')
            .update(cleanUpdates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw new Error(error.message);
        return data;
    },

    async deleteItem(id: string): Promise<void> {
        const { error } = await supabase
            .from('shift_inventory_handover')
            .delete()
            .eq('id', id);
        if (error) throw new Error(error.message);
    },

    async createProduct(product: Partial<HandoverProduct>): Promise<HandoverProduct> {
        const { data, error } = await supabase
            .from('shift_handover_products')
            .insert(product)
            .select()
            .single();
        if (error) throw new Error(error.message);
        return data;
    },

    async updateProduct(id: string, updates: Partial<HandoverProduct>): Promise<HandoverProduct> {
        const { data, error } = await supabase
            .from('shift_handover_products')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw new Error(error.message);
        return data;
    },

    async deleteProduct(id: string): Promise<void> {
        const { error } = await supabase
            .from('shift_handover_products')
            .delete()
            .eq('id', id);
        if (error) throw new Error(error.message);
    },
};
