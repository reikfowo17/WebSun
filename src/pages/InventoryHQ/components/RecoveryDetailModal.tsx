import React, { useState, useEffect } from 'react';
import { RecoveryService } from '../../../services/recovery';
import type { RecoveryItem, RecoveryHistoryEntry, RecoveryStatus } from '../../../types/recovery';
import ConfirmModal from '../../../components/ConfirmModal';

interface RecoveryDetailModalProps {
    item: RecoveryItem;
    toast: any;
    onClose: (shouldRefresh?: boolean) => void;
}

const STATUS_CFG: Record<string, { label: string; bg: string; color: string; icon: string }> = {
    PENDING: { label: 'Chờ duyệt', bg: '#fef3c7', color: '#92400e', icon: 'schedule' },
    APPROVED: { label: 'Đã duyệt', bg: '#dbeafe', color: '#1e40af', icon: 'verified' },
    IN_PROGRESS: { label: 'Đang thu', bg: '#f3e8ff', color: '#6b21a8', icon: 'autorenew' },
    RECOVERED: { label: 'Đã thu', bg: '#d1fae5', color: '#065f46', icon: 'check_circle' },
    REJECTED: { label: 'Từ chối', bg: '#fef2f2', color: '#991b1b', icon: 'cancel' },
    CANCELLED: { label: 'Hủy', bg: '#f3f4f6', color: '#374151', icon: 'block' },
};

const formatCurrency = (n: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);

const formatDate = (d?: string) => {
    if (!d) return 'Chưa cập nhật';
    return new Date(d).toLocaleDateString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
};

