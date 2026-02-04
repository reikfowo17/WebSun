import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../types';
import { useToast } from '../contexts';

interface InventoryReviewProps {
    user: User;
}

interface InventoryReport {
    id: string;
    date: string;
    store: string;
    shift: number;
    employee: string;
    totalItems: number;
    matchedItems: number;
    discrepancies: number;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    submittedAt: string;
}

interface StoreStats {
    code: string;
    name: string;
    totalReports: number;
    pendingReports: number;
    accuracy: number;
    lastReport: string;
}

const MOCK_REPORTS: InventoryReport[] = [
    { id: '1', date: '2026-02-04', store: 'BEE', shift: 1, employee: 'Nguyễn Văn A', totalItems: 150, matchedItems: 145, discrepancies: 5, status: 'PENDING', submittedAt: '10:30' },
    { id: '2', date: '2026-02-04', store: 'PLAZA', shift: 1, employee: 'Trần Thị B', totalItems: 120, matchedItems: 118, discrepancies: 2, status: 'APPROVED', submittedAt: '09:45' },
    { id: '3', date: '2026-02-03', store: 'BEE', shift: 2, employee: 'Lê Văn C', totalItems: 150, matchedItems: 150, discrepancies: 0, status: 'APPROVED', submittedAt: '18:20' },
    { id: '4', date: '2026-02-03', store: 'MIỀN ĐÔNG', shift: 1, employee: 'Phạm Minh D', totalItems: 80, matchedItems: 75, discrepancies: 5, status: 'REJECTED', submittedAt: '11:00' },
];

const STORE_STATS: StoreStats[] = [
    { code: 'BEE', name: 'SM BEE', totalReports: 45, pendingReports: 2, accuracy: 96.5, lastReport: '10:30' },
    { code: 'PLAZA', name: 'SM PLAZA', totalReports: 38, pendingReports: 0, accuracy: 98.2, lastReport: '09:45' },
    { code: 'MIỀN ĐÔNG', name: 'SM MIỀN ĐÔNG', totalReports: 32, pendingReports: 1, accuracy: 94.1, lastReport: '11:00' },
    { code: 'HT PEARL', name: 'SM HT PEARL', totalReports: 28, pendingReports: 0, accuracy: 97.8, lastReport: '08:15' },
];

/**
 * InventoryReview - Admin dashboard for reviewing inventory reports
 * Follows React patterns: Single responsibility, composition, proper TypeScript
 */
