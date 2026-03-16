import React, { useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User } from '../../types';
import type { StoreShift, AssignmentTag } from '../../services/schedule';
import PortalHeader from '../../components/PortalHeader';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useSchedule, formatDateShort, DAY_NAMES, DAY_LABELS, TAG_CONFIG } from '../../hooks/useSchedule';
import type { ToastFn, EmpTab } from '../../hooks/useSchedule';
import AssignPopup from './AssignPopup';

interface ScheduleProps { user: User; toast: ToastFn; }

const SHIFT_ICONS: Record<string, string> = {
    wb_sunny: 'wb_sunny', wb_twilight: 'wb_twilight', dark_mode: 'dark_mode',
    nights_stay: 'dark_mode', inventory_2: 'inventory_2', local_shipping: 'local_shipping',
};

const TagLegend = () => (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-100 dark:border-gray-800">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mr-1">Chú thích:</span>
        {(Object.keys(TAG_CONFIG) as AssignmentTag[]).map(tag => (
            <span key={tag} className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ color: TAG_CONFIG[tag].color, background: `${TAG_CONFIG[tag].color}15` }}>
                <span className="material-symbols-outlined" style={{ fontSize: 11 }}>{TAG_CONFIG[tag].icon}</span>
                {TAG_CONFIG[tag].label}
            </span>
        ))}
    </div>
);

