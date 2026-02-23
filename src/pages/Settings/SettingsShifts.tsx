import React, { useState } from 'react';
import { SystemService, ShiftConfig } from '../../services/system';

interface SettingsShiftsProps {
    toast: any;
    initialShifts: ShiftConfig[];
}

const SHIFT_ICONS: Record<number, string> = {
    0: 'light_mode',
    1: 'partly_cloudy_day',
    2: 'dark_mode',
};

export const SettingsShifts: React.FC<SettingsShiftsProps> = ({ toast, initialShifts }) => {
    const [shifts, setShifts] = useState<ShiftConfig[]>(initialShifts);
    const [saving, setSaving] = useState(false);

    // Draft states
    const [editingShiftIndex, setEditingShiftIndex] = useState<number | null>(null);
    const [draftShift, setDraftShift] = useState<ShiftConfig | null>(null);

    // Drag states
    const [draggedShiftIndex, setDraggedShiftIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const [dragShiftId, setDragShiftId] = useState<number | null>(null);

    const handleSaveShifts = async () => {
        setSaving(true);
        try {
            const res = await SystemService.saveShifts(shifts);
            if (res.success) {
                toast.success('Lưu cấu hình Ca làm việc thành công');
            } else {
                toast.error(res.message || 'Lưu thất bại');
            }
        } catch (e: unknown) {
            toast.error('Lỗi: ' + (e instanceof Error ? e.message : String(e)));
        } finally {
            setSaving(false);
        }
    };

    const autoSaveShifts = async (newShifts: ShiftConfig[]) => {
        setSaving(true);
        try {
            const res = await SystemService.saveShifts(newShifts);
            if (!res.success) {
                toast.error(res.message || 'Lưu thứ tự thất bại');
            }
        } catch (e: unknown) {
            toast.error('Lỗi: ' + (e instanceof Error ? e.message : String(e)));
        } finally {
            setSaving(false);
        }
    };

    const handleAddShift = () => {
        if (editingShiftIndex !== null) return;
        const newShift: ShiftConfig = { id: shifts.length + 1, name: '', time: '', icon: 'schedule', color: 'from-gray-400 to-gray-500' };
        setShifts([...shifts, newShift]);
        setEditingShiftIndex(shifts.length);
        setDraftShift(newShift);
    };

    const handleEditShift = (index: number) => {
        if (editingShiftIndex !== null) return;
        setEditingShiftIndex(index);
        setDraftShift(shifts[index]);
    };

    const handleUpdateDraftShift = (field: keyof ShiftConfig, value: string) => {
        if (draftShift) {
            setDraftShift({ ...draftShift, [field]: value });
        }
    };

    const handleSaveDraftShift = (index: number) => {
        if (!draftShift) return;
        const newShifts = [...shifts];
        newShifts[index] = draftShift;
        setShifts(newShifts);
        setEditingShiftIndex(null);
        setDraftShift(null);
    };

    const handleCancelShift = (index: number) => {
        if (shifts[index].name === '' && shifts[index].time === '') {
            const newShifts = shifts.filter((_, i) => i !== index);
            setShifts(newShifts);
        }
        setEditingShiftIndex(null);
        setDraftShift(null);
    };

    const handleRemoveShift = (index: number) => {
        if (!window.confirm(`Xóa ca "${shifts[index].name || 'chưa đặt tên'}"?`)) return;
        const remaining = shifts.filter((_, i) => i !== index);
        const newShifts = remaining.map((shift, idx) => ({ ...shift, id: idx + 1 }));
        setShifts(newShifts);
        autoSaveShifts(newShifts);
    };

    const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
        setDraggedShiftIndex(index);
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', index.toString());
            setTimeout(() => {
                if (e.target instanceof HTMLElement) {
                    e.target.style.opacity = '0.5';
                }
            }, 0);
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragOverIndex !== index) {
            setDragOverIndex(index);
        }
    };

    const handleDragLeave = (_e: React.DragEvent<HTMLTableRowElement>, index: number) => {
        if (dragOverIndex === index) {
            setDragOverIndex(null);
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLTableRowElement>, targetIndex: number) => {
        e.preventDefault();
        setDragOverIndex(null);

        if (draggedShiftIndex === null || draggedShiftIndex === targetIndex) {
            if (e.currentTarget instanceof HTMLElement) {
                e.currentTarget.style.opacity = '1';
            }
            return;
        }

        const newShifts = [...shifts];
        const itemToMove = newShifts[draggedShiftIndex];
        newShifts.splice(draggedShiftIndex, 1);
        newShifts.splice(targetIndex, 0, itemToMove);
        const recalculatedShifts = newShifts.map((shift, idx) => ({
            ...shift,
            id: idx + 1
        }));

        setShifts(recalculatedShifts);
        setDraggedShiftIndex(null);
        if (e.currentTarget instanceof HTMLElement) {
            e.currentTarget.style.opacity = '1';
        }
        autoSaveShifts(recalculatedShifts);
    };

    const handleDragEnd = (e: React.DragEvent<HTMLTableRowElement>) => {
        setDraggedShiftIndex(null);
        setDragOverIndex(null);
        if (e.currentTarget instanceof HTMLElement) {
            e.currentTarget.style.opacity = '1';
        }
    };

    const getShiftIcon = (shift: ShiftConfig, index: number): string => {
        if (shift.icon && shift.icon !== 'schedule') return shift.icon;
        return SHIFT_ICONS[index] || 'schedule';
    };

    return (
        <div className="stg-section-animate">
            <div className="stg-table-wrap">
                {/* ─── Toolbar ─── */}
                <div className="stg-toolbar">
                    <div className="stg-toolbar-left">
                        <span className="stg-badge">{shifts.length} ca làm</span>
                    </div>
                    <div className="stg-toolbar-right">
                        <button
                            onClick={handleAddShift}
                            className="stg-btn stg-btn-outline"
                            disabled={saving || editingShiftIndex !== null}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                            Thêm Ca
                        </button>
                        <button
                            onClick={handleSaveShifts}
                            disabled={saving}
                            className="stg-btn stg-btn-primary"
                        >
                            {saving
                                ? <span className="material-symbols-outlined stg-spin" style={{ fontSize: 16 }}>hourglass_empty</span>
                                : <span className="material-symbols-outlined" style={{ fontSize: 16 }}>rocket_launch</span>
                            }
                            {saving ? 'Đang lưu...' : 'Triển khai'}
                        </button>
                    </div>
                </div>

                {/* ─── Table ─── */}
                <table className="stg-table stg-table-fixed">
                    <colgroup>
                        <col style={{ width: '8%' }} />
                        <col style={{ width: '42%' }} />
                        <col style={{ width: '38%' }} />
                        <col style={{ width: '12%' }} />
                    </colgroup>
                    <thead>
                        <tr>
                            <th style={{ paddingLeft: 36 }}>#</th>
                            <th>TÊN CA LÀM VIỆC</th>
                            <th>KHUNG GIỜ</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {shifts.map((shift, i) => {
                            const isEditing = editingShiftIndex === i;
                            const isNew = shift.name === '' && shift.time === '' && isEditing;
                            return (
                                <tr
                                    key={shift.id || i}
                                    className={`stg-table-row${isNew ? ' stg-row-new' : ''} ${draggedShiftIndex === i ? 'dragging' : ''}`}
                                    draggable={dragShiftId === i || draggedShiftIndex === i}
                                    onDragStart={(e) => handleDragStart(e, i)}
                                    onDragOver={(e) => handleDragOver(e, i)}
                                    onDragLeave={(e) => handleDragLeave(e, i)}
                                    onDrop={(e) => handleDrop(e, i)}
                                    onDragEnd={handleDragEnd}
                                    style={{
                                        borderTop: dragOverIndex === i && draggedShiftIndex !== i && dragOverIndex < (draggedShiftIndex || 0) ? '2px solid var(--stg-primary)' : undefined,
                                        borderBottom: dragOverIndex === i && draggedShiftIndex !== i && dragOverIndex > (draggedShiftIndex || 0) ? '2px solid var(--stg-primary)' : undefined,
                                    }}
                                >
                                    {/* ─ Drag + Number ─ */}
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 16 }}>
                                            <span
                                                className="material-symbols-outlined stg-drag-handle"
                                                onMouseEnter={() => setDragShiftId(i)}
                                                onMouseLeave={() => setDragShiftId(null)}
                                            >drag_indicator</span>
                                            <span className="stg-row-num">{i + 1}</span>
                                        </div>
                                    </td>

                                    {/* ─ Shift Name ─ */}
                                    <td>
                                        <div className="stg-shift-name-cell">
                                            <span className="material-symbols-outlined stg-shift-inline-icon">
                                                {getShiftIcon(shift, i)}
                                            </span>
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    value={draftShift?.name || ''}
                                                    onChange={(e) => handleUpdateDraftShift('name', e.target.value)}
                                                    className="stg-input"
                                                    placeholder="VD: Ca Sáng"
                                                    aria-label="Tên ca làm việc"
                                                    autoFocus
                                                />
                                            ) : (
                                                <span style={{ fontWeight: 600, color: 'var(--stg-text)' }}>
                                                    {shift.name || <span style={{ color: 'var(--stg-text-muted)', fontStyle: 'italic', fontWeight: 400 }}>Chưa đặt tên</span>}
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    {/* ─ Time Range ─ */}
                                    <td>
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                value={draftShift?.time || ''}
                                                onChange={(e) => handleUpdateDraftShift('time', e.target.value)}
                                                className="stg-input stg-input-mono"
                                                placeholder="06:00 – 14:00"
                                                aria-label="Khung giờ ca làm việc"
                                            />
                                        ) : (
                                            <span className="stg-input-mono" style={{ color: 'var(--stg-text-secondary)', fontSize: 13 }}>
                                                {shift.time || <span style={{ color: 'var(--stg-text-muted)', fontStyle: 'italic' }}>Chưa có giờ</span>}
                                            </span>
                                        )}
                                    </td>

                                    {/* ─ Actions ─ */}
                                    <td>
                                        <div className="stg-row-actions" style={isEditing ? { opacity: 1 } : undefined}>
                                            {isEditing ? (
                                                <>
                                                    <button onClick={() => handleSaveDraftShift(i)} className="stg-btn-icon stg-btn-save" title="Lưu">
                                                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check</span>
                                                    </button>
                                                    <button onClick={() => handleCancelShift(i)} className="stg-btn-icon" title="Hủy">
                                                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => handleEditShift(i)} className="stg-btn-icon" title="Chỉnh sửa">
                                                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>
                                                    </button>
                                                    <button onClick={() => handleRemoveShift(i)} className="stg-btn-icon stg-btn-danger" title="Xóa ca này" disabled={saving}>
                                                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete_outline</span>
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {/* ─── Empty State ─── */}
                {shifts.length === 0 && (
                    <div className="stg-empty">
                        <span className="material-symbols-outlined">event_busy</span>
                        <p>Chưa có dữ liệu ca làm việc</p>
                        <p style={{ fontSize: 12, marginBottom: 12 }}>Tạo ca đầu tiên để cấu hình khung giờ làm việc</p>
                        <button onClick={handleAddShift} className="stg-btn stg-btn-primary" disabled={saving}>
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                            Tạo ca đầu tiên
                        </button>
                    </div>
                )}
            </div>

            {/* ─── Info Banner ─── */}
            <div className="stg-info-banner">
                <span className="material-symbols-outlined">info</span>
                <span>Thay đổi cấu hình ca sẽ áp dụng cho toàn bộ hệ thống kiểm kho khi <strong>Triển khai</strong>.</span>
            </div>
        </div>
    );
};
