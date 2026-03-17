import React, { useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User } from '../../types';
import type { StoreShift, AssignmentTag } from '../../services/schedule';
import PortalHeader from '../../components/PortalHeader';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useSchedule, formatDateShort, DAY_LABELS, TAG_CONFIG } from '../../hooks/useSchedule';
import type { ToastFn, EmpTab } from '../../hooks/useSchedule';
import AssignPopup from './AssignPopup';

interface ScheduleProps { user: User; toast: ToastFn; }

const SHIFT_ICONS: Record<string, string> = {
    wb_sunny: 'wb_sunny', wb_twilight: 'wb_twilight', dark_mode: 'dark_mode',
    nights_stay: 'dark_mode', inventory_2: 'inventory_2', local_shipping: 'local_shipping',
};

/* Store banner colors */
const STORE_COLORS = [
    { bg: 'linear-gradient(135deg, #1565C0, #0D47A1)', light: '#E3F2FD', accent: '#1565C0' },
    { bg: 'linear-gradient(135deg, #C62828, #B71C1C)', light: '#FFEBEE', accent: '#C62828' },
    { bg: 'linear-gradient(135deg, #2E7D32, #1B5E20)', light: '#E8F5E9', accent: '#2E7D32' },
    { bg: 'linear-gradient(135deg, #E65100, #BF360C)', light: '#FFF3E0', accent: '#E65100' },
    { bg: 'linear-gradient(135deg, #6A1B9A, #4A148C)', light: '#F3E5F5', accent: '#6A1B9A' },
    { bg: 'linear-gradient(135deg, #00838F, #006064)', light: '#E0F7FA', accent: '#00838F' },
    { bg: 'linear-gradient(135deg, #4E342E, #3E2723)', light: '#EFEBE9', accent: '#4E342E' },
    { bg: 'linear-gradient(135deg, #37474F, #263238)', light: '#ECEFF1', accent: '#37474F' },
];

function groupShifts(shifts: StoreShift[]): { main: StoreShift; supports: StoreShift[] }[] {
    const mains = shifts.filter(s => s.type === 'MAIN').sort((a, b) => a.sort_order - b.sort_order);
    const sups = shifts.filter(s => s.type === 'SUPPORT');
    const result = mains.map(m => ({ main: m, supports: sups.filter(s => s.parent_id === m.id).sort((a, b) => a.sort_order - b.sort_order) }));
    const orphanSups = sups.filter(s => !mains.some(m => m.id === s.parent_id));
    if (orphanSups.length > 0) result.push(...orphanSups.map(s => ({ main: s, supports: [] })));
    return result;
}

const SkeletonTable = () => (
    <div className="p-4 space-y-3 animate-pulse">
        {Array.from({ length: 4 }).map((_, r) => (
            <div key={r} className="flex gap-2">
                <div className="w-[100px] h-10 bg-gray-200 dark:bg-gray-800/30 rounded shrink-0" />
                {Array.from({ length: 7 }).map((_, c) => <div key={c} className="flex-1 h-10 bg-gray-100 dark:bg-gray-800/20 rounded" />)}
            </div>
        ))}
    </div>
);

