import React, { useState, useEffect } from 'react';
import { ToastContextType } from '../../contexts/ToastContext';
import type { HandoverProduct } from '../../types/shift';
import { HandoverService } from '../../services/shift';
import ConfirmDialog from '../../components/ConfirmDialog';
import { MultiStoreSelect } from '../../components/MultiStoreSelect';

import type { Store } from '../../types';

interface SettingsHandoverProductsProps {
    toast: ToastContextType;
    stores: Store[];
}

export const SettingsHandoverProducts: React.FC<SettingsHandoverProductsProps> = ({ toast, stores }) => {
    const [products, setProducts] = useState<HandoverProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [filterStore, setFilterStore] = useState<string>('ALL');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draft, setDraft] = useState<Partial<HandoverProduct>>({});
    const [isAdding, setIsAdding] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

    useEffect(() => {
        loadProducts();
    }, []);

    const loadProducts = async () => {
        setLoading(true);
        try {
            const data = await HandoverService.getProductTemplates();
            setProducts(data);
        } catch (err: unknown) {
            toast.error('Lỗi tải SP giao ca: ' + (err instanceof Error ? err.message : String(err)));
        } finally {
            setLoading(false);
        }
    };

    const filtered = products.filter(p => {
        return filterStore === 'ALL' || (p.store_ids === null) || p.store_ids.includes(filterStore);
    });

    const handleAdd = () => {
        if (isAdding || editingId) return;
        setIsAdding(true);
        setDraft({
            product_name: '',
            barcode: '',
            sort_order: (filtered.length || products.length) + 1,
            is_active: true,
            store_ids: filterStore !== 'ALL' ? [filterStore] : null,
        });
    };

    const handleSaveNew = async () => {
        if (!draft.product_name?.trim()) {
            toast.error('Vui lòng nhập tên sản phẩm');
            return;
        }
        setSaving(true);
        try {
            const created = await HandoverService.createProduct(draft);
            setProducts(prev => [...prev, created]);
            setIsAdding(false);
            setDraft({});
            toast.success('Đã thêm SP giao ca');
        } catch (err: unknown) {
            toast.error('Lỗi: ' + (err instanceof Error ? err.message : String(err)));
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (product: HandoverProduct) => {
        if (isAdding || editingId) return;
        setEditingId(product.id);
        setDraft({ ...product });
    };

    const handleSaveEdit = async () => {
        if (!editingId || !draft.product_name?.trim()) return;
        setSaving(true);
        try {
            const updated = await HandoverService.updateProduct(editingId, draft);
            setProducts(prev => prev.map(p => p.id === editingId ? updated : p));
            setEditingId(null);
            setDraft({});
            toast.success('Đã cập nhật');
        } catch (err: unknown) {
            toast.error('Lỗi: ' + (err instanceof Error ? err.message : String(err)));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (product: HandoverProduct) => {
        setConfirmDialog({
            title: 'Xóa SP giao ca',
            message: `Xóa "${product.product_name}"? Thao tác này không thể hoàn tác.`,
            onConfirm: async () => {
                setConfirmDialog(null);
                try {
                    await HandoverService.deleteProduct(product.id);
                    setProducts(prev => prev.filter(p => p.id !== product.id));
                    toast.success('Đã xóa');
                } catch (err: unknown) {
                    toast.error('Lỗi: ' + (err instanceof Error ? err.message : String(err)));
                }
            },
        });
    };

    const handleToggle = async (product: HandoverProduct) => {
        try {
            const updated = await HandoverService.updateProduct(product.id, { is_active: !product.is_active });
            setProducts(prev => prev.map(p => p.id === product.id ? updated : p));
            toast.success(`Đã ${updated.is_active ? 'bật' : 'tắt'} "${product.product_name}"`);
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
                    <div className="stg-toolbar">
                        <div className="stg-toolbar-left">
                            <span className="stg-badge">{products.length} sản phẩm</span>
                            <span style={{ fontSize: 12, color: 'var(--stg-text-muted)' }}>
                                · {products.filter(p => p.is_active).length} đang hoạt động
                            </span>
                        </div>
                        <div className="stg-toolbar-right">
                            {/* Store filter */}
                            <div style={{ position: 'relative' }}>
                                <span className="material-symbols-outlined" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: '#9CA3AF', pointerEvents: 'none' }}>storefront</span>
                                <select
                                    className="stg-input"
                                    style={{ padding: '6px 28px', fontSize: 13, width: 'auto', minWidth: 150, borderRadius: 20, backgroundColor: '#FAFAFA', borderColor: '#E5E7EB', fontWeight: 500, color: '#374151', marginRight: 8 }}
                                    value={filterStore}
                                    onChange={e => setFilterStore(e.target.value)}
                                >
                                    <option value="ALL">Tất cả cửa hàng</option>
                                    {stores.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            <button onClick={handleAdd} className="stg-btn stg-btn-primary" disabled={saving || isAdding || !!editingId}>
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                                Thêm SP
                            </button>
                        </div>
                    </div>

                    <table className="stg-table stg-table-fixed">
                        <colgroup>
                            <col style={{ width: '6%' }} />
                            <col style={{ width: '28%' }} />
                            <col style={{ width: '20%' }} />
                            <col style={{ width: '15%' }} />
                            <col style={{ width: '20%' }} />
                            <col style={{ width: '11%' }} />
                        </colgroup>
                        <thead>
                            <tr>
                                <th>STT</th>
                                <th>TÊN SẢN PHẨM</th>
                                <th>BARCODE</th>
                                <th style={{ textAlign: 'center' }}>TRẠNG THÁI</th>
                                <th>CỬA HÀNG</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--stg-text-muted)' }}>Đang tải...</td></tr>
                            ) : products.length === 0 && !isAdding ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--stg-text-muted)' }}>
                                    Chưa có SP giao ca nào. Thêm tối đa 20 SP chính để nhân viên kiểm tồn.
                                </td></tr>
                            ) : (
                                <>
                                    {filtered.map((product, idx) => {
                                        const isEditing = editingId === product.id;
                                        return (
                                            <tr key={product.id} className={`stg-table-row ${isEditing ? 'stg-row-new' : ''}`}
                                                style={{ opacity: !product.is_active && !isEditing ? 0.55 : 1 }}
                                            >
                                                <td style={{ paddingLeft: 16, fontWeight: 600, color: 'var(--stg-text-muted)' }}>{idx + 1}</td>
                                                <td style={{ fontWeight: 500, color: '#111827', fontSize: 13, lineHeight: '1.4' }}>
                                                    {isEditing ? (
                                                        <input type="text" className="stg-input" value={draft.product_name || ''} onChange={e => setDraft(p => ({ ...p, product_name: e.target.value }))} placeholder="Tên sản phẩm" autoFocus style={{ width: '100%', fontSize: 13 }} />
                                                    ) : (
                                                        <div style={{ wordBreak: 'break-word', paddingRight: 16 }}>{product.product_name}</div>
                                                    )}
                                                </td>
                                                <td>
                                                    {isEditing ? (
                                                        <input type="text" className="stg-input stg-input-mono" value={draft.barcode || ''} onChange={e => setDraft(p => ({ ...p, barcode: e.target.value }))} placeholder="Mã barcode" />
                                                    ) : (
                                                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--stg-text-muted)' }}>{product.barcode || '—'}</span>
                                                    )}
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                                        <span className={`stg-status-dot ${product.is_active ? 'active' : 'inactive'}`} />
                                                        <button
                                                            className={`stg-toggle-btn ${product.is_active ? 'active' : 'inactive'}`}
                                                            onClick={() => handleToggle(product)}
                                                            disabled={saving || isEditing}
                                                        >
                                                            <span className="stg-toggle-knob" />
                                                        </button>
                                                    </div>
                                                </td>
                                                <td>
                                                    {isEditing ? (
                                                        <MultiStoreSelect
                                                            stores={stores}
                                                            selectedStoreIds={draft.store_ids || null}
                                                            onChange={ids => setDraft(p => ({ ...p, store_ids: ids }))}
                                                        />
                                                    ) : (
                                                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                            {product.store_ids === null ? (
                                                                <span className="stg-badge" style={{ fontSize: 9, padding: '1px 5px', background: '#dbeafe', color: '#1e40af' }}>Tất cả CH</span>
                                                            ) : (
                                                                product.store_ids.map(sid => {
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
                                                                <button onClick={() => handleEdit(product)} className="stg-btn-icon" disabled={saving || !!editingId}>
                                                                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>
                                                                </button>
                                                                <button onClick={() => handleDelete(product)} className="stg-btn-icon stg-btn-danger" disabled={saving}>
                                                                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete_outline</span>
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {isAdding && (
                                        <tr className="stg-table-row stg-row-new">
                                            <td style={{ paddingLeft: 16 }}><span className="stg-row-num">+</span></td>
                                            <td style={{ fontWeight: 500, color: '#111827', fontSize: 13 }}>
                                                <input type="text" className="stg-input" value={draft.product_name || ''} onChange={e => setDraft(p => ({ ...p, product_name: e.target.value }))} placeholder="Tên sản phẩm (VD: Cuộn in Bill k80x80)" autoFocus style={{ width: '100%', fontSize: 13 }} />
                                            </td>
                                            <td>
                                                <input type="text" className="stg-input stg-input-mono" value={draft.barcode || ''} onChange={e => setDraft(p => ({ ...p, barcode: e.target.value }))} placeholder="Barcode" />
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                                    <span className="stg-status-dot active" />
                                                    <button className="stg-toggle-btn active" disabled>
                                                        <span className="stg-toggle-knob" />
                                                    </button>
                                                </div>
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
                                                        {saving ? <span className="material-symbols-outlined stg-spin" style={{ fontSize: 18 }}>progress_activity</span> : <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check</span>}
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
