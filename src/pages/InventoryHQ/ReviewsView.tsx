import React, { useState, useEffect } from 'react';
import { InventoryService } from '../../services';
import { User } from '../../types';
import { STORES } from '../../constants';
import ConfirmModal from '../../components/ConfirmModal';
import PromptModal from '../../components/PromptModal';

interface ReviewsViewProps {
    toast: any;
    user: User;
}

interface ReportSummary {
    id: string;
    store: string;
    shift: number;
    date: string;
    submittedBy: string;
    submittedAt: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    total: number;
    matched: number;
    missing: number;
    over: number;
}

const ReviewsView: React.FC<ReviewsViewProps> = ({ toast, user }) => {
    const [reports, setReports] = useState<ReportSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedReport, setSelectedReport] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('PENDING');
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        loadReports();
    }, [filterStatus]);

    const loadReports = async () => {
        setLoading(true);
        try {
            const res = await InventoryService.getReports(filterStatus === 'ALL' ? undefined : filterStatus);
            if (res.success) {
                setReports(res.reports || []);
            }
        } catch (error) {
            toast.error('Không thể tải báo cáo');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (reportId: string) => {
        setSelectedReport(reportId);
        setShowApproveModal(true);
    };

    const doApprove = async () => {
        if (!selectedReport) return;

        setShowApproveModal(false);
        setProcessing(true);

        try {
            const res = await InventoryService.reviewReport(selectedReport, 'APPROVED', user.id);
            if (res.success) {
                toast.success('Đã phê duyệt báo cáo');
                loadReports();
            } else {
                toast.error(res.message || 'Lỗi phê duyệt');
            }
        } catch (error) {
            toast.error('Lỗi hệ thống');
        } finally {
            setProcessing(false);
            setSelectedReport(null);
        }
    };

    const handleReject = (reportId: string) => {
        setSelectedReport(reportId);
        setShowRejectModal(true);
    };

    const doReject = async (reason: string) => {
        if (!selectedReport) return;

        setShowRejectModal(false);
        setProcessing(true);

        try {
            const res = await InventoryService.reviewReport(selectedReport, 'REJECTED', user.id, reason);
            if (res.success) {
                toast.warning('Đã từ chối báo cáo');
                loadReports();
            } else {
                toast.error(res.message || 'Lỗi từ chối');
            }
        } catch (error) {
            toast.error('Lỗi hệ thống');
        } finally {
            setProcessing(false);
            setSelectedReport(null);
        }
    };

    const getStatusBadge = (status: string) => {
        const configs = {
            PENDING: { label: 'Chờ duyệt', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
            APPROVED: { label: 'Đã duyệt', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
            REJECTED: { label: 'Từ chối', color: 'bg-red-100 text-red-700 border-red-200' }
        };
        const config = configs[status as keyof typeof configs] || configs.PENDING;
        return (
            <span className={`px-2 py-1 rounded-lg text-xs font-bold border ${config.color}`}>
                {config.label}
            </span>
        );
    };

    const getStoreColor = (storeCode: string) => {
        return STORES.find(s => s.code === storeCode)?.bgColor || 'bg-gray-100';
    };

    if (loading && reports.length === 0) {
        return (
            <div className="pt-12 text-center text-gray-400">
                <span className="material-symbols-outlined text-4xl mb-2 animate-spin">sync</span>
                <p>Đang tải báo cáo...</p>
            </div>
        );
    }

    return (
        <div className="pt-6 space-y-4">
            {/* Filter Tabs */}
            <div className="flex items-center gap-2 bg-white rounded-xl p-2 border border-gray-200 w-fit">
                {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map(status => (
                    <button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filterStatus === status
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'text-gray-500 hover:bg-gray-50'
                            }`}
                    >
                        {status === 'ALL' ? 'Tất cả' :
                            status === 'PENDING' ? 'Chờ duyệt' :
                                status === 'APPROVED' ? 'Đã duyệt' : 'Từ chối'}
                    </button>
                ))}
            </div>

            {/* Reports Grid */}
            {reports.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
                    <span className="material-symbols-outlined text-6xl text-gray-200 mb-3">description</span>
                    <p className="text-gray-400 font-medium">Chưa có báo cáo nào</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {reports.map(report => {
                        const completion = report.total > 0 ? Math.round(((report.matched + report.missing + report.over) / report.total) * 100) : 0;
                        const hasDiscrepancy = report.missing > 0 || report.over > 0;

                        return (
                            <div
                                key={report.id}
                                className="bg-white rounded-2xl border border-gray-200 hover:shadow-lg transition-all overflow-hidden"
                            >
                                {/* Header */}
                                <div className={`${getStoreColor(report.store)} ${STORES.find(s => s.code === report.store)?.color || 'text-gray-700'} p-4 border-b border-gray-100`}>
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <h3 className="font-black text-lg">{STORES.find(s => s.code === report.store)?.name || report.store}</h3>
                                            <p className="text-xs opacity-75 font-medium">
                                                Ca {report.shift} • {new Date(report.date).toLocaleDateString('vi-VN')}
                                            </p>
                                        </div>
                                        {getStatusBadge(report.status)}
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="p-4 space-y-3">
                                    {/* Progress */}
                                    <div>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-gray-500 font-medium">Hoàn thành</span>
                                            <span className="font-bold text-gray-700">{completion}%</span>
                                        </div>
                                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all ${hasDiscrepancy ? 'bg-orange-500' : 'bg-emerald-500'}`}
                                                style={{ width: `${completion}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Details */}
                                    <div className="grid grid-cols-3 gap-2 text-center">
                                        <div className="bg-emerald-50 rounded-lg p-2">
                                            <p className="text-xs text-gray-500 font-medium">Khớp</p>
                                            <p className="text-lg font-black text-emerald-600">{report.matched}</p>
                                        </div>
                                        <div className="bg-red-50 rounded-lg p-2">
                                            <p className="text-xs text-gray-500 font-medium">Thiếu</p>
                                            <p className="text-lg font-black text-red-600">{report.missing}</p>
                                        </div>
                                        <div className="bg-blue-50 rounded-lg p-2">
                                            <p className="text-xs text-gray-500 font-medium">Thừa</p>
                                            <p className="text-lg font-black text-blue-600">{report.over}</p>
                                        </div>
                                    </div>

                                    {/* Submitter */}
                                    <div className="pt-3 border-t border-gray-100">
                                        <p className="text-xs text-gray-400">Người nộp:</p>
                                        <p className="text-sm font-bold text-gray-700">{report.submittedBy}</p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            {new Date(report.submittedAt).toLocaleString('vi-VN')}
                                        </p>
                                    </div>

                                    {/* Actions (only for PENDING) */}
                                    {report.status === 'PENDING' && (
                                        <div className="flex gap-2 pt-3">
                                            <button
                                                onClick={() => handleReject(report.id)}
                                                className="flex-1 py-2 px-3 bg-white border border-red-200 text-red-600 rounded-xl text-sm font-bold hover:bg-red-50 transition-colors"
                                            >
                                                Từ chối
                                            </button>
                                            <button
                                                onClick={() => handleApprove(report.id)}
                                                className="flex-1 py-2 px-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors shadow-md"
                                            >
                                                Phê duyệt
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modals */}
            <ConfirmModal
                isOpen={showApproveModal}
                title="✅ Phê duyệt báo cáo"
                message="Xác nhận phê duyệt báo cáo kiểm kho này?"
                variant="info"
                confirmText="Phê duyệt"
                cancelText="Hủy"
                onConfirm={doApprove}
                onCancel={() => { setShowApproveModal(false); setSelectedReport(null); }}
                loading={processing}
            />

            <PromptModal
                isOpen={showRejectModal}
                title="❌ Từ chối báo cáo"
                message="Vui lòng nhập lý do từ chối báo cáo"
                placeholder="Ví dụ: Dữ liệu không chính xác, thiếu quá nhiều sản phẩm..."
                confirmText="Từ chối"
                cancelText="Hủy"
                onConfirm={doReject}
                onCancel={() => { setShowRejectModal(false); setSelectedReport(null); }}
            />
        </div>
    );
};

export default ReviewsView;
