import React, { useState, useMemo } from 'react';
import type { ScheduleRegistration, ScheduleAssignment, AssignmentTag } from '../../services/schedule';
import type { StoreShift } from '../../services/schedule';
import { DAY_LABELS, formatDateShort, TAG_CONFIG } from '../../hooks/useSchedule';

interface AssignPopupProps {
    date: string;
    shift: number;
    storeId: string;
    weekDates: string[];
    storeShifts: StoreShift[];
    storeName: string;
    employees: { id: string; name: string; employee_id: string; avatar_url?: string }[];
    slotRegs: ScheduleRegistration[];
    slotAsgns: ScheduleAssignment[];
    processing: string | null;
    onAssign: (userId: string, storeId: string, date: string, shift: number, opts?: { custom_start?: string; custom_end?: string; tag?: AssignmentTag }) => void;
    onRemove: (aId: string, userName?: string) => void;
    onUpdate: (aId: string, updates: { custom_start?: string | null; custom_end?: string | null; tag?: AssignmentTag | null }) => void;
    onClose: () => void;
}

const AssignPopup: React.FC<AssignPopupProps> = ({
    date, shift, storeId, weekDates, storeShifts, storeName,
    employees, slotRegs, slotAsgns, processing,
    onAssign, onRemove, onUpdate, onClose,
}) => {
    const [search, setSearch] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTag, setEditTag] = useState<AssignmentTag | ''>('');
    const [editCustomStart, setEditCustomStart] = useState('');
    const [editCustomEnd, setEditCustomEnd] = useState('');

    const shiftCfg = storeShifts.find(s => s.id === shift);
    const shiftName = shiftCfg?.name || `Ca ${shift}`;
    const shiftTime = shiftCfg ? `${shiftCfg.time_start} - ${shiftCfg.time_end}` : '';
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
            list = list.filter(e => e.name.toLowerCase().includes(q) || e.employee_id?.toLowerCase().includes(q));
        }
        return list;
    }, [employees, slotAsgns, search]);

    const openEdit = (a: ScheduleAssignment) => {
        setEditingId(a.id);
        setEditTag((a.tag as AssignmentTag) || '');
        setEditCustomStart(a.custom_start || '');
        setEditCustomEnd(a.custom_end || '');
    };

    const saveEdit = () => {
        if (!editingId) return;
        onUpdate(editingId, {
            tag: (editTag as AssignmentTag) || null,
            custom_start: editCustomStart || null,
            custom_end: editCustomEnd || null,
        });
        setEditingId(null);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-[#1a1a1a] rounded-2xl w-full max-w-md shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden max-h-[85vh] flex flex-col">
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
                            {dayLabel} {formatDateShort(date)} — {shiftName} ({shiftTime})
                        </p>
                        <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mt-0.5">📍 {storeName}</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center text-gray-400 transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 p-4 space-y-4">
                    {/* Already assigned */}
                    {slotAsgns.length > 0 && (
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Đã xếp ({slotAsgns.length})</p>
                            {slotAsgns.map(a => (
                                <div key={a.id} className="mb-2">
                                    <div className={`flex items-center gap-3 p-2.5 rounded-xl border ${a.tag ? `${TAG_CONFIG[a.tag].bg} ${TAG_CONFIG[a.tag].bgDark} border-transparent` : 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/20'}`}>
                                        <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0">{(a.user_name || '?')[0]}</div>
                                        <div className="flex-1 min-w-0">
                                            <span className="text-sm font-semibold text-gray-900 dark:text-white block truncate">{a.user_name}</span>
                                            {(a.custom_start || a.custom_end) && (
                                                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">
                                                    {a.custom_start ? `từ ${a.custom_start}` : ''} {a.custom_end ? `đến ${a.custom_end}` : ''}
                                                </span>
                                            )}
                                            {a.tag && (
                                                <span className="text-[10px] font-bold ml-1" style={{ color: TAG_CONFIG[a.tag].color }}>
                                                    • {TAG_CONFIG[a.tag].label}
                                                </span>
                                            )}
                                        </div>
                                        <button onClick={() => openEdit(a)} className="text-gray-400 hover:text-indigo-500 transition-colors" title="Chỉnh sửa">
                                            <span className="material-symbols-outlined text-lg">edit</span>
                                        </button>
                                        <button onClick={() => onRemove(a.id, a.user_name)} disabled={processing === 'remove-' + a.id} className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50">
                                            <span className="material-symbols-outlined text-lg">remove_circle</span>
                                        </button>
                                    </div>

                                    {/* Inline edit panel */}
                                    {editingId === a.id && (
                                        <div className="mt-1.5 p-3 bg-gray-50 dark:bg-[#111] rounded-xl border border-gray-200 dark:border-gray-700 space-y-2.5">
                                            <div className="flex gap-2">
                                                <div className="flex-1">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Giờ vào</label>
                                                    <input type="time" value={editCustomStart} onChange={e => setEditCustomStart(e.target.value)}
                                                        className="w-full mt-0.5 text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white" />
                                                </div>
                                                <div className="flex-1">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Giờ ra</label>
                                                    <input type="time" value={editCustomEnd} onChange={e => setEditCustomEnd(e.target.value)}
                                                        className="w-full mt-0.5 text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white" />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-400 uppercase">Đánh dấu</label>
                                                <div className="flex flex-wrap gap-1.5 mt-1">
                                                    <button onClick={() => setEditTag('')}
                                                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${editTag === '' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white dark:bg-[#1a1a1a] text-gray-500 border-gray-200 dark:border-gray-700'}`}>
                                                        Không
                                                    </button>
                                                    {(Object.keys(TAG_CONFIG) as AssignmentTag[]).map(tag => (
                                                        <button key={tag} onClick={() => setEditTag(tag)}
                                                            className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors flex items-center gap-1 ${editTag === tag ? 'border-2' : 'bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-gray-700'}`}
                                                            style={editTag === tag ? { borderColor: TAG_CONFIG[tag].color, color: TAG_CONFIG[tag].color, backgroundColor: `${TAG_CONFIG[tag].color}15` } : {}}>
                                                            <span className="material-symbols-outlined" style={{ fontSize: 12, color: TAG_CONFIG[tag].color }}>{TAG_CONFIG[tag].icon}</span>
                                                            {TAG_CONFIG[tag].label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex gap-2 pt-1">
                                                <button onClick={saveEdit} className="flex-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors">Lưu</button>
                                                <button onClick={() => setEditingId(null)} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs font-bold rounded-lg hover:bg-gray-200 transition-colors">Hủy</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Registered employees */}
                    {availRegs.length > 0 && (
                        <div>
                            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-2 flex items-center gap-1">
                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>how_to_reg</span>
                                Đã đăng ký ({availRegs.length})
                            </p>
                            {availRegs.map(r => (
                                <div key={r.id} onClick={() => onAssign(r.user_id, storeId, date, shift)} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors mb-1.5">
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0">{(r.user_name || '?')[0]}</div>
                                    <span className="text-sm font-medium text-gray-900 dark:text-white flex-1">{r.user_name}</span>
                                    <span className="material-symbols-outlined text-emerald-500 text-lg">add_circle</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Search + all employees */}
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Tất cả nhân viên</p>
                        <div className="relative mb-3">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">search</span>
                            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm nhân viên..."
                                className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#0a0a0a] text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-indigo-400 transition-colors" autoFocus />
                            {search && (
                                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                                    <span className="material-symbols-outlined text-lg">close</span>
                                </button>
                            )}
                        </div>
                        {filteredEmployees.map(emp => {
                            const hasReg = slotRegs.some(r => r.user_id === emp.id);
                            return (
                                <div key={emp.id} onClick={() => onAssign(emp.id, storeId, date, shift)} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors mb-1">
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
