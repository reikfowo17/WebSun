import { supabase } from '../../lib/supabase';

export interface ExpiryCheckCategory {
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
    sort_order: number;
    near_expiry_days?: number;
    production_threshold?: number;
    stores?: string[] | null;
    created_at: string;
    updated_at: string;
    item_count?: number;
}

export interface ExpiryCheckCategoryItem {
    id: string;
    category_id: string;
    product_id: string;
    sort_order: number;
    product: {
        id: string;
        name: string;
        sp: string;
        barcode: string | null;
    } | null;
}

export interface ExpiryCheckSession {
    id: string;
    category_id: string;
    store_id: string;
    check_date: string;
    shift: number;
    status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    started_by: string | null;
    completed_by: string | null;
    started_at: string;
    completed_at: string | null;
    note: string | null;
    synced_at: string | null;
    category?: { name: string };
    store?: { name: string };
    result_count?: number;
    checked_count?: number;
}

export interface ExpiryCheckResult {
    id: string;
    session_id: string;
    product_id: string;
    mfg_date: string | null;
    expiry_date: string | null;
    qty: number | null;
    status: string | null;
    note: string | null;
    checked_at: string | null;
    product?: {
        id: string;
        name: string;
        sp: string;
        barcode: string | null;
    };
}

export interface DailySummaryRow {
    category_id: string;
    category_name: string;
    date: string;
    sessions: {
        shift: number;
        store_name: string;
        status: string;
        checked_count: number;
        total_count: number;
        session_id: string;
    }[];
}

export async function getCategories(): Promise<{ success: boolean; data: ExpiryCheckCategory[] }> {
    const { data, error } = await supabase
        .from('expiry_check_categories')
        .select('*, expiry_check_category_items(count)')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

    if (error) return { success: false, data: [] };

    const mapped = (data || []).map((c: any) => ({
        ...c,
        item_count: c.expiry_check_category_items?.[0]?.count ?? 0,
    }));

    return { success: true, data: mapped };
}

export async function createCategory(payload: {
    name: string;
    description?: string;
    is_active?: boolean;
    near_expiry_days?: number;
    production_threshold?: number;
    stores?: string[] | null;
}): Promise<{ success: boolean; data?: ExpiryCheckCategory; error?: string }> {
    const { data, error } = await supabase
        .from('expiry_check_categories')
        .insert({
            name: payload.name.trim(),
            description: payload.description || null,
            is_active: payload.is_active ?? true,
            near_expiry_days: payload.near_expiry_days ?? 30,
            production_threshold: payload.production_threshold ?? 0,
            stores: payload.stores ?? [],
        })
        .select()
        .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
}

export async function updateCategory(id: string, patch: Partial<{
    name: string;
    description: string;
    is_active: boolean;
    sort_order: number;
    near_expiry_days: number;
    production_threshold: number;
    stores: string[] | null;
}>): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
        .from('expiry_check_categories')
        .update(patch)
        .eq('id', id);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

