import { supabase, isSupabaseConfigured } from "../../lib/supabase";

export interface DistributionStatus {
    distributed: boolean;
    totalItems: number;
    checkedItems: number;
    reportSubmitted: boolean;
    reportStatus: string | null;
    distributedAt: string | null;
    distributedBy: string | null;
}

interface DistributeResult {
    success: boolean;
    message?: string;
    itemCount?: number;
}

async function getStoreId(storeCode: string): Promise<string | null> {
    const { data } = await supabase
        .from('stores')
        .select('id, is_active')
        .eq('code', storeCode)
        .single();
    if (!data) return null;
    if (data.is_active === false) return null;
    return data.id;
}

async function getInventoryDate(shift?: number): Promise<string> {
    try {
        const { data } = await supabase.rpc('get_inventory_date', { p_shift: shift ?? null });
        if (data) return data;
    } catch (e) {
        console.error('[Inventory] getInventoryDate RPC error, fallback to local:', e);
    }
    // Fallback: local Vietnam-ish time (UTC+7)
    const vn = new Date(Date.now() + 7 * 3600 * 1000);
    const h = vn.getUTCHours();
    if (shift === 3 && h < 6) {
        vn.setUTCDate(vn.getUTCDate() - 1);
    }
    return vn.toISOString().split('T')[0];
}

async function getCurrentUserId(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id || null;
}

async function logDistribution(
    storeId: string, shift: number, checkDate: string,
    action: string, productCount: number, notes?: string
) {
    const userId = await getCurrentUserId();
    await supabase.from('inventory_distribution_log').insert({
        store_id: storeId,
        shift,
        check_date: checkDate,
        action,
        product_count: productCount,
        performed_by: userId,
        notes,
    });
}

