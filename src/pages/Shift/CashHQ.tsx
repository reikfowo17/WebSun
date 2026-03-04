import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { User, Store } from '../../types';
import type { CashSettlement } from '../../types/shift';
import { SHIFT_ICONS, SHIFT_COLORS, CASH_REVENUE_FIELDS, CASH_PAYMENT_FIELDS, DENOMINATION_VALUES } from '../../types/shift';
import { CashService } from '../../services/shift';
import { useToast } from '../../contexts';
import { supabase } from '../../lib/supabase';
import '../../styles/hq-sidebar.css';
import '../../styles/shift.css';

/* ═══════════════════════════════════════════════
   CASH HQ — Quản Lý Két (Admin Dashboard)
   ═══════════════════════════════════════════════ */

type SettlementWithShift = CashSettlement & {
    shift?: {
        id: string;
        shift_type: string;
        shift_date: string;
        status: string;
        store?: { id: string; code: string; name: string };
        started_by_user?: { id: string; name: string };
    };
};

const CASH_STATUS_MAP: Record<string, { label: string; class: string; icon: string }> = {
    DRAFT: { label: 'Nháp', class: 'badge-default', icon: 'edit_note' },
    SUBMITTED: { label: 'Chờ duyệt', class: 'badge-warning', icon: 'hourglass_top' },
    APPROVED: { label: 'Đã duyệt', class: 'badge-success', icon: 'check_circle' },
    REJECTED: { label: 'Từ chối', class: 'badge-danger', icon: 'cancel' },
};

