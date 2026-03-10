import React, { useState, useEffect } from 'react';
import ExpiryCheckService, { ExpiryCheckCategory } from '../../services/expiryCheck';
import { InventoryService } from '../../services';
import { SystemService } from '../../services/system';
import { MultiStoreSelect } from '../../components/MultiStoreSelect';
import { useToast } from '../../contexts';

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
        name: '', description: '', near_expiry_days: 30, production_threshold: 0, stores: [] as string[]
    });

    // Import modal
    const [showImportModal, setShowImportModal] = useState(false);
    const [importText, setImportText] = useState('');
    const [isImporting, setIsImporting] = useState(false);

    // Manual add
    const [addCode, setAddCode] = useState('');
    const [addText, setAddText] = useState('');

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
                stores: editForm.stores ?? []
            });
        } else {
            res = await ExpiryCheckService.createCategory({
                name: editForm.name,
                description: editForm.description,
                near_expiry_days: editForm.near_expiry_days,
                production_threshold: editForm.production_threshold,
                stores: editForm.stores
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
        setEditForm({ name: '', description: '', near_expiry_days: 30, production_threshold: 0, stores: [] });
        setShowModal(true);
    };

    const handleOpenEditCategory = () => {
        if (!selectedCat) return;
        setEditForm({
            name: selectedCat.name,
            description: selectedCat.description || '',
            near_expiry_days: selectedCat.near_expiry_days ?? 30,
            production_threshold: selectedCat.production_threshold ?? 0,
            stores: selectedCat.stores ?? []
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
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50">
                        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 mb-6 group-hover:scale-105 transition-transform">
                            <span className="material-symbols-outlined text-[48px] text-violet-200">inventory_2</span>
                        </div>
                        <h3 className="text-lg font-bold text-gray-700">Chưa chọn danh mục</h3>
                        <p className="font-medium text-gray-500 mt-2">Chọn một danh mục bên trái hoặc tạo mới để bắt đầu cấu hình.</p>
                    </div>
                ) : (
                    <>
                        {/* Header Box */}
                        <div className="px-6 py-5 border-b border-violet-50 bg-white shrink-0 flex flex-col gap-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex flex-col gap-1 min-w-0">
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-2xl font-bold text-gray-900 truncate leading-tight">{selectedCat.name}</h2>
                                        <button onClick={handleOpenEditCategory} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-50 hover:bg-violet-100 text-gray-400 hover:text-violet-600 transition-colors shrink-0" title="Chỉnh sửa danh mục">
                                            <span className="material-symbols-outlined text-[16px]">edit</span>
                                        </button>
                                    </div>
                                    {selectedCat.description && <p className="text-[13px] text-gray-500 line-clamp-1">{selectedCat.description}</p>}
                                </div>

                                <button
                                    className="h-10 px-6 rounded-xl font-bold flex items-center gap-2 bg-[#F97316] hover:bg-[#ea580c] shadow-md shadow-[#F97316]/20 text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm shrink-0"
                                    onClick={handleSaveCatItems}
                                    disabled={isSaving}
                                >
                                    {isSaving ? <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> : <span className="material-symbols-outlined text-[18px]">save</span>}
                                    {isSaving ? 'Đang lưu...' : 'Lưu Danh Sách'}
                                </button>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 mt-1">
                                <div
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-bold cursor-pointer transition-colors border ${selectedCat.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}
                                    onClick={handleToggleActive}
                                >
                                    <div className={`w-2 h-2 rounded-full ${selectedCat.is_active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-gray-400'}`}></div>
                                    {selectedCat.is_active ? 'Trạng thái: Hoạt Động' : 'Trạng thái: Tạm Dừng'}
                                </div>

                                <span className="text-amber-700 flex items-center gap-1 font-semibold bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100 text-[12px]">
                                    <span className="material-symbols-outlined text-[14px]">warning</span>
                                    Cảnh báo trước: {selectedCat.near_expiry_days} ngày
                                </span>

                                <span className="text-blue-700 flex items-center gap-1 font-semibold bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 text-[12px]">
                                    <span className="material-symbols-outlined text-[14px]">history_toggle_off</span>
                                    NSX ngắn: {selectedCat.production_threshold} ngày
                                </span>

                                <span className="text-violet-700 font-bold bg-violet-50 px-3 py-1.5 rounded-lg border border-violet-100 text-[12px] ml-auto">
                                    Tổng: {selectedItems.size} SP
                                </span>
                            </div>
                        </div>

                        {/* Toolbar: Search & Add */}
                        <div className="px-6 py-3 border-b border-gray-100 bg-gray-50/50 flex flex-wrap items-center justify-between gap-4 shrink-0">
                            {/* Search Box */}
                            <div className="relative w-full max-w-xs shrink-0 group">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 text-[18px] group-focus-within:text-violet-500 transition-colors">search</span>
                                <input
                                    type="text"
                                    placeholder="Tìm Tên, Mã SP, Barcode..."
                                    className="w-full h-10 pl-10 pr-4 rounded-xl border border-gray-200 text-[13px] font-medium text-gray-800 focus:border-violet-500 focus:ring-2 focus:ring-violet-100 outline-none transition-all bg-white shadow-sm"
                                    value={searchQ}
                                    onChange={e => setSearchQ(e.target.value)}
                                />
                            </div>

                            {/* Action Tools */}
                            <div className="flex items-center gap-3 w-full sm:w-auto overflow-hidden">
                                {/* Inline Manual Add Form */}
                                <div className="flex items-center bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-violet-100 focus-within:border-violet-500 transition-all">
                                    <div className="relative border-r border-gray-100">
                                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-300 text-[16px]">qr_code_scanner</span>
                                        <input
                                            type="text"
                                            placeholder="Mã Vạch/SP"
                                            className="h-10 w-28 sm:w-32 pl-8 pr-2 text-[12px] font-mono outline-none bg-transparent"
                                            value={addCode} onChange={e => setAddCode(e.target.value)}
                                        />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Tên sản phẩm..."
                                        className="h-10 w-32 sm:w-48 px-3 text-[12px] font-medium outline-none bg-transparent"
                                        value={addText} onChange={e => setAddText(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                const code = addCode.trim();
                                                const name = addText.trim();
                                                if (!code || !name) {
                                                    toast.warning('Vui lòng nhập đủ mã và tên sản phẩm');
                                                    return;
                                                }
                                                const next = new Map(selectedItems);
                                                next.set(code, { id: code, barcode: code, sp: code, name: name, isNew: true });
                                                setSelectedItems(next);
                                                setAddCode('');
                                                setAddText('');
                                                toast.success('Đã thêm sản phẩm tạm vào danh sách');
                                            }
                                        }}
                                    />
                                    <button
                                        className="h-10 px-4 flex items-center gap-1.5 bg-[#4C1D95] hover:bg-[#5b21b6] text-white text-[13px] font-bold transition-colors"
                                        onClick={() => {
                                            const code = addCode.trim();
                                            const name = addText.trim();
                                            if (!code || !name) {
                                                toast.warning('Vui lòng nhập đủ mã và tên sản phẩm');
                                                return;
                                            }
                                            const next = new Map(selectedItems);
                                            next.set(code, { id: code, barcode: code, sp: code, name: name, isNew: true });
                                            setSelectedItems(next);
                                            setAddCode('');
                                            setAddText('');
                                            toast.success('Đã thêm sản phẩm tạm vào danh sách');
                                        }}
                                    >
                                        <span className="material-symbols-outlined text-[16px]">add</span>
                                        Thêm
                                    </button>
                                </div>

                                {/* Excel/Paste Actions */}
                                <div className="flex items-center bg-white rounded-xl border border-gray-200 shadow-sm p-1 shrink-0">
                                    <button
                                        className="h-8 px-3 flex items-center gap-1.5 hover:bg-emerald-50 text-gray-700 hover:text-emerald-700 text-[12px] font-bold rounded-lg transition-colors group"
                                        title="Tải lên file Excel"
                                        onClick={() => document.getElementById('excel-upload')?.click()}
                                    >
                                        {isImporting ? <span className="material-symbols-outlined text-[16px] text-emerald-500 animate-spin">progress_activity</span>
                                            : <span className="material-symbols-outlined text-[16px] text-emerald-600 group-hover:-translate-y-0.5 transition-transform duration-200">upload_file</span>}
                                        Excel
                                    </button>
                                    <div className="w-px h-4 bg-gray-200 mx-1"></div>
                                    <button
                                        className="h-8 px-3 flex items-center gap-1.5 hover:bg-blue-50 text-gray-700 hover:text-blue-700 text-[12px] font-bold rounded-lg transition-colors group"
                                        title="Dán nhanh danh sách Code"
                                        onClick={() => setShowImportModal(true)}
                                    >
                                        <span className="material-symbols-outlined text-[16px] text-blue-500 group-hover:scale-110 transition-transform duration-200">content_paste</span>
                                        Dán Danh Sách
                                    </button>
                                    <div className="w-px h-4 bg-gray-200 mx-1"></div>
                                    <button
                                        className="h-8 px-2 flex items-center hover:bg-gray-100 text-gray-500 hover:text-gray-800 rounded-lg transition-colors"
                                        title="Tải Template Excel"
                                        onClick={() => {
                                            import('xlsx').then(XLSX => {
                                                const ws = XLSX.utils.json_to_sheet([{ 'Mã barcode': '', 'Mã hàng SP': '', 'Tên sản phẩm': '' }]);
                                                const wb = XLSX.utils.book_new();
                                                XLSX.utils.book_append_sheet(wb, ws, "Template");
                                                XLSX.writeFile(wb, "Template_Import_SP.xlsx");
                                            });
                                        }}
                                    >
                                        <span className="material-symbols-outlined text-[18px]">download</span>
                                    </button>
                                </div>
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <h3 className="text-lg font-bold text-gray-800">{selectedCat ? 'Chỉnh Sửa Danh Mục Kiểm' : 'Tạo Danh Mục Kiểm Mới'}</h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto flex flex-col gap-5">
                            <div className="flex flex-col gap-2">
                                <label className="text-[13px] font-bold text-gray-700">Tên danh mục <span className="text-red-500">*</span></label>
                                <input
                                    className="w-full h-10 px-3 rounded-xl border border-gray-200 text-[14px] focus:border-violet-500 focus:ring-2 focus:ring-violet-100 outline-none transition-all"
                                    autoFocus
                                    value={editForm.name}
                                    onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Ví dụ: Sữa Tươi, Đồ Hộp..."
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-[13px] font-bold text-gray-700">Mô tả / Ghi chú</label>
                                <textarea
                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[14px] focus:border-violet-500 focus:ring-2 focus:ring-violet-100 outline-none transition-all resize-none"
                                    rows={2}
                                    value={editForm.description}
                                    onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Nhập ghi chú thêm về khối hàng này..."
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-2">
                                    <label className="text-[13px] font-bold text-gray-700">Ngưỡng cảnh báo (ngày)</label>
                                    <div className="relative">
                                        <input
                                            className="w-full h-10 pl-3 pr-8 rounded-xl border border-amber-200 bg-amber-50/30 text-[14px] font-medium focus:border-amber-500 focus:ring-2 focus:ring-amber-100 outline-none transition-all"
                                            type="number"
                                            value={editForm.near_expiry_days}
                                            onChange={e => setEditForm(prev => ({ ...prev, near_expiry_days: Number(e.target.value) }))}
                                            placeholder="30"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-gray-400 font-medium">ngày</span>
                                    </div>
                                    <p className="text-[11px] text-gray-500 leading-tight">Cảnh báo khi SP còn X ngày tới hạn HSD</p>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-[13px] font-bold text-gray-700">Ngưỡng NSX (ngắn ngày)</label>
                                    <div className="relative">
                                        <input
                                            className="w-full h-10 pl-3 pr-8 rounded-xl border border-blue-200 bg-blue-50/30 text-[14px] font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                                            type="number"
                                            value={editForm.production_threshold}
                                            onChange={e => setEditForm(prev => ({ ...prev, production_threshold: Number(e.target.value) }))}
                                            placeholder="7"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-gray-400 font-medium">ngày</span>
                                    </div>
                                    <p className="text-[11px] text-gray-500 leading-tight">Cảnh báo nếu NSX cách hiện tại quá X ngày</p>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-[13px] font-bold text-gray-700">Cửa hàng áp dụng</label>
                                <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                    <MultiStoreSelect
                                        stores={storesList}
                                        selectedStoreIds={editForm.stores}
                                        onChange={(selected) => setEditForm(prev => ({ ...prev, stores: selected }))}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50/50">
                            <button className="h-10 px-5 rounded-xl font-semibold text-gray-600 hover:bg-gray-100 transition-colors" onClick={() => setShowModal(false)}>Hủy</button>
                            <button
                                className="h-10 px-6 rounded-xl font-bold bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={handleSaveCategory}
                                disabled={!editForm.name.trim()}
                            >
                                Lưu Thay Đổi
                            </button>
                        </div>
                    </div>
                </div>
            )
            }

            {
                showImportModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-blue-50/50">
                                <div className="flex items-center gap-2 text-blue-800">
                                    <span className="material-symbols-outlined text-[20px]">content_paste</span>
                                    <h3 className="text-lg font-bold">Dán Nhanh Danh Sách Mã</h3>
                                </div>
                                <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                            <div className="p-6 flex flex-col gap-3">
                                <p className="text-[13px] text-gray-600 leading-relaxed">Nhập mã vạch sản phẩm (mỗi mã 1 dòng) để thêm nhanh vào danh mục <strong className="text-gray-800">{selectedCat?.name}</strong>.</p>
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
                                    className="h-10 px-6 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200 transition-all flex items-center gap-2 disabled:opacity-50"
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
        </div >
    );
};

export default ExpiryCheckAdmin;