const InventoryReview: React.FC<InventoryReviewProps> = ({ user }) => {
    const navigate = useNavigate();
    const toast = useToast();
    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'REPORTS' | 'DISCREPANCIES'>('OVERVIEW');
    const [reports, setReports] = useState<InventoryReport[]>(MOCK_REPORTS);
    const [storeStats, setStoreStats] = useState<StoreStats[]>(STORE_STATS);
    const [loading, setLoading] = useState(false);
    const [filterStore, setFilterStore] = useState('ALL');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [selectedReport, setSelectedReport] = useState<InventoryReport | null>(null);

    // Calculate summary stats
    const summaryStats = {
        totalReports: reports.length,
        pendingReports: reports.filter(r => r.status === 'PENDING').length,
        totalDiscrepancies: reports.reduce((sum, r) => sum + r.discrepancies, 0),
        avgAccuracy: (reports.reduce((sum, r) => sum + (r.matchedItems / r.totalItems * 100), 0) / reports.length).toFixed(1)
    };

    // Filter reports
    const filteredReports = reports.filter(r => {
        if (filterStore !== 'ALL' && r.store !== filterStore) return false;
        if (filterStatus !== 'ALL' && r.status !== filterStatus) return false;
        return true;
    });

    // Handle report approval
    const handleApprove = async (reportId: string) => {
        setReports(prev => prev.map(r =>
            r.id === reportId ? { ...r, status: 'APPROVED' as const } : r
        ));
        toast.success('Đã duyệt báo cáo');
    };

    // Handle report rejection
    const handleReject = async (reportId: string) => {
        if (!confirm('Xác nhận từ chối báo cáo này?')) return;
        setReports(prev => prev.map(r =>
            r.id === reportId ? { ...r, status: 'REJECTED' as const } : r
        ));
        toast.warning('Đã từ chối báo cáo');
    };

    // Export to Excel (mock)
    const handleExport = () => {
        toast.success('Đang xuất file Excel...');
    };

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 px-8 py-5 flex justify-between items-center sticky top-0 z-10">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <span className="material-symbols-outlined text-blue-500">fact_check</span>
                        Tổng Hợp Kiểm Tồn
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">Xem và duyệt báo cáo kiểm kê từ các chi nhánh</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-50 transition-colors"
                    >
                        <span className="material-symbols-outlined text-lg">download</span>
                        Xuất Excel
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg font-bold text-sm hover:bg-blue-600 transition-colors shadow-lg shadow-blue-200">
                        <span className="material-symbols-outlined">sync</span>
                        Đồng Bộ
                    </button>
                </div>
            </header>

            {/* Tabs */}
            <div className="bg-white border-b border-gray-200 px-8">
                <nav className="flex gap-8">
                    {[
                        { key: 'OVERVIEW', label: 'Tổng Quan', icon: 'dashboard' },
                        { key: 'REPORTS', label: 'Báo Cáo Chi Tiết', icon: 'description' },
                        { key: 'DISCREPANCIES', label: 'Chênh Lệch', icon: 'warning' }
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key as any)}
                            className={`pb-4 pt-5 flex items-center gap-2 font-bold text-sm transition-colors border-b-2 ${activeTab === tab.key
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-400 hover:text-gray-600'
                                }`}
                        >
                            <span className="material-symbols-outlined text-lg">{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Content */}
            <main className="flex-1 overflow-y-auto bg-gray-50 p-8">
                <div className="max-w-7xl mx-auto">

                    {/* OVERVIEW TAB */}
                    {activeTab === 'OVERVIEW' && (
                        <div className="space-y-6">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="bg-white rounded-xl border border-gray-200 p-5">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                                            <span className="material-symbols-outlined">description</span>
                                        </div>
                                        <span className="text-xs font-bold text-gray-400 uppercase">Tổng Báo Cáo</span>
                                    </div>
                                    <p className="text-3xl font-black text-gray-800">{summaryStats.totalReports}</p>
                                    <p className="text-xs text-gray-400 mt-1">Trong tuần này</p>
                                </div>

                                <div className="bg-white rounded-xl border border-gray-200 p-5">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-lg bg-yellow-100 text-yellow-600 flex items-center justify-center animate-pulse">
                                            <span className="material-symbols-outlined">pending</span>
                                        </div>
                                        <span className="text-xs font-bold text-gray-400 uppercase">Chờ Duyệt</span>
                                    </div>
                                    <p className="text-3xl font-black text-yellow-600">{summaryStats.pendingReports}</p>
                                    <p className="text-xs text-gray-400 mt-1">Cần xử lý</p>
                                </div>

                                <div className="bg-white rounded-xl border border-gray-200 p-5">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
                                            <span className="material-symbols-outlined">error</span>
                                        </div>
                                        <span className="text-xs font-bold text-gray-400 uppercase">Chênh Lệch</span>
                                    </div>
                                    <p className="text-3xl font-black text-red-600">{summaryStats.totalDiscrepancies}</p>
                                    <p className="text-xs text-gray-400 mt-1">Sản phẩm lệch</p>
                                </div>

                                <div className="bg-white rounded-xl border border-gray-200 p-5">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-lg bg-green-100 text-green-600 flex items-center justify-center">
                                            <span className="material-symbols-outlined">verified</span>
                                        </div>
                                        <span className="text-xs font-bold text-gray-400 uppercase">Độ Chính Xác</span>
                                    </div>
                                    <p className="text-3xl font-black text-green-600">{summaryStats.avgAccuracy}%</p>
                                    <p className="text-xs text-gray-400 mt-1">Trung bình</p>
                                </div>
                            </div>

                            {/* Store Performance */}
                            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                                    <h3 className="font-bold text-gray-700 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-gray-400">store</span>
                                        Hiệu Suất Chi Nhánh
                                    </h3>
                                </div>
                                <div className="p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        {storeStats.map(store => (
                                            <div
                                                key={store.code}
                                                className="bg-gray-50 rounded-xl p-4 hover:bg-gray-100 transition-colors cursor-pointer"
                                            >
                                                <div className="flex justify-between items-start mb-3">
                                                    <div>
                                                        <h4 className="font-bold text-gray-800">{store.name}</h4>
                                                        <p className="text-xs text-gray-400">{store.totalReports} báo cáo</p>
                                                    </div>
                                                    {store.pendingReports > 0 && (
                                                        <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-[10px] font-bold rounded-full">
                                                            {store.pendingReports} chờ
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Accuracy Bar */}
                                                <div className="mb-2">
                                                    <div className="flex justify-between text-[10px] mb-1">
                                                        <span className="text-gray-400">Độ chính xác</span>
                                                        <span className={`font-bold ${store.accuracy >= 95 ? 'text-green-600' : store.accuracy >= 90 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                            {store.accuracy}%
                                                        </span>
                                                    </div>
                                                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full ${store.accuracy >= 95 ? 'bg-green-500' : store.accuracy >= 90 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                                            style={{ width: `${store.accuracy}%` }}
                                                        />
                                                    </div>
                                                </div>

                                                <p className="text-[10px] text-gray-400">
                                                    Báo cáo gần nhất: {store.lastReport}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <button
                                    onClick={() => setActiveTab('REPORTS')}
                                    className="bg-white rounded-xl border border-gray-200 p-5 text-left hover:border-blue-300 hover:shadow-md transition-all group"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                        <span className="material-symbols-outlined text-2xl">assignment</span>
                                    </div>
                                    <h4 className="font-bold text-gray-800 mb-1">Duyệt Báo Cáo</h4>
                                    <p className="text-xs text-gray-400">Xem và phê duyệt các báo cáo chờ xử lý</p>
                                </button>

                                <button
                                    onClick={() => setActiveTab('DISCREPANCIES')}
                                    className="bg-white rounded-xl border border-gray-200 p-5 text-left hover:border-red-300 hover:shadow-md transition-all group"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                        <span className="material-symbols-outlined text-2xl">troubleshoot</span>
                                    </div>
                                    <h4 className="font-bold text-gray-800 mb-1">Xử Lý Chênh Lệch</h4>
                                    <p className="text-xs text-gray-400">Phân tích và giải quyết sản phẩm lệch kho</p>
                                </button>

                                <button
                                    onClick={() => navigate('/recovery')}
                                    className="bg-white rounded-xl border border-gray-200 p-5 text-left hover:border-purple-300 hover:shadow-md transition-all group"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                        <span className="material-symbols-outlined text-2xl">account_balance_wallet</span>
                                    </div>
                                    <h4 className="font-bold text-gray-800 mb-1">Truy Thu</h4>
                                    <p className="text-xs text-gray-400">Quản lý và theo dõi các phiếu truy thu</p>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* REPORTS TAB */}
                    {activeTab === 'REPORTS' && (
                        <div className="space-y-6">
                            {/* Filters */}
                            <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-4 items-center">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Chi Nhánh</label>
                                    <select
                                        value={filterStore}
                                        onChange={e => setFilterStore(e.target.value)}
                                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 min-w-[150px]"
                                    >
                                        <option value="ALL">Tất cả</option>
                                        <option value="BEE">SM BEE</option>
                                        <option value="PLAZA">SM PLAZA</option>
                                        <option value="MIỀN ĐÔNG">SM MIỀN ĐÔNG</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Trạng Thái</label>
                                    <select
                                        value={filterStatus}
                                        onChange={e => setFilterStatus(e.target.value)}
                                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 min-w-[150px]"
                                    >
                                        <option value="ALL">Tất cả</option>
                                        <option value="PENDING">Chờ duyệt</option>
                                        <option value="APPROVED">Đã duyệt</option>
                                        <option value="REJECTED">Từ chối</option>
                                    </select>
                                </div>
                                <div className="flex-1" />
                                <div className="text-sm text-gray-500">
                                    Hiển thị <span className="font-bold text-gray-800">{filteredReports.length}</span> báo cáo
                                </div>
                            </div>

                            {/* Reports Table */}
                            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase">
                                            <tr>
                                                <th className="px-6 py-3 text-left">Ngày / Ca</th>
                                                <th className="px-6 py-3 text-left">Chi Nhánh</th>
                                                <th className="px-6 py-3 text-left">Nhân Viên</th>
                                                <th className="px-6 py-3 text-center">Tổng SP</th>
                                                <th className="px-6 py-3 text-center">Khớp</th>
                                                <th className="px-6 py-3 text-center">Lệch</th>
                                                <th className="px-6 py-3 text-center">Trạng Thái</th>
                                                <th className="px-6 py-3 text-right">Thao Tác</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {filteredReports.map(report => (
                                                <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="font-bold text-gray-800">{report.date}</div>
                                                        <div className="text-xs text-gray-400">Ca {report.shift} • {report.submittedAt}</div>
                                                    </td>
                                                    <td className="px-6 py-4 font-medium">{report.store}</td>
                                                    <td className="px-6 py-4 text-gray-600">{report.employee}</td>
                                                    <td className="px-6 py-4 text-center font-bold">{report.totalItems}</td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="text-green-600 font-bold">{report.matchedItems}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`font-bold ${report.discrepancies > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                                            {report.discrepancies}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${report.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                                                report.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                                                    'bg-yellow-100 text-yellow-700'
                                                            }`}>
                                                            {report.status === 'APPROVED' ? 'Đã duyệt' : report.status === 'REJECTED' ? 'Từ chối' : 'Chờ duyệt'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        {report.status === 'PENDING' && (
                                                            <div className="flex justify-end gap-2">
                                                                <button
                                                                    onClick={() => handleApprove(report.id)}
                                                                    className="p-1 text-green-600 hover:bg-green-50 rounded"
                                                                    title="Duyệt"
                                                                >
                                                                    <span className="material-symbols-outlined text-lg">check_circle</span>
                                                                </button>
                                                                <button
                                                                    onClick={() => handleReject(report.id)}
                                                                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                                                                    title="Từ chối"
                                                                >
                                                                    <span className="material-symbols-outlined text-lg">cancel</span>
                                                                </button>
                                                            </div>
                                                        )}
                                                        <button className="p-1 text-gray-400 hover:bg-gray-100 rounded ml-1" title="Xem chi tiết">
                                                            <span className="material-symbols-outlined text-lg">visibility</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* DISCREPANCIES TAB */}
                    {activeTab === 'DISCREPANCIES' && (
                        <div className="space-y-6">
                            <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-100 rounded-xl p-4 flex items-start gap-3">
                                <span className="material-symbols-outlined text-red-500 mt-0.5">warning</span>
                                <div>
                                    <h4 className="font-bold text-gray-800 text-sm">Quản lý chênh lệch</h4>
                                    <p className="text-xs text-gray-600 mt-1">
                                        Danh sách các sản phẩm có sự khác biệt giữa số liệu hệ thống và thực tế.
                                        Xử lý kịp thời để đảm bảo tính chính xác của tồn kho.
                                    </p>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                                    <h4 className="font-bold text-gray-700">Sản Phẩm Chênh Lệch</h4>
                                    <button className="text-sm text-blue-600 font-bold hover:underline flex items-center gap-1">
                                        <span className="material-symbols-outlined text-sm">filter_list</span>
                                        Lọc
                                    </button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase">
                                            <tr>
                                                <th className="px-6 py-3 text-left">Sản Phẩm</th>
                                                <th className="px-6 py-3 text-left">Chi Nhánh</th>
                                                <th className="px-6 py-3 text-center">Hệ thống</th>
                                                <th className="px-6 py-3 text-center">Thực tế</th>
                                                <th className="px-6 py-3 text-center">Chênh lệch</th>
                                                <th className="px-6 py-3 text-right">Thao tác</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {[
                                                { name: 'Sữa Vinamilk 1L', barcode: '8934588012348', store: 'BEE', system: 50, actual: 45, diff: -5 },
                                                { name: 'Bánh mì Sandwich', barcode: '8934588012349', store: 'PLAZA', system: 30, actual: 32, diff: 2 },
                                                { name: 'Nước suối Aquafina', barcode: '8934588012350', store: 'BEE', system: 100, actual: 95, diff: -5 }
                                            ].map((item, i) => (
                                                <tr key={i} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4">
                                                        <div className="font-bold text-gray-800">{item.name}</div>
                                                        <div className="text-xs text-gray-400 font-mono">{item.barcode}</div>
                                                    </td>
                                                    <td className="px-6 py-4 font-medium">{item.store}</td>
                                                    <td className="px-6 py-4 text-center">{item.system}</td>
                                                    <td className="px-6 py-4 text-center">{item.actual}</td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`font-bold ${item.diff < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                            {item.diff > 0 ? '+' : ''}{item.diff}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button className="px-3 py-1 bg-red-50 text-red-600 rounded text-xs font-bold hover:bg-red-100">
                                                            Tạo phiếu truy thu
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default InventoryReview;
