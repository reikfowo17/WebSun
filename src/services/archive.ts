import { supabase, isSupabaseConfigured } from '../lib/supabase';

// ── Types ──

export interface ArchivedInventoryItem {
    product_name: string;
    barcode: string;
    sp: string;
    system_stock: number;
    actual_stock: number | null;
    diff: number;
    status: 'PENDING' | 'MATCHED' | 'MISSING' | 'OVER';
    note: string;
    diff_reason?: string | null;
    checked_by?: string | null;
}

export interface ArchivedReportMetadata {
    id: string;
    store_code: string;
    store_name: string;
    shift: number;
    check_date: string;
    status: string;
    submitted_by: string | null;
    submitted_at: string | null;
    reviewed_by: string | null;
    reviewed_at: string | null;
    rejection_reason: string | null;
    created_at: string;
}

export interface ArchivedDayData {
    date: string;
    exported_at: string;
    total_items: number;
    total_stores: number;
    stores: Record<string, Record<string, ArchivedInventoryItem[]>>;
    reports?: ArchivedReportMetadata[];
    total_reports?: number;
}

export interface ArchiveLogEntry {
    id: string;
    archive_date: string;
    file_path: string;
    total_items: number;
    total_stores: number;
    file_size_bytes: number | null;
    archived_at: string;
    purged_at: string | null;
    status: 'ARCHIVED' | 'PURGED' | 'FAILED';
    error_message: string | null;
    metadata: any;
}

/** Daily summary record */
export interface DailySummary {
    id: string;
    summary_date: string;
    store_code: string;
    shift: number;
    total_items: number;
    matched_count: number;
    missing_count: number;
    over_count: number;
    pending_count: number;
    total_system_stock: number;
    total_actual_stock: number;
    total_diff: number;
}

/** Missing product found during recovery scan */
export interface MissingProduct {
    product_id?: string;
    product_name: string;
    barcode: string;
    sp: string;
    store_code: string;
    shift: number;
    system_stock: number;
    actual_stock: number | null;
    diff: number;
    diff_reason?: string | null;
    note: string;
    date: string;
    /** Last date the product had positive/matched stock */
    last_positive_date?: string;
    /** Number of consecutive days missing */
    consecutive_missing_days: number;
    /** Smart recovery tags */
    is_audited?: boolean;
    is_offset?: boolean;
    offset_with_barcode?: string;
    is_new_stock_error?: boolean;
}

/** Result of scanning one month for missing products */
export interface RecoveryScanResult {
    year: number;
    month: number;
    stores: Record<string, MissingProduct[]>;
    total_files_scanned: number;
    total_missing_products: number;
    scanned_dates: string[];
    errors: string[];
    overItems: any[];
}

// ── Service Class ──

class InventoryArchiveServiceClass {

    // ── Archive Log ──

    /** Get archive log entries for a date range */
    async getArchiveLog(from?: string, to?: string): Promise<ArchiveLogEntry[]> {
        if (!isSupabaseConfigured()) return [];

        try {
            let query = supabase
                .from('inventory_archive_log')
                .select('*')
                .order('archive_date', { ascending: false });

            if (from) query = query.gte('archive_date', from);
            if (to) query = query.lte('archive_date', to);

            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        } catch (e: unknown) {
            console.error('[Archive] Get log error:', e);
            return [];
        }
    }

    /** Get archive status for a specific date */
    async getArchiveStatus(date: string): Promise<ArchiveLogEntry | null> {
        if (!isSupabaseConfigured()) return null;

        try {
            const { data, error } = await supabase
                .from('inventory_archive_log')
                .select('*')
                .eq('archive_date', date)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            return data || null;
        } catch (e: unknown) {
            console.error('[Archive] Get status error:', e);
            return null;
        }
    }

    // ── Read Archive from Storage ──

