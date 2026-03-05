import React, { useState, useEffect } from 'react';
import { ToastContextType } from '../../contexts/ToastContext';
import type { HandoverProduct } from '../../types/shift';
import { HandoverService } from '../../services/shift';
import ConfirmDialog from '../../components/ConfirmDialog';

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
                                Danh sách SP cố định kiểm tồn khi giao ca
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

                            <button onClick={handleAdd} className="stg-btn stg-btn-primary" disabled={saving || isAdding || !!editingId}>
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                                Thêm SP
                            </button>
                        </div>
                    </div>

                    <table className="stg-table stg-table-fixed">
                        <colgroup>
                            <col style={{ width: '6%' }} />
                            <col style={{ width: '30%' }} />
                            <col style={{ width: '22%' }} />
                            <col style={{ width: '26%' }} />
                            <col style={{ width: '16%' }} />
                        </colgroup>
                        <thead>
                            <tr>
                                <th>STT</th>
                                <th>TÊN SẢN PHẨM</th>
                                <th>BARCODE</th>
                                <th>CỬA HÀNG</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--stg-text-muted)' }}>Đang tải...</td></tr>
                            ) : products.length === 0 && !isAdding ? (
                                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--stg-text-muted)' }}>
                                    Chưa có SP giao ca nào. Thêm tối đa 20 SP chính để nhân viên kiểm tồn.
                                </td></tr>
                            ) : (
                                <>
                                    {filtered.map((product, idx) => {
                                        const isEditing = editingId === product.id;
                                        return (
                                            <tr key={product.id} className={`stg-table-row ${isEditing ? 'stg-row-new' : ''}`}>
                                                <td style={{ paddingLeft: 16, fontWeight: 600, color: 'var(--stg-text-muted)' }}>{idx + 1}</td>
                                                <td>
                                                    {isEditing ? (
                                                        <input type="text" className="stg-input" value={draft.product_name || ''} onChange={e => setDraft(p => ({ ...p, product_name: e.target.value }))} placeholder="Tên sản phẩm" autoFocus />
                                                    ) : (
                                                        <span style={{ fontWeight: 600, color: 'var(--stg-text)' }}>{product.product_name}</span>
                                                    )}
                                                </td>
                                                <td>
                                                    {isEditing ? (
                                                        <input type="text" className="stg-input stg-input-mono" value={draft.barcode || ''} onChange={e => setDraft(p => ({ ...p, barcode: e.target.value }))} placeholder="Mã barcode" />
                                                    ) : (
                                                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--stg-text-muted)' }}>{product.barcode || '—'}</span>
                                                    )}
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
                                            <td>
                                                <input type="text" className="stg-input" value={draft.product_name || ''} onChange={e => setDraft(p => ({ ...p, product_name: e.target.value }))} placeholder="Tên sản phẩm (VD: Cuộn in Bill k80x80)" autoFocus />
                                            </td>
                                            <td>
                                                <input type="text" className="stg-input stg-input-mono" value={draft.barcode || ''} onChange={e => setDraft(p => ({ ...p, barcode: e.target.value }))} placeholder="Barcode" />
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
