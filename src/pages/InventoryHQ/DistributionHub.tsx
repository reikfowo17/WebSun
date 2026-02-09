import React, { useState, useEffect, useRef } from 'react';
import { InventoryService } from '../../services';
import { STORES } from '../../constants';
import * as XLSX from 'xlsx';

interface DistributionHubProps {
    toast: any;
    date: string;
}

const DistributionHub: React.FC<DistributionHubProps> = ({ toast, date }) => {
    const [selectedStore, setSelectedStore] = useState<string>('ALL');
    const [selectedShift, setSelectedShift] = useState<number>(1);
    const [products, setProducts] = useState<any[]>([]);
    const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState<string | null>(null);

    // Product Management State
    const [showProductModal, setShowProductModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<any>(null);
    const [productForm, setProductForm] = useState({ barcode: '', name: '', unit: '', category: '' });
    const [confirmDelete, setConfirmDelete] = useState<any>(null);

    // Excel Upload
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadMasterProducts();
    }, []);

    useEffect(() => {
        if (!searchQuery) {
            setFilteredProducts(products);
        } else {
            const lower = searchQuery.toLowerCase();
            setFilteredProducts(products.filter(p =>
                (p.name && p.name.toLowerCase().includes(lower)) ||
                (p.pvn && p.pvn.toLowerCase().includes(lower)) ||
                (p.barcode && p.barcode.includes(lower))
            ));
        }
    }, [searchQuery, products]);

    const loadMasterProducts = async () => {
        setLoading(true);
        try {
            const res = await InventoryService.getMasterItems();
            if (res.success) {
                setProducts(res.items);
                setFilteredProducts(res.items);
            }
        } catch {
            // silent fail
        } finally {
            setLoading(false);
        }
    };

    const handleDistribute = async () => {
        if (!products.length) return toast.error('Danh sách sản phẩm trống');
        if (!confirm(`Xác nhận phân bổ ${products.length} sản phẩm cho ${selectedStore === 'ALL' ? 'TẤT CẢ CỬA HÀNG' : selectedStore} (Ca ${selectedShift})?`)) return;

        setProcessing('DISTRIBUTE');
        try {
            if (selectedStore === 'ALL') {
                for (const store of STORES) {
                    await InventoryService.distributeToStore(store.id, selectedShift);
                }
                toast.success(`Đã phân phối cho tất cả cửa hàng (Ca ${selectedShift})`);
            } else {
                const res = await InventoryService.distributeToStore(selectedStore, selectedShift);
                if (res.success) toast.success('Đã phân phối nhiệm vụ thành công!');
                else toast.error(res.message || 'Lỗi phân phối');
            }
        } catch {
            toast.error('Lỗi hệ thống');
        } finally {
            setProcessing(null);
        }
    };

    const handleNewSession = () => {
        if (!confirm('Tạo phiên kiểm mới sẽ xóa danh sách hiện tại?')) return;
        setProducts([]);
        setFilteredProducts([]);
        toast.info('Đã làm mới phiên làm việc');
    };

    // ========== PRODUCT MANAGEMENT ==========
    const openAddProduct = () => {
        setEditingProduct(null);
        setProductForm({ barcode: '', name: '', unit: '', category: '' });
        setShowProductModal(true);
    };

    const openEditProduct = (product: any) => {
        setEditingProduct(product);
        setProductForm({
            barcode: product.barcode || '',
            name: product.name || '',
            unit: product.unit || '',
            category: product.category || ''
        });
        setShowProductModal(true);
    };

    const saveProduct = async () => {
        if (!productForm.barcode || !productForm.name) {
            toast.error('Barcode và tên sản phẩm là bắt buộc');
            return;
        }
        setProcessing('SAVE_PRODUCT');
        try {
            let result;
            if (editingProduct) {
                result = await InventoryService.updateMasterItem(editingProduct.id, {
                    barcode: productForm.barcode,
                    name: productForm.name,
                    unit: productForm.unit,
                    category: productForm.category
                });
                if (result.success) toast.success('Đã cập nhật sản phẩm');
            } else {
                result = await InventoryService.addMasterItem({
                    barcode: productForm.barcode,
                    name: productForm.name,
                    unit: productForm.unit,
                    category: productForm.category
                });
                if (result.success) toast.success('Đã thêm sản phẩm mới');
            }
            if (result.success) {
                setShowProductModal(false);
                loadMasterProducts();
            } else {
                toast.error(result.error || 'Có lỗi xảy ra');
            }
        } catch {
            toast.error('Lỗi hệ thống');
        } finally {
            setProcessing(null);
        }
    };

    const handleDeleteProduct = async (product: any) => {
        setProcessing('DELETE_' + product.id);
        try {
            const result = await InventoryService.deleteMasterItem(product.id);
            if (result.success) {
                toast.success('Đã xóa sản phẩm');
                loadMasterProducts();
            } else {
                toast.error(result.error || 'Không thể xóa');
            }
        } catch {
            toast.error('Lỗi hệ thống');
        } finally {
            setProcessing(null);
            setConfirmDelete(null);
        }
    };

    // ========== EXCEL UPLOAD ==========
    const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setProcessing('IMPORT_EXCEL');
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);
            const productsToImport = jsonData.map((row: any) => ({
                barcode: String(row['Barcode'] || row['Mã vạch'] || row['barcode'] || row['ma_vach'] || ''),
                name: String(row['Tên SP'] || row['Name'] || row['Tên sản phẩm'] || row['name'] || row['ten_sp'] || ''),
                unit: String(row['ĐVT'] || row['Unit'] || row['Đơn vị'] || row['unit'] || row['dvt'] || ''),
                category: String(row['Danh mục'] || row['Category'] || row['category'] || row['danh_muc'] || ''),
            })).filter((p: any) => p.barcode && p.name);

            if (productsToImport.length === 0) {
                toast.error('Không tìm thấy dữ liệu hợp lệ. Cần có cột: Barcode, Tên SP');
                return;
            }

            const result = await InventoryService.importProducts(productsToImport);
            if (result.success) {
                toast.success(`Đã import ${result.imported} sản phẩm`);
                if (result.errors?.length) {
                    toast.warning(`${result.errors.length} lỗi xảy ra`);
                }
                loadMasterProducts();
            } else {
                toast.error('Import thất bại');
            }
        } catch (err) {
            console.error(err);
            toast.error('Lỗi đọc file Excel');
        } finally {
            setProcessing(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="pt-6 flex flex-col lg:flex-row gap-8 h-[calc(100vh-140px)]">
            {/* LEFT: MASTER DATA INPUT */}
            <div className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Search / Toolbar */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4 bg-white z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                            <span className="material-symbols-outlined">dataset</span>
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Danh sách kiểm tồn</h3>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Search */}
                        <div className="relative w-56">
                            <span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-400 text-lg">search</span>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Tìm tên, mã, barcode..."
                                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-gray-400"
                            />
                        </div>
                        {/* Import Excel Button */}
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleExcelUpload}
                            accept=".xlsx,.xls,.csv"
                            className="hidden"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={processing === 'IMPORT_EXCEL'}
                            className="flex items-center gap-1.5 px-3 py-2 bg-orange-500 text-white text-xs font-bold rounded-xl hover:bg-orange-600 transition-colors shadow-sm disabled:opacity-50"
                        >
                            {processing === 'IMPORT_EXCEL' ? (
                                <span className="material-symbols-outlined text-base animate-spin">sync</span>
                            ) : (
                                <span className="material-symbols-outlined text-base">upload_file</span>
                            )}
                            Excel
                        </button>
                        {/* Add Product Button */}
                        <button
                            onClick={openAddProduct}
                            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-sm"
                        >
                            <span className="material-symbols-outlined text-base">add</span>
                            Thêm SP
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto custom-scrollbar relative">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-4 py-3 w-12 text-center">STT</th>
                                <th className="px-4 py-3 w-28">Mã Hàng</th>
                                <th className="px-4 py-3 w-36">Mã Vạch</th>
                                <th className="px-4 py-3">Tên Sản Phẩm</th>
                                <th className="px-4 py-3 w-20 text-center">ĐVT</th>
                                <th className="px-4 py-3 w-24 text-center">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredProducts.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center text-gray-400">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                                                <span className="material-symbols-outlined text-3xl text-gray-300">playlist_add</span>
                                            </div>
                                            <p className="font-medium">Chưa có dữ liệu</p>
                                            <button onClick={loadMasterProducts} className="text-indigo-600 font-bold hover:underline text-xs">
                                                + Tải lại
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredProducts.map((p, i) => (
                                    <tr key={p.id || i} className="hover:bg-indigo-50/30 group transition-colors">
                                        <td className="px-4 py-2.5 text-center text-gray-400 font-mono text-xs">{i + 1}</td>
                                        <td className="px-4 py-2.5"><span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{p.pvn || '---'}</span></td>
                                        <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{p.barcode}</td>
                                        <td className="px-4 py-2.5 font-medium text-gray-700 text-sm">{p.name}</td>
                                        <td className="px-4 py-2.5 text-center text-xs text-gray-500">{p.unit}</td>
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => openEditProduct(p)}
                                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                                    title="Sửa"
                                                >
                                                    <span className="material-symbols-outlined text-base">edit</span>
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDelete(p)}
                                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                    title="Xóa"
                                                >
                                                    <span className="material-symbols-outlined text-base">delete</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer Stats */}
                <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 text-xs font-medium text-gray-500 flex justify-between items-center shrink-0">
                    <span>Tổng: <strong className="text-gray-800">{products.length}</strong> sản phẩm</span>
                    <span>Hiển thị: <strong className="text-gray-800">{filteredProducts.length}</strong></span>
                </div>
            </div>

            {/* RIGHT: CONTROL CENTER */}
            <div className="w-80 shrink-0 flex flex-col gap-4">
                {/* Scope Card */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">tune</span>
                        Cấu Hình Phân Phối
                    </h4>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Cửa hàng đích</label>
                            <div className="relative">
                                <select
                                    value={selectedStore}
                                    onChange={(e) => setSelectedStore(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all appearance-none cursor-pointer"
                                >
                                    <option value="ALL">TẤT CẢ CỬA HÀNG</option>
                                    <hr />
                                    {STORES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                                <span className="material-symbols-outlined absolute right-3 top-3 text-gray-400 pointer-events-none text-lg">expand_more</span>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Ca làm việc</label>
                            <div className="grid grid-cols-3 gap-2">
                                {[1, 2, 3].map(s => (
                                    <button
                                        key={s}
                                        onClick={() => setSelectedShift(s)}
                                        className={`py-2 rounded-xl text-sm font-bold border transition-all ${selectedShift === s ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                            }`}
                                    >Ca {s}</button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions Card */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">construction</span>
                        Tác Vụ
                    </h4>

                    <div className="space-y-3">
                        <button
                            onClick={handleNewSession}
                            className="w-full py-3 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50 hover:text-red-500 hover:border-red-100 transition-all flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-lg">restart_alt</span>
                            Làm Mới / Tạo Phiên Mới
                        </button>

                        <button
                            onClick={handleDistribute}
                            disabled={!!processing}
                            className="w-full py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-indigo-300 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {processing === 'DISTRIBUTE' ? (
                                <>
                                    <span className="material-symbols-outlined animate-spin text-lg">sync</span>
                                    Đang xử lý...
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-lg">send</span>
                                    Phân Phối ({products.length})
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* ========== PRODUCT MODAL ========== */}
            {showProductModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                            <h3 className="text-lg font-black text-slate-800">
                                {editingProduct ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}
                            </h3>
                            <button onClick={() => setShowProductModal(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1.5">Barcode / Mã vạch *</label>
                                <input
                                    type="text"
                                    value={productForm.barcode}
                                    onChange={(e) => setProductForm(prev => ({ ...prev, barcode: e.target.value }))}
                                    placeholder="8934567890123"
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1.5">Tên sản phẩm *</label>
                                <input
                                    type="text"
                                    value={productForm.name}
                                    onChange={(e) => setProductForm(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Bánh mì sữa tươi"
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1.5">Đơn vị tính</label>
                                    <select
                                        value={productForm.unit}
                                        onChange={(e) => setProductForm(prev => ({ ...prev, unit: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                                    >
                                        <option value="">Chọn...</option>
                                        <option value="Cái">Cái</option>
                                        <option value="Hộp">Hộp</option>
                                        <option value="Lon">Lon</option>
                                        <option value="Chai">Chai</option>
                                        <option value="Kg">Kg</option>
                                        <option value="Gói">Gói</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1.5">Danh mục</label>
                                    <select
                                        value={productForm.category}
                                        onChange={(e) => setProductForm(prev => ({ ...prev, category: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                                    >
                                        <option value="">Chọn...</option>
                                        <option value="Bánh Mì">Bánh Mì</option>
                                        <option value="Thức Uống">Thức Uống</option>
                                        <option value="Đồ Ăn Vặt">Đồ Ăn Vặt</option>
                                        <option value="Tủ Mát">Tủ Mát</option>
                                        <option value="Đông Lạnh">Đông Lạnh</option>
                                        <option value="Khác">Khác</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                            <button onClick={() => setShowProductModal(false)} className="flex-1 py-2.5 px-4 bg-white text-gray-600 font-bold text-sm rounded-xl border border-gray-200 hover:bg-gray-50">
                                Hủy
                            </button>
                            <button
                                onClick={saveProduct}
                                disabled={!!processing}
                                className="flex-1 py-2.5 px-4 bg-indigo-600 text-white font-bold text-sm rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {processing === 'SAVE_PRODUCT' ? (
                                    <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                                ) : (
                                    <span className="material-symbols-outlined text-sm">save</span>
                                )}
                                Lưu
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========== DELETE CONFIRMATION ========== */}
            {confirmDelete && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-150">
                        <div className="p-6 text-center">
                            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="material-symbols-outlined text-2xl text-red-600">delete_forever</span>
                            </div>
                            <h3 className="text-lg font-black text-slate-800 mb-2">Xác nhận xóa</h3>
                            <p className="text-sm text-gray-500">
                                Bạn có chắc muốn xóa <strong className="text-gray-700">{confirmDelete.name}</strong>?
                            </p>
                        </div>
                        <div className="flex gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                            <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 px-4 bg-white text-gray-600 font-bold text-sm rounded-xl border border-gray-200 hover:bg-gray-50">
                                Hủy
                            </button>
                            <button
                                onClick={() => handleDeleteProduct(confirmDelete)}
                                disabled={!!processing}
                                className="flex-1 py-2.5 px-4 bg-red-600 text-white font-bold text-sm rounded-xl hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {processing?.startsWith('DELETE_') ? (
                                    <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                                ) : (
                                    <span className="material-symbols-outlined text-sm">delete</span>
                                )}
                                Xóa
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DistributionHub;
