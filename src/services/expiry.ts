/**
 * Expiry Service
 * 
 * Handles expiry date tracking and management
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { ExpiryProduct } from '../types';
export type { ExpiryProduct };

// ===========================================================================
// MOCK DATA
// ===========================================================================

const MOCK_EXPIRY: ExpiryProduct[] = [
    {
        id: '1',
        productName: 'Bánh mì sandwich',
        barcode: '8934588012348',
        quantity: 10,
        mfgDate: '2026-02-01',
        expiryDate: '2026-02-04',
        status: 'Cận hạn',
        note: '',
        daysLeft: 1
    },
    {
        id: '2',
        productName: 'Sữa tươi Vinamilk',
        barcode: '8934588012349',
        quantity: 24,
        mfgDate: '2026-01-28',
        expiryDate: '2026-02-10',
        status: 'Còn hạn',
        note: '',
        daysLeft: 7
    },
];

// ===========================================================================
// UTILITY FUNCTIONS
// ===========================================================================

/**
 * Calculate days remaining until expiry
 */
const getDaysLeft = (expiryDate: string | null): number => {
    if (!expiryDate) return 999;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

/**
 * Determine status based on days left
 */
const getStatus = (daysLeft: number): string => {
    if (daysLeft < 0) return 'Hết hạn';
    if (daysLeft <= 30) return 'Cận hạn';
    return 'Còn hạn';
};

// ===========================================================================
// EXPIRY SERVICE
// ===========================================================================

export const ExpiryService = {
    getDaysLeft,
    getStatus,

    /**
     * Get expiry items for a store and type
     */
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
                    .eq('type', type as any)
                    .order('expiry_date', { ascending: true }); // Sort by expiry date (Urgent first)

                if (error) throw error;

                const products: ExpiryProduct[] = (data || []).map((item: any) => {
                    const daysLeft = getDaysLeft(item.expiry_date);
                    return {
                        id: item.id,
                        productName: item.products?.name || '',
                        barcode: item.products?.barcode || '',
                        quantity: item.quantity,
                        mfgDate: item.mfg_date,
                        expiryDate: item.expiry_date,
                        status: getStatus(daysLeft), // Recalculate status dynamically
                        note: item.note || '',
                        daysLeft: daysLeft,
                    };
                });

                return { success: true, products };

            } catch (e) {
                console.error('[Expiry] Get items error:', e);
                return { success: false, products: [] };
            }
        }

        // Mock mode (Fallback)
        await new Promise(r => setTimeout(r, 500));
        // ... (Mock data logic)
        const products = MOCK_EXPIRY.map(p => ({
            ...p,
            daysLeft: getDaysLeft(p.expiryDate),
            status: getStatus(getDaysLeft(p.expiryDate))
        })).sort((a, b) => a.daysLeft - b.daysLeft);

        return { success: true, products };
    },

    /**
     * Update an expiry item
     */
    async updateItem(
        id: string,
        field: string,
        value: any
    ): Promise<{ success: boolean }> {
        if (!id || !field) {
            return { success: false };
        }

        if (isSupabaseConfigured()) {
            try {
                const updateData: Record<string, any> = {
                    updated_at: new Date().toISOString(),
                };

                // Map frontend field names to database columns
                const fieldMap: Record<string, string> = {
                    mfgDate: 'mfg_date',
                    expiryDate: 'expiry_date',
                };
                updateData[fieldMap[field] || field] = value;

                // Auto-calculate status for expiry date changes
                if (field === 'expiryDate' && value) {
                    const daysLeft = getDaysLeft(value);
                    updateData.status = getStatus(daysLeft);
                }

                const { error } = await supabase
                    .from('expiry_items')
                    .update(updateData)
                    .eq('id', id);

                if (error) throw error;
                return { success: true };
            } catch (e) {
                console.error('[Expiry] Update error:', e);
                return { success: false };
            }
        }

        // Mock mode
        await new Promise(r => setTimeout(r, 300));
        const item = MOCK_EXPIRY.find(p => p.id === id);
        if (item) {
            (item as any)[field] = value;
            if (field === 'expiryDate' && value) {
                const daysLeft = getDaysLeft(value);
                item.status = getStatus(daysLeft);
                item.daysLeft = daysLeft;
            }
        }
        return { success: true };
    },

    /**
     * Submit expiry report
     */
    async submitReport(
        items: ExpiryProduct[]
    ): Promise<{ success: boolean; message?: string }> {
        await new Promise(r => setTimeout(r, 500));

        if (!items || items.length === 0) {
            return { success: false, message: 'Danh sách sản phẩm trống' };
        }

        const expired = items.filter(p => (p.daysLeft ?? 999) < 0).length;
        const warning = items.filter(p => (p.daysLeft ?? 999) >= 0 && (p.daysLeft ?? 999) <= 30).length;

        // In a real app, you would send this to Supabase
        // await supabase.from('expiry_reports').insert(...)

        return {
            success: true,
            message: `Đã nộp báo cáo: ${items.length} sản phẩm (${expired} hết hạn, ${warning} cận hạn)`,
        };
    },
};

export default ExpiryService;
