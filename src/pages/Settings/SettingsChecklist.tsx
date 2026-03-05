import React, { useState, useEffect } from 'react';
import { ToastContextType } from '../../contexts/ToastContext';
import type { ChecklistTemplate, ChecklistCategory, ShiftType, DayOfWeek } from '../../types/shift';
import { CHECKLIST_LABELS, CHECKLIST_ICONS, DAY_LABELS } from '../../types/shift';
import { ChecklistService } from '../../services/shift';
import ConfirmDialog from '../../components/ConfirmDialog';

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
                            <select
                                className="stg-input stg-input-mono"
                                style={{ padding: '4px 8px', fontSize: 12, width: 'auto', minWidth: 120 }}
                                value={filterCategory}
                                onChange={e => setFilterCategory(e.target.value as ChecklistCategory | 'ALL')}
                            >
                                <option value="ALL">Tất cả mục</option>
                                {CATEGORIES.map(cat => (
                                    <option key={cat} value={cat}>{CHECKLIST_LABELS[cat]}</option>
                                ))}
                            </select>

                            {/* Store filter */}
                            <select
                                className="stg-input stg-input-mono"
                                style={{ padding: '4px 8px', fontSize: 12, width: 'auto', minWidth: 120 }}
                                value={filterStore}
                                onChange={e => setFilterStore(e.target.value)}
                            >
                                <option value="ALL">Tất cả cửa hàng</option>
                                {stores.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
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
                                                <td>
                                                    {isEditing ? (
                                                        <input
                                                            type="text"
                                                            className="stg-input"
                                                            value={draft.title || ''}
                                                            onChange={e => setDraft(p => ({ ...p, title: e.target.value }))}
                                                            placeholder="Nội dung công việc..."
                                                            autoFocus
                                                        />
                                                    ) : (
                                                        <span style={{ fontWeight: 500, color: 'var(--stg-text)', lineHeight: 1.4, fontSize: 13 }}>
                                                            {template.title}
                                                        </span>
                                                    )}
                                                </td>
                                                <td>
                                                    {isEditing ? (
                                                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                            {(['MORNING', 'AFTERNOON', 'EVENING'] as ShiftType[]).map(st => (
                                                                <label key={st} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, cursor: 'pointer' }}>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={draft.shift_types?.includes(st) || false}
                                                                        onChange={e => {
                                                                            const types = [...(draft.shift_types || [])];
                                                                            if (e.target.checked) types.push(st);
                                                                            else types.splice(types.indexOf(st), 1);
                                                                            setDraft(p => ({ ...p, shift_types: types }));
                                                                        }}
                                                                    />
                                                                    {st === 'MORNING' ? 'Sáng' : st === 'AFTERNOON' ? 'Chiều' : 'Tối'}
                                                                </label>
                                                            ))}
                                                        </div>
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
                                                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                                            {([2, 3, 4, 5, 6, 7, 1] as DayOfWeek[]).map(d => (
                                                                <label key={d} style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 10, cursor: 'pointer' }}>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={draft.day_of_week === null || draft.day_of_week?.includes(d) || false}
                                                                        onChange={e => {
                                                                            let days = draft.day_of_week === null ? [2, 3, 4, 5, 6, 7, 1] as DayOfWeek[] : [...(draft.day_of_week || [])];
                                                                            if (e.target.checked) { if (!days.includes(d)) days.push(d); }
                                                                            else { days = days.filter(x => x !== d); }
                                                                            setDraft(p => ({ ...p, day_of_week: days.length === 7 ? null : days }));
                                                                        }}
                                                                    />
                                                                    {DAY_LABELS[d]}
                                                                </label>
                                                            ))}
                                                        </div>
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
                                                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', maxHeight: '100px', overflowY: 'auto' }}>
                                                            {stores.map(s => (
                                                                <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, cursor: 'pointer', background: 'var(--stg-bg-element)', padding: '2px 6px', borderRadius: '4px' }}>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={draft.store_ids === null || draft.store_ids.includes(s.id)}
                                                                        onChange={e => {
                                                                            let sIds = draft.store_ids === null ? stores.map(st => st.id) : [...(draft.store_ids || [])];
                                                                            if (e.target.checked) { if (!sIds.includes(s.id)) sIds.push(s.id); }
                                                                            else { sIds = sIds.filter(x => x !== s.id); }
                                                                            setDraft(p => ({ ...p, store_ids: sIds.length === stores.length ? null : sIds }));
                                                                        }}
                                                                    />
                                                                    {s.code}
                                                                </label>
                                                            ))}
                                                        </div>
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
                                            <td>
                                                <input
                                                    type="text"
                                                    className="stg-input"
                                                    value={draft.title || ''}
                                                    onChange={e => setDraft(p => ({ ...p, title: e.target.value }))}
                                                    placeholder="Nội dung công việc..."
                                                    autoFocus
                                                />
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                    {(['MORNING', 'AFTERNOON', 'EVENING'] as ShiftType[]).map(st => (
                                                        <label key={st} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, cursor: 'pointer' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={draft.shift_types?.includes(st) || false}
                                                                onChange={e => {
                                                                    const types = [...(draft.shift_types || [])];
                                                                    if (e.target.checked) types.push(st);
                                                                    else types.splice(types.indexOf(st), 1);
                                                                    setDraft(p => ({ ...p, shift_types: types }));
                                                                }}
                                                            />
                                                            {st === 'MORNING' ? 'Sáng' : st === 'AFTERNOON' ? 'Chiều' : 'Tối'}
                                                        </label>
                                                    ))}
                                                </div>
                                            </td>
                                            {/* Day of week for new item */}
                                            <td>
                                                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                                    {([2, 3, 4, 5, 6, 7, 1] as DayOfWeek[]).map(d => (
                                                        <label key={d} style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 10, cursor: 'pointer' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={draft.day_of_week === null || draft.day_of_week?.includes(d) || false}
                                                                onChange={e => {
                                                                    let days = draft.day_of_week === null ? [2, 3, 4, 5, 6, 7, 1] as DayOfWeek[] : [...(draft.day_of_week || [])];
                                                                    if (e.target.checked) { if (!days.includes(d)) days.push(d); }
                                                                    else { days = days.filter(x => x !== d); }
                                                                    setDraft(p => ({ ...p, day_of_week: days.length === 7 ? null : days }));
                                                                }}
                                                            />
                                                            {DAY_LABELS[d]}
                                                        </label>
                                                    ))}
                                                </div>
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