const SkeletonTable = () => (
    <div className="p-4 space-y-3 animate-pulse">
        {Array.from({ length: 3 }).map((_, r) => (
            <div key={r} className="flex gap-3">
                <div className="w-[120px] h-12 bg-gray-100 dark:bg-gray-800/30 rounded-lg shrink-0" />
                {Array.from({ length: 7 }).map((_, c) => <div key={c} className="flex-1 h-12 bg-gray-50 dark:bg-gray-800/20 rounded-lg" />)}
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
            const storeShifts = s.storeShiftsMap.get(a.store_id) || [];
            const shift = storeShifts.find(ss => ss.id === a.shift);
            return { assignment: a, shift };
        });
    }, [s.todayAssignments, s.storeShiftsMap, isAdmin]);

    const renderStoreSection = useCallback((storeId: string, storeName: string, storeShifts: StoreShift[]) => {
        const mainShifts = storeShifts.filter(sh => sh.type === 'MAIN');
        const supportShifts = storeShifts.filter(sh => sh.type === 'SUPPORT');
        const allShifts = [...mainShifts, ...supportShifts];

        return (
            <div key={storeId} className="bg-white dark:bg-[#1a1a1a] rounded-2xl overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
                {/* Store header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800" style={{ background: 'linear-gradient(135deg, #1E3A5F 0%, #1a2f4e 100%)' }}>
                    <div className="flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-white/80 text-lg">storefront</span>
                        <h3 className="text-white font-bold text-sm">{storeName}</h3>
                        <span className="text-white/40 text-xs font-semibold">{allShifts.length} ca</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button onClick={() => s.handleAutoAssign(storeId)} disabled={!!s.processing} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-white/90 bg-white/15 hover:bg-white/25 transition-colors disabled:opacity-50" title="Tự xếp">
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>auto_awesome</span>
                            <span className="hidden sm:inline">Tự xếp</span>
                        </button>
                        <button onClick={() => s.handleCopyAsgns(storeId)} disabled={!!s.processing} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-white/90 bg-white/15 hover:bg-white/25 transition-colors disabled:opacity-50" title="Copy tuần trước">
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>content_copy</span>
                            <span className="hidden sm:inline">Copy</span>
                        </button>
                    </div>
                </div>

                {/* Shift × Day table */}
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-gray-50/50 dark:bg-[#111]">
                            <tr>
                                <th className="p-3 border-r border-gray-100 dark:border-gray-800 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-left w-[130px]">Ca</th>
                                {s.weekDates.map((d, i) => {
                                    const isToday = d === s.today;
                                    const dayNum = new Date(d + 'T00:00:00').getDate();
                                    return (
                                        <th key={d} className={`p-2 text-center border-r border-gray-100 dark:border-gray-800 last:border-r-0 ${isToday ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}>
                                            <p className={`text-[10px] font-bold uppercase tracking-wide ${isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`}>{DAY_LABELS[i]}</p>
                                            {isToday
                                                ? <span className="inline-flex w-7 h-7 items-center justify-center bg-indigo-500 text-white rounded-full text-xs font-bold shadow-md shadow-indigo-500/30">{dayNum}</span>
                                                : <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{formatDateShort(d)}</p>
                                            }
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {allShifts.map(sh => {
                                const isSupport = sh.type === 'SUPPORT';
                                return (
                                    <tr key={sh.id} className={isSupport ? 'bg-gray-50/30 dark:bg-gray-800/10' : ''}>
                                        <td className={`p-2.5 border-r border-gray-100 dark:border-gray-800 border-l-[3px] ${isSupport ? 'border-l-blue-300' : 'border-l-amber-400'}`}>
                                            <div className={`flex items-center gap-1.5 ${isSupport ? 'pl-2' : ''}`}>
                                                <span className="material-symbols-outlined text-base text-gray-500">{SHIFT_ICONS[sh.icon] || sh.icon || 'schedule'}</span>
                                                <div>
                                                    <p className={`font-bold leading-tight ${isSupport ? 'text-[11px] text-gray-500' : 'text-xs text-gray-900 dark:text-white'}`}>{sh.name}</p>
                                                    <p className="text-[10px] text-gray-400 font-semibold">{sh.time_start}-{sh.time_end}</p>
                                                </div>
                                            </div>
                                        </td>
                                        {s.weekDates.map(date => {
                                            const slotAsgns = s.getAsgnsForSlot(storeId, date, sh.id);
                                            const slotRegs = s.getRegsForSlot(storeId, date, sh.id);
                                            const isPast = date < s.today;
                                            const isToday = date === s.today;
                                            const pendingRegs = slotRegs.filter(r => !slotAsgns.some(a => a.user_id === r.user_id));

                                            return (
                                                <td key={`${date}-${sh.id}`} className={`p-1.5 border-r border-gray-100 dark:border-gray-800 last:border-r-0 align-top group ${isPast ? 'opacity-40' : ''} ${isToday ? 'bg-indigo-50/20 dark:bg-indigo-900/5' : ''}`}>
                                                    <div className="flex flex-col gap-1 min-h-[50px]">
                                                        {/* Assigned employees */}
                                                        {slotAsgns.map(a => (
                                                            <div key={a.id} className={`px-1.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 border ${a.tag
                                                                ? `border-transparent`
                                                                : 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/20 text-emerald-900 dark:text-emerald-300'
                                                                }`}
                                                                style={a.tag ? { backgroundColor: `${TAG_CONFIG[a.tag].color}15`, color: TAG_CONFIG[a.tag].color } : {}}
                                                            >
                                                                <span className="truncate flex-1">{a.user_name}</span>
                                                                {(a.custom_start || a.custom_end) && (
                                                                    <span className="text-[9px] opacity-75 whitespace-nowrap">
                                                                        ({a.custom_start ? `từ ${a.custom_start.replace(':00', 'h')}` : ''}{a.custom_end ? ` đến ${a.custom_end.replace(':00', 'h')}` : ''})
                                                                    </span>
                                                                )}
                                                                <button onClick={() => s.handleRemoveAssignment(a.id, a.user_name)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all shrink-0" disabled={s.processing === 'remove-' + a.id}>
                                                                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>close</span>
                                                                </button>
                                                            </div>
                                                        ))}
                                                        {/* Pending registrations */}
                                                        {pendingRegs.map(r => (
                                                            <div key={r.id} onClick={() => s.handleAssign(r.user_id, storeId, date, sh.id)} className="px-1.5 py-0.5 rounded-md border border-dashed border-emerald-300 dark:border-emerald-700 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 cursor-pointer hover:bg-emerald-50 transition-colors flex items-center gap-0.5" title={`Xếp ${r.user_name}`}>
                                                                <span className="material-symbols-outlined" style={{ fontSize: 10 }}>add</span>
                                                                <span className="truncate">{r.user_name}</span>
                                                            </div>
                                                        ))}
                                                        {/* Add button */}
                                                        {!isPast && (
                                                            <button onClick={() => s.setAssignPopup({ date, shift: sh.id, storeId })} className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-6 h-6 rounded-full border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-300 hover:border-indigo-400 hover:text-indigo-500 transition-all mx-auto mt-auto shrink-0">
                                                                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>add</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }, [s, isAdmin]);

    const renderMySchedule = useCallback(() => {
        return (
            <div className="space-y-3">
                {s.weekDates.map((date, di) => {
                    const myAsgns = s.assignments.filter(a => a.work_date === date);
                    const isPast = date < s.today;
                    const isToday = date === s.today;
                    if (myAsgns.length === 0 && isPast) return null;

                    return (
                        <div key={date} className={`bg-white dark:bg-[#1a1a1a] rounded-xl overflow-hidden ${isToday ? 'ring-2 ring-indigo-500/30' : ''}`} style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.03)' }}>
                            <div className={`px-4 py-2.5 flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 ${isToday ? 'bg-indigo-50 dark:bg-indigo-900/10' : 'bg-gray-50/50 dark:bg-[#111]'}`}>
                                <span className={`text-xs font-bold ${isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500'}`}>📅</span>
                                <span className={`text-sm font-bold ${isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-900 dark:text-white'}`}>
                                    {DAY_NAMES[di]} ({formatDateShort(date)})
                                </span>
                                {isToday && <span className="text-[10px] font-bold text-indigo-500 bg-indigo-100 dark:bg-indigo-900/30 px-2 py-0.5 rounded-md">Hôm nay</span>}
                                {myAsgns.length > 0 && <span className="text-[10px] font-bold text-emerald-600 ml-auto">{myAsgns.length} ca</span>}
                            </div>

                            {myAsgns.length === 0 ? (
                                <div className={`px-4 py-3 text-xs text-gray-400 ${isPast ? 'opacity-50' : ''}`}>Không có ca làm</div>
                            ) : (
                                <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
                                    {myAsgns.map(a => {
                                        const storeShifts = s.storeShiftsMap.get(a.store_id) || [];
                                        const shiftCfg = storeShifts.find(ss => ss.id === a.shift);
                                        const coworkers = s.coworkerAssignments.filter(
                                            c => c.store_id === a.store_id && c.work_date === date && c.shift === a.shift && c.user_id !== a.user_id
                                        );

                                        return (
                                            <div key={a.id} className={`px-4 py-3 ${isPast ? 'opacity-50' : ''}`}>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                                        <span className="material-symbols-outlined text-amber-500 text-lg">
                                                            {shiftCfg ? (SHIFT_ICONS[shiftCfg.icon] || shiftCfg.icon || 'schedule') : 'schedule'}
                                                        </span>
                                                        <div>
                                                            <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                                                                {shiftCfg?.name || `Ca ${a.shift}`}
                                                            </p>
                                                            <p className="text-[11px] text-gray-400 font-semibold">
                                                                {a.custom_start || shiftCfg?.time_start || '?'} — {a.custom_end || shiftCfg?.time_end || '?'}
                                                                {(a.custom_start || a.custom_end) && <span className="ml-1 text-blue-500">(giờ riêng)</span>}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-[10px] font-bold">
                                                            <span className="material-symbols-outlined" style={{ fontSize: 11 }}>storefront</span>
                                                            {a.store_name}
                                                        </span>
                                                    </div>
                                                </div>
                                                {/* Coworkers */}
                                                {coworkers.length > 0 && (
                                                    <div className="mt-2 pl-7 flex flex-wrap items-center gap-1.5">
                                                        <span className="text-[10px] text-gray-400 font-semibold">Cùng ca:</span>
                                                        {coworkers.map(c => (
                                                            <span key={c.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-[10px] font-semibold text-gray-600 dark:text-gray-400">
                                                                <span className="w-4 h-4 rounded-full bg-gray-300 dark:bg-gray-700 text-white flex items-center justify-center text-[8px] font-bold shrink-0">{(c.user_name || '?')[0]}</span>
                                                                {c.user_name}
                                                                {(c.custom_start || c.custom_end) && (
                                                                    <span className="text-blue-500 text-[9px]">
                                                                        ({c.custom_start ? `từ ${c.custom_start.replace(':00', 'h')}` : ''}{c.custom_end ? ` đến ${c.custom_end.replace(':00', 'h')}` : ''})
                                                                    </span>
                                                                )}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                {a.tag && (
                                                    <div className="mt-1.5 pl-7">
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold" style={{ color: TAG_CONFIG[a.tag].color, background: `${TAG_CONFIG[a.tag].color}15` }}>
                                                            <span className="material-symbols-outlined" style={{ fontSize: 11 }}>{TAG_CONFIG[a.tag].icon}</span>
                                                            {TAG_CONFIG[a.tag].label}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    }, [s]);

    const renderRegistrationGrid = useCallback(() => {
        const shifts = s.registrationShifts;
        if (shifts.length === 0) {
            return (
                <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-8 text-center">
                    <span className="material-symbols-outlined text-3xl text-gray-400 mb-2">info</span>
                    <p className="text-sm text-gray-500">Bạn chưa được gán vào cửa hàng nào. Liên hệ admin.</p>
                </div>
            );
        }

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
                                        <th key={d} className={`p-2 text-center border-r border-gray-100 dark:border-gray-800 last:border-r-0 ${isToday ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}>
                                            <p className={`text-[10px] font-bold uppercase ${isToday ? 'text-indigo-600' : 'text-gray-400'}`}>{DAY_LABELS[i]}</p>
                                            {isToday
                                                ? <span className="inline-flex w-7 h-7 items-center justify-center bg-indigo-500 text-white rounded-full text-xs font-bold">{dayNum}</span>
                                                : <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{formatDateShort(d)}</p>
                                            }
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
                                            <td key={`${date}-${sh.id}`}
                                                onClick={() => !isPast && !proc && s.toggleRegistration(date, sh.id)}
                                                className={`p-2 border-r border-gray-100 dark:border-gray-800 last:border-r-0 text-center align-middle ${isPast ? 'opacity-40' : 'cursor-pointer hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10'} ${isToday ? 'bg-indigo-50/20 dark:bg-indigo-900/5' : ''} transition-colors`}>
                                                <div className="flex items-center justify-center min-h-[44px]">
                                                    {proc
                                                        ? <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                                        : reg
                                                            ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[11px] font-bold"><span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span>Đã ĐK</span>
                                                            : !isPast
                                                                ? <span className="w-7 h-7 rounded-full border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-300 hover:border-indigo-400 hover:text-indigo-500 transition-all"><span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span></span>
                                                                : null
                                                    }
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
            {/* ── Header ── */}
            <PortalHeader>
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/')} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
                        <span className="material-symbols-outlined text-amber-500">calendar_month</span>
                        {isAdmin ? 'Xếp Lịch Tổng' : 'Lịch Làm'}
                    </div>
                </div>
                {/* Week Navigator */}
                <div className="flex items-center gap-2 bg-white dark:bg-[#1a1a1a] p-1 rounded-xl" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.03)' }}>
                    <button onClick={() => s.setWeekOffset(w => w - 1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
                        <span className="material-symbols-outlined text-lg">chevron_left</span>
                    </button>
                    <span className="text-sm font-bold text-gray-900 dark:text-white whitespace-nowrap px-1 min-w-[110px] text-center">{s.weekLabel}</span>
                    <button onClick={() => s.setWeekOffset(w => w + 1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
                        <span className="material-symbols-outlined text-lg">chevron_right</span>
                    </button>
                    <button onClick={() => s.setWeekOffset(0)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${s.weekOffset === 0 ? 'text-gray-900 shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'}`} style={s.weekOffset === 0 ? { background: 'linear-gradient(180deg, #FACC15, #F59E0B)' } : {}}>
                        Nay
                    </button>
                </div>
            </PortalHeader>

            <div className="flex-1 overflow-y-auto p-4 lg:p-6">
                <div className="max-w-7xl mx-auto space-y-4">

                    {/* ═══ ADMIN VIEW ═══ */}
                    {isAdmin && (
                        <>
                            <TagLegend />
                            {s.loading ? (
                                <>{Array.from({ length: 3 }).map((_, i) => <SkeletonTable key={i} />)}</>
                            ) : (
                                s.stores.map(store => {
                                    const shifts = s.storeShiftsMap.get(store.id) || [];
                                    return renderStoreSection(store.id, store.name, shifts);
                                })
                            )}
                        </>
                    )}

                    {/* ═══ EMPLOYEE VIEW ═══ */}
                    {!isAdmin && (
                        <>
                            {/* Today Banner */}
                            {s.weekOffset === 0 && (
                                todayShiftCards.length > 0 ? (
                                    <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #1E3A5F 0%, #1a2f4e 100%)', boxShadow: '0 8px 24px rgba(30,58,95,0.25)' }}>
                                        <div className="px-5 pt-4 pb-3 flex items-center gap-3">
                                            <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center">
                                                <span className="material-symbols-outlined text-white text-xl">today</span>
                                            </div>
                                            <div>
                                                <p className="text-white/60 text-[11px] font-semibold uppercase tracking-widest">Hôm nay</p>
                                                <p className="text-white font-bold text-base">{todayShiftCards.length} ca làm</p>
                                            </div>
                                        </div>
                                        <div className="px-4 pb-4 flex flex-wrap gap-2">
                                            {todayShiftCards.map(({ assignment: a, shift: sh }) => {
                                                const coworkers = s.coworkerAssignments.filter(
                                                    c => c.store_id === a.store_id && c.work_date === s.today && c.shift === a.shift && c.user_id !== a.user_id
                                                );
                                                return (
                                                    <div key={a.id} className="flex items-center gap-2.5 bg-white/10 backdrop-blur-sm rounded-xl px-3.5 py-2.5 border border-white/15">
                                                        <span className="material-symbols-outlined text-lg text-amber-400">
                                                            {sh ? (SHIFT_ICONS[sh.icon] || 'schedule') : 'schedule'}
                                                        </span>
                                                        <div>
                                                            <p className="text-white font-bold text-sm leading-tight">{sh?.name || `Ca ${a.shift}`}</p>
                                                            <p className="text-white/60 text-[10px] font-semibold">{a.custom_start || sh?.time_start} — {a.custom_end || sh?.time_end}</p>
                                                        </div>
                                                        <div className="ml-1 pl-2.5 border-l border-white/20">
                                                            <p className="text-white/80 text-[10px] font-bold">📍 {a.store_name}</p>
                                                            {coworkers.length > 0 && (
                                                                <p className="text-white/50 text-[9px]">+{coworkers.length} đồng nghiệp</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                                        <span className="material-symbols-outlined text-gray-400 text-xl">event_busy</span>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Hôm nay bạn không có ca làm được xếp.</p>
                                    </div>
                                )
                            )}

                            {/* Tabs */}
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex p-1 bg-gray-100 dark:bg-[#111] rounded-xl">
                                    {([
                                        { tab: 'MY_SCHEDULE' as EmpTab, icon: 'event_available', label: 'Lịch Của Tôi' },
                                        { tab: 'REGISTER' as EmpTab, icon: 'edit_calendar', label: 'Đăng Ký Ca' },
                                    ]).map(({ tab, icon, label }) => (
                                        <button key={tab} onClick={() => s.setEmpTab(tab)}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-all ${s.empTab === tab
                                                ? 'bg-white dark:bg-[#1a1a1a] shadow-sm font-bold ' + (tab === 'MY_SCHEDULE' ? 'text-emerald-600 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400')
                                                : 'text-gray-500 dark:text-gray-400 font-medium hover:text-gray-700'
                                                }`}>
                                            <span className="material-symbols-outlined text-lg">{icon}</span>
                                            {label}
                                        </button>
                                    ))}
                                </div>
                                {s.empTab === 'REGISTER' && (
                                    <button onClick={s.handleCopyRegs} disabled={!!s.processing} className="flex items-center gap-1.5 px-3 py-2 text-sm font-bold rounded-xl transition-colors disabled:opacity-50" style={{ background: '#FEF3C7', color: '#D97706' }}>
                                        {s.processing === 'copy-regs' ? <span className="material-symbols-outlined text-[18px] animate-spin">hourglass_empty</span> : <span className="material-symbols-outlined text-[18px]">content_copy</span>}
                                        Copy tuần
                                    </button>
                                )}
                            </div>

                            {/* Info pill */}
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${s.empTab === 'REGISTER'
                                ? 'text-amber-700 dark:text-amber-400'
                                : 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400'
                                }`} style={s.empTab === 'REGISTER' ? { background: '#FEF3C7' } : {}}>
                                <span className="material-symbols-outlined text-sm">{s.empTab === 'REGISTER' ? 'info' : 'event_available'}</span>
                                {s.empTab === 'REGISTER'
                                    ? `Nhấn ô để đăng ký ngày + ca bạn có thể làm. Admin sẽ xếp cửa hàng cho bạn. Đã ĐK ${s.stats.regCount} ca.`
                                    : `${s.assignments.length} ca được xếp tuần này. Nhấn để xem đồng nghiệp.`
                                }
                            </div>

                            {/* Tab content */}
                            {s.loading ? <SkeletonTable /> : (
                                s.empTab === 'MY_SCHEDULE' ? renderMySchedule() : renderRegistrationGrid()
                            )}

                            {/* Legend */}
                            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400 px-1">
                                <span className="flex items-center gap-1.5 font-semibold">
                                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 font-bold text-[10px]">
                                        <span className="material-symbols-outlined" style={{ fontSize: 11 }}>check_circle</span>Đã ĐK
                                    </span>
                                    Ca bạn đăng ký (chờ admin xếp)
                                </span>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Popups */}
            {s.assignPopup && (() => {
                const apStore = s.stores.find(st => st.id === s.assignPopup!.storeId);
                const apShifts = s.storeShiftsMap.get(s.assignPopup.storeId) || [];
                return (
                    <AssignPopup
                        date={s.assignPopup.date} shift={s.assignPopup.shift} storeId={s.assignPopup.storeId}
                        weekDates={s.weekDates} storeShifts={apShifts} storeName={apStore?.name || ''}
                        employees={s.employees}
                        slotRegs={s.getRegsForSlot(s.assignPopup.storeId, s.assignPopup.date, s.assignPopup.shift)}
                        slotAsgns={s.getAsgnsForSlot(s.assignPopup.storeId, s.assignPopup.date, s.assignPopup.shift)}
                        processing={s.processing}
                        onAssign={s.handleAssign} onRemove={s.handleRemoveAssignment} onUpdate={s.handleUpdateAssignment}
                        onClose={() => s.setAssignPopup(null)}
                    />
                );
            })()}
            {s.confirmDialog && (
                <ConfirmDialog title={s.confirmDialog.title} message={s.confirmDialog.message}
                    onConfirm={s.confirmDialog.onConfirm} onCancel={() => s.setConfirmDialog(null)} />
            )}
        </div>
    );
};

export default Schedule;
