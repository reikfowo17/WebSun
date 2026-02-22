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

    const handleStoreDragLeave = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
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

    return (
        <div className="stg-section-animate">
            <div className="stg-table-wrap">
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #e2e8f0', background: '#fff', gap: '8px' }}>
                    <div className="stg-badge">{stores.length} cửa hàng</div>
                    <button onClick={handleAddStore} className="stg-btn stg-btn-primary stg-emerald" disabled={saving}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add_business</span>
                        Thêm Cửa Hàng
                    </button>
                </div>
                <table className="stg-table stg-table-fixed">
                    <colgroup>
                        <col style={{ width: '8%' }} />
                        <col style={{ width: '15%' }} />
                        <col style={{ width: '45%' }} />
                        <col style={{ width: '15%' }} />
                        <col style={{ width: '17%' }} />
                    </colgroup>
                    <thead>
                        <tr>
                            <th style={{ paddingLeft: '36px' }}>#</th>
                            <th style={{ textAlign: 'center' }}>MÃ ERP</th>
                            <th style={{ paddingLeft: '8px' }}>TÊN CỬA HÀNG</th>
                            <th style={{ textAlign: 'center' }}>HOẠT ĐỘNG</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {stores.map((store, i) => {
                            const isNew = store.id === '';
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
                                        borderTop: dragStoreOverIndex === i && draggedStoreIndex !== i && dragStoreOverIndex < (draggedStoreIndex || 0) ? '2px solid #10b981' : undefined,
                                        borderBottom: dragStoreOverIndex === i && draggedStoreIndex !== i && dragStoreOverIndex > (draggedStoreIndex || 0) ? '2px solid #10b981' : undefined,
                                    }}
                                >
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '8px' }}>
                                            <span
                                                className="material-symbols-outlined drag-handle"
                                                style={{ cursor: 'grab', color: '#cbd5e1', fontSize: '20px' }}
                                                onMouseEnter={() => setDragStoreId(i)}
                                                onMouseLeave={() => setDragStoreId(null)}
                                            >drag_indicator</span>
                                            <span className="stg-row-num">{i + 1}</span>
                                        </div>
                                    </td>
                                    <td>
                                        {editingStoreIndex === i ? (
                                            <input
                                                type="text"
                                                value={draftStore?.code || ''}
                                                onChange={(e) => handleUpdateDraftStore('code', e.target.value.toUpperCase())}
                                                className="stg-input stg-input-mono stg-input-center"
                                                placeholder="ABC"
                                                autoFocus
                                            />
                                        ) : (
                                            <div className="stg-input-mono" style={{ textAlign: 'center', fontWeight: 600, color: '#334155' }}>
                                                {store.code || <span style={{ color: '#94a3b8', fontStyle: 'italic', fontWeight: 400 }}>Trống</span>}
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        {editingStoreIndex === i ? (
                                            <input
                                                type="text"
                                                value={draftStore?.name || ''}
                                                onChange={(e) => handleUpdateDraftStore('name', e.target.value)}
                                                className="stg-input"
                                                placeholder="VD: Siêu thị Sunmart BEE"
                                            />
                                        ) : (
                                            <div style={{ color: '#475569', fontWeight: 500, paddingLeft: 8 }}>
                                                {store.name || <span style={{ color: '#94a3b8', fontStyle: 'italic', fontWeight: 400 }}>Chưa có tên</span>}
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <button
                                            className={`stg-toggle-switch ${store.is_active !== false ? 'active' : ''}`}
                                            onClick={() => handleToggleStoreActive(i)}
                                            disabled={saving}
                                            style={{
                                                background: store.is_active !== false ? '#10b981' : '#cbd5e1',
                                                border: 'none',
                                                borderRadius: '20px',
                                                width: '40px',
                                                height: '22px',
                                                position: 'relative',
                                                cursor: saving ? 'not-allowed' : 'pointer',
                                                transition: 'all 0.2s',
                                                padding: 0,
                                                opacity: saving ? 0.7 : 1
                                            }}
                                            title={store.is_active !== false ? "Đang hoạt động" : "Ngưng hoạt động"}
                                        >
                                            <span style={{
                                                position: 'absolute',
                                                top: '2px',
                                                left: store.is_active !== false ? '19px' : '2px',
                                                width: '18px',
                                                height: '18px',
                                                background: '#fff',
                                                borderRadius: '50%',
                                                transition: 'all 0.2s'
                                            }} />
                                        </button>
                                    </td>
                                    <td>
                                        <div className="stg-row-actions">
                                            {editingStoreIndex === i ? (
                                                <>
                                                    <button onClick={() => handleSaveStore(i)} className="stg-btn-icon stg-btn-save" title="Lưu" disabled={saving}>
                                                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check</span>
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
                {stores.length === 0 && (
                    <div className="stg-empty">
                        <span className="material-symbols-outlined">domain_disabled</span>
                        <p>Chưa có cửa hàng nào được định nghĩa</p>
                        <button onClick={handleAddStore} className="stg-btn stg-btn-outline stg-emerald" style={{ marginTop: 12 }} disabled={saving}>
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add_business</span>
                            Tạo cửa hàng đầu tiên
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
