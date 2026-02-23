import React, { useState } from 'react';
import { SystemService, StoreConfig } from '../../services/system';

interface SettingsStoresProps {
    toast: any;
    initialStores: StoreConfig[];
}

export const SettingsStores: React.FC<SettingsStoresProps> = ({ toast, initialStores }) => {
    const [stores, setStores] = useState<StoreConfig[]>(initialStores);

    // Draft states
    const [editingStoreIndex, setEditingStoreIndex] = useState<number | null>(null);
    const [draftStore, setDraftStore] = useState<StoreConfig | null>(null);

    // Save overlay
    const [saving, setSaving] = useState(false);

    // Drag states
    const [draggedStoreIndex, setDraggedStoreIndex] = useState<number | null>(null);
    const [dragStoreOverIndex, setDragStoreOverIndex] = useState<number | null>(null);
    const [dragStoreId, setDragStoreId] = useState<number | null>(null);

    const handleAddStore = () => {
        if (editingStoreIndex !== null) return;
        const newStore: StoreConfig = { id: '', code: '', name: '', is_active: true };
        const newStores = [...stores, newStore];
        setStores(newStores);
        setEditingStoreIndex(newStores.length - 1);
        setDraftStore(newStore);
    };

    const handleEditStore = (index: number) => {
        if (editingStoreIndex !== null) return;
        setEditingStoreIndex(index);
        setDraftStore(stores[index]);
    };

    const handleUpdateDraftStore = (field: keyof StoreConfig, value: string | boolean) => {
        if (draftStore) {
            setDraftStore({ ...draftStore, [field]: value });
        }
    };

    const handleCancelStore = (index: number) => {
        if (stores[index].id === '') {
            setStores(stores.filter((_, i) => i !== index));
        }
        setEditingStoreIndex(null);
        setDraftStore(null);
    };

    const handleSaveStore = async (index: number) => {
        if (!draftStore) return;
        if (!draftStore.code || !draftStore.name) {
            toast.error('Vui lòng nhập Mã và Tên cửa hàng');
            return;
        }
        setSaving(true);
        try {
            const res = await SystemService.saveStore(draftStore);
            if (res.success && res.data) {
                const newStores = [...stores];
                newStores[index] = res.data;
                setStores(newStores);
                setEditingStoreIndex(null);
                setDraftStore(null);
                toast.success('Lưu Cửa hàng thành công');
            } else {
                toast.error(res.message || 'Lưu Cửa hàng thất bại');
            }
        } catch (e: unknown) {
            toast.error('Lỗi: ' + (e instanceof Error ? e.message : String(e)));
        } finally {
            setSaving(false);
        }
    };

    const handleToggleStoreActive = async (index: number) => {
        const store = stores[index];
        const newActive = !store.is_active;
        setSaving(true);
        try {
            const res = await SystemService.saveStore({ ...store, is_active: newActive });
            if (res.success && res.data) {
                const newStores = [...stores];
                newStores[index] = res.data;
                setStores(newStores);
                toast.success(`Đã ${newActive ? 'bật' : 'tắt'} hoạt động cửa hàng`);
            } else {
                toast.error(res.message || 'Lỗi khi cập nhật trạng thái');
            }
        } catch (e: unknown) {
            toast.error('Lỗi: ' + (e instanceof Error ? e.message : String(e)));
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveStore = async (index: number) => {
        const store = stores[index];
        if (store.id) {
            if (!window.confirm('Bạn có chắc xoá cửa hàng này? (Dữ liệu liên quan có thể bị ảnh hưởng)')) return;
            setSaving(true);
            try {
                const res = await SystemService.deleteStore(store.id);
                if (res.success) {
                    setStores(stores.filter((_, i) => i !== index));
                    toast.success('Đã xoá Cửa hàng');
                } else {
                    toast.error(res.message || 'Xoá thất bại');
                }
            } catch (e: unknown) {
                toast.error('Lỗi: ' + (e instanceof Error ? e.message : String(e)));
            } finally {
                setSaving(false);
            }
        } else {
            setStores(stores.filter((_, i) => i !== index));
        }
    };

    const handleStoreDragStart = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
        setDraggedStoreIndex(index);
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

    const handleStoreDragOver = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragStoreOverIndex !== index) {
            setDragStoreOverIndex(index);
        }
    };

    const handleStoreDragLeave = (_e: React.DragEvent<HTMLTableRowElement>, index: number) => {
        if (dragStoreOverIndex === index) {
            setDragStoreOverIndex(null);
        }
    };

    const handleStoreDrop = (e: React.DragEvent<HTMLTableRowElement>, targetIndex: number) => {
        e.preventDefault();
        setDragStoreOverIndex(null);

        if (draggedStoreIndex === null || draggedStoreIndex === targetIndex) {
            if (e.currentTarget instanceof HTMLElement) {
                e.currentTarget.style.opacity = '1';
            }
            return;
        }

        const newStores = [...stores];
        const itemToMove = newStores[draggedStoreIndex];
        newStores.splice(draggedStoreIndex, 1);
        newStores.splice(targetIndex, 0, itemToMove);

        setStores(newStores);
        setDraggedStoreIndex(null);
        if (e.currentTarget instanceof HTMLElement) {
            e.currentTarget.style.opacity = '1';
        }
    };

    const handleStoreDragEnd = (e: React.DragEvent<HTMLTableRowElement>) => {
        setDraggedStoreIndex(null);
        setDragStoreOverIndex(null);
        if (e.currentTarget instanceof HTMLElement) {
            e.currentTarget.style.opacity = '1';
        }
    };

    const activeCount = stores.filter(s => s.is_active !== false).length;

    return (
        <div className="stg-section-animate">
            <div className="stg-table-wrap">
                {/* ─── Toolbar ─── */}
                <div className="stg-toolbar">
                    <div className="stg-toolbar-left">
                        <span className="stg-badge">{stores.length} cửa hàng</span>
                        {stores.length > 0 && (
                            <span style={{ fontSize: 12, color: 'var(--stg-text-muted)' }}>
                                · {activeCount} đang hoạt động
                            </span>
                        )}
                    </div>
                    <div className="stg-toolbar-right">
                        <button
                            onClick={handleAddStore}
                            className="stg-btn stg-btn-primary stg-emerald"
                            disabled={saving || editingStoreIndex !== null}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add_business</span>
                            Thêm Cửa Hàng
                        </button>
                    </div>
                </div>

                {/* ─── Table ─── */}
                <table className="stg-table stg-table-fixed">
                    <colgroup>
                        <col style={{ width: '8%' }} />
                        <col style={{ width: '14%' }} />
                        <col style={{ width: '44%' }} />
                        <col style={{ width: '14%' }} />
                        <col style={{ width: '20%' }} />
                    </colgroup>
                    <thead>
                        <tr>
                            <th style={{ paddingLeft: 36 }}>#</th>
                            <th style={{ textAlign: 'center' }}>MÃ ERP</th>
                            <th>TÊN CỬA HÀNG</th>
                            <th style={{ textAlign: 'center' }}>TRẠNG THÁI</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {stores.map((store, i) => {
                            const isNew = store.id === '';
                            const isEditing = editingStoreIndex === i;
                            const isActive = store.is_active !== false;
                            return (
                                <tr
                                    key={store.id || `new-${i}`}
                                    className={`stg-table-row${isNew ? ' stg-row-new' : ''} ${draggedStoreIndex === i ? 'dragging' : ''}`}
                                    draggable={dragStoreId === i || draggedStoreIndex === i}
                                    onDragStart={(e) => handleStoreDragStart(e, i)}
                                    onDragOver={(e) => handleStoreDragOver(e, i)}
                                    onDragLeave={(e) => handleStoreDragLeave(e, i)}
                                    onDrop={(e) => handleStoreDrop(e, i)}
                                    onDragEnd={handleStoreDragEnd}
                                    style={{
                                        borderTop: dragStoreOverIndex === i && draggedStoreIndex !== i && dragStoreOverIndex < (draggedStoreIndex || 0) ? '2px solid var(--stg-success)' : undefined,
                                        borderBottom: dragStoreOverIndex === i && draggedStoreIndex !== i && dragStoreOverIndex > (draggedStoreIndex || 0) ? '2px solid var(--stg-success)' : undefined,
                                        opacity: !isActive && !isEditing ? 0.55 : 1,
                                    }}
                                >
                                    {/* ─ Drag + Number ─ */}
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 8 }}>
                                            <span
                                                className="material-symbols-outlined stg-drag-handle"
                                                onMouseEnter={() => setDragStoreId(i)}
                                                onMouseLeave={() => setDragStoreId(null)}
                                            >drag_indicator</span>
                                            <span className="stg-row-num">{i + 1}</span>
                                        </div>
                                    </td>

                                    {/* ─ Store Code ─ */}
                                    <td>
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                value={draftStore?.code || ''}
                                                onChange={(e) => handleUpdateDraftStore('code', e.target.value.toUpperCase())}
                                                className="stg-input stg-input-mono stg-input-center"
                                                placeholder="ABC"
                                                aria-label="Mã ERP cửa hàng"
                                                autoFocus
                                            />
                                        ) : (
                                            <div className="stg-input-mono" style={{ textAlign: 'center', fontWeight: 700, color: 'var(--stg-text)', letterSpacing: '0.05em' }}>
                                                {store.code || <span style={{ color: 'var(--stg-text-muted)', fontStyle: 'italic', fontWeight: 400 }}>—</span>}
                                            </div>
                                        )}
                                    </td>

                                    {/* ─ Store Name ─ */}
                                    <td>
                                        <div className="stg-store-name-cell">
                                            <div className="stg-store-icon">
                                                <span className="material-symbols-outlined">storefront</span>
                                            </div>
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    value={draftStore?.name || ''}
                                                    onChange={(e) => handleUpdateDraftStore('name', e.target.value)}
                                                    className="stg-input"
                                                    placeholder="VD: Siêu thị Sunmart BEE"
                                                    aria-label="Tên cửa hàng"
                                                    style={{ flex: 1 }}
                                                />
                                            ) : (
                                                <div>
                                                    <div style={{ color: 'var(--stg-text)', fontWeight: 600 }}>
                                                        {store.name || <span style={{ color: 'var(--stg-text-muted)', fontStyle: 'italic', fontWeight: 400 }}>Chưa có tên</span>}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </td>

                                    {/* ─ Active Toggle ─ */}
                                    <td style={{ textAlign: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                            <span className={`stg-status-dot ${isActive ? 'active' : 'inactive'}`} />
                                            <button
                                                className={`stg-toggle-btn ${isActive ? 'active' : 'inactive'}`}
                                                onClick={() => handleToggleStoreActive(i)}
                                                disabled={saving}
                                                title={isActive ? 'Đang hoạt động — bấm để tắt' : 'Đã tắt — bấm để bật'}
                                                aria-label={`Trạng thái cửa hàng ${store.name}: ${isActive ? 'Hoạt động' : 'Ngưng'}`}
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
                                                    <button onClick={() => handleSaveStore(i)} className="stg-btn-icon stg-btn-save" title="Lưu" disabled={saving}>
                                                        {saving
                                                            ? <span className="material-symbols-outlined stg-spin" style={{ fontSize: 16 }}>progress_activity</span>
                                                            : <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check</span>
                                                        }
                                                    </button>
                                                    <button onClick={() => handleCancelStore(i)} className="stg-btn-icon" title="Hủy" disabled={saving}>
                                                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => handleEditStore(i)} className="stg-btn-icon" title="Chỉnh sửa" disabled={saving}>
                                                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                                                    </button>
                                                    <button onClick={() => handleRemoveStore(i)} className="stg-btn-icon stg-btn-danger" title="Xóa" disabled={saving}>
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

                {/* ─── Empty State ─── */}
                {stores.length === 0 && (
                    <div className="stg-empty">
                        <span className="material-symbols-outlined">domain_disabled</span>
                        <p>Chưa có cửa hàng nào được định nghĩa</p>
                        <p style={{ fontSize: 12, marginBottom: 12 }}>Thêm cửa hàng đầu tiên để bắt đầu quản lý hệ thống</p>
                        <button onClick={handleAddStore} className="stg-btn stg-btn-primary stg-emerald" disabled={saving}>
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add_business</span>
                            Tạo cửa hàng đầu tiên
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
