import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { runBackend, InventoryService } from '../services/api';

interface InventoryHQProps {
    user: User;
}

const InventoryHQ: React.FC<InventoryHQProps> = ({ user }) => {
    const [activeTab, setActiveTab] = useState<'MASTER' | 'CONSOLIDATED' | 'SETTINGS'>('MASTER');
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    // New Item Form State
    const [showAddModal, setShowAddModal] = useState(false);
    const [newItem, setNewItem] = useState({
        barcode: '',
        name: '',
        unit: '',
        category: ''
    });

    useEffect(() => {
        if (activeTab === 'MASTER') {
            loadMasterItems();
        }
    }, [activeTab]);

    const loadMasterItems = async () => {
        setLoading(true);
        try {
            const res = await InventoryService.getMasterItems();
            if (res.success) {
                setItems(res.items);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItem.barcode || !newItem.name) return;

        try {
            const res = await InventoryService.addMasterItem(newItem);
            if (res.success) {
                setShowAddModal(false);
                setNewItem({ barcode: '', name: '', unit: '', category: '' });
                loadMasterItems();
            } else {
                alert(res.error || 'Lỗi thêm sản phẩm');
            }
        } catch (error) {
            console.error(error);
        }
    };

    const filteredItems = items.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.barcode.includes(searchTerm)
    );

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-black text-secondary">Thiết Lập Kiểm Tồn</h1>
                    <p className="text-gray-500 text-sm">Quản lý danh mục hàng hóa và phân bổ ca kiểm</p>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'MASTER' ? 'bg-white shadow-sm text-primary-dark' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('MASTER')}
                    >
                        Sản Phẩm Master
                    </button>
                    <button
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'CONSOLIDATED' ? 'bg-white shadow-sm text-primary-dark' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('CONSOLIDATED')}
                    >
                        Tổng Hợp & Phân Bổ
                    </button>
                    <button
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'SETTINGS' ? 'bg-white shadow-sm text-primary-dark' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('SETTINGS')}
                    >
                        Cài Đặt
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                {activeTab === 'MASTER' && (
                    <>
                        <div className="p-4 border-b border-gray-100 flex gap-4">
                            <div className="flex-1 relative">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                                <input
                                    type="text"
                                    placeholder="Tìm kiếm sản phẩm..."
                                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-primary font-medium"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="btn btn-primary"
                            >
                                <span className="material-symbols-outlined">add</span>
                                Thêm Mới
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50 sticky top-0 z-10">
                                    <tr>
                                        <th className="p-4 text-xs font-bold text-gray-500 uppercase">Barcode</th>
                                        <th className="p-4 text-xs font-bold text-gray-500 uppercase">Tên Sản Phẩm</th>
                                        <th className="p-4 text-xs font-bold text-gray-500 uppercase">Đơn vị</th>
                                        <th className="p-4 text-xs font-bold text-gray-500 uppercase">Ngành hàng</th>
                                        <th className="p-4 text-xs font-bold text-gray-500 uppercase text-right">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={5} className="p-8 text-center text-gray-500">Đang tải dữ liệu...</td>
                                        </tr>
                                    ) : filteredItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="p-8 text-center text-gray-500">Chưa có sản phẩm nào</td>
                                        </tr>
                                    ) : (
                                        filteredItems.map((item) => (
                                            <tr key={item.id} className="hover:bg-yellow-50/50 transition-colors">
                                                <td className="p-4 font-mono text-sm text-gray-600">{item.barcode}</td>
                                                <td className="p-4 font-bold text-gray-800">{item.name}</td>
                                                <td className="p-4 text-sm text-gray-600">{item.unit || '-'}</td>
                                                <td className="p-4 text-sm text-gray-600">{item.category || '-'}</td>
                                                <td className="p-4 text-right">
                                                    <button className="text-gray-400 hover:text-primary-dark transition-colors">
                                                        <span className="material-symbols-outlined text-lg">edit</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {activeTab === 'CONSOLIDATED' && (
                    <div className="p-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Distribution Card */}
                            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                                        <span className="material-symbols-outlined">send</span>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg text-secondary">Phân Bổ Kế Hoạch</h3>
                                        <p className="text-sm text-gray-500">Tạo danh sách kiểm kê cho cửa hàng</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cửa hàng</label>
                                        <select id="dist-store" className="input bg-white">
                                            <option value="BEE">SM BEE</option>
                                            <option value="PLAZA">SM PLAZA</option>
                                            <option value="MIỀN ĐÔNG">SM MIỀN ĐÔNG</option>
                                            <option value="HT PEARL">SM HT PEARL</option>
                                            <option value="GREEN TOPAZ">SM GREEN TOPAZ</option>
                                            <option value="EMERALD">SM EMERALD</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ca Làm Việc</label>
                                        <div className="flex bg-gray-100 p-1 rounded-xl">
                                            {[1, 2, 3].map(s => (
                                                <label key={s} className="flex-1 cursor-pointer">
                                                    <input type="radio" name="shift" value={s} defaultChecked={s === 1} className="peer sr-only" />
                                                    <div className="py-2 text-center rounded-lg text-sm font-bold text-gray-500 peer-checked:bg-white peer-checked:text-primary-dark peer-checked:shadow-sm transition-all hover:bg-gray-200/50">
                                                        Ca {s}
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <button
                                        onClick={async () => {
                                            const store = (document.getElementById('dist-store') as HTMLSelectElement).value;
                                            const radio = document.querySelector('input[name="shift"]:checked') as HTMLInputElement;
                                            const shift = radio ? parseInt(radio.value) : 1;

                                            if (!confirm(`Xác nhận phân bổ danh sách tới ${store} (Ca ${shift})?`)) return;

                                            setLoading(true);
                                            try {
                                                const res = await InventoryService.distributeToStore(store, shift);
                                                alert(res.message || 'Thành công');
                                            } catch (e) {
                                                console.error(e);
                                                alert('Lỗi');
                                            } finally {
                                                setLoading(false);
                                            }
                                        }}
                                        disabled={loading}
                                        className="w-full btn btn-primary mt-2"
                                    >
                                        {loading ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : 'Phân Bổ Ngay'}
                                    </button>
                                </div>
                            </div>

                            {/* Status Card */}
                            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm opacity-60">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-green-600">
                                        <span className="material-symbols-outlined">sync</span>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg text-secondary">Đồng Bộ & Tổng Hợp</h3>
                                        <p className="text-sm text-gray-500">Tự động tổng hợp dữ liệu từ các chi nhánh</p>
                                    </div>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-xl text-center text-gray-400 text-sm">
                                    Tính năng đang được phát triển
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-fade-in">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold">Thêm Sản Phẩm Mới</h3>
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
                            >
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        </div>
                        <form onSubmit={handleAddItem} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Barcode <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={newItem.barcode}
                                    onChange={e => setNewItem({ ...newItem, barcode: e.target.value })}
                                    className="input"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tên Sản Phẩm <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={newItem.name}
                                    onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                                    className="input"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Đơn vị</label>
                                    <input
                                        type="text"
                                        value={newItem.unit}
                                        onChange={e => setNewItem({ ...newItem, unit: e.target.value })}
                                        className="input"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ngành hàng</label>
                                    <input
                                        type="text"
                                        value={newItem.category}
                                        onChange={e => setNewItem({ ...newItem, category: e.target.value })}
                                        className="input"
                                    />
                                </div>
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary bg-gray-100 text-gray-700 hover:bg-gray-200 border-none shadow-none">Hủy</button>
                                <button type="submit" className="btn btn-primary">Lưu Sản Phẩm</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InventoryHQ;
