import React, { useState, useEffect } from 'react';
import { RecoveryService } from '../../../services/recovery';
import type { RecoveryItem, RecoveryHistoryEntry, RecoveryStatus } from '../../../types/recovery';
import ConfirmModal from '../../../components/ConfirmModal';

interface RecoveryDetailModalProps {
    item: RecoveryItem;
    toast: any;
    onClose: (shouldRefresh?: boolean) => void;
}

const RecoveryDetailModal: React.FC<RecoveryDetailModalProps> = ({ item, toast, onClose }) => {
    const [currentItem, setCurrentItem] = useState<RecoveryItem>(item);
    const [history, setHistory] = useState<RecoveryHistoryEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState<string | null>(null);

    // Action modals
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [showRecoverModal, setShowRecoverModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [recoveredAmount, setRecoveredAmount] = useState<number>(currentItem.total_amount);
    const [pendingConfirm, setPendingConfirm] = useState<{ type: 'approve' | 'inProgress' | 'cancel'; title: string; message: string } | null>(null);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        try {
            const data = await RecoveryService.getHistory(currentItem.id);
            setHistory(data);
        } catch (error) {
            console.error('[RecoveryDetailModal] Load history error:', error);
        }
    };

    const refreshItem = async () => {
        setLoading(true);
        try {
            const data = await RecoveryService.getRecoveryItem(currentItem.id);
            if (data) {
                setCurrentItem(data);
            }
        } catch (error) {
            console.error('[RecoveryDetailModal] Refresh error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async () => {
        setPendingConfirm({ type: 'approve', title: 'Duyệt phiếu', message: 'Xác nhận duyệt phiếu truy thu này?' });
    };

    const executeApprove = async () => {
        setPendingConfirm(null);
        setProcessing('APPROVE');
        try {
            const result = await RecoveryService.approveRecovery(currentItem.id);
            if (result.success) {
                toast.success('Đã duyệt phiếu truy thu');
                await refreshItem();
                await loadHistory();
            } else {
                toast.error(result.error || 'Không thể duyệt');
            }
        } catch (error: any) {
            toast.error('Lỗi hệ thống: ' + error.message);
        } finally {
            setProcessing(null);
        }
    };

    const handleReject = async () => {
        if (!rejectReason.trim()) {
            toast.error('Vui lòng nhập lý do từ chối');
            return;
        }

        setProcessing('REJECT');
        try {
            const result = await RecoveryService.rejectRecovery(currentItem.id, rejectReason);
            if (result.success) {
                toast.success('Đã từ chối phiếu truy thu');
                setShowRejectModal(false);
                setRejectReason('');
                await refreshItem();
                await loadHistory();
            } else {
                toast.error(result.error || 'Không thể từ chối');
            }
        } catch (error: any) {
            toast.error('Lỗi hệ thống: ' + error.message);
        } finally {
            setProcessing(null);
        }
    };

    const handleMarkInProgress = async () => {
        setPendingConfirm({ type: 'inProgress', title: 'Bắt đầu truy thu', message: 'Bắt đầu quá trình truy thu?' });
    };

    const executeMarkInProgress = async () => {
        setPendingConfirm(null);
        setProcessing('IN_PROGRESS');
        try {
            const result = await RecoveryService.markInProgress(currentItem.id);
            if (result.success) {
                toast.success('Đã chuyển sang trạng thái đang thu');
                await refreshItem();
                await loadHistory();
            } else {
                toast.error(result.error || 'Không thể cập nhật');
            }
        } catch (error: any) {
            toast.error('Lỗi hệ thống: ' + error.message);
        } finally {
            setProcessing(null);
        }
    };

    const handleRecover = async () => {
        if (recoveredAmount < 0) {
            toast.error('Số tiền không hợp lệ');
            return;
        }

        setProcessing('RECOVER');
        try {
            const result = await RecoveryService.markAsRecovered(currentItem.id, recoveredAmount);
            if (result.success) {
                toast.success('Đã hoàn thành truy thu');
                setShowRecoverModal(false);
                await refreshItem();
                await loadHistory();
            } else {
                toast.error(result.error || 'Không thể hoàn thành');
            }
        } catch (error: any) {
            toast.error('Lỗi hệ thống: ' + error.message);
        } finally {
            setProcessing(null);
        }
    };

    const handleCancel = async () => {
        setPendingConfirm({ type: 'cancel', title: 'Hủy phiếu', message: 'Xác nhận hủy phiếu truy thu này?' });
    };

    const executeCancel = async () => {
        setPendingConfirm(null);
        setProcessing('CANCEL');
        try {
            const result = await RecoveryService.cancelRecovery(currentItem.id);
            if (result.success) {
                toast.success('Đã hủy phiếu truy thu');
                await refreshItem();
                await loadHistory();
            } else {
                toast.error(result.error || 'Không thể hủy');
            }
        } catch (error: any) {
            toast.error('Lỗi hệ thống: ' + error.message);
        } finally {
            setProcessing(null);
        }
    };

    const getStatusBadge = (status: RecoveryStatus) => {
        const badges = {
            PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Chờ duyệt', icon: 'pending' },
            APPROVED: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Đã duyệt', icon: 'verified' },
            IN_PROGRESS: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Đang thu', icon: 'autorenew' },
            RECOVERED: { bg: 'bg-green-100', text: 'text-green-800', label: 'Đã thu', icon: 'check_circle' },
            REJECTED: { bg: 'bg-red-100', text: 'text-red-800', label: 'Từ chối', icon: 'cancel' },
            CANCELLED: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Hủy', icon: 'block' }
        };

        const badge = badges[status] || badges.PENDING;
        return (
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${badge.bg} ${badge.text}`}>
                <span className="material-symbols-outlined text-base">{badge.icon}</span>
                <span className="font-medium">{badge.label}</span>
            </div>
        );
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(amount);
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return 'Chưa cập nhật';
        return new Date(dateStr).toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                                <span className="material-symbols-outlined text-indigo-600 text-2xl">receipt_long</span>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Chi tiết phiếu truy thu</h2>
                                <p className="text-sm text-gray-500">#{currentItem.id.slice(0, 8)}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => onClose(true)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                        >
                            <span className="material-symbols-outlined text-gray-500">close</span>
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* Status & Actions */}
                    <div className="flex items-center justify-between">
                        <div>{getStatusBadge(currentItem.status_enum)}</div>

                        {/* Workflow Actions */}
                        <div className="flex items-center gap-2">
                            {currentItem.status_enum === 'PENDING' && (
                                <>
                                    <button
                                        onClick={handleApprove}
                                        disabled={!!processing}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                                    >
                                        <span className="material-symbols-outlined text-xl">check</span>
                                        <span>Duyệt</span>
                                    </button>
                                    <button
                                        onClick={() => setShowRejectModal(true)}
                                        disabled={!!processing}
                                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                                    >
                                        <span className="material-symbols-outlined text-xl">close</span>
                                        <span>Từ chối</span>
                                    </button>
                                </>
                            )}

                            {currentItem.status_enum === 'APPROVED' && (
                                <button
                                    onClick={handleMarkInProgress}
                                    disabled={!!processing}
                                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-xl">play_arrow</span>
                                    <span>Bắt đầu thu</span>
                                </button>
                            )}

                            {currentItem.status_enum === 'IN_PROGRESS' && (
                                <button
                                    onClick={() => setShowRecoverModal(true)}
                                    disabled={!!processing}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-xl">check_circle</span>
                                    <span>Hoàn thành</span>
                                </button>
                            )}

                            {!['RECOVERED', 'REJECTED', 'CANCELLED'].includes(currentItem.status_enum) && (
                                <button
                                    onClick={handleCancel}
                                    disabled={!!processing}
                                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-xl">block</span>
                                    <span>Hủy</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Product Information */}
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                        <h3 className="font-semibold text-gray-900">Thông tin sản phẩm</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm text-gray-500">Tên sản phẩm</label>
                                <p className="font-medium text-gray-900">{currentItem.product_name}</p>
                            </div>
                            <div>
                                <label className="text-sm text-gray-500">Mã vạch</label>
                                <p className="font-medium text-gray-900">{currentItem.barcode || 'N/A'}</p>
                            </div>
                            <div>
                                <label className="text-sm text-gray-500">Số lượng</label>
                                <p className="font-medium text-gray-900">{currentItem.quantity}</p>
                            </div>
                            <div>
                                <label className="text-sm text-gray-500">Đơn giá</label>
                                <p className="font-medium text-gray-900">{formatCurrency(currentItem.unit_price)}</p>
                            </div>
                        </div>
                        <div className="pt-3 border-t border-gray-200">
                            <label className="text-sm text-gray-500">Tổng tiền</label>
                            <p className="text-2xl font-bold text-indigo-600">{formatCurrency(currentItem.total_amount)}</p>
                        </div>
                    </div>

                    {/* Reason & Notes */}
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Lý do truy thu</label>
                            <p className="text-gray-900 bg-gray-50 rounded-lg p-3">{currentItem.reason}</p>
                        </div>
                        {currentItem.notes && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
                                <p className="text-gray-900 bg-gray-50 rounded-lg p-3">{currentItem.notes}</p>
                            </div>
                        )}
                    </div>

                    {/* Workflow Timeline */}
                    <div>
                        <h3 className="font-semibold text-gray-900 mb-3">Lịch sử xử lý</h3>
                        <div className="space-y-3">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                    <span className="material-symbols-outlined text-blue-600 text-base">add</span>
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900">Tạo phiếu</p>
                                    <p className="text-xs text-gray-500">{formatDate(currentItem.created_at)}</p>
                                </div>
                            </div>

                            {currentItem.submitted_at && (
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
                                        <span className="material-symbols-outlined text-yellow-600 text-base">send</span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-gray-900">Gửi duyệt</p>
                                        <p className="text-xs text-gray-500">{formatDate(currentItem.submitted_at)}</p>
                                    </div>
                                </div>
                            )}

                            {currentItem.approved_at && (
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                                        <span className="material-symbols-outlined text-green-600 text-base">check</span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-gray-900">Đã duyệt</p>
                                        <p className="text-xs text-gray-500">{formatDate(currentItem.approved_at)}</p>
                                    </div>
                                </div>
                            )}

                            {currentItem.recovered_at && (
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                                        <span className="material-symbols-outlined text-indigo-600 text-base">check_circle</span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-gray-900">Hoàn thành truy thu</p>
                                        {currentItem.recovered_amount !== undefined && (
                                            <p className="text-sm text-green-600 font-medium">
                                                Thu được: {formatCurrency(currentItem.recovered_amount)}
                                            </p>
                                        )}
                                        <p className="text-xs text-gray-500">{formatDate(currentItem.recovered_at)}</p>
                                    </div>
                                </div>
                            )}

                            {currentItem.rejected_at && (
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                                        <span className="material-symbols-outlined text-red-600 text-base">cancel</span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-gray-900">Từ chối</p>
                                        {currentItem.rejection_reason && (
                                            <p className="text-sm text-red-600">{currentItem.rejection_reason}</p>
                                        )}
                                        <p className="text-xs text-gray-500">{formatDate(currentItem.rejected_at)}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Reject Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
                    <div className="bg-white rounded-xl p-6 max-w-md w-full">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Từ chối phiếu truy thu</h3>
                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Nhập lý do từ chối..."
                            rows={4}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none mb-4"
                        />
                        <div className="flex items-center gap-3 justify-end">
                            <button
                                onClick={() => {
                                    setShowRejectModal(false);
                                    setRejectReason('');
                                }}
                                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleReject}
                                disabled={!!processing}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                            >
                                Xác nhận từ chối
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Recover Modal */}
            {showRecoverModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
                    <div className="bg-white rounded-xl p-6 max-w-md w-full">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Hoàn thành truy thu</h3>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Số tiền đã thu (VNĐ)
                            </label>
                            <input
                                type="number"
                                value={recoveredAmount}
                                onChange={(e) => setRecoveredAmount(parseFloat(e.target.value) || 0)}
                                min="0"
                                step="1000"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Tổng tiền cần thu: {formatCurrency(currentItem.total_amount)}
                            </p>
                        </div>
                        <div className="flex items-center gap-3 justify-end">
                            <button
                                onClick={() => {
                                    setShowRecoverModal(false);
                                    setRecoveredAmount(currentItem.total_amount);
                                }}
                                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleRecover}
                                disabled={!!processing}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                            >
                                Hoàn thành
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={!!pendingConfirm}
                title={pendingConfirm?.title || ''}
                message={pendingConfirm?.message || ''}
                variant={pendingConfirm?.type === 'cancel' ? 'danger' : 'info'}
                confirmText={pendingConfirm?.type === 'approve' ? 'Duyệt' : pendingConfirm?.type === 'inProgress' ? 'Bắt đầu' : 'Hủy phiếu'}
                onConfirm={() => {
                    if (pendingConfirm?.type === 'approve') executeApprove();
                    else if (pendingConfirm?.type === 'inProgress') executeMarkInProgress();
                    else if (pendingConfirm?.type === 'cancel') executeCancel();
                }}
                onCancel={() => setPendingConfirm(null)}
                loading={!!processing}
            />
        </div>
    );
};

export default RecoveryDetailModal;
