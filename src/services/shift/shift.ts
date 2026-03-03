// ===========================================================================
// SHIFT SERVICE — Core shift operations
// ===========================================================================

import { supabase } from '../../lib/supabase';
import type {
    Shift, ShiftType, ShiftStatus, ShiftDashboardStats,
} from '../../types/shift';

export const ShiftService = {
    async getTodayShift(storeId: string, shiftType: ShiftType): Promise<Shift | null> {
        const today = new Date().toISOString().split('T')[0];
        const { data } = await supabase
            .from('shifts')
            .select('*, started_by_user:users!shifts_started_by_fkey(id,name,email), store:stores(id,code,name)')
            .eq('store_id', storeId)
            .eq('shift_type', shiftType)
            .eq('shift_date', today)
            .maybeSingle();
        return data;
    },

    async startShift(storeId: string, shiftType: ShiftType, userId: string): Promise<Shift> {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
            .from('shifts')
            .insert({
                store_id: storeId,
                shift_type: shiftType,
                shift_date: today,
                started_by: userId,
                started_at: new Date().toISOString(),
                status: 'OPEN' as ShiftStatus,
            })
            .select('*, started_by_user:users!shifts_started_by_fkey(id,name,email), store:stores(id,code,name)')
            .single();
        if (error) throw new Error(error.message);
        return data;
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
            .select('*, started_by_user:users!shifts_started_by_fkey(id,name,email), store:stores(id,code,name)')
            .single();
        if (error) throw new Error(error.message);
        return data;
    },

    async getShiftById(shiftId: string): Promise<Shift | null> {
        const { data } = await supabase
            .from('shifts')
            .select('*, started_by_user:users!shifts_started_by_fkey(id,name,email), store:stores(id,code,name)')
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
            .select('*, started_by_user:users!shifts_started_by_fkey(id,name,email), store:stores(id,code,name)')
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
            .select('id, status, shift_type, shift_date');

        if (storeId) query = query.eq('store_id', storeId);
        if (startDate) query = query.gte('shift_date', startDate);
        if (endDate) query = query.lte('shift_date', endDate);

        const { data } = await query;
        const shifts = data || [];

        let total = 0, completed = 0, open = 0;
        const byType: Record<string, number> = {};

        for (const s of shifts) {
            total++;
            if (s.status === 'COMPLETED' || s.status === 'LOCKED') completed++;
            else open++;
            byType[s.shift_type] = (byType[s.shift_type] || 0) + 1;
        }

        return {
            total_shifts: total,
            total_revenue: 0,
            total_difference: 0,
            shifts_with_difference: 0,
            avg_checklist_completion: total > 0 ? (completed / total) * 100 : 0,
        };
    },
};
