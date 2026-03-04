import React, { useState } from 'react';
import { ToastContextType } from '../../contexts/ToastContext';
import { SystemService, ShiftConfig } from '../../services/system';
import ConfirmDialog from '../../components/ConfirmDialog';

interface SettingsShiftsProps {
    toast: ToastContextType;
    initialShifts: ShiftConfig[];
}

const DEFAULT_SHIFT_ICONS = ['light_mode', 'partly_cloudy_day', 'dark_mode', 'wb_twilight', 'schedule', 'nights_stay'];
const getDefaultIcon = (index: number) => DEFAULT_SHIFT_ICONS[index % DEFAULT_SHIFT_ICONS.length];

export const SettingsShifts: React.FC<SettingsShiftsProps> = ({ toast, initialShifts }) => {
    const [shifts, setShifts] = useState<ShiftConfig[]>(initialShifts);
    const [saving, setSaving] = useState(false);
    const [editingShiftIndex, setEditingShiftIndex] = useState<number | null>(null);
    const [draftShift, setDraftShift] = useState<ShiftConfig | null>(null);
    const [draggedShiftIndex, setDraggedShiftIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const [dragShiftId, setDragShiftId] = useState<number | null>(null);
    const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

    // ─── Auto-save helper (saves entire shifts array) ───
    const autoSaveShifts = async (newShifts: ShiftConfig[]) => {
        setSaving(true);
        try {
            const res = await SystemService.saveShifts(newShifts);
            if (!res.success) {
                toast.error(res.message || 'Lưu thất bại');
            }
        } catch (e: unknown) {
            toast.error('Lỗi: ' + (e instanceof Error ? e.message : String(e)));
        } finally {
            setSaving(false);
        }
    };

    // ─── Add ───
    const handleAddShift = () => {
        if (editingShiftIndex !== null) return;
        const newShift: ShiftConfig = {
            id: shifts.length > 0 ? Math.max(...shifts.map(s => s.id)) + 1 : 1,
            name: '', time: '', icon: 'schedule', color: 'from-gray-400 to-gray-500',
            type: 'MAIN', max_slots: 0, is_active: true,
        };
        setShifts([...shifts, newShift]);
        setEditingShiftIndex(shifts.length);
        setDraftShift(newShift);
    };

    // ─── Edit ───
    const handleEditShift = (index: number) => {
        if (editingShiftIndex !== null) return;
        setEditingShiftIndex(index);
        setDraftShift(shifts[index]);
    };

    const handleUpdateDraftShift = (field: keyof ShiftConfig, value: string | number) => {
        if (draftShift) {
            setDraftShift({ ...draftShift, [field]: value });
        }
    };

    // ─── Save inline edit → auto-save to server ───
    const handleSaveDraftShift = async (index: number) => {
        if (!draftShift) return;
        if (!draftShift.name || !draftShift.time) {
            toast.error('Vui lòng nhập Tên ca và Khung giờ');
            return;
        }
        const newShifts = [...shifts];
        newShifts[index] = draftShift;
        setShifts(newShifts);
        setEditingShiftIndex(null);
        setDraftShift(null);
        await autoSaveShifts(newShifts);
        toast.success('Lưu ca làm việc thành công');
    };

    // ─── Cancel ───
    const handleCancelShift = (index: number) => {
        if (shifts[index].name === '' && shifts[index].time === '') {
            setShifts(shifts.filter((_, i) => i !== index));
        }
        setEditingShiftIndex(null);
        setDraftShift(null);
    };

    // ─── Toggle active (auto-save) ───
    const handleToggleShiftActive = async (index: number) => {
        const shift = shifts[index];
        const newActive = shift.is_active === false ? true : false;
        const newShifts = [...shifts];
        newShifts[index] = { ...shift, is_active: newActive };
        setShifts(newShifts);
        await autoSaveShifts(newShifts);
        toast.success(`Đã ${newActive ? 'bật' : 'tắt'} ca "${shift.name}"`);
    };

    // ─── Remove (with confirm) ───
    const handleRemoveShift = (index: number) => {
        setConfirmDialog({
            title: 'Xóa ca làm việc',
            message: `Xóa ca "${shifts[index].name || 'chưa đặt tên'}"?`,
            onConfirm: async () => {
                setConfirmDialog(null);
                const remaining = shifts.filter((_, i) => i !== index);
                const newShifts = remaining.map((shift, idx) => ({ ...shift, id: idx + 1 }));
                setShifts(newShifts);
                await autoSaveShifts(newShifts);
                toast.success('Đã xoá ca làm việc');
            },
        });
    };

    // ─── Drag & Drop (auto-save) ───
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
        const recalculatedShifts = newShifts.map((shift, idx) => ({ ...shift, id: idx + 1 }));

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
        return getDefaultIcon(index);
    };

    const activeCount = shifts.filter(s => s.is_active !== false).length;

    return (
        <>
            <div className="stg-section-animate">
                <div className="stg-table-wrap">
                    {/* ─── Toolbar ─── */}
                    <div className="stg-toolbar">
                        <div className="stg-toolbar-left">
                            <span className="stg-badge">{shifts.length} ca làm</span>
                            {shifts.length > 0 && (
                                <span style={{ fontSize: 12, color: 'var(--stg-text-muted)' }}>
                                    · {activeCount} đang hoạt động
                                </span>
                            )}
                        </div>
                        <div className="stg-toolbar-right">
                            <button
                                onClick={handleAddShift}
                                className="stg-btn stg-btn-primary"
                                disabled={saving || editingShiftIndex !== null}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                                Thêm Ca
                            </button>
                        </div>
                    </div>

                    {/* ─── Table ─── */}
                    <table className="stg-table stg-table-fixed">
                        <colgroup>
                            <col style={{ width: '6%' }} />
                            <col style={{ width: '25%' }} />
                            <col style={{ width: '20%' }} />
                            <col style={{ width: '12%' }} />
                            <col style={{ width: '10%' }} />
                            <col style={{ width: '12%' }} />
                            <col style={{ width: '15%' }} />
                        </colgroup>
                        <thead>
                            <tr>
                                <th style={{ paddingLeft: 36 }}>#</th>
                                <th>TÊN CA LÀM</th>
                                <th>KHUNG GIỜ</th>
                                <th>LOẠI CA</th>
                                <th>SLOT TỐI ĐA</th>
                                <th style={{ textAlign: 'center' }}>TRẠNG THÁI</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {shifts.map((shift, i) => {
                                const isEditing = editingShiftIndex === i;
                                const isNew = shift.name === '' && shift.time === '' && isEditing;
                                const isActive = shift.is_active !== false;
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
                                            opacity: !isActive && !isEditing ? 0.55 : 1,
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

                                        {/* ─ Type & Parent ─ */}
                                        <td>
                                            {isEditing ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                    <select
                                                        value={draftShift?.type || 'MAIN'}
                                                        onChange={(e) => handleUpdateDraftShift('type', e.target.value)}
                                                        className="stg-input stg-input-mono"
                                                        style={{ width: '100%', padding: '6px' }}
                                                    >
                                                        <option value="MAIN">Ca Chính</option>
                                                        <option value="SUPPORT">Ca Hỗ Trợ</option>
                                                    </select>
                                                    {draftShift?.type === 'SUPPORT' && (
                                                        <select
                                                            value={draftShift?.parent_id || ''}
                                                            onChange={(e) => handleUpdateDraftShift('parent_id', Number(e.target.value))}
                                                            className="stg-input stg-input-mono"
                                                            style={{ width: '100%', padding: '6px' }}
                                                        >
                                                            <option value="">Chọn ca gốc...</option>
                                                            {shifts.filter(s => (s.type || 'MAIN') === 'MAIN').map(s => (
                                                                <option key={s.id} value={s.id}>{s.name || `Ca ${s.id}`}</option>
                                                            ))}
                                                        </select>
                                                    )}
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span className="stg-badge" style={{ alignSelf: 'flex-start', fontSize: 11, padding: '2px 6px', background: (shift.type || 'MAIN') === 'MAIN' ? 'var(--stg-primary-light)' : 'var(--stg-surface-hover)' }}>
                                                        {(shift.type || 'MAIN') === 'MAIN' ? 'Chính' : 'Hỗ trợ'}
                                                    </span>
                                                    {shift.type === 'SUPPORT' && shift.parent_id && (
                                                        <span style={{ fontSize: 11, color: 'var(--stg-text-muted)', marginTop: 4 }}>
                                                            ↳ {shifts.find(s => s.id === shift.parent_id)?.name || `Ca ${shift.parent_id}`}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </td>

                                        {/* ─ Max Slots ─ */}
                                        <td>
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={draftShift?.max_slots || ''}
                                                    onChange={(e) => handleUpdateDraftShift('max_slots', parseInt(e.target.value) || 0)}
                                                    className="stg-input"
                                                    placeholder="VD: 3"
                                                    aria-label="Số slot"
                                                />
                                            ) : (
                                                <span style={{ fontWeight: 600, color: 'var(--stg-text)' }}>
                                                    {shift.max_slots ? `${shift.max_slots} người` : <span style={{ color: 'var(--stg-text-muted)', fontWeight: 400 }}>Không giới hạn</span>}
                                                </span>
                                            )}
                                        </td>

                                        {/* ─ Active Toggle ─ */}
                                        <td style={{ textAlign: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                                <span className={`stg-status-dot ${isActive ? 'active' : 'inactive'}`} />
                                                <button
                                                    className={`stg-toggle-btn ${isActive ? 'active' : 'inactive'}`}
                                                    onClick={() => handleToggleShiftActive(i)}
                                                    disabled={saving || isEditing}
                                                    title={isActive ? 'Đang hoạt động — bấm để tắt' : 'Đã tắt — bấm để bật'}
                                                    aria-label={`Trạng thái ca ${shift.name}: ${isActive ? 'Hoạt động' : 'Ngưng'}`}
                                                >
                                                    <span className="stg-toggle-knob" />
                                                </button>
                                                <span className={`stg-status-label ${isActive ? 'active' : 'inactive'}`}>
                                                    {isActive ? 'Bật' : 'Tắt'}
                                                </span>
                                            </div>
                                        </td>

                                        {/* ─ Actions ─ */}
                                        <td>
                                            <div className="stg-row-actions" style={isEditing ? { opacity: 1 } : undefined}>
                                                {isEditing ? (
                                                    <>
                                                        <button onClick={() => handleSaveDraftShift(i)} className="stg-btn-icon stg-btn-save" title="Lưu vào hệ thống" disabled={saving}>
                                                            {saving
                                                                ? <span className="material-symbols-outlined stg-spin" style={{ fontSize: 18 }}>progress_activity</span>
                                                                : <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check</span>
                                                            }
                                                        </button>
                                                        <button onClick={() => handleCancelShift(i)} className="stg-btn-icon" title="Hủy" disabled={saving}>
                                                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button onClick={() => handleEditShift(i)} className="stg-btn-icon" title="Chỉnh sửa" disabled={saving}>
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
            </div>

            {confirmDialog && (
                <ConfirmDialog
                    title={confirmDialog.title}
                    message={confirmDialog.message}
                    onConfirm={confirmDialog.onConfirm}
                    onCancel={() => setConfirmDialog(null)}
                />
            )}
        </>
    );
};
