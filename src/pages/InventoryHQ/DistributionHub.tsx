import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { InventoryService } from '../../services';
import type { MasterItem } from '../../services';
import { STORES } from '../../constants';
import ConfirmModal from '../../components/ConfirmModal';
import * as XLSX from 'xlsx';

interface ToastFn {
    success: (msg: string) => void;
    error: (msg: string) => void;
    info: (msg: string) => void;
    warning: (msg: string) => void;
}

interface DistributionHubProps {
    toast: ToastFn;
    date: string;
}

const enum ProcessingState {
    DISTRIBUTE = 'DISTRIBUTE',
    IMPORT_EXCEL = 'IMPORT_EXCEL',
    SAVE_PRODUCT = 'SAVE_PRODUCT',
}

const categoryColors: Record<string, { bg: string; text: string; dot: string }> = {
    'Bánh Mì': { bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' },
    'Thức Uống': { bg: '#dbeafe', text: '#1e40af', dot: '#3b82f6' },
    'Đồ Ăn Vặt': { bg: '#fce7f3', text: '#9d174d', dot: '#ec4899' },
    'Tủ Mát': { bg: '#d1fae5', text: '#065f46', dot: '#10b981' },
    'Đông Lạnh': { bg: '#e0e7ff', text: '#3730a3', dot: '#6366f1' },
    'Khác': { bg: '#f3f4f6', text: '#374151', dot: '#6b7280' },
};
const getCatStyle = (c: string) => categoryColors[c] || categoryColors['Khác'];

const DistributionHub: React.FC<DistributionHubProps> = ({ toast, date }) => {
    const [selectedStore, setSelectedStore] = useState<string>('ALL');
    const [selectedShift, setSelectedShift] = useState<number>(1);
    const [products, setProducts] = useState<MasterItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState<string | null>(null);
    const [showProductModal, setShowProductModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<MasterItem | null>(null);
    const [productForm, setProductForm] = useState({ barcode: '', name: '', pvn: '', category: '' });
    const [confirmDelete, setConfirmDelete] = useState<MasterItem | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [confirmAction, setConfirmAction] = useState<{ type: 'distribute' | 'newSession'; message: string } | null>(null);

    // CRITICAL FIX #2: Derive filteredProducts from state via useMemo (no duplicate state)
    const filteredProducts = useMemo(() => {
        if (!searchQuery) return products;
        const q = searchQuery.toLowerCase();
        return products.filter(p =>
            p.name?.toLowerCase().includes(q) || p.pvn?.toLowerCase().includes(q) || p.barcode?.includes(q)
        );
    }, [searchQuery, products]);

    const stats = useMemo(() => {
        const cats: Record<string, number> = {};
        products.forEach(p => { const c = p.category || 'Khác'; cats[c] = (cats[c] || 0) + 1; });
        return { total: products.length, categories: cats };
    }, [products]);

    // FIX #4: Show error on load failure instead of swallowing
    const loadMasterProducts = useCallback(async () => {
        setLoading(true);
        try {
            const r = await InventoryService.getMasterItems();
            if (r.success) {
                setProducts(r.items);
            } else {
                toast.error('Không thể tải danh sách sản phẩm');
            }
        } catch {
            toast.error('Lỗi kết nối khi tải sản phẩm');
        } finally {
            setLoading(false);
        }
    }, [toast]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { loadMasterProducts(); }, []);

    const handleDistribute = async () => {
        if (!products.length) return toast.error('Danh sách sản phẩm trống');
        setConfirmAction({
            type: 'distribute',
            message: `Xác nhận phân bổ ${products.length} sản phẩm cho ${selectedStore === 'ALL' ? 'TẤT CẢ CỬA HÀNG' : selectedStore} (Ca ${selectedShift})?`
        });
    };

    // CRITICAL FIX #1: Parallel API calls with Promise.allSettled
    const executeDistribute = async () => {
        setConfirmAction(null);
        setProcessing(ProcessingState.DISTRIBUTE);
        try {
            if (selectedStore === 'ALL') {
                const results = await Promise.allSettled(
                    STORES.map(s => InventoryService.distributeToStore(s.id, selectedShift))
                );
                const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success));
                if (failed.length === 0) {
                    toast.success(`Đã phân phối cho tất cả ${STORES.length} cửa hàng (Ca ${selectedShift})`);
                } else if (failed.length < STORES.length) {
                    toast.warning(`Phân phối xong nhưng ${failed.length}/${STORES.length} cửa hàng gặp lỗi`);
                } else {
                    toast.error('Phân phối thất bại cho tất cả cửa hàng');
                }
            } else {
                const r = await InventoryService.distributeToStore(selectedStore, selectedShift);
                r.success ? toast.success(r.message || 'Đã phân phối thành công!') : toast.error(r.message || 'Lỗi phân phối');
            }
        } catch {
            toast.error('Lỗi hệ thống');
        } finally {
            setProcessing(null);
        }
    };

    // Làm mới phiên = xóa danh sách hiện tại để nhập danh sách mới
    const handleNewSession = () => {
        setConfirmAction({ type: 'newSession', message: 'Xóa danh sách hiện tại để nhập danh sách mới?' });
    };

    const executeNewSession = () => {
        setConfirmAction(null);
        setProducts([]);
        setSearchQuery('');
        toast.info('Đã xóa danh sách');
    };

    const openAddProduct = () => { setEditingProduct(null); setProductForm({ barcode: '', name: '', pvn: '', category: '' }); setShowProductModal(true); };
    const openEditProduct = (p: MasterItem) => { setEditingProduct(p); setProductForm({ barcode: p.barcode || '', name: p.name || '', pvn: p.pvn || '', category: p.category || '' }); setShowProductModal(true); };

    // FIX #10: Add barcode format validation
    const saveProduct = async () => {
        const trimmedBarcode = productForm.barcode.trim();
        const trimmedName = productForm.name.trim();
        if (!trimmedBarcode || !trimmedName) { toast.error('Barcode và tên sản phẩm là bắt buộc'); return; }
        if (!/^\d{4,13}$/.test(trimmedBarcode)) { toast.error('Barcode phải là số, từ 4-13 ký tự'); return; }
        setProcessing(ProcessingState.SAVE_PRODUCT);
        try {
            const d = { barcode: trimmedBarcode, name: trimmedName, pvn: productForm.pvn.trim(), category: productForm.category };
            const r = editingProduct ? await InventoryService.updateMasterItem(editingProduct.id, d, 'ADMIN') : await InventoryService.addMasterItem(d);
            if (r.success) { toast.success(editingProduct ? 'Đã cập nhật' : 'Đã thêm mới'); setShowProductModal(false); loadMasterProducts(); }
            else toast.error(r.error || 'Có lỗi xảy ra');
        } catch { toast.error('Lỗi hệ thống'); } finally { setProcessing(null); }
    };

    const handleDeleteProduct = async (p: MasterItem) => {
        setProcessing('DELETE_' + p.id);
        try {
            const r = await InventoryService.deleteMasterItem(p.id, 'ADMIN');
            if (r.success) { toast.success('Đã xóa'); loadMasterProducts(); }
            else toast.error(r.error || 'Không thể xóa');
        } catch {
            toast.error('Lỗi hệ thống');
        } finally { setProcessing(null); setConfirmDelete(null); }
    };

    const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return;
        setProcessing(ProcessingState.IMPORT_EXCEL);
        try {
            const wb = XLSX.read(await file.arrayBuffer());
            const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]]);
            const items = rows.map((r) => ({
                category: String(r['Mã hàng SP'] || r['Mã hàng'] || r['Product Code'] || r['ma_hang'] || ''),
                barcode: String(r['Mã barcode'] || r['Barcode'] || r['Mã vạch'] || r['barcode'] || ''),
                name: String(r['Tên sản phẩm'] || r['Tên SP'] || r['Name'] || r['name'] || ''), unit: '',
            })).filter(p => p.barcode && p.name);
            if (!items.length) { toast.error('Không tìm thấy dữ liệu hợp lệ'); return; }
            const res = await InventoryService.importProducts(items);
            if (res.success) { toast.success(`Đã import ${res.imported} SP`); if (res.errors?.length) toast.warning(`${res.errors.length} lỗi`); loadMasterProducts(); }
            else toast.error('Import thất bại');
        } catch { toast.error('Lỗi đọc file Excel'); } finally { setProcessing(null); if (fileInputRef.current) fileInputRef.current.value = ''; }
    };

    return (
        <div className="dh-root">
            <style>{CSS_TEXT}</style>

            {/* ━━━ MAIN GRID ━━━ */}
            <div className="dh-main">
                {/* ── LEFT: Product Table ── */}
                <div className="dh-table-card">
                    {/* Toolbar */}
                    <div className="dh-toolbar">
                        <div className="dh-toolbar-left">
                            <div className="dh-search">
                                <span className="material-symbols-outlined dh-search-icon">search</span>
                                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Tìm tên, mã, barcode..." className="dh-search-input" />
                                {searchQuery && <button onClick={() => setSearchQuery('')} className="dh-search-clear"><span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span></button>}
                            </div>
                        </div>
                        <div className="dh-toolbar-right">
                            <input type="file" ref={fileInputRef} onChange={handleExcelUpload} accept=".xlsx,.xls,.csv" hidden />
                            <button onClick={() => fileInputRef.current?.click()} disabled={processing === ProcessingState.IMPORT_EXCEL} className="dh-btn-secondary">
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{processing === ProcessingState.IMPORT_EXCEL ? 'sync' : 'upload'}</span> Import
                            </button>
                            <button onClick={openAddProduct} className="dh-btn-primary">
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span> Thêm SP
                            </button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="dh-table-scroll custom-scrollbar">
                        {loading ? (
                            <div className="dh-loading">{[...Array(8)].map((_, i) => <div key={i} className="shimmer" style={{ height: 42, borderRadius: 8, animationDelay: `${i * 80}ms` }} />)}</div>
                        ) : (
                            <table className="dh-table">
                                <thead><tr>
                                    <th style={{ width: 50, textAlign: 'center' }}>No.</th>
                                    <th style={{ width: 110 }}>Mã hàng</th>
                                    <th style={{ width: 130 }}>Barcode</th>
                                    <th>Tên sản phẩm</th>
                                    <th style={{ width: 110, textAlign: 'right' }}>Danh mục</th>
                                    <th style={{ width: 44 }}></th>
                                </tr></thead>
                                <tbody>
                                    {filteredProducts.length === 0 ? (
                                        <tr><td colSpan={6} className="dh-empty-td">
                                            <div className="dh-empty"><div className="dh-empty-icon"><span className="material-symbols-outlined" style={{ fontSize: 40, color: '#d1d5db' }}>playlist_add</span></div>
                                                <p className="dh-empty-title">Chưa có dữ liệu</p><p className="dh-empty-sub">Thêm sản phẩm hoặc import từ Excel</p>
                                                <button onClick={loadMasterProducts} className="dh-empty-btn"><span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span> Tải lại</button></div>
                                        </td></tr>
                                    ) : filteredProducts.map((p, i) => {
                                        const cs = getCatStyle(p.category);
                                        return (<tr key={p.id || i} className="dh-row">
                                            <td style={{ textAlign: 'center' }}><span className="dh-rownum">{i + 1}</span></td>
                                            <td><span className="dh-code">{p.pvn || '---'}</span></td>
                                            <td><span className="dh-barcode">{p.barcode}</span></td>
                                            <td><span className="dh-name">{p.name}</span></td>
                                            <td style={{ textAlign: 'right' }}>{p.category && <span className="dh-cat" style={{ background: cs.bg, color: cs.text }}>{p.category}</span>}</td>
                                            <td style={{ textAlign: 'right' }}>
                                                <div className="dh-actions">
                                                    <button onClick={() => openEditProduct(p)} className="dh-act-btn" title="Sửa"><span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span></button>
                                                    <button onClick={() => setConfirmDelete(p)} className="dh-act-btn dh-act-del" title="Xóa"><span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span></button>
                                                </div>
                                            </td>
                                        </tr>);
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="dh-footer">
                        <span>Hiển thị <strong>{filteredProducts.length}</strong> / <strong>{products.length}</strong> sản phẩm</span>
                    </div>
                </div>

                {/* ── RIGHT: Configuration Sidebar ── */}
                <aside className="dh-sidebar">
                    {/* Header */}
                    <div className="dh-side-hdr">
                        <h2 className="dh-side-title">
                            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#3b82f6' }}>tune</span>
                            Cấu hình
                        </h2>
                    </div>

                    {/* Body */}
                    <div className="dh-side-body">
                        {/* Store Selector */}
                        <div className="dh-field">
                            <label className="dh-label">Cửa hàng đích</label>
                            <div className="dh-select-wrap">
                                <span className="material-symbols-outlined dh-select-icon">storefront</span>
                                <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)} className="dh-select">
                                    <option value="ALL">Tất cả cửa hàng</option>
                                    {STORES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                                <span className="material-symbols-outlined dh-chevron">expand_more</span>
                            </div>
                            <p className="dh-field-hint">Cửa hàng được chọn sẽ nhận danh sách kiểm tồn.</p>
                        </div>

                        {/* Shift Selector */}
                        <div className="dh-field">
                            <label className="dh-label">Ca làm việc</label>
                            <div className="dh-shift-grid">
                                {[1, 2, 3].map(s => (
                                    <button key={s} onClick={() => setSelectedShift(s)} className={`dh-shift ${selectedShift === s ? 'active' : ''}`}>
                                        <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{s === 1 ? 'wb_sunny' : s === 2 ? 'wb_twilight' : 'dark_mode'}</span>
                                        Ca {s}
                                    </button>
                                ))}
                            </div>
                            <div className="dh-info-callout">
                                <span className="material-symbols-outlined" style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>info</span>
                                <p>Phân phối sẽ tạo danh sách kiểm tồn cho ca hiện tại ({selectedShift === 1 ? '06:00 - 14:00' : selectedShift === 2 ? '14:00 - 22:00' : '22:00 - 06:00'}).</p>
                            </div>
                        </div>

                        <div className="dh-divider" />

                        {/* Summary */}
                        <div className="dh-field">
                            <label className="dh-label">Tổng quan</label>
                            <div className="dh-summary-items">
                                <div className="dh-summary-row">
                                    <span>Tổng sản phẩm</span>
                                    <strong>{products.length}</strong>
                                </div>
                                <div className="dh-summary-row">
                                    <span>Cửa hàng</span>
                                    <strong>{selectedStore === 'ALL' ? `${STORES.length} CH` : STORES.find(s => s.id === selectedStore)?.name || selectedStore}</strong>
                                </div>
                                <div className="dh-summary-row">
                                    <span>Ca</span>
                                    <strong>Ca {selectedShift}</strong>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="dh-side-footer">
                        <div className="dh-side-actions">
                            <button onClick={handleNewSession} className="dh-btn-reset">
                                <span className="material-symbols-outlined" style={{ fontSize: 17 }}>refresh</span> Reset
                            </button>
                            <button onClick={handleDistribute} disabled={!!processing || !products.length} className="dh-btn-dist">
                                {processing === ProcessingState.DISTRIBUTE ? (
                                    <><span className="material-symbols-outlined dh-spin" style={{ fontSize: 18 }}>sync</span> Đang xử lý...</>
                                ) : (
                                    <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>send</span> Phân phối</>
                                )}
                            </button>
                        </div>
                    </div>
                </aside>
            </div>

            {/* PRODUCT MODAL */}
            {showProductModal && (<div className="dh-overlay animate-in"><div className="dh-modal fade-in">
                <div className="dh-modal-hdr">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="dh-title-icon"><span className="material-symbols-outlined" style={{ fontSize: 20, color: '#6366f1' }}>{editingProduct ? 'edit_note' : 'add_circle'}</span></div>
                        <h3 className="dh-modal-title">{editingProduct ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}</h3>
                    </div>
                    <button onClick={() => setShowProductModal(false)} className="dh-modal-close"><span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span></button>
                </div>
                {/* FIX #8: Form accessibility — htmlFor + id */}
                <div className="dh-modal-body">
                    <div className="dh-form-group"><label htmlFor="dh-barcode" className="dh-form-label"><span className="material-symbols-outlined" style={{ fontSize: 14 }}>barcode</span> Barcode <span style={{ color: '#ef4444' }}>*</span></label>
                        <input id="dh-barcode" value={productForm.barcode} onChange={e => setProductForm(p => ({ ...p, barcode: e.target.value }))} placeholder="8934567890123" className="dh-form-input" inputMode="numeric" /></div>
                    <div className="dh-form-group"><label htmlFor="dh-pvn" className="dh-form-label"><span className="material-symbols-outlined" style={{ fontSize: 14 }}>tag</span> Mã SP</label>
                        <input id="dh-pvn" value={productForm.pvn} onChange={e => setProductForm(p => ({ ...p, pvn: e.target.value }))} placeholder="SP001" className="dh-form-input" /></div>
                    <div className="dh-form-group"><label htmlFor="dh-name" className="dh-form-label"><span className="material-symbols-outlined" style={{ fontSize: 14 }}>label</span> Tên SP <span style={{ color: '#ef4444' }}>*</span></label>
                        <input id="dh-name" value={productForm.name} onChange={e => setProductForm(p => ({ ...p, name: e.target.value }))} placeholder="Bánh mì sữa tươi" className="dh-form-input" /></div>
                    <div className="dh-form-group"><label htmlFor="dh-category" className="dh-form-label">Danh mục</label><select id="dh-category" value={productForm.category} onChange={e => setProductForm(p => ({ ...p, category: e.target.value }))} className="dh-form-select">
                        <option value="">Chọn...</option><option value="Bánh Mì">Bánh Mì</option><option value="Thức Uống">Thức Uống</option><option value="Đồ Ăn Vặt">Đồ Ăn Vặt</option><option value="Tủ Mát">Tủ Mát</option><option value="Đông Lạnh">Đông Lạnh</option><option value="Khác">Khác</option>
                    </select></div>
                </div>
                <div className="dh-modal-footer">
                    <button onClick={() => setShowProductModal(false)} className="dh-btn-cancel">Hủy</button>
                    <button onClick={saveProduct} disabled={!!processing} className="dh-btn-save">
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{processing === ProcessingState.SAVE_PRODUCT ? 'sync' : 'save'}</span> Lưu
                    </button>
                </div>
            </div></div>)}

            {/* DELETE CONFIRM */}
            {confirmDelete && (<div className="dh-overlay animate-in"><div className="dh-del-modal fade-in">
                <div className="dh-del-icon"><span className="material-symbols-outlined" style={{ fontSize: 28, color: '#ef4444' }}>delete_forever</span></div>
                <h3 className="dh-del-title">Xác nhận xóa</h3>
                <p className="dh-del-text">Xóa <strong>{confirmDelete.name}</strong>? Không thể hoàn tác.</p>
                <div className="dh-del-actions">
                    <button onClick={() => setConfirmDelete(null)} className="dh-btn-cancel">Hủy</button>
                    <button onClick={() => handleDeleteProduct(confirmDelete)} disabled={!!processing} className="dh-btn-delete">
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{processing?.startsWith('DELETE_') ? 'sync' : 'delete'}</span> Xóa
                    </button>
                </div>
            </div></div>)}

            {/* CONFIRM MODAL */}
            <ConfirmModal
                isOpen={!!confirmAction}
                title={confirmAction?.type === 'distribute' ? 'Phân phối sản phẩm' : 'Làm mới phiên'}
                message={confirmAction?.message || ''}
                variant={confirmAction?.type === 'distribute' ? 'info' : 'warning'}
                confirmText={confirmAction?.type === 'distribute' ? 'Phân phối' : 'Xác nhận'}
                onConfirm={() => { confirmAction?.type === 'distribute' ? executeDistribute() : executeNewSession(); }}
                onCancel={() => setConfirmAction(null)}
            />
        </div>
    );
};

export default DistributionHub;

/* ══════ CSS ══════ */
const CSS_TEXT = `
.dh-root { display:flex; flex-direction:column; gap:0; padding-top:0; height:calc(100vh - 140px); min-height:0; }

/* Main Grid */
.dh-main { display:flex; flex:1; min-height:0; }

/* ─── Table Card (left pane) ─── */
.dh-table-card { flex:1; display:flex; flex-direction:column; min-height:0; background:#fff; border-right:1px solid #e2e8f0; }

/* Toolbar */
.dh-toolbar { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid #e2e8f0; gap:12px; flex-shrink:0; flex-wrap:wrap; background:#fff; }
.dh-toolbar-left { display:flex; align-items:center; gap:8px; }
.dh-toolbar-right { display:flex; align-items:center; gap:8px; }

/* Search */
.dh-search { position:relative; width:260px; }
.dh-search-icon { position:absolute; left:10px; top:50%; transform:translateY(-50%); font-size:18px; color:#9ca3af; pointer-events:none; }
.dh-search-input { width:100%; padding:7px 32px 7px 34px; background:#fff; border:1px solid #d1d5db; border-radius:6px; font-size:13px; outline:none; font-weight:500; color:#111827; box-shadow:0 1px 2px rgba(0,0,0,.05); transition:border-color .2s,box-shadow .2s; }
.dh-search-input::placeholder { color:#9ca3af; }
.dh-search-input:focus { border-color:#3b82f6; box-shadow:0 0 0 2px rgba(59,130,246,.15); }
.dh-search-clear { position:absolute; right:8px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:#9ca3af; display:flex; }

/* Toolbar Buttons */
.dh-btn-secondary { display:inline-flex; align-items:center; gap:5px; padding:7px 12px; background:#fff; border:1px solid #d1d5db; border-radius:6px; font-size:12px; font-weight:500; color:#374151; cursor:pointer; box-shadow:0 1px 2px rgba(0,0,0,.05); transition:all .15s; }
.dh-btn-secondary:hover { background:#f9fafb; }
.dh-btn-primary { display:inline-flex; align-items:center; gap:5px; padding:7px 12px; background:#3b82f6; border:none; border-radius:6px; font-size:12px; font-weight:500; color:#fff; cursor:pointer; box-shadow:0 1px 2px rgba(0,0,0,.05); transition:all .15s; }
.dh-btn-primary:hover { background:#2563eb; }

/* Table */
.dh-table-scroll { flex:1; overflow:auto; background:#f9fafb; }
.dh-loading { padding:20px; display:flex; flex-direction:column; gap:8px; }
.dh-table { width:100%; border-collapse:collapse; font-size:13px; }
.dh-table thead th { padding:10px 16px; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; color:#6b7280; background:#f9fafb; border-bottom:1px solid #e5e7eb; position:sticky; top:0; z-index:5; white-space:nowrap; }
.dh-table tbody td { padding:10px 16px; border-bottom:1px solid #f3f4f6; vertical-align:middle; }
.dh-row { transition:background .1s; background:#fff; }
.dh-row:hover { background:#eff6ff; }
.dh-row:hover .dh-actions { opacity:1 !important; }
.dh-row:hover .dh-name { color:#3b82f6; }
.dh-rownum { font-size:12px; font-weight:500; color:#6b7280; font-family:'Inter',monospace; }
.dh-code { display:inline-block; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:600; font-family:monospace; color:#3b82f6; cursor:pointer; letter-spacing:.02em; }
.dh-code:hover { text-decoration:underline; text-decoration-style:dashed; text-underline-offset:2px; }
.dh-barcode { font-size:12px; font-family:monospace; color:#6b7280; letter-spacing:.02em; }
.dh-name { font-size:13px; font-weight:500; color:#111827; transition:color .15s; }
.dh-cat { display:inline-block; padding:2px 8px; border-radius:4px; font-size:10px; font-weight:500; white-space:nowrap; }
.dh-actions { display:flex; align-items:center; gap:2px; opacity:0; transition:opacity .15s; justify-content:flex-end; }
.dh-act-btn { width:28px; height:28px; border-radius:6px; display:flex; align-items:center; justify-content:center; color:#9ca3af; background:transparent; border:none; cursor:pointer; transition:all .15s; }
.dh-act-btn:hover { background:#f3f4f6; color:#3b82f6; }
.dh-act-del:hover { color:#ef4444 !important; background:#fef2f2 !important; }

/* Empty */
.dh-empty-td { padding:0 !important; }
.dh-empty { display:flex; flex-direction:column; align-items:center; gap:8px; padding:60px 20px; }
.dh-empty-icon { width:64px; height:64px; border-radius:50%; background:#f3f4f6; display:flex; align-items:center; justify-content:center; }
.dh-empty-title { font-weight:600; color:#6b7280; font-size:14px; margin:0; }
.dh-empty-sub { font-size:12px; color:#9ca3af; margin:0; }
.dh-empty-btn { display:inline-flex; align-items:center; gap:4px; padding:6px 14px; background:#eff6ff; color:#3b82f6; border:none; border-radius:6px; font-size:12px; font-weight:500; cursor:pointer; margin-top:4px; }

/* Footer */
.dh-footer { padding:10px 16px; background:#fff; border-top:1px solid #e5e7eb; font-size:12px; font-weight:500; color:#6b7280; display:flex; justify-content:space-between; flex-shrink:0; }
.dh-footer strong { color:#111827; }

/* ─── Sidebar (right pane) ─── */
.dh-sidebar { width:300px; flex-shrink:0; display:flex; flex-direction:column; background:#fff; border-left:1px solid #e2e8f0; }
.dh-side-hdr { height:52px; display:flex; align-items:center; padding:0 20px; border-bottom:1px solid #e2e8f0; }
.dh-side-title { font-size:13px; font-weight:700; color:#111827; text-transform:uppercase; letter-spacing:.04em; display:flex; align-items:center; gap:8px; margin:0; }
.dh-side-body { flex:1; overflow-y:auto; padding:20px; }

/* Fields */
.dh-field { margin-bottom:20px; }
.dh-label { display:block; font-size:11px; font-weight:600; color:#6b7280; margin-bottom:8px; text-transform:uppercase; letter-spacing:.05em; }
.dh-select-wrap { position:relative; }
.dh-select-icon { position:absolute; left:12px; top:50%; transform:translateY(-50%); font-size:18px; color:#9ca3af; pointer-events:none; }
.dh-select { width:100%; padding:9px 36px 9px 38px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:6px; font-size:13px; font-weight:500; color:#111827; outline:none; appearance:none; cursor:pointer; transition:border-color .15s,box-shadow .15s; }
.dh-select:focus { border-color:#3b82f6; box-shadow:0 0 0 2px rgba(59,130,246,.12); }
.dh-chevron { position:absolute; right:8px; top:50%; transform:translateY(-50%); font-size:20px; color:#6b7280; pointer-events:none; }
.dh-field-hint { font-size:10px; color:#9ca3af; margin-top:6px; padding:0 2px; }

/* Shift Grid */
.dh-shift-grid { display:flex; background:#f3f4f6; padding:3px; border-radius:8px; gap:2px; }
.dh-shift { flex:1; display:flex; align-items:center; justify-content:center; gap:4px; padding:7px 0; border-radius:6px; font-size:12px; font-weight:500; border:none; background:transparent; color:#6b7280; cursor:pointer; transition:all .15s; }
.dh-shift:hover { color:#374151; }
.dh-shift.active { background:#fff; color:#3b82f6; box-shadow:0 1px 3px rgba(0,0,0,.08); font-weight:600; border:1px solid #e5e7eb; }

/* Info Callout */
.dh-info-callout { display:flex; gap:8px; margin-top:10px; padding:10px 12px; background:#eff6ff; border:1px solid #dbeafe; border-radius:6px; font-size:11px; line-height:1.5; color:#1e40af; }
.dh-info-callout p { margin:0; }

/* Divider */
.dh-divider { height:1px; background:#e5e7eb; margin:4px 0; }

/* Summary */
.dh-summary-items { display:flex; flex-direction:column; gap:0; }
.dh-summary-row { display:flex; justify-content:space-between; align-items:center; padding:8px 0; font-size:13px; color:#6b7280; border-bottom:1px solid #f3f4f6; }
.dh-summary-row:last-child { border-bottom:none; }
.dh-summary-row strong { color:#111827; font-weight:600; }

/* Sidebar Footer */
.dh-side-footer { padding:16px 20px; border-top:1px solid #e5e7eb; background:#f9fafb; }
.dh-side-actions { display:flex; gap:10px; }
.dh-btn-reset { flex:1; display:flex; align-items:center; justify-content:center; gap:6px; padding:10px 0; background:#fff; border:1px solid #d1d5db; border-radius:6px; font-size:13px; font-weight:500; color:#374151; cursor:pointer; transition:all .15s; }
.dh-btn-reset:hover { background:#f9fafb; border-color:#9ca3af; }
.dh-btn-dist { flex:2; display:flex; align-items:center; justify-content:center; gap:8px; padding:10px 16px; border-radius:6px; border:none; background:#3b82f6; color:#fff; font-size:13px; font-weight:600; cursor:pointer; box-shadow:0 0 15px rgba(59,130,246,.3); transition:all .2s; }
.dh-btn-dist:hover:not(:disabled) { background:#2563eb; transform:translateY(-1px); box-shadow:0 4px 20px rgba(59,130,246,.4); }
.dh-btn-dist:active:not(:disabled) { transform:translateY(0); }
.dh-btn-dist:disabled { opacity:.45; cursor:not-allowed; }
@keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
.dh-spin { animation:spin 1s linear infinite; }

/* ─── Overlay / Modal ─── */
.dh-overlay { position:fixed; inset:0; background:rgba(15,23,42,.45); backdrop-filter:blur(6px); z-index:100; display:flex; align-items:center; justify-content:center; padding:20px; }
.dh-modal { background:#fff; border-radius:16px; width:100%; max-width:480px; box-shadow:0 25px 60px -12px rgba(0,0,0,.25); overflow:hidden; }
.dh-modal-hdr { display:flex; align-items:center; justify-content:space-between; padding:18px 24px; border-bottom:1px solid #f1f5f9; }
.dh-title-icon { width:36px; height:36px; border-radius:10px; background:#eff6ff; display:flex; align-items:center; justify-content:center; }
.dh-modal-title { font-size:16px; font-weight:700; color:#111827; margin:0; }
.dh-modal-close { width:34px; height:34px; border-radius:8px; display:flex; align-items:center; justify-content:center; color:#9ca3af; background:transparent; border:none; cursor:pointer; transition:background .15s; }
.dh-modal-close:hover { background:#f3f4f6; color:#374151; }
.dh-modal-body { padding:20px 24px; display:flex; flex-direction:column; gap:16px; }
.dh-modal-footer { display:flex; gap:10px; padding:16px 24px; border-top:1px solid #f1f5f9; background:#f9fafb; }
.dh-form-group { }
.dh-form-label { display:flex; align-items:center; gap:4px; font-size:12px; font-weight:600; color:#374151; margin-bottom:6px; }
.dh-form-input { width:100%; padding:9px 14px; background:#fff; border:1px solid #d1d5db; border-radius:6px; font-size:13px; font-weight:500; color:#111827; outline:none; transition:border-color .2s,box-shadow .2s; }
.dh-form-input:focus { border-color:#3b82f6; box-shadow:0 0 0 2px rgba(59,130,246,.12); }
.dh-form-select { width:100%; padding:9px 14px; background:#fff; border:1px solid #d1d5db; border-radius:6px; font-size:13px; font-weight:500; color:#111827; outline:none; transition:border-color .2s; }
.dh-form-select:focus { border-color:#3b82f6; box-shadow:0 0 0 2px rgba(59,130,246,.12); }
.dh-btn-cancel { flex:1; padding:10px 16px; background:#fff; color:#374151; border:1px solid #d1d5db; border-radius:6px; font-weight:500; font-size:13px; cursor:pointer; transition:background .15s; }
.dh-btn-cancel:hover { background:#f3f4f6; }
.dh-btn-save { flex:1; display:inline-flex; align-items:center; justify-content:center; gap:8px; padding:10px 16px; background:#3b82f6; color:#fff; border:none; border-radius:6px; font-weight:600; font-size:13px; cursor:pointer; transition:all .15s; }
.dh-btn-save:hover { background:#2563eb; }
.dh-btn-save:disabled { opacity:.6; }

/* Delete Modal */
.dh-del-modal { background:#fff; border-radius:16px; width:100%; max-width:380px; padding:32px 28px 24px; text-align:center; box-shadow:0 25px 60px -12px rgba(0,0,0,.25); }
.dh-del-icon { width:56px; height:56px; border-radius:50%; background:#fef2f2; display:inline-flex; align-items:center; justify-content:center; margin-bottom:16px; }
.dh-del-title { font-size:17px; font-weight:700; color:#111827; margin:0 0 8px; }
.dh-del-text { font-size:13px; color:#6b7280; line-height:1.6; margin:0 0 20px; }
.dh-del-actions { display:flex; gap:10px; }
.dh-btn-delete { flex:1; display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:10px 16px; background:#ef4444; color:#fff; border:none; border-radius:6px; font-weight:600; font-size:13px; cursor:pointer; transition:all .15s; }
.dh-btn-delete:hover { background:#dc2626; }
.dh-btn-delete:disabled { opacity:.6; }
`;
