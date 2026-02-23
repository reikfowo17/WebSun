import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { User } from '../types';
import { useToast } from '../contexts';
import { ExpiryService, ExpiryConfig, ExpiryReport } from '../services';
import ConfirmModal from '../components/ConfirmModal';
import SubSidebar, { SubSidebarGroup } from '../components/SubSidebar';
import '../styles/hq-sidebar.css';

type ExpiryTab = 'CONFIG' | 'SCHEDULE' | 'REPORTS';

const TAB_META: Record<ExpiryTab, { label: string; desc: string }> = {
    CONFIG: { label: 'Cấu Hình Ngưỡng', desc: 'Thiết lập ngưỡng cận date & NSX theo loại sản phẩm' },
    SCHEDULE: { label: 'Lịch Quét', desc: 'Lên lịch nhắc nhở kiểm tra date tự động' },
    REPORTS: { label: 'Báo Cáo Date', desc: 'Tổng hợp kết quả kiểm date theo cửa hàng' },
};

const ExpiryHQ: React.FC<{ user: User }> = ({ user }) => {
    const toast = useToast();
    const [subTab, setSubTab] = useState<ExpiryTab>('CONFIG');
    const [currentDate, setCurrentDate] = useState(new Date().toISOString().slice(0, 10));
    const [topbarNode, setTopbarNode] = useState<HTMLElement | null>(null);

    useEffect(() => {
        setTopbarNode(document.getElementById('topbar-left'));
    }, []);

    const sidebarGroups: SubSidebarGroup[] = [
        {
            label: 'CẤU HÌNH',
            items: [
                { id: 'CONFIG', label: 'Ngưỡng Sản Phẩm' },
                { id: 'SCHEDULE', label: 'Lịch Quét' },
            ]
        },
        {
            label: 'BÁO CÁO',
            items: [
                { id: 'REPORTS', label: 'Báo Cáo Date' },
            ]
        }
    ];

    const meta = TAB_META[subTab];

    const datePicker = (
        <div className="hq-date-picker">
            <span className="material-symbols-outlined hq-date-icon">calendar_month</span>
            <div className="hq-date-picker-info">
                <div className="hq-date-picker-label">Ngày làm việc</div>
                <div className="hq-date-picker-value">
                    {new Date(currentDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </div>
            </div>
            <input
                type="date"
                value={currentDate}
                onChange={(e) => setCurrentDate(e.target.value)}
                className="hq-date-input-hidden"
                aria-label="Chọn ngày làm việc"
            />
        </div>
    );

    return (
        <div className="hq-page">
            {/* Breadcrumb */}
            {topbarNode && createPortal(
                <div className="hq-breadcrumb">
                    <span className="material-symbols-outlined hq-breadcrumb-icon">event_available</span>
                    <span className="hq-breadcrumb-title">Quản Lý Hạn Dùng</span>
                    <span className="material-symbols-outlined hq-breadcrumb-sep">chevron_right</span>
                    <span className="hq-breadcrumb-current">{meta.label}</span>
                </div>,
                topbarNode
            )}

            <div className="hq-layout">
                <SubSidebar
                    title="Quản Lý Hạn Dùng"
                    groups={sidebarGroups}
                    activeId={subTab}
                    onSelect={(id) => setSubTab(id as ExpiryTab)}
                    footer={datePicker}
                />
                <div className="hq-content" key={subTab}>
                    <div className="hq-section-animate">
                        {subTab === 'CONFIG' && <ExpiryConfigView toast={toast} />}
                        {subTab === 'SCHEDULE' && <ExpiryScheduleView toast={toast} />}
                        {subTab === 'REPORTS' && <ExpiryReportsView toast={toast} />}
                    </div>
                </div>
            </div>
        </div>
    );
};

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

    const [pendingToggle, setPendingToggle] = useState<ExpiryConfig | null>(null);

    const handleToggle = (cfg: ExpiryConfig) => {
        setPendingToggle(cfg);
    };

    const executeToggle = async () => {
        if (!pendingToggle) return;
        const cfg = pendingToggle;
        setPendingToggle(null);
        const res = await ExpiryService.updateConfig(cfg.id, { enabled: !cfg.enabled });
        if (res.success) {
            toast.success('Đã cập nhật cấu hình');
            loadConfigs();
        } else {
            toast.error('Lỗi khi cập nhật');
        }
    };

    if (loading) {
        return (
            <div className="hq-skeleton">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                    {[1, 2, 3].map(i => (
                        <div key={i} className="hq-sk-wrap" style={{ padding: 20 }}>
                            <div className="hq-sk-line" style={{ width: '60%', marginBottom: 12 }} />
                            <div className="hq-sk-line" style={{ width: '40%', height: 10, marginBottom: 16 }} />
                            <div style={{ display: 'flex', gap: 8 }}>
                                <div className="hq-sk-card" style={{ flex: 1, height: 56 }} />
                                <div className="hq-sk-card" style={{ flex: 1, height: 56 }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {configs.length === 0 ? <p className="col-span-full text-center text-gray-400">Chưa có cấu hình.</p> :
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

            <ConfirmModal
                isOpen={!!pendingToggle}
                title="Thay đổi cấu hình"
                message={pendingToggle ? `Xác nhận ${pendingToggle.enabled ? 'tắt' : 'bật'} cấu hình này?` : ''}
                variant="warning"
                confirmText="Xác nhận"
                onConfirm={executeToggle}
                onCancel={() => setPendingToggle(null)}
            />
        </div>
    );
};

/* ═══════════════════════════════════════════════
   2. SCHEDULE VIEW
   ═══════════════════════════════════════════════ */
const ExpiryScheduleView: React.FC<{ toast: any }> = ({ toast }) => {
    return (
        <div className="space-y-4">
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

/* ═══════════════════════════════════════════════
   3. REPORTS VIEW
   ═══════════════════════════════════════════════ */
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

    if (loading) {
        return (
            <div className="hq-skeleton">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[1, 2, 3].map(i => (
                        <div key={i} className="hq-sk-wrap">
                            <div className="hq-sk-row">
                                <div className="hq-sk-circle" style={{ width: 48, height: 48, borderRadius: 12 }} />
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                                    <div className="hq-sk-line" style={{ width: `${70 - i * 10}%` }} />
                                    <div className="hq-sk-line" style={{ width: `${40 + i * 5}%`, height: 10 }} />
                                </div>
                                <div className="hq-sk-btn" style={{ width: 80 }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {reports.length === 0 ? <p className="text-center text-gray-400">Không có báo cáo nào.</p> :
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
