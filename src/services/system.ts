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
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.error('[System] Error saving shifts:', err);
            return { success: false, message: errorMsg };
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
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.error('[System] Error saving store:', err);
            return { success: false, message: errorMsg };
        }
    },

    async deleteStore(id: string): Promise<{ success: boolean; message?: string }> {
        if (!isSupabaseConfigured()) return { success: false, message: 'DB Disconnected' };
        try {
            const { error } = await supabase.from('stores').delete().eq('id', id);
            if (error) throw error;
            return { success: true };
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.error('[System] Error deleting store:', err);
            return { success: false, message: errorMsg };
        }
    },

    /* ──────────── EMPLOYEES ──────────── */

    async getEmployees(): Promise<EmployeeConfig[]> {
        if (!isSupabaseConfigured()) return [];
        try {
            const { data, error } = await supabase
                .from('users')
                .select('id, employee_id, username, name, role, store_id, created_at')
                .order('name');
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('[System] Error fetching employees:', error);
            return [];
        }
    },

    async getEmployeeStores(userId: string): Promise<UserStoreAssignment[]> {
        if (!isSupabaseConfigured()) return [];
        try {
            const { data, error } = await supabase
                .from('user_stores')
                .select('id, user_id, store_id, is_primary, created_at, stores:store_id(id, code, name)')
                .eq('user_id', userId);
            if (error) throw error;
            return (data || []).map((row: any) => ({
                id: row.id,
                user_id: row.user_id,
                store_id: row.store_id,
                is_primary: row.is_primary,
                created_at: row.created_at,
                store: row.stores ? { id: row.stores.id, code: row.stores.code, name: row.stores.name } : undefined,
            }));
        } catch (error) {
            console.error('[System] Error fetching employee stores:', error);
            return [];
        }
    },

    async addEmployeeStore(userId: string, storeId: string, isPrimary = false): Promise<{ success: boolean; message?: string }> {
        if (!isSupabaseConfigured()) return { success: false, message: 'DB Disconnected' };
        try {
            const { error } = await supabase
                .from('user_stores')
                .insert({ user_id: userId, store_id: storeId, is_primary: isPrimary });
            if (error) throw error;
            return { success: true };
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            if (errorMsg.includes('duplicate') || errorMsg.includes('unique')) {
                return { success: false, message: 'Nhân viên đã được gán vào chi nhánh này' };
            }
            console.error('[System] Error adding employee store:', err);
            return { success: false, message: errorMsg };
        }
    },

    async removeEmployeeStore(assignmentId: string): Promise<{ success: boolean; message?: string }> {
        if (!isSupabaseConfigured()) return { success: false, message: 'DB Disconnected' };
        try {
            const { error } = await supabase
                .from('user_stores')
                .delete()
                .eq('id', assignmentId);
            if (error) throw error;
            return { success: true };
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.error('[System] Error removing employee store:', err);
            return { success: false, message: errorMsg };
        }
    },

    async setEmployeePrimaryStore(userId: string, assignmentId: string): Promise<{ success: boolean; message?: string }> {
        if (!isSupabaseConfigured()) return { success: false, message: 'DB Disconnected' };
        try {
            await supabase.from('user_stores').update({ is_primary: false }).eq('user_id', userId);
            const { error } = await supabase.from('user_stores').update({ is_primary: true }).eq('id', assignmentId);
            if (error) throw error;
            return { success: true };
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.error('[System] Error setting primary store:', err);
            return { success: false, message: errorMsg };
        }
    },
};

export interface EmployeeConfig {
    id: string;
    employee_id: string;
    username: string;
    name: string;
    role: 'ADMIN' | 'EMPLOYEE';
    store_id?: string;
    created_at?: string;
}

export interface UserStoreAssignment {
    id: string;
    user_id: string;
    store_id: string;
    is_primary: boolean;
    created_at?: string;
    store?: { id: string; code: string; name: string };
}
