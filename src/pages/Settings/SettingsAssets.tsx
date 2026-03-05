import React, { useState, useEffect } from 'react';
import { ToastContextType } from '../../contexts/ToastContext';
import type { ShiftAsset } from '../../types/shift';
import { AssetService } from '../../services/shift';
import ConfirmDialog from '../../components/ConfirmDialog';

import type { Store } from '../../types';

interface SettingsAssetsProps {
    toast: ToastContextType;
    stores: Store[];
}

export const SettingsAssets: React.FC<SettingsAssetsProps> = ({ toast, stores }) => {
    const [assets, setAssets] = useState<ShiftAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [filterStore, setFilterStore] = useState<string>('ALL');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draft, setDraft] = useState<Partial<ShiftAsset>>({});
    const [isAdding, setIsAdding] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

    useEffect(() => {
        loadAssets();
    }, []);

    const loadAssets = async () => {
        setLoading(true);
        try {
            const data = await AssetService.getAssets();
            setAssets(data);
        } catch (err: unknown) {
            toast.error('Lỗi tải vật tư: ' + (err instanceof Error ? err.message : String(err)));
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('vi-VN').format(amount) + 'đ';

    const filtered = assets.filter(a => {
        return filterStore === 'ALL' || (a.store_ids === null) || a.store_ids.includes(filterStore);
    });

    // ─── Add ───
    const handleAdd = () => {
        if (isAdding || editingId) return;
        setIsAdding(true);
        setDraft({
            name: '',
            unit_value: 0,
            expected_ok: 0,
            expected_total: 0,
            sort_order: (filtered.length || assets.length) + 1,
            is_active: true,
            store_ids: filterStore !== 'ALL' ? [filterStore] : null,
        });
    };

    const handleSaveNew = async () => {
        if (!draft.name?.trim()) {
            toast.error('Vui lòng nhập tên vật tư');
            return;
        }
        setSaving(true);
        try {
            const created = await AssetService.createAsset(draft);
            setAssets(prev => [...prev, created]);
            setIsAdding(false);
            setDraft({});
            toast.success('Đã thêm vật tư');
        } catch (err: unknown) {
            toast.error('Lỗi: ' + (err instanceof Error ? err.message : String(err)));
        } finally {
            setSaving(false);
        }
    };

    // ─── Edit ───
    const handleEdit = (asset: ShiftAsset) => {
        if (isAdding || editingId) return;
        setEditingId(asset.id);
        setDraft({ ...asset });
    };

    const handleSaveEdit = async () => {
        if (!editingId || !draft.name?.trim()) return;
        setSaving(true);
        try {
            const updated = await AssetService.updateAsset(editingId, draft);
            setAssets(prev => prev.map(a => a.id === editingId ? updated : a));
            setEditingId(null);
            setDraft({});
            toast.success('Đã cập nhật vật tư');
        } catch (err: unknown) {
            toast.error('Lỗi: ' + (err instanceof Error ? err.message : String(err)));
        } finally {
            setSaving(false);
        }
    };

    // ─── Toggle active ───
    const handleToggle = async (asset: ShiftAsset) => {
        try {
            const updated = await AssetService.updateAsset(asset.id, { is_active: !asset.is_active });
            setAssets(prev => prev.map(a => a.id === asset.id ? updated : a));
            toast.success(`Đã ${updated.is_active ? 'bật' : 'tắt'} "${asset.name}"`);
        } catch (err: unknown) {
            toast.error('Lỗi: ' + (err instanceof Error ? err.message : String(err)));
        }
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
                            <span className="stg-badge">{assets.length} vật tư</span>
                            <span style={{ fontSize: 12, color: 'var(--stg-text-muted)' }}>
                                · {assets.filter(a => a.is_active).length} đang hoạt động
                            </span>
                        </div>
                        <div className="stg-toolbar-right">
                            {/* Store filter */}
                            <select
                                className="stg-input stg-input-mono"
                                style={{ padding: '4px 8px', fontSize: 12, width: 'auto', minWidth: 120, marginRight: 8 }}
                                value={filterStore}
                                onChange={e => setFilterStore(e.target.value)}
                            >
                                <option value="ALL">Tất cả cửa hàng</option>
                                {stores.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>

                            <button
                                onClick={handleAdd}
                                className="stg-btn stg-btn-primary"
                                disabled={saving || isAdding || !!editingId}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                                Thêm Vật Tư
                            </button>
                        </div>
                    </div>

                    {/* Table */}
                    <table className="stg-table stg-table-fixed">
                        <colgroup>
                            <col style={{ width: '5%' }} />
                            <col style={{ width: '22%' }} />
                            <col style={{ width: '13%' }} />
                            <col style={{ width: '10%' }} />
                            <col style={{ width: '10%' }} />
                            <col style={{ width: '10%' }} />
                            <col style={{ width: '20%' }} />
                            <col style={{ width: '10%' }} />
                        </colgroup>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>TÊN VẬT TƯ</th>
                                <th>GIÁ TRỊ</th>
                                <th style={{ textAlign: 'center' }}>SL CHUẨN</th>
                                <th style={{ textAlign: 'center' }}>SL TỔNG</th>
                                <th style={{ textAlign: 'center' }}>TRẠNG THÁI</th>
                                <th>CỬA HÀNG</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--stg-text-muted)' }}>Đang tải...</td></tr>
                            ) : assets.length === 0 && !isAdding ? (
                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--stg-text-muted)' }}>
                                    Chưa có vật tư nào
                                </td></tr>
                            ) : (
                                <>
                                    {filtered.map((asset, idx) => {
                                        const isEditing = editingId === asset.id;
                                        return (
                                            <tr key={asset.id} className={`stg-table-row ${isEditing ? 'stg-row-new' : ''}`}
                                                style={{ opacity: !asset.is_active && !isEditing ? 0.55 : 1 }}
                                            >
                                                <td style={{ paddingLeft: 16 }}>
                                                    <span className="stg-row-num">{idx + 1}</span>
                                                </td>
                                                <td>
                                                    {isEditing ? (
                                                        <input
                                                            type="text"
                                                            className="stg-input"
                                                            value={draft.name || ''}
                                                            onChange={e => setDraft(p => ({ ...p, name: e.target.value }))}
                                                            placeholder="Tên vật tư"
                                                            autoFocus
                                                        />
                                                    ) : (
                                                        <span style={{ fontWeight: 600, color: 'var(--stg-text)' }}>
                                                            {asset.name}
                                                        </span>
                                                    )}
                                                </td>
                                                <td>
                                                    {isEditing ? (
                                                        <input
                                                            type="number"
                                                            className="stg-input"
                                                            value={draft.unit_value || ''}
                                                            onChange={e => setDraft(p => ({ ...p, unit_value: parseFloat(e.target.value) || 0 }))}
                                                            placeholder="0"
                                                        />
                                                    ) : (
                                                        <span className="stg-input-mono" style={{ fontSize: 13, color: 'var(--stg-text-secondary)' }}>
                                                            {formatCurrency(asset.unit_value || 0)}
                                                        </span>
                                                    )}
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    {isEditing ? (
                                                        <input
                                                            type="number"
                                                            className="stg-input"
                                                            style={{ width: 60, textAlign: 'center' }}
                                                            value={draft.expected_ok ?? ''}
                                                            onChange={e => setDraft(p => ({ ...p, expected_ok: parseInt(e.target.value) || 0 }))}
                                                            min="0"
                                                        />
                                                    ) : (
                                                        <span style={{ fontWeight: 600, color: 'var(--stg-text)' }}>{asset.expected_ok}</span>
                                                    )}
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    {isEditing ? (
                                                        <input
                                                            type="number"
                                                            className="stg-input"
                                                            style={{ width: 60, textAlign: 'center' }}
                                                            value={draft.expected_total ?? ''}
                                                            onChange={e => setDraft(p => ({ ...p, expected_total: parseInt(e.target.value) || 0 }))}
                                                            min="0"
                                                        />
                                                    ) : (
                                                        <span style={{ fontWeight: 600, color: 'var(--stg-text)' }}>{asset.expected_total}</span>
                                                    )}
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                                        <span className={`stg-status-dot ${asset.is_active ? 'active' : 'inactive'}`} />
                                                        <button
                                                            className={`stg-toggle-btn ${asset.is_active ? 'active' : 'inactive'}`}
                                                            onClick={() => handleToggle(asset)}
                                                            disabled={saving || isEditing}
                                                        >
                                                            <span className="stg-toggle-knob" />
                                                        </button>
                                                    </div>
                                                </td>
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
                                                            {asset.store_ids === null ? (
                                                                <span className="stg-badge" style={{ fontSize: 9, padding: '1px 5px', background: '#dbeafe', color: '#1e40af' }}>Tất cả CH</span>
                                                            ) : (
                                                                asset.store_ids.map(sid => {
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
                                                                <button onClick={() => handleEdit(asset)} className="stg-btn-icon" disabled={saving || !!editingId}>
                                                                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>
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
                                            <td style={{ paddingLeft: 16 }}><span className="stg-row-num">+</span></td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className="stg-input"
                                                    value={draft.name || ''}
                                                    onChange={e => setDraft(p => ({ ...p, name: e.target.value }))}
                                                    placeholder="Tên vật tư (VD: Kéo, Bút bi...)"
                                                    autoFocus
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    className="stg-input"
                                                    value={draft.unit_value || ''}
                                                    onChange={e => setDraft(p => ({ ...p, unit_value: parseFloat(e.target.value) || 0 }))}
                                                    placeholder="Giá trị"
                                                />
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <input
                                                    type="number"
                                                    className="stg-input"
                                                    style={{ width: 60, textAlign: 'center' }}
                                                    value={draft.expected_ok ?? ''}
                                                    onChange={e => setDraft(p => ({ ...p, expected_ok: parseInt(e.target.value) || 0 }))}
                                                    min="0" placeholder="0"
                                                />
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <input
                                                    type="number"
                                                    className="stg-input"
                                                    style={{ width: 60, textAlign: 'center' }}
                                                    value={draft.expected_total ?? ''}
                                                    onChange={e => setDraft(p => ({ ...p, expected_total: parseInt(e.target.value) || 0 }))}
                                                    min="0" placeholder="0"
                                                />
                                            </td>
                                            <td>
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