const Schedule: React.FC<ScheduleProps> = ({ user, toast }) => {
    const navigate = useNavigate();
    const isAdmin = user.role === 'ADMIN';
    const s = useSchedule(isAdmin, toast);

    const todayShiftCards = useMemo(() => {
        if (isAdmin) return [];
        return s.todayAssignments.map(a => {
            const sh = (s.storeShiftsMap.get(a.store_id) || []).find(ss => ss.id === a.shift);
            return { assignment: a, shift: sh };
        });
    }, [s.todayAssignments, s.storeShiftsMap, isAdmin]);

    /* ── Shift label cell (used on both left & right) ── */
    const ShiftLabel = ({ sh, isSupport, side }: { sh: StoreShift; isSupport: boolean; side: 'left' | 'right' }) => (
        <td className={`px-2 py-2 ${side === 'left' ? 'border-r' : 'border-l'} border-gray-200 dark:border-gray-700 whitespace-nowrap ${side === 'left' ? 'text-left' : 'text-right'} ${isSupport ? 'bg-blue-50/40 dark:bg-blue-900/5' : 'bg-amber-50/30 dark:bg-amber-900/5'}`}
            style={{ minWidth: 130, maxWidth: 160 }}>
            <div className={`flex items-center gap-1 ${side === 'right' ? 'flex-row-reverse' : ''} ${isSupport ? 'pl-2' : ''}`}>
                {isSupport && side === 'left' && <span className="text-blue-300 text-[10px]">↳</span>}
                <span className={`material-symbols-outlined ${isSupport ? 'text-blue-400' : 'text-amber-500'}`} style={{ fontSize: 14 }}>
                    {SHIFT_ICONS[sh.icon] || sh.icon || 'schedule'}
                </span>
                <div className={side === 'right' ? 'text-right' : ''}>
                    <p className={`leading-tight ${isSupport ? 'text-[10px] font-semibold text-gray-500' : 'text-[11px] font-bold text-gray-800 dark:text-gray-200'}`}>{sh.name}</p>
                    <p className="text-[9px] text-gray-400 font-semibold">{sh.time_start}-{sh.time_end}</p>
                </div>
                {isSupport && side === 'right' && <span className="text-blue-300 text-[10px]">↲</span>}
            </div>
        </td>
    );

    /* ═══ ADMIN: Full schedule table (all stores stacked) ═══ */
    const renderFullSchedule = useCallback(() => {
        return (
            <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700" style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                        {/* Title & date headers */}
                        <thead className="sticky top-0 z-20">
                            <tr>
                                <th colSpan={9} className="py-3 text-center text-base font-black text-gray-900 dark:text-white tracking-wide bg-gray-50 dark:bg-[#111] border-b border-gray-200 dark:border-gray-700">
                                    <span className="material-symbols-outlined text-amber-500 align-middle mr-1" style={{ fontSize: 20 }}>calendar_month</span>
                                    LỊCH LÀM TỔNG
                                </th>
                            </tr>
                            <tr className="bg-gray-50 dark:bg-[#111]">
                                <th className="p-2 border-r border-b border-gray-200 dark:border-gray-700 text-[10px] font-bold text-gray-500 uppercase text-center" style={{ width: 140 }}>Sunmart</th>
                                {s.weekDates.map((d, i) => {
                                    const isToday = d === s.today;
                                    const dt = new Date(d + 'T00:00:00');
                                    return (
                                        <th key={d} className={`p-1.5 border-r border-b border-gray-200 dark:border-gray-700 text-center last:border-r-0 ${isToday ? 'bg-indigo-100/60 dark:bg-indigo-900/15' : ''}`}>
                                            <p className="text-[9px] text-gray-400 font-semibold">{`${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`}</p>
                                            <p className={`text-[11px] font-bold ${isToday ? 'text-indigo-600' : 'text-gray-700 dark:text-gray-300'}`}>{DAY_LABELS[i] === 'CN' ? 'Chủ Nhật' : `Thứ ${DAY_LABELS[i].replace('T', '')}`}</p>
                                            {isToday && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mx-auto mt-0.5" />}
                                        </th>
                                    );
                                })}
                                <th className="p-2 border-l border-b border-gray-200 dark:border-gray-700 text-[10px] font-bold text-gray-500 uppercase text-center" style={{ width: 140 }}>Sunmart</th>
                            </tr>
                        </thead>
                        <tbody>
                            {s.stores.map((store, storeIdx) => {
                                const shifts = s.storeShiftsMap.get(store.id) || [];
                                const grouped = groupShifts(shifts);
                                const color = STORE_COLORS[storeIdx % STORE_COLORS.length];

                                return (
                                    <React.Fragment key={store.id}>
                                        {/* Store banner row */}
                                        <tr>
                                            <td colSpan={9} className="p-0">
                                                <div className="flex items-center justify-between px-3 py-2" style={{ background: color.bg }}>
                                                    <div className="flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-white/80" style={{ fontSize: 16 }}>storefront</span>
                                                        <span className="text-white font-black text-xs tracking-widest uppercase">
                                                            {'═══ ' + store.name + ' ═══'}
                                                        </span>
                                                        <span className="text-white/50 text-[10px] font-semibold">{shifts.length} ca</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button onClick={() => s.handleAutoAssign(store.id)} disabled={!!s.processing}
                                                            className="flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold text-white/90 bg-white/15 hover:bg-white/25 transition-colors disabled:opacity-50">
                                                            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>auto_awesome</span>Tự xếp
                                                        </button>
                                                        <button onClick={() => s.handleCopyAsgns(store.id)} disabled={!!s.processing}
                                                            className="flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold text-white/90 bg-white/15 hover:bg-white/25 transition-colors disabled:opacity-50">
                                                            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>content_copy</span>Copy
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>

                                        {/* Shift rows */}
                                        {grouped.map(({ main, supports }) => {
                                            const allShifts = [{ sh: main, isSupport: false }, ...supports.map(s => ({ sh: s, isSupport: true }))];
                                            return allShifts.map(({ sh, isSupport }) => (
                                                <tr key={sh.id} className={`border-b border-gray-100 dark:border-gray-800 ${isSupport ? 'bg-blue-50/20 dark:bg-blue-900/5' : ''} group/row hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors`}>
                                                    {/* Left shift label */}
                                                    <ShiftLabel sh={sh} isSupport={isSupport} side="left" />

                                                    {/* Day cells */}
                                                    {s.weekDates.map(date => {
                                                        const asgns = s.getAsgnsForSlot(store.id, date, sh.id);
                                                        const regs = s.getRegsForSlot(store.id, date, sh.id);
                                                        const isPast = date < s.today;
                                                        const isToday = date === s.today;
                                                        const pending = regs.filter(r => !asgns.some(a => a.user_id === r.user_id));

                                                        return (
                                                            <td key={`${date}-${sh.id}`}
                                                                className={`px-1 py-1 border-r border-gray-100 dark:border-gray-800 align-top text-center group ${isPast ? 'opacity-40' : ''} ${isToday ? 'bg-indigo-50/30 dark:bg-indigo-900/5' : ''}`}
                                                                style={{ minWidth: 100 }}>
                                                                {asgns.length === 0 && pending.length === 0 ? (
                                                                    /* Empty cell */
                                                                    <div className="min-h-[32px] flex items-center justify-center">
                                                                        {isPast ? (
                                                                            <span className="text-[10px] text-gray-300">x</span>
                                                                        ) : (
                                                                            <button onClick={() => s.setAssignPopup({ date, shift: sh.id, storeId: store.id })}
                                                                                className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded border border-dashed border-gray-300 dark:border-gray-600 text-gray-300 hover:border-indigo-400 hover:text-indigo-500 flex items-center justify-center transition-all">
                                                                                <span className="material-symbols-outlined" style={{ fontSize: 11 }}>add</span>
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <div className="space-y-0.5 min-h-[32px]">
                                                                        {/* Assigned employees */}
                                                                        {asgns.map(a => {
                                                                            const hasCustom = a.custom_start || a.custom_end;
                                                                            const customText = hasCustom
                                                                                ? ` (${a.custom_start ? `từ ${a.custom_start.replace(':00', 'h')}` : ''}${a.custom_end ? ` đến ${a.custom_end.replace(':00', 'h')}` : ''})`
                                                                                : '';
                                                                            return (
                                                                                <div key={a.id}
                                                                                    className={`relative text-[11px] font-semibold leading-tight py-0.5 px-1 rounded cursor-pointer transition-colors group/cell ${a.tag
                                                                                        ? '' : 'text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                                                                                    style={a.tag ? { color: TAG_CONFIG[a.tag].color, backgroundColor: `${TAG_CONFIG[a.tag].color}12` } : {}}
                                                                                    onClick={() => s.setAssignPopup({ date, shift: sh.id, storeId: store.id })}>
                                                                                    <span>{a.user_name}</span>
                                                                                    {customText && <span className="text-[9px] text-blue-500 dark:text-blue-400">{customText}</span>}
                                                                                    <button onClick={(e) => { e.stopPropagation(); s.handleRemoveAssignment(a.id, a.user_name); }}
                                                                                        className="absolute -top-0.5 -right-0.5 opacity-0 group-hover/cell:opacity-100 w-3.5 h-3.5 rounded-full bg-red-500 text-white flex items-center justify-center transition-all shadow-sm"
                                                                                        disabled={s.processing === 'remove-' + a.id}>
                                                                                        <span className="material-symbols-outlined" style={{ fontSize: 9 }}>close</span>
                                                                                    </button>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                        {/* Pending */}
                                                                        {pending.map(r => (
                                                                            <div key={r.id} onClick={() => s.handleAssign(r.user_id, store.id, date, sh.id)}
                                                                                className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 py-0.5 px-1 rounded border border-dashed border-emerald-300 cursor-pointer hover:bg-emerald-50 transition-colors leading-tight">
                                                                                +{r.user_name}
                                                                            </div>
                                                                        ))}
                                                                        {/* Add more */}
                                                                        {!isPast && (
                                                                            <button onClick={() => s.setAssignPopup({ date, shift: sh.id, storeId: store.id })}
                                                                                className="opacity-0 group-hover:opacity-60 w-full text-[9px] text-gray-400 hover:text-indigo-500 transition-all">
                                                                                + thêm
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </td>
                                                        );
                                                    })}

                                                    {/* Right shift label */}
                                                    <ShiftLabel sh={sh} isSupport={isSupport} side="right" />
                                                </tr>
                                            ));
                                        })}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }, [s, isAdmin]);

    /* ═══ ADMIN: Stats ═══ */
    const renderStats = useCallback(() => {
        const pending = s.registrations.filter(r => !s.assignments.some(a => a.user_id === r.user_id && a.work_date === r.work_date && a.shift === r.shift && a.store_id === r.store_id)).length;
        const cards = [
            { label: 'Tổng ca xếp', value: s.assignments.length, icon: 'event_available', color: '#10B981', bg: '#ECFDF5' },
            { label: 'Chờ duyệt', value: pending, icon: 'pending_actions', color: '#F59E0B', bg: '#FFFBEB' },
            { label: 'Cửa hàng', value: s.stores.length, icon: 'storefront', color: '#6366F1', bg: '#EEF2FF' },
        ];
        return (
            <div className="grid grid-cols-3 gap-3">
                {cards.map(c => (
                    <div key={c.label} className="bg-white dark:bg-[#1a1a1a] rounded-xl p-3 border border-gray-100 dark:border-gray-800 flex items-center gap-3" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.03)' }}>
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: c.bg }}>
                            <span className="material-symbols-outlined" style={{ color: c.color, fontSize: 20 }}>{c.icon}</span>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{c.label}</p>
                            <p className="text-xl font-bold text-gray-900 dark:text-white">{c.value}</p>
                        </div>
                    </div>
                ))}
            </div>
        );
    }, [s.assignments, s.registrations, s.stores]);

    /* ═══ EMPLOYEE: My Schedule Grid ═══ */
    const renderMySchedule = useCallback(() => {
        const shiftMap = new Map<number, StoreShift>();
        s.assignments.forEach(a => {
            if (shiftMap.has(a.shift)) return;
            const sh = (s.storeShiftsMap.get(a.store_id) || []).find(ss => ss.id === a.shift);
            if (sh) shiftMap.set(a.shift, sh);
        });
        const shifts = Array.from(shiftMap.values()).sort((a, b) => a.sort_order - b.sort_order);
        if (shifts.length === 0) return (
            <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-8 text-center">
                <span className="material-symbols-outlined text-3xl text-gray-300 mb-2">event_busy</span>
                <p className="text-sm text-gray-500">Tuần này chưa có ca nào được xếp cho bạn.</p>
            </div>
        );
        return (
            <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-gray-50/50 dark:bg-[#111]">
                            <tr>
                                <th className="p-3 border-r border-gray-100 dark:border-gray-800 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-left w-[130px]">Ca</th>
                                {s.weekDates.map((d, i) => {
                                    const isToday = d === s.today;
                                    const dayNum = new Date(d + 'T00:00:00').getDate();
                                    return (
                                        <th key={d} className={`p-2 text-center border-r border-gray-100 dark:border-gray-800 last:border-r-0 ${isToday ? 'bg-indigo-50/50' : ''}`}>
                                            <p className={`text-[10px] font-bold uppercase ${isToday ? 'text-indigo-600' : 'text-gray-400'}`}>{DAY_LABELS[i]}</p>
                                            {isToday ? <span className="inline-flex w-7 h-7 items-center justify-center bg-indigo-500 text-white rounded-full text-xs font-bold">{dayNum}</span>
                                                : <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{formatDateShort(d)}</p>}
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {shifts.map(sh => (
                                <tr key={sh.id}>
                                    <td className="p-2.5 border-r border-gray-100 dark:border-gray-800 border-l-[3px] border-l-amber-400">
                                        <div className="flex items-center gap-1.5">
                                            <span className="material-symbols-outlined text-base text-amber-500">{SHIFT_ICONS[sh.icon] || 'schedule'}</span>
                                            <div>
                                                <p className="text-xs font-bold text-gray-900 dark:text-white">{sh.name}</p>
                                                <p className="text-[10px] text-gray-400 font-semibold">{sh.time_start}-{sh.time_end}</p>
                                            </div>
                                        </div>
                                    </td>
                                    {s.weekDates.map(date => {
                                        const myAsgns = s.assignments.filter(a => a.work_date === date && a.shift === sh.id);
                                        const isPast = date < s.today;
                                        const isToday = date === s.today;
                                        return (
                                            <td key={`${date}-${sh.id}`} className={`p-1.5 border-r border-gray-100 dark:border-gray-800 last:border-r-0 align-top ${isPast ? 'opacity-40' : ''} ${isToday ? 'bg-indigo-50/20' : ''}`}>
                                                <div className="flex flex-col gap-1 min-h-[40px]">
                                                    {myAsgns.map(a => {
                                                        const coworkers = s.coworkerAssignments.filter(c => c.store_id === a.store_id && c.work_date === date && c.shift === a.shift && c.user_id !== a.user_id);
                                                        return (
                                                            <div key={a.id} className="px-1.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 text-emerald-900 dark:text-emerald-300">
                                                                <p className="flex items-center gap-1 truncate"><span className="material-symbols-outlined text-amber-500" style={{ fontSize: 10 }}>storefront</span>{a.store_name}</p>
                                                                {(a.custom_start || a.custom_end) && <p className="text-[9px] text-blue-500">{a.custom_start}-{a.custom_end}</p>}
                                                                {coworkers.length > 0 && <p className="text-[9px] text-gray-400 truncate">+{coworkers.length}: {coworkers.map(c => c.user_name).join(', ')}</p>}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }, [s]);

    /* ═══ EMPLOYEE: Registration Grid ═══ */
    const renderRegistrationGrid = useCallback(() => {
        const shifts = s.registrationShifts;
        if (shifts.length === 0) return (
            <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-8 text-center">
                <span className="material-symbols-outlined text-3xl text-gray-400 mb-2">info</span>
                <p className="text-sm text-gray-500">Bạn chưa được gán vào cửa hàng nào. Liên hệ admin.</p>
            </div>
        );
        return (
            <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-gray-50/50 dark:bg-[#111]">
                            <tr>
                                <th className="p-3 border-r border-gray-100 dark:border-gray-800 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-left w-[130px]">Ca</th>
                                {s.weekDates.map((d, i) => {
                                    const isToday = d === s.today;
                                    const dayNum = new Date(d + 'T00:00:00').getDate();
                                    return (
                                        <th key={d} className={`p-2 text-center border-r border-gray-100 dark:border-gray-800 last:border-r-0 ${isToday ? 'bg-indigo-50/50' : ''}`}>
                                            <p className={`text-[10px] font-bold uppercase ${isToday ? 'text-indigo-600' : 'text-gray-400'}`}>{DAY_LABELS[i]}</p>
                                            {isToday ? <span className="inline-flex w-7 h-7 items-center justify-center bg-indigo-500 text-white rounded-full text-xs font-bold">{dayNum}</span>
                                                : <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{formatDateShort(d)}</p>}
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {shifts.map(sh => (
                                <tr key={sh.id}>
                                    <td className="p-2.5 border-r border-gray-100 dark:border-gray-800 border-l-[3px] border-l-amber-400">
                                        <div className="flex items-center gap-1.5">
                                            <span className="material-symbols-outlined text-base text-amber-500">{SHIFT_ICONS[sh.icon] || 'schedule'}</span>
                                            <div>
                                                <p className="text-xs font-bold text-gray-900 dark:text-white">{sh.name}</p>
                                                <p className="text-[10px] text-gray-400 font-semibold">{sh.time_start}-{sh.time_end}</p>
                                            </div>
                                        </div>
                                    </td>
                                    {s.weekDates.map(date => {
                                        const reg = s.isRegistered(date, sh.id);
                                        const proc = s.processing === `${date}-${sh.id}`;
                                        const isPast = date < s.today;
                                        const isToday = date === s.today;
                                        return (
                                            <td key={`${date}-${sh.id}`} onClick={() => !isPast && !proc && s.toggleRegistration(date, sh.id)}
                                                className={`p-2 border-r border-gray-100 dark:border-gray-800 last:border-r-0 text-center align-middle ${isPast ? 'opacity-40' : 'cursor-pointer hover:bg-indigo-50/50'} ${isToday ? 'bg-indigo-50/20' : ''} transition-colors`}>
                                                <div className="flex items-center justify-center min-h-[40px]">
                                                    {proc ? <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                                        : reg ? <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-100 text-blue-700 text-[11px] font-bold"><span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span>Đã ĐK</span>
                                                            : !isPast ? <span className="w-7 h-7 rounded-full border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 hover:border-indigo-400 hover:text-indigo-500 transition-all"><span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span></span>
                                                                : null}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }, [s]);

    return (
        <div className="h-full flex flex-col dark:bg-[#0a0a0a]" style={{ background: '#F8F7F4' }}>
            <PortalHeader>
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/')} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
                        <span className="material-symbols-outlined text-amber-500">calendar_month</span>
                        {isAdmin ? 'Lịch Làm Tổng' : 'Lịch Làm'}
                    </div>
                </div>
                <div className="flex items-center gap-2 bg-white dark:bg-[#1a1a1a] p-1 rounded-xl" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.03)' }}>
                    <button onClick={() => s.setWeekOffset(w => w - 1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                        <span className="material-symbols-outlined text-lg">chevron_left</span>
                    </button>
                    <span className="text-sm font-bold text-gray-900 dark:text-white whitespace-nowrap px-1 min-w-[110px] text-center">{s.weekLabel}</span>
                    <button onClick={() => s.setWeekOffset(w => w + 1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                        <span className="material-symbols-outlined text-lg">chevron_right</span>
                    </button>
                    <button onClick={() => s.setWeekOffset(0)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${s.weekOffset === 0 ? 'text-gray-900 shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`} style={s.weekOffset === 0 ? { background: 'linear-gradient(180deg, #FACC15, #F59E0B)' } : {}}>
                        Nay
                    </button>
                </div>
            </PortalHeader>

            <div className="flex-1 overflow-y-auto p-4 lg:p-6">
                <div className="max-w-[1400px] mx-auto space-y-4">
                    {isAdmin && (
                        <>
                            {renderStats()}
                            {s.loading ? <SkeletonTable /> : renderFullSchedule()}
                        </>
                    )}

                    {!isAdmin && (
                        <>
                            {s.weekOffset === 0 && (
                                todayShiftCards.length > 0 ? (
                                    <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #1E3A5F 0%, #1a2f4e 100%)', boxShadow: '0 8px 24px rgba(30,58,95,0.25)' }}>
                                        <div className="px-5 pt-4 pb-3 flex items-center gap-3">
                                            <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center"><span className="material-symbols-outlined text-white text-xl">today</span></div>
                                            <div><p className="text-white/60 text-[11px] font-semibold uppercase tracking-widest">Hôm nay</p><p className="text-white font-bold text-base">{todayShiftCards.length} ca làm</p></div>
                                        </div>
                                        <div className="px-4 pb-4 flex flex-wrap gap-2">
                                            {todayShiftCards.map(({ assignment: a, shift: sh }) => (
                                                <div key={a.id} className="flex items-center gap-2.5 bg-white/10 backdrop-blur-sm rounded-xl px-3.5 py-2.5 border border-white/15">
                                                    <span className="material-symbols-outlined text-lg text-amber-400">{sh ? (SHIFT_ICONS[sh.icon] || 'schedule') : 'schedule'}</span>
                                                    <div><p className="text-white font-bold text-sm">{sh?.name || `Ca ${a.shift}`}</p><p className="text-white/60 text-[10px] font-semibold">{a.custom_start || sh?.time_start} — {a.custom_end || sh?.time_end}</p></div>
                                                    <div className="ml-1 pl-2.5 border-l border-white/20"><p className="text-white/80 text-[10px] font-bold">📍 {a.store_name}</p></div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-gray-100 border border-gray-200">
                                        <span className="material-symbols-outlined text-gray-400 text-xl">event_busy</span>
                                        <p className="text-sm text-gray-500 font-medium">Hôm nay bạn không có ca làm.</p>
                                    </div>
                                )
                            )}
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex p-1 bg-gray-100 dark:bg-[#111] rounded-xl">
                                    {([{ tab: 'MY_SCHEDULE' as EmpTab, icon: 'event_available', label: 'Lịch Của Tôi' }, { tab: 'REGISTER' as EmpTab, icon: 'edit_calendar', label: 'Đăng Ký Ca' }]).map(({ tab, icon, label }) => (
                                        <button key={tab} onClick={() => s.setEmpTab(tab)}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-all ${s.empTab === tab ? 'bg-white shadow-sm font-bold ' + (tab === 'MY_SCHEDULE' ? 'text-emerald-600' : 'text-indigo-600') : 'text-gray-500 font-medium hover:text-gray-700'}`}>
                                            <span className="material-symbols-outlined text-lg">{icon}</span>{label}
                                        </button>
                                    ))}
                                </div>
                                {s.empTab === 'REGISTER' && (
                                    <button onClick={s.handleCopyRegs} disabled={!!s.processing} className="flex items-center gap-1.5 px-3 py-2 text-sm font-bold rounded-xl disabled:opacity-50" style={{ background: '#FEF3C7', color: '#D97706' }}>
                                        <span className="material-symbols-outlined text-[18px]">{s.processing === 'copy-regs' ? 'hourglass_empty' : 'content_copy'}</span>Copy tuần
                                    </button>
                                )}
                            </div>
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${s.empTab === 'REGISTER' ? 'text-amber-700' : 'bg-emerald-50 text-emerald-600'}`} style={s.empTab === 'REGISTER' ? { background: '#FEF3C7' } : {}}>
                                <span className="material-symbols-outlined text-sm">{s.empTab === 'REGISTER' ? 'info' : 'event_available'}</span>
                                {s.empTab === 'REGISTER' ? `Nhấn ô để đăng ký. Đã ĐK ${s.stats.regCount} ca.` : `${s.assignments.length} ca được xếp tuần này.`}
                            </div>
                            {s.loading ? <SkeletonTable /> : (s.empTab === 'MY_SCHEDULE' ? renderMySchedule() : renderRegistrationGrid())}
                        </>
                    )}
                </div>
            </div>

            {s.assignPopup && (() => {
                const apStore = s.stores.find(st => st.id === s.assignPopup!.storeId);
                const apShifts = s.storeShiftsMap.get(s.assignPopup.storeId) || [];
                return (<AssignPopup date={s.assignPopup.date} shift={s.assignPopup.shift} storeId={s.assignPopup.storeId}
                    weekDates={s.weekDates} storeShifts={apShifts} storeName={apStore?.name || ''} employees={s.employees}
                    slotRegs={s.getRegsForSlot(s.assignPopup.storeId, s.assignPopup.date, s.assignPopup.shift)}
                    slotAsgns={s.getAsgnsForSlot(s.assignPopup.storeId, s.assignPopup.date, s.assignPopup.shift)}
                    processing={s.processing} onAssign={s.handleAssign} onRemove={s.handleRemoveAssignment} onUpdate={s.handleUpdateAssignment}
                    onClose={() => s.setAssignPopup(null)} />);
            })()}
            {s.confirmDialog && (<ConfirmDialog title={s.confirmDialog.title} message={s.confirmDialog.message}
                onConfirm={s.confirmDialog.onConfirm} onCancel={() => s.setConfirmDialog(null)} />)}
        </div>
    );
};

export default Schedule;
