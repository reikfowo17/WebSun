import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ScheduleService, getWeekDates } from '../services/schedule';
import type { ScheduleRegistration, ScheduleAssignment } from '../services/schedule';
import { SystemService } from '../services/system';
import type { StoreConfig, ShiftConfig } from '../services/system';

export interface ToastFn {
    success: (msg: string) => void;
    error: (msg: string) => void;
    info: (msg: string) => void;
    warning: (msg: string) => void;
}

export type EmpTab = 'REGISTER' | 'MY_SCHEDULE';

export const DAY_NAMES = ['THỨ 2', 'THỨ 3', 'THỨ 4', 'THỨ 5', 'THỨ 6', 'THỨ 7', 'CN'];
export const DAY_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];

function todayStr(): string {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

function formatDateShort(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getDate()}/${d.getMonth() + 1}`;
}

function getShiftHours(timeStr: string): number {
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
    if (!match) return 8;
    const startH = parseInt(match[1]) + parseInt(match[2]) / 60;
    const endH = parseInt(match[3]) + parseInt(match[4]) / 60;
    const diff = endH > startH ? endH - startH : (24 - startH + endH);
    return Math.round(diff * 10) / 10;
}

export function useSchedule(isAdmin: boolean, toast: ToastFn) {
    const toastRef = useRef(toast);
    toastRef.current = toast;

    const [empTab, setEmpTab] = useState<EmpTab>('MY_SCHEDULE');
    const [weekOffset, setWeekOffset] = useState(0);
    const [stores, setStores] = useState<StoreConfig[]>([]);
    const [shifts, setShifts] = useState<ShiftConfig[]>([]);
    const [selectedStore, setSelectedStore] = useState('');
    const [registrations, setRegistrations] = useState<ScheduleRegistration[]>([]);
    const [assignments, setAssignments] = useState<ScheduleAssignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);
    const [employees, setEmployees] = useState<{ id: string; name: string; employee_id: string; avatar_url?: string }[]>([]);
    const [assignPopup, setAssignPopup] = useState<{ date: string; shift: number } | null>(null);
    const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

    const baseDate = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() + weekOffset * 7);
        return d;
    }, [weekOffset]);

    const weekDates = useMemo(() => getWeekDates(baseDate), [baseDate]);

    const [today, setToday] = useState(() => todayStr());
    useEffect(() => {
        const now = new Date();
        const msToMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
        const tid = setTimeout(() => {
            setToday(todayStr());
            const interval = setInterval(() => setToday(todayStr()), 60_000);
            return () => clearInterval(interval);
        }, msToMidnight + 500);
        return () => clearTimeout(tid);
    }, []);
    const weekLabel = useMemo(() => `${formatDateShort(weekDates[0])} — ${formatDateShort(weekDates[6])}`, [weekDates]);

    const shiftTree = useMemo(() => {
        const mainShifts = shifts.filter(s => (s.type || 'MAIN') === 'MAIN');
        const supportShifts = shifts.filter(s => s.type === 'SUPPORT');
        return mainShifts.map(m => ({
            main: m,
            supports: supportShifts.filter(s => s.parent_id === m.id),
        }));
    }, [shifts]);

    const allShiftIds = useMemo(() => shifts.map(s => s.id), [shifts]);

    const slotLookup = useMemo(() => {
        const regMap = new Map<string, ScheduleRegistration[]>();
        const asgnMap = new Map<string, ScheduleAssignment[]>();
        registrations.forEach(r => {
            const key = `${r.work_date}-${r.shift}`;
            const arr = regMap.get(key);
            if (arr) arr.push(r); else regMap.set(key, [r]);
        });
        assignments.forEach(a => {
            const key = `${a.work_date}-${a.shift}`;
            const arr = asgnMap.get(key);
            if (arr) arr.push(a); else asgnMap.set(key, [a]);
        });
        return { regMap, asgnMap };
    }, [registrations, assignments]);

    const getRegsForSlot = useCallback(
        (date: string, shift: number) => slotLookup.regMap.get(`${date}-${shift}`) || [],
        [slotLookup]
    );
    const getAsgnsForSlot = useCallback(
        (date: string, shift: number) => slotLookup.asgnMap.get(`${date}-${shift}`) || [],
        [slotLookup]
    );
    const isRegistered = useCallback(
        (date: string, shift: number) => (slotLookup.regMap.get(`${date}-${shift}`) || []).length > 0,
        [slotLookup]
    );
    const isAssignedSlot = useCallback(
        (date: string, shift: number) => (slotLookup.asgnMap.get(`${date}-${shift}`) || []).length > 0,
        [slotLookup]
    );

    const shiftMap = useMemo(() => {
        const m = new Map<number, ShiftConfig>();
        shifts.forEach(s => m.set(s.id, s));
        return m;
    }, [shifts]);

    const totalSlots = useMemo(() => {
        return shifts.reduce((sum, s) => sum + (s.max_slots || 1) * 7, 0);
    }, [shifts]);
    const filledSlots = assignments.length;
    const fillRate = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;
    const emptySlots = Math.max(0, totalSlots - filledSlots);
    const totalHours = useMemo(() => assignments.reduce((sum, a) => {
        const sc = shiftMap.get(a.shift);
        return sum + (sc ? getShiftHours(sc.time) : 8);
    }, 0), [assignments, shiftMap]);
    const regCount = new Set(registrations.map(r => `${r.work_date}-${r.shift}`)).size;

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const [s, sh] = await Promise.all([SystemService.getStores(), SystemService.getShifts()]);
                if (cancelled) return;
                setStores(s.filter(st => st.is_active !== false));
                const resolvedShifts = sh.length > 0 ? sh : [
                    { id: 1, name: 'Ca 1', time: '06:00 - 14:00', icon: 'wb_sunny', color: '#fbbf24', type: 'MAIN' as const },
                    { id: 2, name: 'Ca 2', time: '14:00 - 22:00', icon: 'wb_twilight', color: '#f43f5e', type: 'MAIN' as const },
                    { id: 3, name: 'Ca 3', time: '22:00 - 06:00', icon: 'nights_stay', color: '#6366f1', type: 'MAIN' as const },
                ];
                setShifts(resolvedShifts);
                if (s.length > 0 && !selectedStore) setSelectedStore(s[0].id);
            } catch (err) {
                if (!cancelled) console.error('[Schedule] init error:', err);
            }
        })();

        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (isAdmin && selectedStore) ScheduleService.getAllEmployees(selectedStore).then(setEmployees);
    }, [isAdmin, selectedStore]);
    const loadData = useCallback(async (showLoading = true) => {
        if (!selectedStore) return;
        if (showLoading) setLoading(true);
        try {
            if (isAdmin) {
                const data = await ScheduleService.getWeekSchedule(baseDate, selectedStore);
                setRegistrations(data.registrations);
                setAssignments(data.assignments);
            } else {
                const [regs, asgns] = await Promise.all([
                    ScheduleService.getMyRegistrations(baseDate, selectedStore),
                    ScheduleService.getMyAssignments(baseDate, selectedStore),
                ]);
                setRegistrations(regs);
                setAssignments(asgns);
            }
        } catch {
            toastRef.current.error('Lỗi tải lịch làm');
        } finally {
            if (showLoading) setLoading(false);
        }
    }, [baseDate, selectedStore, isAdmin]);

    useEffect(() => { loadData(true); }, [loadData]);

    const toggleRegistration = async (date: string, shift: number) => {
        const existing = registrations.find(r => r.work_date === date && r.shift === shift && r.store_id === selectedStore);

        if (existing) {
            const sc = shiftMap.get(shift);
            setConfirmDialog({
                title: 'Hủy đăng ký',
                message: `Bạn muốn hủy đăng ký ${sc?.name || 'ca'} ngày ${formatDateShort(date)}?`,
                onConfirm: async () => {
                    setConfirmDialog(null);
                    setProcessing(`${date}-${shift}`);
                    try {
                        const r = await ScheduleService.cancelRegistration(existing.id);
                        r.success ? toastRef.current.info('Đã hủy đăng ký') : toastRef.current.error(r.message || 'Lỗi');
                        await loadData(false);
                    } catch {
                        toastRef.current.error('Lỗi hệ thống');
                    } finally {
                        setProcessing(null);
                    }
                },
            });
            return;
        }

        setProcessing(`${date}-${shift}`);
        try {
            const r = await ScheduleService.registerAvailability(selectedStore, date, shift);
            r.success ? toastRef.current.success('Đã đăng ký') : toastRef.current.error(r.message || 'Lỗi');
            await loadData(false);
        } catch {
            toastRef.current.error('Lỗi hệ thống');
        } finally {
            setProcessing(null);
        }
    };

    const handleAssign = async (userId: string, date?: string, shift?: number) => {
        const d = date || assignPopup?.date;
        const s = shift || assignPopup?.shift;
        if (!d || !s) return;
        setProcessing('assign');
        try {
            const r = await ScheduleService.assignShift(userId, selectedStore, d, s);
            r.success ? toastRef.current.success('Đã xếp lịch') : toastRef.current.error(r.message || 'Lỗi');
            if (assignPopup) setAssignPopup(null);
            await loadData(false);
        } catch {
            toastRef.current.error('Lỗi hệ thống');
        } finally {
            setProcessing(null);
        }
    };

    const handleRemoveAssignment = async (aId: string) => {
        setProcessing('remove-' + aId);
        try {
            const r = await ScheduleService.removeAssignment(aId);
            r.success ? toastRef.current.success('Đã xóa') : toastRef.current.error(r.message || 'Lỗi');
            await loadData(false);
        } catch {
            toastRef.current.error('Lỗi hệ thống');
        } finally {
            setProcessing(null);
        }
    };

    const handleCopyRegs = async () => {
        setProcessing('copy-regs');
        try {
            const r = await ScheduleService.copyPreviousWeekRegistrations(baseDate, selectedStore);
            r.success ? toastRef.current.success(r.message!) : toastRef.current.warning(r.message!);
            await loadData(true);
        } catch {
            toastRef.current.error('Lỗi hệ thống');
        } finally {
            setProcessing(null);
        }
    };

    const handleCopyAsgns = async () => {
        setProcessing('copy-asgns');
        try {
            const r = await ScheduleService.copyPreviousWeekAssignments(baseDate, selectedStore);
            r.success ? toastRef.current.success(r.message!) : toastRef.current.warning(r.message!);
            await loadData(true);
        } catch {
            toastRef.current.error('Lỗi hệ thống');
        } finally {
            setProcessing(null);
        }
    };

    const handleAutoAssign = async () => {
        setProcessing('auto-assign');
        try {
            const r = await ScheduleService.autoAssignShifts(baseDate, selectedStore, shifts);
            r.success ? toastRef.current.success(r.message!) : toastRef.current.warning(r.message!);
            await loadData(true);
        } catch {
            toastRef.current.error('Lỗi hệ thống');
        } finally {
            setProcessing(null);
        }
    };

    const confirmAutoAssign = () => {
        setConfirmDialog({
            title: 'Tự động xếp lịch',
            message: 'Tất cả đăng ký chưa được xếp sẽ tự động duyệt vào lịch. Bạn chắc chắn?',
            onConfirm: () => { setConfirmDialog(null); handleAutoAssign(); },
        });
    };

    const confirmCopyAsgns = () => {
        setConfirmDialog({
            title: 'Sao chép lịch tuần trước',
            message: 'Toàn bộ lịch làm ca tuần trước sẽ được copy sang tuần này. Bạn chắc chắn?',
            onConfirm: () => { setConfirmDialog(null); handleCopyAsgns(); },
        });
    };

    const confirmRemoveAssignment = (aId: string, userName?: string) => {
        setConfirmDialog({
            title: 'Xóa ca đã xếp',
            message: `Bạn muốn xóa lịch đã xếp${userName ? ` của ${userName}` : ''}?`,
            onConfirm: () => { setConfirmDialog(null); handleRemoveAssignment(aId); },
        });
    };

    return {
        empTab, setEmpTab,
        weekOffset, setWeekOffset,
        stores, shifts, selectedStore, setSelectedStore,
        registrations, assignments,
        loading, processing,
        employees,
        assignPopup, setAssignPopup,
        confirmDialog, setConfirmDialog,

        baseDate, weekDates, today, weekLabel,
        shiftTree, allShiftIds,

        getRegsForSlot, getAsgnsForSlot, isRegistered, isAssignedSlot,

        totalSlots, filledSlots, fillRate, emptySlots, totalHours, regCount,

        toggleRegistration, handleAssign,
        handleRemoveAssignment: confirmRemoveAssignment,
        handleCopyRegs,
        handleAutoAssign: confirmAutoAssign,
        handleCopyAsgns: confirmCopyAsgns,
    };
}

export { formatDateShort };
