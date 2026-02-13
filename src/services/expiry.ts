import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { ExpiryProduct } from '../types';

export type { ExpiryProduct };

export interface ExpiryConfig {
    id: string;
    type: string;
    nearExpiryDays: number;
    productionThreshold: number;
    enabled: boolean;
    stores: string[];
}

export interface ExpiryReport {
    id: string;
    store: string;
    date: string;
    scannedCount: number;
    nearExpiryCount: number;
    expiredCount: number;
    status: 'SUBMITTED' | 'REVIEWED';
}

const getDaysLeft = (expiryDate: string | null): number => {
    if (!expiryDate) return 999;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

const getStatus = (daysLeft: number, nearExpiryDays: number = 30): string => {
    if (daysLeft < 0) return 'Hết hạn';
    if (daysLeft <= nearExpiryDays) return 'Cận hạn';
    return 'Còn hạn';
};

export const ExpiryService = {
    getDaysLeft,
    getStatus,

    async getItems(
        store: string,
        type: string
    ): Promise<{ success: boolean; products: ExpiryProduct[] }> {
        if (!store) {
            return { success: false, products: [] };
        }

        if (isSupabaseConfigured()) {
            try {
                const { data, error } = await supabase
                    .from('expiry_items')
                    .select(`
            id,
            quantity,
            mfg_date,
            expiry_date,
            status,
            note,
            type,
            products (
              name,
              barcode
            ),
            stores!inner (
              code
            )
          `)
                    .eq('stores.code', store)
                    .eq('type', type);

                if (error) throw error;

                const products: ExpiryProduct[] = (data || []).map((item: any) => {
                    const daysLeft = getDaysLeft(item.expiry_date);
                    return {
                        id: item.id,
                        productName: item.products?.name || '',
                        barcode: item.products?.barcode || '',
                        quantity: item.quantity || 0,
                        mfgDate: item.mfg_date,
                        expiryDate: item.expiry_date,
                        status: getStatus(daysLeft),
                        note: item.note || '',
                        daysLeft: daysLeft
                    };
                });

                return { success: true, products };
            } catch (e) {
                console.error('[Expiry] Get items error:', e);
                return { success: false, products: [] };
            }
        }
        return { success: false, products: [] };
    },

    async getConfigs(): Promise<{ success: boolean; configs: ExpiryConfig[] }> {
        if (isSupabaseConfigured()) {
            try {
                const { data, error } = await supabase
                    .from('expiry_configs')
                    .select('*')
                    .order('type');

                if (error) throw error;

                const configs = (data || []).map((c: any) => ({
                    id: c.id,
                    type: c.type,
                    nearExpiryDays: c.near_expiry_days,
                    productionThreshold: c.production_threshold,
                    enabled: c.enabled,
                    stores: c.stores || []
                }));

                return { success: true, configs };
            } catch (e) {
                console.error('Get configs error', e);
            }
        }
        return { success: false, configs: [] };
    },

    async updateConfig(id: string, updates: Partial<ExpiryConfig>): Promise<{ success: boolean }> {
        if (isSupabaseConfigured()) {
            try {
                const dbUpdates: any = {};
                if (updates.enabled !== undefined) dbUpdates.enabled = updates.enabled;
                if (updates.nearExpiryDays !== undefined) dbUpdates.near_expiry_days = updates.nearExpiryDays;

                const { error } = await supabase
                    .from('expiry_configs')
                    .update(dbUpdates)
                    .eq('id', id);

                return { success: !error };
            } catch (e) {
                return { success: false };
            }
        }
        return { success: false };
    },

    async getReports(): Promise<{ success: boolean; reports: ExpiryReport[] }> {
        if (isSupabaseConfigured()) {
            try {
                const { data, error } = await supabase
                    .from('expiry_reports')
                    .select(`
                        id,
                        check_date,
                        scanned_count,
                        near_expiry_count,
                        expired_count,
                        status,
                        stores ( name )
                    `)
                    .order('check_date', { ascending: false });

                if (error) throw error;

                const reports = (data || []).map((r: any) => ({
                    id: r.id,
                    store: r.stores?.name || 'Unknown',
                    date: r.check_date,
                    scannedCount: r.scanned_count,
                    nearExpiryCount: r.near_expiry_count,
                    expiredCount: r.expired_count,
                    status: r.status
                }));

                return { success: true, reports };
            } catch (e) {
                console.error('Get reports error', e);
            }
        }
        return { success: false, reports: [] };
    },

    async submitReport(storeCode: string, items: ExpiryProduct[]): Promise<{ success: boolean; message: string }> {
        if (!isSupabaseConfigured()) return { success: false, message: 'Lỗi kết nối server' };

        try {
            // Get Store ID
            const { data: store, error: storeError } = await supabase
                .from('stores')
                .select('id')
                .eq('code', storeCode)
                .single();

            if (storeError || !store) throw new Error('Không tìm thấy cửa hàng');

            // Calculate aggregates based on current status
            const scannedCount = items.length;
            const nearExpiryCount = items.filter(i => i.status === 'NEAR_EXPIRY' || i.status === 'Cận hạn').length;
            const expiredCount = items.filter(i => i.status === 'EXPIRED' || i.status === 'Hết hạn').length;

            const { error: insertError } = await supabase
                .from('expiry_reports')
                .insert({
                    store_id: store.id,
                    check_date: new Date().toISOString().split('T')[0],  
                    scanned_count: scannedCount,
                    near_expiry_count: nearExpiryCount,
                    expired_count: expiredCount,
                    status: 'SUBMITTED'
                });

            if (insertError) throw insertError;

            return { success: true, message: 'Gửi báo cáo thành công' };
        } catch (e) {
            console.error('Submit report error:', e);
            return { success: false, message: 'Gửi báo cáo thất bại' };
        }
    }
};

export default ExpiryService;
