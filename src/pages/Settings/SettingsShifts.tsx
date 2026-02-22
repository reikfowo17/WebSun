import React, { useState } from 'react';
import { SystemService, ShiftConfig } from '../../services/system';

interface SettingsShiftsProps {
    toast: any;
    initialShifts: ShiftConfig[];
}

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

    const handleDragLeave = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
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

    return (
        <div className="stg-section-animate">
            <div className="stg-table-wrap">
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #e2e8f0', background: '#fff', gap: '8px' }}>
                    <button onClick={handleAddShift} className="stg-btn stg-btn-outline" disabled={saving}>
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
                            : <span className="material-symbols-outlined" style={{ fontSize: 16 }}>cloud_done</span>
                        }
                        {saving ? 'Đang lưu...' : 'Triển khai Ca'}
                    </button>
                </div>
                <table className="stg-table stg-table-fixed">
                    <colgroup>
                        <col style={{ width: '8%' }} />
                        <col style={{ width: '42%' }} />
                        <col style={{ width: '42%' }} />
                        <col style={{ width: '8%' }} />
                    </colgroup>
                    <thead>
                        <tr>
                            <th style={{ paddingLeft: '36px' }}>MÃ</th>
                            <th style={{ paddingLeft: '8px' }}>TÊN CA</th>
                            <th style={{ paddingLeft: '8px' }}>KHUNG GIỜ</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {shifts.map((shift, i) => (
                            <tr
                                key={shift.id || i}
                                className={`stg-table-row ${draggedShiftIndex === i ? 'dragging' : ''}`}
                                draggable={dragShiftId === i || draggedShiftIndex === i}
                                onDragStart={(e) => handleDragStart(e, i)}
                                onDragOver={(e) => handleDragOver(e, i)}
                                onDragLeave={(e) => handleDragLeave(e, i)}
                                onDrop={(e) => handleDrop(e, i)}
                                onDragEnd={handleDragEnd}
                                style={{
                                    borderTop: dragOverIndex === i && draggedShiftIndex !== i && dragOverIndex < (draggedShiftIndex || 0) ? '2px solid #3b82f6' : undefined,
                                    borderBottom: dragOverIndex === i && draggedShiftIndex !== i && dragOverIndex > (draggedShiftIndex || 0) ? '2px solid #3b82f6' : undefined,
                                }}
                            >
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '16px' }}>
                                        <span
                                            className="material-symbols-outlined drag-handle"
                                            style={{ cursor: 'grab', color: '#cbd5e1', fontSize: '20px' }}
                                            onMouseEnter={() => setDragShiftId(i)}
                                            onMouseLeave={() => setDragShiftId(null)}
                                        >drag_indicator</span>
                                        <span className="stg-row-num">{i + 1}</span>
                                    </div>
                                </td>
                                <td>
                                    <div className="stg-shift-name-cell">
                                        <span className="material-symbols-outlined stg-shift-inline-icon">
                                            {shift.icon === 'schedule' ? (i === 0 ? 'light_mode' : i === 1 ? 'partly_cloudy_day' : i === 2 ? 'dark_mode' : 'schedule') : (shift.icon || 'schedule')}
                                        </span>
                                        {editingShiftIndex === i ? (
                                            <input
                                                type="text"
                                                value={draftShift?.name || ''}
                                                onChange={(e) => handleUpdateDraftShift('name', e.target.value)}
                                                className="stg-input"
                                                placeholder="VD: Ca Sáng"
                                                autoFocus
                                            />
                                        ) : (
                                            <span style={{ fontWeight: 500, color: '#334155' }}>
                                                {shift.name || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Chưa đặt tên</span>}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td>
                                    {editingShiftIndex === i ? (
                                        <input
                                            type="text"
                                            value={draftShift?.time || ''}
                                            onChange={(e) => handleUpdateDraftShift('time', e.target.value)}
                                            className="stg-input stg-input-mono"
                                            placeholder="06:00 – 14:00"
                                        />
                                    ) : (
                                        <span className="stg-input-mono" style={{ color: '#475569' }}>
                                            {shift.time || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Chưa có giờ</span>}
                                        </span>
                                    )}
                                </td>
                                <td>
                                    <div className="stg-row-actions">
                                        {editingShiftIndex === i ? (
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
                        ))}
                    </tbody>
                </table>
                {shifts.length === 0 && (
                    <div className="stg-empty">
                        <span className="material-symbols-outlined">event_busy</span>
                        <p>Chưa có dữ liệu ca làm việc</p>
                        <button onClick={handleAddShift} className="stg-btn stg-btn-outline" style={{ marginTop: 12 }} disabled={saving}>
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                            Tạo ca đầu tiên
                        </button>
                    </div>
                )}
            </div>
            {/* Info Banner */}
            <div className="stg-info-banner">
                <span className="material-symbols-outlined">info</span>
                <span>Thay đổi cấu hình ca sẽ áp dụng cho toàn bộ hệ thống kiểm kho khi <strong>Triển khai</strong>.</span>
            </div>
        </div>
    );
};
