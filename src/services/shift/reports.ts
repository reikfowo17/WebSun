// ===========================================================================
// QUICK REPORT SERVICE
// ===========================================================================

import { supabase } from '../../lib/supabase';
import type { ShiftQuickReport } from '../../types/shift';

export const QuickReportService = {
    async getReports(shiftId: string): Promise<ShiftQuickReport[]> {
        const { data } = await supabase
            .from('shift_quick_reports')
            .select('*')
            .eq('shift_id', shiftId)
            .order('created_at');
        return data || [];
    },

    async upsert(report: Partial<ShiftQuickReport>): Promise<ShiftQuickReport> {
        const { data, error } = await supabase
            .from('shift_quick_reports')
            .upsert(
                { ...report, updated_at: new Date().toISOString() },
                { onConflict: 'id' }
            )
            .select()
            .single();
        if (error) throw new Error(error.message);
        return data;
    },

    async deleteReport(id: string): Promise<void> {
        const { error } = await supabase
            .from('shift_quick_reports')
            .delete()
            .eq('id', id);
        if (error) throw new Error(error.message);
    },
};
