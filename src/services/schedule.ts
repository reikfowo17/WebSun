import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface ScheduleRegistration {
    id: string;
    user_id: string;
    store_id: string;
    work_date: string;
    shift: number;
    note?: string;
    created_at?: string;
    user_name?: string;
    store_code?: string;
    store_name?: string;
}

export interface ScheduleAssignment {
    id: string;
    user_id: string;
    store_id: string;
    work_date: string;
    shift: number;
    assigned_by?: string;
    note?: string;
    created_at?: string;
    updated_at?: string;
    user_name?: string;
    employee_id?: string;
    avatar_url?: string;
    store_code?: string;
    store_name?: string;
}

export interface WeekScheduleData {
    registrations: ScheduleRegistration[];
    assignments: ScheduleAssignment[];
}

type ServiceResult<T = void> = {
    success: boolean;
    message?: string;
    data?: T;
};

function getWeekRange(baseDate: Date): { start: string; end: string } {
    const d = new Date(baseDate);
    const day = d.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    const mon = new Date(d);
    mon.setDate(d.getDate() + diffToMon);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return {
        start: mon.toISOString().split('T')[0],
        end: sun.toISOString().split('T')[0],
    };
}

export function getWeekDates(baseDate: Date): string[] {
    const { start } = getWeekRange(baseDate);
    const dates: string[] = [];
    const d = new Date(start + 'T00:00:00');
    for (let i = 0; i < 7; i++) {
        dates.push(d.toISOString().split('T')[0]);
        d.setDate(d.getDate() + 1);
    }
    return dates;
}

async function getCurrentUserId(): Promise<string> {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw new Error('Not authenticated');
    return data.user.id;
}

