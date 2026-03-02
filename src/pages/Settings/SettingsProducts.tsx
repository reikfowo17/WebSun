import React, { useState, useMemo } from 'react';
import { SystemService, ProductConfig } from '../../services/system';
import ConfirmDialog from '../../components/ConfirmDialog';

interface Props {
    toast: any;
    initialProducts: ProductConfig[];
}

const CATEGORIES = ['Thực phẩm', 'Đồ uống', 'Gia vị', 'Bánh kẹo', 'Hóa phẩm', 'Khác'];

export const SettingsProducts: React.FC<Props> = ({ toast, initialProducts }) => {
    const [products, setProducts] = useState<ProductConfig[]>(initialProducts);
    const [saving, setSaving] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [draft, setDraft] = useState<ProductConfig | null>(null);
    const [search, setSearch] = useState('');
    const [filterCat, setFilterCat] = useState('');
    const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

    const categories = useMemo(() => {
        const cats = new Set(products.map(p => p.category).filter(Boolean));
        CATEGORIES.forEach(c => cats.add(c));
        return Array.from(cats).sort();
    }, [products]);

    const filtered = useMemo(() => {
        let list = products;
        if (search) {
            const q = search.toLowerCase();
            list = list.filter(p => p.name.toLowerCase().includes(q) || p.barcode.toLowerCase().includes(q) || (p.sp || '').toLowerCase().includes(q));
        }
        if (filterCat) list = list.filter(p => p.category === filterCat);
        return list;
    }, [products, search, filterCat]);

    const handleAdd = () => {
        if (editingIndex !== null) return;
        const newProduct: ProductConfig = { id: '', barcode: '', name: '', sp: '', category: '', unit: 'cái', unit_price: 0, is_active: true };
        const newProducts = [...products, newProduct];
        setProducts(newProducts);
        setEditingIndex(newProducts.length - 1);
        setDraft(newProduct);
        setSearch('');
        setFilterCat('');
    };

    const handleEdit = (product: ProductConfig) => {
        if (editingIndex !== null) return;
        const index = products.findIndex(p => p.id === product.id);
        if (index === -1) return;
        setEditingIndex(index);
        setDraft({ ...product });
    };

    const handleCancel = (index: number) => {
        if (products[index].id === '') {
            setProducts(products.filter((_, i) => i !== index));
        }
        setEditingIndex(null);
        setDraft(null);
    };

    const handleSave = async (index: number) => {
        if (!draft) return;
        if (!draft.barcode || !draft.name) { toast.error('Vui lòng nhập Barcode và Tên sản phẩm'); return; }
        setSaving(true);
        try {
            const res = await SystemService.saveProduct(draft);
            if (res.success && res.data) {
                const newProducts = [...products];
                newProducts[index] = res.data;
                setProducts(newProducts);
                setEditingIndex(null);
                setDraft(null);
                toast.success('Lưu sản phẩm thành công');
            } else { toast.error(res.message || 'Lưu thất bại'); }
        } catch (e: unknown) {
            toast.error('Lỗi: ' + (e instanceof Error ? e.message : String(e)));
        } finally { setSaving(false); }
    };

    const handleToggleActive = async (product: ProductConfig) => {
        const index = products.findIndex(p => p.id === product.id);
        if (index === -1) return;
        const newActive = !product.is_active;
        const newProducts = [...products];
        newProducts[index] = { ...product, is_active: newActive };
        setProducts(newProducts);
        const res = await SystemService.toggleProductActive(product.id, newActive);
        if (res.success) {
            toast.success(`Đã ${newActive ? 'bật' : 'tắt'} sản phẩm "${product.name}"`);
        } else {
            newProducts[index] = product;
            setProducts(newProducts);
            toast.error(res.message || 'Lỗi');
        }
    };

    const handleRemove = (product: ProductConfig) => {
        const index = products.findIndex(p => p.id === product.id);
        if (index === -1) return;
        if (!product.id) { setProducts(products.filter((_, i) => i !== index)); return; }
        setConfirmDialog({
            title: 'Xóa sản phẩm',
            message: `Xóa "${product.name}" (${product.barcode})? Dữ liệu kiểm kho liên quan có thể bị ảnh hưởng.`,
            onConfirm: async () => {
                setConfirmDialog(null);
                setSaving(true);
                try {
                    const res = await SystemService.deleteProduct(product.id);
                    if (res.success) {
                        setProducts(products.filter(p => p.id !== product.id));
                        toast.success('Đã xoá sản phẩm');
                    } else { toast.error(res.message || 'Xoá thất bại'); }
                } catch (e: unknown) { toast.error('Lỗi: ' + (e instanceof Error ? e.message : String(e))); }
                finally { setSaving(false); }
            },
        });
    };

    const activeCount = products.filter(p => p.is_active !== false).length;

    return (
        <>
            <div className="stg-section-animate">
                <div className="stg-table-wrap">
                    <div className="stg-toolbar">
                        <div className="stg-toolbar-left">
                            <span className="stg-badge">{products.length} sản phẩm</span>
                            <span style={{ fontSize: 12, color: 'var(--stg-text-muted)' }}>· {activeCount} đang hoạt động</span>
                        </div>
                        <div className="stg-toolbar-right" style={{ gap: 8 }}>
                            <div style={{ position: 'relative' }}>
                                <span className="material-symbols-outlined" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: 'var(--stg-text-muted)' }}>search</span>
                                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm sản phẩm..."
                                    className="stg-input" style={{ paddingLeft: 30, width: 180, fontSize: 13, height: 34 }} />
                            </div>
                            <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="stg-input" style={{ width: 130, fontSize: 13, height: 34 }}>
                                <option value="">Tất cả danh mục</option>
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <button onClick={handleAdd} className="stg-btn stg-btn-primary" disabled={saving || editingIndex !== null}>
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                                Thêm SP
                            </button>
                        </div>
                    </div>

                    <table className="stg-table stg-table-fixed">
                        <colgroup>
                            <col style={{ width: '5%' }} />
                            <col style={{ width: '14%' }} />
                            <col style={{ width: '26%' }} />
                            <col style={{ width: '10%' }} />
                            <col style={{ width: '12%' }} />
                            <col style={{ width: '8%' }} />
                            <col style={{ width: '10%' }} />
                            <col style={{ width: '15%' }} />
                        </colgroup>
                        <thead>
                            <tr>
                                <th style={{ paddingLeft: 12 }}>#</th>
                                <th>BARCODE</th>
                                <th>TÊN SẢN PHẨM</th>
                                <th>DANH MỤC</th>
                                <th style={{ textAlign: 'center' }}>ĐƠN VỊ</th>
                                <th style={{ textAlign: 'right' }}>GIÁ</th>
                                <th style={{ textAlign: 'center' }}>TRẠNG THÁI</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((product, vi) => {
                                const realIndex = products.findIndex(p => p === product);
                                const isEditing = editingIndex === realIndex;
                                const isNew = product.id === '';
                                const isActive = product.is_active !== false;
                                return (
                                    <tr key={product.id || `new-${vi}`} className={`stg-table-row${isNew ? ' stg-row-new' : ''}`}
                                        style={{ opacity: !isActive && !isEditing ? 0.55 : 1 }}>
                                        <td><span className="stg-row-num" style={{ paddingLeft: 4 }}>{vi + 1}</span></td>
                                        <td>
                                            {isEditing ? (
                                                <input type="text" value={draft?.barcode || ''} onChange={e => setDraft(d => d ? { ...d, barcode: e.target.value } : d)}
                                                    className="stg-input stg-input-mono" placeholder="8936..." autoFocus />
                                            ) : (
                                                <span className="stg-input-mono" style={{ fontSize: 12, color: 'var(--stg-text-secondary)' }}>{product.barcode}</span>
                                            )}
                                        </td>
                                        <td>
                                            {isEditing ? (
                                                <input type="text" value={draft?.name || ''} onChange={e => setDraft(d => d ? { ...d, name: e.target.value } : d)}
                                                    className="stg-input" placeholder="Tên sản phẩm" />
                                            ) : (
                                                <span style={{ fontWeight: 600, color: 'var(--stg-text)' }}>{product.name}</span>
                                            )}
                                        </td>
                                        <td>
                                            {isEditing ? (
                                                <select value={draft?.category || ''} onChange={e => setDraft(d => d ? { ...d, category: e.target.value } : d)}
                                                    className="stg-input" style={{ fontSize: 12, padding: '4px 6px' }}>
                                                    <option value="">Chọn...</option>
                                                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            ) : (
                                                product.category ? <span className="stg-badge" style={{ fontSize: 11, padding: '1px 6px' }}>{product.category}</span> : null
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            {isEditing ? (
                                                <input type="text" value={draft?.unit || ''} onChange={e => setDraft(d => d ? { ...d, unit: e.target.value } : d)}
                                                    className="stg-input" style={{ width: 60, textAlign: 'center', fontSize: 12 }} />
                                            ) : (
                                                <span style={{ fontSize: 12, color: 'var(--stg-text-secondary)' }}>{product.unit || 'cái'}</span>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            {isEditing ? (
                                                <input type="number" min="0" value={draft?.unit_price || ''} onChange={e => setDraft(d => d ? { ...d, unit_price: parseFloat(e.target.value) || 0 } : d)}
                                                    className="stg-input stg-input-mono" style={{ width: 80, textAlign: 'right', fontSize: 12 }} />
                                            ) : (
                                                <span className="stg-input-mono" style={{ fontSize: 12 }}>
                                                    {product.unit_price ? product.unit_price.toLocaleString('vi-VN') : '—'}
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                                <span className={`stg-status-dot ${isActive ? 'active' : 'inactive'}`} />
                                                <button className={`stg-toggle-btn ${isActive ? 'active' : 'inactive'}`}
                                                    onClick={() => handleToggleActive(product)} disabled={saving || isEditing}
                                                    title={isActive ? 'Bật' : 'Tắt'}>
                                                    <span className="stg-toggle-knob" />
                                                </button>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="stg-row-actions" style={isEditing ? { opacity: 1 } : undefined}>
                                                {isEditing ? (
                                                    <>
                                                        <button onClick={() => handleSave(realIndex)} className="stg-btn-icon stg-btn-save" title="Lưu vào hệ thống" disabled={saving}>
                                                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check</span>
                                                        </button>
                                                        <button onClick={() => handleCancel(realIndex)} className="stg-btn-icon" title="Hủy" disabled={saving}>
                                                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button onClick={() => handleEdit(product)} className="stg-btn-icon" title="Chỉnh sửa" disabled={saving}>
                                                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                                                        </button>
                                                        <button onClick={() => handleRemove(product)} className="stg-btn-icon stg-btn-danger" title="Xóa" disabled={saving}>
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

                    {filtered.length === 0 && products.length > 0 && (
                        <div className="stg-empty">
                            <span className="material-symbols-outlined">search_off</span>
                            <p>Không tìm thấy sản phẩm phù hợp</p>
                        </div>
                    )}

                    {products.length === 0 && (
                        <div className="stg-empty">
                            <span className="material-symbols-outlined">inventory_2</span>
                            <p>Chưa có sản phẩm nào</p>
                            <p style={{ fontSize: 12, marginBottom: 12 }}>Thêm sản phẩm đầu tiên hoặc import từ DistributionHub</p>
                            <button onClick={handleAdd} className="stg-btn stg-btn-primary" disabled={saving}>
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                                Thêm sản phẩm
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
