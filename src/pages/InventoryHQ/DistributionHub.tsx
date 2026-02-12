import React, { useState, useEffect, useRef, useMemo } from 'react';
import { InventoryService } from '../../services';
import { STORES } from '../../constants';
import * as XLSX from 'xlsx';

interface DistributionHubProps {
    toast: any;
    date: string;
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
    const [products, setProducts] = useState<any[]>([]);
    const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState<string | null>(null);
    const [showProductModal, setShowProductModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<any>(null);
    const [productForm, setProductForm] = useState({ barcode: '', name: '', unit: '', category: '' });
    const [confirmDelete, setConfirmDelete] = useState<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { loadMasterProducts(); }, []);

    useEffect(() => {
        if (!searchQuery) { setFilteredProducts(products); return; }
        const q = searchQuery.toLowerCase();
        setFilteredProducts(products.filter(p =>
            (p.name?.toLowerCase().includes(q)) || (p.pvn?.toLowerCase().includes(q)) || (p.barcode?.includes(q))
        ));
    }, [searchQuery, products]);

    const stats = useMemo(() => {
        const cats: Record<string, number> = {};
        products.forEach(p => { const c = p.category || 'Khác'; cats[c] = (cats[c] || 0) + 1; });
        return { total: products.length, categories: cats };
    }, [products]);

    const topCats = useMemo(() =>
        Object.entries(stats.categories).sort((a, b) => b[1] - a[1]).slice(0, 4)
        , [stats.categories]);

    const loadMasterProducts = async () => {
        setLoading(true);
        try { const r = await InventoryService.getMasterItems(); if (r.success) { setProducts(r.items); setFilteredProducts(r.items); } }
        catch { } finally { setLoading(false); }
    };

    const handleDistribute = async () => {
        if (!products.length) return toast.error('Danh sách sản phẩm trống');
        if (!confirm(`Xác nhận phân bổ ${products.length} sản phẩm cho ${selectedStore === 'ALL' ? 'TẤT CẢ CỬA HÀNG' : selectedStore} (Ca ${selectedShift})?`)) return;
        setProcessing('DISTRIBUTE');
        try {
            if (selectedStore === 'ALL') {
                for (const s of STORES) { await InventoryService.distributeToStore(s.id, selectedShift); }
                toast.success(`Đã phân phối cho tất cả cửa hàng (Ca ${selectedShift})`);
            } else {
                const r = await InventoryService.distributeToStore(selectedStore, selectedShift);
                r.success ? toast.success('Đã phân phối thành công!') : toast.error(r.message || 'Lỗi phân phối');
            }
        } catch { toast.error('Lỗi hệ thống'); } finally { setProcessing(null); }
    };

    const handleNewSession = () => {
        if (!confirm('Tạo phiên kiểm mới sẽ xóa danh sách hiện tại?')) return;
        setProducts([]); setFilteredProducts([]); toast.info('Đã làm mới phiên làm việc');
    };

    const openAddProduct = () => { setEditingProduct(null); setProductForm({ barcode: '', name: '', unit: '', category: '' }); setShowProductModal(true); };
    const openEditProduct = (p: any) => { setEditingProduct(p); setProductForm({ barcode: p.barcode || '', name: p.name || '', unit: p.unit || '', category: p.category || '' }); setShowProductModal(true); };

    const saveProduct = async () => {
        if (!productForm.barcode || !productForm.name) { toast.error('Barcode và tên sản phẩm là bắt buộc'); return; }
        setProcessing('SAVE_PRODUCT');
        try {
            const d = { barcode: productForm.barcode, name: productForm.name, unit: productForm.unit, category: productForm.category };
            const r = editingProduct ? await InventoryService.updateMasterItem(editingProduct.id, d) : await InventoryService.addMasterItem(d);
            if (r.success) { toast.success(editingProduct ? 'Đã cập nhật' : 'Đã thêm mới'); setShowProductModal(false); loadMasterProducts(); }
            else toast.error(r.error || 'Có lỗi xảy ra');
        } catch { toast.error('Lỗi hệ thống'); } finally { setProcessing(null); }
    };