export const ScheduleService = {
    async registerAvailability(
        storeId: string,
        workDate: string,
        shift: number,
        note?: string
    ): Promise<ServiceResult> {
        if (!isSupabaseConfigured()) return { success: false, message: 'DB Disconnected' };
        try {
            const userId = await getCurrentUserId();
            const { error } = await supabase
                .from('schedule_registrations')
                .insert({ user_id: userId, store_id: storeId, work_date: workDate, shift, note });
            if (error) {
                if (error.code === '23505') return { success: false, message: 'Bạn đã đăng ký ca này rồi' };
                throw error;
            }
            return { success: true, message: 'Đã đăng ký thành công' };
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('[Schedule] registerAvailability error:', err);
            return { success: false, message: msg };
        }
    },

    async cancelRegistration(regId: string): Promise<ServiceResult> {
        if (!isSupabaseConfigured()) return { success: false, message: 'DB Disconnected' };
        try {
            const { error } = await supabase
                .from('schedule_registrations')
                .delete()
                .eq('id', regId);
            if (error) throw error;
            return { success: true, message: 'Đã hủy đăng ký' };
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('[Schedule] cancelRegistration error:', err);
            return { success: false, message: msg };
        }
    },

    async batchRegister(
        storeId: string,
        slots: { work_date: string; shift: number }[]
    ): Promise<ServiceResult<{ added: number; skipped: number }>> {
        if (!isSupabaseConfigured()) return { success: false, message: 'DB Disconnected' };
        try {
            const userId = await getCurrentUserId();
            const rows = slots.map(s => ({
                user_id: userId,
                store_id: storeId,
                work_date: s.work_date,
                shift: s.shift,
            }));
            const { data, error } = await supabase
                .from('schedule_registrations')
                .upsert(rows, { onConflict: 'user_id,store_id,work_date,shift', ignoreDuplicates: true })
                .select('id');
            if (error) throw error;
            const added = data?.length || 0;
            return { success: true, data: { added, skipped: slots.length - added }, message: `Đã đăng ký ${added} ca` };
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('[Schedule] batchRegister error:', err);
            return { success: false, message: msg };
        }
    },

    async getMyRegistrations(weekDate: Date, storeId?: string): Promise<ScheduleRegistration[]> {
        if (!isSupabaseConfigured()) return [];
        try {
            const userId = await getCurrentUserId();
            const { start, end } = getWeekRange(weekDate);
            let query = supabase
                .from('schedule_registrations')
                .select('*, stores:store_id(code, name)')
                .eq('user_id', userId)
                .gte('work_date', start)
                .lte('work_date', end);
            if (storeId) query = query.eq('store_id', storeId);
            const { data, error } = await query;
            if (error) throw error;
            return (data || []).map((r: any) => ({
                ...r,
                store_code: r.stores?.code,
                store_name: r.stores?.name,
            }));
        } catch (err) {
            console.error('[Schedule] getMyRegistrations error:', err);
            return [];
        }
    },

    async assignShift(
        userId: string,
        storeId: string,
        workDate: string,
        shift: number,
        note?: string
    ): Promise<ServiceResult> {
        if (!isSupabaseConfigured()) return { success: false, message: 'DB Disconnected' };
        try {
            const adminId = await getCurrentUserId();
            const { error } = await supabase
                .from('schedule_assignments')
                .upsert({
                    user_id: userId,
                    store_id: storeId,
                    work_date: workDate,
                    shift,
                    assigned_by: adminId,
                    note,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'user_id,store_id,work_date,shift' });
            if (error) throw error;
            return { success: true, message: 'Đã xếp lịch' };
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('[Schedule] assignShift error:', err);
            return { success: false, message: msg };
        }
    },

    async removeAssignment(assignmentId: string): Promise<ServiceResult> {
        if (!isSupabaseConfigured()) return { success: false, message: 'DB Disconnected' };
        try {
            const { error } = await supabase
                .from('schedule_assignments')
                .delete()
                .eq('id', assignmentId);
            if (error) throw error;
            return { success: true, message: 'Đã xóa lịch' };
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('[Schedule] removeAssignment error:', err);
            return { success: false, message: msg };
        }
    },

    async copyPreviousWeekRegistrations(weekDate: Date, storeId: string): Promise<ServiceResult> {
        if (!isSupabaseConfigured()) return { success: false, message: 'DB Disconnected' };
        try {
            const userId = await getCurrentUserId();
            const { start: currStart, end: currEnd } = getWeekRange(weekDate);

            const prevWeek = new Date(weekDate);
            prevWeek.setDate(prevWeek.getDate() - 7);
            const { start: prevStart, end: prevEnd } = getWeekRange(prevWeek);

            const { data: prevRegs, error: fetchErr } = await supabase
                .from('schedule_registrations')
                .select('*')
                .eq('user_id', userId)
                .eq('store_id', storeId)
                .gte('work_date', prevStart)
                .lte('work_date', prevEnd);

            if (fetchErr) throw fetchErr;
            if (!prevRegs || prevRegs.length === 0) return { success: false, message: 'Không có đăng ký tuần trước để sao chép' };

            const currentWeekDates = getWeekDates(weekDate);
            const prevWeekDates = getWeekDates(prevWeek);

            const toInsert = prevRegs.map(r => {
                const dayIndex = prevWeekDates.indexOf(r.work_date);
                return {
                    user_id: userId,
                    store_id: storeId,
                    shift: r.shift,
                    work_date: currentWeekDates[dayIndex],
                    note: r.note
                };
            });

            const { error: insertErr } = await supabase
                .from('schedule_registrations')
                .upsert(toInsert, { onConflict: 'user_id,store_id,work_date,shift', ignoreDuplicates: true });

            if (insertErr) throw insertErr;
            return { success: true, message: `Đã sao chép ${toInsert.length} đăng ký từ tuần trước` };
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('[Schedule] copyPreviousWeekRegistrations error:', err);
            return { success: false, message: msg };
        }
    },

    async copyPreviousWeekAssignments(weekDate: Date, storeId: string): Promise<ServiceResult> {
        if (!isSupabaseConfigured()) return { success: false, message: 'DB Disconnected' };
        try {
            const adminId = await getCurrentUserId();
            const prevWeek = new Date(weekDate);
            prevWeek.setDate(prevWeek.getDate() - 7);
            const { start: prevStart, end: prevEnd } = getWeekRange(prevWeek);

            const { data: prevAsgns, error: fetchErr } = await supabase
                .from('schedule_assignments')
                .select('*')
                .eq('store_id', storeId)
                .gte('work_date', prevStart)
                .lte('work_date', prevEnd);

            if (fetchErr) throw fetchErr;
            if (!prevAsgns || prevAsgns.length === 0) return { success: false, message: 'Không có lịch tuần trước để sao chép' };

            const currentWeekDates = getWeekDates(weekDate);
            const prevWeekDates = getWeekDates(prevWeek);

            const toInsert = prevAsgns.map(a => {
                const dayIndex = prevWeekDates.indexOf(a.work_date);
                return {
                    user_id: a.user_id,
                    store_id: storeId,
                    shift: a.shift,
                    work_date: currentWeekDates[dayIndex],
                    assigned_by: adminId,
                    updated_at: new Date().toISOString()
                };
            });

            const { error: insertErr } = await supabase
                .from('schedule_assignments')
                .upsert(toInsert, { onConflict: 'user_id,store_id,work_date,shift', ignoreDuplicates: true });

            if (insertErr) throw insertErr;
            return { success: true, message: `Đã sao chép ${toInsert.length} ca làm từ tuần trước` };
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('[Schedule] copyPreviousWeekAssignments error:', err);
            return { success: false, message: msg };
        }
    },

    async autoAssignShifts(weekDate: Date, storeId: string): Promise<ServiceResult> {
        if (!isSupabaseConfigured()) return { success: false, message: 'DB Disconnected' };
        try {
            const adminId = await getCurrentUserId();
            const { start, end } = getWeekRange(weekDate);

            // Fetch existing assignments to avoid duplicates
            const { data: existingAsgns, error: asgnErr } = await supabase
                .from('schedule_assignments')
                .select('user_id, work_date, shift')
                .eq('store_id', storeId)
                .gte('work_date', start)
                .lte('work_date', end);

            if (asgnErr) throw asgnErr;
            const assignedSet = new Set((existingAsgns || []).map(a => `${a.user_id}-${a.work_date}-${a.shift}`));

            // Fetch all registrations
            const { data: regs, error: regErr } = await supabase
                .from('schedule_registrations')
                .select('*')
                .eq('store_id', storeId)
                .gte('work_date', start)
                .lte('work_date', end);

            if (regErr) throw regErr;
            if (!regs || regs.length === 0) return { success: false, message: 'Không có đăng ký nào để xếp tự động' };

            const toInsert = regs
                .filter(r => !assignedSet.has(`${r.user_id}-${r.work_date}-${r.shift}`))
                .map(r => ({
                    user_id: r.user_id,
                    store_id: storeId,
                    shift: r.shift,
                    work_date: r.work_date,
                    assigned_by: adminId,
                    updated_at: new Date().toISOString()
                }));

            if (toInsert.length === 0) return { success: true, message: 'Tất cả các ca đăng ký đã được xếp rồi' };

            const { error: insertErr } = await supabase
                .from('schedule_assignments')
                .upsert(toInsert, { onConflict: 'user_id,store_id,work_date,shift', ignoreDuplicates: true });

            if (insertErr) throw insertErr;
            return { success: true, message: `Đã tự động duyệt ${toInsert.length} đăng ký vào lịch` };
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('[Schedule] autoAssignShifts error:', err);
            return { success: false, message: msg };
        }
    },

    async getWeekSchedule(weekDate: Date, storeId?: string): Promise<WeekScheduleData> {
        if (!isSupabaseConfigured()) return { registrations: [], assignments: [] };
        try {
            const { start, end } = getWeekRange(weekDate);
            let regQuery = supabase
                .from('schedule_registrations')
                .select('*, users:user_id(name, employee_id, avatar_url), stores:store_id(code, name)')
                .gte('work_date', start)
                .lte('work_date', end);
            if (storeId) regQuery = regQuery.eq('store_id', storeId);

            let asgnQuery = supabase
                .from('schedule_overview')
                .select('*')
                .gte('work_date', start)
                .lte('work_date', end);
            if (storeId) asgnQuery = asgnQuery.eq('store_id', storeId);

            const [regRes, asgnRes] = await Promise.all([regQuery, asgnQuery]);

            const registrations: ScheduleRegistration[] = (regRes.data || []).map((r: any) => ({
                ...r,
                user_name: r.users?.name,
                store_code: r.stores?.code,
                store_name: r.stores?.name,
            }));

            const assignments: ScheduleAssignment[] = (asgnRes.data || []).map((a: any) => ({
                ...a,
            }));

            return { registrations, assignments };
        } catch (err) {
            console.error('[Schedule] getWeekSchedule error:', err);
            return { registrations: [], assignments: [] };
        }
    },

    async getMyAssignments(weekDate: Date): Promise<ScheduleAssignment[]> {
        if (!isSupabaseConfigured()) return [];
        try {
            const userId = await getCurrentUserId();
            const { start, end } = getWeekRange(weekDate);
            const { data, error } = await supabase
                .from('schedule_overview')
                .select('*')
                .eq('user_id', userId)
                .gte('work_date', start)
                .lte('work_date', end);
            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error('[Schedule] getMyAssignments error:', err);
            return [];
        }
    },

    async getAvailableEmployees(
        storeId: string,
        workDate: string,
        shift: number
    ): Promise<ScheduleRegistration[]> {
        if (!isSupabaseConfigured()) return [];
        try {
            const { data, error } = await supabase
                .from('schedule_registrations')
                .select('*, users:user_id(name, employee_id, avatar_url)')
                .eq('store_id', storeId)
                .eq('work_date', workDate)
                .eq('shift', shift);
            if (error) throw error;
            return (data || []).map((r: any) => ({
                ...r,
                user_name: r.users?.name,
            }));
        } catch (err) {
            console.error('[Schedule] getAvailableEmployees error:', err);
            return [];
        }
    },

    async getAllEmployees(): Promise<{ id: string; name: string; employee_id: string; avatar_url?: string }[]> {
        if (!isSupabaseConfigured()) return [];
        try {
            const { data, error } = await supabase
                .from('users')
                .select('id, name, employee_id, avatar_url')
                .order('name');
            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error('[Schedule] getAllEmployees error:', err);
            return [];
        }
    },
};

export default ScheduleService;
