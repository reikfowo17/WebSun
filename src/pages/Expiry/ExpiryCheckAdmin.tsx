import React, { useState, useEffect, useRef } from 'react';
import ExpiryCheckService, { ExpiryCheckCategory } from '../../services/expiryCheck';
import { InventoryService } from '../../services';
import { SystemService } from '../../services/system';
import { MultiStoreSelect } from '../../components/MultiStoreSelect';
import { useToast } from '../../contexts';
import * as XLSX from 'xlsx';

// ─── Constants & CSS ──────────────────────────────────────────────────────────

const EMPTY_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23cbd5e1'%3E%3Cpath d='M20 5h-3.17L15 3H9L7.17 5H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 14H4V7h16v12zm-8-3c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm0-8c1.65 0 3 1.35 3 3s-1.35 3-3 3-3-1.35-3-3 1.35-3 3-3z'/%3E%3C/svg%3E";

// ─── Component ────────────────────────────────────────────────────────────────

const ExpiryCheckAdmin: React.FC = () => {
    const toast = useToast();
    const [categories, setCategories] = useState<ExpiryCheckCategory[]>([]);
    const [selectedCat, setSelectedCat] = useState<ExpiryCheckCategory | null>(null);

    const [selectedItems, setSelectedItems] = useState<Map<string, any>>(new Map());

    const [searchQ, setSearchQ] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);

    const [storesList, setStoresList] = useState<any[]>([]);

    const [isSaving, setIsSaving] = useState(false);

    // Create/Edit modal
    const [showModal, setShowModal] = useState(false);
    const [editForm, setEditForm] = useState({
        name: '', description: '', near_expiry_days: 30, production_threshold: 0, stores: [] as string[], is_active: true
    });

    // Import modal
    const [showImportModal, setShowImportModal] = useState(false);
    const [importText, setImportText] = useState('');
    const [isImporting, setIsImporting] = useState(false);

    // Manual add
    const [showAddProductModal, setShowAddProductModal] = useState(false);
    const [addCode, setAddCode] = useState('');
    const [addText, setAddText] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const [catRes, storeRes] = await Promise.all([
            ExpiryCheckService.getCategories(),
            SystemService.getStores()
        ]);
        if (catRes.success) setCategories(catRes.data);
        if (storeRes && storeRes.length > 0) setStoresList(storeRes);
    };

    useEffect(() => {
        if (!selectedCat) {
            setSelectedItems(new Map());
            return;
        }
        const loadItems = async () => {
            const res = await ExpiryCheckService.getCategoryItems(selectedCat.id);
            if (res.success) {
                const map = new Map();
                res.data.forEach(item => {
                    if (item.product) map.set(item.product_id, item.product);
                });
                setSelectedItems(map);
            }
        };
        loadItems();
    }, [selectedCat]);

    useEffect(() => {
        if (!searchQ.trim()) {
            setSearchResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            setSearching(true);
            const res = await ExpiryCheckService.searchInventoryProducts(searchQ);
            if (res.success) setSearchResults(res.data);
            setSearching(false);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQ]);

    const handleToggleActive = async () => {
        if (!selectedCat) return;
        const newStatus = !selectedCat.is_active;
        await ExpiryCheckService.updateCategory(selectedCat.id, { is_active: newStatus });
        setSelectedCat({ ...selectedCat, is_active: newStatus });
        loadData();
    };

    const handleSaveCatItems = async () => {
        if (!selectedCat) return;
        setIsSaving(true);

        const newItems: any[] = [];
        const existingProductIds: string[] = [];

        selectedItems.forEach((val, key) => {
            if (val.isNew) {
                newItems.push({
                    barcode: val.barcode,
                    sp: val.sp,
                    name: val.name,
                    category: selectedCat.name,
                    unit: 'Cái',
                });
            } else {
                existingProductIds.push(key);
            }
        });

        if (newItems.length > 0) {
            const importRes = await InventoryService.importProducts(newItems);
            if (!importRes.success) {
                toast.error('Có lỗi tạo SP mới: ' + (importRes.errors?.join(', ') || 'Lỗi không xác định'));
                setIsSaving(false);
                return;
            }
            // Need to fetch the newly created products to get their real UUIDs
            const { supabase } = await import('../../lib/supabase');
            const newBarcodes = newItems.map(i => i.barcode || i.sp).filter(Boolean);
            const { data: newProds } = await supabase.from('products').select('id').in('barcode', newBarcodes);
            if (newProds) {
                newProds.forEach(p => existingProductIds.push(p.id));
            }
        }

        const res = await ExpiryCheckService.updateCategoryItems(selectedCat.id, existingProductIds);
        setIsSaving(false);
        if (res.success) {
            toast.success('Đã lưu danh sách sản phẩm cấu hình thành công!');
            // Reload to get real shapes
            const loadRes = await ExpiryCheckService.getCategoryItems(selectedCat.id);
            if (loadRes.success) {
                const map = new Map();
                loadRes.data.forEach(item => {
                    if (item.product) map.set(item.product_id, item.product);
                });
                setSelectedItems(map);
            }
        } else {
            toast.error('Có lỗi xảy ra khi lưu: ' + res.error);
        }
    };

    const handleSaveCategory = async () => {
        if (!editForm.name.trim()) return;

        let res;
        if (selectedCat && editForm.name === selectedCat.name) {
            res = await ExpiryCheckService.updateCategory(selectedCat.id, {
                name: editForm.name,
                description: editForm.description,
                near_expiry_days: editForm.near_expiry_days,
                production_threshold: editForm.production_threshold,
                stores: editForm.stores ?? [],
                is_active: editForm.is_active
            });
        } else {
            res = await ExpiryCheckService.createCategory({
                name: editForm.name,
                description: editForm.description,
                near_expiry_days: editForm.near_expiry_days,
                production_threshold: editForm.production_threshold,
                stores: editForm.stores,
                is_active: editForm.is_active
            });
        }

        if (res.success) {
            setShowModal(false);
            loadData();
            if (res.data) setSelectedCat(res.data);
            toast.success('Lưu chi tiết danh mục thành công!');
        } else {
            toast.error('Có lỗi khi lưu danh mục!');
        }
    };

    const handleOpenCreateCategory = () => {
        setSelectedCat(null);
        setEditForm({ name: '', description: '', near_expiry_days: 30, production_threshold: 0, stores: [], is_active: true });
        setShowModal(true);
    };

    const handleOpenEditCategory = () => {
        if (!selectedCat) return;
        setEditForm({
            name: selectedCat.name,
            description: selectedCat.description || '',
            near_expiry_days: selectedCat.near_expiry_days ?? 30,
            production_threshold: selectedCat.production_threshold ?? 0,
            stores: selectedCat.stores ?? [],
            is_active: selectedCat.is_active ?? true
        });
        setShowModal(true);
    }

    const handleImportBarcodes = async () => {
        if (!selectedCat || !importText.trim()) return;
        const barcodes = importText.split('\n').map(b => b.trim()).filter(b => b);
        if (barcodes.length === 0) return;

        setIsImporting(true);
        const res = await ExpiryCheckService.addProductsByBarcodes(selectedCat.id, barcodes);
        setIsImporting(false);

        if (res.success) {
            toast.success(`Đã thêm ${res.addedCount} sản phẩm thành công!`);
            if (res.missingBarcodes && res.missingBarcodes.length > 0) {
                toast.warning(`Không tìm thấy ${res.missingBarcodes.length} mã: ${res.missingBarcodes.slice(0, 3).join(', ')}...`);
            }
            setShowImportModal(false);
            setImportText('');
            // Reload items
            const loadRes = await ExpiryCheckService.getCategoryItems(selectedCat.id);
            if (loadRes.success) {
                const map = new Map();
                loadRes.data.forEach(item => {
                    if (item.product) map.set(item.product_id, item.product);
                });
                setSelectedItems(map);
            }
        } else {
            toast.error('Có lỗi khi import sản phẩm: ' + res.error);
        }
    };

    const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            let added = 0;
            setSelectedItems(prev => {
                const next = new Map(prev);
                // Assume first row is header
                json.slice(1).forEach((row) => {
                    const col1 = String(row[0] || '').trim(); // Barcode
                    const col2 = String(row[1] || '').trim(); // Ma SP
                    const col3 = String(row[2] || '').trim(); // Ten SP

                    const barcode = col1 || col2 || '';
                    const sp = col2 || col1 || '';
                    const name = col3 || '';

                    const finalCode = barcode || sp;
                    if (finalCode && name) {
                        next.set(finalCode, { id: finalCode, barcode, sp, name, isNew: true });
                        added++;
                    }
                });
                return next;
            });

            if (added > 0) toast.success(`Đã biên dịch thành công ${added} dòng sản phẩm!`);
            else toast.warning('Không tìm thấy dữ liệu hợp lệ trong file');
        } catch (err) {
            toast.error('Lỗi khi đọc file Excel, vui lòng kiểm tra định dạng');
        } finally {
            setIsImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };


    const toggleItem = (product: any) => {
        setSelectedItems(prev => {
            const next = new Map(prev);
            if (next.has(product.id)) next.delete(product.id);
            else next.set(product.id, product);
            return next;
        });
    };

    return (
        <div className="flex gap-4 h-[calc(100vh-80px)] bg-[#FAF5FF] p-4 box-border overflow-hidden font-sans">
            {/* Sidebar Categories */}
            <div className="w-72 bg-white rounded-2xl border border-violet-100 shadow-[0_2px_10px_rgba(124,58,237,0.05)] flex flex-col shrink-0 overflow-hidden">
                <div className="p-4 border-b border-violet-50 flex justify-between items-center bg-white shrink-0">
                    <h2 className="text-[13px] font-bold text-violet-900 uppercase tracking-wider">Danh Mục Kiểm Date</h2>
                    <button onClick={handleOpenCreateCategory} className="w-8 h-8 rounded-lg border border-dashed border-violet-200 text-violet-400 hover:border-violet-600 hover:text-violet-600 hover:bg-violet-50 flex items-center justify-center transition-colors" title="Thêm danh mục">
                        <span className="material-symbols-outlined text-[18px]">add</span>
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
                    {categories.map(cat => {
                        const isActive = selectedCat?.id === cat.id;
                        return (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCat(cat)}
                                className={`text-left px-3 py-3 rounded-xl flex items-center justify-between group transition-all duration-200 border border-transparent ${isActive ? 'bg-violet-50 border-violet-100 shadow-sm' : 'hover:bg-gray-50'}`}
                            >
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? 'bg-violet-600 text-white shadow-md shadow-violet-200' : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200'}`}>
                                        <span className="material-symbols-outlined text-[16px]">{isActive ? 'folder_open' : 'folder'}</span>
                                    </div>
                                    <div className="flex flex-col truncate">
                                        <span className={`truncate text-[13px] transition-colors ${isActive ? 'font-bold text-violet-900' : 'font-semibold text-gray-700 group-hover:text-gray-900'}`}>{cat.name}</span>
                                        <span className="text-[10px] text-gray-400 mt-0.5 font-medium">{cat.near_expiry_days}d cảnh báo / {cat.production_threshold}d NSX ngắn</span>
                                    </div>
                                </div>
                                <div className={`w-2 h-2 rounded-full shrink-0 shadow-sm transition-colors ${cat.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`}></div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 bg-white rounded-2xl border border-violet-100 shadow-[0_2px_15px_rgba(124,58,237,0.04)] flex flex-col overflow-hidden min-w-0 relative">
                {!selectedCat ? (
                    <div className="flex-1 flex flex-col items-center justify-center bg-gray-50/30 relative overflow-hidden">
                        {/* Soft Background Blurs */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-violet-400/10 blur-[80px] rounded-full pointer-events-none"></div>

                        {/* Icon Container */}
                        <div className="relative mb-8 group">
                            <div className="absolute inset-0 bg-violet-400/20 rounded-3xl blur-xl scale-125 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                            <div className="relative w-20 h-20 bg-white shadow-xl shadow-violet-100/60 rounded-2xl border border-violet-50 flex items-center justify-center transform group-hover:-translate-y-1 transition-transform duration-300">
                                <div className="absolute -inset-2 bg-violet-50 rounded-[24px] -z-10 bg-opacity-70"></div>
                                <span className="material-symbols-outlined text-[40px] text-violet-600">inventory_2</span>
                            </div>
                        </div>

                        {/* Text Content */}
                        <h3 className="text-[20px] font-bold text-gray-900 mb-2.5 relative z-10">Quản lý Danh Mục Kiểm Date</h3>
                        <p className="text-[14px] text-gray-500 max-w-[340px] text-center mb-8 leading-relaxed relative z-10">
                            Chọn một danh mục bên trái để xem chi tiết hoặc tạo mới danh mục cần theo dõi.
                        </p>

                        {/* Action Button */}
                        <button
                            onClick={handleOpenCreateCategory}
                            className="h-10 px-6 rounded-full bg-violet-600 hover:bg-violet-700 text-white font-bold text-[13px] shadow-lg shadow-violet-200/50 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 relative z-10"
                        >
                            <span className="material-symbols-outlined text-[18px]">add</span>
                            Tạo Danh Mục Tồn Mới
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Header Box (Toolbar 1 - Settings & Info) */}
                        <div className="px-5 py-3 border-b border-gray-200 bg-white shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm z-20">
                            <div className="flex flex-col gap-2 w-full md:w-auto overflow-hidden">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-[18px] font-black text-gray-800 uppercase tracking-tight flex items-center gap-2">
                                        {selectedCat.name}
                                    </h2>
                                    <button onClick={handleOpenEditCategory} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                                        <span className="material-symbols-outlined text-[16px]">edit</span>
                                    </button>
                                    <div
                                        className={`flex items-center gap-1.5 px-3 py-1 rounded-[4px] text-[12px] font-bold cursor-pointer transition-all border ${selectedCat.is_active ? 'bg-[#f0fdf4] text-[#16a34a] border-[#bbf7d0] hover:bg-[#dcfce7]' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'}`}
                                        onClick={handleOpenEditCategory}
                                    >
                                        <div className={`w-2 h-2 rounded-full ${selectedCat.is_active ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'bg-gray-400'}`}></div>
                                        {selectedCat.is_active ? 'Hoạt Động' : 'Tạm Dừng'}
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        className="text-amber-800 flex items-center gap-1.5 font-bold bg-amber-50 px-2.5 py-1 rounded border border-amber-200 hover:bg-amber-100/80 text-[11px] transition-colors cursor-pointer group"
                                        onClick={handleOpenEditCategory}
                                    >
                                        <span className="material-symbols-outlined text-[14px] text-amber-600 group-hover:scale-110 transition-transform">warning</span>
                                        Cảnh báo trước: {selectedCat.near_expiry_days ?? 0} ngày
                                    </button>

                                    <button
                                        className="text-blue-800 flex items-center gap-1.5 font-bold bg-blue-50 px-2.5 py-1 rounded border border-blue-200 hover:bg-blue-100/80 text-[11px] transition-colors cursor-pointer group"
                                        onClick={handleOpenEditCategory}
                                    >
                                        <span className="material-symbols-outlined text-[14px] text-blue-600 group-hover:scale-110 transition-transform">history_toggle_off</span>
                                        NSX ngắn: {selectedCat.production_threshold ?? 0} ngày
                                    </button>

                                    <span className="text-violet-700 flex flex-shrink-0 items-center gap-1 font-bold bg-violet-50 px-2.5 py-1 rounded border border-violet-200 text-[11px] whitespace-nowrap">
                                        <span className="material-symbols-outlined text-[13px] text-violet-600">inventory_2</span>
                                        Tổng: {selectedItems.size} SP
                                    </span>

                                    <span className="text-gray-700 flex flex-shrink-0 items-center gap-1 font-bold bg-gray-50 px-2.5 py-1 rounded border border-gray-200 text-[11px] whitespace-nowrap">
                                        <span className="material-symbols-outlined text-[13px] text-gray-500">storefront</span>
                                        {selectedCat.stores && selectedCat.stores.length > 0 ? `Áp dụng: ${selectedCat.stores.length} CH` : 'Chưa gán cửa hàng'}
                                    </span>
                                </div>
                            </div>

                            <button
                                className="h-9 px-5 rounded-lg font-bold flex items-center justify-center gap-1.5 bg-[#ea580c] hover:bg-[#c2410c] text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-[12px] shadow-sm ml-auto md:ml-0"
                                onClick={handleSaveCatItems}
                                disabled={isSaving}
                            >
                                {isSaving ? <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span> : <span className="material-symbols-outlined text-[16px]">save</span>}
                                {isSaving ? 'Đang lưu...' : 'Lưu Danh Sách'}
                            </button>
                        </div>

                        {/* Toolbar 2 - Search & Actions (Minimal) */}
                        <div className="px-5 py-2.5 border-b border-gray-200 bg-white flex flex-wrap items-center justify-between gap-3 shrink-0 z-10 relative shadow-sm">
                            {/* Filter Box */}
                            <div className="relative w-full sm:w-80 shrink-0 group">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 text-[18px] group-focus-within:text-blue-500 transition-colors">search</span>
                                <input
                                    type="text"
                                    placeholder="Tìm Tên, Mã, Barcode..."
                                    className="w-full h-9 pl-9 pr-3 rounded-[4px] border border-gray-300 text-[13px] font-medium text-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder-gray-400 shadow-inner"
                                    value={searchQ}
                                    onChange={e => setSearchQ(e.target.value)}
                                />
                                {searchQ && (
                                    <button onClick={() => setSearchQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                                        <span className="material-symbols-outlined text-[14px]">close</span>
                                    </button>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 w-full sm:w-auto overflow-hidden">
                                <input type="file" ref={fileInputRef} onChange={handleExcelUpload} accept=".xlsx,.xls,.csv" hidden />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isImporting}
                                    className="h-9 px-4 rounded-[4px] border border-gray-300 bg-white text-gray-700 text-[13px] font-bold flex items-center justify-center gap-1.5 hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
                                >
                                    <span className="material-symbols-outlined text-[16px]">
                                        {isImporting ? 'sync' : 'upload'}
                                    </span>
                                    Import
                                </button>
                                <button
                                    onClick={() => setShowAddProductModal(true)}
                                    className="h-9 px-4 rounded-[4px] bg-[#3b82f6] text-white text-[13px] font-bold flex items-center justify-center gap-1.5 hover:bg-[#2563eb] transition-colors shadow-sm"
                                >
                                    <span className="material-symbols-outlined text-[16px]">add</span>
                                    Thêm SP
                                </button>
                            </div>
                        </div>

                        {/* Data Table */}
                        <div className="flex-1 overflow-auto bg-white scroll-smooth relative">
                            {selectedItems.size === 0 ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-gray-400">
                                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4 border-2 border-dashed border-gray-200">
                                        <span className="material-symbols-outlined text-[32px] text-gray-300">table_rows</span>
                                    </div>
                                    <h3 className="font-bold text-gray-600 text-base">Chưa có sản phẩm</h3>
                                    <p className="font-medium text-[13px] text-gray-400 mt-1 max-w-[280px] text-center leading-relaxed">Sử dụng thanh công cụ bên trên để thêm sản phẩm thủ công hoặc tải lên hàng loạt từ file Excel.</p>
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse whitespace-nowrap min-w-[800px]">
                                    <thead className="bg-[#FAF5FF] text-violet-900 sticky top-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                                        <tr>
                                            <th className="px-6 py-3.5 font-bold text-[11px] uppercase tracking-wider w-16">Hình</th>
                                            <th className="px-6 py-3.5 font-bold text-[11px] uppercase tracking-wider w-48">Mã SP / Barcode</th>
                                            <th className="px-6 py-3.5 font-bold text-[11px] uppercase tracking-wider">Tên Sản Phẩm</th>
                                            <th className="px-6 py-3.5 font-bold text-[11px] uppercase tracking-wider w-28 text-center">Trạng Thái</th>
                                            <th className="px-6 py-3.5 font-bold text-[11px] uppercase tracking-wider text-right w-24">Xóa</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100/60">
                                        {Array.from(selectedItems.values())
                                            .filter(p => !searchQ || (p.name || p.fullName)?.toLowerCase().includes(searchQ.toLowerCase()) || (p.barcode || p.code || p.sp)?.toLowerCase().includes(searchQ.toLowerCase()))
                                            .map((p, idx) => (
                                                <tr key={p.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-[#FAF5FF]/30'} hover:bg-violet-50/50 transition-colors group`}>
                                                    <td className="px-6 py-2.5">
                                                        <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center p-1 overflow-hidden shadow-sm group-hover:border-violet-300 transition-colors">
                                                            <img src={p.image_url || EMPTY_IMG} alt="" className="w-full h-full object-contain mix-blend-multiply" />
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-3.5">
                                                        <div className="font-mono text-[13px] font-semibold text-gray-600 bg-gray-100/80 px-2 py-0.5 rounded inline-block border border-gray-200/50">{p.sp || p.barcode || p.code}</div>
                                                    </td>
                                                    <td className="px-6 py-3.5 font-semibold text-gray-800 break-words whitespace-normal leading-tight">
                                                        {p.name || p.fullName}
                                                    </td>
                                                    <td className="px-6 py-3.5 text-center">
                                                        {p.isNew ? (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded border border-[#F97316]/20 bg-[#F97316]/10 text-[#F97316] text-[10px] font-bold tracking-widest uppercase">MỚI</span>
                                                        ) : (
                                                            <span className="text-gray-300 text-[12px] font-medium">-</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-3.5 text-right">
                                                        <button
                                                            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors ml-auto opacity-0 group-hover:opacity-100"
                                                            onClick={() => {
                                                                const next = new Map(selectedItems);
                                                                next.delete(p.id);
                                                                setSelectedItems(next);
                                                            }}
                                                            title="Xóa khỏi danh sách"
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">delete</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Hidden file input for Excel */}
            <input
                type="file"
                accept=".xlsx, .xls, .csv"
                style={{ display: 'none' }}
                id="excel-upload"
                onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setIsImporting(true);
                    try {
                        const XLSX = await import('xlsx');
                        const data = await file.arrayBuffer();
                        const workbook = XLSX.read(data);
                        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                        const rawJson = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

                        let added = 0;
                        setSelectedItems(prev => {
                            const next = new Map(prev);
                            rawJson.slice(1).forEach((row: any[]) => {
                                if (!row || !row.length) return;
                                const col1 = row[0]?.toString().trim();
                                const col2 = row[1]?.toString().trim();
                                const col3 = row[2]?.toString().trim();

                                const barcode = col1 || '';
                                const sp = col2 || '';
                                const name = col3 || '';

                                const finalCode = barcode || sp;
                                if (finalCode && name) {
                                    next.set(finalCode, { id: finalCode, barcode, sp, name, isNew: true });
                                    added++;
                                }
                            });
                            return next;
                        });

                        if (added > 0) toast.success(`Đã biên dịch thành công ${added} dòng sản phẩm!`);
                        else toast.warning('Không tìm thấy dữ liệu hợp lệ trong file');
                    } catch (err) {
                        toast.error('Lỗi khi đọc file Excel, vui lòng kiểm tra lại định dạng');
                    } finally {
                        setIsImporting(false);
                        if (e.target) e.target.value = '';
                    }
                }}
            />

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4 opacity-100 transition-opacity">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] scale-100 transition-transform">
                        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between text-gray-800 bg-gray-50/50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shadow-inner border border-violet-100/50">
                                    <span className="material-symbols-outlined text-violet-600 text-[22px]">tune</span>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">{selectedCat ? 'Chỉnh Sửa Danh Mục Kiểm' : 'Tạo Danh Mục Tồn Mới'}</h3>
                                    <p className="text-[13px] text-gray-500 font-medium">Cấu hình thông số và cửa hàng</p>
                                </div>
                            </div>
                            <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-200/50 rounded-full transition-colors">
                                <span className="material-symbols-outlined text-[20px]">close</span>
                            </button>
                        </div>
                        <div className="px-5 py-4 overflow-y-auto flex flex-col gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[13px] font-bold text-gray-700">Tên danh mục <span className="text-red-500">*</span></label>
                                <input
                                    className="w-full h-9 px-3 rounded border border-gray-300 text-[13px] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                    autoFocus
                                    value={editForm.name}
                                    onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Ví dụ: Sữa Tươi, Đồ Hộp..."
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[13px] font-bold text-gray-700">Mô tả / Ghi chú</label>
                                <textarea
                                    className="w-full px-3 py-2 rounded border border-gray-300 text-[13px] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all resize-none"
                                    rows={2}
                                    value={editForm.description}
                                    onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Nhập ghi chú thêm về khối hàng này..."
                                />
                            </div>

                            <div className="flex items-center justify-between bg-gray-50 px-4 py-2.5 rounded border border-gray-200">
                                <label className="text-[13px] font-bold text-gray-700">Trạng thái Bật/Tắt</label>
                                <div className="flex items-center gap-2">
                                    <span className={`text-[12px] font-medium ${editForm.is_active ? 'text-emerald-600' : 'text-gray-500'}`}>
                                        {editForm.is_active ? 'Đang hoạt động' : 'Tạm dừng'}
                                    </span>
                                    <div
                                        className={`w-10 h-5 rounded-full cursor-pointer relative transition-colors ${editForm.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`}
                                        onClick={() => setEditForm(prev => ({ ...prev, is_active: !prev.is_active }))}
                                    >
                                        <div className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow transform transition-transform ${editForm.is_active ? 'left-[22px]' : 'left-0.5'}`}></div>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[13px] font-bold text-gray-700">Ngưỡng cảnh báo</label>
                                    <div className="relative">
                                        <input
                                            className="w-full h-9 pl-3 pr-10 rounded border border-gray-300 text-[13px] font-medium focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
                                            type="number"
                                            value={editForm.near_expiry_days}
                                            onChange={e => setEditForm(prev => ({ ...prev, near_expiry_days: Number(e.target.value) }))}
                                            placeholder="30"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-gray-500">ngày</span>
                                    </div>
                                    <p className="text-[11px] text-gray-500 leading-tight">Báo khi SP còn X ngày tới HSD</p>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[13px] font-bold text-gray-700">Ngưỡng NSX (ngắn)</label>
                                    <div className="relative">
                                        <input
                                            className="w-full h-9 pl-3 pr-10 rounded border border-gray-300 text-[13px] font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                            type="number"
                                            value={editForm.production_threshold}
                                            onChange={e => setEditForm(prev => ({ ...prev, production_threshold: Number(e.target.value) }))}
                                            placeholder="7"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-gray-500">ngày</span>
                                    </div>
                                    <p className="text-[11px] text-gray-500 leading-tight">Báo nếu NSX cách HT quá X ngày</p>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[13px] font-bold text-gray-700">Cửa hàng áp dụng</label>
                                <div className="border border-gray-300 rounded overflow-hidden">
                                    <MultiStoreSelect
                                        stores={storesList}
                                        selectedStoreIds={editForm.stores}
                                        onChange={(selected) => setEditForm(prev => ({ ...prev, stores: selected }))}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50/50">
                            <button className="h-9 px-4 rounded font-semibold text-gray-600 hover:bg-gray-200 transition-colors text-[13px]" onClick={() => setShowModal(false)}>Hủy</button>
                            <button
                                className="h-9 px-5 rounded font-bold bg-[#3b82f6] hover:bg-[#2563eb] text-white shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 text-[13px]"
                                onClick={handleSaveCategory}
                                disabled={!editForm.name.trim()}
                            >
                                <span className="material-symbols-outlined text-[16px]">check</span>
                                Lưu Cấu Hình
                            </button>
                        </div>
                    </div>
                </div>
            )
            }

            {
                showImportModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4 opacity-100 transition-opacity">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col scale-100 transition-transform">
                            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between text-gray-800 bg-gray-50/50">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shadow-inner border border-orange-100/50">
                                        <span className="material-symbols-outlined text-orange-600 text-[22px]">content_paste</span>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900">Dán Danh Sách Mã</h3>
                                        <p className="text-[13px] text-gray-500 font-medium">Nhập mã vạch sản phẩm (mỗi mã 1 dòng)</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowImportModal(false)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-200/50 rounded-full transition-colors">
                                    <span className="material-symbols-outlined text-[20px]">close</span>
                                </button>
                            </div>
                            <div className="p-6 flex flex-col gap-3">
                                <p className="text-[13px] text-gray-600 leading-relaxed">Sẽ được thêm trực tiếp vào danh mục <strong className="text-gray-800">{selectedCat?.name}</strong>.</p>
                                <textarea
                                    className="w-full h-48 rounded-xl border border-gray-200 p-4 text-[13px] font-mono focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all placeholder-gray-300 shadow-inner"
                                    value={importText}
                                    onChange={e => setImportText(e.target.value)}
                                    placeholder="893123456789\n893987654321..."
                                    autoFocus
                                ></textarea>
                                <div className="flex items-center gap-2 text-[12px] text-gray-500 bg-gray-50 p-2 rounded-lg mt-1 border border-gray-100">
                                    <span className="material-symbols-outlined text-[16px] text-amber-500">info</span>
                                    Các mã không có trong hệ thống sẽ được báo cáo.
                                </div>
                            </div>
                            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50/50">
                                <button className="h-10 px-5 rounded-xl font-semibold text-gray-600 hover:bg-gray-100 transition-colors" onClick={() => setShowImportModal(false)}>Đóng</button>
                                <button
                                    className="h-10 px-6 rounded-xl font-bold bg-[#ea580c] hover:bg-[#c2410c] text-white shadow-md shadow-orange-200/50 transition-all flex items-center gap-2 disabled:opacity-50"
                                    onClick={handleImportBarcodes}
                                    disabled={!importText.trim() || isImporting}
                                >
                                    {isImporting && <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>}
                                    {isImporting ? 'Đang Xử Lý...' : 'Thêm Vào Danh Mục'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {showAddProductModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4 opacity-100 transition-opacity">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col scale-100 transition-transform">
                        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between text-gray-800 bg-gray-50/50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shadow-inner border border-blue-100/50">
                                    <span className="material-symbols-outlined text-blue-600 text-[22px]">add_box</span>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">Thêm Sản Phẩm</h3>
                                    <p className="text-[13px] text-gray-500 font-medium">Bổ sung vào danh sách</p>
                                </div>
                            </div>
                            <button onClick={() => setShowAddProductModal(false)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-200/50 rounded-full transition-colors">
                                <span className="material-symbols-outlined text-[20px]">close</span>
                            </button>
                        </div>
                        <div className="p-6 flex flex-col gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[13px] font-bold text-gray-700">Mã Vạch / Mã SP <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 text-[16px]">qr_code</span>
                                    <input
                                        className="w-full h-10 pl-9 pr-3 rounded border border-gray-300 text-[13px] font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder-gray-400"
                                        value={addCode}
                                        onChange={e => setAddCode(e.target.value)}
                                        placeholder="Nhập mã sản phẩm..."
                                        autoFocus
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[13px] font-bold text-gray-700">Tên Sản Phẩm <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 text-[16px]">inventory</span>
                                    <input
                                        className="w-full h-10 pl-9 pr-3 rounded border border-gray-300 text-[13px] font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder-gray-400"
                                        value={addText}
                                        onChange={e => setAddText(e.target.value)}
                                        placeholder="Nhập tên sản phẩm..."
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const code = addCode.trim();
                                                const name = addText.trim();
                                                if (!code || !name) {
                                                    toast.warning('Vui lòng nhập đủ thông tin!');
                                                    return;
                                                }
                                                const next = new Map(selectedItems);
                                                next.set(code, { id: code, barcode: code, sp: code, name: name, isNew: true });
                                                setSelectedItems(next);
                                                setAddCode('');
                                                setAddText('');
                                                setShowAddProductModal(false);
                                                toast.success('Đã thêm sản phẩm tạm vào danh sách');
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50/50">
                            <button onClick={() => setShowAddProductModal(false)} className="h-10 px-5 rounded-xl font-semibold text-gray-600 hover:bg-gray-100 transition-colors">Đóng</button>
                            <button
                                className="h-10 px-6 rounded-xl font-bold bg-[#3b82f6] hover:bg-[#2563eb] text-white shadow-md shadow-blue-200/50 transition-all disabled:opacity-50 flex items-center gap-2"
                                disabled={!addCode.trim() || !addText.trim()}
                                onClick={() => {
                                    const code = addCode.trim();
                                    const name = addText.trim();
                                    if (!code || !name) {
                                        toast.warning('Vui lòng nhập đủ thông tin!');
                                        return;
                                    }
                                    const next = new Map(selectedItems);
                                    next.set(code, { id: code, barcode: code, sp: code, name: name, isNew: true });
                                    setSelectedItems(next);
                                    setAddCode('');
                                    setAddText('');
                                    setShowAddProductModal(false);
                                    toast.success('Đã thêm sản phẩm tạm vào danh sách');
                                }}
                            >
                                <span className="material-symbols-outlined text-[18px]">check</span>
                                Thêm SP
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default ExpiryCheckAdmin;