const CashHQ: React.FC<{ user: User }> = ({ user }) => {
    const toast = useToast();
    const [settlements, setSettlements] = useState<SettlementWithShift[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedStore, setSelectedStore] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [dateRange, setDateRange] = useState(() => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return {
            start: start.toISOString().split('T')[0],
            end: now.toISOString().split('T')[0],
        };
    });
    const [selectedSettlement, setSelectedSettlement] = useState<SettlementWithShift | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [topbarNode, setTopbarNode] = useState<HTMLElement | null>(null);

    useEffect(() => {
        setTopbarNode(document.getElementById('topbar-left'));
    }, []);

    // ─── Load data ───
    const loadData = async () => {
        setLoading(true);
        try {
            const [storeData, settlementData] = await Promise.all([
                supabase.from('stores').select('id, code, name').eq('is_active', true).order('sort_order'),
                CashService.listSettlements({
                    storeId: selectedStore !== 'all' ? selectedStore : undefined,
                    startDate: dateRange.start,
                    endDate: dateRange.end,
                    status: statusFilter !== 'all' ? statusFilter : undefined,
                    limit: 200,
                }),
            ]);
            setStores((storeData.data as Store[]) || []);
            setSettlements(settlementData as SettlementWithShift[]);
        } catch (err: unknown) {
            console.error('[CashHQ] Load error:', err);
            toast.error('Lỗi khi tải danh sách két');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, [selectedStore, dateRange, statusFilter]);

    // ─── Stats ───
    const stats = useMemo(() => {
        let totalRevenue = 0, totalDiff = 0;
        let submitted = 0, approved = 0, rejected = 0, draft = 0;
        let withDiff = 0;

        for (const s of settlements) {
            totalRevenue += (s.total_counted || 0);
            totalDiff += Math.abs(s.difference || 0);
            if (s.difference && s.difference !== 0) withDiff++;

            if (s.status === 'SUBMITTED') submitted++;
            else if (s.status === 'APPROVED') approved++;
            else if (s.status === 'REJECTED') rejected++;
            else draft++;
        }

        return { totalRevenue, totalDiff, submitted, approved, rejected, draft, withDiff, total: settlements.length };
    }, [settlements]);

    // ─── Handlers ───
    const handleApprove = async (settlement: SettlementWithShift) => {
        setActionLoading(true);
        try {
            await CashService.approve(settlement.id, user.id);
            toast.success('Đã duyệt báo cáo két');
            setSelectedSettlement(null);
            await loadData();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Không thể duyệt');
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async () => {
        if (!selectedSettlement || !rejectReason.trim()) {
            toast.error('Vui lòng nhập lý do từ chối');
            return;
        }
        setActionLoading(true);
        try {
            await CashService.reject(selectedSettlement.id, user.id, rejectReason.trim());
            toast.success('Đã từ chối báo cáo két');
            setShowRejectModal(false);
            setRejectReason('');
            setSelectedSettlement(null);
            await loadData();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Không thể từ chối');
        } finally {
            setActionLoading(false);
        }
    };

    const fmt = (amount: number) => new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
    const fmtDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const shiftLabel = (type: string) => type === 'MORNING' ? 'Sáng' : type === 'AFTERNOON' ? 'Chiều' : 'Tối';

    return (
        <div className="hq-page">
            {/* Breadcrumb via portal */}
            {topbarNode && createPortal(
                <div className="hq-breadcrumb">
                    <span className="material-symbols-outlined hq-breadcrumb-icon">payments</span>
                    <span className="hq-breadcrumb-title">Quản Lý Két</span>
                </div>,
                topbarNode
            )}

            <div className="cashhq-container">
                {/* Stats Cards */}
                <div className="cashhq-stats">
                    {[
                        { label: 'Tổng két', value: stats.total, icon: 'receipt_long', color: '#3b82f6', bg: '#dbeafe' },
                        { label: 'Chờ duyệt', value: stats.submitted, icon: 'hourglass_top', color: '#f59e0b', bg: '#fef3c7' },
                        { label: 'Đã duyệt', value: stats.approved, icon: 'check_circle', color: '#10b981', bg: '#d1fae5' },
                        { label: 'Từ chối', value: stats.rejected, icon: 'cancel', color: '#ef4444', bg: '#fee2e2' },
                        { label: 'Có CL', value: stats.withDiff, icon: 'warning', color: '#f97316', bg: '#fff7ed' },
                    ].map(card => (
                        <div key={card.label} className="cashhq-stat-card card">
                            <div className="cashhq-stat-icon" style={{ background: card.bg }}>
                                <span className="material-symbols-outlined" style={{ color: card.color, fontSize: 20 }}>{card.icon}</span>
                            </div>
                            <div>
                                <div className="cashhq-stat-label">{card.label}</div>
                                <div className="cashhq-stat-value">{card.value}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Filters */}
                <div className="cashhq-filters card">
                    <select className="cashhq-select" value={selectedStore} onChange={e => setSelectedStore(e.target.value)}>
                        <option value="all">Tất cả cửa hàng</option>
                        {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <select className="cashhq-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                        <option value="all">Tất cả trạng thái</option>
                        <option value="SUBMITTED">Chờ duyệt</option>
                        <option value="APPROVED">Đã duyệt</option>
                        <option value="REJECTED">Từ chối</option>
                        <option value="DRAFT">Nháp</option>
                    </select>
                    <input type="date" className="cashhq-date" value={dateRange.start} onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))} />
                    <span className="cashhq-arrow">→</span>
                    <input type="date" className="cashhq-date" value={dateRange.end} onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))} />
                </div>

                {/* Revenue Summary */}
                {stats.total > 0 && (
                    <div className="cashhq-revenue-summary card">
                        <div className="cashhq-revenue-summary-item">
                            <span className="material-symbols-outlined" style={{ color: '#10b981', fontSize: 18 }}>account_balance</span>
                            <span className="cashhq-revenue-summary-label">Tổng két</span>
                            <span className="cashhq-revenue-summary-value">{fmt(stats.totalRevenue)}</span>
                        </div>
                        <div className="cashhq-revenue-summary-divider" />
                        <div className="cashhq-revenue-summary-item">
                            <span className="material-symbols-outlined" style={{ color: stats.totalDiff > 0 ? '#ef4444' : '#10b981', fontSize: 18 }}>compare_arrows</span>
                            <span className="cashhq-revenue-summary-label">Tổng chênh lệch</span>
                            <span className="cashhq-revenue-summary-value" style={{ color: stats.totalDiff > 0 ? '#ef4444' : '#10b981' }}>{fmt(stats.totalDiff)}</span>
                        </div>
                    </div>
                )}

                {/* Main 2-panel layout */}
                <div className={`cashhq-panels ${selectedSettlement ? 'with-detail' : ''}`}>
                    {/* Left: Settlement list */}
                    <div className="card cashhq-list">
                        <div className="cashhq-list-scroll">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Ngày</th>
                                        <th>Ca</th>
                                        <th>CH</th>
                                        <th>NV</th>
                                        <th>Tổng két</th>
                                        <th>CL</th>
                                        <th>Trạng thái</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan={8} className="cashhq-loading">
                                            <div className="cashhq-spinner" />
                                        </td></tr>
                                    ) : settlements.length === 0 ? (
                                        <tr><td colSpan={8} className="cashhq-empty">
                                            Không có báo cáo két nào trong khoảng thời gian đã chọn
                                        </td></tr>
                                    ) : settlements.map(s => {
                                        const statusInfo = CASH_STATUS_MAP[s.status] || CASH_STATUS_MAP.DRAFT;
                                        const hasDiff = s.difference && s.difference !== 0;
                                        return (
                                            <tr
                                                key={s.id}
                                                className={`cashhq-row ${selectedSettlement?.id === s.id ? 'active' : ''}`}
                                                onClick={() => setSelectedSettlement(s)}
                                            >
                                                <td className="cashhq-date-cell">{fmtDate(s.shift?.shift_date || s.created_at)}</td>
                                                <td>
                                                    <div className="cashhq-shift-badge">
                                                        <span className="material-symbols-outlined material-symbols-fill" style={{ fontSize: 14, color: SHIFT_COLORS[s.shift?.shift_type as keyof typeof SHIFT_COLORS] || '#6b7280' }}>
                                                            {SHIFT_ICONS[s.shift?.shift_type as keyof typeof SHIFT_ICONS] || 'schedule'}
                                                        </span>
                                                        <span>{shiftLabel(s.shift?.shift_type || '')}</span>
                                                    </div>
                                                </td>
                                                <td className="cashhq-cell-sm">{s.shift?.store?.name || '—'}</td>
                                                <td className="cashhq-cell-sm cashhq-cell-bold">{s.shift?.started_by_user?.name || '—'}</td>
                                                <td style={{ fontWeight: 700, fontSize: '0.8125rem', fontFamily: 'monospace' }}>
                                                    {fmt(s.total_counted || 0)}
                                                </td>
                                                <td style={{ fontWeight: 700, fontSize: '0.75rem', color: hasDiff ? '#ef4444' : '#10b981' }}>
                                                    {hasDiff ? (
                                                        <>{(s.difference || 0) > 0 ? '+' : ''}{fmt(s.difference || 0)}</>
                                                    ) : (
                                                        <span style={{ color: '#10b981' }}>✓</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <span className={`badge ${statusInfo.class}`}>
                                                        {statusInfo.label}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className="material-symbols-outlined cashhq-chevron">chevron_right</span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Right: Cash Detail Panel */}
                    {selectedSettlement && (
                        <CashDetailPanel
                            settlement={selectedSettlement}
                            onClose={() => setSelectedSettlement(null)}
                            onApprove={() => handleApprove(selectedSettlement)}
                            onReject={() => { setRejectReason(''); setShowRejectModal(true); }}
                            actionLoading={actionLoading}
                            fmt={fmt}
                            fmtDate={fmtDate}
                            shiftLabel={shiftLabel}
                        />
                    )}
                </div>
            </div>

            {/* Reject Modal */}
            {showRejectModal && (
                <div className="cashhq-modal-overlay" onClick={() => setShowRejectModal(false)}>
                    <div className="cashhq-modal" onClick={e => e.stopPropagation()}>
                        <h3 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 700, color: '#dc2626' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 20, verticalAlign: -4 }}>cancel</span>
                            {' '}Từ chối báo cáo két
                        </h3>
                        <textarea
                            className="cashhq-reject-textarea"
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            placeholder="Nhập lý do từ chối..."
                            rows={3}
                            autoFocus
                        />
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                            <button className="cashhq-btn cashhq-btn-secondary" onClick={() => setShowRejectModal(false)} disabled={actionLoading}>Hủy</button>
                            <button className="cashhq-btn cashhq-btn-danger" onClick={handleReject} disabled={actionLoading || !rejectReason.trim()}>
                                {actionLoading ? 'Đang xử lý...' : 'Từ chối'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

/* ═══════════════════════════════════════════════
   CASH DETAIL PANEL
   ═══════════════════════════════════════════════ */
interface CashDetailPanelProps {
    settlement: SettlementWithShift;
    onClose: () => void;
    onApprove: () => void;
    onReject: () => void;
    actionLoading: boolean;
    fmt: (n: number) => string;
    fmtDate: (s: string) => string;
    shiftLabel: (t: string) => string;
}

const CashDetailPanel: React.FC<CashDetailPanelProps> = ({
    settlement: cash, onClose, onApprove, onReject, actionLoading, fmt, fmtDate, shiftLabel
}) => {
    const statusInfo = CASH_STATUS_MAP[cash.status] || CASH_STATUS_MAP.DRAFT;

    return (
        <div className="card cashhq-detail">
            {/* Sticky header */}
            <div className="cashhq-detail-header">
                <div>
                    <h3 className="cashhq-detail-title">
                        Két Ca {shiftLabel(cash.shift?.shift_type || '')}
                        <span className={`badge ${statusInfo.class}`} style={{ marginLeft: 8, fontSize: '0.6875rem' }}>
                            {statusInfo.label}
                        </span>
                    </h3>
                    <p className="cashhq-detail-sub">
                        {fmtDate(cash.shift?.shift_date || cash.created_at)} • {cash.shift?.store?.name || '—'} • {cash.shift?.started_by_user?.name || '—'}
                    </p>
                </div>
                <button className="cashhq-close-btn" onClick={onClose}>
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>

            <div className="cashhq-detail-body">
                {/* Denomination */}
                <section className="cashhq-section">
                    <h4 className="cashhq-section-title">
                        <span className="material-symbols-outlined">account_balance_wallet</span>
                        Kiểm két theo mệnh giá
                    </h4>
                    <div className="cashhq-denom-grid">
                        {DENOMINATION_VALUES.map(d => {
                            const qty = (cash as unknown as Record<string, number>)[`denom_${d}`] || 0;
                            if (qty === 0) return null;
                            return (
                                <div key={d} className="cashhq-denom-item">
                                    <span>{fmt(d)} × {qty}</span>
                                    <span className="cashhq-denom-total">{fmt(d * qty)}</span>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Revenue */}
                <section className="cashhq-section">
                    <h4 className="cashhq-section-title">
                        <span className="material-symbols-outlined">receipt_long</span>
                        Doanh thu & chi phí
                    </h4>
                    {CASH_REVENUE_FIELDS.map(item => {
                        const val = (cash as unknown as Record<string, number>)[item.key] || 0;
                        const note = (cash.item_notes as Record<string, string>)?.[item.key];
                        if (val === 0 && !note) return null;
                        return (
                            <div key={item.key} className="cashhq-revenue-row">
                                <div>
                                    <span className="cashhq-revenue-label">{item.label}</span>
                                    {note && <div className="cashhq-revenue-note">📝 {note}</div>}
                                </div>
                                <span className={`cashhq-revenue-value ${item.type === 'expense' ? 'expense' : ''}`}>
                                    {item.type === 'expense' && val > 0 ? '-' : ''}{fmt(val)}
                                </span>
                            </div>
                        );
                    })}
                </section>

                {/* Payments */}
                <section className="cashhq-section">
                    <h4 className="cashhq-section-title">
                        <span className="material-symbols-outlined">credit_card</span>
                        Thanh toán không tiền mặt
                    </h4>
                    {CASH_PAYMENT_FIELDS.map(item => {
                        const val = (cash as unknown as Record<string, number>)[item.key] || 0;
                        if (val === 0) return null;
                        return (
                            <div key={item.key} className="cashhq-revenue-row">
                                <span className="cashhq-revenue-label">{item.label}</span>
                                <span className="cashhq-revenue-value payment">{fmt(val)}</span>
                            </div>
                        );
                    })}
                </section>

                {/* Summary */}
                <div className="cash-summary">
                    <div className="cash-summary-row">
                        <span className="cash-summary-label">Tổng kiểm két thực tế</span>
                        <span className="cash-summary-value">{fmt(cash.total_counted || 0)}</span>
                    </div>
                    <div className="cash-summary-row">
                        <span className="cash-summary-label">Tiền két cuối ca dự kiến</span>
                        <span className="cash-summary-value">{fmt(cash.cash_end_expected || 0)}</span>
                    </div>
                    <div className="cash-summary-row total">
                        <span className="cash-summary-label">Chênh lệch</span>
                        <span className={`cash-summary-value ${(cash.difference || 0) > 0 ? 'positive' : (cash.difference || 0) < 0 ? 'negative' : ''}`}>
                            {(cash.difference || 0) > 0 && '+'}{fmt(cash.difference || 0)}
                        </span>
                    </div>
                </div>

                {cash.difference_reason && (
                    <div className="cashhq-reason">
                        <strong>Lý do chênh lệch:</strong> {cash.difference_reason}
                    </div>
                )}

                {/* Action Buttons — Only for SUBMITTED status */}
                {cash.status === 'SUBMITTED' && (
                    <div className="cashhq-actions">
                        <button
                            className="cashhq-btn cashhq-btn-success"
                            onClick={onApprove}
                            disabled={actionLoading}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>
                            {actionLoading ? 'Đang xử lý...' : 'Duyệt'}
                        </button>
                        <button
                            className="cashhq-btn cashhq-btn-danger"
                            onClick={onReject}
                            disabled={actionLoading}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>cancel</span>
                            Từ chối
                        </button>
                    </div>
                )}

                {/* Status info for already-processed */}
                {(cash.status === 'APPROVED' || cash.status === 'REJECTED') && cash.approved_at && (
                    <div className={`cashhq-status-info ${cash.status === 'APPROVED' ? 'approved' : 'rejected'}`}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                            {cash.status === 'APPROVED' ? 'verified' : 'block'}
                        </span>
                        <span>
                            {cash.status === 'APPROVED' ? 'Đã duyệt' : 'Đã từ chối'} lúc{' '}
                            {new Date(cash.approved_at).toLocaleString('vi-VN')}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CashHQ;
