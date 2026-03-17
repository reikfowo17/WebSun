import React, { useState } from 'react';
import { ToastContextType } from '../../contexts/ToastContext';
import { SystemService, StoreConfig, StoreShiftConfig } from '../../services/system';
import ConfirmDialog from '../../components/ConfirmDialog';

interface Props {
    toast: ToastContextType;
    initialStores: StoreConfig[];
}

const SHIFT_ICONS = ['wb_sunny', 'wb_twilight', 'dark_mode', 'nights_stay', 'inventory_2', 'local_shipping', 'schedule'];

export const SettingsStoresAndShifts: React.FC<Props> = ({ toast, initialStores }) => {
    const [stores, setStores] = useState<StoreConfig[]>(initialStores);
    const [storeShiftsMap, setStoreShiftsMap] = useState<Map<string, StoreShiftConfig[]>>(new Map());
    const [expandedStoreId, setExpandedStoreId] = useState<string | null>(null);
    const [editingStoreIdx, setEditingStoreIdx] = useState<number | null>(null);
    const [draftStore, setDraftStore] = useState<StoreConfig | null>(null);
    const [editingShiftId, setEditingShiftId] = useState<number | null>(null);
    const [draftShift, setDraftShift] = useState<Partial<StoreShiftConfig> | null>(null);
    const [saving, setSaving] = useState(false);
    const [loadingShifts, setLoadingShifts] = useState<string | null>(null);
    const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
    const [dragStoreId, setDragStoreId] = useState<number | null>(null);

    /* ── Load shifts when expanding a store ── */
    const loadStoreShifts = async (storeId: string) => {
        setLoadingShifts(storeId);
        try {
            const shifts = await SystemService.getStoreShifts(storeId);
            setStoreShiftsMap(prev => new Map(prev).set(storeId, shifts));
        } catch (e) {
            toast.error('Lỗi tải ca: ' + (e instanceof Error ? e.message : String(e)));
        } finally {
            setLoadingShifts(null);
        }
    };

    const toggleExpand = (storeId: string) => {
        if (expandedStoreId === storeId) {
            setExpandedStoreId(null);
        } else {
            setExpandedStoreId(storeId);
            if (!storeShiftsMap.has(storeId)) loadStoreShifts(storeId);
        }
    };

    /* ═══ STORE CRUD ═══ */
    const handleAddStore = () => {
        if (editingStoreIdx !== null) return;
        const newStore: StoreConfig = { id: '', code: '', name: '', is_active: true, sort_order: stores.length };
        setStores([...stores, newStore]);
        setEditingStoreIdx(stores.length);
        setDraftStore(newStore);
    };

    const handleSaveStore = async (idx: number) => {
        if (!draftStore || !draftStore.code || !draftStore.name) {
            toast.error('Vui lòng nhập Mã và Tên cửa hàng');
            return;
        }
        setSaving(true);
        try {
            const res = await SystemService.saveStore({ ...draftStore, sort_order: draftStore.sort_order ?? idx });
            if (res.success && res.data) {
                const newStores = [...stores];
                newStores[idx] = res.data;
                setStores(newStores);
                setEditingStoreIdx(null);
                setDraftStore(null);
                toast.success('Lưu cửa hàng thành công');
            } else {
                toast.error(res.message || 'Lưu thất bại');
            }
        } catch (e: unknown) {
            toast.error('Lỗi: ' + (e instanceof Error ? e.message : String(e)));
        } finally {
            setSaving(false);
        }
    };

    const handleCancelStore = (idx: number) => {
        if (stores[idx].id === '') setStores(stores.filter((_, i) => i !== idx));
        setEditingStoreIdx(null);
        setDraftStore(null);
    };

    const handleToggleStore = async (idx: number) => {
        const store = stores[idx];
        setSaving(true);
        try {
            const res = await SystemService.saveStore({ ...store, is_active: !store.is_active });
            if (res.success && res.data) {
                const newStores = [...stores];
                newStores[idx] = res.data;
                setStores(newStores);
                toast.success(`Đã ${res.data.is_active ? 'bật' : 'tắt'} cửa hàng`);
            }
        } catch (e: unknown) {
            toast.error('Lỗi: ' + (e instanceof Error ? e.message : String(e)));
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteStore = (idx: number) => {
        const store = stores[idx];
        if (!store.id) { setStores(stores.filter((_, i) => i !== idx)); return; }
        setConfirmDialog({
            title: 'Xóa cửa hàng',
            message: `Bạn có chắc xoá "${store.name}"? Tất cả ca làm, lịch xếp và đăng ký liên quan sẽ bị ảnh hưởng.`,
            onConfirm: async () => {
                setConfirmDialog(null);
                setSaving(true);
                try {
                    const res = await SystemService.deleteStore(store.id);
                    if (res.success) {
                        setStores(stores.filter((_, i) => i !== idx));
                        if (expandedStoreId === store.id) setExpandedStoreId(null);
                        toast.success('Đã xoá cửa hàng');
                    } else toast.error(res.message || 'Xoá thất bại');
                } catch (e: unknown) {
                    toast.error('Lỗi: ' + (e instanceof Error ? e.message : String(e)));
                } finally { setSaving(false); }
            },
        });
    };

    /* ═══ SHIFT CRUD (per-store) ═══ */
    const handleAddShift = (storeId: string, type: 'MAIN' | 'SUPPORT' = 'MAIN') => {
        if (editingShiftId !== null) return;
        const existingShifts = storeShiftsMap.get(storeId) || [];
        const tempId = -(Date.now());
        const newShift: Partial<StoreShiftConfig> = {
            id: tempId, store_id: storeId, name: '', time_start: '', time_end: '',
            type, icon: 'schedule', max_slots: 0, sort_order: existingShifts.length, is_active: true,
        };
        setStoreShiftsMap(prev => {
            const m = new Map(prev);
            m.set(storeId, [...(m.get(storeId) || []), newShift as StoreShiftConfig]);
            return m;
        });
        setEditingShiftId(tempId);
        setDraftShift(newShift);
    };

    const handleSaveShift = async () => {
        if (!draftShift || !draftShift.name || !draftShift.time_start || !draftShift.time_end) {
            toast.error('Vui lòng nhập Tên ca, Giờ bắt đầu và Giờ kết thúc');
            return;
        }
        if (draftShift.type === 'SUPPORT' && !draftShift.parent_id) {
            toast.error('Ca hỗ trợ phải chọn ca chính gốc');
            return;
        }
        setSaving(true);
        try {
            const isNew = (draftShift.id || 0) < 0;
            const payload = { ...draftShift };
            if (isNew) delete (payload as any).id;
            const res = await SystemService.saveStoreShift(payload);
            if (res.success && res.data) {
                const storeId = draftShift.store_id!;
                setStoreShiftsMap(prev => {
                    const m = new Map(prev);
                    const shifts = m.get(storeId) || [];
                    if (isNew) {
                        m.set(storeId, shifts.map(s => s.id === draftShift.id ? res.data! : s));
                    } else {
                        m.set(storeId, shifts.map(s => s.id === res.data!.id ? res.data! : s));
                    }
                    return m;
                });
                setEditingShiftId(null);
                setDraftShift(null);
                toast.success('Lưu ca thành công');
            } else {
                toast.error(res.message || 'Lưu thất bại');
            }
        } catch (e: unknown) {
            toast.error('Lỗi: ' + (e instanceof Error ? e.message : String(e)));
        } finally {
            setSaving(false);
        }
    };

    const handleCancelShift = () => {
        if (draftShift && (draftShift.id || 0) < 0) {
            const storeId = draftShift.store_id!;
            setStoreShiftsMap(prev => {
                const m = new Map(prev);
                m.set(storeId, (m.get(storeId) || []).filter(s => s.id !== draftShift.id));
                return m;
            });
        }
        setEditingShiftId(null);
        setDraftShift(null);
    };

    const handleEditShift = (shift: StoreShiftConfig) => {
        if (editingShiftId !== null) return;
        setEditingShiftId(shift.id);
        setDraftShift({ ...shift });
    };

    const handleDeleteShift = (shift: StoreShiftConfig) => {
        setConfirmDialog({
            title: 'Xóa ca làm',
            message: `Xóa ca "${shift.name}" khỏi cửa hàng?`,
            onConfirm: async () => {
                setConfirmDialog(null);
                setSaving(true);
                try {
                    const res = await SystemService.deleteStoreShift(shift.id);
                    if (res.success) {
                        setStoreShiftsMap(prev => {
                            const m = new Map(prev);
                            m.set(shift.store_id, (m.get(shift.store_id) || []).filter(s => s.id !== shift.id));
                            return m;
                        });
                        toast.success('Đã xoá ca');
                    } else toast.error(res.message || 'Xoá thất bại');
                } catch (e: unknown) {
                    toast.error('Lỗi: ' + (e instanceof Error ? e.message : String(e)));
                } finally { setSaving(false); }
            },
        });
    };

    const handleToggleShift = async (shift: StoreShiftConfig) => {
        setSaving(true);
        try {
            const res = await SystemService.saveStoreShift({ ...shift, is_active: !shift.is_active });
            if (res.success && res.data) {
                setStoreShiftsMap(prev => {
                    const m = new Map(prev);
                    m.set(shift.store_id, (m.get(shift.store_id) || []).map(s => s.id === shift.id ? res.data! : s));
                    return m;
                });
                toast.success(`Đã ${res.data.is_active ? 'bật' : 'tắt'} ca "${shift.name}"`);
            }
        } catch (e: unknown) {
            toast.error('Lỗi: ' + (e instanceof Error ? e.message : String(e)));
        } finally { setSaving(false); }
    };

    /* ── Group shifts: main first, support nested under parent ── */
    const groupShifts = (shifts: StoreShiftConfig[]) => {
        const mains = shifts.filter(s => s.type === 'MAIN').sort((a, b) => a.sort_order - b.sort_order);
        const sups = shifts.filter(s => s.type === 'SUPPORT');
        const result: { shift: StoreShiftConfig; isSupport: boolean }[] = [];
        mains.forEach(m => {
            result.push({ shift: m, isSupport: false });
            sups.filter(s => s.parent_id === m.id).sort((a, b) => a.sort_order - b.sort_order)
                .forEach(s => result.push({ shift: s, isSupport: true }));
        });
        sups.filter(s => !mains.some(m => m.id === s.parent_id))
            .forEach(s => result.push({ shift: s, isSupport: true }));
        return result;
    };

    const activeStoreCount = stores.filter(s => s.is_active !== false).length;

    return (
        <>
            <div className="stg-section-animate">
                <div className="stg-table-wrap">
                    {/* ─── Toolbar ─── */}
                    <div className="stg-toolbar">
                        <div className="stg-toolbar-left">
                            <span className="stg-badge">{stores.length} cửa hàng</span>
                            {stores.length > 0 && (
                                <span style={{ fontSize: 12, color: '#9CA3AF' }}>
                                    · {activeStoreCount} hoạt động
                                </span>
                            )}
                        </div>
                        <div className="stg-toolbar-right">
                            <button onClick={handleAddStore} className="stg-btn stg-btn-primary stg-emerald"
                                disabled={saving || editingStoreIdx !== null}>
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add_business</span>
                                Thêm Cửa Hàng
                            </button>
                        </div>
                    </div>

                    {/* ─── Stores Table ─── */}
                    <table className="stg-table stg-table-fixed">
                        <colgroup>
                            <col style={{ width: '6%' }} />
                            <col style={{ width: '12%' }} />
                            <col style={{ width: '42%' }} />
                            <col style={{ width: '10%' }} />
                            <col style={{ width: '12%' }} />
                            <col style={{ width: '18%' }} />
                        </colgroup>
                        <thead>
                            <tr>
                                <th style={{ paddingLeft: 36 }}>#</th>
                                <th style={{ textAlign: 'center' }}>MÃ ERP</th>
                                <th>TÊN CỬA HÀNG</th>
                                <th style={{ textAlign: 'center' }}>CA LÀM</th>
                                <th style={{ textAlign: 'center' }}>TRẠNG THÁI</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {stores.map((store, i) => {
                                const isEditing = editingStoreIdx === i;
                                const isNew = store.id === '';
                                const isActive = store.is_active !== false;
                                const isExpanded = expandedStoreId === store.id && store.id !== '';
                                const shifts = storeShiftsMap.get(store.id) || [];
                                const mainShifts = shifts.filter(s => s.type === 'MAIN');
                                const grouped = groupShifts(shifts);

                                return (
                                    <React.Fragment key={store.id || `new-${i}`}>
                                        {/* ── Store Row ── */}
                                        <tr className={`stg-table-row${isNew ? ' stg-row-new' : ''}`}
                                            style={{
                                                opacity: !isActive && !isEditing ? 0.55 : 1,
                                                cursor: store.id && !isEditing ? 'pointer' : 'default',
                                                background: isExpanded ? '#FEFCE8' : undefined,
                                            }}
                                            onClick={() => store.id && !isEditing && toggleExpand(store.id)}>

                                            {/* # */}
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 8 }}>
                                                    <span className="material-symbols-outlined stg-drag-handle"
                                                        onMouseEnter={() => setDragStoreId(i)}
                                                        onMouseLeave={() => setDragStoreId(null)}>drag_indicator</span>
                                                    <span className="stg-row-num">{i + 1}</span>
                                                </div>
                                            </td>

                                            {/* Code */}
                                            <td onClick={e => isEditing && e.stopPropagation()}>
                                                {isEditing ? (
                                                    <input type="text" value={draftStore?.code || ''}
                                                        onChange={e => setDraftStore(d => d ? { ...d, code: e.target.value.toUpperCase() } : d)}
                                                        className="stg-input stg-input-mono stg-input-center"
                                                        placeholder="ABC" autoFocus aria-label="Mã ERP cửa hàng" />
                                                ) : (
                                                    <div className="stg-input-mono" style={{ textAlign: 'center', fontWeight: 700, color: '#1F1D13', letterSpacing: '0.05em' }}>
                                                        {store.code || <span style={{ color: '#9CA3AF', fontStyle: 'italic', fontWeight: 400 }}>—</span>}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Name */}
                                            <td onClick={e => isEditing && e.stopPropagation()}>
                                                <div className="stg-store-name-cell">
                                                    <div className="stg-store-icon">
                                                        <span className="material-symbols-outlined">storefront</span>
                                                    </div>
                                                    {isEditing ? (
                                                        <input type="text" value={draftStore?.name || ''}
                                                            onChange={e => setDraftStore(d => d ? { ...d, name: e.target.value } : d)}
                                                            className="stg-input" placeholder="VD: Siêu thị Sunmart BEE"
                                                            aria-label="Tên cửa hàng" style={{ flex: 1 }} />
                                                    ) : (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            <span style={{ fontWeight: 600, color: '#1F1D13', fontSize: 14 }}>
                                                                {store.name || <span style={{ color: '#9CA3AF', fontStyle: 'italic', fontWeight: 400 }}>Chưa có tên</span>}
                                                            </span>
                                                            {store.id && !isExpanded && (
                                                                <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#D1D5DB', transition: 'transform 200ms' }}>chevron_right</span>
                                                            )}
                                                            {isExpanded && (
                                                                <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#D69E0A', transform: 'rotate(90deg)', transition: 'transform 200ms' }}>chevron_right</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Shifts count */}
                                            <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                                                {store.id && shifts.length > 0 ? (
                                                    <span className="stg-badge" style={{ background: '#EFF6FF', color: '#1D4ED8', borderColor: '#93C5FD' }}>
                                                        {shifts.length} ca
                                                    </span>
                                                ) : store.id ? (
                                                    <span style={{ fontSize: 11, color: '#D1D5DB' }}>—</span>
                                                ) : null}
                                            </td>

                                            {/* Toggle */}
                                            <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                                    <span className={`stg-status-dot ${isActive ? 'active' : 'inactive'}`} />
                                                    <button className={`stg-toggle-btn ${isActive ? 'active' : 'inactive'}`}
                                                        onClick={() => handleToggleStore(i)} disabled={saving}
                                                        title={isActive ? 'Đang hoạt động — bấm để tắt' : 'Đã tắt — bấm để bật'}
                                                        aria-label={`Trạng thái cửa hàng ${store.name}: ${isActive ? 'Hoạt động' : 'Ngưng'}`}>
                                                        <span className="stg-toggle-knob" />
                                                    </button>
                                                    <span className={`stg-status-label ${isActive ? 'active' : 'inactive'}`}>
                                                        {isActive ? 'Bật' : 'Tắt'}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Actions */}
                                            <td onClick={e => e.stopPropagation()}>
                                                <div className="stg-row-actions" style={isEditing ? { opacity: 1 } : undefined}>
                                                    {isEditing ? (
                                                        <>
                                                            <button onClick={() => handleSaveStore(i)} className="stg-btn-icon stg-btn-save" disabled={saving}>
                                                                {saving ? <span className="material-symbols-outlined stg-spin" style={{ fontSize: 16 }}>progress_activity</span>
                                                                    : <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check</span>}
                                                            </button>
                                                            <button onClick={() => handleCancelStore(i)} className="stg-btn-icon" disabled={saving}>
                                                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button onClick={() => { setEditingStoreIdx(i); setDraftStore(store); }} className="stg-btn-icon" disabled={saving}>
                                                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                                                            </button>
                                                            <button onClick={() => handleDeleteStore(i)} className="stg-btn-icon stg-btn-danger" disabled={saving}>
                                                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete_outline</span>
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>

                                        {/* ── Expanded Shifts Panel ── */}
                                        {isExpanded && (
                                            <tr>
                                                <td colSpan={6} style={{ padding: 0, background: '#FAFAF8', borderBottom: '2px solid #FCD34D' }}>
                                                    <div className="stg-expand-panel" style={{ paddingLeft: 20, paddingRight: 20, paddingTop: 16, paddingBottom: 16 }}>
                                                        {loadingShifts === store.id ? (
                                                            <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>
                                                                <span className="material-symbols-outlined stg-spin" style={{ fontSize: 20 }}>progress_activity</span>
                                                                <p style={{ marginTop: 4 }}>Đang tải ca...</p>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="stg-expand-label">
                                                                    <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 4 }}>schedule</span>
                                                                    Ca làm của {store.name}
                                                                </div>

                                                                {/* Shift sub-table */}
                                                                <div style={{ background: '#FFFFFF', borderRadius: 10, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
                                                                    <table className="stg-table">
                                                                        <thead>
                                                                            <tr>
                                                                                <th style={{ width: '28%', paddingLeft: 20 }}>TÊN CA</th>
                                                                                <th style={{ width: '14%' }}>BẮT ĐẦU</th>
                                                                                <th style={{ width: '14%' }}>KẾT THÚC</th>
                                                                                <th style={{ width: '14%' }}>LOẠI</th>
                                                                                <th style={{ width: '10%', textAlign: 'center' }}>SLOT</th>
                                                                                <th style={{ width: '8%', textAlign: 'center' }}>ON/OFF</th>
                                                                                <th style={{ width: '12%' }}></th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {grouped.map(({ shift, isSupport }) => {
                                                                                const isShiftEditing = editingShiftId === shift.id;
                                                                                const parentName = isSupport && shift.parent_id
                                                                                    ? mainShifts.find(m => m.id === shift.parent_id)?.name
                                                                                    : null;
                                                                                return (
                                                                                    <tr key={shift.id} className={`stg-table-row${isShiftEditing ? ' stg-row-new' : ''}`}
                                                                                        style={{ opacity: shift.is_active ? 1 : 0.45 }}>

                                                                                        {/* Name */}
                                                                                        <td style={{ paddingLeft: isSupport ? 36 : 20 }}>
                                                                                            <div className="stg-shift-name-cell">
                                                                                                {isSupport && <span style={{ color: '#93C5FD', fontSize: 11, marginRight: -4 }}>↳</span>}
                                                                                                {isShiftEditing ? (
                                                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                                                                                                        <select value={draftShift?.icon || 'schedule'}
                                                                                                            onChange={e => setDraftShift(d => d ? { ...d, icon: e.target.value } : d)}
                                                                                                            className="stg-input stg-input-mono"
                                                                                                            style={{ width: 48, padding: '4px 2px', fontSize: 11 }}>
                                                                                                            {SHIFT_ICONS.map(ic => <option key={ic} value={ic}>{ic.replace(/_/g, ' ')}</option>)}
                                                                                                        </select>
                                                                                                        <input type="text" value={draftShift?.name || ''}
                                                                                                            onChange={e => setDraftShift(d => d ? { ...d, name: e.target.value } : d)}
                                                                                                            className="stg-input" placeholder="Tên ca" autoFocus style={{ flex: 1 }} />
                                                                                                    </div>
                                                                                                ) : (
                                                                                                    <>
                                                                                                        <span className="stg-shift-inline-icon"
                                                                                                            style={isSupport ? { background: '#EFF6FF', color: '#3B82F6' } : undefined}>
                                                                                                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                                                                                                                {shift.icon || 'schedule'}
                                                                                                            </span>
                                                                                                        </span>
                                                                                                        <span style={{ fontWeight: 600, color: '#1F1D13', fontSize: 13 }}>{shift.name}</span>
                                                                                                    </>
                                                                                                )}
                                                                                            </div>
                                                                                        </td>

                                                                                        {/* Start */}
                                                                                        <td>
                                                                                            {isShiftEditing ? (
                                                                                                <input type="time" value={draftShift?.time_start || ''}
                                                                                                    onChange={e => setDraftShift(d => d ? { ...d, time_start: e.target.value } : d)}
                                                                                                    className="stg-input stg-input-mono" />
                                                                                            ) : (
                                                                                                <span className="stg-input-mono" style={{ fontSize: 13, color: '#6B7280' }}>{shift.time_start}</span>
                                                                                            )}
                                                                                        </td>

                                                                                        {/* End */}
                                                                                        <td>
                                                                                            {isShiftEditing ? (
                                                                                                <input type="time" value={draftShift?.time_end || ''}
                                                                                                    onChange={e => setDraftShift(d => d ? { ...d, time_end: e.target.value } : d)}
                                                                                                    className="stg-input stg-input-mono" />
                                                                                            ) : (
                                                                                                <span className="stg-input-mono" style={{ fontSize: 13, color: '#6B7280' }}>{shift.time_end}</span>
                                                                                            )}
                                                                                        </td>

                                                                                        {/* Type */}
                                                                                        <td>
                                                                                            {isShiftEditing ? (
                                                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                                                                    <select value={draftShift?.type || 'MAIN'}
                                                                                                        onChange={e => setDraftShift(d => d ? { ...d, type: e.target.value as 'MAIN' | 'SUPPORT' } : d)}
                                                                                                        className="stg-input stg-input-mono" style={{ padding: '4px 6px', fontSize: 11 }}>
                                                                                                        <option value="MAIN">Ca Chính</option>
                                                                                                        <option value="SUPPORT">Ca Hỗ Trợ</option>
                                                                                                    </select>
                                                                                                    {draftShift?.type === 'SUPPORT' && (
                                                                                                        <select value={draftShift?.parent_id || ''}
                                                                                                            onChange={e => setDraftShift(d => d ? { ...d, parent_id: Number(e.target.value) || null } : d)}
                                                                                                            className="stg-input stg-input-mono" style={{ padding: '4px 6px', fontSize: 10 }}>
                                                                                                            <option value="">Chọn ca gốc...</option>
                                                                                                            {mainShifts.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                                                                                        </select>
                                                                                                    )}
                                                                                                </div>
                                                                                            ) : (
                                                                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                                                    <span className="stg-badge" style={{
                                                                                                        alignSelf: 'flex-start', fontSize: 10, padding: '2px 8px',
                                                                                                        background: isSupport ? '#EFF6FF' : '#FEF9C3',
                                                                                                        color: isSupport ? '#1D4ED8' : '#D69E0A',
                                                                                                        borderColor: isSupport ? '#93C5FD' : '#FCD34D',
                                                                                                    }}>{isSupport ? 'Hỗ trợ' : 'Chính'}</span>
                                                                                                    {parentName && <span style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>↳ {parentName}</span>}
                                                                                                </div>
                                                                                            )}
                                                                                        </td>

                                                                                        {/* Max slots */}
                                                                                        <td style={{ textAlign: 'center' }}>
                                                                                            {isShiftEditing ? (
                                                                                                <input type="number" min="0" value={draftShift?.max_slots ?? ''}
                                                                                                    onChange={e => setDraftShift(d => d ? { ...d, max_slots: parseInt(e.target.value) || 0 } : d)}
                                                                                                    className="stg-input" style={{ width: 56, textAlign: 'center' }} placeholder="0" />
                                                                                            ) : (
                                                                                                <span style={{ fontWeight: 600, fontSize: 13, color: '#1F1D13' }}>
                                                                                                    {shift.max_slots ? `${shift.max_slots} người` : <span style={{ color: '#D1D5DB', fontWeight: 400, fontSize: 11 }}>∞</span>}
                                                                                                </span>
                                                                                            )}
                                                                                        </td>

                                                                                        {/* Toggle */}
                                                                                        <td style={{ textAlign: 'center' }}>
                                                                                            <button className={`stg-toggle-btn ${shift.is_active ? 'active' : 'inactive'}`}
                                                                                                onClick={() => handleToggleShift(shift)} disabled={saving || isShiftEditing}
                                                                                                style={{ transform: 'scale(0.85)' }}>
                                                                                                <span className="stg-toggle-knob" />
                                                                                            </button>
                                                                                        </td>

                                                                                        {/* Actions */}
                                                                                        <td>
                                                                                            <div className="stg-row-actions" style={isShiftEditing ? { opacity: 1 } : undefined}>
                                                                                                {isShiftEditing ? (
                                                                                                    <>
                                                                                                        <button onClick={handleSaveShift} className="stg-btn-icon stg-btn-save" disabled={saving}>
                                                                                                            {saving ? <span className="material-symbols-outlined stg-spin" style={{ fontSize: 16 }}>progress_activity</span>
                                                                                                                : <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check</span>}
                                                                                                        </button>
                                                                                                        <button onClick={handleCancelShift} className="stg-btn-icon" disabled={saving}>
                                                                                                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                                                                                                        </button>
                                                                                                    </>
                                                                                                ) : (
                                                                                                    <>
                                                                                                        <button onClick={() => handleEditShift(shift)} className="stg-btn-icon" disabled={saving}>
                                                                                                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                                                                                                        </button>
                                                                                                        <button onClick={() => handleDeleteShift(shift)} className="stg-btn-icon stg-btn-danger" disabled={saving}>
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

                                                                    {shifts.length === 0 && (
                                                                        <div style={{ padding: '24px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>
                                                                            <span className="material-symbols-outlined" style={{ fontSize: 28, display: 'block', marginBottom: 4, color: '#D1D5DB' }}>event_busy</span>
                                                                            Chưa có ca nào. Thêm ca chính trước, rồi thêm ca hỗ trợ.
                                                                        </div>
                                                                    )}

                                                                    {/* Add shift buttons */}
                                                                    <div style={{ display: 'flex', gap: 8, padding: '10px 14px', borderTop: '1px solid #F3F4F6' }}>
                                                                        <button onClick={() => handleAddShift(store.id, 'MAIN')}
                                                                            className="stg-btn" disabled={saving || editingShiftId !== null}
                                                                            style={{ fontSize: 12, padding: '6px 12px', background: '#FEF9C3', color: '#D69E0A', border: '1px solid #FCD34D' }}>
                                                                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
                                                                            Ca Chính
                                                                        </button>
                                                                        {mainShifts.length > 0 && (
                                                                            <button onClick={() => handleAddShift(store.id, 'SUPPORT')}
                                                                                className="stg-btn" disabled={saving || editingShiftId !== null}
                                                                                style={{ fontSize: 12, padding: '6px 12px', background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #93C5FD' }}>
                                                                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
                                                                                Ca Hỗ Trợ
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>

                    {/* Empty */}
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

            {confirmDialog && (
                <ConfirmDialog title={confirmDialog.title} message={confirmDialog.message}
                    onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)} />
            )}
        </>
    );
};
