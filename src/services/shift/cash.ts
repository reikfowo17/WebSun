import { supabase } from '../../lib/supabase';
import type { CashSettlement } from '../../types/shift';

export const CashService = {
    async getByShift(shiftId: string): Promise<CashSettlement | null> {
        const { data } = await supabase
            .from('cash_settlements')
            .select('*')
            .eq('shift_id', shiftId)
            .maybeSingle();
        return data;
    },

    async upsert(shiftId: string, settlement: Partial<CashSettlement>): Promise<CashSettlement> {
        const { total_counted, cash_end_expected, difference, id, created_at, updated_at, ...cleanData } = settlement as any;

        const { data, error } = await supabase
            .from('cash_settlements')
            .upsert(
                { ...cleanData, shift_id: shiftId, updated_at: new Date().toISOString() },
                { onConflict: 'shift_id' }
            )
            .select()
            .single();
        if (error) throw new Error(error.message);
        return data;
    },

    async submit(shiftId: string): Promise<CashSettlement> {
        const { data, error } = await supabase
            .from('cash_settlements')
            .update({
                status: 'SUBMITTED',
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
};
