import { supabase } from '../../lib/supabase';

export interface StockCheckCategory {
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
    sort_order: number;
    created_at: string;
    updated_at: string;
    item_count?: number;
}

export interface StockCheckCategoryItem {
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

export interface StockCheckSession {
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

export interface StockCheckResult {
    id: string;
    session_id: string;
    product_id: string;
    system_qty: number | null;
    actual_qty: number | null;
    diff: number | null;
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

export async function getCategories(): Promise<{ success: boolean; data: StockCheckCategory[] }> {
    const { data, error } = await supabase
        .from('stock_check_categories')
        .select('*, stock_check_category_items(count)')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

    if (error) return { success: false, data: [] };

    const mapped = (data || []).map((c: any) => ({
        ...c,
        item_count: c.stock_check_category_items?.[0]?.count ?? 0,
    }));

    return { success: true, data: mapped };
}

export async function createCategory(payload: {
    name: string;
    description?: string;
    is_active?: boolean;
}): Promise<{ success: boolean; data?: StockCheckCategory; error?: string }> {
    const { data, error } = await supabase
        .from('stock_check_categories')
        .insert({ name: payload.name.trim(), description: payload.description || null, is_active: payload.is_active ?? true })
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
}>): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
        .from('stock_check_categories')
        .update(patch)
        .eq('id', id);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

export async function deleteCategory(id: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
        .from('stock_check_categories')
        .delete()
        .eq('id', id);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

export async function getCategoryItems(categoryId: string): Promise<{ success: boolean; data: StockCheckCategoryItem[] }> {
    const { data, error } = await supabase
        .from('stock_check_category_items')
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

export async function updateCategoryItems(categoryId: string, productIds: string[]): Promise<{ success: boolean; error?: string }> {
    const { error: delError } = await supabase
        .from('stock_check_category_items')
        .delete()
        .eq('category_id', categoryId);

    if (delError) return { success: false, error: delError.message };

    if (productIds.length > 0) {
        const payload = productIds.map((pid, idx) => ({
            category_id: categoryId,
            product_id: pid,
            sort_order: idx
        }));
        const { error: insError } = await supabase
            .from('stock_check_category_items')
            .insert(payload);

        if (insError) return { success: false, error: insError.message };
    }

    return { success: true };
}

export async function addItemToCategory(categoryId: string, productId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
        .from('stock_check_category_items')
        .insert({ category_id: categoryId, product_id: productId });

    if (error) {
        if (error.code === '23505') return { success: false, error: 'Sản phẩm đã có trong danh mục' };
        return { success: false, error: error.message };
    }
    return { success: true };
}

export async function removeItemFromCategory(itemId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
        .from('stock_check_category_items')
        .delete()
        .eq('id', itemId);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

export async function reorderCategoryItems(items: { id: string; sort_order: number }[]): Promise<{ success: boolean }> {
    const updates = items.map(({ id, sort_order }) =>
        supabase.from('stock_check_category_items').update({ sort_order }).eq('id', id)
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
} = {}): Promise<{ success: boolean; data: StockCheckSession[] }> {
    let q = supabase
        .from('stock_check_sessions')
        .select(`
            *,
            category:stock_check_categories(name),
            store:stores(name),
            stock_check_results(count)
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
        result_count: s.stock_check_results?.[0]?.count ?? 0,
    }));

    return { success: true, data: mapped };
}

export async function getSession(payload: {
    categoryId: string;
    storeId: string;
    checkDate: string;
    shift: number;
}): Promise<{ success: boolean; session?: StockCheckSession; error?: string }> {
    const { data: existing, error } = await supabase
        .from('stock_check_sessions')
        .select('*')
        .eq('category_id', payload.categoryId)
        .eq('store_id', payload.storeId)
        .eq('check_date', payload.checkDate)
        .eq('shift', payload.shift)
        .maybeSingle();

    if (error) return { success: false, error: error.message };
    return { success: true, session: existing as StockCheckSession | undefined };
}

export async function createSession(payload: {
    categoryId: string;
    storeId: string;
    checkDate: string;
    shift: number;
    userId?: string;
}): Promise<{ success: boolean; session?: StockCheckSession; error?: string }> {
    const { data: newSession, error } = await supabase
        .from('stock_check_sessions')
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
        .from('stock_check_category_items')
        .select('product_id')
        .eq('category_id', payload.categoryId);

    if (catItems && catItems.length > 0) {
        await supabase.from('stock_check_results').insert(
            catItems.map((ci: any) => ({
                session_id: newSession.id,
                product_id: ci.product_id,
            }))
        );
    }

    return { success: true, session: newSession as StockCheckSession };
}

export async function getSessionResults(sessionId: string): Promise<{ success: boolean; data: StockCheckResult[] }> {
    const { data, error } = await supabase
        .from('stock_check_results')
        .select('*, product:products(id, name, sp, barcode)')
        .eq('session_id', sessionId)
        .order('product(name)', { ascending: true });

    if (error) return { success: false, data: [] };
    return { success: true, data: data || [] };
}

export async function updateResult(resultId: string, patch: {
    actual_qty?: number | null;
    note?: string;
    checked_at?: string;
}): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
        .from('stock_check_results')
        .update({ ...patch, checked_at: patch.checked_at || new Date().toISOString() })
        .eq('id', resultId);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

export async function syncSystemQtyFromInventory(session: StockCheckSession): Promise<{ success: boolean; synced: number; error?: string }> {
    const { data: results } = await supabase
        .from('stock_check_results')
        .select('id, product_id')
        .eq('session_id', session.id);

    if (!results || results.length === 0) return { success: true, synced: 0 };

    const productIds = results.map((r: any) => r.product_id);

    const { data: invItems } = await supabase
        .from('inventory_items')
        .select('product_id, system_stock, check_date, shift')
        .eq('store_id', session.store_id)
        .eq('check_date', session.check_date)
        .eq('shift', session.shift)
        .in('product_id', productIds);

    const qtyMap: Record<string, number> = {};
    (invItems || []).forEach((item: any) => {
        qtyMap[item.product_id] = item.system_stock ?? 0;
    });

    let synced = 0;
    for (const result of results) {
        const qty = qtyMap[(result as any).product_id];
        if (qty !== undefined) {
            await supabase
                .from('stock_check_results')
                .update({ system_qty: qty })
                .eq('id', (result as any).id);
            synced++;
        }
    }

    await supabase
        .from('stock_check_sessions')
        .update({ synced_at: new Date().toISOString() })
        .eq('id', session.id);

    return { success: true, synced };
}

export async function completeSession(sessionId: string, userId?: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
        .from('stock_check_sessions')
        .update({ status: 'COMPLETED', completed_by: userId || null, completed_at: new Date().toISOString() })
        .eq('id', sessionId);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

export async function getDailySummary(filters: {
    dateFrom: string;
    dateTo: string;
    storeId?: string;
}): Promise<{ success: boolean; data: StockCheckSession[] }> {
    let q = supabase
        .from('stock_check_sessions')
        .select(`
            *,
            category:stock_check_categories(id, name),
            store:stores(id, name, code),
            stock_check_results(count)
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
            result_count: s.stock_check_results?.[0]?.count ?? 0,
        }))
    };
}

export const StockCheckService = {
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    getCategoryItems,
    addItemToCategory,
    removeItemFromCategory,
    reorderCategoryItems,
    getSessions,
    getSession,
    createSession,
    getSessionResults,
    updateResult,
    syncSystemQtyFromInventory,
    completeSession,
    getDailySummary,
    searchInventoryProducts,
    updateCategoryItems,
};

export default StockCheckService;
