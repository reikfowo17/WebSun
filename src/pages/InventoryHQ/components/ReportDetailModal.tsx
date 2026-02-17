import React, { useState, useEffect } from 'react';
import { InventoryService } from '../../../services';
import ReportCommentsSection from './ReportCommentsSection';

interface ToastFn {
    success: (msg: string) => void;
    error: (msg: string) => void;
    info: (msg: string) => void;
    warning: (msg: string) => void;
}

interface ReportDetailModalProps {
    reportId: string;
    toast: ToastFn;
    onClose: () => void;
}

interface ReportDetail {
    id: string;
    store_code: string;
    store_name: string;
    shift: number;
    check_date: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    submitted_by: string;
    submitted_at: string;
    reviewed_by?: string;
    reviewed_at?: string;
    rejection_reason?: string;
    total_items: number;
    matched_items: number;
    missing_items: number;
    over_items: number;
}

const ReportDetailModal: React.FC<ReportDetailModalProps> = ({ reportId, toast, onClose }) => {
    const [report, setReport] = useState<ReportDetail | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadReportDetail();
    }, [reportId]);

    const loadReportDetail = async () => {
        setLoading(true);
        try {
            const result = await InventoryService.getReportDetail(reportId);
            if (result.success && result.report) {
                setReport(result.report);
            }
        } catch (error) {
            console.error('[ReportDetail] Load error:', error);
            toast.error('Không thể tải chi tiết báo cáo');
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const badges = {
            PENDING: {
                bg: 'bg-yellow-100',
                text: 'text-yellow-800',
                icon: 'pending',
                label: 'Chờ duyệt'
            },
            APPROVED: {
                bg: 'bg-green-100',
                text: 'text-green-800',
                icon: 'check_circle',
                label: 'Đã duyệt'
            },
            REJECTED: {
                bg: 'bg-red-100',
                text: 'text-red-800',
                icon: 'cancel',
                label: 'Từ chối'
            }
        };

        const badge = badges[status as keyof typeof badges] || badges.PENDING;

        return (
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${badge.bg} ${badge.text}`}>
                <span className="material-symbols-outlined text-base">{badge.icon}</span>
                <span className="font-medium">{badge.label}</span>
            </div>
        );
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // FIX #5: Separate accuracy (matched/total) from completion (checked/total)
    const getAccuracyPercentage = () => {
        if (!report || report.total_items === 0) return 0;
        return Math.round((report.matched_items / report.total_items) * 100);
    };

    const getCompletionPercentage = () => {
        if (!report || report.total_items === 0) return 0;
        const checked = report.matched_items + report.missing_items + report.over_items;
        return Math.round((checked / report.total_items) * 100);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                                <span className="material-symbols-outlined text-indigo-600 text-2xl">assignment</span>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Chi tiết báo cáo kiểm kho</h2>
                                <p className="text-sm text-gray-500">#{reportId.slice(0, 8)}</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                        >
                            <span className="material-symbols-outlined text-gray-500">close</span>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {loading ? (
                        // Loading skeleton
                        <div className="animate-pulse space-y-4">
                            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                            <div className="h-40 bg-gray-200 rounded"></div>
                            <div className="h-40 bg-gray-200 rounded"></div>
                        </div>
                    ) : !report ? (
                        <div className="text-center py-12">
                            <span className="material-symbols-outlined text-6xl text-gray-300 mb-2">error</span>
                            <p className="text-gray-500">Không tìm thấy báo cáo</p>
                        </div>
                    ) : (
                        <>
                            {/* Status & Store Info */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-2xl font-bold text-gray-900">{report.store_name}</h3>
                                    <p className="text-sm text-gray-500">
                                        Ca {report.shift} • {new Date(report.check_date).toLocaleDateString('vi-VN')}
                                    </p>
                                </div>
                                {getStatusBadge(report.status)}
                            </div>

                            {/* Stats Overview */}
                            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="text-center">
                                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm">
                                            <span className="material-symbols-outlined text-indigo-600 text-3xl">inventory_2</span>
                                        </div>
                                        <p className="text-sm text-gray-600">Tổng sản phẩm</p>
                                        <p className="text-2xl font-bold text-gray-900">{report.total_items}</p>
                                    </div>

                                    <div className="text-center">
                                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm">
                                            <span className="material-symbols-outlined text-green-600 text-3xl">check_circle</span>
                                        </div>
                                        <p className="text-sm text-gray-600">Khớp</p>
                                        <p className="text-2xl font-bold text-green-600">{report.matched_items}</p>
                                    </div>

                                    <div className="text-center">
                                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm">
                                            <span className="material-symbols-outlined text-red-600 text-3xl">remove_circle</span>
                                        </div>
                                        <p className="text-sm text-gray-600">Thiếu</p>
                                        <p className="text-2xl font-bold text-red-600">{report.missing_items}</p>
                                    </div>

                                    <div className="text-center">
                                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm">
                                            <span className="material-symbols-outlined text-blue-600 text-3xl">add_circle</span>
                                        </div>
                                        <p className="text-sm text-gray-600">Thừa</p>
                                        <p className="text-2xl font-bold text-blue-600">{report.over_items}</p>
                                    </div>
                                </div>

                                {/* Progress Bars */}
                                <div className="mt-6 space-y-4">
                                    {/* Completion */}
                                    <div>
                                        <div className="flex justify-between text-sm mb-2">
                                            <span className="font-medium text-gray-700">Tiến độ kiểm</span>
                                            <span className="font-bold text-indigo-600">{getCompletionPercentage()}%</span>
                                        </div>
                                        <div className="h-3 bg-white/50 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
                                                style={{ width: `${getCompletionPercentage()}%` }}
                                            />
                                        </div>
                                    </div>
                                    {/* Accuracy */}
                                    <div>
                                        <div className="flex justify-between text-sm mb-2">
                                            <span className="font-medium text-gray-700">Tỷ lệ khớp</span>
                                            <span className="font-bold text-green-600">{getAccuracyPercentage()}%</span>
                                        </div>
                                        <div className="h-3 bg-white/50 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all"
                                                style={{ width: `${getAccuracyPercentage()}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Submission Info */}
                            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                                <h4 className="font-semibold text-gray-900">Thông tin nộp báo cáo</h4>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-gray-500">Người nộp</p>
                                        <p className="font-medium text-gray-900">{report.submitted_by}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Thời gian nộp</p>
                                        <p className="font-medium text-gray-900">{formatDate(report.submitted_at)}</p>
                                    </div>
                                </div>

                                {report.reviewed_at && (
                                    <>
                                        <div className="border-t border-gray-200 pt-3 grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-xs text-gray-500">Người duyệt</p>
                                                <p className="font-medium text-gray-900">{report.reviewed_by || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500">Thời gian duyệt</p>
                                                <p className="font-medium text-gray-900">{formatDate(report.reviewed_at)}</p>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {report.rejection_reason && (
                                    <div className="border-t border-gray-200 pt-3">
                                        <p className="text-xs text-gray-500 mb-1">Lý do từ chối</p>
                                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                            <p className="text-sm text-red-800">{report.rejection_reason}</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Comments Section */}
                            <div className="border-t border-gray-200 pt-6">
                                <ReportCommentsSection reportId={reportId} toast={toast} />
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReportDetailModal;
