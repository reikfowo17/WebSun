import { supabase, isSupabaseConfigured } from "../lib/supabase";

export interface ShiftConfig {
    id: number;
    name: string;
    time: string;
    icon: string;
    color: string;
}

export interface StoreConfig {
    id: string;
    code: string;
    name: string;
    is_active?: boolean;
}

export const SystemService = {
    async getShifts(): Promise<ShiftConfig[]> {
        if (!isSupabaseConfigured()) {
            return [];
        }
        try {
            const { data, error } = await supabase
                .from('system_settings')
                .select('value')
                .eq('key', 'inventory_shifts')
                .single();
            if (error) {
                if (error.code === 'PGRST116') {
                    // Not found, return default
                    return [];
                }
                throw error;
            }
            return data.value;
        } catch (error) {
            console.error('[System] Error fetching shifts:', error);
            return [];
        }
    },

    async saveShifts(shifts: ShiftConfig[]): Promise<{ success: boolean; message?: string }> {
        if (!isSupabaseConfigured()) return { success: false, message: 'DB Disconnected' };
        try {
            const { error } = await supabase
                .from('system_settings')
                .upsert({
                    key: 'inventory_shifts',
                    value: shifts
                }, { onConflict: 'key' });
            if (error) throw error;
            return { success: true };
        } catch (error: any) {
            console.error('[System] Error saving shifts:', error);
            return { success: false, message: error.message };
        }
    },

    async getStores(): Promise<StoreConfig[]> {
        if (!isSupabaseConfigured()) return [];
        try {
            const { data, error } = await supabase
                .from('stores')
                .select('id, code, name, is_active')
                .order('code');
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('[System] Error fetching stores:', error);
            return [];
        }
    },

    async saveStore(store: Partial<StoreConfig>): Promise<{ success: boolean; data?: any; message?: string }> {
        if (!isSupabaseConfigured()) return { success: false, message: 'DB Disconnected' };
        try {
            let res;
            if (store.id) {
                res = await supabase.from('stores').update({ code: store.code, name: store.name, is_active: store.is_active }).eq('id', store.id).select();
            } else {
                res = await supabase.from('stores').insert({ code: store.code, name: store.name, is_active: store.is_active ?? true }).select();
            }
            if (res.error) throw res.error;
            return { success: true, data: res.data?.[0] };
        } catch (error: any) {
            console.error('[System] Error saving store:', error);
            return { success: false, message: error.message };
        }
    },

    async deleteStore(id: string): Promise<{ success: boolean; message?: string }> {
        if (!isSupabaseConfigured()) return { success: false, message: 'DB Disconnected' };
        try {
            const { error } = await supabase.from('stores').delete().eq('id', id);
            if (error) throw error;
            return { success: true };
        } catch (error: any) {
            console.error('[System] Error deleting store:', error);
            return { success: false, message: error.message };
        }
    }
};
