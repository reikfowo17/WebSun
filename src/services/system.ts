import { supabase, isSupabaseConfigured } from "../lib/supabase";

export interface ShiftConfig {
    id: number;
    name: string;
    time: string;
    icon: string;
    color: string;
    type?: 'MAIN' | 'SUPPORT';
    parent_id?: number;
    max_slots?: number;
    is_active?: boolean;
}

export interface StoreConfig {
    id: string;
    code: string;
    name: string;
    is_active?: boolean;
    sort_order?: number;
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
                .select('id, code, name, is_active, sort_order')
                .order('sort_order')
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
                res = await supabase.from('stores').update({ code: store.code, name: store.name, is_active: store.is_active, sort_order: store.sort_order }).eq('id', store.id).select();
            } else {
                res = await supabase.from('stores').insert({ code: store.code, name: store.name, is_active: store.is_active ?? true, sort_order: store.sort_order ?? 0 }).select();
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

    async reorderStores(stores: { id: string; sort_order: number }[]): Promise<{ success: boolean; message?: string }> {
        if (!isSupabaseConfigured()) return { success: false, message: 'DB Disconnected' };
        try {
            const updates = stores.map(s =>
                supabase.from('stores').update({ sort_order: s.sort_order }).eq('id', s.id)
            );
            const results = await Promise.all(updates);
            const failed = results.find(r => r.error);
            if (failed?.error) throw failed.error;
            return { success: true };
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.error('[System] Error reordering stores:', err);
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

    /* ──────────── EXPIRY CONFIGS ──────────── */

    async getExpiryConfigs(): Promise<ExpiryConfigItem[]> {
        if (!isSupabaseConfigured()) return [];
        try {
            const { data, error } = await supabase
                .from('expiry_configs')
                .select('*')
                .order('type');
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('[System] Error fetching expiry configs:', error);
            return [];
        }
    },

    async saveExpiryConfig(config: Partial<ExpiryConfigItem>): Promise<{ success: boolean; data?: ExpiryConfigItem; message?: string }> {
        if (!isSupabaseConfigured()) return { success: false, message: 'DB Disconnected' };
        try {
            let res;
            if (config.id) {
                res = await supabase.from('expiry_configs').update({
                    type: config.type, near_expiry_days: config.near_expiry_days,
                    production_threshold: config.production_threshold, enabled: config.enabled,
                    stores: config.stores, updated_at: new Date().toISOString(),
                }).eq('id', config.id).select();
            } else {
                res = await supabase.from('expiry_configs').insert({
                    type: config.type, near_expiry_days: config.near_expiry_days ?? 0,
                    production_threshold: config.production_threshold ?? 0,
                    enabled: config.enabled ?? true, stores: config.stores ?? [],
                }).select();
            }
            if (res.error) throw res.error;
            return { success: true, data: res.data?.[0] };
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            return { success: false, message: errorMsg };
        }
    },

    async deleteExpiryConfig(id: string): Promise<{ success: boolean; message?: string }> {
        if (!isSupabaseConfigured()) return { success: false, message: 'DB Disconnected' };
        try {
            const { error } = await supabase.from('expiry_configs').delete().eq('id', id);
            if (error) throw error;
            return { success: true };
        } catch (err: unknown) {
            return { success: false, message: err instanceof Error ? err.message : String(err) };
        }
    },

    /* ──────────── PRODUCTS ──────────── */

    async getProducts(): Promise<ProductConfig[]> {
        if (!isSupabaseConfigured()) return [];
        try {
            const { data, error } = await supabase
                .from('products')
                .select('id, barcode, name, sp, category, unit, unit_price, is_active, created_at')
                .order('name');
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('[System] Error fetching products:', error);
            return [];
        }
    },

    async saveProduct(product: Partial<ProductConfig>): Promise<{ success: boolean; data?: ProductConfig; message?: string }> {
        if (!isSupabaseConfigured()) return { success: false, message: 'DB Disconnected' };
        try {
            let res;
            if (product.id) {
                res = await supabase.from('products').update({
                    barcode: product.barcode, name: product.name, sp: product.sp,
                    category: product.category, unit: product.unit, unit_price: product.unit_price,
                    is_active: product.is_active, updated_at: new Date().toISOString(),
                }).eq('id', product.id).select();
            } else {
                res = await supabase.from('products').insert({
                    barcode: product.barcode, name: product.name, sp: product.sp,
                    category: product.category, unit: product.unit ?? 'cái',
                    unit_price: product.unit_price ?? 0, is_active: product.is_active ?? true,
                }).select();
            }
            if (res.error) throw res.error;
            return { success: true, data: res.data?.[0] };
        } catch (err: unknown) {
            return { success: false, message: err instanceof Error ? err.message : String(err) };
        }
    },

    async toggleProductActive(id: string, isActive: boolean): Promise<{ success: boolean; message?: string }> {
        if (!isSupabaseConfigured()) return { success: false, message: 'DB Disconnected' };
        try {
            const { error } = await supabase.from('products').update({ is_active: isActive, updated_at: new Date().toISOString() }).eq('id', id);
            if (error) throw error;
            return { success: true };
        } catch (err: unknown) {
            return { success: false, message: err instanceof Error ? err.message : String(err) };
        }
    },

    async deleteProduct(id: string): Promise<{ success: boolean; message?: string }> {
        if (!isSupabaseConfigured()) return { success: false, message: 'DB Disconnected' };
        try {
            const { error } = await supabase.from('products').delete().eq('id', id);
            if (error) throw error;
            return { success: true };
        } catch (err: unknown) {
            return { success: false, message: err instanceof Error ? err.message : String(err) };
        }
    },

    /* ──────────── SYSTEM SETTINGS (generic key-value) ──────────── */

    async getSetting<T = any>(key: string): Promise<T | null> {
        if (!isSupabaseConfigured()) return null;
        try {
            const { data, error } = await supabase
                .from('system_settings').select('value').eq('key', key).single();
            if (error) { if (error.code === 'PGRST116') return null; throw error; }
            return data.value as T;
        } catch (error) {
            console.error(`[System] Error fetching setting ${key}:`, error);
            return null;
        }
    },

    async saveSetting(key: string, value: any): Promise<{ success: boolean; message?: string }> {
        if (!isSupabaseConfigured()) return { success: false, message: 'DB Disconnected' };
        try {
            const { error } = await supabase
                .from('system_settings')
                .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
            if (error) throw error;
            return { success: true };
        } catch (err: unknown) {
            return { success: false, message: err instanceof Error ? err.message : String(err) };
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

export interface ExpiryConfigItem {
    id: string;
    type: string;
    near_expiry_days: number;
    production_threshold: number;
    enabled: boolean;
    stores: string[];
    created_at?: string;
    updated_at?: string;
}

export interface ProductConfig {
    id: string;
    barcode: string;
    name: string;
    sp?: string;
    category?: string;
    unit?: string;
    unit_price?: number;
    is_active?: boolean;
    created_at?: string;
}

export interface NotificationSettings {
    retention_days: number;
    auto_cleanup: boolean;
}

export interface GeneralSettings {
    system_name: string;
    timezone: string;
}
