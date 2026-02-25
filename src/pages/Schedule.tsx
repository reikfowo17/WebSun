import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScheduleService, getWeekDates } from '../services/schedule';
import type { ScheduleRegistration, ScheduleAssignment } from '../services/schedule';
import { SystemService } from '../services/system';
import type { StoreConfig, ShiftConfig } from '../services/system';
import type { User } from '../types';
import PortalHeader from '../components/PortalHeader';

interface ToastFn {
    success: (msg: string) => void;
    error: (msg: string) => void;
    info: (msg: string) => void;
    warning: (msg: string) => void;
}

interface ScheduleProps {
    user: User;
    toast: ToastFn;
}

type EmpTab = 'REGISTER' | 'MY_SCHEDULE';

const DAY_NAMES = ['THỨ 2', 'THỨ 3', 'THỨ 4', 'THỨ 5', 'THỨ 6', 'THỨ 7', 'CN'];
const DAY_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];

const SHIFT_ICONS: Record<string, string> = { wb_sunny: 'wb_sunny', wb_twilight: 'wb_twilight', nights_stay: 'nights_stay', dark_mode: 'nights_stay' };

const SHIFT_STYLES: Record<number, { accent: string; cardBg: string; cardBgD: string; cardText: string; cardTextD: string; cardBorder: string; cardBorderD: string; iconColor: string }> = {
    1: { accent: 'border-l-amber-400', cardBg: 'bg-amber-50', cardBgD: 'dark:bg-amber-900/10', cardText: 'text-amber-900', cardTextD: 'dark:text-amber-200', cardBorder: 'border-amber-100', cardBorderD: 'dark:border-amber-900/20', iconColor: 'text-amber-500' },
    2: { accent: 'border-l-rose-400', cardBg: 'bg-rose-50', cardBgD: 'dark:bg-rose-900/10', cardText: 'text-rose-900', cardTextD: 'dark:text-rose-200', cardBorder: 'border-rose-100', cardBorderD: 'dark:border-rose-900/20', iconColor: 'text-rose-500' },
    3: { accent: 'border-l-indigo-400', cardBg: 'bg-indigo-50', cardBgD: 'dark:bg-indigo-900/10', cardText: 'text-indigo-900', cardTextD: 'dark:text-indigo-200', cardBorder: 'border-indigo-100', cardBorderD: 'dark:border-indigo-900/20', iconColor: 'text-indigo-500' },
};

function getShiftStyle(sId: number) {
    return SHIFT_STYLES[sId] || SHIFT_STYLES[((sId - 1) % 3) + 1] || SHIFT_STYLES[1];
}