const RecoveryDetailModal: React.FC<RecoveryDetailModalProps> = ({ item, toast, onClose }) => {
    const [currentItem, setCurrentItem] = useState<RecoveryItem>(item);
    const [processing, setProcessing] = useState<string | null>(null);

    /* ── Sub-modal states ── */
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [showRecoverModal, setShowRecoverModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [recoveredAmount, setRecoveredAmount] = useState<number>(currentItem.total_amount);
    const [pendingConfirm, setPendingConfirm] = useState<{ type: 'approve' | 'inProgress' | 'cancel'; title: string; message: string } | null>(null);

    /* ── Assignment states ── */
    const [showAssignDropdown, setShowAssignDropdown] = useState(false);
    const [assignableUsers, setAssignableUsers] = useState<{ id: string; name: string; store_name?: string }[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    const refreshItem = async () => {
        try {
            const data = await RecoveryService.getRecoveryItem(currentItem.id);
            if (data) setCurrentItem(data);
        } catch (error) {
            console.error('[RecoveryDetailModal] Refresh error:', error);
        }
    };

    /* ── Load assignable users ── */
    const loadAssignableUsers = async () => {
        if (assignableUsers.length > 0) return; // cached
        setLoadingUsers(true);
        try {
            const users = await RecoveryService.getAssignableUsers();
            setAssignableUsers(users);
        } catch { } finally { setLoadingUsers(false); }
    };

    const handleAssign = async (userId: string) => {
        setShowAssignDropdown(false);
        setProcessing('ASSIGN');
        try {
            const result = await RecoveryService.assignRecovery(currentItem.id, userId);
            if (result.success) {
                toast.success('Đã giao phiếu cho nhân viên');
                await refreshItem();
            } else {
                toast.error(result.error || 'Không thể giao');
            }
        } catch (error: any) {
            toast.error('Lỗi: ' + error.message);
        } finally {
            setProcessing(null);
        }
    };

    /* ── Actions ── */
    const executeAction = async (
        actionName: string,
        actionFn: () => Promise<{ success: boolean; error?: string }>
    ) => {
        setProcessing(actionName);
        try {
            const result = await actionFn();
            if (result.success) {
                toast.success(`Thao tác thành công`);
                await refreshItem();
            } else {
                toast.error(result.error || 'Không thể thực hiện');
            }
        } catch (error: any) {
            toast.error('Lỗi hệ thống: ' + error.message);
        } finally {
            setProcessing(null);
        }
    };

    const handleConfirmAction = () => {
        if (!pendingConfirm) return;
        setPendingConfirm(null);
        if (pendingConfirm.type === 'approve') {
            executeAction('APPROVE', () => RecoveryService.approveRecovery(currentItem.id));
        } else if (pendingConfirm.type === 'inProgress') {
            executeAction('IN_PROGRESS', () => RecoveryService.markInProgress(currentItem.id));
        } else if (pendingConfirm.type === 'cancel') {
            executeAction('CANCEL', () => RecoveryService.cancelRecovery(currentItem.id));
        }
    };

    const handleReject = async () => {
        if (!rejectReason.trim()) { toast.error('Vui lòng nhập lý do từ chối'); return; }
        setProcessing('REJECT');
        try {
            const result = await RecoveryService.rejectRecovery(currentItem.id, rejectReason);
            if (result.success) {
                toast.success('Đã từ chối phiếu truy thu');
                setShowRejectModal(false); setRejectReason('');
                await refreshItem();
            } else {
                toast.error(result.error || 'Không thể từ chối');
            }
        } catch (error: any) {
            toast.error('Lỗi hệ thống: ' + error.message);
        } finally {
            setProcessing(null);
        }
    };

    const handleRecover = async () => {
        if (recoveredAmount < 0) { toast.error('Số tiền không hợp lệ'); return; }
        setProcessing('RECOVER');
        try {
            const result = await RecoveryService.markAsRecovered(currentItem.id, recoveredAmount);
            if (result.success) {
                toast.success('Đã hoàn thành truy thu');
                setShowRecoverModal(false);
                await refreshItem();
            } else {
                toast.error(result.error || 'Không thể hoàn thành');
            }
        } catch (error: any) {
            toast.error('Lỗi hệ thống: ' + error.message);
        } finally {
            setProcessing(null);
        }
    };

    const statusCfg = STATUS_CFG[currentItem.status] || STATUS_CFG.PENDING;

    return (
        <>
            <style>{CSS_TEXT}</style>
            <div className="rdm-overlay" onClick={() => onClose(true)}>
                <div className="rdm-modal" onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="rdm-header">
                        <div className="rdm-header-left">
                            <div className="rdm-header-icon">
                                <span className="material-symbols-outlined" style={{ fontSize: 22, color: '#6366f1' }}>receipt_long</span>
                            </div>
                            <div>
                                <h2 className="rdm-title">Chi tiết phiếu truy thu</h2>
                                <p className="rdm-subtitle">#{currentItem.id.slice(0, 8)}</p>
                            </div>
                        </div>
                        <button className="rdm-close" onClick={() => onClose(true)}>
                            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
                        </button>
                    </div>

                    <div className="rdm-body">
                        {/* Status & Actions */}
                        <div className="rdm-status-row">
                            <span className="rdm-status-badge" style={{ background: statusCfg.bg, color: statusCfg.color }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{statusCfg.icon}</span>
                                {statusCfg.label}
                            </span>

                            <div className="rdm-actions">
                                {currentItem.status === 'PENDING' && (
                                    <>
                                        <button className="rdm-btn rdm-btn-approve" onClick={() => setPendingConfirm({ type: 'approve', title: 'Duyệt phiếu', message: 'Xác nhận duyệt phiếu truy thu này?' })} disabled={!!processing}>
                                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check</span> Duyệt
                                        </button>
                                        <button className="rdm-btn rdm-btn-reject" onClick={() => setShowRejectModal(true)} disabled={!!processing}>
                                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span> Từ chối
                                        </button>
                                    </>
                                )}
                                {currentItem.status === 'APPROVED' && (
                                    <button className="rdm-btn rdm-btn-progress" onClick={() => setPendingConfirm({ type: 'inProgress', title: 'Bắt đầu truy thu', message: 'Bắt đầu quá trình truy thu?' })} disabled={!!processing}>
                                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>play_arrow</span> Bắt đầu thu
                                    </button>
                                )}
                                {currentItem.status === 'IN_PROGRESS' && (
                                    <button className="rdm-btn rdm-btn-complete" onClick={() => setShowRecoverModal(true)} disabled={!!processing}>
                                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span> Hoàn thành
                                    </button>
                                )}
                                {!['RECOVERED', 'REJECTED', 'CANCELLED'].includes(currentItem.status) && (
                                    <button className="rdm-btn rdm-btn-cancel" onClick={() => setPendingConfirm({ type: 'cancel', title: 'Hủy phiếu', message: 'Xác nhận hủy phiếu truy thu này?' })} disabled={!!processing}>
                                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>block</span> Hủy
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Product Info */}
                        <div className="rdm-info-card">
                            <h3 className="rdm-info-title">Thông tin sản phẩm</h3>
                            <div className="rdm-info-grid">
                                <div>
                                    <p className="rdm-info-label">Tên sản phẩm</p>
                                    <p className="rdm-info-value">{currentItem.product_name}</p>
                                </div>
                                <div>
                                    <p className="rdm-info-label">Mã vạch</p>
                                    <p className="rdm-info-value">{currentItem.barcode || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="rdm-info-label">Số lượng</p>
                                    <p className="rdm-info-value">{currentItem.quantity}</p>
                                </div>
                                <div>
                                    <p className="rdm-info-label">Đơn giá</p>
                                    <p className="rdm-info-value">{formatCurrency(currentItem.unit_price)}</p>
                                </div>
                            </div>
                            <div className="rdm-total-row">
                                <p className="rdm-info-label">Tổng tiền</p>
                                <p className="rdm-total-value">{formatCurrency(currentItem.total_amount)}</p>
                            </div>
                        </div>

                        {/* Assignment Card */}
                        <div className="rdm-info-card">
                            <h3 className="rdm-info-title">
                                <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#6366f1' }}>assignment_ind</span>
                                Nhân viên phụ trách
                            </h3>
                            <div className="rdm-assign-row">
                                {currentItem.assigned_to_name ? (
                                    <div className="rdm-assignee">
                                        <div className="rdm-assignee-avatar">
                                            {currentItem.assigned_to_name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="rdm-assignee-name">{currentItem.assigned_to_name}</div>
                                            <div className="rdm-assignee-label">Đã giao</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="rdm-no-assignee">
                                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#94a3b8' }}>person_off</span>
                                        <span>Chưa giao cho ai</span>
                                    </div>
                                )}

                                {!['RECOVERED', 'REJECTED', 'CANCELLED'].includes(currentItem.status) && (
                                    <div style={{ position: 'relative' }}>
                                        <button
                                            className="rdm-btn rdm-btn-assign"
                                            onClick={() => { setShowAssignDropdown(!showAssignDropdown); loadAssignableUsers(); }}
                                            disabled={!!processing}
                                        >
                                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person_add</span>
                                            {currentItem.assigned_to ? 'Đổi NV' : 'Giao NV'}
                                        </button>

                                        {showAssignDropdown && (
                                            <div className="rdm-assign-dropdown">
                                                {loadingUsers ? (
                                                    <div className="rdm-assign-loading">Đang tải...</div>
                                                ) : assignableUsers.length === 0 ? (
                                                    <div className="rdm-assign-loading">Không có nhân viên</div>
                                                ) : (
                                                    assignableUsers.map(u => (
                                                        <button
                                                            key={u.id}
                                                            className={`rdm-assign-option ${u.id === currentItem.assigned_to ? 'active' : ''}`}
                                                            onClick={() => handleAssign(u.id)}
                                                        >
                                                            <div className="rdm-assign-option-avatar">{u.name.charAt(0)}</div>
                                                            <div>
                                                                <div className="rdm-assign-option-name">{u.name}</div>
                                                                {u.store_name && <div className="rdm-assign-option-store">{u.store_name}</div>}
                                                            </div>
                                                            {u.id === currentItem.assigned_to && (
                                                                <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#10b981', marginLeft: 'auto' }}>check</span>
                                                            )}
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Reason & Notes */}
                        <div className="rdm-info-card">
                            <h3 className="rdm-info-title">Lý do & Ghi chú</h3>
                            <div className="rdm-reason-box">{currentItem.reason}</div>
                            {currentItem.notes && (
                                <div className="rdm-notes-box">{currentItem.notes}</div>
                            )}
                        </div>

                        {/* Timeline */}
                        <div className="rdm-info-card">
                            <h3 className="rdm-info-title">Lịch sử xử lý</h3>
                            <div className="rdm-timeline">
                                <TimelineItem icon="add" bg="#dbeafe" color="#1e40af" label="Tạo phiếu" date={formatDate(currentItem.created_at)} />
                                {currentItem.submitted_at && <TimelineItem icon="send" bg="#fef3c7" color="#92400e" label="Gửi duyệt" date={formatDate(currentItem.submitted_at)} />}
                                {currentItem.approved_at && <TimelineItem icon="check" bg="#d1fae5" color="#065f46" label="Đã duyệt" date={formatDate(currentItem.approved_at)} />}
                                {currentItem.recovered_at && (
                                    <TimelineItem icon="check_circle" bg="#eef2ff" color="#4f46e5" label="Hoàn thành truy thu" date={formatDate(currentItem.recovered_at)}
                                        extra={currentItem.recovered_amount !== undefined ? `Thu được: ${formatCurrency(currentItem.recovered_amount)}` : undefined} />
                                )}
                                {currentItem.rejected_at && (
                                    <TimelineItem icon="cancel" bg="#fef2f2" color="#dc2626" label="Từ chối" date={formatDate(currentItem.rejected_at)}
                                        extra={currentItem.rejection_reason || undefined} />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Reject Sub-Modal ── */}
            {showRejectModal && (
                <div className="rdm-sub-overlay">
                    <div className="rdm-sub-modal">
                        <h3 className="rdm-sub-title">Từ chối phiếu truy thu</h3>
                        <textarea
                            className="rdm-sub-textarea"
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            placeholder="Nhập lý do từ chối..."
                            rows={4}
                        />
                        <div className="rdm-sub-actions">
                            <button className="rdm-btn rdm-btn-cancel" onClick={() => { setShowRejectModal(false); setRejectReason(''); }}>Hủy</button>
                            <button className="rdm-btn rdm-btn-reject" onClick={handleReject} disabled={!!processing}>Xác nhận từ chối</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Recover Sub-Modal ── */}
            {showRecoverModal && (
                <div className="rdm-sub-overlay">
                    <div className="rdm-sub-modal">
                        <h3 className="rdm-sub-title">Hoàn thành truy thu</h3>
                        <div className="rdm-sub-field">
                            <label className="rdm-info-label">Số tiền đã thu (VNĐ)</label>
                            <input
                                type="number"
                                className="rdm-sub-input"
                                value={recoveredAmount}
                                onChange={e => setRecoveredAmount(parseFloat(e.target.value) || 0)}
                                min="0" step="1000"
                            />
                            <p className="rdm-sub-hint">Tổng tiền cần thu: {formatCurrency(currentItem.total_amount)}</p>
                        </div>
                        <div className="rdm-sub-actions">
                            <button className="rdm-btn rdm-btn-cancel" onClick={() => { setShowRecoverModal(false); setRecoveredAmount(currentItem.total_amount); }}>Hủy</button>
                            <button className="rdm-btn rdm-btn-complete" onClick={handleRecover} disabled={!!processing}>Hoàn thành</button>
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
                onConfirm={handleConfirmAction}
                onCancel={() => setPendingConfirm(null)}
                loading={!!processing}
            />
        </>
    );
};

/* ── Timeline Item sub-component ── */
const TimelineItem: React.FC<{ icon: string; bg: string; color: string; label: string; date: string; extra?: string }> = ({ icon, bg, color, label, date, extra }) => (
    <div className="rdm-tl-item">
        <div className="rdm-tl-dot" style={{ background: bg }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14, color }}>{icon}</span>
        </div>
        <div className="rdm-tl-content">
            <p className="rdm-tl-label">{label}</p>
            {extra && <p className="rdm-tl-extra">{extra}</p>}
            <p className="rdm-tl-date">{date}</p>
        </div>
    </div>
);

export default RecoveryDetailModal;

/* ══════ CSS ══════ */
const CSS_TEXT = `
/* Overlay */
.rdm-overlay {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(15, 23, 42, 0.5);
    backdrop-filter: blur(6px);
    display: flex; align-items: center; justify-content: center;
    padding: 20px;
    animation: rdmFadeIn 0.2s ease;
}
@keyframes rdmFadeIn { from { opacity: 0; } to { opacity: 1; } }

/* Modal */
.rdm-modal {
    background: #fff; border-radius: 16px;
    width: 100%; max-width: 860px;
    max-height: 90vh; overflow-y: auto;
    box-shadow: 0 25px 60px -12px rgba(0,0,0,0.25);
    animation: rdmSlideUp 0.25s ease;
}
@keyframes rdmSlideUp { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

/* Header */
.rdm-header {
    position: sticky; top: 0; z-index: 10;
    display: flex; align-items: center; justify-content: space-between;
    padding: 20px 24px;
    background: #fff;
    border-bottom: 1px solid #e5e7eb;
}
.rdm-header-left { display: flex; align-items: center; gap: 14px; }
.rdm-header-icon {
    width: 48px; height: 48px;
    background: #eef2ff; border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
}
.rdm-title { font-size: 18px; font-weight: 800; color: #0f172a; margin: 0; }
.rdm-subtitle { font-size: 13px; color: #94a3b8; margin: 2px 0 0; }
.rdm-close {
    width: 36px; height: 36px; border-radius: 10px;
    border: 1px solid #e5e7eb; background: #fff;
    display: flex; align-items: center; justify-content: center;
    color: #64748b; cursor: pointer; transition: all 0.15s;
}
.rdm-close:hover { background: #f1f5f9; color: #1e293b; }

/* Body */
.rdm-body { padding: 24px; display: flex; flex-direction: column; gap: 20px; }

/* Status Row */
.rdm-status-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.rdm-status-badge {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 14px; border-radius: 99px;
    font-size: 13px; font-weight: 700;
}
.rdm-actions { display: flex; gap: 8px; flex-wrap: wrap; }

/* Buttons */
.rdm-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 16px; border-radius: 10px;
    font-size: 12px; font-weight: 700; cursor: pointer;
    border: none; transition: all 0.15s;
}
.rdm-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.rdm-btn-approve { background: #dbeafe; color: #1e40af; }
.rdm-btn-approve:hover { background: #93c5fd; }
.rdm-btn-reject { background: #fef2f2; color: #991b1b; }
.rdm-btn-reject:hover { background: #fecaca; }
.rdm-btn-progress { background: #f3e8ff; color: #6b21a8; }
.rdm-btn-progress:hover { background: #e9d5ff; }
.rdm-btn-complete { background: #d1fae5; color: #065f46; }
.rdm-btn-complete:hover { background: #a7f3d0; }
.rdm-btn-cancel { background: #f3f4f6; color: #374151; border: 1px solid #e5e7eb; }
.rdm-btn-cancel:hover { background: #e5e7eb; }

/* Info Card */
.rdm-info-card {
    background: #f8fafc; border-radius: 14px; padding: 20px;
    border: 1px solid #f1f5f9;
}
.rdm-info-title { font-size: 15px; font-weight: 700; color: #0f172a; margin: 0 0 14px; }
.rdm-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.rdm-info-label { font-size: 11px; color: #94a3b8; margin: 0; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; }
.rdm-info-value { font-size: 14px; font-weight: 600; color: #0f172a; margin: 4px 0 0; }

/* Total */
.rdm-total-row { border-top: 1px solid #e5e7eb; padding-top: 14px; margin-top: 14px; }
.rdm-total-value { font-size: 24px; font-weight: 800; color: #4f46e5; margin: 4px 0 0; }

/* Reason Box */
.rdm-reason-box {
    background: #fff; border: 1px solid #e5e7eb; border-radius: 10px;
    padding: 12px 16px; font-size: 14px; color: #1e293b; line-height: 1.5;
}
.rdm-notes-box {
    background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px;
    padding: 12px 16px; font-size: 13px; color: #78350f; line-height: 1.5; margin-top: 10px;
}

/* Timeline */
.rdm-timeline { display: flex; flex-direction: column; gap: 12px; }
.rdm-tl-item { display: flex; gap: 12px; align-items: flex-start; }
.rdm-tl-dot {
    width: 30px; height: 30px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
}
.rdm-tl-content { flex: 1; }
.rdm-tl-label { font-size: 13px; font-weight: 600; color: #1e293b; margin: 0; }
.rdm-tl-extra { font-size: 12px; color: #64748b; margin: 2px 0 0; }
.rdm-tl-date { font-size: 11px; color: #94a3b8; margin: 2px 0 0; }

/* Sub-Modals */
.rdm-sub-overlay {
    position: fixed; inset: 0; z-index: 1100;
    background: rgba(15, 23, 42, 0.5);
    display: flex; align-items: center; justify-content: center; padding: 20px;
}
.rdm-sub-modal {
    background: #fff; border-radius: 16px; padding: 24px;
    max-width: 480px; width: 100%;
    box-shadow: 0 20px 50px -12px rgba(0,0,0,0.25);
}
.rdm-sub-title { font-size: 17px; font-weight: 800; color: #0f172a; margin: 0 0 16px; }
.rdm-sub-textarea, .rdm-sub-input {
    width: 100%; padding: 10px 14px;
    background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px;
    font-size: 13px; font-weight: 500; color: #334155;
    outline: none; transition: border-color 0.2s, box-shadow 0.2s;
    font-family: inherit;
}
.rdm-sub-textarea { resize: none; }
.rdm-sub-textarea:focus, .rdm-sub-input:focus { border-color: #818cf8; box-shadow: 0 0 0 3px rgba(99,102,241,.1); }
.rdm-sub-field { margin-bottom: 16px; display: flex; flex-direction: column; gap: 6px; }
.rdm-sub-hint { font-size: 11px; color: #94a3b8; margin: 0; }
.rdm-sub-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px; }

/* Assignment */
.rdm-assign-row {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
}
.rdm-assignee { display: flex; align-items: center; gap: 12px; }
.rdm-assignee-avatar {
    width: 36px; height: 36px; border-radius: 50%;
    background: linear-gradient(135deg, #6366f1, #4338ca);
    color: #fff; font-size: 14px; font-weight: 800;
    display: flex; align-items: center; justify-content: center;
}
.rdm-assignee-name { font-size: 14px; font-weight: 700; color: #0f172a; }
.rdm-assignee-label { font-size: 11px; font-weight: 600; color: #10b981; }
.rdm-no-assignee {
    display: flex; align-items: center; gap: 8px;
    font-size: 13px; color: #94a3b8; font-weight: 500;
}
.rdm-btn-assign { background: #eef2ff; color: #4f46e5; }
.rdm-btn-assign:hover { background: #c7d2fe; }

/* Assignment Dropdown */
.rdm-assign-dropdown {
    position: absolute; top: calc(100% + 4px); right: 0;
    width: 260px; max-height: 220px; overflow-y: auto;
    background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
    box-shadow: 0 10px 30px -6px rgba(0,0,0,0.12);
    z-index: 50; padding: 6px;
}
.rdm-assign-loading {
    padding: 16px; text-align: center; color: #94a3b8; font-size: 12px; font-weight: 600;
}
.rdm-assign-option {
    width: 100%; display: flex; align-items: center; gap: 10px;
    padding: 8px 10px; border-radius: 8px; border: none; background: transparent;
    cursor: pointer; text-align: left; transition: background 0.15s;
}
.rdm-assign-option:hover { background: #f8fafc; }
.rdm-assign-option.active { background: #eef2ff; }
.rdm-assign-option-avatar {
    width: 28px; height: 28px; border-radius: 50%;
    background: #e0e7ff; color: #4f46e5; font-size: 12px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
}
.rdm-assign-option-name { font-size: 12px; font-weight: 600; color: #1e293b; }
.rdm-assign-option-store { font-size: 10px; color: #94a3b8; }
`;
