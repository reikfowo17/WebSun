import React, { useState, useEffect } from 'react';
import { InventoryService } from '../../../services';


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

const STATUS_CFG: Record<string, { label: string; bg: string; color: string; icon: string }> = {
    PENDING: { label: 'Chờ duyệt', bg: '#fef3c7', color: '#92400e', icon: 'schedule' },
    APPROVED: { label: 'Đã duyệt', bg: '#d1fae5', color: '#065f46', icon: 'check_circle' },
    REJECTED: { label: 'Từ chối', bg: '#fef2f2', color: '#991b1b', icon: 'cancel' },
};

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

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getAccuracyPercentage = () => {
        if (!report || report.total_items === 0) return 0;
        return Math.round((report.matched_items / report.total_items) * 100);
    };

    const getCompletionPercentage = () => {
        if (!report || report.total_items === 0) return 0;
        const checked = report.matched_items + report.missing_items + report.over_items;
        return Math.round((checked / report.total_items) * 100);
    };

    const statusCfg = report ? (STATUS_CFG[report.status] || STATUS_CFG.PENDING) : STATUS_CFG.PENDING;

    return (
        <>
            <style>{CSS_TEXT}</style>
            <div className="rdm-overlay" onClick={onClose}>
                <div className="rdm-modal" onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="rdm-header">
                        <div className="rdm-header-left">
                            <div className="rdm-header-icon">
                                <span className="material-symbols-outlined" style={{ fontSize: 22, color: '#6366f1' }}>assignment</span>
                            </div>
                            <div>
                                <h2 className="rdm-title">Chi tiết báo cáo kiểm kho</h2>
                                <p className="rdm-subtitle">#{reportId.slice(0, 8)}</p>
                            </div>
                        </div>
                        <button className="rdm-close" onClick={onClose}>
                            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
                        </button>
                    </div>

                    {/* Content */}
                    <div className="rdm-body">
                        {loading ? (
                            <div className="rdm-loading">
                                <div className="rdm-skel" style={{ width: '33%', height: 28 }} />
                                <div className="rdm-skel" style={{ width: '100%', height: 160 }} />
                                <div className="rdm-skel" style={{ width: '100%', height: 120 }} />
                            </div>
                        ) : !report ? (
                            <div className="rdm-empty">
                                <span className="material-symbols-outlined" style={{ fontSize: 56, color: '#d1d5db' }}>error</span>
                                <p>Không tìm thấy báo cáo</p>
                            </div>
                        ) : (
                            <>
                                {/* Status & Store Info */}
                                <div className="rdm-info-row">
                                    <div>
                                        <h3 className="rdm-store-name">{report.store_name}</h3>
                                        <p className="rdm-store-meta">
                                            Ca {report.shift} • {new Date(report.check_date).toLocaleDateString('vi-VN')}
                                        </p>
                                    </div>
                                    <span className="rdm-status-badge" style={{ background: statusCfg.bg, color: statusCfg.color }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{statusCfg.icon}</span>
                                        {statusCfg.label}
                                    </span>
                                </div>

                                {/* Stats Overview */}
                                <div className="rdm-stats-card">
                                    <div className="rdm-stats-grid">
                                        <div className="rdm-stat-item">
                                            <div className="rdm-stat-icon" style={{ background: '#eef2ff' }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: 24, color: '#6366f1' }}>inventory_2</span>
                                            </div>
                                            <p className="rdm-stat-label">Tổng sản phẩm</p>
                                            <p className="rdm-stat-value">{report.total_items}</p>
                                        </div>
                                        <div className="rdm-stat-item">
                                            <div className="rdm-stat-icon" style={{ background: '#f0fdf4' }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: 24, color: '#16a34a' }}>check_circle</span>
                                            </div>
                                            <p className="rdm-stat-label">Khớp</p>
                                            <p className="rdm-stat-value" style={{ color: '#16a34a' }}>{report.matched_items}</p>
                                        </div>
                                        <div className="rdm-stat-item">
                                            <div className="rdm-stat-icon" style={{ background: '#fef2f2' }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: 24, color: '#dc2626' }}>remove_circle</span>
                                            </div>
                                            <p className="rdm-stat-label">Thiếu</p>
                                            <p className="rdm-stat-value" style={{ color: '#dc2626' }}>{report.missing_items}</p>
                                        </div>
                                        <div className="rdm-stat-item">
                                            <div className="rdm-stat-icon" style={{ background: '#eff6ff' }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: 24, color: '#2563eb' }}>add_circle</span>
                                            </div>
                                            <p className="rdm-stat-label">Thừa</p>
                                            <p className="rdm-stat-value" style={{ color: '#2563eb' }}>{report.over_items}</p>
                                        </div>
                                    </div>

                                    {/* Progress Bars */}
                                    <div className="rdm-progress-section">
                                        <div className="rdm-progress-item">
                                            <div className="rdm-progress-header">
                                                <span className="rdm-progress-label">Tiến độ kiểm</span>
                                                <span className="rdm-progress-pct" style={{ color: '#6366f1' }}>{getCompletionPercentage()}%</span>
                                            </div>
                                            <div className="rdm-progress-bar">
                                                <div
                                                    className="rdm-progress-fill"
                                                    style={{ width: `${getCompletionPercentage()}%`, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }}
                                                />
                                            </div>
                                        </div>
                                        <div className="rdm-progress-item">
                                            <div className="rdm-progress-header">
                                                <span className="rdm-progress-label">Tỷ lệ khớp</span>
                                                <span className="rdm-progress-pct" style={{ color: '#16a34a' }}>{getAccuracyPercentage()}%</span>
                                            </div>
                                            <div className="rdm-progress-bar">
                                                <div
                                                    className="rdm-progress-fill"
                                                    style={{ width: `${getAccuracyPercentage()}%`, background: 'linear-gradient(90deg, #16a34a, #059669)' }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Submission Info */}
                                <div className="rdm-info-card">
                                    <h4 className="rdm-info-title">Thông tin nộp báo cáo</h4>
                                    <div className="rdm-info-grid">
                                        <div>
                                            <p className="rdm-info-label">Người nộp</p>
                                            <p className="rdm-info-value">{report.submitted_by}</p>
                                        </div>
                                        <div>
                                            <p className="rdm-info-label">Thời gian nộp</p>
                                            <p className="rdm-info-value">{formatDate(report.submitted_at)}</p>
                                        </div>
                                    </div>

                                    {report.reviewed_at && (
                                        <div className="rdm-review-section">
                                            <div className="rdm-info-grid">
                                                <div>
                                                    <p className="rdm-info-label">Người duyệt</p>
                                                    <p className="rdm-info-value">{report.reviewed_by || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <p className="rdm-info-label">Thời gian duyệt</p>
                                                    <p className="rdm-info-value">{formatDate(report.reviewed_at)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {report.rejection_reason && (
                                        <div className="rdm-rejection">
                                            <p className="rdm-info-label" style={{ marginBottom: 6 }}>Lý do từ chối</p>
                                            <div className="rdm-rejection-box">
                                                <p>{report.rejection_reason}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default ReportDetailModal;

/* ══════ CSS ══════ */
const CSS_TEXT = `
/* Overlay */
.rdm-overlay {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(15, 23, 42, 0.5);
    backdrop-filter: blur(6px);
    display: flex; align-items: center; justify-content: center;
    padding: 20px;
    animation: rdm-fadeIn 0.2s ease;
}
@keyframes rdm-fadeIn { from { opacity: 0; } to { opacity: 1; } }

/* Modal */
.rdm-modal {
    background: #fff; border-radius: 16px;
    width: 100%; max-width: 800px;
    max-height: 90vh; overflow-y: auto;
    box-shadow: 0 25px 60px -12px rgba(0,0,0,0.25);
    animation: rdm-slideUp 0.25s ease;
}
@keyframes rdm-slideUp { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

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

/* Loading */
.rdm-loading { display: flex; flex-direction: column; gap: 16px; }
.rdm-skel {
    border-radius: 12px;
    background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
    background-size: 200% 100%;
    animation: rdm-shimmer 1.5s ease-in-out infinite;
}
@keyframes rdm-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

/* Empty */
.rdm-empty { text-align: center; padding: 48px 20px; color: #64748b; }

/* Info Row */
.rdm-info-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.rdm-store-name { font-size: 22px; font-weight: 800; color: #0f172a; margin: 0; }
.rdm-store-meta { font-size: 14px; color: #64748b; margin: 4px 0 0; }
.rdm-status-badge {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 14px; border-radius: 99px;
    font-size: 13px; font-weight: 700;
    white-space: nowrap;
}

/* Stats Card */
.rdm-stats-card {
    background: linear-gradient(135deg, #eef2ff 0%, #faf5ff 100%);
    border-radius: 16px; padding: 24px;
    border: 1px solid #e0e7ff;
}
.rdm-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
@media (max-width: 600px) { .rdm-stats-grid { grid-template-columns: repeat(2, 1fr); } }
.rdm-stat-item { text-align: center; }
.rdm-stat-icon {
    width: 56px; height: 56px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}
.rdm-stat-label { font-size: 13px; color: #64748b; margin: 0; }
.rdm-stat-value { font-size: 24px; font-weight: 800; color: #0f172a; margin: 4px 0 0; font-variant-numeric: tabular-nums; }

/* Progress Section */
.rdm-progress-section { margin-top: 20px; display: flex; flex-direction: column; gap: 14px; }
.rdm-progress-item {}
.rdm-progress-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.rdm-progress-label { font-size: 13px; font-weight: 600; color: #475569; }
.rdm-progress-pct { font-size: 14px; font-weight: 800; }
.rdm-progress-bar { height: 10px; background: rgba(255,255,255,0.6); border-radius: 99px; overflow: hidden; }
.rdm-progress-fill { height: 100%; border-radius: 99px; transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1); }

/* Info Card */
.rdm-info-card {
    background: #f8fafc; border-radius: 14px; padding: 20px;
    border: 1px solid #f1f5f9;
}
.rdm-info-title { font-size: 15px; font-weight: 700; color: #0f172a; margin: 0 0 14px; }
.rdm-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.rdm-info-label { font-size: 11px; color: #94a3b8; margin: 0; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; }
.rdm-info-value { font-size: 14px; font-weight: 600; color: #0f172a; margin: 4px 0 0; }

/* Review Section */
.rdm-review-section { border-top: 1px solid #e5e7eb; padding-top: 14px; margin-top: 14px; }

/* Rejection */
.rdm-rejection { border-top: 1px solid #e5e7eb; padding-top: 14px; margin-top: 14px; }
.rdm-rejection-box {
    background: #fef2f2; border: 1px solid #fecaca;
    border-radius: 10px; padding: 12px 16px;
}
.rdm-rejection-box p { font-size: 14px; color: #991b1b; margin: 0; line-height: 1.5; }
`;