function formatDateShort(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getDate()}/${d.getMonth() + 1}`;
}

function todayStr(): string {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

const Schedule: React.FC<ScheduleProps> = ({ user, toast }) => {
    const navigate = useNavigate();
    const isAdmin = user.role === 'ADMIN';

    // State
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

    const baseDate = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() + weekOffset * 7);
        return d;
    }, [weekOffset]);

    const weekDates = useMemo(() => getWeekDates(baseDate), [baseDate]);
    const today = todayStr();
    const weekLabel = useMemo(() => `${formatDateShort(weekDates[0])} — ${formatDateShort(weekDates[6])}`, [weekDates]);

    // Organized shifts: main + their children
    const shiftTree = useMemo(() => {
        const mainShifts = shifts.filter(s => (s.type || 'MAIN') === 'MAIN');
        const supportShifts = shifts.filter(s => s.type === 'SUPPORT');
        return mainShifts.map(m => ({
            main: m,
            supports: supportShifts.filter(s => s.parent_id === m.id),
        }));
    }, [shifts]);

    const allShiftIds = useMemo(() => shifts.map(s => s.id), [shifts]);

    // Load stores + shifts
    useEffect(() => {
        (async () => {
            const [s, sh] = await Promise.all([SystemService.getStores(), SystemService.getShifts()]);
            setStores(s.filter(st => st.is_active !== false));
            const resolvedShifts = sh.length > 0 ? sh : [
                { id: 1, name: 'Ca 1', time: '06:00 - 14:00', icon: 'wb_sunny', color: '#fbbf24', type: 'MAIN' as const },
                { id: 2, name: 'Ca 2', time: '14:00 - 22:00', icon: 'wb_twilight', color: '#f43f5e', type: 'MAIN' as const },
                { id: 3, name: 'Ca 3', time: '22:00 - 06:00', icon: 'nights_stay', color: '#6366f1', type: 'MAIN' as const },
            ];
            setShifts(resolvedShifts);
            if (s.length > 0 && !selectedStore) setSelectedStore(s[0].id);
        })();
    }, []);

    useEffect(() => {
        if (isAdmin) ScheduleService.getAllEmployees().then(setEmployees);
    }, [isAdmin]);

    const loadData = useCallback(async () => {
        if (!selectedStore) return;
        setLoading(true);
        try {
            if (isAdmin) {
                const data = await ScheduleService.getWeekSchedule(baseDate, selectedStore);
                setRegistrations(data.registrations);
                setAssignments(data.assignments);
            } else {
                const [regs, asgns] = await Promise.all([
                    ScheduleService.getMyRegistrations(baseDate, selectedStore),
                    ScheduleService.getMyAssignments(baseDate),
                ]);
                setRegistrations(regs);
                setAssignments(asgns);
            }
        } catch {
            toast.error('Lỗi tải lịch làm');
        } finally {
            setLoading(false);
        }
    }, [baseDate, selectedStore, isAdmin, toast]);

    useEffect(() => { loadData(); }, [loadData]);

    // Employee: toggle registration
    const toggleRegistration = async (date: string, shift: number) => {
        const existing = registrations.find(r => r.work_date === date && r.shift === shift && r.store_id === selectedStore);
        setProcessing(`${date}-${shift}`);
        try {
            if (existing) {
                const r = await ScheduleService.cancelRegistration(existing.id);
                r.success ? toast.info('Đã hủy đăng ký') : toast.error(r.message || 'Lỗi');
            } else {
                const r = await ScheduleService.registerAvailability(selectedStore, date, shift);
                r.success ? toast.success('Đã đăng ký') : toast.error(r.message || 'Lỗi');
            }
            loadData();
        } catch {
            toast.error('Lỗi hệ thống');
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
            r.success ? toast.success('Đã xếp lịch') : toast.error(r.message || 'Lỗi');
            if (assignPopup) setAssignPopup(null);
            loadData();
        } catch {
            toast.error('Lỗi hệ thống');
        } finally {
            setProcessing(null);
        }
    };

    // Admin: remove assignment
    const handleRemoveAssignment = async (aId: string) => {
        setProcessing('remove-' + aId);
        try {
            const r = await ScheduleService.removeAssignment(aId);
            r.success ? toast.success('Đã xóa') : toast.error(r.message || 'Lỗi');
            loadData();
        } catch {
            toast.error('Lỗi hệ thống');
        } finally {
            setProcessing(null);
        }
    };

    const handleCopyRegs = async () => {
        setProcessing('copy-regs');
        try {
            const r = await ScheduleService.copyPreviousWeekRegistrations(baseDate, selectedStore);
            r.success ? toast.success(r.message!) : toast.warning(r.message!);
            loadData();
        } catch {
            toast.error('Lỗi hệ thống');
        } finally {
            setProcessing(null);
        }
    };

    const handleCopyAsgns = async () => {
        setProcessing('copy-asgns');
        try {
            const r = await ScheduleService.copyPreviousWeekAssignments(baseDate, selectedStore);
            r.success ? toast.success(r.message!) : toast.warning(r.message!);
            loadData();
        } catch {
            toast.error('Lỗi hệ thống');
        } finally {
            setProcessing(null);
        }
    };

    const handleAutoAssign = async () => {
        setProcessing('auto-assign');
        try {
            const r = await ScheduleService.autoAssignShifts(baseDate, selectedStore);
            r.success ? toast.success(r.message!) : toast.warning(r.message!);
            loadData();
        } catch {
            toast.error('Lỗi hệ thống');
        } finally {
            setProcessing(null);
        }
    };

    // Helpers
    const getRegsForSlot = (date: string, shift: number) => registrations.filter(r => r.work_date === date && r.shift === shift);
    const getAsgnsForSlot = (date: string, shift: number) => assignments.filter(a => a.work_date === date && a.shift === shift);
    const isRegistered = (date: string, shift: number) => registrations.some(r => r.work_date === date && r.shift === shift);
    const isAssignedSlot = (date: string, shift: number) => assignments.some(a => a.work_date === date && a.shift === shift);

    // Stats
    const totalSlots = allShiftIds.length * 7;
    const filledSlots = new Set(assignments.map(a => `${a.work_date}-${a.shift}`)).size;
    const fillRate = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;
    const emptySlots = totalSlots - filledSlots;
    const totalHours = assignments.length * 8;
    const regCount = new Set(registrations.map(r => `${r.work_date}-${r.shift}`)).size;

    // ═══════════════════════════════════════════════
    // RENDER: Shift Row (reusable for both MAIN + SUPPORT)
    // ═══════════════════════════════════════════════
    const renderShiftRow = (shiftCfg: ShiftConfig, isSupport: boolean) => {
        const sId = shiftCfg.id;
        const style = getShiftStyle(shiftCfg.parent_id || sId);
        const isEmpRegisterTab = !isAdmin && empTab === 'REGISTER';
        const isEmpScheduleTab = !isAdmin && empTab === 'MY_SCHEDULE';

        return (
            <tr key={sId} className={isSupport ? 'bg-gray-50/30 dark:bg-gray-800/10' : ''}>
                {/* Shift label */}
                <td className={`p-3 border-r border-gray-100 dark:border-gray-800 border-l-[3px] ${isSupport ? 'border-l-transparent' : style.accent}`}>
                    <div className={`flex items-center gap-2 ${isSupport ? 'pl-4' : ''}`}>
                        {isSupport ? (
                            <span className="material-symbols-outlined text-lg text-gray-400">subdirectory_arrow_right</span>
                        ) : (
                            <span className={`material-symbols-outlined text-xl ${style.iconColor}`}>{SHIFT_ICONS[shiftCfg.icon] || shiftCfg.icon || 'schedule'}</span>
                        )}
                        <div>
                            <p className={`font-bold flex items-center gap-1.5 ${isSupport ? 'text-xs text-gray-600 dark:text-gray-400' : 'text-sm text-gray-900 dark:text-white'}`}>
                                {shiftCfg.name}
                                {shiftCfg.max_slots ? (
                                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${isSupport ? 'bg-gray-100 dark:bg-gray-800' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`} title="Số slot tối đa">
                                        {shiftCfg.max_slots} slots
                                    </span>
                                ) : null}
                            </p>
                            <p className="text-[10px] text-gray-400 font-semibold tracking-tight">{shiftCfg.time}</p>
                        </div>
                    </div>
                </td>

                {/* Day cells */}
                {weekDates.map(date => {
                    const slotRegs = getRegsForSlot(date, sId);
                    const slotAsgns = getAsgnsForSlot(date, sId);
                    const reg = isRegistered(date, sId);
                    const asgn = isAssignedSlot(date, sId);
                    const proc = processing === `${date}-${sId}`;
                    const isPast = date < today;
                    const isTodayCol = date === today;
                    const todayBg = isTodayCol ? 'bg-indigo-50/20 dark:bg-indigo-900/5' : '';

                    // ── ADMIN VIEW ──
                    if (isAdmin) {
                        return (
                            <td key={`${date}-${sId}`} className={`p-2 border-r border-gray-100 dark:border-gray-800 last:border-r-0 align-top group ${isPast ? 'opacity-40' : ''} ${todayBg}`}>
                                <div className="flex flex-col gap-1.5 min-h-[70px]">
                                    {slotAsgns.map(a => (
                                        <div key={a.id} className={`p-1.5 ${style.cardBg} ${style.cardBgD} rounded-lg border ${style.cardBorder} ${style.cardBorderD} text-xs shadow-sm flex items-center gap-1`}>
                                            <span className={`font-bold ${style.cardText} ${style.cardTextD} flex-1 truncate`}>{a.user_name}</span>
                                            <button onClick={() => handleRemoveAssignment(a.id)} disabled={processing === 'remove-' + a.id} className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50" aria-label={`Xóa ${a.user_name}`}>
                                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                                            </button>
                                        </div>
                                    ))}
                                    {slotRegs.filter(r => !slotAsgns.some(a => a.user_id === r.user_id)).map(r => (
                                        <div key={r.id} onClick={() => handleAssign(r.user_id, date, sId)} className="p-1 bg-emerald-50 dark:bg-emerald-900/10 rounded-md border border-emerald-200 dark:border-emerald-800/30 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/20 transition-colors flex items-center gap-1" title={`Xếp ${r.user_name}`}>
                                            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>person_add</span>
                                            <span className="truncate">{r.user_name}</span>
                                        </div>
                                    ))}
                                    {!isPast && (
                                        <button onClick={() => setAssignPopup({ date, shift: sId })} className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-7 h-7 rounded-full border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-300 hover:border-indigo-400 hover:text-indigo-500 transition-all mx-auto mt-auto" aria-label="Thêm">
                                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
                                        </button>
                                    )}
                                </div>
                            </td>
                        );
                    }

                    // ── EMPLOYEE: REGISTER TAB ──
                    if (isEmpRegisterTab) {
                        return (
                            <td key={`${date}-${sId}`} onClick={() => !isPast && !proc && toggleRegistration(date, sId)} className={`p-2 border-r border-gray-100 dark:border-gray-800 last:border-r-0 text-center align-middle transition-colors ${isPast ? 'opacity-40' : 'cursor-pointer hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10'} ${todayBg}`}>
                                <div className="flex items-center justify-center min-h-[50px]">
                                    {proc ? (
                                        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                    ) : reg ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[11px] font-bold">
                                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span>
                                            Đã ĐK
                                        </span>
                                    ) : !isPast ? (
                                        <span className="w-7 h-7 rounded-full border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 hover:border-indigo-400 hover:text-indigo-500 transition-all flex items-center justify-center">
                                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
                                        </span>
                                    ) : null}
                                </div>
                            </td>
                        );
                    }

                    // ── EMPLOYEE: MY SCHEDULE TAB ──
                    return (
                        <td key={`${date}-${sId}`} className={`p-2 border-r border-gray-100 dark:border-gray-800 last:border-r-0 text-center align-middle ${isPast ? 'opacity-40' : ''} ${todayBg}`}>
                            <div className="flex items-center justify-center min-h-[50px]">
                                {asgn ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold">
                                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>verified</span>
                                        {shiftCfg.time}
                                    </span>
                                ) : (
                                    <span className="text-gray-300 dark:text-gray-700">—</span>
                                )}
                            </div>
                        </td>
                    );
                })}
            </tr>
        );
    };

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-[#0a0a0a]">
            {/* PortalHeader */}
            <PortalHeader>
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/')} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
                        <span className="material-symbols-outlined text-indigo-500">calendar_month</span>
                        <span>{isAdmin ? 'Xếp Lịch' : 'Lịch Làm'}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-sm font-medium text-gray-600 dark:text-gray-300">
                        <span className="material-symbols-outlined text-lg">storefront</span>
                        <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)} className="bg-transparent border-none text-sm font-semibold text-gray-700 dark:text-gray-200 outline-none cursor-pointer appearance-none pr-4">
                            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                </div>
            </PortalHeader>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 lg:p-6">
                <div className="max-w-7xl mx-auto space-y-5">

                    {/* Row 1: Tabs (Employee) or nothing (Admin) + Week Nav */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Left: Employee Tabs or Shift Legend */}
                        {!isAdmin ? (
                            <div className="flex items-center bg-white dark:bg-[#1a1a1a] p-1.5 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800">
                                <div className="flex p-1 bg-gray-100 dark:bg-[#0a0a0a] rounded-xl w-full">
                                    <button
                                        onClick={() => setEmpTab('REGISTER')}
                                        className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm whitespace-nowrap transition-all flex-1 ${empTab === 'REGISTER'
                                            ? 'bg-white dark:bg-[#1a1a1a] shadow-sm text-indigo-600 dark:text-indigo-400 font-bold'
                                            : 'text-gray-500 dark:text-gray-400 font-medium hover:text-gray-700 dark:hover:text-gray-200'
                                            }`}
                                    >
                                        <span className="material-symbols-outlined text-lg">edit_calendar</span>
                                        Đăng Ký Ca
                                    </button>
                                    <button
                                        onClick={() => setEmpTab('MY_SCHEDULE')}
                                        className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm whitespace-nowrap transition-all flex-1 ${empTab === 'MY_SCHEDULE'
                                            ? 'bg-white dark:bg-[#1a1a1a] shadow-sm text-emerald-600 dark:text-emerald-400 font-bold'
                                            : 'text-gray-500 dark:text-gray-400 font-medium hover:text-gray-700 dark:hover:text-gray-200'
                                            }`}
                                    >
                                        <span className="material-symbols-outlined text-lg">event_available</span>
                                        Lịch Của Tôi
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Admin: shift legend */
                            <div className="flex items-center bg-white dark:bg-[#1a1a1a] p-2 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 gap-2 overflow-x-auto hide-scrollbar">
                                {shiftTree.map(({ main, supports }) => {
                                    const st = getShiftStyle(main.id);
                                    return (
                                        <React.Fragment key={main.id}>
                                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${st.cardBg} ${st.cardBgD} border ${st.cardBorder} ${st.cardBorderD} text-[11px] font-semibold ${st.cardText} ${st.cardTextD} whitespace-nowrap`}>
                                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{SHIFT_ICONS[main.icon] || main.icon || 'schedule'}</span>
                                                {main.name}
                                            </div>
                                            {supports.map(s => (
                                                <div key={s.id} className="flex items-center gap-1 px-2 py-1 rounded border border-dashed border-gray-300 dark:border-gray-600 text-[10px] font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>subdirectory_arrow_right</span>
                                                    {s.name}
                                                </div>
                                            ))}
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        )}

                        {/* Right: Actions + Week Navigator */}
                        <div className="flex flex-col xl:flex-row xl:items-center justify-end gap-3">
                            {/* Actions Toolbar */}
                            <div className="flex items-center gap-2">
                                {isAdmin ? (
                                    <>
                                        <button onClick={handleAutoAssign} disabled={!!processing} className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/10 hover:bg-indigo-100 dark:hover:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-sm font-bold rounded-xl transition-colors disabled:opacity-50">
                                            {processing === 'auto-assign' ? <span className="material-symbols-outlined text-[18px] animate-spin">hourglass_empty</span> : <span className="material-symbols-outlined text-[18px]">auto_awesome</span>}
                                            Tự Xếp Lịch
                                        </button>
                                        <button onClick={handleCopyAsgns} disabled={!!processing} className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-bold rounded-xl transition-colors disabled:opacity-50" title="Sao chép lịch tuần trước">
                                            {processing === 'copy-asgns' ? <span className="material-symbols-outlined text-[18px] animate-spin">hourglass_empty</span> : <span className="material-symbols-outlined text-[18px]">content_copy</span>}
                                            <span className="hidden sm:inline">Copy Tuần Trước</span>
                                        </button>
                                    </>
                                ) : (
                                    empTab === 'REGISTER' && (
                                        <button onClick={handleCopyRegs} disabled={!!processing} className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/10 hover:bg-indigo-100 dark:hover:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-sm font-bold rounded-xl transition-colors disabled:opacity-50" title="Sao chép ca rảnh tuần trước">
                                            {processing === 'copy-regs' ? <span className="material-symbols-outlined text-[18px] animate-spin">hourglass_empty</span> : <span className="material-symbols-outlined text-[18px]">content_copy</span>}
                                            <span className="hidden sm:inline">Copy Lịch Rảnh Trái</span>
                                        </button>
                                    )
                                )}
                            </div>

                            {/* Week Navigator */}
                            <div className="flex items-center justify-between gap-3 bg-white dark:bg-[#1a1a1a] p-1.5 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 min-w-max">
                                <div className="flex p-1 bg-gray-100 dark:bg-[#0a0a0a] rounded-xl items-center gap-1">
                                    <button onClick={() => setWeekOffset(w => w - 1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-[#1a1a1a] text-gray-500 dark:text-gray-400 transition-all hover:shadow-sm" aria-label="Tuần trước">
                                        <span className="material-symbols-outlined text-lg">chevron_left</span>
                                    </button>
                                    <button onClick={() => setWeekOffset(w => w + 1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-[#1a1a1a] text-gray-500 dark:text-gray-400 transition-all hover:shadow-sm" aria-label="Tuần sau">
                                        <span className="material-symbols-outlined text-lg">chevron_right</span>
                                    </button>
                                </div>
                                <span className="text-sm font-bold text-gray-900 dark:text-white whitespace-nowrap px-1">{weekLabel}</span>
                                <button onClick={() => setWeekOffset(0)} className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${weekOffset === 0 ? 'bg-indigo-500 text-white shadow-sm shadow-indigo-500/20' : 'bg-gray-100 dark:bg-[#0a0a0a] text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800'}`}>
                                    Hôm nay
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Employee info bar (context for current tab) */}
                    {!isAdmin && (
                        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${empTab === 'REGISTER'
                            ? 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-800/30 text-indigo-700 dark:text-indigo-400'
                            : 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/30 text-emerald-700 dark:text-emerald-400'
                            }`}>
                            <span className="material-symbols-outlined text-lg">
                                {empTab === 'REGISTER' ? 'info' : 'event_available'}
                            </span>
                            {empTab === 'REGISTER'
                                ? `Nhấn vào ô trống để đăng ký ca rảnh. Đã đăng ký ${regCount} ca tuần này.`
                                : `Lịch làm chính thức đã được xếp bởi quản lý. Bạn có ${assignments.length} ca tuần này.`
                            }
                        </div>
                    )}

                    {/* Calendar Grid */}
                    <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                <p className="text-sm font-medium text-gray-500">Đang tải lịch làm...</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full">
                                    <thead className="bg-gray-50/50 dark:bg-[#111]">
                                        <tr>
                                            <th className="p-4 border-r border-gray-100 dark:border-gray-800 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-left w-[150px]">
                                                Ca Làm Việc
                                            </th>
                                            {weekDates.map((d, i) => {
                                                const isToday = d === today;
                                                const dayNum = new Date(d + 'T00:00:00').getDate();
                                                return (
                                                    <th key={d} className={`p-3 text-center border-r border-gray-100 dark:border-gray-800 last:border-r-0 ${isToday ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}>
                                                        <p className={`text-[10px] font-bold mb-1 uppercase tracking-wide ${isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`}>
                                                            {DAY_NAMES[i]}
                                                        </p>
                                                        {isToday ? (
                                                            <span className="inline-flex w-8 h-8 items-center justify-center bg-indigo-500 text-white rounded-full text-sm font-bold shadow-md shadow-indigo-500/30">
                                                                {dayNum}
                                                            </span>
                                                        ) : (
                                                            <p className="text-base font-bold text-gray-900 dark:text-white">{formatDateShort(d)}</p>
                                                        )}
                                                    </th>
                                                );
                                            })}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {shiftTree.map(({ main, supports }) => (
                                            <React.Fragment key={main.id}>
                                                {renderShiftRow(main, false)}
                                                {supports.map(s => renderShiftRow(s, true))}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Stats Cards */}
                    {isAdmin && !loading && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="relative overflow-hidden bg-white dark:bg-[#1a1a1a] p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                    <span className="material-symbols-outlined">task_alt</span>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Tỷ lệ phân bổ</p>
                                    <p className="text-2xl font-extrabold text-gray-900 dark:text-white">{fillRate}%</p>
                                </div>
                                <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-emerald-100 dark:bg-emerald-900/20 rounded-full opacity-20" />
                            </div>
                            <div className="relative overflow-hidden bg-white dark:bg-[#1a1a1a] p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                                    <span className="material-symbols-outlined">person_outline</span>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Ca trống</p>
                                    <p className="text-2xl font-extrabold text-gray-900 dark:text-white">{String(emptySlots).padStart(2, '0')} ca</p>
                                </div>
                                <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-amber-100 dark:bg-amber-900/20 rounded-full opacity-20" />
                            </div>
                            <div className="relative overflow-hidden bg-white dark:bg-[#1a1a1a] p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                                    <span className="material-symbols-outlined">schedule</span>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Tổng giờ công dự kiến</p>
                                    <p className="text-2xl font-extrabold text-gray-900 dark:text-white">{totalHours} giờ</p>
                                </div>
                                <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-indigo-100 dark:bg-indigo-900/20 rounded-full opacity-20" />
                            </div>
                        </div>
                    )}

                    {/* Employee stats summary */}
                    {!isAdmin && !loading && empTab === 'MY_SCHEDULE' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white dark:bg-[#1a1a1a] p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-xl">event_available</span>
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Ca được xếp</p>
                                    <p className="text-xl font-extrabold text-gray-900 dark:text-white">{assignments.length} ca</p>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-[#1a1a1a] p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-xl">schedule</span>
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Giờ công tuần này</p>
                                    <p className="text-xl font-extrabold text-gray-900 dark:text-white">{assignments.length * 8} giờ</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Admin Assign Popup */}
            {assignPopup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setAssignPopup(null)} />
                    <div className="relative bg-white dark:bg-[#1a1a1a] rounded-2xl w-full max-w-sm shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden max-h-[80vh] flex flex-col">
                        <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg flex items-center justify-center">
                                        <span className="material-symbols-outlined text-lg">person_add</span>
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Xếp nhân viên</h3>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {DAY_LABELS[weekDates.indexOf(assignPopup.date)]} {formatDateShort(assignPopup.date)} — {shifts.find(s => s.id === assignPopup.shift)?.name || `Ca ${assignPopup.shift}`}
                                </p>
                            </div>
                            <button onClick={() => setAssignPopup(null)} className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center text-gray-400 transition-colors" aria-label="Đóng">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1 p-4 space-y-4">
                            {/* Already assigned */}
                            {getAsgnsForSlot(assignPopup.date, assignPopup.shift).length > 0 && (
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Đã xếp</p>
                                    {getAsgnsForSlot(assignPopup.date, assignPopup.shift).map(a => (
                                        <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 mb-1.5">
                                            <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0">{(a.user_name || '?')[0]}</div>
                                            <span className="text-sm font-semibold text-gray-900 dark:text-white flex-1">{a.user_name}</span>
                                            <button onClick={() => handleRemoveAssignment(a.id)} disabled={processing === 'remove-' + a.id} className="text-red-400 hover:text-red-600 transition-colors disabled:opacity-50">
                                                <span className="material-symbols-outlined text-lg">remove_circle</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Registered */}
                            {(() => {
                                const availRegs = getRegsForSlot(assignPopup.date, assignPopup.shift)
                                    .filter(r => !getAsgnsForSlot(assignPopup.date, assignPopup.shift).some(a => a.user_id === r.user_id));
                                return availRegs.length > 0 && (
                                    <div>
                                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-2 flex items-center gap-1">
                                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>how_to_reg</span>
                                            Đã đăng ký ({availRegs.length})
                                        </p>
                                        {availRegs.map(r => (
                                            <div key={r.id} onClick={() => handleAssign(r.user_id)} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors mb-1.5">
                                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0">{(r.user_name || '?')[0]}</div>
                                                <span className="text-sm font-medium text-gray-900 dark:text-white flex-1">{r.user_name}</span>
                                                <span className="material-symbols-outlined text-emerald-500 text-lg">add_circle</span>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}

                            {/* All employees */}
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Tất cả nhân viên</p>
                                {employees
                                    .filter(e => !getAsgnsForSlot(assignPopup.date, assignPopup.shift).some(a => a.user_id === e.id))
                                    .map(emp => {
                                        const hasReg = getRegsForSlot(assignPopup.date, assignPopup.shift).some(r => r.user_id === emp.id);
                                        return (
                                            <div key={emp.id} onClick={() => handleAssign(emp.id)} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors mb-1">
                                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-500 text-white flex items-center justify-center text-xs font-bold shrink-0">{(emp.name || '?')[0]}</div>
                                                <span className="text-sm font-medium text-gray-900 dark:text-white flex-1">{emp.name}</span>
                                                {hasReg && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-md">Đã ĐK</span>}
                                                <span className="material-symbols-outlined text-gray-300 dark:text-gray-600 text-lg">add</span>
                                            </div>
                                        );
                                    })}
                                {employees.length === 0 && (
                                    <div className="py-8 text-center">
                                        <div className="w-12 h-12 bg-gray-50 dark:bg-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-3">
                                            <span className="material-symbols-outlined text-2xl text-gray-400">group</span>
                                        </div>
                                        <p className="text-sm font-medium text-gray-500">Không có nhân viên</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Schedule;
