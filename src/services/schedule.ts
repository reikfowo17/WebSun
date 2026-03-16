import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface StoreShift {
    id: number;
    store_id: string;
    name: string;
    time_start: string;
    time_end: string;
    type: 'MAIN' | 'SUPPORT';
    parent_id?: number;
    icon: string;
    color?: string;
    max_slots: number;
    sort_order: number;
    is_active: boolean;
}

export type AssignmentTag = 'SPECIAL_ATTENTION' | 'VACANCY' | 'CUSTOM_HOURS' | 'EMERGENCY' | 'STAFF_CHANGE' | 'TRIAL';

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
    custom_start?: string;
    custom_end?: string;
    tag?: AssignmentTag;
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

function formatLocalDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getWeekRange(baseDate: Date): { start: string; end: string } {
    const d = new Date(baseDate);
    const day = d.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    const mon = new Date(d);
    mon.setDate(d.getDate() + diffToMon);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return { start: formatLocalDate(mon), end: formatLocalDate(sun) };
}

export function getWeekDates(baseDate: Date): string[] {
    const { start } = getWeekRange(baseDate);
    const dates: string[] = [];
    const d = new Date(start + 'T00:00:00');
    for (let i = 0; i < 7; i++) {
        dates.push(formatLocalDate(d));
        d.setDate(d.getDate() + 1);
    }
    return dates;
}

async function getCurrentUserId(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('Not authenticated');
    return session.user.id;
}

