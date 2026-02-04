import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { InventoryService } from '../services';
import { useToast } from '../contexts';

interface InventoryHQProps {
    user: User;
}

const InventoryHQ: React.FC<InventoryHQProps> = ({ user }) => {
    const toast = useToast();
    const [activeTab, setActiveTab] = useState<'MASTER' | 'DISTRIBUTE' | 'SETTINGS'>('DISTRIBUTE');
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStore, setSelectedStore] = useState('BEE');
    const [selectedShift, setSelectedShift] = useState(1);
    const [pushSuccess, setPushSuccess] = useState(false);

    // New Item Form State
    const [showAddModal, setShowAddModal] = useState(false);
    const [newItem, setNewItem] = useState({
        barcode: '',
        name: '',
        unit: '',
        category: ''
    });

    const stores = [
        { id: 'BEE', name: 'SM BEE - Chi Nhánh Trung Tâm' },
        { id: 'PLAZA', name: 'SM PLAZA - Chi Nhánh Phía Đông' },
        { id: 'MIỀN ĐÔNG', name: 'SM MIỀN ĐÔNG - Chi Nhánh Phía Bắc' },
        { id: 'HT PEARL', name: 'SM HT PEARL' },
        { id: 'GREEN TOPAZ', name: 'SM GREEN TOPAZ' },
        { id: 'EMERALD', name: 'SM EMERALD' }
    ];

    const shifts = [
        { id: 1, name: 'Ca 1 (Sáng)', time: '06:00 - 14:00', color: 'bg-yellow-100 text-yellow-900 border-yellow-300' },
        { id: 2, name: 'Ca 2 (Chiều)', time: '14:00 - 22:00', color: 'bg-blue-100 text-blue-900 border-blue-300' },
        { id: 3, name: 'Ca 3 (Đêm)', time: '22:00 - 06:00', color: 'bg-purple-100 text-purple-900 border-purple-300' }
    ];

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
                toast.error(res.error || 'Lỗi thêm sản phẩm');
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleDistribute = async () => {
        if (!confirm(`Xác nhận phân bổ danh sách tới ${stores.find(s => s.id === selectedStore)?.name} (Ca ${selectedShift})?`)) return;

        setLoading(true);
        try {
            const res = await InventoryService.distributeToStore(selectedStore, selectedShift);
            if (res.success) {
                setPushSuccess(true);
                setTimeout(() => setPushSuccess(false), 5000);
            } else {
                toast.error((res as any).error || 'Lỗi phân bổ');
            }
        } catch (e) {
            console.error(e);
            toast.error('Lỗi kết nối');
        } finally {
            setLoading(false);
        }
    };

    const filteredItems = items.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.barcode.includes(searchTerm)
    );

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 px-8 py-5 flex justify-between items-center sticky top-0 z-10">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        Thiết Lập & Đẩy Nhiệm Vụ Kho
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">Phân bổ danh sách kiểm kê xuống chi nhánh theo ca làm việc</p>
                </div>
                <div className="flex gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm">
                        <span className="material-symbols-outlined text-lg">history</span>
                        Lịch Sử Đẩy
                    </button>
                    <div className="h-9 w-px bg-gray-300 mx-1"></div>
                    <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
                        <span className="material-symbols-outlined">notifications</span>
                    </button>
                    <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
                        <span className="material-symbols-outlined">help_outline</span>
                    </button>
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 overflow-y-auto bg-gray-50 p-8">
                <div className="space-y-6 max-w-7xl mx-auto">
                    {/* Top Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Launchpad Form */}
                        <div className="lg:col-span-7 bg-white rounded-xl shadow-md border border-gray-200 p-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-50 rounded-bl-full -mr-8 -mt-8 z-0"></div>

                            <div className="relative z-10 mb-6 border-b border-gray-100 pb-4">
                                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">rocket_launch</span>
                                    Form Phân Bổ (Launchpad)
                                </h3>
                                <p className="text-sm text-gray-500 mt-1">Chọn thông tin nguồn và đích để khởi tạo nhiệm vụ</p>
                            </div>

                            <div className="relative z-10 space-y-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                                            Cửa Hàng Đích <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={selectedStore}
                                                onChange={(e) => setSelectedStore(e.target.value)}
                                                className="block w-full pl-4 pr-10 py-3 text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary rounded-lg bg-gray-50 text-gray-900 transition-shadow shadow-sm"
                                            >
                                                {stores.map(s => (
                                                    <option key={s.id} value={s.id}>{s.name}</option>
                                                ))}
                                            </select>
                                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                                                <span className="material-symbols-outlined text-lg">storefront</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                                            Sản Phẩm Master <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <select className="block w-full pl-4 pr-10 py-3 text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary rounded-lg bg-gray-50 text-gray-900 transition-shadow shadow-sm">
                                                <option value="master_all">Tất cả sản phẩm (Master Full)</option>
                                                <option value="master_food">Nhóm Thực Phẩm</option>
                                                <option value="master_drink">Nhóm Đồ Uống</option>
                                                <option value="custom_list">Danh sách tùy chỉnh</option>
                                            </select>
                                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                                                <span className="material-symbols-outlined text-lg">list_alt</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                                        Chọn Ca Làm Việc
                                    </label>
                                    <div className="grid grid-cols-3 gap-4">
                                        {shifts.map(shift => (
                                            <label key={shift.id} className="cursor-pointer group">
                                                <input
                                                    type="radio"
                                                    name="shift"
                                                    value={shift.id}
                                                    checked={selectedShift === shift.id}
                                                    onChange={() => setSelectedShift(shift.id)}
                                                    className="peer sr-only"
                                                />
                                                <div className={`flex flex-col items-center justify-center py-3 px-2 rounded-lg border-2 ${shift.color} peer-checked:border-primary peer-checked:ring-2 peer-checked:ring-primary/50 group-hover:shadow-md transition-all h-full`}>
                                                    <span className="font-bold text-sm">{shift.name}</span>
                                                    <span className="text-[10px] opacity-75 mt-0.5">{shift.time}</span>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <button
                                        onClick={handleDistribute}
                                        disabled={loading}
                                        className="w-full bg-gradient-to-r from-primary to-yellow-500 hover:from-yellow-500 hover:to-orange-500 text-gray-900 font-bold py-4 px-6 rounded-lg shadow-lg shadow-yellow-500/30 transform transition-all hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-3 group disabled:opacity-50"
                                    >
                                        {loading ? (
                                            <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span>
                                        ) : (
                                            <span className="material-symbols-outlined text-2xl group-hover:rotate-45 transition-transform duration-300">send</span>
                                        )}
                                        <span className="uppercase tracking-wide">Đẩy Nhiệm Vụ Xuống Chi Nhánh</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Right Side Cards */}
                        <div className="lg:col-span-5 flex flex-col gap-6">
                            {/* Success Notification */}
                            {pushSuccess && (
                                <div className="bg-white rounded-xl shadow-md border-l-4 border-green-500 p-6 flex items-start gap-4 animate-fade-in-up">
                                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 text-green-600">
                                        <span className="material-symbols-outlined">check_circle</span>
                                    </div>
                                    <div>
                                        <h4 className="text-base font-bold text-gray-900">Hoàn tất tác vụ!</h4>
                                        <p className="text-sm text-green-700 font-medium mt-1">Đã nạp danh sách cho chi nhánh {selectedStore}</p>
                                        <p className="text-xs text-gray-400 mt-2">ID Giao dịch: #TRX-{Date.now().toString().slice(-5)} • Vừa xong</p>
                                    </div>
                                </div>
                            )}

                            {/* Quick Action Cards */}
                            <div className="grid grid-cols-2 gap-4 flex-1">
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow group cursor-pointer">
                                    <div className="w-12 h-12 mb-3 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                                        <span className="material-symbols-outlined text-blue-600 text-2xl group-hover:rotate-180 transition-transform duration-500">sync</span>
                                    </div>
                                    <h4 className="font-bold text-gray-800 text-sm">Đồng Bộ KiotViet</h4>
                                    <p className="text-xs text-gray-500 mt-1">API Last check: 5m ago</p>
                                </div>

                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow group cursor-pointer">
                                    <div className="w-12 h-12 mb-3 rounded-full bg-red-50 flex items-center justify-center group-hover:bg-red-100 transition-colors">
                                        <span className="material-symbols-outlined text-red-600 text-2xl">restart_alt</span>
                                    </div>
                                    <h4 className="font-bold text-gray-800 text-sm">Reset Dữ Liệu</h4>
                                    <p className="text-xs text-gray-500 mt-1">Xóa cache & làm mới</p>
                                </div>
                            </div>

                            {/* Progress Card */}
                            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200 p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-gray-500 uppercase">Tiến độ ca hiện tại</span>
                                    <span className="text-xs font-bold text-primary">65%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div className="bg-primary h-2 rounded-full transition-all" style={{ width: '65%' }}></div>
                                </div>
                                <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                                    <span className="material-symbols-outlined text-sm">info</span>
                                    <span>Nhiệm vụ chưa hoàn thành sẽ được đẩy sang ca sau.</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Master List Table */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center bg-gray-50 gap-4">
                            <div>
                                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-gray-500">table_view</span>
                                    Master List Preview
                                </h3>
                                <p className="text-xs text-gray-500 mt-1">Danh sách sản phẩm mẫu sẽ được phân bổ ({items.length} items)</p>
                            </div>
                            <div className="flex gap-3 w-full sm:w-auto">
                                <select className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-700 focus:ring-primary focus:border-primary">
                                    <option>Tất cả ngành hàng</option>
                                    <option>Bánh kẹo</option>
                                    <option>Đồ uống</option>
                                    <option>Hóa mỹ phẩm</option>
                                </select>
                                <div className="relative flex-1 sm:flex-none">
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                                        <span className="material-symbols-outlined text-lg">search</span>
                                    </span>
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-9 pr-4 py-1.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-primary focus:border-primary w-full sm:w-56 transition-all focus:w-64"
                                        placeholder="Tìm tên SP, Barcode..."
                                    />
                                </div>
                                <button
                                    onClick={() => setShowAddModal(true)}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-primary text-secondary font-bold rounded-lg text-sm hover:bg-primary-dark transition-colors"
                                >
                                    <span className="material-symbols-outlined text-lg">add</span>
                                    Thêm
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto max-h-[400px]">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-100 border-b border-gray-200 sticky top-0">
                                    <tr>
                                        <th className="px-6 py-3 font-bold text-gray-600 uppercase tracking-wider text-xs w-24">Mã SP</th>
                                        <th className="px-6 py-3 font-bold text-gray-600 uppercase tracking-wider text-xs w-32">Barcode</th>
                                        <th className="px-6 py-3 font-bold text-gray-600 uppercase tracking-wider text-xs">Tên Sản Phẩm</th>
                                        <th className="px-6 py-3 font-bold text-gray-600 uppercase tracking-wider text-xs">Ngành Hàng</th>
                                        <th className="px-6 py-3 font-bold text-gray-600 uppercase tracking-wider text-xs text-right">Trạng Thái</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={5} className="p-8 text-center text-gray-500">
                                                <span className="material-symbols-outlined animate-spin text-2xl text-primary">progress_activity</span>
                                                <p className="mt-2">Đang tải dữ liệu...</p>
                                            </td>
                                        </tr>
                                    ) : filteredItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="p-8 text-center text-gray-500">Chưa có sản phẩm nào</td>
                                        </tr>
                                    ) : (
                                        filteredItems.slice(0, 20).map((item, idx) => (
                                            <tr key={item.id || idx} className="hover:bg-yellow-50/50 transition-colors group cursor-pointer">
                                                <td className="px-6 py-4 font-bold text-primary">{item.id?.slice(0, 8) || `SP${String(idx + 1).padStart(5, '0')}`}</td>
                                                <td className="px-6 py-4 text-gray-500 font-mono text-xs">{item.barcode}</td>
                                                <td className="px-6 py-4 text-gray-900 font-medium">{item.name}</td>
                                                <td className="px-6 py-4">
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                        {item.category || 'Chung'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                                        Ready
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>

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
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tên Sản Phẩm <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={newItem.name}
                                    onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
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
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ngành hàng</label>
                                    <input
                                        type="text"
                                        value={newItem.category}
                                        onChange={e => setNewItem({ ...newItem, category: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                                    />
                                </div>
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200">Hủy</button>
                                <button type="submit" className="px-4 py-2 bg-primary text-secondary rounded-lg font-bold hover:bg-primary-dark shadow-md">Lưu Sản Phẩm</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InventoryHQ;
