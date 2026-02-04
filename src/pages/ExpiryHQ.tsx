import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../types';
import { useToast } from '../contexts';

interface ExpiryHQProps {
    user: User;
}

interface ExpiryConfig {
    id: string;
    type: string;
    nearExpiryDays: number;
    productionThreshold: number;
    enabled: boolean;
    stores: string[];
    lastUpdated?: string;
}

interface ScheduleItem {
    id: string;
    type: string;
    store: string;
    frequency: 'DAILY' | 'WEEKLY';
    time: string;
    enabled: boolean;
}

interface ReportSummary {
    date: string;
    store: string;
    type: string;
    employee: string;
    total: number;
    nearExpiry: number;
    expired: number;
    status: 'APPROVED' | 'PENDING';
}

const STORES = [
    { id: '1', code: 'BEE', name: 'SM BEE' },
    { id: '2', code: 'PLAZA', name: 'SM PLAZA' },
    { id: '3', code: 'MIỀN ĐÔNG', name: 'SM MIỀN ĐÔNG' },
    { id: '4', code: 'HT PEARL', name: 'SM HT PEARL' },
    { id: '5', code: 'GREEN TOPAZ', name: 'SM GREEN TOPAZ' },
    { id: '6', code: 'EMERALD', name: 'SM EMERALD' }
];

// Default configs matching GAS TongDate.js
const DEFAULT_CONFIGS: ExpiryConfig[] = [
    { id: '1', type: 'TỦ MÁT', nearExpiryDays: 5, productionThreshold: 7, enabled: true, stores: ['BEE', 'PLAZA', 'MIỀN ĐÔNG', 'HT PEARL', 'GREEN TOPAZ', 'EMERALD'] },
    { id: '2', type: 'BÁNH MÌ', nearExpiryDays: 2, productionThreshold: 3, enabled: true, stores: ['BEE', 'PLAZA', 'MIỀN ĐÔNG', 'HT PEARL', 'GREEN TOPAZ', 'EMERALD'] },
    { id: '3', type: 'KHO KHÔ', nearExpiryDays: 30, productionThreshold: 60, enabled: true, stores: ['BEE', 'PLAZA'] },
    { id: '4', type: 'KHO LẠNH', nearExpiryDays: 14, productionThreshold: 30, enabled: false, stores: [] }
];

const MOCK_SCHEDULES: ScheduleItem[] = [
    { id: '1', type: 'TỦ MÁT', store: 'ALL', frequency: 'DAILY', time: '04:00', enabled: true },
    { id: '2', type: 'BÁNH MÌ', store: 'ALL', frequency: 'DAILY', time: '12:00', enabled: true }
];

const MOCK_REPORTS: ReportSummary[] = [
    { date: '2026-02-04', store: 'SM BEE', type: 'TỦ MÁT', employee: 'Nguyễn Văn A', total: 45, nearExpiry: 12, expired: 3, status: 'APPROVED' },
    { date: '2026-02-04', store: 'SM PLAZA', type: 'TỦ MÁT', employee: 'Trần Thị B', total: 32, nearExpiry: 8, expired: 1, status: 'PENDING' },
    { date: '2026-02-03', store: 'SM MIỀN ĐÔNG', type: 'BÁNH MÌ', employee: 'Lê Văn C', total: 18, nearExpiry: 5, expired: 2, status: 'APPROVED' }
];

