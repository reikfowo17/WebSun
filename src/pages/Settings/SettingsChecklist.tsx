import React, { useState, useEffect } from 'react';
import { ToastContextType } from '../../contexts/ToastContext';
import type { ChecklistTemplate, ChecklistCategory, ShiftType, DayOfWeek } from '../../types/shift';
import { MultiStoreSelect } from '../../components/MultiStoreSelect';
import { CHECKLIST_LABELS, CHECKLIST_ICONS, DAY_LABELS } from '../../types/shift';
import { ChecklistService } from '../../services/shift';
import ConfirmDialog from '../../components/ConfirmDialog';
import { ShiftPillToggle, DayPillToggle } from '../../components/PillToggle';

import type { Store } from '../../types';

interface SettingsChecklistProps {
    toast: ToastContextType;
    stores: Store[];
}

const CATEGORIES: ChecklistCategory[] = ['HANDOVER', 'NOTE', 'START_SHIFT', 'MID_SHIFT', 'END_SHIFT'];

export const SettingsChecklist: React.FC<SettingsChecklistProps> = ({ toast, stores }) => {
    const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [filterCategory, setFilterCategory] = useState<ChecklistCategory | 'ALL'>('ALL');
    const [filterStore, setFilterStore] = useState<string>('ALL');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draft, setDraft] = useState<Partial<ChecklistTemplate>>({});
    const [isAdding, setIsAdding] = useState(false);
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

    const filtered = templates.filter(t => {
        const matchCat = filterCategory === 'ALL' || t.category === filterCategory;
        const matchStore = filterStore === 'ALL' || (t.store_ids === null) || t.store_ids.includes(filterStore);
        return matchCat && matchStore;
    });

    // ─── Add ───
    const handleAdd = () => {
        if (isAdding || editingId) return;
        setIsAdding(true);
        setDraft({
            category: filterCategory !== 'ALL' ? filterCategory : 'START_SHIFT',
            title: '',
            requires_note: false,
            requires_photo: false,
            sort_order: (filtered.length || templates.length) + 1,
            shift_types: ['MORNING', 'AFTERNOON', 'EVENING'] as ShiftType[],
            day_of_week: null,
            store_ids: filterStore !== 'ALL' ? [filterStore] : null,
            is_active: true,
        });
    };

    const handleSaveNew = async () => {
        if (!draft.title?.trim()) {
            toast.error('Vui lòng nhập nội dung công việc');
            return;
        }
        setSaving(true);
        try {
            const created = await ChecklistService.createTemplate(draft as Partial<ChecklistTemplate>);
            setTemplates(prev => [...prev, created]);
            setIsAdding(false);
            setDraft({});
            toast.success('Đã thêm mục công việc');
        } catch (err: unknown) {
            toast.error('Lỗi: ' + (err instanceof Error ? err.message : String(err)));
        } finally {
            setSaving(false);
        }
    };

    // ─── Edit ───
    const handleEdit = (template: ChecklistTemplate) => {
        if (isAdding || editingId) return;
        setEditingId(template.id);
        setDraft({ ...template });
    };

    const handleSaveEdit = async () => {
        if (!editingId || !draft.title?.trim()) return;
        setSaving(true);
        try {
            const updated = await ChecklistService.updateTemplate(editingId, draft);
            setTemplates(prev => prev.map(t => t.id === editingId ? updated : t));
            setEditingId(null);
            setDraft({});
            toast.success('Đã cập nhật');
        } catch (err: unknown) {
            toast.error('Lỗi: ' + (err instanceof Error ? err.message : String(err)));
        } finally {
            setSaving(false);
        }
    };

    // ─── Delete ───
    const handleDelete = (template: ChecklistTemplate) => {
        setConfirmDialog({
            title: 'Xóa mục công việc',
            message: `Xóa "${template.title}"? Thao tác này không thể hoàn tác.`,
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

    const handleCancel = () => {
        setEditingId(null);
        setIsAdding(false);
        setDraft({});
    };

    return (
        <>
            <div className="stg-section-animate">
                <div className="stg-table-wrap">
                    {/* Toolbar */}
                    <div className="stg-toolbar">
                        <div className="stg-toolbar-left">
                            <span className="stg-badge">{templates.length} mục</span>
                            {/* Category filter */}
                            <div style={{ position: 'relative' }}>
                                <span className="material-symbols-outlined" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: '#9CA3AF', pointerEvents: 'none' }}>filter_list</span>
                                <select
                                    className="stg-input"
                                    style={{ padding: '6px 28px', fontSize: 13, width: 'auto', minWidth: 140, borderRadius: 20, backgroundColor: '#FAFAFA', borderColor: '#E5E7EB', fontWeight: 500, color: '#374151' }}
                                    value={filterCategory}
                                    onChange={e => setFilterCategory(e.target.value as ChecklistCategory | 'ALL')}
                                >
                                    <option value="ALL">Tất cả phân loại</option>
                                    {CATEGORIES.map(cat => (
                                        <option key={cat} value={cat}>{CHECKLIST_LABELS[cat]}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Store filter */}
                            <div style={{ position: 'relative' }}>
                                <span className="material-symbols-outlined" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: '#9CA3AF', pointerEvents: 'none' }}>storefront</span>
                                <select
                                    className="stg-input"
                                    style={{ padding: '6px 28px', fontSize: 13, width: 'auto', minWidth: 150, borderRadius: 20, backgroundColor: '#FAFAFA', borderColor: '#E5E7EB', fontWeight: 500, color: '#374151' }}
                                    value={filterStore}
                                    onChange={e => setFilterStore(e.target.value)}
                                >
                                    <option value="ALL">Tất cả cửa hàng</option>
                                    {stores.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="stg-toolbar-right">
                            <button
                                onClick={handleAdd}
                                className="stg-btn stg-btn-primary"
                                disabled={saving || isAdding || !!editingId}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                                Thêm mục
                            </button>
                        </div>
                    </div>

                    {/* Table */}
                    <table className="stg-table stg-table-fixed">
                        <colgroup>
                            <col style={{ width: '4%' }} />
                            <col style={{ width: '12%' }} />
                            <col style={{ width: '28%' }} />
                            <col style={{ width: '14%' }} />
                            <col style={{ width: '14%' }} />
                            <col style={{ width: '16%' }} />
                            <col style={{ width: '12%' }} />
                        </colgroup>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>PHÂN LOẠI</th>
                                <th>NỘI DUNG CÔNG VIỆC</th>
                                <th>ÁP DỤNG CA</th>
                                <th>NGÀY ÁP DỤNG</th>
                                <th>CỬA HÀNG</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--stg-text-muted)' }}>Đang tải...</td></tr>
                            ) : filtered.length === 0 && !isAdding ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--stg-text-muted)' }}>
                                    Không có mục nào
                                </td></tr>
                            ) : (
                                <>
                                    {filtered.map((template, idx) => {
                                        const isEditing = editingId === template.id;
                                        return (
                                            <tr key={template.id} className={`stg-table-row ${isEditing ? 'stg-row-new' : ''}`}>
                                                <td style={{ paddingLeft: 16 }}>
                                                    <span className="stg-row-num">{idx + 1}</span>
                                                </td>
                                                <td>
                                                    {isEditing ? (
                                                        <select
                                                            className="stg-input stg-input-mono"
                                                            style={{ width: '100%', padding: '6px' }}
                                                            value={draft.category || 'START_SHIFT'}
                                                            onChange={e => setDraft(p => ({ ...p, category: e.target.value as ChecklistCategory }))}
                                                        >
                                                            {CATEGORIES.map(cat => (
                                                                <option key={cat} value={cat}>{CHECKLIST_LABELS[cat]}</option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--stg-text-muted)' }}>
                                                                {CHECKLIST_ICONS[template.category]}
                                                            </span>
                                                            <span className="stg-badge" style={{ fontSize: 10, padding: '2px 6px' }}>
                                                                {CHECKLIST_LABELS[template.category]}
                                                            </span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ fontWeight: 500, color: '#111827', fontSize: 13, lineHeight: '1.4' }}>
                                                    {isEditing ? (
                                                        <input
                                                            type="text"
                                                            className="stg-input"
                                                            value={draft.title || ''}
                                                            onChange={e => setDraft(p => ({ ...p, title: e.target.value }))}
                                                            placeholder="Nội dung công việc..."
                                                            autoFocus
                                                            style={{ width: '100%', fontSize: 13 }}
                                                        />
                                                    ) : (
                                                        <div style={{ wordBreak: 'break-word', paddingRight: 16 }}>{template.title}</div>
                                                    )}
                                                </td>
                                                <td>
                                                    {isEditing ? (
                                                        <ShiftPillToggle
                                                            shifts={['MORNING', 'AFTERNOON', 'EVENING']}
                                                            selected={draft.shift_types === undefined ? (template.shift_types as string[] | null) : (draft.shift_types as string[] | null)}
                                                            onChange={val => setDraft(p => ({ ...p, shift_types: val as ShiftType[] | null }))}
                                                        />
                                                    ) : (
                                                        <div style={{ display: 'flex', gap: 4 }}>
                                                            {template.shift_types?.map(st => (
                                                                <span key={st} className="stg-badge" style={{ fontSize: 10, padding: '1px 5px' }}>
                                                                    {st === 'MORNING' ? 'S' : st === 'AFTERNOON' ? 'C' : 'T'}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                                {/* FIX: Day of week column */}
                                                <td>
                                                    {isEditing ? (
                                                        <DayPillToggle
                                                            days={[2, 3, 4, 5, 6, 7, 1]}
                                                            labels={DAY_LABELS as Record<number, string>}
                                                            selected={draft.day_of_week === undefined ? (template.day_of_week as number[] | null) : (draft.day_of_week as number[] | null)}
                                                            onChange={val => setDraft(p => ({ ...p, day_of_week: val as DayOfWeek[] | null }))}
                                                        />
                                                    ) : (
                                                        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                                            {template.day_of_week === null ? (
                                                                <span className="stg-badge" style={{ fontSize: 9, padding: '1px 5px', background: '#d1fae5', color: '#065f46' }}>Tất cả</span>
                                                            ) : (
                                                                template.day_of_week?.map(d => (
                                                                    <span key={d} className="stg-badge" style={{ fontSize: 9, padding: '1px 4px' }}>
                                                                        {DAY_LABELS[d as DayOfWeek]}
                                                                    </span>
                                                                ))
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                                {/* Multi-Store Selection Column */}
                                                <td>
                                                    {isEditing ? (
                                                        <MultiStoreSelect
                                                            stores={stores}
                                                            selectedStoreIds={draft.store_ids || null}
                                                            onChange={ids => setDraft(p => ({ ...p, store_ids: ids }))}
                                                        />
                                                    ) : (
                                                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                            {template.store_ids === null ? (
                                                                <span className="stg-badge" style={{ fontSize: 9, padding: '1px 5px', background: '#dbeafe', color: '#1e40af' }}>Tất cả CH</span>
                                                            ) : (
                                                                template.store_ids.map(sid => {
                                                                    const store = stores.find(s => s.id === sid);
                                                                    return store ? (
                                                                        <span key={sid} className="stg-badge" style={{ fontSize: 9, padding: '1px 4px', background: '#fef3c7', color: '#b45309' }}>
                                                                            {store.code}
                                                                        </span>
                                                                    ) : null;
                                                                })
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    <div className="stg-row-actions" style={isEditing ? { opacity: 1 } : undefined}>
                                                        {isEditing ? (
                                                            <>
                                                                <button onClick={handleSaveEdit} className="stg-btn-icon stg-btn-save" disabled={saving}>
                                                                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check</span>
                                                                </button>
                                                                <button onClick={handleCancel} className="stg-btn-icon" disabled={saving}>
                                                                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <button onClick={() => handleEdit(template)} className="stg-btn-icon" disabled={saving || !!editingId}>
                                                                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>
                                                                </button>
                                                                <button onClick={() => handleDelete(template)} className="stg-btn-icon stg-btn-danger" disabled={saving}>
                                                                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete_outline</span>
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    {/* New item row */}
                                    {isAdding && (
                                        <tr className="stg-table-row stg-row-new">
                                            <td style={{ paddingLeft: 16 }}>
                                                <span className="stg-row-num">+</span>
                                            </td>
                                            <td>
                                                <select
                                                    className="stg-input stg-input-mono"
                                                    style={{ width: '100%', padding: '6px' }}
                                                    value={draft.category || 'START_SHIFT'}
                                                    onChange={e => setDraft(p => ({ ...p, category: e.target.value as ChecklistCategory }))}
                                                >
                                                    {CATEGORIES.map(cat => (
                                                        <option key={cat} value={cat}>{CHECKLIST_LABELS[cat]}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td style={{ fontWeight: 500, color: '#111827', fontSize: 13 }}>
                                                <input
                                                    type="text"
                                                    className="stg-input"
                                                    value={draft.title || ''}
                                                    onChange={e => setDraft(p => ({ ...p, title: e.target.value }))}
                                                    placeholder="Nội dung công việc..."
                                                    autoFocus
                                                    style={{ width: '100%', fontSize: 13 }}
                                                />
                                            </td>
                                            <td>
                                                <ShiftPillToggle
                                                    shifts={['MORNING', 'AFTERNOON', 'EVENING']}
                                                    selected={draft.shift_types === undefined ? null : (draft.shift_types as string[] | null)}
                                                    onChange={val => setDraft(p => ({ ...p, shift_types: val as ShiftType[] | null }))}
                                                />
                                            </td>
                                            {/* Day of week for new item */}
                                            <td>
                                                <DayPillToggle
                                                    days={[2, 3, 4, 5, 6, 7, 1]}
                                                    labels={DAY_LABELS as Record<number, string>}
                                                    selected={draft.day_of_week === undefined ? null : (draft.day_of_week as number[] | null)}
                                                    onChange={val => setDraft(p => ({ ...p, day_of_week: val as DayOfWeek[] | null }))}
                                                />
                                            </td>
                                            <td>
                                                <MultiStoreSelect
                                                    stores={stores}
                                                    selectedStoreIds={draft.store_ids || null}
                                                    onChange={ids => setDraft(p => ({ ...p, store_ids: ids }))}
                                                />
                                            </td>
                                            <td>
                                                <div className="stg-row-actions" style={{ opacity: 1 }}>
                                                    <button onClick={handleSaveNew} className="stg-btn-icon stg-btn-save" disabled={saving}>
                                                        {saving
                                                            ? <span className="material-symbols-outlined stg-spin" style={{ fontSize: 18 }}>progress_activity</span>
                                                            : <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check</span>
                                                        }
                                                    </button>
                                                    <button onClick={handleCancel} className="stg-btn-icon" disabled={saving}>
                                                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </>
                            )}
                        </tbody>
                    </table>
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
