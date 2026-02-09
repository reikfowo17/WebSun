import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { useToast } from '../contexts';
import { ExpiryService, ExpiryConfig, ExpiryReport } from '../services';

const ExpiryHQ: React.FC<{ user: User }> = ({ user }) => {
    const toast = useToast();
    const [subTab, setSubTab] = useState<'CONFIG' | 'SCHEDULE' | 'REPORTS'>('CONFIG');
    const [currentDate, setCurrentDate] = useState(new Date().toISOString().slice(0, 10));

    return (
        <div className="h-full flex flex-col bg-slate-50/50 font-sans text-slate-900">
            {/* Header - Clean & Compact like InventoryHQ */}
            {/* Header - Professional & Minimal */}
            <header className="px-8 flex items-center justify-between shrink-0 bg-white border-b border-gray-100 sticky top-0 z-50 h-16">
                {/* Left: Navigation Tabs */}
                <nav className="flex items-center gap-8 h-full">
                    {[
                        { id: 'CONFIG', label: 'CẤU HÌNH NGƯỠNG' },
                        { id: 'SCHEDULE', label: 'LỊCH QUÉT' },
                        { id: 'REPORTS', label: 'BÁO CÁO DATE' }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setSubTab(tab.id as any)}
                            className={`h-full relative px-1 text-xs font-bold uppercase tracking-wider transition-colors flex items-center ${subTab === tab.id
                                ? 'text-indigo-600'
                                : 'text-gray-400 hover:text-slate-600'
                                }`}
                        >
                            {tab.label}
                            {subTab === tab.id && (
                                <span className="absolute bottom-0 left-0 w-full h-[2px] bg-indigo-600"></span>
                            )}
                        </button>
                    ))}
                </nav>

                {/* Right: Date Picker - Minimal */}
                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all cursor-pointer">
                            <span className="material-symbols-outlined text-gray-400 group-hover:text-indigo-500 text-lg transition-colors">calendar_month</span>
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide leading-none group-hover:text-indigo-400">Ngày làm việc</span>
                                <span className="text-sm font-bold text-slate-700 w-24 text-right group-hover:text-indigo-700">
                                    {new Date(currentDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                </span>
                            </div>
                        </div>
                        <input
                            type="date"
                            value={currentDate}
                            onChange={(e) => setCurrentDate(e.target.value)}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 overflow-y-auto custom-scrollbar p-6 pt-2">
                <div className="max-w-7xl mx-auto min-h-full">
                    {subTab === 'CONFIG' && <ExpiryConfigView toast={toast} />}
                    {subTab === 'SCHEDULE' && <ExpiryScheduleView toast={toast} />}
                    {subTab === 'REPORTS' && <ExpiryReportsView toast={toast} />}
                </div>
            </main>
        </div>
    );
};