const ExpiryHQ: React.FC<ExpiryHQProps> = ({ user }) => {
    const navigate = useNavigate();
    const toast = useToast();
    const [activeTab, setActiveTab] = useState<'CONFIG' | 'SCHEDULE' | 'REPORTS'>('CONFIG');
    const [configs, setConfigs] = useState<ExpiryConfig[]>(DEFAULT_CONFIGS);
    const [schedules, setSchedules] = useState<ScheduleItem[]>(MOCK_SCHEDULES);
    const [reports, setReports] = useState<ReportSummary[]>(MOCK_REPORTS);
    const [loading, setLoading] = useState(false);
    const [editingConfig, setEditingConfig] = useState<ExpiryConfig | null>(null);
    const [showModal, setShowModal] = useState(false);

    // Stats
    const stats = useMemo(() => {
        const enabledConfigs = configs.filter(c => c.enabled).length;
        const totalStores = new Set(configs.flatMap(c => c.stores)).size;
        const pendingReports = reports.filter(r => r.status === 'PENDING').length;
        const totalExpired = reports.reduce((sum, r) => sum + r.expired, 0);
        return { enabledConfigs, totalStores, pendingReports, totalExpired };
    }, [configs, reports]);

    const handleToggleConfig = (id: string) => {
        setConfigs(prev => prev.map(c =>
            c.id === id ? { ...c, enabled: !c.enabled, lastUpdated: new Date().toISOString() } : c
        ));
        toast.success('Đã cập nhật cấu hình');
    };

    const handleEditConfig = (config: ExpiryConfig) => {
        setEditingConfig({ ...config });
        setShowModal(true);
    };

    const handleSaveConfig = () => {
        if (!editingConfig) return;

        // Validate
        if (editingConfig.nearExpiryDays > editingConfig.productionThreshold) {
            toast.warning('Ngưỡng cận date không nên lớn hơn ngưỡng NSX');
            return;
        }

        setConfigs(prev => prev.map(c =>
            c.id === editingConfig.id ? { ...editingConfig, lastUpdated: new Date().toISOString() } : c
        ));
        setShowModal(false);
        setEditingConfig(null);
        toast.success('Đã lưu cấu hình thành công');
    };

    const handlePushToStores = async () => {
        const enabledConfigs = configs.filter(c => c.enabled);
        if (enabledConfigs.length === 0) {
            toast.warning('Không có cấu hình nào được bật');
            return;
        }

        if (!confirm(`Xác nhận đẩy ${enabledConfigs.length} cấu hình xuống ${stats.totalStores} chi nhánh?`)) return;

        setLoading(true);
        try {
            await new Promise(r => setTimeout(r, 1500));
            toast.success(`Đã đẩy ${enabledConfigs.length} cấu hình thành công!`);
        } catch (e) {
            toast.error('Lỗi khi đẩy cấu hình');
        } finally {
            setLoading(false);
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'TỦ MÁT': return 'ac_unit';
            case 'BÁNH MÌ': return 'bakery_dining';
            case 'KHO KHÔ': return 'inventory_2';
            case 'KHO LẠNH': return 'kitchen';
            default: return 'category';
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'TỦ MÁT': return { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' };
            case 'BÁNH MÌ': return { bg: 'bg-amber-100', text: 'text-amber-600', border: 'border-amber-200' };
            case 'KHO KHÔ': return { bg: 'bg-stone-100', text: 'text-stone-600', border: 'border-stone-200' };
            case 'KHO LẠNH': return { bg: 'bg-cyan-100', text: 'text-cyan-600', border: 'border-cyan-200' };
            default: return { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' };
        }
    };

    return (
        <div className="h-full flex flex-col overflow-hidden bg-gradient-to-br from-orange-50/50 to-amber-50/30">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200/50 px-8 py-5 flex justify-between items-center sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-200">
                        <span className="material-symbols-outlined text-white text-2xl">event_busy</span>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-gray-900">Thiết Lập Kiểm Date</h2>
                        <p className="text-sm text-gray-500">Cấu hình ngưỡng cảnh báo và lịch tự động</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handlePushToStores}
                        disabled={loading}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-bold text-sm hover:shadow-lg hover:shadow-orange-200 transition-all disabled:opacity-50 active:scale-[0.98]"
                    >
                        {loading ? (
                            <span className="material-symbols-outlined animate-spin">progress_activity</span>
                        ) : (
                            <span className="material-symbols-outlined">send</span>
                        )}
                        Đẩy Cấu Hình
                    </button>
                </div>
            </header>

            {/* Stats Bar */}
            <div className="bg-white/60 backdrop-blur-sm border-b border-gray-100 px-8 py-3">
                <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                            <span className="material-symbols-outlined text-lg">tune</span>
                        </span>
                        <span className="text-gray-500">Cấu hình:</span>
                        <span className="font-bold text-gray-800">{stats.enabledConfigs}/{configs.length}</span>
                    </div>
                    <div className="w-px h-4 bg-gray-200" />
                    <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                            <span className="material-symbols-outlined text-lg">store</span>
                        </span>
                        <span className="text-gray-500">Chi nhánh:</span>
                        <span className="font-bold text-gray-800">{stats.totalStores}</span>
                    </div>
                    <div className="w-px h-4 bg-gray-200" />
                    <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center animate-pulse">
                            <span className="material-symbols-outlined text-lg">pending</span>
                        </span>
                        <span className="text-gray-500">Chờ duyệt:</span>
                        <span className="font-bold text-amber-600">{stats.pendingReports}</span>
                    </div>
                    {stats.totalExpired > 0 && (
                        <>
                            <div className="w-px h-4 bg-gray-200" />
                            <div className="flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-lg">error</span>
                                </span>
                                <span className="text-gray-500">Hết hạn:</span>
                                <span className="font-bold text-red-600">{stats.totalExpired}</span>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white/60 backdrop-blur-sm border-b border-gray-100 px-8">
                <nav className="flex gap-1">
                    {[
                        { key: 'CONFIG', label: 'Cấu Hình Ngưỡng', icon: 'tune' },
                        { key: 'SCHEDULE', label: 'Lịch Tự Động', icon: 'schedule' },
                        { key: 'REPORTS', label: 'Báo Cáo', icon: 'assessment' }
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key as any)}
                            className={`px-5 py-4 flex items-center gap-2 font-semibold text-sm transition-all relative ${activeTab === tab.key
                                    ? 'text-orange-600'
                                    : 'text-gray-400 hover:text-gray-600'
                                }`}
                        >
                            <span className="material-symbols-outlined text-lg">{tab.icon}</span>
                            {tab.label}
                            {activeTab === tab.key && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-500 to-amber-500" />
                            )}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Content */}
            <main className="flex-1 overflow-y-auto p-8">
                <div className="max-w-6xl mx-auto">

                    {/* CONFIG TAB */}
                    {activeTab === 'CONFIG' && (
                        <div className="space-y-6">
                            {/* Info Banner */}
                            <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100 rounded-2xl p-5 flex items-start gap-4">
                                <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-500 flex items-center justify-center flex-shrink-0">
                                    <span className="material-symbols-outlined">info</span>
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-800 mb-1">Hướng dẫn cấu hình</h4>
                                    <p className="text-sm text-gray-600">
                                        <span className="font-semibold text-amber-600">Ngưỡng cận date:</span> Sản phẩm có HSD còn ≤ số ngày này sẽ được đánh dấu
                                        <span className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded">🟠 CẬN DATE</span>.
                                        <span className="font-semibold text-gray-600 ml-2">Ngưỡng NSX:</span> Dùng khi không có HSD, tính từ ngày sản xuất.
                                    </p>
                                </div>
                            </div>

                            {/* Config Cards */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {configs.map(config => {
                                    const typeColor = getTypeColor(config.type);
                                    return (
                                        <div
                                            key={config.id}
                                            className={`bg-white/80 backdrop-blur-sm rounded-2xl border p-5 transition-all ${config.enabled
                                                    ? 'border-gray-200 shadow-sm hover:shadow-md'
                                                    : 'border-gray-100 opacity-60'
                                                }`}
                                        >
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-12 h-12 rounded-xl ${typeColor.bg} ${typeColor.text} flex items-center justify-center`}>
                                                        <span className="material-symbols-outlined text-2xl">{getTypeIcon(config.type)}</span>
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-gray-800 text-lg">{config.type}</h3>
                                                        <p className="text-xs text-gray-400">{config.stores.length} chi nhánh</p>
                                                    </div>
                                                </div>

                                                {/* Toggle Switch */}
                                                <button
                                                    onClick={() => handleToggleConfig(config.id)}
                                                    className={`relative w-14 h-7 rounded-full transition-colors ${config.enabled ? 'bg-gradient-to-r from-orange-500 to-amber-500' : 'bg-gray-200'
                                                        }`}
                                                >
                                                    <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${config.enabled ? 'left-8' : 'left-1'
                                                        }`} />
                                                </button>
                                            </div>

                                            {/* Threshold Display */}
                                            <div className="grid grid-cols-2 gap-3 mb-4">
                                                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 text-center border border-amber-100">
                                                    <div className="flex items-center justify-center gap-1.5 mb-1">
                                                        <span className="text-amber-500">🟠</span>
                                                        <p className="text-[10px] text-amber-600 font-bold uppercase">Ngưỡng Cận Date</p>
                                                    </div>
                                                    <p className="text-2xl font-black text-amber-700">{config.nearExpiryDays}</p>
                                                    <p className="text-[10px] text-gray-500">ngày</p>
                                                </div>
                                                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 text-center border border-gray-200">
                                                    <div className="flex items-center justify-center gap-1.5 mb-1">
                                                        <span className="material-symbols-outlined text-gray-400 text-sm">calendar_today</span>
                                                        <p className="text-[10px] text-gray-500 font-bold uppercase">Ngưỡng NSX</p>
                                                    </div>
                                                    <p className="text-2xl font-black text-gray-700">{config.productionThreshold}</p>
                                                    <p className="text-[10px] text-gray-500">ngày</p>
                                                </div>
                                            </div>

                                            {/* Stores Tags */}
                                            <div className="flex flex-wrap gap-1.5 mb-4">
                                                {config.stores.length > 0 ? (
                                                    config.stores.slice(0, 4).map(s => (
                                                        <span key={s} className={`px-2 py-1 ${typeColor.bg} ${typeColor.text} text-[10px] rounded-lg font-medium border ${typeColor.border}`}>
                                                            {s}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-xs text-gray-400 italic">Chưa chọn chi nhánh</span>
                                                )}
                                                {config.stores.length > 4 && (
                                                    <span className="px-2 py-1 bg-gray-100 text-gray-500 text-[10px] rounded-lg font-medium">
                                                        +{config.stores.length - 4}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Edit Button */}
                                            <button
                                                onClick={() => handleEditConfig(config)}
                                                className="w-full py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 border border-gray-100"
                                            >
                                                <span className="material-symbols-outlined text-sm">edit</span>
                                                Chỉnh sửa cấu hình
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Add New */}
                            <button className="w-full py-5 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 hover:border-orange-300 hover:text-orange-500 transition-colors flex items-center justify-center gap-2 hover:bg-orange-50/50">
                                <span className="material-symbols-outlined">add</span>
                                Thêm loại sản phẩm mới
                            </button>
                        </div>
                    )}

                    {/* SCHEDULE TAB */}
                    {activeTab === 'SCHEDULE' && (
                        <div className="space-y-6">
                            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200 overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-gray-400">schedule</span>
                                        Lịch Tổng Hợp Tự Động
                                    </h3>
                                    <button className="px-4 py-2 bg-orange-100 text-orange-600 rounded-lg text-sm font-bold hover:bg-orange-200 transition-colors flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-sm">add</span>
                                        Thêm lịch
                                    </button>
                                </div>
                                <div className="p-6">
                                    <div className="space-y-3">
                                        {schedules.map(schedule => {
                                            const typeColor = getTypeColor(schedule.type);
                                            return (
                                                <div key={schedule.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-12 h-12 ${typeColor.bg} rounded-xl flex items-center justify-center`}>
                                                            <span className={`material-symbols-outlined ${typeColor.text} text-xl`}>{getTypeIcon(schedule.type)}</span>
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-gray-800">{schedule.type}</p>
                                                            <p className="text-xs text-gray-400">
                                                                {schedule.store === 'ALL' ? 'Tất cả chi nhánh' : schedule.store} •{' '}
                                                                {schedule.frequency === 'DAILY' ? 'Hàng ngày' : 'Hàng tuần'} lúc {schedule.time}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className={`px-3 py-1 rounded-lg text-xs font-bold ${schedule.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                            {schedule.enabled ? 'Đang hoạt động' : 'Tạm dừng'}
                                                        </span>
                                                        <button className="p-2 hover:bg-white rounded-lg transition-colors">
                                                            <span className="material-symbols-outlined text-gray-400 text-lg">more_vert</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <p className="text-xs text-gray-400 mt-4 text-center">
                                        💡 Hệ thống sẽ tự động quét và gửi email báo cáo theo lịch đã thiết lập
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* REPORTS TAB */}
                    {activeTab === 'REPORTS' && (
                        <div className="space-y-6">
                            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200 overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                                    <h4 className="font-bold text-gray-700">Báo Cáo Gần Đây</h4>
                                    <button className="text-sm text-orange-600 font-bold hover:underline">Xem tất cả →</button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50/50 text-xs font-bold text-gray-400 uppercase">
                                            <tr>
                                                <th className="px-6 py-4 text-left">Thời gian</th>
                                                <th className="px-6 py-4 text-left">Chi nhánh</th>
                                                <th className="px-6 py-4 text-left">Loại</th>
                                                <th className="px-6 py-4 text-left">Nhân viên</th>
                                                <th className="px-6 py-4 text-center">Tổng SP</th>
                                                <th className="px-6 py-4 text-center">🟠 Cận</th>
                                                <th className="px-6 py-4 text-center">🔴 Hết</th>
                                                <th className="px-6 py-4 text-right">Trạng thái</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {reports.map((row, i) => {
                                                const typeColor = getTypeColor(row.type);
                                                return (
                                                    <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                                        <td className="px-6 py-4 font-mono text-gray-600">{row.date}</td>
                                                        <td className="px-6 py-4 font-bold text-gray-800">{row.store}</td>
                                                        <td className="px-6 py-4">
                                                            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${typeColor.bg} ${typeColor.text}`}>
                                                                <span className="material-symbols-outlined text-sm">{getTypeIcon(row.type)}</span>
                                                                {row.type}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-gray-600">{row.employee}</td>
                                                        <td className="px-6 py-4 text-center font-bold">{row.total}</td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className="font-bold text-amber-600">{row.nearExpiry}</span>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className="font-bold text-red-600">{row.expired}</span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <span className={`px-3 py-1 rounded-lg text-[10px] font-bold ${row.status === 'APPROVED'
                                                                    ? 'bg-green-100 text-green-700'
                                                                    : 'bg-amber-100 text-amber-700'
                                                                }`}>
                                                                {row.status === 'APPROVED' ? '✓ Đã duyệt' : '⏳ Chờ duyệt'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Edit Modal */}
            {showModal && editingConfig && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-orange-50 to-amber-50">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl ${getTypeColor(editingConfig.type).bg} ${getTypeColor(editingConfig.type).text} flex items-center justify-center`}>
                                    <span className="material-symbols-outlined">{getTypeIcon(editingConfig.type)}</span>
                                </div>
                                <h3 className="text-lg font-bold text-gray-800">{editingConfig.type}</h3>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                className="w-8 h-8 rounded-full bg-white flex items-center justify-center hover:bg-gray-100 transition-colors shadow-sm"
                            >
                                <span className="material-symbols-outlined text-sm text-gray-500">close</span>
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                                        🟠 Ngưỡng Cận Date
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={editingConfig.nearExpiryDays}
                                            onChange={e => setEditingConfig({ ...editingConfig, nearExpiryDays: parseInt(e.target.value) || 0 })}
                                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 text-lg font-bold text-center"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">ngày</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                                        📅 Ngưỡng NSX
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={editingConfig.productionThreshold}
                                            onChange={e => setEditingConfig({ ...editingConfig, productionThreshold: parseInt(e.target.value) || 0 })}
                                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 text-lg font-bold text-center"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">ngày</span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Chi Nhánh Áp Dụng</label>
                                <div className="grid grid-cols-3 gap-2 p-3 bg-gray-50 rounded-xl max-h-40 overflow-y-auto">
                                    {STORES.map(store => (
                                        <label key={store.id} className="flex items-center gap-2 cursor-pointer p-2 hover:bg-white rounded-lg transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={editingConfig.stores.includes(store.code)}
                                                onChange={e => {
                                                    const newStores = e.target.checked
                                                        ? [...editingConfig.stores, store.code]
                                                        : editingConfig.stores.filter(s => s !== store.code);
                                                    setEditingConfig({ ...editingConfig, stores: newStores });
                                                }}
                                                className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                                            />
                                            <span className="text-sm text-gray-700 font-medium">{store.code}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleSaveConfig}
                                className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-orange-200 transition-all"
                            >
                                Lưu Thay Đổi
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExpiryHQ;
