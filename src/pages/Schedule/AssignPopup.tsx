import React, { useState, useMemo } from 'react';
import type { ScheduleRegistration, ScheduleAssignment } from '../../services/schedule';
import type { ShiftConfig } from '../../services/system';
import { DAY_LABELS, formatDateShort } from '../../hooks/useSchedule';

interface AssignPopupProps {
    date: string;
    shift: number;
    weekDates: string[];
    shifts: ShiftConfig[];
    employees: { id: string; name: string; employee_id: string; avatar_url?: string }[];
    slotRegs: ScheduleRegistration[];
    slotAsgns: ScheduleAssignment[];
    processing: string | null;
    onAssign: (userId: string, date: string, shift: number) => void;
    onRemove: (aId: string, userName?: string) => void;
    onClose: () => void;
}

const AssignPopup: React.FC<AssignPopupProps> = ({
    date,
    shift,
    weekDates,
    shifts,
    employees,
    slotRegs,
    slotAsgns,
    processing,
    onAssign,
    onRemove,
    onClose,
}) => {
    const [search, setSearch] = useState('');

    const shiftName = shifts.find(s => s.id === shift)?.name || `Ca ${shift}`;
    const dayLabel = DAY_LABELS[weekDates.indexOf(date)] || '';

    const availRegs = useMemo(
        () => slotRegs.filter(r => !slotAsgns.some(a => a.user_id === r.user_id)),
        [slotRegs, slotAsgns]
    );

    const filteredEmployees = useMemo(() => {
        const assignedIds = new Set(slotAsgns.map(a => a.user_id));
        let list = employees.filter(e => !assignedIds.has(e.id));
        if (search.trim()) {
            const q = search.toLowerCase().trim();
            list = list.filter(e =>
                e.name.toLowerCase().includes(q) ||
                e.employee_id?.toLowerCase().includes(q)
            );
        }
        return list;
    }, [employees, slotAsgns, search]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-[#1a1a1a] rounded-2xl w-full max-w-sm shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg flex items-center justify-center">
                                <span className="material-symbols-outlined text-lg">person_add</span>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Xếp nhân viên</h3>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {dayLabel} {formatDateShort(date)} — {shiftName}
                        </p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center text-gray-400 transition-colors" aria-label="Đóng">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 p-4 space-y-4">
                    {/* Already assigned */}
                    {slotAsgns.length > 0 && (
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Đã xếp</p>
                            {slotAsgns.map(a => (
                                <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 mb-1.5">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0">{(a.user_name || '?')[0]}</div>
                                    <span className="text-sm font-semibold text-gray-900 dark:text-white flex-1">{a.user_name}</span>
                                    <button onClick={() => onRemove(a.id, a.user_name)} disabled={processing === 'remove-' + a.id} className="text-red-400 hover:text-red-600 transition-colors disabled:opacity-50">
                                        <span className="material-symbols-outlined text-lg">remove_circle</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Registered */}
                    {availRegs.length > 0 && (
                        <div>
                            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-2 flex items-center gap-1">
                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>how_to_reg</span>
                                Đã đăng ký ({availRegs.length})
                            </p>
                            {availRegs.map(r => (
                                <div key={r.id} onClick={() => onAssign(r.user_id, date, shift)} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors mb-1.5">
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0">{(r.user_name || '?')[0]}</div>
                                    <span className="text-sm font-medium text-gray-900 dark:text-white flex-1">{r.user_name}</span>
                                    <span className="material-symbols-outlined text-emerald-500 text-lg">add_circle</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Search filter (LOW-04) */}
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Tất cả nhân viên</p>
                        <div className="relative mb-3">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">search</span>
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Tìm nhân viên..."
                                className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#0a0a0a] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors"
                                autoFocus
                            />
                            {search && (
                                <button
                                    onClick={() => setSearch('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-lg">close</span>
                                </button>
                            )}
                        </div>
                        {filteredEmployees.map(emp => {
                            const hasReg = slotRegs.some(r => r.user_id === emp.id);
                            return (
                                <div key={emp.id} onClick={() => onAssign(emp.id, date, shift)} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors mb-1">
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-500 text-white flex items-center justify-center text-xs font-bold shrink-0">{(emp.name || '?')[0]}</div>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-sm font-medium text-gray-900 dark:text-white block truncate">{emp.name}</span>
                                        {emp.employee_id && <span className="text-[10px] text-gray-400">{emp.employee_id}</span>}
                                    </div>
                                    {hasReg && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-md">Đã ĐK</span>}
                                    <span className="material-symbols-outlined text-gray-300 dark:text-gray-600 text-lg">add</span>
                                </div>
                            );
                        })}
                        {filteredEmployees.length === 0 && (
                            <div className="py-8 text-center">
                                <div className="w-12 h-12 bg-gray-50 dark:bg-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <span className="material-symbols-outlined text-2xl text-gray-400">{search ? 'search_off' : 'group'}</span>
                                </div>
                                <p className="text-sm font-medium text-gray-500">{search ? 'Không tìm thấy nhân viên' : 'Không có nhân viên'}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AssignPopup;
