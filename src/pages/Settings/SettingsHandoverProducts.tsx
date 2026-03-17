import React, { useState, useEffect, useMemo } from 'react';
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
    
    // Context selection (global config vs specific store)
    const [selectedContext, setSelectedContext] = useState<string>('GLOBAL');

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draft, setDraft] = useState<Partial<HandoverProduct>>({});
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

    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            if (selectedContext === 'GLOBAL') {
                return !p.store_ids || p.store_ids.length === 0;
            }
            return p.store_ids && p.store_ids.includes(selectedContext);
        }).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    }, [products, selectedContext]);

    const handleAdd = () => {
        setEditingId(null);
        setDraft({
            product_name: '',
            barcode: '',
            sort_order: filteredProducts.length + 1,
            is_active: true,
            // the store_ids will be implicitly managed by the save context, but we set it here in draft
            store_ids: selectedContext === 'GLOBAL' ? null : [selectedContext],
        });
        setModalOpen(true);
    };

    const handleEdit = (product: HandoverProduct) => {
        setEditingId(product.id);
        setDraft({ ...product });
        setModalOpen(true);
    };

    const handleSave = async () => {
        if (!draft.product_name?.trim()) {
            toast.error('Vui lòng nhập tên sản phẩm');
            return;
        }
        setSaving(true);
        try {
            // Apply context store
            const finalData = { ...draft };
            if (selectedContext === 'GLOBAL') {
                finalData.store_ids = null;
            } else {
                finalData.store_ids = [selectedContext];
            }

            if (editingId) {
                const updated = await HandoverService.updateProduct(editingId, finalData);
                setProducts(prev => prev.map(p => p.id === editingId ? updated : p));
                toast.success('Đã cập nhật SP giao ca');
            } else {
                const created = await HandoverService.createProduct(finalData as Partial<HandoverProduct>);
                setProducts(prev => [...prev, created]);
                toast.success('Đã thêm SP giao ca');
            }
            setModalOpen(false);
            setDraft({});
            setEditingId(null);
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

    const handleToggleState = async (product: HandoverProduct) => {
        try {
            const updated = await HandoverService.updateProduct(product.id, { is_active: !product.is_active });
            setProducts(prev => prev.map(p => p.id === product.id ? updated : p));
            toast.success(`Đã ${updated.is_active ? 'bật' : 'tắt'} "${product.product_name}"`);
        } catch (err: unknown) {
            toast.error('Lỗi: ' + (err instanceof Error ? err.message : String(err)));
        }
    };

    const renderCard = (product: HandoverProduct) => {
        return (
            <div key={product.id} className="stg-kanban-card group" style={{ opacity: product.is_active ? 1 : 0.6 }}>
                <div className="stg-kanban-card-header">
                    <div className="flex flex-col min-w-0 pr-2">
                        <span className="stg-kanban-card-title truncate" title={product.product_name}>{product.product_name}</span>
                        {product.barcode && (
                            <div className="text-xs font-mono text-gray-500 mt-1">
                                {product.barcode}
                            </div>
                        )}
                    </div>
                    <div className="stg-kanban-card-actions">
                        <button onClick={() => handleToggleState(product)} className="stg-btn-icon stg-kanban-action w-7 h-7" title={product.is_active ? 'Tắt' : 'Bật'}>
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{product.is_active ? 'visibility_off' : 'visibility'}</span>
                        </button>
                        <button onClick={() => handleEdit(product)} className="stg-btn-icon stg-kanban-action w-7 h-7" title="Sửa">
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                        </button>
                        <button onClick={() => handleDelete(product)} className="stg-btn-icon stg-kanban-action w-7 h-7 text-red-500" title="Xóa">
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete_outline</span>
                        </button>
                    </div>
                </div>
                
                {!product.is_active && (
                    <div className="stg-kanban-card-tags">
                        <div className="stg-kanban-tag-group text-gray-400 bg-gray-100 border-none">
                            Đã tắt
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="stg-section-animate flex h-full rounded-2xl overflow-hidden border border-gray-200 bg-white">
            
            {/* Left Sidebar - Context Selector */}
            <div className="w-[300px] border-r border-gray-200 bg-gray-50 flex flex-col shrink-0">
                <div className="px-5 py-4 border-b border-gray-200/60 bg-white">
                    <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                        <span className="material-symbols-outlined text-blue-600">view_sidebar</span>
                        Phạm vi thiết lập
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">Chọn nơi áp dụng sản phẩm</p>
                </div>
                <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1.5">
                    <button
                        onClick={() => setSelectedContext('GLOBAL')}
                        className={`flex items-center gap-3 w-full p-3 rounded-lg text-left transition-all ${
                            selectedContext === 'GLOBAL' 
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
                                : 'hover:bg-gray-200/50 text-gray-700'
                        }`}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>public</span>
                        <div className="flex flex-col">
                            <span className="font-semibold text-sm">Cấu hình chung</span>
                            <span className={`text-[11px] ${selectedContext === 'GLOBAL' ? 'text-blue-200' : 'text-gray-500'}`}>Áp dụng toàn bộ cửa hàng</span>
                        </div>
                    </button>
                    
                    <div className="flex items-center gap-2 mt-4 mb-2 px-2">
                        <div className="h-px bg-gray-200 flex-1"></div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Hoặc Cửa Hàng Riêng</span>
                        <div className="h-px bg-gray-200 flex-1"></div>
                    </div>

                    {stores.map(store => (
                        <button
                            key={store.id}
                            onClick={() => setSelectedContext(store.id)}
                            className={`flex items-center gap-3 w-full p-2.5 rounded-lg text-left transition-all ${
                                selectedContext === store.id 
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
                                    : 'hover:bg-gray-200/50 text-gray-700'
                            }`}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>storefront</span>
                            <div className="flex flex-col truncate">
                                <span className="font-semibold text-sm truncate">{store.name}</span>
                                <span className={`text-[11px] truncate ${selectedContext === store.id ? 'text-blue-200' : 'text-gray-500'}`}>{store.address}</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Right Main Area */}
            <div className="flex-1 flex flex-col bg-[#F9FAFB] min-w-0">
                <div className="px-6 py-5 border-b border-gray-200/70 bg-white flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
                            {selectedContext === 'GLOBAL' ? 'Sản Phẩm Giao Ca Chung' : `Sản Phẩm Giao Ca: ${stores.find(s => s.id === selectedContext)?.name}`}
                        </h2>
                        <p className="text-sm text-gray-500 font-medium mt-1">Quản lý danh sách sản phẩm cần kiểm đếm</p>
                    </div>
                    <div>
                        <button onClick={() => handleAdd()} className="stg-btn stg-btn-primary shadow-sm" disabled={loading}>
                            <span className="material-symbols-outlined">add</span>
                            Thêm sản phẩm
                        </button>
                    </div>
                </div>

                {/* Grid Board */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                    {loading ? (
                        <div className="flex items-center justify-center h-40">
                            <span className="material-symbols-outlined stg-spin text-3xl text-yellow-400">autorenew</span>
                        </div>
                    ) : filteredProducts.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
                            {filteredProducts.map(renderCard)}
                        </div>
                    ) : (
                        <div className="stg-kanban-empty border-dashed border-2 border-gray-200 py-12 bg-white/50 text-gray-400 rounded-xl flex items-center justify-center">
                            <div className="flex flex-col items-center gap-2">
                                <span className="material-symbols-outlined text-4xl text-gray-300">inventory_2</span>
                                <div>Chưa có sản phẩm nào cho khu vực này</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Edit Modal */}
            {modalOpen && (
                <div className="stg-modal-overlay" onClick={() => setModalOpen(false)}>
                    <div className="stg-modal-content" onClick={e => e.stopPropagation()}>
                        <div className="stg-modal-header">
                            <h3>{editingId ? 'Chỉnh sửa Sản phẩm' : 'Thêm Sản phẩm mới'}</h3>
                            <button className="stg-btn-icon" onClick={() => setModalOpen(false)}>
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="stg-modal-body flex flex-col gap-4">
                            
                            <div>
                                <label className="stg-field-label">Tên sản phẩm <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    className="stg-input mt-1.5"
                                    value={draft.product_name || ''}
                                    onChange={e => setDraft(p => ({ ...p, product_name: e.target.value }))}
                                    placeholder="Ví dụ: Cuộn in Bill k80x80"
                                    autoFocus
                                />
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="stg-field-label">Mã Barcode</label>
                                    <input
                                        type="text"
                                        className="stg-input mt-1.5 font-mono text-sm"
                                        value={draft.barcode || ''}
                                        onChange={e => setDraft(p => ({ ...p, barcode: e.target.value }))}
                                        placeholder="Tùy chọn"
                                    />
                                </div>
                                <div className="w-24">
                                    <label className="stg-field-label">Thứ tự</label>
                                    <input
                                        type="number"
                                        className="stg-input mt-1.5"
                                        value={draft.sort_order || 0}
                                        onChange={e => setDraft(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="stg-field-label">Trạng thái</label>
                                <div className="flex items-center gap-3 mt-2">
                                    <button
                                        className={`stg-toggle-btn ${draft.is_active ? 'active' : 'inactive'}`}
                                        onClick={() => setDraft(p => ({ ...p, is_active: !p.is_active }))}
                                    >
                                        <span className="stg-toggle-knob" />
                                    </button>
                                    <span className={draft.is_active ? 'text-blue-600 font-medium text-sm' : 'text-gray-500 font-medium text-sm'}>
                                        {draft.is_active ? 'Đang hoạt động' : 'Tạm ẩn'}
                                    </span>
                                </div>
                            </div>

                        </div>
                        <div className="stg-modal-footer mt-auto">
                            <button className="stg-btn bg-white border border-gray-300 shadow-sm text-gray-700 hover:bg-gray-50 font-medium" onClick={() => setModalOpen(false)}>
                                Hủy
                            </button>
                            <button className="stg-btn stg-btn-primary shadow-sm px-6" onClick={handleSave} disabled={saving}>
                                {saving ? <span className="material-symbols-outlined stg-spin">progress_activity</span> : 'Cập nhật'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {confirmDialog && (
                <ConfirmDialog
                    title={confirmDialog.title}
                    message={confirmDialog.message}
                    onConfirm={confirmDialog.onConfirm}
                    onCancel={() => setConfirmDialog(null)}
                />
            )}
        </div>
    );
};