/* 1. CONFIG VIEW */
const ExpiryConfigView: React.FC<{ toast: any }> = ({ toast }) => {
    const [configs, setConfigs] = useState<ExpiryConfig[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadConfigs();
    }, []);

    const loadConfigs = async () => {
        setLoading(true);
        const res = await ExpiryService.getConfigs();
        if (res.success) setConfigs(res.configs);
        else toast.error('Không thể tải cấu hình');
        setLoading(false);
    };

    const handleToggle = async (cfg: ExpiryConfig) => {
        if (!confirm(`Xác nhận ${cfg.enabled ? 'tắt' : 'bật'} cấu hình này?`)) return;

        const res = await ExpiryService.updateConfig(cfg.id, { enabled: !cfg.enabled });
        if (res.success) {
            toast.success('Đã cập nhật cấu hình');
            loadConfigs();
        } else {
            toast.error('Lỗi khi cập nhật');
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-4">
            {loading ? <p className="col-span-full text-center text-gray-400">Đang tải...</p> :
                configs.length === 0 ? <p className="col-span-full text-center text-gray-400">Chưa có cấu hình.</p> :
                    configs.map(cfg => (
                        <div key={cfg.id} className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-all group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cfg.enabled ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400'}`}>
                                        <span className="material-symbols-outlined">settings</span>
                                    </div>
                                    <div>
                                        <h3 className={`font-bold ${cfg.enabled ? 'text-gray-800' : 'text-gray-400'}`}>{cfg.type}</h3>
                                        <p className="text-xs text-gray-400">ID: {cfg.id.split('-')[0]}</p>
                                    </div>
                                </div>
                                <div onClick={() => handleToggle(cfg)} className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in cursor-pointer">
                                    <div className={`absolute block w-5 h-5 rounded-full bg-white border-2 appearance-none transition-all ${cfg.enabled ? 'right-0 border-orange-500' : 'left-0 border-gray-300'}`} />
                                    <div className={`block overflow-hidden h-5 rounded-full ${cfg.enabled ? 'bg-orange-500' : 'bg-gray-200'}`}></div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                    <span className="block text-[10px] font-bold text-gray-500 uppercase">Cận date</span>
                                    <span className="text-lg font-black text-orange-600">{cfg.nearExpiryDays} <span className="text-xs font-normal text-gray-400">ngày</span></span>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                    <span className="block text-[10px] font-bold text-gray-500 uppercase">Ngưỡng NSX</span>
                                    <span className="text-lg font-black text-gray-700">{cfg.productionThreshold} <span className="text-xs font-normal text-gray-400">ngày</span></span>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {cfg.stores?.length > 0 ? cfg.stores.map(s => (
                                    <span key={s} className="px-2 py-1 bg-white border border-gray-200 rounded text-[10px] font-bold text-gray-500">{s}</span>
                                )) : <span className="text-[10px] text-gray-400 italic">Áp dụng tất cả</span>}
                                <button className="px-2 py-1 bg-gray-50 border border-dashed border-gray-300 rounded text-[10px] font-bold text-gray-400 hover:text-orange-500 hover:border-orange-300 transition-colors">
                                    + Edit
                                </button>
                            </div>
                        </div>
                    ))}

            <button className="border-2 border-dashed border-gray-200 rounded-2xl p-5 flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-orange-300 hover:text-orange-500 hover:bg-orange-50/50 transition-all min-h-[200px]">
                <span className="material-symbols-outlined text-3xl">add_circle</span>
                <span className="font-bold text-sm">Thêm Cấu Hình Loại SP</span>
            </button>
        </div>
    );
};

/* 2. SCHEDULE VIEW */
const ExpiryScheduleView: React.FC<{ toast: any }> = ({ toast }) => {
    return (
        <div className="pt-4 space-y-4">
            <div className="bg-white p-6 rounded-2xl border border-gray-200 text-center py-12">
                <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="material-symbols-outlined text-3xl text-orange-400">calendar_clock</span>
                </div>
                <h3 className="text-lg font-bold text-gray-800">Lịch Quét Tự Động</h3>
                <p className="text-gray-500 text-sm max-w-md mx-auto mt-2">Tính năng đang được phát triển. Cho phép lên lịch nhắc nhở nhân viên kiểm tra date định kỳ theo loại sản phẩm.</p>
                <button className="mt-6 px-6 py-2 bg-orange-500 text-white font-bold rounded-xl shadow-lg shadow-orange-200 hover:bg-orange-600 transition-all">
                    Tạo Lịch Mới
                </button>
            </div>
        </div>
    );
};

/* 3. REPORTS VIEW */
const ExpiryReportsView: React.FC<{ toast: any }> = ({ toast }) => {
    const [reports, setReports] = useState<ExpiryReport[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadReports();
    }, []);

    const loadReports = async () => {
        setLoading(true);
        const res = await ExpiryService.getReports();
        if (res.success) setReports(res.reports);
        setLoading(false);
    };

    return (
        <div className="pt-4 space-y-4">
            {loading ? <p className="text-center text-gray-400">Đang tải...</p> :
                reports.length === 0 ? <p className="text-center text-gray-400">Không có báo cáo nào.</p> :
                    reports.map(report => (
                        <div key={report.id} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between hover:shadow-md transition-all">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600 font-bold text-xs border border-orange-200">
                                    {report.store.split(' ').pop()}
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-800">{report.store} <span className="text-gray-400 font-normal text-xs">• {report.date}</span></h4>
                                    <div className="flex gap-3 text-xs mt-1">
                                        <span className="text-gray-500">Đã quét: <b>{report.scannedCount}</b></span>
                                        <span className="text-orange-600">Cận date: <b>{report.nearExpiryCount}</b></span>
                                        <span className="text-red-600">Hết hạn: <b>{report.expiredCount}</b></span>
                                    </div>
                                </div>
                            </div>
                            <button className="px-4 py-2 bg-gray-50 text-gray-600 rounded-lg text-xs font-bold hover:bg-orange-50 hover:text-orange-600 transition-colors">
                                Chi tiết
                            </button>
                        </div>
                    ))}
        </div>
    );
};

export default ExpiryHQ;