    /** List all archived files for a given year/month */
    async listArchivedFiles(year: number, month: number): Promise<string[]> {
        if (!isSupabaseConfigured()) return [];

        try {
            const folder = `${year}/${String(month).padStart(2, '0')}`;
            const { data, error } = await supabase.storage
                .from('inventory-archive')
                .list(folder, { sortBy: { column: 'name', order: 'asc' } });

            if (error) throw error;
            return (data || [])
                .filter(f => f.name.endsWith('.json'))
                .map(f => `${folder}/${f.name}`);
        } catch (e: unknown) {
            console.error('[Archive] List files error:', e);
            return [];
        }
    }

    /** Download and parse a single archive file */
    async downloadArchiveFile(filePath: string): Promise<ArchivedDayData | null> {
        if (!isSupabaseConfigured()) return null;

        try {
            const { data, error } = await supabase.storage
                .from('inventory-archive')
                .download(filePath);

            if (error) throw error;
            if (!data) return null;

            const text = await data.text();
            return JSON.parse(text) as ArchivedDayData;
        } catch (e: unknown) {
            console.error('[Archive] Download file error:', e);
            return null;
        }
    }

    // ── Recovery Scan (reads from Storage, mirrors scanLSKTFilesForMonth) ──

    /**
     * Scan all archived files for a month to find products with negative diff.
     * This is the equivalent of SMRecoveryLib.js → scanLSKTFilesForMonth()
     *
     * Tracks lastPositiveDateMap to determine when each product was last "OK"
     */
    async scanForMissingProducts(
        year: number,
        month: number,
        onProgress?: (current: number, total: number, fileName: string) => void
    ): Promise<RecoveryScanResult> {
        const result: RecoveryScanResult = {
            year,
            month,
            stores: {},
            total_files_scanned: 0,
            total_missing_products: 0,
            scanned_dates: [],
            errors: [],
            overItems: [],
        };

        try {
            // Get all archived files for the month
            const files = await this.listArchivedFiles(year, month);

            if (files.length === 0) {
                // Also check archive log for any archived dates (may be in DB still)
                const monthStr = String(month).padStart(2, '0');
                const from = `${year}-${monthStr}-01`;
                const to = `${year}-${monthStr}-31`;
                const log = await this.getArchiveLog(from, to);

                if (log.length === 0) {
                    result.errors.push(`Không tìm thấy file lịch sử cho tháng ${month}/${year}`);
                    return result;
                }
            }

            // lastPositiveDateMap: tracks when each product (by barcode+store) was last positive
            const lastPositiveDateMap: Record<string, string> = {};
            // missingCountMap: tracks consecutive missing days
            const missingCountMap: Record<string, number> = {};

            // Scan each file in chronological order
            for (let i = 0; i < files.length; i++) {
                const filePath = files[i];
                const fileName = filePath.split('/').pop() || filePath;

                if (onProgress) {
                    onProgress(i + 1, files.length, fileName);
                }

                console.debug(`[Archive Scan] Processing: ${fileName}`);

                const dayData = await this.downloadArchiveFile(filePath);
                if (!dayData) {
                    result.errors.push(`Không đọc được file: ${fileName}`);
                    continue;
                }

                result.total_files_scanned++;
                result.scanned_dates.push(dayData.date);

                // Process each store
                for (const [storeCode, shifts] of Object.entries(dayData.stores)) {
                    if (!result.stores[storeCode]) {
                        result.stores[storeCode] = [];
                    }

                    // Process each shift
                    for (const [shiftKey, items] of Object.entries(shifts)) {
                        const shiftNum = parseInt(shiftKey.replace('shift_', ''));

                        for (const item of items) {
                            const key = `${storeCode}:${item.barcode || item.product_name}`;

                            if (item.diff > 0) {
                                // Keep over items for offsetting
                                result.overItems.push({
                                    ...item,
                                    store_code: storeCode,
                                    shift: shiftNum,
                                    date: dayData.date
                                });
                            }

                            if (item.diff < 0) {
                                // Product is missing
                                const isAudited = item.actual_stock !== null;

                                missingCountMap[key] = (missingCountMap[key] || 0) + 1;

                                // Only add to results if this is the last occurrence
                                // (we want the latest data for each product)
                                const existingIdx = result.stores[storeCode].findIndex(
                                    p => (p.barcode === item.barcode || p.product_name === item.product_name) && p.shift === shiftNum
                                );

                                const missingProduct: MissingProduct = {
                                    product_name: item.product_name,
                                    barcode: item.barcode,
                                    sp: item.sp,
                                    store_code: storeCode,
                                    shift: shiftNum,
                                    system_stock: item.system_stock,
                                    actual_stock: item.actual_stock,
                                    diff: item.diff,
                                    diff_reason: item.diff_reason,
                                    note: item.note,
                                    date: dayData.date,
                                    last_positive_date: lastPositiveDateMap[key],
                                    consecutive_missing_days: missingCountMap[key],
                                    is_audited: isAudited,
                                };

                                if (existingIdx >= 0) {
                                    // Update with latest data
                                    result.stores[storeCode][existingIdx] = missingProduct;
                                } else {
                                    result.stores[storeCode].push(missingProduct);
                                    result.total_missing_products++;
                                }
                            } else {
                                // Product is positive/matched — reset missing count
                                lastPositiveDateMap[key] = dayData.date;
                                missingCountMap[key] = 0;
                            }
                        }
                    }
                }
            }

            console.debug(`[Archive Scan] Complete: ${result.total_files_scanned} files, ${result.total_missing_products} missing products`);

        } catch (e: unknown) {
            console.error('[Archive] Scan error:', e);
            result.errors.push('Lỗi quét lịch sử: ' + (e instanceof Error ? e.message : String(e)));
        }

        return result;
    }

