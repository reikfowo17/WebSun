import React, { useState } from 'react';
import { SystemService, ExpiryConfigItem, StoreConfig } from '../../services/system';
import ConfirmDialog from '../../components/ConfirmDialog';

interface Props {
    toast: any;
    initialConfigs: ExpiryConfigItem[];
    allStores: StoreConfig[];
}

export const SettingsExpiryConfig: React.FC<Props> = ({ toast, initialConfigs, allStores }) => {
    const [configs, setConfigs] = useState<ExpiryConfigItem[]>(initialConfigs);
    const [saving, setSaving] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [draft, setDraft] = useState<ExpiryConfigItem | null>(null);
    const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

    const handleAdd = () => {
        if (editingIndex !== null) return;
        const newConfig: ExpiryConfigItem = {
            id: '', type: '', near_expiry_days: 7, production_threshold: 0,
            enabled: true, stores: [],
        };
        setConfigs([...configs, newConfig]);
        setEditingIndex(configs.length);
        setDraft(newConfig);
    };

    const handleEdit = (index: number) => {
        if (editingIndex !== null) return;
        setEditingIndex(index);
        setDraft({ ...configs[index] });
    };

    const handleCancel = (index: number) => {
        if (configs[index].id === '') {
            setConfigs(configs.filter((_, i) => i !== index));
        }
        setEditingIndex(null);
        setDraft(null);
    };

    const handleSave = async (index: number) => {
        if (!draft) return;
        if (!draft.type) { toast.error('Vui lòng nhập loại hàng'); return; }
        setSaving(true);
        try {
            const res = await SystemService.saveExpiryConfig(draft);
            if (res.success && res.data) {
                const newConfigs = [...configs];
                newConfigs[index] = res.data;
                setConfigs(newConfigs);
                setEditingIndex(null);
                setDraft(null);
                toast.success('Lưu cấu hình HSD thành công');
            } else {
                toast.error(res.message || 'Lưu thất bại');
            }
        } catch (e: unknown) {
            toast.error('Lỗi: ' + (e instanceof Error ? e.message : String(e)));
        } finally {
            setSaving(false);
        }
    };

    const handleToggleEnabled = async (index: number) => {
        const config = configs[index];
        const updated = { ...config, enabled: !config.enabled };
        const newConfigs = [...configs];
        newConfigs[index] = updated;
        setConfigs(newConfigs);
        setSaving(true);
        try {
            const res = await SystemService.saveExpiryConfig(updated);
            if (res.success) {
                toast.success(`Đã ${updated.enabled ? 'bật' : 'tắt'} kiểm HSD "${config.type}"`);
            } else {
                newConfigs[index] = config;
                setConfigs(newConfigs);
                toast.error(res.message || 'Lỗi cập nhật');
            }
        } catch (e: unknown) {
            newConfigs[index] = config;
            setConfigs(newConfigs);
            toast.error('Lỗi: ' + (e instanceof Error ? e.message : String(e)));
        } finally {
            setSaving(false);
        }
    };

    const handleRemove = (index: number) => {
        const config = configs[index];
        if (!config.id) { setConfigs(configs.filter((_, i) => i !== index)); return; }
        setConfirmDialog({
            title: 'Xóa cấu hình HSD',
            message: `Xóa cấu hình "${config.type}"?`,
            onConfirm: async () => {
                setConfirmDialog(null);
                setSaving(true);
                try {
                    const res = await SystemService.deleteExpiryConfig(config.id);
                    if (res.success) {
                        setConfigs(configs.filter((_, i) => i !== index));
                        toast.success('Đã xoá cấu hình');
                    } else { toast.error(res.message || 'Xoá thất bại'); }
                } catch (e: unknown) {
                    toast.error('Lỗi: ' + (e instanceof Error ? e.message : String(e)));
                } finally { setSaving(false); }
            },
        });
    };

    const activeCount = configs.filter(c => c.enabled).length;

    return (
        <>
            <div className="stg-section-animate">
                <div className="stg-table-wrap">
                    <div className="stg-toolbar">
                        <div className="stg-toolbar-left">
                            <span className="stg-badge">{configs.length} loại hàng</span>
                            {configs.length > 0 && (
                                <span style={{ fontSize: 12, color: 'var(--stg-text-muted)' }}>
                                    · {activeCount} đang kiểm tra
                                </span>
                            )}
                        </div>
                        <div className="stg-toolbar-right">
                            <button onClick={handleAdd} className="stg-btn stg-btn-primary" disabled={saving || editingIndex !== null}>
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                                Thêm loại
                            </button>
                        </div>
                    </div>

                    <table className="stg-table stg-table-fixed">
                        <colgroup>
                            <col style={{ width: '6%' }} />
                            <col style={{ width: '20%' }} />
                            <col style={{ width: '16%' }} />
                            <col style={{ width: '16%' }} />
                            <col style={{ width: '12%' }} />
                            <col style={{ width: '15%' }} />
                            <col style={{ width: '15%' }} />
                        </colgroup>
                        <thead>
                            <tr>
                                <th style={{ paddingLeft: 20 }}>#</th>
                                <th>LOẠI HÀNG</th>
                                <th style={{ textAlign: 'center' }}>NGÀY CẢNH BÁO</th>
                                <th style={{ textAlign: 'center' }}>NGƯỠNG SẢN XUẤT</th>
                                <th style={{ textAlign: 'center' }}>TRẠNG THÁI</th>
                                <th>CỬA HÀNG ÁP DỤNG</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {configs.map((config, i) => {
                                const isEditing = editingIndex === i;
                                const isNew = config.id === '';
                                return (
                                    <tr key={config.id || `new-${i}`} className={`stg-table-row${isNew ? ' stg-row-new' : ''}`}
                                        style={{ opacity: !config.enabled && !isEditing ? 0.55 : 1 }}>
                                        <td><div style={{ paddingLeft: 12 }}><span className="stg-row-num">{i + 1}</span></div></td>
                                        <td>
                                            <div className="stg-shift-name-cell">
                                                <span className="material-symbols-outlined stg-shift-inline-icon" style={{ color: 'var(--stg-warning)' }}>event_available</span>
                                                {isEditing ? (
                                                    <input type="text" value={draft?.type || ''} onChange={e => setDraft(d => d ? { ...d, type: e.target.value } : d)}
                                                        className="stg-input" placeholder="VD: TỦ MÁT" autoFocus />
                                                ) : (
                                                    <span style={{ fontWeight: 600, color: 'var(--stg-text)' }}>{config.type}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            {isEditing ? (
                                                <input type="number" min="0" value={draft?.near_expiry_days || ''} className="stg-input" style={{ width: 80, textAlign: 'center' }}
                                                    onChange={e => setDraft(d => d ? { ...d, near_expiry_days: parseInt(e.target.value) || 0 } : d)} />
                                            ) : (
                                                <span style={{ fontWeight: 600 }}>{config.near_expiry_days} ngày</span>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            {isEditing ? (
                                                <input type="number" min="0" value={draft?.production_threshold || ''} className="stg-input" style={{ width: 80, textAlign: 'center' }}
                                                    onChange={e => setDraft(d => d ? { ...d, production_threshold: parseInt(e.target.value) || 0 } : d)} />
                                            ) : (
                                                <span style={{ fontWeight: 600 }}>{config.production_threshold} ngày</span>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                                <span className={`stg-status-dot ${config.enabled ? 'active' : 'inactive'}`} />
                                                <button className={`stg-toggle-btn ${config.enabled ? 'active' : 'inactive'}`}
                                                    onClick={() => handleToggleEnabled(i)} disabled={saving || isEditing}
                                                    title={config.enabled ? 'Đang kiểm tra — bấm để tắt' : 'Đã tắt — bấm để bật'}>
                                                    <span className="stg-toggle-knob" />
                                                </button>
                                            </div>
                                        </td>
                                        <td>
                                            {isEditing ? (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                    {allStores.filter(s => s.is_active !== false).map(store => (
                                                        <label key={store.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
                                                            <input type="checkbox" checked={draft?.stores?.includes(store.code) ?? false}
                                                                onChange={e => {
                                                                    if (!draft) return;
                                                                    const stores = e.target.checked
                                                                        ? [...(draft.stores || []), store.code]
                                                                        : (draft.stores || []).filter(s => s !== store.code);
                                                                    setDraft({ ...draft, stores });
                                                                }} />
                                                            {store.code}
                                                        </label>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                    {config.stores?.length ? config.stores.map(s => (
                                                        <span key={s} className="stg-badge" style={{ fontSize: 11, padding: '1px 6px' }}>{s}</span>
                                                    )) : <span style={{ color: 'var(--stg-text-muted)', fontSize: 12, fontStyle: 'italic' }}>Tất cả</span>}
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <div className="stg-row-actions" style={isEditing ? { opacity: 1 } : undefined}>
                                                {isEditing ? (
                                                    <>
                                                        <button onClick={() => handleSave(i)} className="stg-btn-icon stg-btn-save" title="Lưu vào hệ thống" disabled={saving}>
                                                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check</span>
                                                        </button>
                                                        <button onClick={() => handleCancel(i)} className="stg-btn-icon" title="Hủy" disabled={saving}>
                                                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button onClick={() => handleEdit(i)} className="stg-btn-icon" title="Chỉnh sửa" disabled={saving}>
                                                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                                                        </button>
                                                        <button onClick={() => handleRemove(i)} className="stg-btn-icon stg-btn-danger" title="Xóa" disabled={saving}>
                                                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete_outline</span>
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

                    {configs.length === 0 && (
                        <div className="stg-empty">
                            <span className="material-symbols-outlined">event_busy</span>
                            <p>Chưa có cấu hình kiểm hạn sử dụng</p>
                            <p style={{ fontSize: 12, marginBottom: 12 }}>Thêm loại hàng đầu tiên để bắt đầu kiểm soát HSD</p>
                            <button onClick={handleAdd} className="stg-btn stg-btn-primary" disabled={saving}>
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                                Tạo loại hàng đầu tiên
                            </button>
                        </div>
                    )}
                </div>

                <div className="stg-info-banner">
                    <span className="material-symbols-outlined">info</span>
                    <span><strong>Ngày cảnh báo</strong>: sản phẩm nào còn dưới X ngày trước HSD sẽ được đánh dấu. <strong>Ngưỡng SX</strong>: nếu ngày SX {'>'} X ngày thì kiểm tra.</span>
                </div>
            </div>

            {confirmDialog && (
                <ConfirmDialog title={confirmDialog.title} message={confirmDialog.message}
                    onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)} />
            )}
        </>
    );
};
