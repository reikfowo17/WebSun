import React, { useState, useEffect, useMemo } from 'react';
import { ToastContextType } from '../../contexts/ToastContext';
import type { ChecklistTemplate, ChecklistCategory, ShiftType, DayOfWeek } from '../../types/shift';
import { CHECKLIST_LABELS, CHECKLIST_ICONS, DAY_LABELS } from '../../types/shift';
import { ChecklistService } from '../../services/shift';
import ConfirmDialog from '../../components/ConfirmDialog';
import { DayPillToggle } from '../../components/PillToggle';

import type { Store } from '../../types';

interface SettingsChecklistProps {
    toast: ToastContextType;
    stores: Store[];
}

const CATEGORIES: ChecklistCategory[] = ['START_SHIFT', 'MID_SHIFT', 'END_SHIFT', 'HANDOVER', 'NOTE'];
const SHIFTS: { id: ShiftType, label: string }[] = [
    { id: 'MORNING', label: 'Sáng' },
    { id: 'AFTERNOON', label: 'Chiều' },
    { id: 'EVENING', label: 'Tối' }
];

export const SettingsChecklist: React.FC<SettingsChecklistProps> = ({ toast, stores }) => {
    const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // Master Selection Context
    const [selectedContext, setSelectedContext] = useState<string>('GLOBAL');

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draft, setDraft] = useState<Partial<ChecklistTemplate>>({});
    const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

    useEffect(() => {
        loadTemplates();
    }, []);

    const loadTemplates = async () => {
        setLoading(true);
        try {
            const data = await ChecklistService.getTemplates();
            setTemplates(data);
        } catch (err: unknown) {
            toast.error('Lỗi tải checklist: ' + (err instanceof Error ? err.message : String(err)));
        } finally {
            setLoading(false);
        }
    };

    const filteredTemplates = useMemo(() => {
        return templates.filter(t => {
            if (selectedContext === 'GLOBAL') {
                return t.store_ids === null;
            }
            return t.store_ids?.includes(selectedContext);
        });
    }, [templates, selectedContext]);

    const handleAdd = (defaultCategory?: ChecklistCategory) => {
        setEditingId(null);
        setDraft({
            category: defaultCategory || 'START_SHIFT',
            title: '',
            requires_note: false,
            requires_photo: false,
            sort_order: templates.length + 1,
            shift_types: ['MORNING', 'AFTERNOON', 'EVENING'] as ShiftType[],
            day_of_week: null,
            store_ids: selectedContext === 'GLOBAL' ? null : [selectedContext],
            is_active: true,
        });
        setModalOpen(true);
    };

    const handleEdit = (template: ChecklistTemplate) => {
        setEditingId(template.id);
        setDraft({ ...template });
        setModalOpen(true);
    };

    const handleSave = async () => {
        if (!draft.title?.trim()) {
            toast.error('Vui lòng nhập nội dung công việc');
            return;
        }
        setSaving(true);
        try {
            if (editingId) {
                const updated = await ChecklistService.updateTemplate(editingId, draft);
                setTemplates(prev => prev.map(t => t.id === editingId ? updated : t));
                toast.success('Đã cập nhật công việc');
            } else {
                const payload = {
                    ...draft,
                    store_ids: selectedContext === 'GLOBAL' ? null : [selectedContext]
                };
                const created = await ChecklistService.createTemplate(payload as Partial<ChecklistTemplate>);
                setTemplates(prev => [...prev, created]);
                toast.success('Đã thêm công việc mới');
            }
            setModalOpen(false);
            setDraft({});
            setEditingId(null);
        } catch (err: unknown) {
            toast.error('Lỗi: ' + (err instanceof Error ? err.message : String(err)));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (template: ChecklistTemplate) => {
        setConfirmDialog({
            title: 'Xóa mục công việc',
            message: `Bạn có chắc muốn xóa "${template.title}" khỏi ${selectedContext === 'GLOBAL' ? 'Cấu hình chung' : stores.find(s => s.id === selectedContext)?.name}?`,
            onConfirm: async () => {
                setConfirmDialog(null);
                try {
                    await ChecklistService.deleteTemplate(template.id);
                    setTemplates(prev => prev.filter(t => t.id !== template.id));
                    toast.success('Đã xóa mục công việc');
                } catch (err: unknown) {
                    toast.error('Lỗi: ' + (err instanceof Error ? err.message : String(err)));
                }
            },
        });
    };

    const handleToggleShift = async (template: ChecklistTemplate, shift: ShiftType) => {
        const currentShifts = template.shift_types || [];
        const isActive = currentShifts.includes(shift);
        const newShifts = isActive ? currentShifts.filter(s => s !== shift) : [...currentShifts, shift];
        
        try {
            const updated = await ChecklistService.updateTemplate(template.id, { shift_types: newShifts });
            setTemplates(prev => prev.map(t => t.id === template.id ? updated : t));
        } catch (err: unknown) {
            toast.error('Lỗi đổi thuộc tính ca: ' + (err instanceof Error ? err.message : String(err)));
        }
    };

    // Render a Kanban Card
    const renderCard = (template: ChecklistTemplate) => {
        return (
            <div key={template.id} className="stg-kanban-card group">
                <div className="stg-kanban-card-header">
                    <span className="stg-kanban-card-title">{template.title}</span>
                    <div className="stg-kanban-card-actions">
                        <button onClick={() => handleEdit(template)} className="stg-btn-icon stg-kanban-action" title="Sửa chi tiết">
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                        </button>
                        <button onClick={() => handleDelete(template)} className="stg-btn-icon stg-kanban-action text-red-500" title="Xóa tác vụ">
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete_outline</span>
                        </button>
                    </div>
                </div>
                
                <div className="stg-kanban-card-tags">
                    
                    {/* Quick Shift Toggles */}
                    <div>
                        <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1">
                            <span className="material-symbols-outlined" style={{fontSize: 12}}>schedule</span> Áp dụng ca
                        </div>
                        <div className="flex gap-1.5">
                            {SHIFTS.map(s => {
                                const active = template.shift_types?.includes(s.id);
                                return (
                                    <button 
                                        key={s.id}
                                        onClick={() => handleToggleShift(template, s.id)}
                                        className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${
                                            active 
                                            ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100' 
                                            : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'
                                        }`}
                                    >
                                        {s.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Days */}
                    {!template.day_of_week ? (
                        <div className="stg-kanban-tag-group w-full bg-green-50/50 rounded-lg p-1.5 border border-green-100/50">
                            <span className="material-symbols-outlined stg-kanban-tag-icon text-green-600">event_available</span>
                            <span className="text-xs font-semibold text-green-700">Mọi ngày trong tuần</span>
                        </div>
                    ) : (
                        <div className="stg-kanban-tag-group">
                            <span className="material-symbols-outlined stg-kanban-tag-icon">calendar_month</span>
                            {template.day_of_week.map(d => (
                                <span key={d} className="stg-badge" style={{ fontSize: 9, background: '#f3f4f6', color: '#4b5563', padding: '1px 5px' }}>
                                    {DAY_LABELS[d as DayOfWeek].replace('Thứ ', 'T')}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="stg-section-animate flex h-full rounded-2xl overflow-hidden border border-gray-200 bg-white">
            
            {/* Left Sidebar - Context Selector */}
            <div className="w-[300px] border-r border-gray-200 bg-gray-50 flex flex-col shrink-0">
                <div className="px-5 py-4 border-b border-gray-200/60 bg-white">
                    <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                        <span className="material-symbols-outlined text-blue-600">view_sidebar</span>
                        Phạm vi thiết lập
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">Chọn nơi áp dụng công việc</p>
                </div>
                <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1.5">
                    <button
                        onClick={() => setSelectedContext('GLOBAL')}
                        className={`flex items-center gap-3 w-full p-3 rounded-lg text-left transition-all ${
                            selectedContext === 'GLOBAL' 
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
                                : 'hover:bg-gray-200/50 text-gray-700'
                        }`}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>public</span>
                        <div className="flex flex-col">
                            <span className="font-semibold text-sm">Cấu hình chung</span>
                            <span className={`text-[11px] ${selectedContext === 'GLOBAL' ? 'text-blue-200' : 'text-gray-500'}`}>Áp dụng toàn bộ cửa hàng</span>
                        </div>
                    </button>
                    
                    <div className="flex items-center gap-2 mt-4 mb-2 px-2">
                        <div className="h-px bg-gray-200 flex-1"></div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Hoặc Cửa Hàng Riêng</span>
                        <div className="h-px bg-gray-200 flex-1"></div>
                    </div>

                    {stores.map(store => (
                        <button
                            key={store.id}
                            onClick={() => setSelectedContext(store.id)}
                            className={`flex items-center gap-3 w-full p-2.5 rounded-lg text-left transition-all ${
                                selectedContext === store.id 
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
                                    : 'hover:bg-gray-200/50 text-gray-700'
                            }`}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>storefront</span>
                            <div className="flex flex-col truncate">
                                <span className="font-semibold text-sm truncate">{store.name}</span>
                                <span className={`text-[11px] truncate ${selectedContext === store.id ? 'text-blue-200' : 'text-gray-500'}`}>{store.address}</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Right Main Area */}
            <div className="flex-1 flex flex-col bg-[#F9FAFB] min-w-0">
                <div className="px-6 py-5 border-b border-gray-200/70 bg-white flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
                            {selectedContext === 'GLOBAL' ? 'Công việc Cố định Toàn hệ thống' : `Công việc riêng: ${stores.find(s => s.id === selectedContext)?.name}`}
                        </h2>
                        <p className="text-sm text-gray-500 font-medium mt-1">Danh sách công việc trong khu vực thiết lập này</p>
                    </div>
                    <div>
                        <button onClick={() => handleAdd()} className="stg-btn stg-btn-primary shadow-sm" disabled={loading}>
                            <span className="material-symbols-outlined">add</span>
                            Thêm công việc
                        </button>
                    </div>
                </div>

                {/* Kanban Board */}
                <div className="stg-kanban-board">
                    {CATEGORIES.map(category => {
                        const categoryItems = filteredTemplates.filter(t => t.category === category)
                            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

                        return (
                            <div key={category} className="stg-kanban-column">
                                <div className="stg-kanban-column-header">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center border border-gray-100 shrink-0">
                                            <span className="material-symbols-outlined text-blue-600" style={{ fontSize: 18 }}>
                                                {CHECKLIST_ICONS[category]}
                                            </span>
                                        </div>
                                        <h3 className="stg-kanban-column-title text-sm tracking-wide">{CHECKLIST_LABELS[category]}</h3>
                                        <span className="stg-kanban-count ml-auto bg-gray-200 text-gray-700">{categoryItems.length}</span>
                                    </div>
                                    <button onClick={() => handleAdd(category)} className="stg-btn-icon stg-kanban-add-btn opacity-0 group-hover:opacity-100 transition mt-2 w-full h-8 bg-gray-100/50 hover:bg-gray-200 rounded text-gray-600 text-xs font-semibold flex items-center justify-center gap-1" title={`Thêm vào ${CHECKLIST_LABELS[category]}`}>
                                        <span className="material-symbols-outlined" style={{fontSize: 14}}>add</span> Thêm
                                    </button>
                                </div>
                                
                                <div className="stg-kanban-column-content">
                                    {loading ? (
                                        <div className="stg-kanban-loading">
                                            <span className="material-symbols-outlined stg-spin text-gray-300">progress_activity</span>
                                        </div>
                                    ) : categoryItems.length === 0 ? (
                                        <div className="stg-kanban-empty">
                                            Kéo thả hoặc thêm nhiệm vụ
                                        </div>
                                    ) : (
                                        categoryItems.map(template => renderCard(template))
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Edit Modal */}
            {modalOpen && (
                <div className="stg-modal-overlay" onClick={() => setModalOpen(false)}>
                    <div className="stg-modal-content" onClick={e => e.stopPropagation()}>
                        <div className="stg-modal-header">
                            <h3>{editingId ? 'Chỉnh sửa Nhiệm vụ' : 'Tạo Nhiệm vụ Mới'}</h3>
                            <button className="stg-btn-icon" onClick={() => setModalOpen(false)}>
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="stg-modal-body flex flex-col gap-4">
                            
                            {/* Target info (Read only representation of context) */}
                            <div className="flex items-center gap-3 p-3 bg-blue-50/50 border border-blue-100/50 rounded-xl mb-1">
                                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined">{selectedContext === 'GLOBAL' ? 'public' : 'storefront'}</span>
                                </div>
                                <div>
                                    <div className="text-[11px] font-bold uppercase tracking-wider text-blue-800/60 mb-0.5">Phân bổ</div>
                                    <div className="text-sm font-semibold text-blue-900">
                                        {selectedContext === 'GLOBAL' ? 'Cấu hình chung toàn hệ thống' : stores.find(s => s.id === selectedContext)?.name}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="stg-field-label">Tên nhiệm vụ <span style={{ color: 'red' }}>*</span></label>
                                <input
                                    type="text"
                                    className="stg-input mt-1 shadow-sm"
                                    value={draft.title || ''}
                                    onChange={e => setDraft(p => ({ ...p, title: e.target.value }))}
                                    placeholder="Ví dụ: Quét nhà, Kiểm tra tủ đông..."
                                    autoFocus
                                />
                            </div>

                            <div style={{ display: 'flex', gap: 16 }}>
                                <div style={{ flex: 1 }}>
                                    <label className="stg-field-label">Nhóm (Kanban)</label>
                                    <select
                                        className="stg-input mt-1 shadow-sm"
                                        value={draft.category || 'START_SHIFT'}
                                        onChange={e => setDraft(p => ({ ...p, category: e.target.value as ChecklistCategory }))}
                                    >
                                        {CATEGORIES.map(cat => (
                                            <option key={cat} value={cat}>{CHECKLIST_LABELS[cat]}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ width: 100 }}>
                                    <label className="stg-field-label">Khoảng</label>
                                    <input
                                        type="number"
                                        className="stg-input mt-1 shadow-sm text-center"
                                        value={draft.sort_order || 0}
                                        onChange={e => setDraft(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))}
                                    />
                                </div>
                            </div>

                            {/* Note / Photo Toggles */}
                            <div className="grid grid-cols-2 gap-3 mt-1">
                                <label className="flex items-center justify-between p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-gray-500">draw</span>
                                        <span className="text-sm font-medium text-gray-700">Yêu cầu Ghi chú</span>
                                    </div>
                                    <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" checked={draft.requires_note || false} onChange={e => setDraft(p => ({ ...p, requires_note: e.target.checked }))} />
                                </label>
                                <label className="flex items-center justify-between p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-gray-500">photo_camera</span>
                                        <span className="text-sm font-medium text-gray-700">Yêu cầu Chụp ảnh</span>
                                    </div>
                                    <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" checked={draft.requires_photo || false} onChange={e => setDraft(p => ({ ...p, requires_photo: e.target.checked }))} />
                                </label>
                            </div>

                            <div>
                                <label className="stg-field-label mb-2 border-t border-gray-100 pt-4">Giới hạn Ngày trong tuần</label>
                                <DayPillToggle
                                    days={[2, 3, 4, 5, 6, 7, 1]}
                                    labels={DAY_LABELS as Record<number, string>}
                                    selected={draft.day_of_week === undefined ? null : (draft.day_of_week as number[] | null)}
                                    onChange={val => setDraft(p => ({ ...p, day_of_week: val as DayOfWeek[] | null }))}
                                />
                                <div className="text-xs text-gray-500 mt-2 flex items-center gap-1.5"><span className="material-symbols-outlined text-[14px]">info</span>Bỏ trống nếu áp dụng mọi ngày. Tùy chọn <b>ca làm (Ca Sáng/Chiều)</b> có thể bật tắt nhanh ngay ngoài lưới Kanban.</div>
                            </div>

                        </div>
                        <div className="stg-modal-footer mt-auto">
                            <button className="stg-btn bg-white border border-gray-300 shadow-sm text-gray-700 hover:bg-gray-50 font-medium" onClick={() => setModalOpen(false)}>
                                Hủy bỏ
                            </button>
                            <button className="stg-btn stg-btn-primary shadow-sm px-6" onClick={handleSave} disabled={saving}>
                                {saving ? <span className="material-symbols-outlined stg-spin">progress_activity</span> : 'Lưu cài đặt'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {confirmDialog && (
                <ConfirmDialog
                    title={confirmDialog.title}
                    message={confirmDialog.message}
                    onConfirm={confirmDialog.onConfirm}
                    onCancel={() => setConfirmDialog(null)}
                />
            )}
        </div>
    );
};