    const handleDeleteProduct = async (p: any) => {
        setProcessing('DELETE_' + p.id);
        try { const r = await InventoryService.deleteMasterItem(p.id); if (r.success) { toast.success('Đã xóa'); loadMasterProducts(); } else toast.error(r.error || 'Không thể xóa'); }
        catch { toast.error('Lỗi hệ thống'); } finally { setProcessing(null); setConfirmDelete(null); }
    };

    const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return;
        setProcessing('IMPORT_EXCEL');
        try {
            const wb = XLSX.read(await file.arrayBuffer());
            const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets[wb.SheetNames[0]]);
            const items = rows.map((r: any) => ({
                category: String(r['Mã hàng SP'] || r['Mã hàng'] || r['Product Code'] || r['ma_hang'] || ''),
                barcode: String(r['Mã barcode'] || r['Barcode'] || r['Mã vạch'] || r['barcode'] || ''),
                name: String(r['Tên sản phẩm'] || r['Tên SP'] || r['Name'] || r['name'] || ''), unit: '',
            })).filter((p: any) => p.barcode && p.name);
            if (!items.length) { toast.error('Không tìm thấy dữ liệu hợp lệ'); return; }
            const res = await InventoryService.importProducts(items);
            if (res.success) { toast.success(`Đã import ${res.imported} SP`); if (res.errors?.length) toast.warning(`${res.errors.length} lỗi`); loadMasterProducts(); }
            else toast.error('Import thất bại');
        } catch { toast.error('Lỗi đọc file Excel'); } finally { setProcessing(null); if (fileInputRef.current) fileInputRef.current.value = ''; }
    };

    return (
        <div className="dh-root">
            <style>{CSS_TEXT}</style>

            {/* ━━━ SUMMARY STRIP ━━━ */}
            <div className="dh-summary">
                <div className="dh-stat-card">
                    <div className="dh-stat-icon" style={{ background: '#eef2ff' }}><span className="material-symbols-outlined" style={{ fontSize: 20, color: '#6366f1' }}>inventory_2</span></div>
                    <div><div className="dh-stat-label">Tổng SP</div><div className="dh-stat-val">{stats.total}</div></div>
                </div>
                {topCats.map(([cat, cnt]) => {
                    const s = getCatStyle(cat);
                    return (<div key={cat} className="dh-stat-card">
                        <div className="dh-stat-dot" style={{ background: s.dot }} />
                        <div><div className="dh-stat-label">{cat}</div><div className="dh-stat-val">{cnt}</div></div>
                    </div>);
                })}
                <div className="dh-stat-card">
                    <div className="dh-stat-icon" style={{ background: '#d1fae5' }}><span className="material-symbols-outlined" style={{ fontSize: 20, color: '#10b981' }}>storefront</span></div>
                    <div><div className="dh-stat-label">Cửa hàng</div><div className="dh-stat-val">{STORES.length}</div></div>
                </div>
            </div>

            {/* ━━━ MAIN GRID ━━━ */}
            <div className="dh-main">
                {/* LEFT TABLE */}
                <div className="dh-table-card">
                    <div className="dh-toolbar">
                        <div className="dh-toolbar-left">
                            <div className="dh-title-icon"><span className="material-symbols-outlined" style={{ fontSize: 20, color: '#6366f1' }}>dataset</span></div>
                            <div><h3 className="dh-title">Danh sách kiểm tồn</h3><span className="dh-title-sub">{filteredProducts.length} / {products.length} sản phẩm</span></div>
                        </div>
                        <div className="dh-toolbar-right">
                            <div className="dh-search">
                                <span className="material-symbols-outlined dh-search-icon">search</span>
                                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Tìm tên, mã, barcode..." className="dh-search-input" />
                                {searchQuery && <button onClick={() => setSearchQuery('')} className="dh-search-clear"><span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span></button>}
                            </div>
                            <input type="file" ref={fileInputRef} onChange={handleExcelUpload} accept=".xlsx,.xls,.csv" hidden />
                            <button onClick={() => fileInputRef.current?.click()} disabled={processing === 'IMPORT_EXCEL'} className="dh-btn-import">
                                <span className="material-symbols-outlined" style={{ fontSize: 17 }}>{processing === 'IMPORT_EXCEL' ? 'sync' : 'upload_file'}</span> Import
                            </button>
                            <button onClick={openAddProduct} className="dh-btn-add">
                                <span className="material-symbols-outlined" style={{ fontSize: 17 }}>add</span> Thêm SP
                            </button>
                        </div>
                    </div>

                    <div className="dh-table-scroll custom-scrollbar">
                        {loading ? (
                            <div className="dh-loading">{[...Array(8)].map((_, i) => <div key={i} className="shimmer" style={{ height: 42, borderRadius: 8, animationDelay: `${i * 80}ms` }} />)}</div>
                        ) : (
                            <table className="dh-table">
                                <thead><tr>
                                    <th style={{ width: 48, textAlign: 'center' }}>#</th>
                                    <th style={{ width: 110 }}>Mã hàng</th>
                                    <th style={{ width: 140 }}>Mã vạch</th>
                                    <th>Tên sản phẩm</th>
                                    <th style={{ width: 90 }}>Danh mục</th>
                                    <th style={{ width: 56, textAlign: 'center' }}>ĐVT</th>
                                    <th style={{ width: 76, textAlign: 'center' }}>Thao tác</th>
                                </tr></thead>
                                <tbody>
                                    {filteredProducts.length === 0 ? (
                                        <tr><td colSpan={7} className="dh-empty-td">
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
                                            <td>{p.category && <span className="dh-cat" style={{ background: cs.bg, color: cs.text }}>{p.category}</span>}</td>
                                            <td style={{ textAlign: 'center' }}><span className="dh-unit">{p.unit}</span></td>
                                            <td style={{ textAlign: 'center' }}><div className="dh-actions">
                                                <button onClick={() => openEditProduct(p)} className="dh-act-btn" title="Sửa"><span className="material-symbols-outlined" style={{ fontSize: 17 }}>edit</span></button>
                                                <button onClick={() => setConfirmDelete(p)} className="dh-act-btn dh-act-del" title="Xóa"><span className="material-symbols-outlined" style={{ fontSize: 17 }}>delete</span></button>
                                            </div></td>
                                        </tr>);
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <div className="dh-footer">
                        <span>Tổng: <strong>{products.length}</strong> sản phẩm</span>
                        {searchQuery && <span>Kết quả: <strong style={{ color: '#6366f1' }}>{filteredProducts.length}</strong></span>}
                    </div>
                </div>

                {/* RIGHT CONTROL */}
                <div className="dh-ctrl">
                    <div className="dh-ctrl-card">
                        <div className="dh-ctrl-hdr"><span className="material-symbols-outlined" style={{ fontSize: 18, color: '#6366f1' }}>tune</span><span className="dh-ctrl-title">Cấu hình phân phối</span></div>
                        <div className="dh-field"><label className="dh-label">Cửa hàng đích</label>
                            <div className="dh-select-wrap">
                                <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)} className="dh-select">
                                    <option value="ALL">TẤT CẢ CỬA HÀNG</option>
                                    {STORES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                                <span className="material-symbols-outlined dh-chevron">expand_more</span>
                            </div>
                        </div>
                        <div className="dh-field"><label className="dh-label">Ca làm việc</label>
                            <div className="dh-shift-grid">
                                {[1, 2, 3].map(s => (<button key={s} onClick={() => setSelectedShift(s)} className={`dh-shift ${selectedShift === s ? 'active' : ''}`}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{s === 1 ? 'wb_sunny' : s === 2 ? 'wb_twilight' : 'dark_mode'}</span> Ca {s}
                                </button>))}
                            </div>
                        </div>
                    </div>

                    <div className="dh-ctrl-card">
                        <div className="dh-ctrl-hdr"><span className="material-symbols-outlined" style={{ fontSize: 18, color: '#f59e0b' }}>bolt</span><span className="dh-ctrl-title">Tác vụ nhanh</span></div>
                        <button onClick={handleNewSession} className="dh-btn-reset"><span className="material-symbols-outlined" style={{ fontSize: 20 }}>restart_alt</span> Làm mới phiên</button>
                        <button onClick={handleDistribute} disabled={!!processing || !products.length} className="dh-btn-dist">
                            {processing === 'DISTRIBUTE' ? <><span className="material-symbols-outlined dh-spin" style={{ fontSize: 22 }}>sync</span> Đang xử lý...</> :
                                <><span className="material-symbols-outlined" style={{ fontSize: 22 }}>send</span><div><div style={{ fontWeight: 800 }}>Phân phối</div><div style={{ fontSize: 11, opacity: 0.85 }}>{products.length} SP → {selectedStore === 'ALL' ? 'Tất cả' : selectedStore}</div></div></>}
                        </button>
                    </div>

                    <div className="dh-note"><span className="material-symbols-outlined" style={{ fontSize: 16, color: '#6366f1', flexShrink: 0 }}>info</span>
                        <span>Phân phối sẽ tạo danh sách kiểm tồn cho cửa hàng được chọn theo ca làm việc.</span>
                    </div>
                </div>
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
                <div className="dh-modal-body">
                    <div className="dh-form-group"><label className="dh-form-label"><span className="material-symbols-outlined" style={{ fontSize: 14 }}>barcode</span> Barcode <span style={{ color: '#ef4444' }}>*</span></label>
                        <input value={productForm.barcode} onChange={e => setProductForm(p => ({ ...p, barcode: e.target.value }))} placeholder="8934567890123" className="dh-form-input" /></div>
                    <div className="dh-form-group"><label className="dh-form-label"><span className="material-symbols-outlined" style={{ fontSize: 14 }}>label</span> Tên SP <span style={{ color: '#ef4444' }}>*</span></label>
                        <input value={productForm.name} onChange={e => setProductForm(p => ({ ...p, name: e.target.value }))} placeholder="Bánh mì sữa tươi" className="dh-form-input" /></div>
                    <div className="dh-form-row">
                        <div style={{ flex: 1 }}><label className="dh-form-label">Đơn vị</label><select value={productForm.unit} onChange={e => setProductForm(p => ({ ...p, unit: e.target.value }))} className="dh-form-select">
                            <option value="">Chọn...</option><option value="Cái">Cái</option><option value="Hộp">Hộp</option><option value="Lon">Lon</option><option value="Chai">Chai</option><option value="Kg">Kg</option><option value="Gói">Gói</option>
                        </select></div>
                        <div style={{ flex: 1 }}><label className="dh-form-label">Danh mục</label><select value={productForm.category} onChange={e => setProductForm(p => ({ ...p, category: e.target.value }))} className="dh-form-select">
                            <option value="">Chọn...</option><option value="Bánh Mì">Bánh Mì</option><option value="Thức Uống">Thức Uống</option><option value="Đồ Ăn Vặt">Đồ Ăn Vặt</option><option value="Tủ Mát">Tủ Mát</option><option value="Đông Lạnh">Đông Lạnh</option><option value="Khác">Khác</option>
                        </select></div>
                    </div>
                </div>
                <div className="dh-modal-footer">
                    <button onClick={() => setShowProductModal(false)} className="dh-btn-cancel">Hủy</button>
                    <button onClick={saveProduct} disabled={!!processing} className="dh-btn-save">
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{processing === 'SAVE_PRODUCT' ? 'sync' : 'save'}</span> Lưu
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
        </div>
    );
};

export default DistributionHub;

/* ══════ CSS ══════ */
const CSS_TEXT = `
.dh-root { display:flex; flex-direction:column; gap:20px; padding-top:20px; height:calc(100vh - 140px); min-height:0; }

/* Summary Strip */
.dh-summary { display:flex; gap:12px; flex-shrink:0; overflow-x:auto; }
.dh-stat-card { display:flex; align-items:center; gap:12px; padding:14px 20px; background:#fff; border-radius:14px; border:1px solid #e5e7eb; min-width:120px; flex:1 0 auto; transition:box-shadow .25s,border-color .25s; }
.dh-stat-card:hover { box-shadow:0 4px 16px -4px rgba(0,0,0,.07); border-color:#c7d2fe; }
.dh-stat-icon { width:38px; height:38px; border-radius:10px; display:flex; align-items:center; justify-content:center; }
.dh-stat-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
.dh-stat-label { font-size:11px; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:.04em; }
.dh-stat-val { font-size:20px; font-weight:800; color:#1e293b; line-height:1.2; }

/* Main Grid */
.dh-main { display:flex; gap:20px; flex:1; min-height:0; }

/* Table Card */
.dh-table-card { flex:1; display:flex; flex-direction:column; min-height:0; background:#fff; border-radius:16px; border:1px solid #e5e7eb; overflow:hidden; transition:box-shadow .25s; }
.dh-table-card:hover { box-shadow:0 4px 20px -4px rgba(0,0,0,.06); }

/* Toolbar */
.dh-toolbar { display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-bottom:1px solid #f1f5f9; gap:16px; flex-shrink:0; flex-wrap:wrap; }
.dh-toolbar-left { display:flex; align-items:center; gap:10px; }
.dh-toolbar-right { display:flex; align-items:center; gap:10px; }
.dh-title-icon { width:36px; height:36px; border-radius:10px; background:#eef2ff; display:flex; align-items:center; justify-content:center; }
.dh-title { font-size:14px; font-weight:800; color:#1e293b; letter-spacing:.02em; margin:0; }
.dh-title-sub { font-size:11px; color:#94a3b8; font-weight:500; }

/* Search */
.dh-search { position:relative; width:230px; }
.dh-search-icon { position:absolute; left:10px; top:50%; transform:translateY(-50%); font-size:18px; color:#94a3b8; pointer-events:none; }
.dh-search-input { width:100%; padding:8px 32px 8px 34px; background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:10px; font-size:13px; outline:none; font-weight:500; color:#334155; transition:border-color .2s,box-shadow .2s; }
.dh-search-input:focus { border-color:#818cf8 !important; box-shadow:0 0 0 3px rgba(99,102,241,.1) !important; }
.dh-search-clear { position:absolute; right:8px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:#94a3b8; display:flex; }

/* Toolbar Buttons */
.dh-btn-import { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; background:linear-gradient(135deg,#f59e0b,#d97706); color:#fff; border:none; border-radius:10px; font-size:12px; font-weight:700; cursor:pointer; transition:transform .15s,box-shadow .2s; }
.dh-btn-import:hover { transform:translateY(-1px); box-shadow:0 4px 12px -2px rgba(245,158,11,.35); }
.dh-btn-import:active { transform:scale(.97); }
.dh-btn-add { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; background:linear-gradient(135deg,#10b981,#059669); color:#fff; border:none; border-radius:10px; font-size:12px; font-weight:700; cursor:pointer; transition:transform .15s,box-shadow .2s; }
.dh-btn-add:hover { transform:translateY(-1px); box-shadow:0 4px 12px -2px rgba(16,185,129,.35); }
.dh-btn-add:active { transform:scale(.97); }

/* Table */
.dh-table-scroll { flex:1; overflow:auto; }
.dh-loading { padding:20px; display:flex; flex-direction:column; gap:8px; }
.dh-table { width:100%; border-collapse:collapse; font-size:13px; }
.dh-table thead th { padding:10px 14px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#64748b; background:#f8fafc; border-bottom:1px solid #e2e8f0; position:sticky; top:0; z-index:5; white-space:nowrap; }
.dh-table tbody td { padding:10px 14px; border-bottom:1px solid #f1f5f9; vertical-align:middle; }
.dh-row { transition:background .12s; }
.dh-row:hover { background:#f8fafc; }
.dh-row:hover .dh-actions { opacity:1 !important; }
.dh-rownum { font-size:11px; font-weight:600; color:#94a3b8; font-family:monospace; }
.dh-code { display:inline-block; padding:2px 8px; background:#eef2ff; color:#4f46e5; border-radius:6px; font-size:11px; font-weight:700; font-family:monospace; letter-spacing:.03em; }
.dh-barcode { font-size:12px; font-family:monospace; color:#64748b; letter-spacing:.02em; }
.dh-name { font-size:13px; font-weight:600; color:#1e293b; }
.dh-cat { display:inline-block; padding:2px 8px; border-radius:20px; font-size:10px; font-weight:700; white-space:nowrap; }
.dh-unit { font-size:12px; color:#64748b; }
.dh-actions { display:flex; align-items:center; justify-content:center; gap:4px; opacity:0; transition:opacity .15s; }
.dh-act-btn { width:30px; height:30px; border-radius:8px; display:flex; align-items:center; justify-content:center; color:#6366f1; background:transparent; border:none; cursor:pointer; transition:background .15s,transform .1s; }
.dh-act-btn:hover { background:#eef2ff; transform:scale(1.08); }
.dh-act-del { color:#ef4444; }
.dh-act-del:hover { background:#fef2f2 !important; }

/* Empty */
.dh-empty-td { padding:0 !important; }
.dh-empty { display:flex; flex-direction:column; align-items:center; gap:8px; padding:60px 20px; }
.dh-empty-icon { width:64px; height:64px; border-radius:50%; background:#f8fafc; display:flex; align-items:center; justify-content:center; }
.dh-empty-title { font-weight:700; color:#64748b; font-size:14px; margin:0; }
.dh-empty-sub { font-size:12px; color:#94a3b8; margin:0; }
.dh-empty-btn { display:inline-flex; align-items:center; gap:4px; padding:6px 14px; background:#eef2ff; color:#4f46e5; border:none; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer; margin-top:4px; }

/* Footer */
.dh-footer { padding:10px 20px; background:#f8fafc; border-top:1px solid #f1f5f9; font-size:12px; font-weight:500; color:#94a3b8; display:flex; justify-content:space-between; flex-shrink:0; }
.dh-footer strong { color:#1e293b; }

/* Control Column */
.dh-ctrl { width:300px; flex-shrink:0; display:flex; flex-direction:column; gap:14px; min-height:0; }
.dh-ctrl-card { background:#fff; border-radius:16px; border:1px solid #e5e7eb; padding:20px; transition:box-shadow .25s; }
.dh-ctrl-card:hover { box-shadow:0 4px 20px -4px rgba(0,0,0,.06); }
.dh-ctrl-hdr { display:flex; align-items:center; gap:8px; margin-bottom:18px; }
.dh-ctrl-title { font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:.05em; color:#475569; }

/* Fields */
.dh-field { margin-bottom:16px; }
.dh-label { display:block; font-size:11px; font-weight:700; color:#64748b; margin-bottom:6px; text-transform:uppercase; letter-spacing:.03em; }
.dh-select-wrap { position:relative; }
.dh-select { width:100%; padding:10px 36px 10px 14px; background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:10px; font-size:13px; font-weight:700; color:#1e293b; outline:none; appearance:none; cursor:pointer; transition:border-color .15s; }
.dh-select:focus { border-color:#818cf8; box-shadow:0 0 0 3px rgba(99,102,241,.1); }
.dh-chevron { position:absolute; right:10px; top:50%; transform:translateY(-50%); font-size:18px; color:#94a3b8; pointer-events:none; }
.dh-shift-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
.dh-shift { display:flex; align-items:center; justify-content:center; gap:4px; padding:10px 0; border-radius:10px; font-size:12px; font-weight:700; border:1.5px solid #e2e8f0; background:#fff; color:#64748b; cursor:pointer; transition:all .2s; }
.dh-shift:hover { border-color:#a5b4fc; background:#eef2ff; color:#4f46e5; }
.dh-shift.active { background:linear-gradient(135deg,#6366f1,#4f46e5); color:#fff; border-color:#6366f1; box-shadow:0 4px 12px -2px rgba(99,102,241,.35); }

/* Action Buttons */
.dh-btn-reset { display:flex; align-items:center; justify-content:center; gap:8px; width:100%; padding:11px 0; border-radius:10px; border:1.5px solid #e2e8f0; background:#fff; color:#64748b; font-size:13px; font-weight:700; cursor:pointer; transition:all .15s; margin-bottom:10px; }
.dh-btn-reset:hover { border-color:#fca5a5; color:#ef4444; background:#fef2f2; }
.dh-btn-dist { display:flex; align-items:center; justify-content:center; gap:12px; width:100%; padding:14px 0; border-radius:12px; border:none; background:linear-gradient(135deg,#6366f1,#4338ca); color:#fff; font-size:14px; cursor:pointer; box-shadow:0 8px 24px -4px rgba(99,102,241,.4); transition:transform .18s,box-shadow .25s; }
.dh-btn-dist:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 12px 32px -6px rgba(99,102,241,.5); }
.dh-btn-dist:active:not(:disabled) { transform:translateY(0) scale(.97); }
.dh-btn-dist:disabled { opacity:.55; cursor:not-allowed; }
@keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
.dh-spin { animation:spin 1s linear infinite; }

/* Note */
.dh-note { display:flex; gap:10px; padding:14px 16px; background:#eef2ff; border-radius:12px; border:1px solid #c7d2fe; font-size:11px; line-height:1.6; color:#4338ca; font-weight:500; }

/* Overlay / Modal */
.dh-overlay { position:fixed; inset:0; background:rgba(15,23,42,.45); backdrop-filter:blur(6px); z-index:100; display:flex; align-items:center; justify-content:center; padding:20px; }
.dh-modal { background:#fff; border-radius:20px; width:100%; max-width:480px; box-shadow:0 25px 60px -12px rgba(0,0,0,.25); overflow:hidden; }
.dh-modal-hdr { display:flex; align-items:center; justify-content:space-between; padding:18px 24px; border-bottom:1px solid #f1f5f9; }
.dh-modal-title { font-size:16px; font-weight:800; color:#1e293b; margin:0; }
.dh-modal-close { width:34px; height:34px; border-radius:10px; display:flex; align-items:center; justify-content:center; color:#94a3b8; background:transparent; border:none; cursor:pointer; transition:background .15s; }
.dh-modal-close:hover { background:#f1f5f9; color:#475569; }
.dh-modal-body { padding:20px 24px; display:flex; flex-direction:column; gap:16px; }
.dh-modal-footer { display:flex; gap:10px; padding:16px 24px; border-top:1px solid #f1f5f9; background:#f8fafc; }
.dh-form-group { }
.dh-form-label { display:flex; align-items:center; gap:4px; font-size:12px; font-weight:700; color:#475569; margin-bottom:6px; }
.dh-form-input { width:100%; padding:10px 14px; background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:10px; font-size:13px; font-weight:500; color:#1e293b; outline:none; transition:border-color .2s,box-shadow .2s; }
.dh-form-input:focus { border-color:#818cf8; box-shadow:0 0 0 3px rgba(99,102,241,.1); }
.dh-form-select { width:100%; padding:10px 14px; background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:10px; font-size:13px; font-weight:500; color:#1e293b; outline:none; transition:border-color .2s; }
.dh-form-select:focus { border-color:#818cf8; box-shadow:0 0 0 3px rgba(99,102,241,.1); }
.dh-form-row { display:flex; gap:12px; }
.dh-btn-cancel { flex:1; padding:11px 16px; background:#fff; color:#475569; border:1.5px solid #e2e8f0; border-radius:10px; font-weight:700; font-size:13px; cursor:pointer; transition:background .15s; }
.dh-btn-cancel:hover { background:#f1f5f9; }
.dh-btn-save { flex:1; display:inline-flex; align-items:center; justify-content:center; gap:8px; padding:11px 16px; background:linear-gradient(135deg,#6366f1,#4338ca); color:#fff; border:none; border-radius:10px; font-weight:700; font-size:13px; cursor:pointer; box-shadow:0 4px 14px -3px rgba(99,102,241,.4); transition:transform .15s; }
.dh-btn-save:hover { transform:translateY(-1px); }
.dh-btn-save:disabled { opacity:.6; }

/* Delete Modal */
.dh-del-modal { background:#fff; border-radius:20px; width:100%; max-width:380px; padding:32px 28px 24px; text-align:center; box-shadow:0 25px 60px -12px rgba(0,0,0,.25); }
.dh-del-icon { width:56px; height:56px; border-radius:50%; background:#fef2f2; display:inline-flex; align-items:center; justify-content:center; margin-bottom:16px; }
.dh-del-title { font-size:17px; font-weight:800; color:#1e293b; margin:0 0 8px; }
.dh-del-text { font-size:13px; color:#64748b; line-height:1.6; margin:0 0 20px; }
.dh-del-actions { display:flex; gap:10px; }
.dh-btn-delete { flex:1; display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:11px 16px; background:linear-gradient(135deg,#ef4444,#dc2626); color:#fff; border:none; border-radius:10px; font-weight:700; font-size:13px; cursor:pointer; box-shadow:0 4px 14px -3px rgba(239,68,68,.4); transition:transform .15s; }
.dh-btn-delete:hover { transform:translateY(-1px); }
.dh-btn-delete:disabled { opacity:.6; }
`;
