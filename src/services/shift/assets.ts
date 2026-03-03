// ===========================================================================
// ASSET SERVICE
// ===========================================================================

import { supabase } from '../../lib/supabase';
import type { ShiftAsset, ShiftAssetCheck } from '../../types/shift';

export const AssetService = {
    async getAssets(storeId?: string): Promise<ShiftAsset[]> {
        let query = supabase
            .from('shift_assets')
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

    async getChecks(shiftId: string): Promise<ShiftAssetCheck[]> {
        const { data } = await supabase
            .from('shift_asset_checks')
            .select('*, asset:shift_assets(*)')
            .eq('shift_id', shiftId);
        return data || [];
    },

    async upsertCheck(shiftId: string, assetId: string, okCount: number, damagedCount: number, userId: string, note?: string): Promise<ShiftAssetCheck> {
        const { data, error } = await supabase
            .from('shift_asset_checks')
            .upsert(
                {
                    shift_id: shiftId,
                    asset_id: assetId,
                    ok_count: okCount,
                    damaged_count: damagedCount,
                    checked_by: userId,
                    checked_at: new Date().toISOString(),
                    note: note || null,
                },
                { onConflict: 'shift_id,asset_id' }
            )
            .select('*, asset:shift_assets(*)')
            .single();
        if (error) throw new Error(error.message);
        return data;
    },

    async initChecks(shiftId: string, assets: ShiftAsset[], userId: string): Promise<ShiftAssetCheck[]> {
        const inserts = assets.map(a => ({
            shift_id: shiftId,
            asset_id: a.id,
            ok_count: a.expected_ok,
            damaged_count: 0,
            checked_by: userId,
        }));

        const { data, error } = await supabase
            .from('shift_asset_checks')
            .upsert(inserts, { onConflict: 'shift_id,asset_id' })
            .select('*, asset:shift_assets(*)');
        if (error) throw new Error(error.message);
        return data || [];
    },

    async createAsset(asset: Partial<ShiftAsset>): Promise<ShiftAsset> {
        const { data, error } = await supabase
            .from('shift_assets')
            .insert(asset)
            .select()
            .single();
        if (error) throw new Error(error.message);
        return data;
    },

    async updateAsset(id: string, updates: Partial<ShiftAsset>): Promise<ShiftAsset> {
        const { data, error } = await supabase
            .from('shift_assets')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw new Error(error.message);
        return data;
    },
};