export const ScheduleService = {
    async getStoreShifts(storeId: string): Promise<StoreShift[]> {
        if (!isSupabaseConfigured()) return [];
        try {
            const { data, error } = await supabase
                .from('store_shifts')
                .select('*')
                .eq('store_id', storeId)
                .eq('is_active', true)
                .order('sort_order');
            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error('[Schedule] getStoreShifts error:', err);
            return [];
        }
    },

    async getAllStoreShifts(): Promise<StoreShift[]> {
        if (!isSupabaseConfigured()) return [];
        try {
            const { data, error } = await supabase
                .from('store_shifts')
                .select('*')
                .eq('is_active', true)
                .order('store_id')
                .order('sort_order');
            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error('[Schedule] getAllStoreShifts error:', err);
            return [];
        }
    },

    async registerAvailability(
        workDate: string,
        shiftId: number,
        note?: string
    ): Promise<ServiceResult> {
        if (!isSupabaseConfigured()) return { success: false, message: 'DB Disconnected' };
        if (workDate < formatLocalDate(new Date())) {
            return { success: false, message: 'Không thể đăng ký lịch làm trong quá khứ' };
        }
        try {
            const userId = await getCurrentUserId();
            const { data: userStores, error: usErr } = await supabase
                .from('user_stores')
                .select('store_id')
                .eq('user_id', userId);
            if (usErr) throw usErr;
            if (!userStores || userStores.length === 0) {
                return { success: false, message: 'Bạn chưa được gán vào cửa hàng nào' };
            }
            const rows = userStores.map(us => ({
                user_id: userId,
                store_id: us.store_id,
                work_date: workDate,
                shift: shiftId,
                note,
            }));
            const { error } = await supabase
                .from('schedule_registrations')
                .upsert(rows, { onConflict: 'user_id,store_id,work_date,shift', ignoreDuplicates: true });
            if (error) throw error;
            return { success: true, message: 'Đã đăng ký thành công' };
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('[Schedule] registerAvailability error:', err);
            return { success: false, message: msg };
        }
    },

    async cancelRegistration(workDate: string, shiftId: number): Promise<ServiceResult> {
        if (!isSupabaseConfigured()) return { success: false, message: 'DB Disconnected' };
        try {
            const userId = await getCurrentUserId();
            if (workDate < formatLocalDate(new Date())) {
                return { success: false, message: 'Không thể hủy lịch làm trong quá khứ' };
            }
            const { error } = await supabase
                .from('schedule_registrations')
                .delete()
                .eq('user_id', userId)
                .eq('work_date', workDate)
                .eq('shift', shiftId);
            if (error) throw error;
            return { success: true, message: 'Đã hủy đăng ký' };
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('[Schedule] cancelRegistration error:', err);
            return { success: false, message: msg };
        }
    },

    async batchRegister(
        slots: { work_date: string; shift: number }[]
    ): Promise<ServiceResult<{ added: number; skipped: number }>> {
        if (!isSupabaseConfigured()) return { success: false, message: 'DB Disconnected' };
        try {
            const userId = await getCurrentUserId();
            const { data: userStores, error: usErr } = await supabase
                .from('user_stores')
                .select('store_id')
                .eq('user_id', userId);
            if (usErr) throw usErr;
            if (!userStores || userStores.length === 0) {
                return { success: false, message: 'Bạn chưa được gán vào cửa hàng nào' };
            }
            const rows = slots.flatMap(s =>
                userStores.map(us => ({
                    user_id: userId,
                    store_id: us.store_id,
                    work_date: s.work_date,
                    shift: s.shift,
                }))
            );
            const { data, error } = await supabase
                .from('schedule_registrations')
                .upsert(rows, { onConflict: 'user_id,store_id,work_date,shift', ignoreDuplicates: true })
                .select('id');
            if (error) throw error;
            const added = data?.length || 0;
            return { success: true, data: { added, skipped: rows.length - added }, message: `Đã đăng ký ${added} ca` };
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('[Schedule] batchRegister error:', err);
            return { success: false, message: msg };
        }
    },

    async getMyRegistrations(weekDate: Date): Promise<ScheduleRegistration[]> {
        if (!isSupabaseConfigured()) return [];
        try {
            const userId = await getCurrentUserId();
            const { start, end } = getWeekRange(weekDate);
            const { data, error } = await supabase
                .from('schedule_registrations')
                .select('*, stores:store_id(code, name)')
                .eq('user_id', userId)
                .gte('work_date', start)
                .lte('work_date', end);
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

    async getMyAssignments(weekDate: Date): Promise<ScheduleAssignment[]> {
        if (!isSupabaseConfigured()) return [];
        try {
            const userId = await getCurrentUserId();
            const { start, end } = getWeekRange(weekDate);
            const { data, error } = await supabase
                .from('schedule_full_view')
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

    async getCoworkerAssignments(storeIds: string[], weekDate: Date): Promise<ScheduleAssignment[]> {
        if (!isSupabaseConfigured()) return [];
        if (storeIds.length === 0) return [];
        try {
            const { start, end } = getWeekRange(weekDate);
            const { data, error } = await supabase
                .from('schedule_full_view')
                .select('*')
                .in('store_id', storeIds)
                .gte('work_date', start)
                .lte('work_date', end);
            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error('[Schedule] getCoworkerAssignments error:', err);
            return [];
        }
    },

    async getMyStores(): Promise<{ id: string; code: string; name: string }[]> {
        if (!isSupabaseConfigured()) return [];
        try {
            const userId = await getCurrentUserId();
            const { data, error } = await supabase
                .from('user_stores')
                .select('stores:store_id(id, code, name)')
                .eq('user_id', userId);
            if (error) throw error;
            return (data || []).map((row: any) => row.stores).filter(Boolean);
        } catch (err) {
            console.error('[Schedule] getMyStores error:', err);
            return [];
        }
    },

    async getFullWeekSchedule(weekDate: Date): Promise<WeekScheduleData> {
        if (!isSupabaseConfigured()) return { registrations: [], assignments: [] };
        try {
            const { start, end } = getWeekRange(weekDate);

            const [regRes, asgnRes] = await Promise.all([
                supabase
                    .from('schedule_registrations')
                    .select('*, users:user_id(name, employee_id, avatar_url), stores:store_id(code, name)')
                    .gte('work_date', start)
                    .lte('work_date', end),
                supabase
                    .from('schedule_full_view')
                    .select('*')
                    .gte('work_date', start)
                    .lte('work_date', end),
            ]);

            const registrations: ScheduleRegistration[] = (regRes.data || []).map((r: any) => ({
                ...r,
                user_name: r.users?.name,
                store_code: r.stores?.code,
                store_name: r.stores?.name,
            }));

            const assignments: ScheduleAssignment[] = asgnRes.data || [];

            return { registrations, assignments };
        } catch (err) {
            console.error('[Schedule] getFullWeekSchedule error:', err);
            return { registrations: [], assignments: [] };
        }
    },

    async assignShift(
        userId: string,
        storeId: string,
        workDate: string,
        shift: number,
        opts?: { note?: string; custom_start?: string; custom_end?: string; tag?: AssignmentTag }
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
                    note: opts?.note,
                    custom_start: opts?.custom_start || null,
                    custom_end: opts?.custom_end || null,
                    tag: opts?.tag || null,
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

    async updateAssignment(
        assignmentId: string,
        updates: { custom_start?: string | null; custom_end?: string | null; tag?: AssignmentTag | null; note?: string }
    ): Promise<ServiceResult> {
        if (!isSupabaseConfigured()) return { success: false, message: 'DB Disconnected' };
        try {
            const { error } = await supabase
                .from('schedule_assignments')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', assignmentId);
            if (error) throw error;
            return { success: true, message: 'Đã cập nhật' };
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('[Schedule] updateAssignment error:', err);
            return { success: false, message: msg };
        }
    },

    async removeAssignment(assignmentId: string): Promise<ServiceResult> {
        if (!isSupabaseConfigured()) return { success: false, message: 'DB Disconnected' };
        try {
            const { error } = await supabase.from('schedule_assignments').delete().eq('id', assignmentId);
            if (error) throw error;
            return { success: true, message: 'Đã xóa lịch' };
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('[Schedule] removeAssignment error:', err);
            return { success: false, message: msg };
        }
    },

    async autoAssignShifts(weekDate: Date, storeId: string, storeShifts: StoreShift[]): Promise<ServiceResult> {
        if (!isSupabaseConfigured()) return { success: false, message: 'DB Disconnected' };
        try {
            const adminId = await getCurrentUserId();
            const { start, end } = getWeekRange(weekDate);

            const { data: existingAsgns, error: asgnErr } = await supabase
                .from('schedule_assignments')
                .select('user_id, work_date, shift')
                .eq('store_id', storeId)
                .gte('work_date', start)
                .lte('work_date', end);
            if (asgnErr) throw asgnErr;

            const assignedSet = new Set((existingAsgns || []).map(a => `${a.user_id}-${a.work_date}-${a.shift}`));
            const slotCountMap = new Map<string, number>();
            (existingAsgns || []).forEach(a => {
                const key = `${a.work_date}-${a.shift}`;
                slotCountMap.set(key, (slotCountMap.get(key) || 0) + 1);
            });

            const maxSlotsMap = new Map<number, number>();
            storeShifts.forEach(ss => { if (ss.max_slots > 0) maxSlotsMap.set(ss.id, ss.max_slots); });

            const { data: regs, error: regErr } = await supabase
                .from('schedule_registrations')
                .select('*')
                .eq('store_id', storeId)
                .gte('work_date', start)
                .lte('work_date', end);
            if (regErr) throw regErr;
            if (!regs || regs.length === 0) return { success: false, message: 'Không có đăng ký nào để xếp tự động' };

            const toInsert: any[] = [];
            let skippedByMax = 0;

            for (const r of regs) {
                if (assignedSet.has(`${r.user_id}-${r.work_date}-${r.shift}`)) continue;
                const slotKey = `${r.work_date}-${r.shift}`;
                const currentCount = slotCountMap.get(slotKey) || 0;
                const maxSlots = maxSlotsMap.get(r.shift);
                if (maxSlots && currentCount >= maxSlots) { skippedByMax++; continue; }

                toInsert.push({
                    user_id: r.user_id, store_id: storeId, shift: r.shift, work_date: r.work_date,
                    assigned_by: adminId, updated_at: new Date().toISOString()
                });
                slotCountMap.set(slotKey, currentCount + 1);
                assignedSet.add(`${r.user_id}-${r.work_date}-${r.shift}`);
            }

            if (toInsert.length === 0) {
                return { success: true, message: skippedByMax > 0 ? `Tất cả slot đã đầy (${skippedByMax} vượt giới hạn)` : 'Tất cả đã xếp rồi' };
            }

            const { error: insertErr } = await supabase
                .from('schedule_assignments')
                .upsert(toInsert, { onConflict: 'user_id,store_id,work_date,shift', ignoreDuplicates: true });
            if (insertErr) throw insertErr;

            const extra = skippedByMax > 0 ? ` (bỏ qua ${skippedByMax} do vượt slot)` : '';
            return { success: true, message: `Đã tự động xếp ${toInsert.length} ca${extra}` };
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('[Schedule] autoAssignShifts error:', err);
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

            const toInsert = prevAsgns
                .map(a => {
                    const dayIndex = prevWeekDates.indexOf(a.work_date);
                    if (dayIndex === -1) return null;
                    return {
                        user_id: a.user_id, store_id: storeId, shift: a.shift,
                        work_date: currentWeekDates[dayIndex], assigned_by: adminId,
                        custom_start: a.custom_start, custom_end: a.custom_end, tag: a.tag,
                        updated_at: new Date().toISOString()
                    };
                })
                .filter((a): a is NonNullable<typeof a> => a !== null);

            if (toInsert.length === 0) return { success: false, message: 'Không thể map ngày tuần trước' };

            const { error: insertErr } = await supabase
                .from('schedule_assignments')
                .upsert(toInsert, { onConflict: 'user_id,store_id,work_date,shift', ignoreDuplicates: true });
            if (insertErr) throw insertErr;
            return { success: true, message: `Đã sao chép ${toInsert.length} ca từ tuần trước` };
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('[Schedule] copyPreviousWeekAssignments error:', err);
            return { success: false, message: msg };
        }
    },

    async copyPreviousWeekRegistrations(weekDate: Date): Promise<ServiceResult> {
        if (!isSupabaseConfigured()) return { success: false, message: 'DB Disconnected' };
        try {
            const userId = await getCurrentUserId();
            const prevWeek = new Date(weekDate);
            prevWeek.setDate(prevWeek.getDate() - 7);
            const { start: prevStart, end: prevEnd } = getWeekRange(prevWeek);

            const { data: prevRegs, error: fetchErr } = await supabase
                .from('schedule_registrations')
                .select('*')
                .eq('user_id', userId)
                .gte('work_date', prevStart)
                .lte('work_date', prevEnd);
            if (fetchErr) throw fetchErr;
            if (!prevRegs || prevRegs.length === 0) return { success: false, message: 'Không có đăng ký tuần trước để sao chép' };

            const currentWeekDates = getWeekDates(weekDate);
            const prevWeekDates = getWeekDates(prevWeek);

            const toInsert = prevRegs
                .map(r => {
                    const dayIndex = prevWeekDates.indexOf(r.work_date);
                    if (dayIndex === -1) return null;
                    return {
                        user_id: userId, store_id: r.store_id, shift: r.shift,
                        work_date: currentWeekDates[dayIndex], note: r.note
                    };
                })
                .filter((r): r is NonNullable<typeof r> => r !== null);

            if (toInsert.length === 0) return { success: false, message: 'Không thể map ngày tuần trước' };

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

    async getAllEmployees(storeId?: string): Promise<{ id: string; name: string; employee_id: string; avatar_url?: string }[]> {
        if (!isSupabaseConfigured()) return [];
        try {
            if (storeId) {
                const { data, error } = await supabase
                    .from('user_stores')
                    .select('users:user_id(id, name, employee_id, avatar_url)')
                    .eq('store_id', storeId);
                if (error) throw error;
                return (data || []).map((row: any) => row.users).filter(Boolean)
                    .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
            }
            const { data, error } = await supabase.from('users').select('id, name, employee_id, avatar_url').order('name');
            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error('[Schedule] getAllEmployees error:', err);
            return [];
        }
    },

    async getTodayAssignments(userId: string, storeId: string, date?: string): Promise<ScheduleAssignment[]> {
        if (!isSupabaseConfigured()) return [];
        try {
            const today = date || formatLocalDate(new Date());
            const { data, error } = await supabase
                .from('schedule_assignments')
                .select('*')
                .eq('user_id', userId)
                .eq('store_id', storeId)
                .eq('work_date', today);
            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error('[Schedule] getTodayAssignments error:', err);
            return [];
        }
    },

    async registerSupportShift(
        storeId: string,
        shiftConfigId: number,
        note?: string
    ): Promise<ServiceResult> {
        if (!isSupabaseConfigured()) return { success: false, message: 'DB Disconnected' };
        try {
            const userId = await getCurrentUserId();
            const today = formatLocalDate(new Date());
            const { error } = await supabase
                .from('schedule_registrations')
                .insert({
                    user_id: userId,
                    store_id: storeId,
                    work_date: today,
                    shift: shiftConfigId,
                    note: note || 'Đăng ký hỗ trợ từ trang ca làm',
                });
            if (error) {
                if (error.code === '23505') return { success: false, message: 'Bạn đã đăng ký ca này rồi' };
                throw error;
            }
            return { success: true, message: 'Đã đăng ký hỗ trợ thành công! Vui lòng chờ admin duyệt.' };
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('[Schedule] registerSupportShift error:', err);
            return { success: false, message: msg };
        }
    },
};

export default ScheduleService;
