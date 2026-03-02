import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { ShiftConfig } from '../../services/system';
import type { User } from '../../types';
import PortalHeader from '../../components/PortalHeader';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useSchedule, formatDateShort, DAY_NAMES } from '../../hooks/useSchedule';
import type { ToastFn, EmpTab } from '../../hooks/useSchedule';
import AssignPopup from './AssignPopup';

interface ScheduleProps { user: User; toast: ToastFn; }

const SHIFT_ICONS: Record<string, string> = { wb_sunny: 'wb_sunny', wb_twilight: 'wb_twilight', nights_stay: 'nights_stay', dark_mode: 'nights_stay' };

const SHIFT_PALETTES = [
    { accent: 'border-l-amber-400', cardBg: 'bg-amber-50', cardBgD: 'dark:bg-amber-900/10', cardText: 'text-amber-900', cardTextD: 'dark:text-amber-200', cardBorder: 'border-amber-100', cardBorderD: 'dark:border-amber-900/20', iconColor: 'text-amber-500' },
    { accent: 'border-l-rose-400', cardBg: 'bg-rose-50', cardBgD: 'dark:bg-rose-900/10', cardText: 'text-rose-900', cardTextD: 'dark:text-rose-200', cardBorder: 'border-rose-100', cardBorderD: 'dark:border-rose-900/20', iconColor: 'text-rose-500' },
    { accent: 'border-l-indigo-400', cardBg: 'bg-indigo-50', cardBgD: 'dark:bg-indigo-900/10', cardText: 'text-indigo-900', cardTextD: 'dark:text-indigo-200', cardBorder: 'border-indigo-100', cardBorderD: 'dark:border-indigo-900/20', iconColor: 'text-indigo-500' },
    { accent: 'border-l-teal-400', cardBg: 'bg-teal-50', cardBgD: 'dark:bg-teal-900/10', cardText: 'text-teal-900', cardTextD: 'dark:text-teal-200', cardBorder: 'border-teal-100', cardBorderD: 'dark:border-teal-900/20', iconColor: 'text-teal-500' },
    { accent: 'border-l-purple-400', cardBg: 'bg-purple-50', cardBgD: 'dark:bg-purple-900/10', cardText: 'text-purple-900', cardTextD: 'dark:text-purple-200', cardBorder: 'border-purple-100', cardBorderD: 'dark:border-purple-900/20', iconColor: 'text-purple-500' },
    { accent: 'border-l-cyan-400', cardBg: 'bg-cyan-50', cardBgD: 'dark:bg-cyan-900/10', cardText: 'text-cyan-900', cardTextD: 'dark:text-cyan-200', cardBorder: 'border-cyan-100', cardBorderD: 'dark:border-cyan-900/20', iconColor: 'text-cyan-500' },
];

function getShiftStyle(sId: number) { return SHIFT_PALETTES[(sId - 1) % SHIFT_PALETTES.length]; }

const TAB_STYLES: Record<string, { active: string; }> = {
    REGISTER: { active: 'bg-white dark:bg-[#1a1a1a] shadow-sm text-indigo-600 dark:text-indigo-400 font-bold' },
    MY_SCHEDULE: { active: 'bg-white dark:bg-[#1a1a1a] shadow-sm text-emerald-600 dark:text-emerald-400 font-bold' },
};
const SkeletonTable = () => (
    <div className="p-4 space-y-3 animate-pulse">
        <div className="flex gap-3">
            <div className="w-[140px] h-6 bg-gray-200 dark:bg-gray-800 rounded-lg shrink-0" />
            {Array.from({ length: 7 }).map((_, i) => <div key={i} className="flex-1 h-6 bg-gray-100 dark:bg-gray-800/50 rounded-lg" />)}
        </div>
        {Array.from({ length: 3 }).map((_, r) => (
            <div key={r} className="flex gap-3">
                <div className="w-[140px] h-14 bg-gray-100 dark:bg-gray-800/30 rounded-lg shrink-0" />
                {Array.from({ length: 7 }).map((_, c) => <div key={c} className="flex-1 h-14 bg-gray-50 dark:bg-gray-800/20 rounded-lg" />)}
            </div>
        ))}
    </div>
);