export async function getDistributionStatus(
    storeCode: string, shift: number, date?: string
): Promise<DistributionStatus> {
    const empty: DistributionStatus = {
        distributed: false, totalItems: 0, checkedItems: 0,
        reportSubmitted: false, reportStatus: null,
        distributedAt: null, distributedBy: null,
    };

    if (!isSupabaseConfigured()) return empty;

    try {
        const storeId = await getStoreId(storeCode);
        if (!storeId) return empty;

        let checkDate = date;

        if (!checkDate) {
            // Try RPC date first, then fallback to actual DB data
            const rpcDate = await getInventoryDate(shift);

            // Check if items exist for RPC date
            const { data: rpcItems } = await supabase
                .from('inventory_items')
                .select('id', { count: 'exact', head: true })
                .eq('store_id', storeId)
                .eq('shift', shift)
                .eq('check_date', rpcDate);

            if (rpcItems && rpcItems.length > 0) {
                checkDate = rpcDate;
            } else {
                // RPC date has no items — find most recent actual date
                const { data: latestItem } = await supabase
                    .from('inventory_items')
                    .select('check_date')
                    .eq('store_id', storeId)
                    .eq('shift', shift)
                    .order('check_date', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (!latestItem) return empty;
                checkDate = latestItem.check_date;
            }
        }

        const { data: items, error } = await supabase
            .from('inventory_items')
            .select('id, actual_stock, distributed_at, distributed_by')
            .eq('store_id', storeId)
            .eq('shift', shift)
            .eq('check_date', checkDate);

        if (error || !items || items.length === 0) return empty;

        const { data: report } = await supabase
            .from('inventory_reports')
            .select('status')
            .eq('store_id', storeId)
            .eq('shift', shift)
            .eq('check_date', checkDate)
            .maybeSingle();

        return {
            distributed: true,
            totalItems: items.length,
            checkedItems: items.filter(i => i.actual_stock !== null).length,
            reportSubmitted: !!report,
            reportStatus: report?.status || null,
            distributedAt: items[0]?.distributed_at || null,
            distributedBy: items[0]?.distributed_by || null,
        };
    } catch (e) {
        console.error('[Inventory] Get distribution status error:', e);
        return empty;
    }
}

export async function distributeToStore(
    storeCode: string, shift: number
): Promise<DistributeResult> {
    if (!storeCode || !shift) return { success: false, message: 'Thiếu thông tin bắt buộc' };
    if (shift < 1 || shift > 3) return { success: false, message: 'Ca không hợp lệ (1-3)' };
    if (!isSupabaseConfigured()) return { success: false, message: 'Database disconnected' };

    try {
        const storeId = await getStoreId(storeCode);
        if (!storeId) return { success: false, message: 'Cửa hàng không tồn tại hoặc đã ngừng hoạt động' };

        const { data: products } = await supabase.from('products').select('id').eq('is_active', true);
        if (!products?.length) return { success: false, message: 'Không có sản phẩm trong danh mục' };

        const today = await getInventoryDate(shift);
        const userId = await getCurrentUserId();
        const { data: existing } = await supabase
            .from('inventory_items')
            .select('id, product_id')
            .eq('store_id', storeId)
            .eq('shift', shift)
            .eq('check_date', today);

        const existingProductIds = new Set((existing || []).map((e: any) => e.product_id));
        const newProducts = products.filter((p: any) => !existingProductIds.has(p.id));

        if (newProducts.length === 0 && existingProductIds.size > 0) {
            return {
                success: true,
                itemCount: 0,
                message: `Ca ${shift} đã được phân phối (${existingProductIds.size} SP). Không có sản phẩm mới để thêm.`,
            };
        }

        const itemsToInsert = newProducts.map((p: any) => ({
            store_id: storeId,
            product_id: p.id,
            shift,
            check_date: today,
            system_stock: 0,
            actual_stock: null,
            diff_reason: null,
            status: 'PENDING' as const,
            snapshot_at: null,
            distributed_by: userId,
            distributed_at: new Date().toISOString(),
        }));

        if (itemsToInsert.length > 0) {
            const { error } = await supabase
                .from('inventory_items')
                .insert(itemsToInsert);

            if (error) throw error;
        }

        await logDistribution(storeId, shift, today, 'DISTRIBUTE', newProducts.length);

        const skipped = existingProductIds.size;
        const msg = skipped > 0
            ? `Đã phân phối ${newProducts.length} SP mới cho ${storeCode} ca ${shift} (bỏ qua ${skipped} SP đã có)`
            : `Đã phân phối ${newProducts.length} sản phẩm cho ${storeCode} ca ${shift}`;

        return { success: true, itemCount: newProducts.length, message: msg };
    } catch (e: any) {
        console.error('[Inventory] Distribute error:', e);
        return { success: false, message: 'Lỗi: ' + e.message };
    }
}

export async function redistributeToStore(
    storeCode: string, shift: number, force = false
): Promise<DistributeResult> {
    if (!isSupabaseConfigured()) return { success: false, message: 'Database disconnected' };

    try {
        const status = await getDistributionStatus(storeCode, shift);

        if (status.reportStatus === 'APPROVED') {
            return { success: false, message: 'Báo cáo đã được DUYỆT — không thể phân phối lại. Hãy liên hệ quản lý.' };
        }

        if (status.checkedItems > 0 && !force) {
            return {
                success: false,
                message: `Có ${status.checkedItems}/${status.totalItems} sản phẩm đã được nhập liệu. Phân phối lại sẽ XÓA dữ liệu đã nhập. Bạn có chắc chắn?`,
            };
        }

        const resetResult = await resetDistribution(storeCode, shift, true);
        if (!resetResult.success) return resetResult;

        const distResult = await distributeToStore(storeCode, shift);

        if (distResult.success) {
            const storeId = await getStoreId(storeCode);
            if (storeId) {
                await logDistribution(storeId, shift, await getInventoryDate(shift), 'REDISTRIBUTE', distResult.itemCount || 0,
                    `Force=${force}, had ${status.checkedItems} checked items`);
            }
        }

        return {
            ...distResult,
            message: distResult.success
                ? `Đã phân phối lại ${distResult.itemCount} sản phẩm (đã xóa ${status.totalItems} mục cũ)`
                : distResult.message,
        };
    } catch (e: any) {
        console.error('[Inventory] Redistribute error:', e);
        return { success: false, message: 'Lỗi: ' + e.message };
    }
}

export async function resetDistribution(
    storeCode: string, shift: number, force = false
): Promise<DistributeResult> {
    if (!isSupabaseConfigured()) return { success: false, message: 'Database disconnected' };

    try {
        const storeId = await getStoreId(storeCode);
        if (!storeId) return { success: false, message: 'Cửa hàng không tồn tại' };

        // Find ACTUAL dates that have items for this store+shift
        const { data: existingItems } = await supabase
            .from('inventory_items')
            .select('check_date')
            .eq('store_id', storeId)
            .eq('shift', shift);

        const uniqueDates = [...new Set((existingItems || []).map((d: any) => d.check_date))];
        console.log(`[Reset] store=${storeCode} shift=${shift} foundDates=[${uniqueDates.join(',')}] itemCount=${existingItems?.length || 0}`);

        if (uniqueDates.length === 0) {
            return { success: true, itemCount: 0, message: 'Không có phân phối nào để xóa' };
        }

        if (!force) {
            // Check if any items have been checked
            const { count } = await supabase
                .from('inventory_items')
                .select('id', { count: 'exact', head: true })
                .eq('store_id', storeId)
                .eq('shift', shift)
                .in('check_date', uniqueDates)
                .not('actual_stock', 'is', null);

            if (count && count > 0) {
                return {
                    success: false,
                    message: `Có ${count} sản phẩm đã được nhập liệu. Phân phối lại sẽ XÓA dữ liệu đã nhập. Bạn có chắc chắn?`,
                };
            }
        }

        // Use SECURITY DEFINER RPC to bypass RLS
        const { data: rpcResult, error: rpcError } = await supabase.rpc('admin_reset_distribution', {
            p_store_id: storeId,
            p_shift: shift,
            p_check_dates: uniqueDates,
        });

        if (rpcError) {
            console.error('[Reset] RPC error, falling back to direct delete:', rpcError.message);

            // Fallback: direct delete (may fail due to RLS)
            for (const d of uniqueDates) {
                const { data: report } = await supabase
                    .from('inventory_reports')
                    .select('id, status')
                    .eq('store_id', storeId)
                    .eq('shift', shift)
                    .eq('check_date', d)
                    .maybeSingle();

                if (report?.status === 'APPROVED') {
                    return { success: false, message: `Báo cáo ngày ${d} đã DUYỆT — không thể reset` };
                }
                if (report) {
                    await supabase.from('inventory_reports').delete().eq('id', report.id);
                }
            }

            const { error, count: deletedCount } = await supabase
                .from('inventory_items')
                .delete({ count: 'exact' })
                .eq('store_id', storeId)
                .eq('shift', shift)
                .in('check_date', uniqueDates);

            if (error) throw error;
            console.log(`[Reset] Fallback deletedCount=${deletedCount}`);

            const latestDate = uniqueDates.sort().pop() || '';
            await logDistribution(storeId, shift, latestDate, 'RESET', deletedCount || 0, force ? 'Forced reset' : undefined);

            return {
                success: true,
                itemCount: deletedCount || 0,
                message: `Đã xóa ${deletedCount || 0} mục phân phối`,
            };
        }

        // RPC succeeded
        const result = rpcResult as any;
        console.log(`[Reset] RPC result:`, result);

        if (!result?.success) {
            return { success: false, message: result?.message || 'Lỗi khi reset' };
        }

        const deletedCount = result.deleted_items || 0;
        const latestDate = uniqueDates.sort().pop() || '';
        await logDistribution(storeId, shift, latestDate, 'RESET', deletedCount, force ? 'Forced reset' : undefined);

        return {
            success: true,
            itemCount: deletedCount,
            message: result.message || `Đã xóa ${deletedCount} mục phân phối`,
        };
    } catch (e: any) {
        console.error('[Inventory] Reset error:', e);
        return { success: false, message: 'Lỗi: ' + e.message };
    }
}

export async function addProductsToDistribution(
    storeCode: string, shift: number, productIds: string[]
): Promise<DistributeResult> {
    if (!isSupabaseConfigured()) return { success: false, message: 'Database disconnected' };
    if (!productIds.length) return { success: false, message: 'Không có sản phẩm để thêm' };

    try {
        const storeId = await getStoreId(storeCode);
        if (!storeId) return { success: false, message: 'Cửa hàng không tồn tại' };

        const today = await getInventoryDate(shift);
        const userId = await getCurrentUserId();

        const { data: existing } = await supabase
            .from('inventory_items')
            .select('product_id')
            .eq('store_id', storeId)
            .eq('shift', shift)
            .eq('check_date', today)
            .in('product_id', productIds);

        const existingIds = new Set((existing || []).map((e: any) => e.product_id));
        const newProductIds = productIds.filter(pid => !existingIds.has(pid));
        const skippedCount = existingIds.size;

        if (newProductIds.length === 0) {
            return {
                success: true,
                itemCount: 0,
                message: `Tất cả ${productIds.length} sản phẩm đã có trong ca ${shift}. Không có gì để thêm.`,
            };
        }

        const items = newProductIds.map(pid => ({
            store_id: storeId,
            product_id: pid,
            shift,
            check_date: today,
            system_stock: 0,
            actual_stock: null,
            status: 'PENDING' as const,
            distributed_by: userId,
            distributed_at: new Date().toISOString(),
        }));

        const { error } = await supabase
            .from('inventory_items')
            .insert(items);

        if (error) throw error;

        await logDistribution(storeId, shift, today, 'ADD_PRODUCTS', newProductIds.length);

        const msg = skippedCount > 0
            ? `Đã thêm ${newProductIds.length} SP mới (bỏ qua ${skippedCount} SP đã tồn tại)`
            : `Đã thêm ${newProductIds.length} sản phẩm`;

        return { success: true, itemCount: newProductIds.length, message: msg };
    } catch (e: any) {
        console.error('[Inventory] Add products error:', e);
        return { success: false, message: 'Lỗi: ' + e.message };
    }
}

export async function getStores(): Promise<{ success: boolean; stores: any[] }> {
    if (!isSupabaseConfigured()) return { success: false, stores: [] };
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

export async function updateStore(id: string, data: {
    name?: string;
    code?: string;
    address?: string;
}): Promise<{ success: boolean; error?: string }> {
    if (!id) return { success: false, error: 'ID cửa hàng không hợp lệ' };
    if (!isSupabaseConfigured()) return { success: false, error: 'Database disconnected' };

    try {
        const { error } = await supabase.from('stores').update(data).eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (e: any) {
        console.error('[Inventory] Update store error:', e);
        return { success: false, error: 'Không thể cập nhật: ' + e.message };
    }
}