export async function deleteCategory(id: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
        .from('expiry_check_categories')
        .delete()
        .eq('id', id);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

export async function getCategoryItems(categoryId: string): Promise<{ success: boolean; data: ExpiryCheckCategoryItem[] }> {
    const { data, error } = await supabase
        .from('expiry_check_category_items')
        .select('*, product:products(id, name, sp, barcode)')
        .eq('category_id', categoryId)
        .order('sort_order', { ascending: true });

    if (error) return { success: false, data: [] };
    return { success: true, data: data || [] };
}

export async function searchInventoryProducts(query: string): Promise<{ success: boolean; data: any[] }> {
    if (!query) return { success: true, data: [] };
    const { data, error } = await supabase
        .from('products')
        .select('id, name, sp, image_url')
        .or(`name.ilike.%${query}%,sp.ilike.%${query}%`)
        .limit(30);

    if (error) return { success: false, data: [] };

    const mapped = (data || []).map(p => ({
        id: p.id,
        fullName: p.name,
        code: p.sp,
        image_url: p.image_url,
    }));
    return { success: true, data: mapped };
}

export async function updateCategoryItems(categoryId: string, itemIds: string[]): Promise<{ success: boolean; error?: string }> {
    const { data: existing } = await supabase.from('expiry_check_category_items').select('product_id').eq('category_id', categoryId);
    const existingIds = new Set((existing || []).map(x => x.product_id));

    const newIdsStr = new Set(itemIds);
    const toAdd = itemIds.filter(id => !existingIds.has(id));
    const toRemove = [...existingIds].filter(id => !newIdsStr.has(id));

    if (toRemove.length > 0) {
        await supabase.from('expiry_check_category_items').delete().eq('category_id', categoryId).in('product_id', toRemove);
    }
    if (toAdd.length > 0) {
        const insertData = toAdd.map((pid, idx) => ({
            category_id: categoryId,
            product_id: pid,
            sort_order: idx
        }));
        await supabase.from('expiry_check_category_items').insert(insertData);
    }
    return { success: true };
}

export async function addProductsByBarcodes(categoryId: string, barcodes: string[]): Promise<{ success: boolean; error?: string; addedCount?: number; missingBarcodes?: string[] }> {
    if (!barcodes.length) return { success: true, addedCount: 0, missingBarcodes: [] };

    const { data: products, error } = await supabase
        .from('products')
        .select('id, barcode')
        .in('barcode', barcodes);

    if (error) return { success: false, error: error.message };

    const foundIds = (products || []).map(p => p.id);
    const foundBarcodes = new Set((products || []).map(p => p.barcode));
    const missingBarcodes = barcodes.filter(b => !foundBarcodes.has(b));

    const { data: existing } = await supabase.from('expiry_check_category_items').select('product_id').eq('category_id', categoryId);
    const existingIds = new Set((existing || []).map(x => x.product_id));

    const toAdd = foundIds.filter(id => !existingIds.has(id));
    if (toAdd.length > 0) {
        const insertData = toAdd.map((pid, idx) => ({
            category_id: categoryId,
            product_id: pid,
            sort_order: existingIds.size + idx
        }));
        await supabase.from('expiry_check_category_items').insert(insertData);
    }

    return { success: true, addedCount: toAdd.length, missingBarcodes };
}

export async function addItemToCategory(categoryId: string, productId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
        .from('expiry_check_category_items')
        .insert({ category_id: categoryId, product_id: productId });

    if (error) {
        if (error.code === '23505') return { success: false, error: 'Sản phẩm đã có trong danh mục' };
        return { success: false, error: error.message };
    }
    return { success: true };
}

export async function removeItemFromCategory(itemId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
        .from('expiry_check_category_items')
        .delete()
        .eq('id', itemId);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

export async function reorderCategoryItems(items: { id: string; sort_order: number }[]): Promise<{ success: boolean }> {
    const updates = items.map(({ id, sort_order }) =>
        supabase.from('expiry_check_category_items').update({ sort_order }).eq('id', id)
    );
    await Promise.all(updates);
    return { success: true };
}

export async function getSessions(filters: {
    storeId?: string;
    dateFrom?: string;
    dateTo?: string;
    categoryId?: string;
    status?: string;
} = {}): Promise<{ success: boolean; data: ExpiryCheckSession[] }> {
    let q = supabase
        .from('expiry_check_sessions')
        .select(`
            *,
            category:expiry_check_categories(name),
            store:stores(name),
            expiry_check_results(count)
        `)
        .order('check_date', { ascending: false })
        .order('started_at', { ascending: false });

    if (filters.storeId) q = q.eq('store_id', filters.storeId);
    if (filters.dateFrom) q = q.gte('check_date', filters.dateFrom);
    if (filters.dateTo) q = q.lte('check_date', filters.dateTo);
    if (filters.categoryId) q = q.eq('category_id', filters.categoryId);
    if (filters.status) q = q.eq('status', filters.status);

    const { data, error } = await q;
    if (error) return { success: false, data: [] };

    const mapped = (data || []).map((s: any) => ({
        ...s,
        result_count: s.expiry_check_results?.[0]?.count ?? 0,
    }));

    return { success: true, data: mapped };
}

export async function getSession(payload: {
    categoryId: string;
    storeId: string;
    checkDate: string;
    shift: number;
}): Promise<{ success: boolean; session?: ExpiryCheckSession; error?: string }> {
    const { data: existing, error } = await supabase
        .from('expiry_check_sessions')
        .select('*')
        .eq('category_id', payload.categoryId)
        .eq('store_id', payload.storeId)
        .eq('check_date', payload.checkDate)
        .eq('shift', payload.shift)
        .maybeSingle();

    if (error) return { success: false, error: error.message };
    return { success: true, session: existing as ExpiryCheckSession | undefined };
}

export async function createSession(payload: {
    categoryId: string;
    storeId: string;
    checkDate: string;
    shift: number;
    userId?: string;
}): Promise<{ success: boolean; session?: ExpiryCheckSession; error?: string }> {
    const { data: newSession, error } = await supabase
        .from('expiry_check_sessions')
        .insert({
            category_id: payload.categoryId,
            store_id: payload.storeId,
            check_date: payload.checkDate,
            shift: payload.shift,
            started_by: payload.userId || null,
        })
        .select()
        .single();

    if (error) return { success: false, error: error.message };

    const { data: catItems } = await supabase
        .from('expiry_check_category_items')
        .select('product_id')
        .eq('category_id', payload.categoryId);

    if (catItems && catItems.length > 0) {
        await supabase.from('expiry_check_results').insert(
            catItems.map((ci: any) => ({
                session_id: newSession.id,
                product_id: ci.product_id,
            }))
        );
    }

    return { success: true, session: newSession as ExpiryCheckSession };
}

export async function getSessionResults(sessionId: string): Promise<{ success: boolean; data: ExpiryCheckResult[] }> {
    const { data, error } = await supabase
        .from('expiry_check_results')
        .select('*, product:products(id, name, sp, barcode)')
        .eq('session_id', sessionId)
        .order('product(name)', { ascending: true });

    if (error) return { success: false, data: [] };
    return { success: true, data: data || [] };
}

export async function updateResult(resultId: string, patch: {
    mfg_date?: string | null;
    expiry_date?: string | null;
    qty?: number | null;
    status?: string;
    note?: string;
    checked_at?: string;
}): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
        .from('expiry_check_results')
        .update({ ...patch, checked_at: patch.checked_at || new Date().toISOString() })
        .eq('id', resultId);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

export async function completeSession(sessionId: string, userId?: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
        .from('expiry_check_sessions')
        .update({ status: 'COMPLETED', completed_by: userId || null, completed_at: new Date().toISOString() })
        .eq('id', sessionId);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

export async function getDailySummary(filters: {
    dateFrom: string;
    dateTo: string;
    storeId?: string;
}): Promise<{ success: boolean; data: ExpiryCheckSession[] }> {
    let q = supabase
        .from('expiry_check_sessions')
        .select(`
            *,
            category:expiry_check_categories(id, name),
            store:stores(id, name, code),
            expiry_check_results(count)
        `)
        .gte('check_date', filters.dateFrom)
        .lte('check_date', filters.dateTo)
        .order('check_date', { ascending: false })
        .order('category_id');

    if (filters.storeId) q = q.eq('store_id', filters.storeId);

    const { data, error } = await q;
    if (error) return { success: false, data: [] };

    return {
        success: true,
        data: (data || []).map((s: any) => ({
            ...s,
            result_count: s.expiry_check_results?.[0]?.count ?? 0,
        }))
    };
}

export const ExpiryCheckService = {
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    getCategoryItems,
    searchInventoryProducts,
    updateCategoryItems,
    addProductsByBarcodes,
    addItemToCategory,
    removeItemFromCategory,
    reorderCategoryItems,
    getSessions,
    getSession,
    createSession,
    getSessionResults,
    updateResult,
    completeSession,
    getDailySummary,
};

export default ExpiryCheckService;