const Schedule: React.FC<ScheduleProps> = ({ user, toast }) => {
    const navigate = useNavigate();
    const isAdmin = user.role === 'ADMIN';
    const s = useSchedule(isAdmin, toast);

    const renderShiftRow = (shiftCfg: ShiftConfig, isSupport: boolean) => {
        const sId = shiftCfg.id;
        const style = getShiftStyle(shiftCfg.parent_id || sId);
        const isEmpReg = !isAdmin && s.empTab === 'REGISTER';

        return (
            <tr key={sId} className={isSupport ? 'bg-gray-50/30 dark:bg-gray-800/10' : ''}>
                <td className={`p-3 border-r border-gray-100 dark:border-gray-800 border-l-[3px] ${isSupport ? 'border-l-transparent' : style.accent}`}>
                    <div className={`flex items-center gap-2 ${isSupport ? 'pl-4' : ''}`}>
                        {isSupport
                            ? <span className="material-symbols-outlined text-lg text-gray-400">subdirectory_arrow_right</span>
                            : <span className={`material-symbols-outlined text-xl ${style.iconColor}`}>{SHIFT_ICONS[shiftCfg.icon] || shiftCfg.icon || 'schedule'}</span>
                        }
                        <div>
                            <p className={`font-bold flex items-center gap-1.5 ${isSupport ? 'text-xs text-gray-600 dark:text-gray-400' : 'text-sm text-gray-900 dark:text-white'}`}>
                                {shiftCfg.name}
                                {shiftCfg.max_slots ? <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500">{shiftCfg.max_slots} slots</span> : null}
                            </p>
                            <p className="text-[10px] text-gray-400 font-semibold tracking-tight">{shiftCfg.time}</p>
                        </div>
                    </div>
                </td>
                {s.weekDates.map(date => {
                    const slotRegs = s.getRegsForSlot(date, sId);
                    const slotAsgns = s.getAsgnsForSlot(date, sId);
                    const reg = s.isRegistered(date, sId);
                    const asgn = s.isAssignedSlot(date, sId);
                    const proc = s.processing === `${date}-${sId}`;
                    const isPast = date < s.today;
                    const todayBg = date === s.today ? 'bg-indigo-50/20 dark:bg-indigo-900/5' : '';

                    if (isAdmin) return (
                        <td key={`${date}-${sId}`} className={`p-2 border-r border-gray-100 dark:border-gray-800 last:border-r-0 align-top group ${isPast ? 'opacity-40' : ''} ${todayBg}`}>
                            <div className="flex flex-col gap-1.5 min-h-[70px]">
                                {slotAsgns.map(a => (
                                    <div key={a.id} className={`p-1.5 ${style.cardBg} ${style.cardBgD} rounded-lg border ${style.cardBorder} ${style.cardBorderD} text-xs shadow-sm flex items-center gap-1`}>
                                        <span className={`font-bold ${style.cardText} ${style.cardTextD} flex-1 truncate`}>{a.user_name}</span>
                                        <button onClick={() => s.handleRemoveAssignment(a.id, a.user_name)} disabled={s.processing === 'remove-' + a.id} className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50" aria-label={`Xóa ${a.user_name}`}>
                                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                                        </button>
                                    </div>
                                ))}
                                {slotRegs.filter(r => !slotAsgns.some(a => a.user_id === r.user_id)).map(r => (
                                    <div key={r.id} onClick={() => s.handleAssign(r.user_id, date, sId)} className="p-1 bg-emerald-50 dark:bg-emerald-900/10 rounded-md border border-emerald-200 dark:border-emerald-800/30 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/20 transition-colors flex items-center gap-1" title={`Xếp ${r.user_name}`}>
                                        <span className="material-symbols-outlined" style={{ fontSize: 12 }}>person_add</span>
                                        <span className="truncate">{r.user_name}</span>
                                    </div>
                                ))}
                                {!isPast && (
                                    <button onClick={() => s.setAssignPopup({ date, shift: sId })} className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-7 h-7 rounded-full border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-300 hover:border-indigo-400 hover:text-indigo-500 transition-all mx-auto mt-auto" aria-label="Thêm">
                                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
                                    </button>
                                )}
                            </div>
                        </td>
                    );

                    if (isEmpReg) return (
                        <td key={`${date}-${sId}`} onClick={() => !isPast && !proc && s.toggleRegistration(date, sId)} className={`p-2 border-r border-gray-100 dark:border-gray-800 last:border-r-0 text-center align-middle transition-colors ${isPast ? 'opacity-40' : 'cursor-pointer hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10'} ${todayBg}`}>
                            <div className="flex items-center justify-center min-h-[50px]">
                                {proc ? <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                    : reg ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[11px] font-bold"><span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span>Đã ĐK</span>
                                        : !isPast ? <span className="w-7 h-7 rounded-full border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-300 hover:border-indigo-400 hover:text-indigo-500 transition-all flex items-center justify-center"><span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span></span>
                                            : null}
                            </div>
                        </td>
                    );

                    return (
                        <td key={`${date}-${sId}`} className={`p-2 border-r border-gray-100 dark:border-gray-800 last:border-r-0 text-center align-middle ${isPast ? 'opacity-40' : ''} ${todayBg}`}>
                            <div className="flex items-center justify-center min-h-[50px]">
                                {asgn ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold"><span className="material-symbols-outlined" style={{ fontSize: 14 }}>verified</span>{shiftCfg.time}</span>
                                    : <span className="text-gray-300 dark:text-gray-700">—</span>}
                            </div>
                        </td>
                    );
                })}
            </tr>
        );
    };

    const storeName = s.stores.find(st => st.id === s.selectedStore)?.name || '';

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-[#0a0a0a]">
            {/* ── Header: Clean + Week Nav ── */}
            <PortalHeader>
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/')} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
                        <span className="material-symbols-outlined text-indigo-500">calendar_month</span>
                        {isAdmin ? 'Xếp Lịch' : 'Lịch Làm'}
                    </div>
                </div>
                {/* Week Navigator in header */}
                <div className="flex items-center gap-2 bg-white dark:bg-[#1a1a1a] p-1 rounded-xl border border-gray-200 dark:border-gray-800">
                    <button onClick={() => s.setWeekOffset(w => w - 1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors" aria-label="Tuần trước">
                        <span className="material-symbols-outlined text-lg">chevron_left</span>
                    </button>
                    <span className="text-sm font-bold text-gray-900 dark:text-white whitespace-nowrap px-1 min-w-[110px] text-center">{s.weekLabel}</span>
                    <button onClick={() => s.setWeekOffset(w => w + 1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors" aria-label="Tuần sau">
                        <span className="material-symbols-outlined text-lg">chevron_right</span>
                    </button>
                    <button onClick={() => s.setWeekOffset(0)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${s.weekOffset === 0 ? 'bg-indigo-500 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'}`}>
                        Nay
                    </button>
                </div>
            </PortalHeader>

            <div className="flex-1 overflow-y-auto p-4 lg:p-6">
                <div className="max-w-7xl mx-auto space-y-4">

                    {/* ── Store Pills (L-01, V-01) — Replaces hidden dropdown ── */}
                    <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1">
                        <span className="material-symbols-outlined text-gray-400 text-lg shrink-0">storefront</span>
                        {s.stores.map(store => {
                            const active = store.id === s.selectedStore;
                            return (
                                <button
                                    key={store.id}
                                    onClick={() => s.setSelectedStore(store.id)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all shrink-0 ${active
                                        ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20'
                                        : 'bg-white dark:bg-[#1a1a1a] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600'
                                        }`}
                                >
                                    {store.name}
                                </button>
                            );
                        })}
                    </div>

                    {/* ── Row 2: Employee tabs OR Admin action bar ── */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        {!isAdmin ? (
                            <div className="flex p-1 bg-gray-100 dark:bg-[#111] rounded-xl">
                                {([{ tab: 'MY_SCHEDULE' as EmpTab, icon: 'event_available', label: 'Lịch Của Tôi' }, { tab: 'REGISTER' as EmpTab, icon: 'edit_calendar', label: 'Đăng Ký Ca' }]).map(({ tab, icon, label }) => (
                                    <button key={tab} onClick={() => s.setEmpTab(tab)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-all ${s.empTab === tab ? TAB_STYLES[tab].active : 'text-gray-500 dark:text-gray-400 font-medium hover:text-gray-700'}`}>
                                        <span className="material-symbols-outlined text-lg">{icon}</span>
                                        {label}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            /* Admin: Inline stats + actions */
                            <div className="flex items-center gap-3 text-sm">
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400 font-bold">
                                    <span className="material-symbols-outlined text-base">task_alt</span>
                                    {s.fillRate}%
                                </div>
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400 font-bold">
                                    <span className="material-symbols-outlined text-base">event_busy</span>
                                    {s.emptySlots} trống
                                </div>
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/10 text-indigo-700 dark:text-indigo-400 font-bold">
                                    <span className="material-symbols-outlined text-base">schedule</span>
                                    {Math.round(s.totalHours)}h
                                </div>
                            </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex items-center gap-2">
                            {isAdmin ? (<>
                                <button onClick={s.handleAutoAssign} disabled={!!s.processing} className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50 shadow-sm">
                                    {s.processing === 'auto-assign' ? <span className="material-symbols-outlined text-[18px] animate-spin">hourglass_empty</span> : <span className="material-symbols-outlined text-[18px]">auto_awesome</span>}
                                    Tự Xếp
                                </button>
                                <button onClick={s.handleCopyAsgns} disabled={!!s.processing} className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-bold rounded-xl transition-colors disabled:opacity-50">
                                    {s.processing === 'copy-asgns' ? <span className="material-symbols-outlined text-[18px] animate-spin">hourglass_empty</span> : <span className="material-symbols-outlined text-[18px]">content_copy</span>}
                                    <span className="hidden sm:inline">Copy tuần</span>
                                </button>
                            </>) : s.empTab === 'REGISTER' && (
                                <button onClick={s.handleCopyRegs} disabled={!!s.processing} className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/10 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 text-sm font-bold rounded-xl transition-colors disabled:opacity-50">
                                    {s.processing === 'copy-regs' ? <span className="material-symbols-outlined text-[18px] animate-spin">hourglass_empty</span> : <span className="material-symbols-outlined text-[18px]">content_copy</span>}
                                    <span className="hidden sm:inline">Copy tuần</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* ── Employee info pill ── */}
                    {!isAdmin && (
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${s.empTab === 'REGISTER'
                            ? 'bg-indigo-50 dark:bg-indigo-900/10 text-indigo-600 dark:text-indigo-400'
                            : 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400'
                            }`}>
                            <span className="material-symbols-outlined text-sm">{s.empTab === 'REGISTER' ? 'info' : 'event_available'}</span>
                            {s.empTab === 'REGISTER' ? `Nhấn ô để đăng ký. Đã ĐK ${s.regCount} ca.` : `${s.assignments.length} ca • ${Math.round(s.totalHours)} giờ tuần này tại ${storeName}`}
                        </div>
                    )}

                    {/* ── Calendar Grid ── */}
                    <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
                        {s.loading ? <SkeletonTable /> : s.shiftTree.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-3">
                                <div className="w-14 h-14 bg-gray-100 dark:bg-gray-800/50 rounded-2xl flex items-center justify-center">
                                    <span className="material-symbols-outlined text-3xl text-gray-400">calendar_month</span>
                                </div>
                                <p className="text-sm font-semibold text-gray-500">Chưa có ca làm cho {storeName}</p>
                                <p className="text-xs text-gray-400">Vào Cài đặt hệ thống để thiết lập ca</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full">
                                    <thead className="bg-gray-50/50 dark:bg-[#111]">
                                        <tr>
                                            <th className="p-4 border-r border-gray-100 dark:border-gray-800 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-left w-[150px]">Ca Làm</th>
                                            {s.weekDates.map((d, i) => {
                                                const isToday = d === s.today;
                                                const dayNum = new Date(d + 'T00:00:00').getDate();
                                                return (
                                                    <th key={d} className={`p-3 text-center border-r border-gray-100 dark:border-gray-800 last:border-r-0 ${isToday ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}>
                                                        <p className={`text-[10px] font-bold mb-1 uppercase tracking-wide ${isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`}>{DAY_NAMES[i]}</p>
                                                        {isToday
                                                            ? <span className="inline-flex w-8 h-8 items-center justify-center bg-indigo-500 text-white rounded-full text-sm font-bold shadow-md shadow-indigo-500/30">{dayNum}</span>
                                                            : <p className="text-base font-bold text-gray-900 dark:text-white">{formatDateShort(d)}</p>
                                                        }
                                                    </th>
                                                );
                                            })}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {s.shiftTree.map(({ main, supports }) => (
                                            <React.Fragment key={main.id}>
                                                {renderShiftRow(main, false)}
                                                {supports.map(sp => renderShiftRow(sp, true))}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Popups */}
            {s.assignPopup && (
                <AssignPopup date={s.assignPopup.date} shift={s.assignPopup.shift} weekDates={s.weekDates} shifts={s.shifts}
                    employees={s.employees} slotRegs={s.getRegsForSlot(s.assignPopup.date, s.assignPopup.shift)}
                    slotAsgns={s.getAsgnsForSlot(s.assignPopup.date, s.assignPopup.shift)} processing={s.processing}
                    onAssign={s.handleAssign} onRemove={s.handleRemoveAssignment} onClose={() => s.setAssignPopup(null)} />
            )}
            {s.confirmDialog && (
                <ConfirmDialog title={s.confirmDialog.title} message={s.confirmDialog.message}
                    onConfirm={s.confirmDialog.onConfirm} onCancel={() => s.setConfirmDialog(null)} />
            )}
        </div>
    );
};

export default Schedule;
