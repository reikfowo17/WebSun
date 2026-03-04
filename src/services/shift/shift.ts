import { supabase } from '../../lib/supabase';
import type {
    Shift, ShiftType, ShiftStatus, ShiftDashboardStats,
} from '../../types/shift';

const SHIFT_ORDER: ShiftType[] = ['MORNING', 'AFTERNOON', 'EVENING'];

export const ShiftService = {
    async getTodayShift(storeId: string, shiftType: ShiftType): Promise<Shift | null> {
        const today = new Date().toISOString().split('T')[0];
        const { data } = await supabase
            .from('shifts')
            .select('*, started_by_user:users!shifts_started_by_fkey(id,name), store:stores(id,code,name)')
            .eq('store_id', storeId)
            .eq('shift_type', shiftType)
            .eq('shift_date', today)
            .maybeSingle();
        return data;
    },

    async findPreviousShift(storeId: string, shiftType: ShiftType, shiftDate: string): Promise<Shift | null> {
        const currentIdx = SHIFT_ORDER.indexOf(shiftType);

        if (currentIdx > 0) {
            for (let i = currentIdx - 1; i >= 0; i--) {
                const { data } = await supabase
                    .from('shifts')
                    .select('*')
                    .eq('store_id', storeId)
                    .eq('shift_date', shiftDate)
                    .eq('shift_type', SHIFT_ORDER[i])
                    .in('status', ['COMPLETED', 'LOCKED'])
                    .maybeSingle();
                if (data) return data;
            }
        }

        const yesterday = new Date(shiftDate);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        for (let i = SHIFT_ORDER.length - 1; i >= 0; i--) {
            const { data } = await supabase
                .from('shifts')
                .select('*')
                .eq('store_id', storeId)
                .eq('shift_date', yesterdayStr)
                .eq('shift_type', SHIFT_ORDER[i])
                .in('status', ['COMPLETED', 'LOCKED'])
                .maybeSingle();
            if (data) return data;
        }

        return null;
    },

    async startShift(storeId: string, shiftType: ShiftType, userId: string): Promise<Shift> {
        const today = new Date().toISOString().split('T')[0];

        const previousShift = await this.findPreviousShift(storeId, shiftType, today);

        const { data, error } = await supabase
            .from('shifts')
            .insert({
                store_id: storeId,
                shift_type: shiftType,
                shift_date: today,
                started_by: userId,
                started_at: new Date().toISOString(),
                status: 'OPEN' as ShiftStatus,
                previous_shift_id: previousShift?.id || null,
            })
            .select('*, started_by_user:users!shifts_started_by_fkey(id,name), store:stores(id,code,name)')
            .single();
        if (error) throw new Error(error.message);
        return data;
    },

    async getPreviousShiftCash(shiftId: string): Promise<{ total_counted: number } | null> {
        const { data: shift } = await supabase
            .from('shifts')
            .select('previous_shift_id')
            .eq('id', shiftId)
            .single();

        if (!shift?.previous_shift_id) return null;

        const { data: cash } = await supabase
            .from('cash_settlements')
            .select('total_counted, cash_end_actual')
            .eq('shift_id', shift.previous_shift_id)
            .maybeSingle();

        if (!cash) return null;
        return { total_counted: Number(cash.total_counted) || Number(cash.cash_end_actual) || 0 };
    },

    async getPreviousShiftAssets(shiftId: string): Promise<{ asset_id: string; ok_count: number; damaged_count: number }[]> {
        const { data: shift } = await supabase
            .from('shifts')
            .select('previous_shift_id')
            .eq('id', shiftId)
            .single();

        if (!shift?.previous_shift_id) return [];

        const { data } = await supabase
            .from('shift_asset_checks')
            .select('asset_id, ok_count, damaged_count')
            .eq('shift_id', shift.previous_shift_id);

        return data || [];
    },

    async getPreviousShiftHandover(shiftId: string): Promise<{ product_template_id: string; actual_qty: number }[]> {
        const { data: shift } = await supabase
            .from('shifts')
            .select('previous_shift_id')
            .eq('id', shiftId)
            .single();

        if (!shift?.previous_shift_id) return [];

        const { data } = await supabase
            .from('shift_inventory_handover')
            .select('product_template_id, actual_qty')
            .eq('shift_id', shift.previous_shift_id);

        return data || [];
    },

    async endShift(shiftId: string, userId: string): Promise<Shift> {
        const { data, error } = await supabase
            .from('shifts')
            .update({
                status: 'COMPLETED' as ShiftStatus,
                ended_by: userId,
                ended_at: new Date().toISOString(),
            })
            .eq('id', shiftId)
            .select('*, started_by_user:users!shifts_started_by_fkey(id,name), store:stores(id,code,name)')
            .single();
        if (error) throw new Error(error.message);
        return data;
    },

    async getShiftById(shiftId: string): Promise<Shift | null> {
        const { data } = await supabase
            .from('shifts')
            .select('*, started_by_user:users!shifts_started_by_fkey(id,name), store:stores(id,code,name)')
            .eq('id', shiftId)
            .maybeSingle();
        return data;
    },

    async listShifts(filters: {
        storeId?: string;
        startDate?: string;
        endDate?: string;
        shiftType?: ShiftType;
        status?: ShiftStatus;
        userId?: string;
        limit?: number;
    } = {}): Promise<Shift[]> {
        let query = supabase
            .from('shifts')
            .select('*, started_by_user:users!shifts_started_by_fkey(id,name), store:stores(id,code,name)')
            .order('shift_date', { ascending: false })
            .order('shift_type');

        if (filters.storeId) query = query.eq('store_id', filters.storeId);
        if (filters.startDate) query = query.gte('shift_date', filters.startDate);
        if (filters.endDate) query = query.lte('shift_date', filters.endDate);
        if (filters.shiftType) query = query.eq('shift_type', filters.shiftType);
        if (filters.status) query = query.eq('status', filters.status);
        if (filters.userId) query = query.eq('started_by', filters.userId);
        if (filters.limit) query = query.limit(filters.limit);

        const { data } = await query;
        return data || [];
    },

    async getDashboardStats(storeId?: string, startDate?: string, endDate?: string): Promise<ShiftDashboardStats> {
        let query = supabase
            .from('shifts')
            .select('id, status, shift_type, shift_date, cash:cash_settlements(total_counted, difference)');

        if (storeId) query = query.eq('store_id', storeId);
        if (startDate) query = query.gte('shift_date', startDate);
        if (endDate) query = query.lte('shift_date', endDate);

        const { data } = await query;
        const shifts = data || [];

        let total = 0, completed = 0;
        let totalRevenue = 0, totalDifference = 0, shiftsWithDiff = 0;

        for (const s of shifts) {
            total++;
            if (s.status === 'COMPLETED' || s.status === 'LOCKED') completed++;

            const cashArr = (s as any).cash;
            if (Array.isArray(cashArr) && cashArr.length > 0) {
                const c = cashArr[0];
                totalRevenue += Number(c.total_counted) || 0;
                const diff = Number(c.difference) || 0;
                totalDifference += Math.abs(diff);
                if (diff !== 0) shiftsWithDiff++;
            }
        }

        return {
            total_shifts: total,
            total_revenue: totalRevenue,
            total_difference: totalDifference,
            shifts_with_difference: shiftsWithDiff,
            avg_checklist_completion: total > 0 ? (completed / total) * 100 : 0,
        };
    },
};
