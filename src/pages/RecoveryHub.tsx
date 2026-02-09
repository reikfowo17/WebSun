import React, { useState, useEffect } from 'react';
import { RecoveryService, RecoveryItem } from '../services';
import { useToast } from '../contexts';

const RecoveryHub: React.FC = () => {
    const toast = useToast();
    const [activeTab, setActiveTab] = useState<'SCAN' | 'MANAGE'>('SCAN');

    // Scan State
    const [scanStore, setScanStore] = useState('BEE');
    const [scanMonth, setScanMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [scannedItems, setScannedItems] = useState<any[]>([]);
    const [scanning, setScanning] = useState(false);
    const [scanError, setScanError] = useState('');

    // Manage State
    const [recoveryItems, setRecoveryItems] = useState<RecoveryItem[]>([]);
    const [filterStore, setFilterStore] = useState('ALL');
    const [loading, setLoading] = useState(false);

    // Initial Load
    useEffect(() => {
        if (activeTab === 'MANAGE') {
            loadRecoveryItems();
        }
    }, [activeTab, filterStore]);

    const handleScan = async () => {
        setScanning(true);
        setScanError('');
        try {
            const res = await RecoveryService.scanForDiscrepancies(scanStore, scanMonth);
            if (res.success) {
                setScannedItems(res.items);
            } else {
                setScanError('Không tìm thấy dữ liệu hoặc có lỗi xảy ra.');
            }
        } catch (e) {
            setScanError('Lỗi kết nối.');
        } finally {
            setScanning(false);
        }
    };

    const handleCreateRecovery = async () => {
        if (scannedItems.length === 0) return;
        if (!confirm(`Xác nhận tạo ${scannedItems.length} phiếu truy thu?`)) return;

        setScanning(true);
        try {
            const res = await RecoveryService.createRecoveryItems(scanStore, scannedItems);
            if (res.success) {
                toast.success(res.message);
                setScannedItems([]);
                setActiveTab('MANAGE');
            } else {
                toast.error(res.message || 'Lỗi khi tạo phiếu');
            }
        } catch (e) {
            toast.error('Lỗi kết nối');
        } finally {
            setScanning(false);
        }
    };

    const loadRecoveryItems = async () => {
        setLoading(true);
        try {
            const res = await RecoveryService.getRecoveryItems(filterStore);
            if (res.success) {
                setRecoveryItems(res.items);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleStatusUpdate = async (id: string, newStatus: string) => {
        const item = recoveryItems.find(i => i.id === id);
        if (!item) return;

        // Optimistic update
        setRecoveryItems(prev => prev.map(i => i.id === id ? { ...i, status: newStatus } : i));

        await RecoveryService.updateRecoveryItem(id, { status: newStatus });
    };

    return (
        <div className="bg-gray-50 min-h-full">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-8 py-6">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-black text-secondary mb-1">Truy Thu & Xử Lý</h1>
                        <p className="text-gray-500 text-sm">Quản lý chênh lệch hàng hóa và quy trình bồi hoàn</p>
                    </div>
                    <div className="flex gap-2">
                        <button className="btn btn-secondary text-gray-500 bg-gray-100 hover:bg-gray-200 border-none shadow-none">
                            <span className="material-symbols-outlined">description</span>
                            Xuất Excel
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-8 border-b border-gray-200 -mb-6">
                    <button
                        onClick={() => setActiveTab('SCAN')}
                        className={`pb-4 flex items-center gap-2 font-bold text-sm transition-colors border-b-2 ${activeTab === 'SCAN' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-600'
                            }`}
                    >
                        <span className="material-symbols-outlined">radar</span>
                        Quét & Lập Phiếu
                    </button>
                    <button
                        onClick={() => setActiveTab('MANAGE')}
                        className={`pb-4 flex items-center gap-2 font-bold text-sm transition-colors border-b-2 ${activeTab === 'MANAGE' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-600'
                            }`}
                    >
                        <span className="material-symbols-outlined">assignment</span>
                        Quản Lý Phiếu
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="p-8">
                {activeTab === 'SCAN' && (
                    <div className="space-y-6">
                        {/* Scan Controls */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                            <h3 className="text-lg font-bold text-gray-800 mb-4">Quét Chênh Lệch Tồn Kho</h3>
                            <div className="flex gap-4 items-end">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cửa hàng</label>
                                    <select
                                        className="input bg-gray-50"
                                        value={scanStore}
                                        onChange={e => setScanStore(e.target.value)}
                                    >
                                        <option value="BEE">SM BEE</option>
                                        <option value="PLAZA">SM PLAZA</option>
                                        <option value="MIỀN ĐÔNG">SM MIỀN ĐÔNG</option>
                                        <option value="HT PEARL">SM HT PEARL</option>
                                        <option value="GREEN TOPAZ">SM GREEN TOPAZ</option>
                                        <option value="EMERALD">SM EMERALD</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tháng Kiểm Kê</label>
                                    <input
                                        type="month"
                                        className="input bg-gray-50"
                                        value={scanMonth}
                                        onChange={e => setScanMonth(e.target.value)}
                                    />
                                </div>
                                <button
                                    onClick={handleScan}
                                    disabled={scanning}
                                    className="btn btn-primary h-[42px]"
                                >
                                    {scanning ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : <span className="material-symbols-outlined">search</span>}
                                    Quét Dữ Liệu
                                </button>
                            </div>
                            {scanError && <p className="text-red-500 mt-2 text-sm">{scanError}</p>}
                        </div>

                        {/* Scan Results */}
                        {scannedItems.length > 0 && (
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                                    <h3 className="font-bold text-gray-800">
                                        Tìm thấy <span className="text-red-500">{scannedItems.length}</span> mục lệch kho
                                    </h3>
                                    <button
                                        onClick={handleCreateRecovery}
                                        className="btn bg-red-500 hover:bg-red-600 text-white border-red-600 shadow-red-200"
                                    >
                                        Tạo Phiếu Truy Thu
                                    </button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase">
                                            <tr>
                                                <th className="p-4">Ngày</th>
                                                <th className="p-4">Sản Phẩm</th>
                                                <th className="p-4 text-center">SL Thiếu</th>
                                                <th className="p-4 text-right">Đơn Giá (est)</th>
                                                <th className="p-4 text-right">Thành Tiền</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {scannedItems.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50">
                                                    <td className="p-4 text-gray-600 text-sm font-mono">{item.check_date}</td>
                                                    <td className="p-4">
                                                        <div className="font-bold text-gray-800">{item.product_name || 'Unknown'}</div>
                                                        <div className="text-xs text-gray-400 font-mono">{item.barcode}</div>
                                                    </td>
                                                    <td className="p-4 text-center font-bold text-red-500">-{item.missing_qty}</td>
                                                    <td className="p-4 text-right text-sm">
                                                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.unit_price)}
                                                    </td>
                                                    <td className="p-4 text-right font-bold text-gray-800">
                                                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.total_amount)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'MANAGE' && (
                    <div className="space-y-6">
                        {/* Filter */}
                        <div className="flex gap-4">
                            <select
                                className="input w-48 bg-white"
                                value={filterStore}
                                onChange={e => setFilterStore(e.target.value)}
                            >
                                <option value="ALL">Tất cả cửa hàng</option>
                                <option value="BEE">SM BEE</option>
                                <option value="PLAZA">SM PLAZA</option>
                                <option value="MIỀN ĐÔNG">SM MIỀN ĐÔNG</option>
                            </select>
                        </div>

                        {/* List */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase">
                                    <tr>
                                        <th className="p-4">Ngày / Cửa hàng</th>
                                        <th className="p-4">Sản Phẩm</th>
                                        <th className="p-4 text-center">SL Thiếu</th>
                                        <th className="p-4 text-right">Tổng Tiền</th>
                                        <th className="p-4">Trạng Thái</th>
                                        <th className="p-4 text-right">Thao Tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {loading ? (
                                        <tr><td colSpan={6} className="p-8 text-center text-gray-500">Đang tải...</td></tr>
                                    ) : recoveryItems.length === 0 ? (
                                        <tr><td colSpan={6} className="p-8 text-center text-gray-500">Không có dữ liệu</td></tr>
                                    ) : (
                                        recoveryItems.map(item => (
                                            <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="p-4">
                                                    <div className="text-sm font-bold text-gray-600">{item.check_date}</div>
                                                    <div className="text-xs text-gray-400 font-bold">{item.store_name}</div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="font-bold text-gray-800">{item.product_name}</div>
                                                    <div className="text-xs text-gray-400 font-mono">{item.barcode}</div>
                                                </td>
                                                <td className="p-4 text-center font-mono font-bold text-red-500">-{item.missing_qty}</td>
                                                <td className="p-4 text-right font-bold text-gray-800">
                                                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.total_amount || (item.missing_qty * item.unit_price))}
                                                </td>
                                                <td className="p-4">
                                                    <span className={`inline-flex px-2 py-1 rounded text-xs font-bold border ${item.status === 'ĐÃ XỬ LÝ' ? 'bg-green-100 text-green-700 border-green-200' :
                                                        item.status === 'BỎ QUA' ? 'bg-gray-100 text-gray-700 border-gray-200' :
                                                            'bg-red-100 text-red-700 border-red-200'
                                                        }`}>
                                                        {item.status}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right space-x-2">
                                                    {item.status === 'TRUY THU' && (
                                                        <>
                                                            <button
                                                                onClick={() => handleStatusUpdate(item.id, 'ĐÃ XỬ LÝ')}
                                                                className="text-green-600 hover:bg-green-50 p-1 rounded" title="Xác nhận đã xử lý"
                                                            >
                                                                <span className="material-symbols-outlined text-lg">check_circle</span>
                                                            </button>
                                                            <button
                                                                onClick={() => handleStatusUpdate(item.id, 'BỎ QUA')}
                                                                className="text-gray-400 hover:bg-gray-100 p-1 rounded" title="Bỏ qua"
                                                            >
                                                                <span className="material-symbols-outlined text-lg">cancel</span>
                                                            </button>
                                                        </>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RecoveryHub;
