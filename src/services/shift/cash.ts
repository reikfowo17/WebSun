import { supabase } from '../../lib/supabase';
import type { CashSettlement } from '../../types/shift';
import { DENOMINATION_VALUES, CASH_REVENUE_FIELDS, CASH_PAYMENT_FIELDS } from '../../types/shift';

// ─── Helpers ───

export function computeDenomTotal(settlement: Partial<CashSettlement>): number {
    let total = 0;
    const s = settlement as Record<string, unknown>;
    for (const d of DENOMINATION_VALUES) {
        total += (Number(s[`denom_${d}`]) || 0) * d;
    }
    return total;
}

export function computeCashExpected(settlement: Partial<CashSettlement>): number {
    const s = settlement as Record<string, unknown>;
    let expected = 0;
    for (const field of CASH_REVENUE_FIELDS) {
        const val = Number(s[field.key]) || 0;
        expected += field.type === 'expense' ? -val : val;
    }
    for (const field of CASH_PAYMENT_FIELDS) {
        const val = Number(s[field.key]) || 0;
        expected -= val;
    }
    return expected;
}

const GENERATED_FIELDS = ['total_counted', 'cash_end_expected', 'difference'] as const;
const READONLY_FIELDS = ['id', 'created_at', 'updated_at'] as const;

function cleanForUpsert(settlement: Partial<CashSettlement>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const skipKeys = new Set<string>([...GENERATED_FIELDS, ...READONLY_FIELDS]);
    for (const [key, value] of Object.entries(settlement)) {
        if (!skipKeys.has(key)) {
            result[key] = value;
        }
    }
    return result;
}

// ─── Service ───

export const CashService = {
    async getByShift(shiftId: string): Promise<CashSettlement | null> {
        try {
            const { data, error } = await supabase
                .from('cash_settlements')
                .select('*')
                .eq('shift_id', shiftId)
                .maybeSingle();
            if (error) {
                console.error('[Cash] Get error:', error.message);
                return null;
            }
            return data;
        } catch (e: unknown) {
            console.error('[Cash] Get exception:', e instanceof Error ? e.message : String(e));
            return null;
        }
    },

    async upsert(shiftId: string, settlement: Partial<CashSettlement>): Promise<CashSettlement> {
        const cleanData = cleanForUpsert(settlement);

        const denomTotal = computeDenomTotal(settlement);

        const { data, error } = await supabase
            .from('cash_settlements')
            .upsert(
                {
                    ...cleanData,
                    shift_id: shiftId,
                    cash_end_actual: denomTotal,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'shift_id' }
            )
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    },

    async submit(shiftId: string): Promise<CashSettlement> {
        const current = await this.getByShift(shiftId);
        if (!current) throw new Error('Chưa có dữ liệu két cho ca này');

        const denomTotal = computeDenomTotal(current);

        const { data, error } = await supabase
            .from('cash_settlements')
            .update({
                status: 'SUBMITTED',
                cash_end_actual: denomTotal,
                submitted_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('shift_id', shiftId)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    },

    async approve(settlementId: string, adminId: string): Promise<CashSettlement> {
        const { data, error } = await supabase
            .from('cash_settlements')
            .update({
                status: 'APPROVED',
                approved_by: adminId,
                approved_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', settlementId)
            .select()
            .single();
        if (error) throw new Error(error.message);
        return data;
    },

    async reject(settlementId: string, adminId: string, reason: string): Promise<CashSettlement> {
        const { data, error } = await supabase
            .from('cash_settlements')
            .update({
                status: 'REJECTED',
                approved_by: adminId,
                approved_at: new Date().toISOString(),
                difference_reason: reason,
                updated_at: new Date().toISOString(),
            })
            .eq('id', settlementId)
            .select()
            .single();
        if (error) throw new Error(error.message);
        return data;
    },

    async listSettlements(filters: {
        storeId?: string;
        startDate?: string;
        endDate?: string;
        status?: string;
        limit?: number;
    } = {}): Promise<(CashSettlement & { shift?: { shift_type: string; shift_date: string; store?: { code: string; name: string }; started_by_user?: { name: string } } })[]> {
        let query = supabase
            .from('cash_settlements')
            .select(`
                *,
                shift:shifts!cash_settlements_shift_id_fkey(
                    id, shift_type, shift_date, status,
                    store:stores(id, code, name),
                    started_by_user:users!shifts_started_by_fkey(id, name)
                )
            `)
            .order('created_at', { ascending: false });

        if (filters.status) query = query.eq('status', filters.status);
        if (filters.limit) query = query.limit(filters.limit);

        const { data, error } = await query;
        if (error) {
            console.error('[Cash] List settlements error:', error.message);
            return [];
        }

        let results = data || [];
        if (filters.storeId) {
            results = results.filter((r: any) => r.shift?.store?.id === filters.storeId);
        }
        if (filters.startDate) {
            results = results.filter((r: any) => r.shift?.shift_date >= filters.startDate!);
        }
        if (filters.endDate) {
            results = results.filter((r: any) => r.shift?.shift_date <= filters.endDate!);
        }

        return results;
    },

    async getStats(storeId?: string, startDate?: string, endDate?: string): Promise<{
        totalSettlements: number;
        submitted: number;
        approved: number;
        rejected: number;
        draft: number;
        totalRevenue: number;
        totalDifference: number;
        settlementsWithDifference: number;
    }> {
        const all = await this.listSettlements({ storeId, startDate, endDate, limit: 500 });

        let submitted = 0, approved = 0, rejected = 0, draft = 0;
        let totalRevenue = 0, totalDifference = 0, settlementsWithDifference = 0;

        for (const s of all) {
            if (s.status === 'SUBMITTED') submitted++;
            else if (s.status === 'APPROVED') approved++;
            else if (s.status === 'REJECTED') rejected++;
            else draft++;

            totalRevenue += (s.total_counted || 0);
            totalDifference += Math.abs(s.difference || 0);
            if (s.difference && s.difference !== 0) settlementsWithDifference++;
        }

        return {
            totalSettlements: all.length,
            submitted,
            approved,
            rejected,
            draft,
            totalRevenue,
            totalDifference,
            settlementsWithDifference,
        };
    },
};
