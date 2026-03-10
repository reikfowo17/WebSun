import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { User } from '../../types';
import { useToast } from '../../contexts';
import { ToastContextType } from '../../contexts/ToastContext';
import ConfirmModal from '../../components/ConfirmModal';
import SubSidebar, { SubSidebarGroup } from '../../components/SubSidebar';
import ExpiryCheckAdmin from './ExpiryCheckAdmin';
import ExpiryCheckService from '../../services/expiryCheck';
import { SystemService, StoreConfig, ExpiryConfigItem, ProductConfig } from '../../services/system';
import '../../styles/hq-sidebar.css';
import '../../styles/settings.css';

type ExpiryTab = 'REPORTS' | 'STOCKCHECK_ADMIN';

const TAB_META: Record<ExpiryTab, { label: string; desc: string }> = {
    STOCKCHECK_ADMIN: { label: 'Danh Mục Cần Kiểm', desc: 'Tạo danh mục sản phẩm yêu cầu kiểm date hằng đêm' },
    REPORTS: { label: 'Báo Cáo Date', desc: 'Tổng hợp kết quả kiểm date theo cửa hàng' },
};

const isAdmin = (user: User) => ['ADMIN', 'MANAGER'].includes(user.role || '');

const ExpiryHQ: React.FC<{ user: User }> = ({ user }) => {
    const toast = useToast();
    const [subTab, setSubTab] = useState<ExpiryTab>('STOCKCHECK_ADMIN');
    const [currentDate, setCurrentDate] = useState(() => {
        const vnNow = new Date(Date.now() + 7 * 3600 * 1000);
        if (vnNow.getUTCHours() < 6) {
            vnNow.setUTCDate(vnNow.getUTCDate() - 1);
        }
        return vnNow.toISOString().slice(0, 10);
    });
    const [topbarNode, setTopbarNode] = useState<HTMLElement | null>(null);

    const [stores, setStores] = useState<StoreConfig[]>([]);
    const [expiryConfigs, setExpiryConfigs] = useState<ExpiryConfigItem[]>([]);
    const [products, setProducts] = useState<ProductConfig[]>([]);
    const [loadingData, setLoadingData] = useState(true);

    useEffect(() => {
        setTopbarNode(document.getElementById('topbar-left'));
        loadData();
    }, []);

    const loadData = async () => {
        setLoadingData(true);
        try {
            const [fetchedStores, fetchedExpiry, fetchedProducts] = await Promise.all([
                SystemService.getStores(),
                SystemService.getExpiryConfigs(),
                SystemService.getProducts(),
            ]);
            setStores(fetchedStores);
            setExpiryConfigs(fetchedExpiry);
            setProducts(fetchedProducts);
        } catch (e: unknown) {
            toast.error('Lỗi khi tải dữ liệu: ' + (e instanceof Error ? e.message : String(e)));
        } finally {
            setLoadingData(false);
        }
    };

    const sidebarGroups: SubSidebarGroup[] = [
        {
            label: 'CẤU HÌNH & BÁO CÁO',
            items: [
                { id: 'STOCKCHECK_ADMIN', label: TAB_META.STOCKCHECK_ADMIN.label },
                { id: 'REPORTS', label: TAB_META.REPORTS.label },
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
                        {subTab === 'REPORTS' && <ExpiryReportsView toast={toast} />}
                        {subTab === 'STOCKCHECK_ADMIN' && <ExpiryCheckAdmin />}
                    </div>
                </div>
            </div>
        </div>
    );

};



/* ═══════════════════════════════════════════════
   3. REPORTS VIEW
   ═══════════════════════════════════════════════ */
const ExpiryReportsView: React.FC<{ toast: ToastContextType }> = ({ toast }) => {
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const [dateFrom, setDateFrom] = useState(() => {
        const d = new Date(); d.setDate(d.getDate() - 3); return d.toISOString().split('T')[0];
    });
    const [dateTo, setDateTo] = useState(() => {
        return new Date().toISOString().split('T')[0];
    });

    const [selectedReport, setSelectedReport] = useState<any | null>(null);
    const [reportDetails, setReportDetails] = useState<any[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [selectedStoreFilter, setSelectedStoreFilter] = useState<string | null>(null);

    useEffect(() => {
        loadReports();
    }, [dateFrom, dateTo]);

    const loadReports = async () => {
        setLoading(true);
        const res = await ExpiryCheckService.getDailySummary({ dateFrom, dateTo });
        if (res.success) setReports(res.data);
        setLoading(false);
    };

    const handleViewDetails = async (report: any) => {
        setSelectedReport(report);
        setLoadingDetails(true);
        const res = await ExpiryCheckService.getSessionResults(report.id);
        if (res.success) setReportDetails(res.data);
        else toast.error('Lỗi khi tải chi tiết báo cáo');
        setLoadingDetails(false);
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

    // Grouping by Store
    const grouped: Record<string, any[]> = {};
    reports.forEach(r => {
        const storeName = r.store?.name || 'Không xác định';
        if (!grouped[storeName]) grouped[storeName] = [];
        grouped[storeName].push(r);
    });

    const storeNames = Object.keys(grouped).sort();
    const activeStore = (selectedStoreFilter && storeNames.includes(selectedStoreFilter)) ? selectedStoreFilter : storeNames[0];

    return (
        <div className="space-y-4">
            <div className="flex gap-4 mb-4 bg-white p-4 rounded-2xl border border-gray-200">
                <div className="flex flex-col">
                    <label className="text-xs font-bold text-gray-500 mb-1">Từ ngày</label>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border border-gray-200 rounded-lg p-2 text-sm outline-none focus:border-orange-400" />
                </div>
                <div className="flex flex-col">
                    <label className="text-xs font-bold text-gray-500 mb-1">Đến ngày</label>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border border-gray-200 rounded-lg p-2 text-sm outline-none focus:border-orange-400" />
                </div>
                <div className="flex items-end">
                    <button onClick={loadReports} className="h-[38px] px-4 bg-orange-50 text-orange-600 font-bold text-sm rounded-lg hover:bg-orange-100 transition-colors">
                        Lọc
                    </button>
                </div>
            </div>

            {reports.length === 0 ? <p className="text-center text-gray-400 py-8">Không có báo cáo kiểm date nào trong khoảng thời gian này.</p> :
                (
                    <div className="flex flex-col md:flex-row gap-6 items-start">
                        {/* Store Selector (Left Sidebar) */}
                        <div className="w-full md:w-64 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden shrink-0">
                            <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                                    <span className="material-symbols-outlined text-orange-500" style={{ fontSize: 20 }}>store</span>
                                    Cửa Hàng Báo Cáo
                                </h3>
                            </div>
                            <div className="p-2 space-y-1">
                                {storeNames.map(storeName => {
                                    const count = grouped[storeName].length;
                                    const isActive = activeStore === storeName;
                                    return (
                                        <button
                                            key={storeName}
                                            onClick={() => setSelectedStoreFilter(storeName)}
                                            className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors flex items-center justify-between group ${isActive ? 'bg-orange-50 text-orange-700' : 'hover:bg-gray-50 text-gray-700'}`}
                                        >
                                            <span className="truncate pr-2">{storeName}</span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-colors ${isActive ? 'bg-orange-200 text-orange-800' : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200'}`}>{count}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Store Reports Details (Right Content) */}
                        <div className="flex-1 w-full flex flex-col gap-4">
                            {activeStore && grouped[activeStore] && (
                                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                                    <div className="bg-orange-50/50 border-b border-gray-200 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div>
                                            <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                                                <span className="material-symbols-outlined text-orange-500">storefront</span>
                                                {activeStore}
                                            </h3>
                                            <p className="text-sm text-gray-500 mt-1">Gồm <strong>{grouped[activeStore].length}</strong> báo cáo kiểm kiểm trong dải ngày này</p>
                                        </div>
                                    </div>
                                    <div className="p-5 space-y-3 bg-gray-50/30 flex-1">
                                        {grouped[activeStore].map(report => {
                                            const statusText = report.status === 'COMPLETED' ? 'Hoàn thành' : 'Đang thực hiện';
                                            const statusColor = report.status === 'COMPLETED' ? 'text-green-600 bg-green-50 border-green-200' : 'text-orange-600 bg-orange-50 border-orange-200';
                                            return (
                                                <div key={report.id} className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between hover:shadow-md hover:border-blue-300 transition-all gap-4 cursor-pointer group" onClick={() => handleViewDetails(report)}>
                                                    <div className="flex items-start sm:items-center gap-4">
                                                        <div className="w-12 h-12 bg-blue-50 shrink-0 rounded-xl flex items-center justify-center text-blue-500 font-bold group-hover:scale-105 transition-transform">
                                                            <span className="material-symbols-outlined" style={{ fontSize: 24 }}>category</span>
                                                        </div>
                                                        <div>
                                                            <h4 className="font-bold text-gray-800 flex items-center gap-2 text-base group-hover:text-blue-600 transition-colors">
                                                                {report.category?.name || 'Danh mục chưa tên'}
                                                            </h4>
                                                            <div className="flex flex-wrap items-center gap-3 text-xs mt-1.5">
                                                                <span className="text-gray-500 font-medium flex items-center gap-1">
                                                                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>calendar_today</span>
                                                                    {new Date(report.check_date).toLocaleDateString('vi-VN')}
                                                                </span>
                                                                <span className="text-gray-500 font-medium flex items-center gap-1">
                                                                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>schedule</span>
                                                                    Ca {report.shift}
                                                                </span>
                                                                <span className={`px-2 py-0.5 rounded-full font-bold border ${statusColor}`}>
                                                                    {statusText}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2 shrink-0 border-t sm:border-t-0 border-gray-100 pt-3 sm:pt-0 mt-2 sm:mt-0 w-full sm:w-auto">
                                                        <div className="text-sm text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                                                            Đã kiểm: <span className="font-bold text-gray-800">{report.checked_count || 0}</span> / <span className="font-medium">{report.result_count || 0}</span> SP
                                                        </div>
                                                        <span className="text-xs font-bold text-blue-500 flex items-center gap-1 group-hover:underline">
                                                            Xem chi tiết <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_forward</span>
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

            {selectedReport && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[9999]" onClick={(e) => { if (e.target === e.currentTarget) setSelectedReport(null); }}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-blue-500">assignment</span>
                                    Chi Tiết Lô Lỗi: {selectedReport.category?.name}
                                </h3>
                                <p className="text-xs text-gray-500 mt-1">
                                    Cửa hàng: {selectedReport.store?.name} | Ngày: {new Date(selectedReport.check_date).toLocaleDateString('vi-VN')} - Ca {selectedReport.shift}
                                </p>
                            </div>
                            <button onClick={() => setSelectedReport(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-500 transition-colors">
                                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
                            </button>
                        </div>
                        <div className="p-0 overflow-y-auto flex-1 bg-white">
                            {loadingDetails ? (
                                <div className="p-8 text-center text-gray-500 flex flex-col items-center justify-center gap-3">
                                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                    <p>Đang tải chi tiết...</p>
                                </div>
                            ) : reportDetails.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">Không có sản phẩm nào được kiểm trong danh mục này.</div>
                            ) : (
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-gray-50 text-gray-600 sticky top-0 z-10 text-xs uppercase shadow-sm">
                                        <tr>
                                            <th className="px-6 py-3 font-bold">Mã SP / Barcode</th>
                                            <th className="px-6 py-3 font-bold">Tên Sản Phẩm</th>
                                            <th className="px-6 py-3 font-bold text-right">Tồn Máy</th>
                                            <th className="px-6 py-3 font-bold">Hạn Sử Dụng</th>
                                            <th className="px-6 py-3 font-bold">Ghi chú</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {reportDetails.map((item, idx) => {
                                            const isChecked = item.qty !== null;
                                            return (
                                                <tr key={item.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'} hover:bg-blue-50/30 transition-colors`}>
                                                    <td className="px-6 py-3 text-gray-600 font-medium">{item.product?.sp || item.product?.barcode}</td>
                                                    <td className="px-6 py-3 text-gray-800 font-bold max-w-[250px] truncate whitespace-normal leading-tight">{item.product?.name}</td>
                                                    <td className="px-6 py-3 text-right">
                                                        {isChecked ? (
                                                            <span className="font-bold text-gray-900 bg-gray-100 px-2 py-1 rounded">{item.qty}</span>
                                                        ) : (
                                                            <span className="text-gray-400 italic text-xs">Chưa kiểm</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-3">
                                                        {item.expiry_date ? (
                                                            <span className="font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-lg">{new Date(item.expiry_date).toLocaleDateString('vi-VN')}</span>
                                                        ) : (
                                                            <span className="text-gray-400">-</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-3 text-gray-600 text-xs whitespace-normal max-w-[200px]">
                                                        {item.note || '-'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExpiryHQ;
