import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../types';
import { useToast } from '../contexts';

interface InventoryReviewProps {
    user: User;
}

const REVIEW_CONFIG = {
    STORES: [
        { id: 'BEE', name: 'SM BEE', color: 'bg-yellow-100 text-yellow-700' },
        { id: 'PLAZA', name: 'SM PLAZA', color: 'bg-blue-100 text-blue-700' },
        { id: 'MIỀN ĐÔNG', name: 'SM MIỀN ĐÔNG', color: 'bg-green-100 text-green-700' },
        { id: 'HT PEARL', name: 'SM HT PEARL', color: 'bg-purple-100 text-purple-700' },
        { id: 'GREEN TOPAZ', name: 'SM GREEN TOPAZ', color: 'bg-teal-100 text-teal-700' },
        { id: 'EMERALD', name: 'SM EMERALD', color: 'bg-pink-100 text-pink-700' }
    ],
    STATUS_OPTIONS: [
        { value: 'TRUY THU', label: 'Truy Thu', color: 'bg-red-100 text-red-700 border-red-200' },
        { value: 'ĐÃ XỬ LÝ', label: 'Đã Xử Lý', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
        { value: 'CHỜ XÁC MINH', label: 'Chờ Xác Minh', color: 'bg-amber-100 text-amber-700 border-amber-200' },
        { value: 'BỎ QUA', label: 'Bỏ Qua', color: 'bg-gray-100 text-gray-500 border-gray-200' }
    ],
    REASON_OPTIONS: [
        { value: 'Mất hàng', icon: 'remove_shopping_cart', color: 'bg-red-50' },
        { value: 'Hư hỏng', icon: 'broken_image', color: 'bg-orange-50' },
        { value: 'Sai nhập liệu', icon: 'edit_note', color: 'bg-blue-50' },
        { value: 'Hết hạn sử dụng', icon: 'event_busy', color: 'bg-amber-50' },
        { value: 'Khách trả lại', icon: 'undo', color: 'bg-purple-50' },
        { value: 'Kiểm đếm sai', icon: 'calculate', color: 'bg-cyan-50' },
        { value: 'Lý do khác', icon: 'more_horiz', color: 'bg-gray-50' }
    ]
};

interface InventoryReport {
    id: string;
    date: string;
    store: string;
    shift: number;
    employee: string;
    totalItems: number;
    matched: number;
    missing: number;
    over: number;
    missingValue: number;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    approvedBy?: string;
    approvedAt?: string;
}

interface DiscrepancyItem {
    id: string;
    reportId: string;
    productName: string;
    barcode: string;
    systemStock: number;
    actualStock: number;
    diff: number;
    unitPrice: number;
    totalAmount: number;
    reason?: string;
    status: string;
    note?: string;
    lastInventoryDate?: string;
}

// Mock data
const MOCK_REPORTS: InventoryReport[] = [
    { id: '1', date: '2026-02-04', store: 'BEE', shift: 1, employee: 'Nguyễn Văn A', totalItems: 120, matched: 110, missing: 8, over: 2, missingValue: 450000, status: 'PENDING' },
    { id: '2', date: '2026-02-04', store: 'PLAZA', shift: 2, employee: 'Trần Thị B', totalItems: 95, matched: 90, missing: 3, over: 2, missingValue: 180000, status: 'APPROVED', approvedBy: 'Admin', approvedAt: '2026-02-04 15:30' },
    { id: '3', date: '2026-02-03', store: 'MIỀN ĐÔNG', shift: 1, employee: 'Lê Văn C', totalItems: 85, matched: 85, missing: 0, over: 0, missingValue: 0, status: 'APPROVED', approvedBy: 'Admin', approvedAt: '2026-02-03 18:00' },
    { id: '4', date: '2026-02-03', store: 'HT PEARL', shift: 3, employee: 'Phạm Thị D', totalItems: 78, matched: 70, missing: 5, over: 3, missingValue: 320000, status: 'PENDING' }
];

const MOCK_DISCREPANCIES: DiscrepancyItem[] = [
    { id: 'd1', reportId: '1', productName: 'Sữa Vinamilk 1L', barcode: '8934673532168', systemStock: 50, actualStock: 45, diff: -5, unitPrice: 32000, totalAmount: 160000, reason: 'Mất hàng', status: 'TRUY THU' },
    { id: 'd2', reportId: '1', productName: 'Coca Cola 330ml', barcode: '5000112637786', systemStock: 100, actualStock: 97, diff: -3, unitPrice: 15000, totalAmount: 45000, reason: 'Hư hỏng', status: 'ĐÃ XỬ LÝ' },
    { id: 'd3', reportId: '1', productName: 'Bánh Oreo 133g', barcode: '8935001725619', systemStock: 30, actualStock: 32, diff: 2, unitPrice: 25000, totalAmount: -50000, status: 'CHỜ XÁC MINH' },
    { id: 'd4', reportId: '4', productName: 'Nước mắm Nam Ngư 500ml', barcode: '8934804002125', systemStock: 25, actualStock: 20, diff: -5, unitPrice: 28000, totalAmount: 140000, reason: 'Kiểm đếm sai', status: 'CHỜ XÁC MINH' }
];

const InventoryReview: React.FC<InventoryReviewProps> = ({ user }) => {
    const navigate = useNavigate();
    const toast = useToast();
    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'DISCREPANCIES' | 'RECOVERY'>('OVERVIEW');
    const [reports, setReports] = useState<InventoryReport[]>(MOCK_REPORTS);
    const [discrepancies, setDiscrepancies] = useState<DiscrepancyItem[]>(MOCK_DISCREPANCIES);
    const [selectedStore, setSelectedStore] = useState<string>('ALL');
    const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
    const [dateRange, setDateRange] = useState<string>('today');
    const [selectedReport, setSelectedReport] = useState<InventoryReport | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [loading, setLoading] = useState(false);

    // Stats
    const stats = useMemo(() => {
        const pending = reports.filter(r => r.status === 'PENDING').length;
        const totalMissing = reports.reduce((sum, r) => sum + r.missing, 0);
        const totalMissingValue = reports.reduce((sum, r) => sum + r.missingValue, 0);
        const todayReports = reports.filter(r => r.date === '2026-02-04').length;
        return { pending, totalMissing, totalMissingValue, todayReports };
    }, [reports]);

    // Filtered reports
    const filteredReports = useMemo(() => {
        return reports.filter(r => {
            const matchStore = selectedStore === 'ALL' || r.store === selectedStore;
            const matchStatus = selectedStatus === 'ALL' || r.status === selectedStatus;
            return matchStore && matchStatus;
        });
    }, [reports, selectedStore, selectedStatus]);

    // Report discrepancies
    const reportDiscrepancies = useMemo(() => {
        if (!selectedReport) return [];
        return discrepancies.filter(d => d.reportId === selectedReport.id);
    }, [discrepancies, selectedReport]);

    const handleApprove = async (reportId: string) => {
        if (!confirm('Xác nhận duyệt báo cáo này?')) return;

        setLoading(true);
        try {
            await new Promise(r => setTimeout(r, 800));
            setReports(prev => prev.map(r =>
                r.id === reportId
                    ? { ...r, status: 'APPROVED' as const, approvedBy: user.name, approvedAt: new Date().toLocaleString('vi-VN') }
                    : r
            ));
            toast.success('Đã duyệt báo cáo');
        } finally {
            setLoading(false);
        }
    };

    const handleReject = async (reportId: string) => {
        const reason = prompt('Lý do từ chối:');
        if (!reason) return;

        setLoading(true);
        try {
            await new Promise(r => setTimeout(r, 800));
            setReports(prev => prev.map(r =>
                r.id === reportId ? { ...r, status: 'REJECTED' as const } : r
            ));
            toast.success('Đã từ chối báo cáo');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateDiscrepancy = (id: string, field: string, value: string) => {
        setDiscrepancies(prev => prev.map(d =>
            d.id === id ? { ...d, [field]: value } : d
        ));
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
    };

    const getStoreColor = (storeId: string) => {
        return REVIEW_CONFIG.STORES.find(s => s.id === storeId)?.color || 'bg-gray-100 text-gray-700';
    };

    const getStatusBadge = (status: string) => {
        const config = REVIEW_CONFIG.STATUS_OPTIONS.find(s => s.value === status);
        if (config) return config;

        switch (status) {
            case 'APPROVED': return { value: status, label: 'Đã Duyệt', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
            case 'PENDING': return { value: status, label: 'Chờ Duyệt', color: 'bg-amber-100 text-amber-700 border-amber-200' };
            case 'REJECTED': return { value: status, label: 'Từ Chối', color: 'bg-red-100 text-red-700 border-red-200' };
            default: return { value: status, label: status, color: 'bg-gray-100 text-gray-600 border-gray-200' };
        }
    };

    return (
        <div className="h-full flex flex-col overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50/30">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200/50 px-8 py-5 flex justify-between items-center sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-200">
                        <span className="material-symbols-outlined text-white text-2xl">fact_check</span>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-gray-900">Duyệt Báo Cáo Kiểm Kho</h2>
                        <p className="text-sm text-gray-500">Xem xét và phê duyệt báo cáo từ chi nhánh</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-50 transition-all shadow-sm">
                        <span className="material-symbols-outlined text-lg">download</span>
                        Xuất Excel
                    </button>
                    <button className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl font-bold text-sm hover:shadow-lg hover:shadow-blue-200 transition-all">
                        <span className="material-symbols-outlined text-lg">refresh</span>
                        Làm mới
                    </button>
                </div>
            </header>

            {/* Stats Bar */}
            <div className="bg-white/60 backdrop-blur-sm border-b border-gray-100 px-8 py-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                            <span className="material-symbols-outlined">pending_actions</span>
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-400 uppercase font-bold">Chờ duyệt</p>
                            <p className="text-xl font-black text-amber-600">{stats.pending}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                            <span className="material-symbols-outlined">today</span>
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-400 uppercase font-bold">Báo cáo hôm nay</p>
                            <p className="text-xl font-black text-blue-600">{stats.todayReports}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                            <span className="material-symbols-outlined">trending_down</span>
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-400 uppercase font-bold">Tổng thiếu</p>
                            <p className="text-xl font-black text-red-600">{stats.totalMissing} SP</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                            <span className="material-symbols-outlined">payments</span>
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-400 uppercase font-bold">Giá trị thiếu</p>
                            <p className="text-xl font-black text-rose-600">{formatCurrency(stats.totalMissingValue)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white/60 backdrop-blur-sm border-b border-gray-100 px-8">
                <nav className="flex gap-1">
                    {[
                        { key: 'OVERVIEW', label: 'Tổng Quan', icon: 'dashboard' },
                        { key: 'DISCREPANCIES', label: 'Chênh Lệch', icon: 'compare_arrows' },
                        { key: 'RECOVERY', label: 'Truy Thu', icon: 'account_balance' }
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key as any)}
                            className={`px-5 py-4 flex items-center gap-2 font-semibold text-sm transition-all relative ${activeTab === tab.key
                                    ? 'text-blue-600'
                                    : 'text-gray-400 hover:text-gray-600'
                                }`}
                        >
                            <span className="material-symbols-outlined text-lg">{tab.icon}</span>
                            {tab.label}
                            {activeTab === tab.key && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-indigo-500" />
                            )}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Content */}
            <main className="flex-1 overflow-y-auto p-8">
                <div className="max-w-7xl mx-auto space-y-6">

                    {/* Filters */}
                    <div className="flex flex-wrap gap-3 items-center">
                        <select
                            value={selectedStore}
                            onChange={e => setSelectedStore(e.target.value)}
                            className="px-4 py-2.5 border border-gray-200 rounded-xl bg-white text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                        >
                            <option value="ALL">Tất cả chi nhánh</option>
                            {REVIEW_CONFIG.STORES.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                        <select
                            value={selectedStatus}
                            onChange={e => setSelectedStatus(e.target.value)}
                            className="px-4 py-2.5 border border-gray-200 rounded-xl bg-white text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                        >
                            <option value="ALL">Tất cả trạng thái</option>
                            <option value="PENDING">Chờ duyệt</option>
                            <option value="APPROVED">Đã duyệt</option>
                            <option value="REJECTED">Từ chối</option>
                        </select>
                        <div className="flex-1" />
                        <span className="text-sm text-gray-400">
                            Hiển thị {filteredReports.length} / {reports.length} báo cáo
                        </span>
                    </div>

                    {/* OVERVIEW TAB */}
                    {activeTab === 'OVERVIEW' && (
                        <div className="grid gap-4">
                            {filteredReports.map(report => {
                                const statusBadge = getStatusBadge(report.status);
                                const storeColor = getStoreColor(report.store);
                                const completionRate = Math.round((report.matched / report.totalItems) * 100);

                                return (
                                    <div
                                        key={report.id}
                                        className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 p-5 hover:shadow-lg transition-all"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-4">
                                                {/* Store Badge */}
                                                <div className={`px-3 py-2 rounded-xl text-sm font-bold ${storeColor}`}>
                                                    {report.store}
                                                </div>

                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-bold text-gray-800">{report.employee}</span>
                                                        <span className="text-xs text-gray-400">•</span>
                                                        <span className="text-xs text-gray-500">Ca {report.shift}</span>
                                                        <span className="text-xs text-gray-400">•</span>
                                                        <span className="text-xs text-gray-500">{report.date}</span>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-sm">
                                                        <span className="text-gray-500">
                                                            <span className="font-bold text-gray-800">{report.totalItems}</span> sản phẩm
                                                        </span>
                                                        <span className="text-emerald-600">
                                                            <span className="font-bold">✓ {report.matched}</span> khớp
                                                        </span>
                                                        {report.missing > 0 && (
                                                            <span className="text-red-600">
                                                                <span className="font-bold">↓ {report.missing}</span> thiếu
                                                            </span>
                                                        )}
                                                        {report.over > 0 && (
                                                            <span className="text-blue-600">
                                                                <span className="font-bold">↑ {report.over}</span> thừa
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                {/* Completion Ring */}
                                                <div className="relative w-12 h-12">
                                                    <svg className="transform -rotate-90" viewBox="0 0 36 36">
                                                        <circle cx="18" cy="18" r="16" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                                                        <circle
                                                            cx="18" cy="18" r="16" fill="none"
                                                            stroke={completionRate === 100 ? '#10b981' : '#3b82f6'}
                                                            strokeWidth="3"
                                                            strokeDasharray={`${completionRate} 100`}
                                                            strokeLinecap="round"
                                                        />
                                                    </svg>
                                                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700">
                                                        {completionRate}%
                                                    </span>
                                                </div>

                                                {/* Status */}
                                                <span className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${statusBadge.color}`}>
                                                    {statusBadge.label}
                                                </span>

                                                {/* Actions */}
                                                {report.status === 'PENDING' && (
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleApprove(report.id)}
                                                            disabled={loading}
                                                            className="px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-200 transition-colors"
                                                        >
                                                            <span className="material-symbols-outlined text-sm">check</span>
                                                        </button>
                                                        <button
                                                            onClick={() => handleReject(report.id)}
                                                            disabled={loading}
                                                            className="px-3 py-2 bg-red-100 text-red-700 rounded-lg text-xs font-bold hover:bg-red-200 transition-colors"
                                                        >
                                                            <span className="material-symbols-outlined text-sm">close</span>
                                                        </button>
                                                    </div>
                                                )}

                                                <button
                                                    onClick={() => {
                                                        setSelectedReport(report);
                                                        setShowDetailModal(true);
                                                    }}
                                                    className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-sm">visibility</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Missing Value Alert */}
                                        {report.missingValue > 0 && (
                                            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                                                <div className="flex items-center gap-2 text-sm">
                                                    <span className="material-symbols-outlined text-red-500 text-lg">warning</span>
                                                    <span className="text-gray-600">Giá trị thiếu hụt:</span>
                                                    <span className="font-black text-red-600">{formatCurrency(report.missingValue)}</span>
                                                </div>
                                                {report.status === 'APPROVED' && (
                                                    <span className="text-xs text-gray-400">
                                                        Duyệt bởi {report.approvedBy} • {report.approvedAt}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* DISCREPANCIES TAB */}
                    {activeTab === 'DISCREPANCIES' && (
                        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-gray-400">compare_arrows</span>
                                    Danh Sách Chênh Lệch
                                </h3>
                                <span className="text-sm text-gray-400">{discrepancies.length} mục</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50/50 border-b border-gray-100">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Sản phẩm</th>
                                            <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-500 uppercase w-20">Hệ thống</th>
                                            <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-500 uppercase w-20">Thực tế</th>
                                            <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-500 uppercase w-20">Chênh lệch</th>
                                            <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-500 uppercase w-28">Thành tiền</th>
                                            <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase w-36">Lý do</th>
                                            <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-500 uppercase w-32">Trạng thái</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {discrepancies.map(item => {
                                            const statusBadge = getStatusBadge(item.status);
                                            return (
                                                <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <p className="font-bold text-gray-800">{item.productName}</p>
                                                        <p className="text-[10px] text-gray-400 font-mono">{item.barcode}</p>
                                                    </td>
                                                    <td className="px-4 py-4 text-center font-bold text-gray-600">{item.systemStock}</td>
                                                    <td className="px-4 py-4 text-center font-bold text-gray-600">{item.actualStock}</td>
                                                    <td className="px-4 py-4 text-center">
                                                        <span className={`inline-block px-2 py-1 rounded-lg text-xs font-black ${item.diff < 0 ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                                                            }`}>
                                                            {item.diff > 0 ? `+${item.diff}` : item.diff}
                                                        </span>
                                                    </td>
                                                    <td className={`px-4 py-4 text-right font-bold ${item.totalAmount > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                                        {formatCurrency(Math.abs(item.totalAmount))}
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <select
                                                            value={item.reason || ''}
                                                            onChange={e => handleUpdateDiscrepancy(item.id, 'reason', e.target.value)}
                                                            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500/20"
                                                        >
                                                            <option value="">-- Chọn --</option>
                                                            {REVIEW_CONFIG.REASON_OPTIONS.map(r => (
                                                                <option key={r.value} value={r.value}>{r.value}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-4 py-4 text-center">
                                                        <select
                                                            value={item.status}
                                                            onChange={e => handleUpdateDiscrepancy(item.id, 'status', e.target.value)}
                                                            className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border ${statusBadge.color} bg-transparent cursor-pointer`}
                                                        >
                                                            {REVIEW_CONFIG.STATUS_OPTIONS.map(s => (
                                                                <option key={s.value} value={s.value}>{s.label}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* RECOVERY TAB */}
                    {activeTab === 'RECOVERY' && (
                        <div className="space-y-6">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-gradient-to-br from-red-500 to-rose-500 rounded-2xl p-6 text-white">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-2xl">account_balance</span>
                                        </div>
                                        <span className="text-sm font-medium opacity-80">Tổng truy thu</span>
                                    </div>
                                    <p className="text-3xl font-black">
                                        {formatCurrency(discrepancies.filter(d => d.status === 'TRUY THU').reduce((sum, d) => sum + Math.abs(d.totalAmount), 0))}
                                    </p>
                                    <p className="text-xs opacity-60 mt-2">
                                        {discrepancies.filter(d => d.status === 'TRUY THU').length} mục cần truy thu
                                    </p>
                                </div>

                                <div className="bg-gradient-to-br from-emerald-500 to-green-500 rounded-2xl p-6 text-white">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-2xl">check_circle</span>
                                        </div>
                                        <span className="text-sm font-medium opacity-80">Đã xử lý</span>
                                    </div>
                                    <p className="text-3xl font-black">
                                        {formatCurrency(discrepancies.filter(d => d.status === 'ĐÃ XỬ LÝ').reduce((sum, d) => sum + Math.abs(d.totalAmount), 0))}
                                    </p>
                                    <p className="text-xs opacity-60 mt-2">
                                        {discrepancies.filter(d => d.status === 'ĐÃ XỬ LÝ').length} mục đã xong
                                    </p>
                                </div>

                                <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-6 text-white">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-2xl">hourglass_empty</span>
                                        </div>
                                        <span className="text-sm font-medium opacity-80">Chờ xác minh</span>
                                    </div>
                                    <p className="text-3xl font-black">
                                        {formatCurrency(discrepancies.filter(d => d.status === 'CHỜ XÁC MINH').reduce((sum, d) => sum + Math.abs(d.totalAmount), 0))}
                                    </p>
                                    <p className="text-xs opacity-60 mt-2">
                                        {discrepancies.filter(d => d.status === 'CHỜ XÁC MINH').length} mục đang chờ
                                    </p>
                                </div>
                            </div>

                            {/* Recovery Actions */}
                            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 p-6">
                                <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-gray-400">bolt</span>
                                    Thao Tác Nhanh
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <button className="p-4 bg-gray-50 hover:bg-gray-100 rounded-xl flex flex-col items-center gap-2 transition-colors">
                                        <span className="material-symbols-outlined text-2xl text-gray-600">picture_as_pdf</span>
                                        <span className="text-xs font-medium text-gray-600">Xuất PDF</span>
                                    </button>
                                    <button className="p-4 bg-gray-50 hover:bg-gray-100 rounded-xl flex flex-col items-center gap-2 transition-colors">
                                        <span className="material-symbols-outlined text-2xl text-gray-600">mail</span>
                                        <span className="text-xs font-medium text-gray-600">Gửi Email</span>
                                    </button>
                                    <button className="p-4 bg-gray-50 hover:bg-gray-100 rounded-xl flex flex-col items-center gap-2 transition-colors">
                                        <span className="material-symbols-outlined text-2xl text-gray-600">sync</span>
                                        <span className="text-xs font-medium text-gray-600">Sync KiotViet</span>
                                    </button>
                                    <button className="p-4 bg-gray-50 hover:bg-gray-100 rounded-xl flex flex-col items-center gap-2 transition-colors">
                                        <span className="material-symbols-outlined text-2xl text-gray-600">archive</span>
                                        <span className="text-xs font-medium text-gray-600">Lưu Trữ</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Detail Modal */}
            {showDetailModal && selectedReport && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
                        <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 flex justify-between items-start">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">Chi tiết báo cáo</h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    {selectedReport.store} • Ca {selectedReport.shift} • {selectedReport.date}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowDetailModal(false)}
                                className="w-10 h-10 rounded-full bg-white flex items-center justify-center hover:bg-gray-100 transition-colors shadow-sm"
                            >
                                <span className="material-symbols-outlined text-gray-500">close</span>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            {/* Report Summary */}
                            <div className="grid grid-cols-4 gap-4 mb-6">
                                <div className="text-center p-4 bg-gray-50 rounded-xl">
                                    <p className="text-2xl font-black text-gray-800">{selectedReport.totalItems}</p>
                                    <p className="text-xs text-gray-500 mt-1">Tổng SP</p>
                                </div>
                                <div className="text-center p-4 bg-emerald-50 rounded-xl">
                                    <p className="text-2xl font-black text-emerald-600">{selectedReport.matched}</p>
                                    <p className="text-xs text-emerald-600 mt-1">Khớp</p>
                                </div>
                                <div className="text-center p-4 bg-red-50 rounded-xl">
                                    <p className="text-2xl font-black text-red-600">{selectedReport.missing}</p>
                                    <p className="text-xs text-red-600 mt-1">Thiếu</p>
                                </div>
                                <div className="text-center p-4 bg-blue-50 rounded-xl">
                                    <p className="text-2xl font-black text-blue-600">{selectedReport.over}</p>
                                    <p className="text-xs text-blue-600 mt-1">Thừa</p>
                                </div>
                            </div>

                            {/* Discrepancy List */}
                            {reportDiscrepancies.length > 0 && (
                                <div>
                                    <h4 className="font-bold text-gray-700 mb-3">Danh sách chênh lệch</h4>
                                    <div className="space-y-2">
                                        {reportDiscrepancies.map(item => (
                                            <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                                <div>
                                                    <p className="font-medium text-gray-800">{item.productName}</p>
                                                    <p className="text-[10px] text-gray-400 font-mono">{item.barcode}</p>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${item.diff < 0 ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                                                        }`}>
                                                        {item.diff > 0 ? `+${item.diff}` : item.diff}
                                                    </span>
                                                    <span className="text-sm font-bold text-gray-700">
                                                        {formatCurrency(Math.abs(item.totalAmount))}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-between items-center">
                            <div>
                                <p className="text-sm text-gray-500">Người kiểm: <span className="font-bold text-gray-800">{selectedReport.employee}</span></p>
                            </div>
                            <div className="flex gap-3">
                                {selectedReport.status === 'PENDING' && (
                                    <>
                                        <button
                                            onClick={() => {
                                                handleReject(selectedReport.id);
                                                setShowDetailModal(false);
                                            }}
                                            className="px-5 py-2.5 bg-white border border-red-200 text-red-600 rounded-xl font-bold hover:bg-red-50 transition-colors"
                                        >
                                            Từ chối
                                        </button>
                                        <button
                                            onClick={() => {
                                                handleApprove(selectedReport.id);
                                                setShowDetailModal(false);
                                            }}
                                            className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-500 text-white rounded-xl font-bold hover:shadow-lg transition-all"
                                        >
                                            Phê duyệt
                                        </button>
                                    </>
                                )}
                                {selectedReport.status !== 'PENDING' && (
                                    <button
                                        onClick={() => setShowDetailModal(false)}
                                        className="px-5 py-2.5 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-colors"
                                    >
                                        Đóng
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InventoryReview;
