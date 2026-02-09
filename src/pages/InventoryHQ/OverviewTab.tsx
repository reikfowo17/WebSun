import React, { useState, useEffect } from 'react';
import { InventoryService } from '../../services';
import { STORES } from '../../constants';

interface OverviewTabProps {
    date: string;
    toast: any;
    onNavigateToReviews: (storeCode: string) => void;
}

const OverviewTab: React.FC<OverviewTabProps> = ({ date, toast, onNavigateToReviews }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState<any>(null);
    const [stores, setStores] = useState<any[]>([]);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

    useEffect(() => {
        loadOverview();
        const interval = setInterval(() => {
            loadOverview();
            setLastUpdate(new Date());
        }, 10000); // Refresh every 10s

        return () => clearInterval(interval);
    }, [date]);

    const loadOverview = async (isRetry = false) => {
        if (!isRetry) {
            setLoading(true);
            setError(null);
        }

        try {
            const res = await InventoryService.getOverview(date);
            if (res.success) {
                setStats(res.stats);
                setStores(res.stores || []);
                setError(null);
            } else {
                throw new Error('Failed to load data');
            }
        } catch (err: any) {
            const errorMsg = err.message || 'Không thể tải dữ liệu tổng quan';
            setError(errorMsg);
            if (!isRetry) {
                toast.error(errorMsg);
            }
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (reportStatus: string | null, percentage: number) => {
        if (reportStatus === 'APPROVED') return 'bg-emerald-500';
        if (reportStatus === 'REJECTED') return 'bg-red-500';
        if (reportStatus === 'PENDING') return 'bg-yellow-500';
        if (percentage > 0) return 'bg-blue-500 animate-pulse';
        return 'bg-gray-300';
    };

    const getStatusLabel = (reportStatus: string | null, percentage: number) => {
        if (reportStatus === 'APPROVED') return 'Đã duyệt';
        if (reportStatus === 'REJECTED') return 'Từ chối';
        if (reportStatus === 'PENDING') return 'Chờ duyệt';
        if (percentage > 0) return 'Đang kiểm';
        return 'Chưa bắt đầu';
    };

    const getRelativeTime = (dateStr: string | null) => {
        if (!dateStr) return 'Chưa cập nhật';
        const diff = Date.now() - new Date(dateStr).getTime();
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return 'Vừa xong';
        if (minutes < 60) return `${minutes} phút trước`;
        const hours = Math.floor(minutes / 60);
        return `${hours} giờ trước`;
    };


    if (loading) {
        return (
            <div className="pt-6 space-y-6 animate-pulse">
                {/* Stats Cards Skeleton */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="bg-white rounded-2xl p-5 border border-gray-200">
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <div className="h-3 bg-gray-100 rounded w-20 mb-2"></div>
                                    <div className="h-8 bg-gray-200 rounded w-12"></div>
                                </div>
                                <div className="w-10 h-10 bg-gray-100 rounded-full"></div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Store Cards Skeleton */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                            <div className="h-1.5 bg-gray-200"></div>
                            <div className="bg-gray-50 p-4">
                                <div className="h-6 bg-gray-200 rounded w-32 mb-2"></div>
                                <div className="h-4 bg-gray-100 rounded w-24"></div>
                            </div>
                            <div className="p-4 space-y-3">
                                <div className="h-2 bg-gray-100 rounded-full"></div>
                                <div className="grid grid-cols-3 gap-2">
                                    {[1, 2, 3].map(j => (
                                        <div key={j} className="h-16 bg-gray-50 rounded-lg"></div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Error State
    if (error && !loading) {
        return (
            <div className="pt-12 text-center">
                <span className="material-symbols-outlined text-6xl text-red-200 mb-4">error</span>
                <h3 className="text-lg font-bold text-gray-700 mb-2">Không thể tải dữ liệu</h3>
                <p className="text-sm text-gray-400 mb-6">{error}</p>
                <button
                    onClick={() => loadOverview(true)}
                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors inline-flex items-center gap-2"
                >
                    <span className="material-symbols-outlined text-lg">refresh</span>
                    Thử lại
                </button>
            </div>
        );
    }

    return (
        <div className="pt-6 space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-500 font-medium mb-1">Tổng cửa hàng</p>
                            <p className="text-3xl font-black text-gray-800">{stats?.totalStores || 0}</p>
                        </div>
                        <span className="material-symbols-outlined text-4xl text-blue-500">store</span>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-500 font-medium mb-1">Hoàn tất</p>
                            <p className="text-3xl font-black text-emerald-600">
                                {stats?.completedStores || 0}/{stats?.totalStores || 0}
                            </p>
                        </div>
                        <span className="material-symbols-outlined text-4xl text-emerald-500">check_circle</span>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-500 font-medium mb-1">Đang kiểm</p>
                            <p className="text-3xl font-black text-blue-600">{stats?.inProgressStores || 0}</p>
                        </div>
                        <span className="material-symbols-outlined text-4xl text-blue-500">pending</span>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-500 font-medium mb-1">Vấn đề</p>
                            <p className="text-3xl font-black text-red-600">{stats?.issuesCount || 0}</p>
                        </div>
                        <span className="material-symbols-outlined text-4xl text-red-500">warning</span>
                    </div>
                </div>
            </div>

            {/* Last Update Indicator */}
            <div className="flex items-center justify-end text-xs text-gray-400">
                <span className="material-symbols-outlined text-sm mr-1">schedule</span>
                Cập nhật lần cuối: {lastUpdate.toLocaleTimeString('vi-VN')}
            </div>

            {/* Store Progress Grid */}
            {stores.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
                    <span className="material-symbols-outlined text-6xl text-gray-200 mb-3">store_off</span>
                    <p className="text-gray-400 font-medium">Chưa có dữ liệu kiểm kê cho ngày này</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {stores.map(store => {
                        const storeInfo = STORES.find(s => s.code === store.code);
                        const hasIssues = store.progress.missing > 0 || store.progress.over > 0;

                        return (
                            <div
                                key={store.id}
                                className="bg-white rounded-2xl border border-gray-200 hover:shadow-lg transition-all overflow-hidden group cursor-pointer"
                                onClick={() => {
                                    if (store.reportStatus === 'PENDING') {
                                        onNavigateToReviews(store.code);
                                    }
                                }}
                            >
                                {/* Status Bar */}
                                <div className={`h-1.5 w-full ${getStatusColor(store.reportStatus, store.progress.percentage)}`} />

                                {/* Header */}
                                <div className={`${storeInfo?.bgColor || 'bg-gray-100'} ${storeInfo?.color || 'text-gray-700'} p-4 border-b border-gray-100`}>
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <h3 className="font-black text-lg">{storeInfo?.name || store.name}</h3>
                                            <p className="text-xs opacity-75 font-medium mt-1">
                                                Ca {store.shift} • {store.employee?.name || '--'}
                                            </p>
                                        </div>
                                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide border ${store.reportStatus === 'APPROVED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                            store.reportStatus === 'REJECTED' ? 'bg-red-50 text-red-600 border-red-100' :
                                                store.reportStatus === 'PENDING' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' :
                                                    store.progress.percentage > 0 ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                        'bg-gray-50 text-gray-400 border-gray-100'
                                            }`}>
                                            {getStatusLabel(store.reportStatus, store.progress.percentage)}
                                        </span>
                                    </div>
                                </div>

                                {/* Progress Section */}
                                <div className="p-4 space-y-3">
                                    {/* Progress Bar */}
                                    <div>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-gray-500 font-medium">Tiến độ</span>
                                            <span className="text-slate-800 font-bold">{store.progress.percentage}%</span>
                                        </div>
                                        <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-1000 ${hasIssues ? 'bg-red-500' : 'bg-blue-600'
                                                    }`}
                                                style={{ width: `${store.progress.percentage}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                                            <span>{store.progress.checked} / {store.progress.total} SP</span>
                                            {hasIssues && (
                                                <span className="text-red-500 font-bold">
                                                    Lệch: {store.progress.missing + store.progress.over}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-3 gap-2 text-center">
                                        <div className="bg-emerald-50 rounded-lg p-2">
                                            <p className="text-xs text-gray-500 font-medium">Khớp</p>
                                            <p className="text-lg font-black text-emerald-600">{store.progress.matched}</p>
                                        </div>
                                        <div className="bg-red-50 rounded-lg p-2">
                                            <p className="text-xs text-gray-500 font-medium">Thiếu</p>
                                            <p className="text-lg font-black text-red-600">{store.progress.missing}</p>
                                        </div>
                                        <div className="bg-blue-50 rounded-lg p-2">
                                            <p className="text-xs text-gray-500 font-medium">Thừa</p>
                                            <p className="text-lg font-black text-blue-600">{store.progress.over}</p>
                                        </div>
                                    </div>

                                    {/* Last Update */}
                                    <div className="pt-3 border-t border-gray-100 text-xs text-gray-400">
                                        <span className="material-symbols-outlined text-sm mr-1 align-middle">update</span>
                                        {getRelativeTime(store.lastUpdate)}
                                    </div>

                                    {/* Action Button */}
                                    {store.reportStatus === 'PENDING' && (
                                        <button
                                            className="w-full py-2 px-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-xl text-sm font-bold hover:shadow-lg transition-all group-hover:scale-105"
                                            onClick={() => onNavigateToReviews(store.code)}
                                        >
                                            Xem báo cáo →
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default OverviewTab;
