import React, { useState, useEffect } from 'react';
import { InventoryService } from '../../services';

interface MonitoringViewProps {
    date: string;
}

const MonitoringView: React.FC<MonitoringViewProps> = ({ date }) => {
    const [stores, setStores] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadStats();
        const interval = setInterval(loadStats, 10000);
        return () => clearInterval(interval);
    }, [date]);

    const loadStats = async () => {
        if (stores.length === 0) setLoading(true);
        try {
            const res = await InventoryService.getMonitoringStats(date);
            if (res.success) {
                setStores(res.data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (loading && stores.length === 0) {
        return <div className="pt-12 text-center text-gray-500">Đang tải dữ liệu giám sát...</div>;
    }

    return (
        <div className="pt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stores.length === 0 ? (
                <div className="col-span-full text-center py-12 text-gray-400">
                    <span className="material-symbols-outlined text-4xl mb-2">store_off</span>
                    <p>Chưa có dữ liệu kiểm kê cho ngày này</p>
                </div>
            ) : stores.map(store => (
                <div key={store.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden">
                    {/* Status Bar Top */}
                    <div className={`h-1.5 w-full ${store.status === 'COMPLETED' ? 'bg-emerald-500' :
                        store.status === 'IN_PROGRESS' ? 'bg-blue-500 animate-pulse' :
                            store.status === 'ISSUE' ? 'bg-red-500' : 'bg-gray-200'
                        }`}></div>

                    <div className="p-5">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="font-bold text-lg text-slate-800">{store.name}</h3>
                                <p className="text-xs text-gray-500 font-medium mt-1">
                                    {store.status === 'PENDING' ? 'Chưa bắt đầu' : `Ca ${store.shift} • ${store.staff || '--'}`}
                                </p>
                            </div>
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide border ${store.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                store.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                    store.status === 'ISSUE' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-gray-50 text-gray-400 border-gray-100'
                                }`}>
                                {store.status === 'COMPLETED' ? 'Hoàn tất' :
                                    store.status === 'IN_PROGRESS' ? 'Đang kiểm' :
                                        store.status === 'ISSUE' ? 'Lệch kho' : 'Chờ'}
                            </span>
                        </div>

                        {/* Progress */}
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-500 font-medium">Tiến độ</span>
                                <span className="text-slate-800 font-bold">
                                    {store.total > 0 ? Math.round((store.progress / store.total) * 100) : 0}%
                                </span>
                            </div>
                            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-1000 ${store.status === 'ISSUE' ? 'bg-red-500' : 'bg-blue-600'
                                        }`}
                                    style={{ width: `${store.total > 0 ? (store.progress / store.total) * 100 : 0}%` }}
                                ></div>
                            </div>
                            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                                <span>{store.progress} / {store.total} SP</span>
                                {store.issues > 0 && <span className="text-red-500 font-bold">Lệch: {store.issues}</span>}
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default MonitoringView;
