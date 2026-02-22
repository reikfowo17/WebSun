import React, { useState, useEffect, useCallback } from 'react';
import { SystemService, ShiftConfig, StoreConfig } from '../services/system';
import PortalHeader from '../components/PortalHeader';
import '../styles/settings.css';

interface SettingsTabProps {
    toast: any;
}

type SettingsSection = 'shifts' | 'stores';

const SettingsTab: React.FC<SettingsTabProps> = ({ toast }) => {
    const [shifts, setShifts] = useState<ShiftConfig[]>([]);
    const [stores, setStores] = useState<StoreConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeSection, setActiveSection] = useState<SettingsSection>('shifts');
    const [draggedShiftIndex, setDraggedShiftIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const [draggedStoreIndex, setDraggedStoreIndex] = useState<number | null>(null);
    const [dragStoreOverIndex, setDragStoreOverIndex] = useState<number | null>(null);
    const [dragShiftId, setDragShiftId] = useState<number | null>(null);
    const [dragStoreId, setDragStoreId] = useState<number | null>(null);

    const [editingShiftIndex, setEditingShiftIndex] = useState<number | null>(null);
    const [draftShift, setDraftShift] = useState<ShiftConfig | null>(null);
    const [editingStoreIndex, setEditingStoreIndex] = useState<number | null>(null);
    const [draftStore, setDraftStore] = useState<StoreConfig | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [fetchedShifts, fetchedStores] = await Promise.all([
                SystemService.getShifts(),
                SystemService.getStores()
            ]);
            setShifts(fetchedShifts);
            setStores(fetchedStores);
        } catch (e: any) {
            toast.error('Lỗi khi tải cấu hình: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveShifts = async () => {
        setSaving(true);
        try {
            const res = await SystemService.saveShifts(shifts);
            if (res.success) {
                toast.success('Lưu cấu hình Ca làm việc thành công');
            } else {
                toast.error(res.message || 'Lưu thất bại');
            }
        } catch (e: any) {
            toast.error('Lỗi: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    const autoSaveShifts = async (newShifts: ShiftConfig[]) => {
        setSaving(true);
        try {
            const res = await SystemService.saveShifts(newShifts);
            if (res.success) {
                // optionally toast.success
            } else {
                toast.error(res.message || 'Lưu thứ tự thất bại');
            }
        } catch (e: any) {
            toast.error('Lỗi: ' + e.message);
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
        } catch (e: any) {
            toast.error('Lỗi: ' + e.message);
        }
    };

    const handleToggleStoreActive = async (index: number) => {
        const store = stores[index];
        const newActive = !store.is_active;
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
        } catch (e: any) {
            toast.error('Lỗi: ' + e.message);
        }
    };

    const handleRemoveStore = async (index: number) => {
        const store = stores[index];
        if (store.id) {
            if (!window.confirm('Bạn có chắc xoá cửa hàng này? (Dữ liệu liên quan có thể bị ảnh hưởng)')) return;
            try {
                const res = await SystemService.deleteStore(store.id);
                if (res.success) {
                    setStores(stores.filter((_, i) => i !== index));
                    toast.success('Đã xoá Cửa hàng');
                } else {
                    toast.error(res.message || 'Xoá thất bại');
                }
            } catch (e: any) {
                toast.error('Lỗi: ' + e.message);
            }
        } else {
            setStores(stores.filter((_, i) => i !== index));
        }
    };

    // Drag and Drop handlers for stores
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

        // Optionally save the new order here if backend supports it
        // ...
    };

    const handleStoreDragEnd = (e: React.DragEvent<HTMLTableRowElement>) => {
        setDraggedStoreIndex(null);
        setDragStoreOverIndex(null);
        if (e.currentTarget instanceof HTMLElement) {
            e.currentTarget.style.opacity = '1';
        }
    };

    const NAV_ITEMS: { id: SettingsSection; label: string; icon: string; desc: string; count?: number }[] = [
        { id: 'shifts', label: 'Ca Làm', icon: 'schedule', desc: 'Khung giờ & quy trình', count: shifts.length },
        { id: 'stores', label: 'Cửa Hàng', icon: 'storefront', desc: 'Danh mục cơ sở', count: stores.length },
    ];

    const renderSkeletonLoader = useCallback(() => (
        <div className="stg-skeleton">
            <div className="stg-sk-header" />
            <div className="stg-sk-body">
                <div className="stg-sk-line" style={{ width: '75%' }} />
                <div className="stg-sk-line" style={{ width: '50%' }} />
                <div className="stg-sk-card" />
                <div className="stg-sk-card" />
            </div>
        </div>
    ), []);

    /* ──────────── SHIFTS SECTION ──────────── */
    const renderShiftsSection = () => (
        <div className="stg-section-animate">
            {/* Section Header */}
            <div className="stg-section-header">
                <div className="stg-section-header-left">
                    <div className="stg-section-icon stg-blue">
                        <span className="material-symbols-outlined">schedule</span>
                    </div>
                    <div>
                        <h2 className="stg-section-title">Cấu hình Ca</h2>
                    </div>
                </div>
                <div className="stg-section-actions">
                    <button onClick={handleAddShift} className="stg-btn stg-btn-outline">
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
            </div>

            {/* Table */}
            <div className="stg-table-wrap">
                <table className="stg-table stg-table-fixed">
                    <colgroup>
                        <col style={{ width: '8%' }} />
                        <col style={{ width: '42%' }} />
                        <col style={{ width: '42%' }} />
                        <col style={{ width: '8%' }} />
                    </colgroup>
                    <thead>
                        <tr>
                            <th style={{ paddingLeft: '44px' }}>MÃ</th>
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
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '8px' }}>
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
                                        <span className="material-symbols-outlined stg-shift-inline-icon">{shift.icon || 'schedule'}</span>
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
                                                <button onClick={() => handleRemoveShift(i)} className="stg-btn-icon stg-btn-danger" title="Xóa ca này">
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
                        <button onClick={handleAddShift} className="stg-btn stg-btn-outline" style={{ marginTop: 12 }}>
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

    /* ──────────── STORES SECTION ──────────── */
    const renderStoresSection = () => (
        <div className="stg-section-animate">
            {/* Section Header */}
            <div className="stg-section-header">
                <div className="stg-section-header-left">
                    <div className="stg-section-icon stg-emerald">
                        <span className="material-symbols-outlined">storefront</span>
                    </div>
                    <div>
                        <h2 className="stg-section-title">Cửa Hàng</h2>
                    </div>
                </div>
                <div className="stg-section-actions">
                    <div className="stg-badge">{stores.length} cửa hàng</div>
                    <button onClick={handleAddStore} className="stg-btn stg-btn-primary stg-emerald">
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add_business</span>
                        Thêm Cửa Hàng
                    </button>
                </div>
            </div>

            {/* Stores Table */}
            <div className="stg-table-wrap">
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
                            <th style={{ paddingLeft: '44px' }}>#</th>
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
                                            style={{
                                                background: store.is_active !== false ? '#10b981' : '#cbd5e1',
                                                border: 'none',
                                                borderRadius: '20px',
                                                width: '40px',
                                                height: '22px',
                                                position: 'relative',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                padding: 0
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
                                                    <button onClick={() => handleSaveStore(i)} className="stg-btn-icon stg-btn-save" title="Lưu">
                                                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check</span>
                                                    </button>
                                                    <button onClick={() => handleCancelStore(i)} className="stg-btn-icon" title="Hủy">
                                                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => handleEditStore(i)} className="stg-btn-icon" title="Chỉnh sửa">
                                                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                                                    </button>
                                                    <button onClick={() => handleRemoveStore(i)} className="stg-btn-icon stg-btn-danger" title="Xóa">
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
                        <button onClick={handleAddStore} className="stg-btn stg-btn-outline stg-emerald" style={{ marginTop: 12 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add_business</span>
                            Tạo cửa hàng đầu tiên
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="stg-root">
            {/* ─── Tabs injected into global topbar via Portal ─── */}
            <PortalHeader>
                <div className="stg-portal-tabs">
                    {NAV_ITEMS.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActiveSection(item.id)}
                            className={`stg-tab${activeSection === item.id ? ' active' : ''}`}
                        >
                            <span className="material-symbols-outlined stg-tab-icon">{item.icon}</span>
                            <span className="stg-tab-label">{item.label}</span>
                            {item.count !== undefined && (
                                <span className="stg-tab-badge">{item.count}</span>
                            )}
                        </button>
                    ))}
                </div>
            </PortalHeader>

            {/* ─── Content ─── */}
            <div className="stg-content">
                {loading ? renderSkeletonLoader() : (
                    activeSection === 'shifts' ? renderShiftsSection() : renderStoresSection()
                )}
            </div>
        </div>
    );
};

export default SettingsTab;
