// ===========================================================================
// HANDOVER SERVICE (admin-configured product templates)
// ===========================================================================

import { supabase } from '../../lib/supabase';
import type { HandoverProduct, ShiftInventoryHandover } from '../../types/shift';

export const HandoverService = {
    /** Get admin-configured handover product templates */
    async getProductTemplates(storeId?: string): Promise<HandoverProduct[]> {
        let query = supabase
            .from('shift_handover_products')
            .select('*')
            .eq('is_active', true)
            .order('sort_order');

        if (storeId) {
            query = query.or(`store_id.eq.${storeId},store_id.is.null`);
        } else {
            query = query.is('store_id', null);
        }

        const { data } = await query;
        return data || [];
    },

    /** Initialize handover items from templates for a new shift */
    async initFromTemplates(shiftId: string, templates: HandoverProduct[], userId: string): Promise<ShiftInventoryHandover[]> {
        const inserts = templates.map(t => ({
            shift_id: shiftId,
            product_template_id: t.id,
            product_name: t.product_name,
            barcode: t.barcode,
            system_qty: 0,
            actual_qty: 0,
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

    /** Update qty for a handover item */
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

    // ─── Admin: CRUD handover product templates ───
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
