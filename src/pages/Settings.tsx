import React, { useState, useEffect } from 'react';
import { SystemService, ShiftConfig, StoreConfig } from '../../services/system';

interface SettingsTabProps {
    toast: any;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ toast }) => {
    const [shifts, setShifts] = useState<ShiftConfig[]>([]);
    const [stores, setStores] = useState<StoreConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [fetchedShifts, fetchedStores] = await Promise.all([
                SystemService.getShifts(),
                SystemService.getStores()
            ]);
            setShifts(fetchedShifts);
            setStores(fetchedStores);
        } catch (e: any) {
            toast.error('Lỗi khi tải cấu hình: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveShifts = async () => {
        setSaving(true);
        try {
            const res = await SystemService.saveShifts(shifts);
            if (res.success) {
                toast.success('Lưu cấu hình Ca làm việc thành công');
            } else {
                toast.error(res.message || 'Lưu thất bại');
            }
        } catch (e: any) {
            toast.error('Lỗi: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleAddShift = () => {
        setShifts([...shifts, { id: shifts.length + 1, name: '', time: '', icon: 'schedule', color: 'from-gray-400 to-gray-500' }]);
    };

    const handleUpdateShift = (index: number, field: keyof ShiftConfig, value: string | number) => {
        const newShifts = [...shifts];
        newShifts[index] = { ...newShifts[index], [field]: value };
        setShifts(newShifts);
    };

    const handleRemoveShift = (index: number) => {
        setShifts(shifts.filter((_, i) => i !== index));
    };

    const handleAddStore = () => {
        setStores([...stores, { id: '', code: '', name: '' }]);
    };

    const handleUpdateStore = (index: number, field: keyof StoreConfig, value: string) => {
        const newStores = [...stores];
        newStores[index] = { ...newStores[index], [field]: value };
        setStores(newStores);
    };

    const handleSaveStore = async (index: number) => {
        const store = stores[index];
        if (!store.code || !store.name) {
            toast.error('Vui lòng nhập Mã và Tên cửa hàng');
            return;
        }
        try {
            const res = await SystemService.saveStore(store);
            if (res.success && res.data) {
                const newStores = [...stores];
                newStores[index] = res.data;
                setStores(newStores);
                toast.success('Lưu Cửa hàng thành công');
            } else {
                toast.error(res.message || 'Lưu Cửa hàng thất bại');
            }
        } catch (e: any) {
            toast.error('Lỗi: ' + e.message);
        }
    };

    const handleRemoveStore = async (index: number) => {
        const store = stores[index];
        if (store.id) {
            if (!window.confirm('Bạn có chắc xoá cửa hàng này? (Dữ liệu liên quan có thể bị ảnh hưởng)')) return;
            try {
                const res = await SystemService.deleteStore(store.id);
                if (res.success) {
                    setStores(stores.filter((_, i) => i !== index));
                    toast.success('Đã xoá Cửa hàng');
                } else {
                    toast.error(res.message || 'Xoá thất bại');
                }
            } catch (e: any) {
                toast.error('Lỗi: ' + e.message);
            }
        } else {
            setStores(stores.filter((_, i) => i !== index));
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
            {/* SHIFTS CONFIGURATION */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Quản lý Ca Làm Việc</h3>
                        <p className="text-sm text-gray-500">Thiết lập số lượng ca và thời gian làm việc</p>
                    </div>
                </div>
                <div className="p-6">
                    <div className="space-y-4">
                        {shifts.map((shift, i) => (
                            <div key={i} className="flex gap-4 items-center bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <div className="w-16">
                                    <label className="text-xs font-bold text-gray-500 mb-1 block">Ca (ID)</label>
                                    <input
                                        type="number"
                                        value={shift.id}
                                        onChange={(e) => handleUpdateShift(i, 'id', Number(e.target.value))}
                                        className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs font-bold text-gray-500 mb-1 block">Tên Ca</label>
                                    <input
                                        type="text"
                                        value={shift.name}
                                        onChange={(e) => handleUpdateShift(i, 'name', e.target.value)}
                                        className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                        placeholder="Ví dụ: Ca 1"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs font-bold text-gray-500 mb-1 block">Thời Gian</label>
                                    <input
                                        type="text"
                                        value={shift.time}
                                        onChange={(e) => handleUpdateShift(i, 'time', e.target.value)}
                                        className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                        placeholder="Ví dụ: 06:00 - 14:00"
                                    />
                                </div>
                                <div className="w-32">
                                    <label className="text-xs font-bold text-gray-500 mb-1 block">Icon (Material)</label>
                                    <input
                                        type="text"
                                        value={shift.icon}
                                        onChange={(e) => handleUpdateShift(i, 'icon', e.target.value)}
                                        className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                    />
                                </div>
                                <div className="pt-5">
                                    <button
                                        onClick={() => handleRemoveShift(i)}
                                        className="w-10 h-10 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 transition-colors"
                                    >
                                        <span className="material-symbols-outlined">delete</span>
                                    </button>
                                </div>
                            </div>
                        ))}

                        <button
                            onClick={handleAddShift}
                            className="w-full h-12 rounded-xl flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 text-gray-500 hover:border-primary hover:text-primary transition-colors font-semibold shadow-sm"
                        >
                            <span className="material-symbols-outlined text-lg">add</span>
                            Thêm Ca làm việc
                        </button>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <button
                            onClick={handleSaveShifts}
                            disabled={saving}
                            className="bg-primary text-white font-bold py-2.5 px-6 rounded-xl shadow-[0_4px_14px_0_rgba(234,179,8,0.39)] hover:shadow-[0_6px_20px_rgba(234,179,8,0.23)] hover:bg-yellow-500 transition-all flex items-center gap-2"
                        >
                            {saving ? <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> : <span className="material-symbols-outlined text-[18px]">save</span>}
                            Lưu cấu hình Ca
                        </button>
                    </div>
                </div>
            </div>

            {/* STORES CONFIGURATION */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Quản lý Cửa Hàng</h3>
                        <p className="text-sm text-gray-500">Danh sách các cơ sở Hệ thống</p>
                    </div>
                </div>
                <div className="p-6">
                    <div className="space-y-4">
                        {stores.map((store, i) => (
                            <div key={store.id || i} className="flex gap-4 items-center bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <div className="flex-1">
                                    <label className="text-xs font-bold text-gray-500 mb-1 block">Mã CH (Phải khớp ERP)</label>
                                    <input
                                        type="text"
                                        value={store.code}
                                        onChange={(e) => handleUpdateStore(i, 'code', e.target.value)}
                                        className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                        placeholder="Ví dụ: BEE"
                                    />
                                </div>
                                <div className="flex-[2]">
                                    <label className="text-xs font-bold text-gray-500 mb-1 block">Tên Cửa Hàng hiển thị</label>
                                    <input
                                        type="text"
                                        value={store.name}
                                        onChange={(e) => handleUpdateStore(i, 'name', e.target.value)}
                                        className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                        placeholder="Ví dụ: Siêu thị Sunmart BEE"
                                    />
                                </div>
                                <div className="pt-5 flex gap-2">
                                    <button
                                        onClick={() => handleSaveStore(i)}
                                        className="w-10 h-10 rounded-lg flex items-center justify-center text-blue-500 bg-blue-50 hover:bg-blue-100 transition-colors"
                                        title="Lưu Cửa hàng"
                                    >
                                        <span className="material-symbols-outlined text-[20px]">check</span>
                                    </button>
                                    <button
                                        onClick={() => handleRemoveStore(i)}
                                        className="w-10 h-10 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 transition-colors"
                                        title="Xóa Cửa hàng"
                                    >
                                        <span className="material-symbols-outlined text-[20px]">delete</span>
                                    </button>
                                </div>
                            </div>
                        ))}

                        <button
                            onClick={handleAddStore}
                            className="w-full h-12 rounded-xl flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 text-gray-500 hover:border-blue-500 hover:text-blue-500 transition-colors font-semibold shadow-sm"
                        >
                            <span className="material-symbols-outlined text-lg">add_location</span>
                            Thêm Cửa hàng mới
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsTab;