    async analyzeMissingItemsWithKiotViet(missingItems: MissingProduct[], overItems: any[]): Promise<{ success: boolean; data?: { analyzedMissing: MissingProduct[], matchedCount: number }; error?: string }> {
        if (!isSupabaseConfigured()) return { success: false, error: 'Chưa cấu hình Supabase' };
        try {
            const { data, error } = await supabase.functions.invoke('analyze-recovery', {
                body: { missingItems, overItems }
            });
            if (error) throw error;
            return data;
        } catch (e: unknown) {
            console.error('[Archive] Analyze KiotViet error:', e instanceof Error ? e.message : String(e));
            return { success: false, error: e instanceof Error ? e.message : String(e) };
        }
    }

    // ── Also scan today's DB data for items not yet archived ──

    /**
     * Get items from the live DB for recent dates (not yet archived)
     * This complements scanForMissingProducts for the "hot" data
     */
    async getRecentDbItems(
        daysBack: number = 7,
        storeCode?: string
    ): Promise<ArchivedDayData[]> {
        if (!isSupabaseConfigured()) return [];

        try {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - daysBack);
            const cutoffStr = cutoff.toISOString().split('T')[0];

            let query = supabase
                .from('inventory_items')
                .select(`
                    id, system_stock, actual_stock, diff, status, note, shift, diff_reason, created_at,
                    products (name, barcode, sp),
                    stores!inner (code)
                `)
                .gte('created_at', cutoffStr);

            if (storeCode) {
                query = query.eq('stores.code', storeCode);
            }

            const { data, error } = await query;
            if (error) throw error;
            if (!data || data.length === 0) return [];

            // Group by date
            const byDate: Record<string, Record<string, Record<string, ArchivedInventoryItem[]>>> = {};

            for (const item of data) {
                const dateStr = new Date(item.created_at).toISOString().split('T')[0];
                const store = (item as any).stores?.code || 'UNKNOWN';
                const shiftKey = `shift_${item.shift}`;

                if (!byDate[dateStr]) byDate[dateStr] = {};
                if (!byDate[dateStr][store]) byDate[dateStr][store] = {};
                if (!byDate[dateStr][store][shiftKey]) byDate[dateStr][store][shiftKey] = [];

                byDate[dateStr][store][shiftKey].push({
                    product_name: (item as any).products?.name || '',
                    barcode: (item as any).products?.barcode || '',
                    sp: (item as any).products?.sp || '',
                    system_stock: item.system_stock,
                    actual_stock: item.actual_stock,
                    diff: item.diff,
                    status: item.status as any,
                    note: item.note || '',
                    diff_reason: item.diff_reason,
                });
            }

            return Object.entries(byDate).map(([date, stores]) => ({
                date,
                exported_at: new Date().toISOString(),
                total_items: Object.values(stores).reduce(
                    (sum, shifts) => sum + Object.values(shifts).reduce(
                        (s, items) => s + items.length, 0
                    ), 0
                ),
                total_stores: Object.keys(stores).length,
                stores,
            }));
        } catch (e: unknown) {
            console.error('[Archive] Get recent DB items error:', e);
            return [];
        }
    }

    // ── Daily Summary ──

    /** Get daily summaries for a date range */
    async getDailySummaries(from: string, to: string, storeCode?: string): Promise<DailySummary[]> {
        if (!isSupabaseConfigured()) return [];

        try {
            let query = supabase
                .from('inventory_daily_summary')
                .select('*')
                .gte('summary_date', from)
                .lte('summary_date', to)
                .order('summary_date', { ascending: false });

            if (storeCode) {
                query = query.eq('store_code', storeCode);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        } catch (e: unknown) {
            console.error('[Archive] Get summaries error:', e);
            return [];
        }
    }

    // ── Manual Archive Trigger ──

    /** Trigger archive for a specific date (calls Edge Function) */
    async triggerArchive(
        date: string,
        skipPurge: boolean = true,
        options?: {
            reportDaysToKeep?: number;
            historyDaysToKeep?: number;
            daysToKeep?: number;
        }
    ): Promise<{ success: boolean; error?: string; data?: any }> {
        if (!isSupabaseConfigured()) {
            return { success: false, error: 'Database not configured' };
        }

        try {
            const { data, error } = await supabase.functions.invoke('archive-inventory', {
                body: {
                    date,
                    skipPurge,
                    daysToKeep: options?.daysToKeep || 7,
                    reportDaysToKeep: options?.reportDaysToKeep || 30,
                    historyDaysToKeep: options?.historyDaysToKeep || 30,
                }
            });

            if (error) throw error;
            return { success: true, data };
        } catch (e: unknown) {
            console.error('[Archive] Trigger error:', e);
            return { success: false, error: 'Không thể archive: ' + (e instanceof Error ? e.message : String(e)) };
        }
    }

    // ── Archive Stats ──

    /** Get overall archive statistics */
    async getArchiveStats(): Promise<{
        totalArchived: number;
        totalPurged: number;
        totalFailed: number;
        oldestArchive: string | null;
        newestArchive: string | null;
        totalFileSize: number;
    } | null> {
        if (!isSupabaseConfigured()) return null;

        try {
            const { data, error } = await supabase
                .from('inventory_archive_log')
                .select('archive_date, status, file_size_bytes');

            if (error) throw error;
            if (!data || data.length === 0) return null;

            const dates = data.map(d => d.archive_date).sort();

            return {
                totalArchived: data.filter(d => d.status === 'ARCHIVED').length,
                totalPurged: data.filter(d => d.status === 'PURGED').length,
                totalFailed: data.filter(d => d.status === 'FAILED').length,
                oldestArchive: dates[0] || null,
                newestArchive: dates[dates.length - 1] || null,
                totalFileSize: data.reduce((sum, d) => sum + (d.file_size_bytes || 0), 0),
            };
        } catch (e: unknown) {
            console.error('[Archive] Get stats error:', e);
            return null;
        }
    }
}

export const InventoryArchiveService = new InventoryArchiveServiceClass();
export default InventoryArchiveService;
