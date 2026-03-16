import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ScheduleService, { getWeekDates } from '../services/schedule';
import type { ScheduleRegistration, ScheduleAssignment, StoreShift, AssignmentTag } from '../services/schedule';
import { SystemService } from '../services/system';
import type { StoreConfig } from '../services/system';

export type EmpTab = 'MY_SCHEDULE' | 'REGISTER';
export type AdminTab = 'OVERVIEW' | 'DETAIL';
export type ToastFn = { success: (m: string) => void; error: (m: string) => void; info: (m: string) => void };

export const DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
export const DAY_NAMES = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];

export function formatDateShort(d: string) {
    const dt = new Date(d + 'T00:00:00');
    return `${dt.getDate()}/${dt.getMonth() + 1}`;
}

export const TAG_CONFIG: Record<AssignmentTag, { label: string; color: string; bg: string; bgDark: string; icon: string }> = {
    SPECIAL_ATTENTION: { label: 'Đặc biệt', color: '#D97706', bg: 'bg-amber-100', bgDark: 'dark:bg-amber-900/20', icon: 'priority_high' },
    VACANCY: { label: 'Chưa có NV', color: '#16A34A', bg: 'bg-green-100', bgDark: 'dark:bg-green-900/20', icon: 'person_off' },
    CUSTOM_HOURS: { label: 'Giờ đặc biệt', color: '#2563EB', bg: 'bg-blue-100', bgDark: 'dark:bg-blue-900/20', icon: 'schedule' },
    EMERGENCY: { label: 'Cấp cứu NS', color: '#EC4899', bg: 'bg-pink-100', bgDark: 'dark:bg-pink-900/20', icon: 'emergency' },
    STAFF_CHANGE: { label: 'Đổi NV', color: '#7C3AED', bg: 'bg-purple-100', bgDark: 'dark:bg-purple-900/20', icon: 'swap_horiz' },
    TRIAL: { label: 'Thử thách', color: '#6B7280', bg: 'bg-gray-100', bgDark: 'dark:bg-gray-800', icon: 'psychology' },
};

function formatLocalDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function useSchedule(isAdmin: boolean, toast: ToastFn) {
    // ── State ──
    const [empTab, setEmpTab] = useState<EmpTab>('MY_SCHEDULE');
    const [adminTab, setAdminTab] = useState<AdminTab>('OVERVIEW');
    const [weekOffset, setWeekOffset] = useState(0);
    const [stores, setStores] = useState<StoreConfig[]>([]);
    const [allStoreShifts, setAllStoreShifts] = useState<StoreShift[]>([]);
    const [selectedStore, setSelectedStore] = useState<string | null>(null);
    const [registrations, setRegistrations] = useState<ScheduleRegistration[]>([]);
    const [assignments, setAssignments] = useState<ScheduleAssignment[]>([]);
    const [coworkerAssignments, setCoworkerAssignments] = useState<ScheduleAssignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);
    const [employees, setEmployees] = useState<{ id: string; name: string; employee_id: string; avatar_url?: string }[]>([]);
    const [myStores, setMyStores] = useState<{ id: string; code: string; name: string }[]>([]);
    const [assignPopup, setAssignPopup] = useState<{ date: string; shift: number; storeId: string } | null>(null);
    const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

    const toastRef = useRef(toast);
    toastRef.current = toast;

    // ── Derived ──
    const baseDate = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() + weekOffset * 7);
        return d;
    }, [weekOffset]);

    const weekDates = useMemo(() => getWeekDates(baseDate), [baseDate]);
    const today = formatLocalDate(new Date());

    const weekLabel = useMemo(() => {
        const s = weekDates[0], e = weekDates[6];
        return `${formatDateShort(s)} — ${formatDateShort(e)}`;
    }, [weekDates]);

    // Group store_shifts by store
    const storeShiftsMap = useMemo(() => {
        const map = new Map<string, StoreShift[]>();
        allStoreShifts.forEach(ss => {
            const arr = map.get(ss.store_id) || [];
            arr.push(ss);
            map.set(ss.store_id, arr);
        });
        return map;
    }, [allStoreShifts]);

    // For employee registration: unique shift names (use first store's shifts as template)
    const registrationShifts = useMemo(() => {
        if (isAdmin) return [];
        // Collect unique shift IDs the employee might register for (from their stores)
        const seen = new Map<string, StoreShift>();
        myStores.forEach(ms => {
            const shifts = storeShiftsMap.get(ms.id) || [];
            shifts.forEach(sh => {
                if (sh.type === 'MAIN' && !seen.has(sh.name)) {
                    seen.set(sh.name, sh);
                }
            });
        });
        return Array.from(seen.values()).sort((a, b) => a.sort_order - b.sort_order);
    }, [isAdmin, myStores, storeShiftsMap]);

    // Today's assignments
    const todayAssignments = useMemo(() =>
        assignments.filter(a => a.work_date === today),
        [assignments, today]
    );

    // Registration check: is this day+shift registered? (check by shift ID)
    const isRegistered = useCallback((date: string, shiftId: number) =>
        registrations.some(r => r.work_date === date && r.shift === shiftId),
        [registrations]
    );

    // Get assignments for a specific store+date+shift
    const getAsgnsForSlot = useCallback((storeId: string, date: string, shiftId: number) =>
        assignments.filter(a => a.store_id === storeId && a.work_date === date && a.shift === shiftId),
        [assignments]
    );

    // Get coworker assignments for a specific store+date+shift
    const getCoworkerAsgnsForSlot = useCallback((storeId: string, date: string, shiftId: number) =>
        coworkerAssignments.filter(a => a.store_id === storeId && a.work_date === date && a.shift === shiftId),
        [coworkerAssignments]
    );

    // Get registrations for a specific store+date+shift
    const getRegsForSlot = useCallback((storeId: string, date: string, shiftId: number) =>
        registrations.filter(r => r.store_id === storeId && r.work_date === date && r.shift === shiftId),
        [registrations]
    );

    // ── Init: load stores + shifts ──
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [allStores, storeShifts] = await Promise.all([
                    SystemService.getStores(),
                    ScheduleService.getAllStoreShifts(),
                ]);
                if (cancelled) return;
                setStores(allStores.filter(st => st.is_active !== false));
                setAllStoreShifts(storeShifts);

                if (!isAdmin) {
                    const ms = await ScheduleService.getMyStores();
                    if (!cancelled) setMyStores(ms);
                }
                if (allStores.length > 0 && !selectedStore) {
                    setSelectedStore(allStores[0].id);
                }
            } catch (err) {
                if (!cancelled) console.error('[Schedule] init error:', err);
            }
        })();
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAdmin]);

    // Load employees for admin detail view
    useEffect(() => {
        if (isAdmin && selectedStore) ScheduleService.getAllEmployees(selectedStore).then(setEmployees);
    }, [isAdmin, selectedStore]);

    // ── Load data ──
    const loadData = useCallback(async (showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            if (isAdmin) {
                // Admin: load ALL stores data in one call
                const data = await ScheduleService.getFullWeekSchedule(baseDate);
                setRegistrations(data.registrations);
                setAssignments(data.assignments);
            } else {
                // Employee: load own data + coworker data
                const myStoreIds = myStores.map(ms => ms.id);
                const [regs, asgns, coworkers] = await Promise.all([
                    ScheduleService.getMyRegistrations(baseDate),
                    ScheduleService.getMyAssignments(baseDate),
                    myStoreIds.length > 0 ? ScheduleService.getCoworkerAssignments(myStoreIds, baseDate) : Promise.resolve([]),
                ]);
                setRegistrations(regs);
                setAssignments(asgns);
                setCoworkerAssignments(coworkers);
            }
        } catch {
            toastRef.current.error('Lỗi tải lịch làm');
        } finally {
            if (showLoading) setLoading(false);
        }
    }, [baseDate, isAdmin, myStores]);

    useEffect(() => { loadData(); }, [loadData]);

    // ── Employee: toggle registration ──
    const toggleRegistration = useCallback(async (date: string, shiftId: number) => {
        const key = `${date}-${shiftId}`;
        setProcessing(key);
        try {
            const alreadyReg = isRegistered(date, shiftId);
            const result = alreadyReg
                ? await ScheduleService.cancelRegistration(date, shiftId)
                : await ScheduleService.registerAvailability(date, shiftId);
            if (result.success) {
                toastRef.current.success(result.message || (alreadyReg ? 'Đã hủy' : 'Đã đăng ký'));
                await loadData(false);
            } else {
                toastRef.current.error(result.message || 'Lỗi');
            }
        } catch {
            toastRef.current.error('Lỗi đăng ký');
        } finally {
            setProcessing(null);
        }
    }, [isRegistered, loadData]);

    // ── Admin: assign shift ──
    const handleAssign = useCallback(async (userId: string, storeId: string, date: string, shiftId: number, opts?: { custom_start?: string; custom_end?: string; tag?: AssignmentTag }) => {
        setProcessing(`assign-${userId}`);
        try {
            const result = await ScheduleService.assignShift(userId, storeId, date, shiftId, opts);
            if (result.success) {
                toastRef.current.success(result.message || 'Đã xếp');
                await loadData(false);
            } else {
                toastRef.current.error(result.message || 'Lỗi');
            }
        } catch {
            toastRef.current.error('Lỗi xếp lịch');
        } finally {
            setProcessing(null);
        }
    }, [loadData]);

    // ── Admin: update assignment (tag, custom hours) ──
    const handleUpdateAssignment = useCallback(async (assignmentId: string, updates: { custom_start?: string | null; custom_end?: string | null; tag?: AssignmentTag | null }) => {
        setProcessing(`update-${assignmentId}`);
        try {
            const result = await ScheduleService.updateAssignment(assignmentId, updates);
            if (result.success) {
                toastRef.current.success('Đã cập nhật');
                await loadData(false);
            } else {
                toastRef.current.error(result.message || 'Lỗi');
            }
        } catch {
            toastRef.current.error('Lỗi cập nhật');
        } finally {
            setProcessing(null);
        }
    }, [loadData]);

    // ── Admin: remove assignment with confirm ──
    const confirmRemoveAssignment = useCallback((aId: string, userName?: string) => {
        setConfirmDialog({
            title: 'Xóa lịch',
            message: `Bạn có chắc muốn xóa lịch làm${userName ? ' của ' + userName : ''}?`,
            onConfirm: async () => {
                setConfirmDialog(null);
                setProcessing('remove-' + aId);
                try {
                    const res = await ScheduleService.removeAssignment(aId);
                    res.success ? toastRef.current.success(res.message || 'Đã xóa') : toastRef.current.error(res.message || 'Lỗi');
                    await loadData(false);
                } catch {
                    toastRef.current.error('Lỗi xóa');
                } finally {
                    setProcessing(null);
                }
            }
        });
    }, [loadData]);

    // ── Admin: auto-assign for a store ──
    const handleAutoAssign = useCallback((storeId: string) => {
        const store = stores.find(s => s.id === storeId);
        const shifts = storeShiftsMap.get(storeId) || [];
        setConfirmDialog({
            title: 'Tự động xếp lịch',
            message: `Tự động xếp tất cả đăng ký vào lịch cho ${store?.name || 'cửa hàng'}?`,
            onConfirm: async () => {
                setConfirmDialog(null);
                setProcessing('auto-assign');
                try {
                    const result = await ScheduleService.autoAssignShifts(baseDate, storeId, shifts);
                    result.success ? toastRef.current.success(result.message || 'Đã xếp') : toastRef.current.error(result.message || 'Lỗi');
                    await loadData(false);
                } catch {
                    toastRef.current.error('Lỗi auto assign');
                } finally {
                    setProcessing(null);
                }
            }
        });
    }, [stores, storeShiftsMap, baseDate, loadData]);

    // ── Admin: copy previous week for a store ──
    const handleCopyAsgns = useCallback((storeId: string) => {
        const store = stores.find(s => s.id === storeId);
        setConfirmDialog({
            title: 'Sao chép tuần trước',
            message: `Sao chép lịch tuần trước cho ${store?.name || 'cửa hàng'}?`,
            onConfirm: async () => {
                setConfirmDialog(null);
                setProcessing('copy-asgns');
                try {
                    const result = await ScheduleService.copyPreviousWeekAssignments(baseDate, storeId);
                    result.success ? toastRef.current.success(result.message || 'Đã sao chép') : toastRef.current.error(result.message || 'Lỗi');
                    await loadData(false);
                } catch {
                    toastRef.current.error('Lỗi sao chép');
                } finally {
                    setProcessing(null);
                }
            }
        });
    }, [stores, baseDate, loadData]);

    // ── Employee: copy regs ──
    const handleCopyRegs = useCallback(async () => {
        setProcessing('copy-regs');
        try {
            const result = await ScheduleService.copyPreviousWeekRegistrations(baseDate);
            result.success ? toastRef.current.success(result.message || 'Đã sao chép') : toastRef.current.error(result.message || 'Lỗi');
            await loadData(false);
        } catch {
            toastRef.current.error('Lỗi sao chép');
        } finally {
            setProcessing(null);
        }
    }, [baseDate, loadData]);

    // ── Stats ──
    const stats = useMemo(() => {
        const totalSlots = stores.length * weekDates.length * 3; // rough estimate
        const filledSlots = assignments.length;
        const emptySlots = Math.max(0, totalSlots - filledSlots);
        const fillRate = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;
        const regCount = new Set(registrations.map(r => `${r.work_date}-${r.shift}`)).size;
        return { totalSlots, filledSlots, emptySlots, fillRate, regCount };
    }, [stores, weekDates, assignments, registrations]);

    return {
        // Tabs
        empTab, setEmpTab,
        adminTab, setAdminTab,
        weekOffset, setWeekOffset,

        // Data
        stores, allStoreShifts, storeShiftsMap,
        selectedStore, setSelectedStore,
        myStores, registrationShifts,
        registrations, assignments, coworkerAssignments,
        loading, processing,
        employees,
        assignPopup, setAssignPopup,
        confirmDialog, setConfirmDialog,

        // Derived
        baseDate, weekDates, today, weekLabel,
        todayAssignments,
        stats,

        // Helpers
        isRegistered,
        getAsgnsForSlot, getCoworkerAsgnsForSlot, getRegsForSlot,

        // Actions
        toggleRegistration,
        handleAssign,
        handleUpdateAssignment,
        handleRemoveAssignment: confirmRemoveAssignment,
        handleCopyRegs,
        handleAutoAssign,
        handleCopyAsgns,
    };
}
