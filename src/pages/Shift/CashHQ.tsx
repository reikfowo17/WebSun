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
    const [loadLimit, setLoadLimit] = useState(50);

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
                    limit: loadLimit,
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

    useEffect(() => { loadData(); }, [selectedStore, dateRange, statusFilter, loadLimit]);

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

            <div className="cashhq-container" style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
                {/* Main Content Area */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {/* Table Section */}
                    <div className="stg-table-wrap" style={{ border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                        <div className="stg-toolbar" style={{ flexWrap: 'wrap', borderBottom: '1px solid #e5e7eb', padding: '16px 20px', borderRadius: '14px 14px 0 0' }}>
                            <div className="stg-toolbar-left" style={{ gap: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#9ca3af' }}>storefront</span>
                                    <select style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, fontWeight: 500, color: '#374151', cursor: 'pointer' }} value={selectedStore} onChange={e => setSelectedStore(e.target.value)}>
                                        <option value="all">Tất cả cửa hàng</option>
                                        {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#9ca3af' }}>filter_list</span>
                                    <select style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, fontWeight: 500, color: '#374151', cursor: 'pointer' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                                        <option value="all">Tất cả trạng thái</option>
                                        <option value="SUBMITTED">Chờ duyệt</option>
                                        <option value="APPROVED">Đã duyệt</option>
                                        <option value="REJECTED">Từ chối</option>
                                        <option value="DRAFT">Nháp</option>
                                    </select>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#9ca3af' }}>date_range</span>
                                    <input type="date" style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, fontWeight: 500, color: '#374151', cursor: 'pointer' }} value={dateRange.start} onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))} />
                                    <span style={{ color: '#d1d5db', margin: '0 4px' }}>→</span>
                                    <input type="date" style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, fontWeight: 500, color: '#374151', cursor: 'pointer' }} value={dateRange.end} onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))} />
                                </div>
                            </div>

                            {/* Revenue Summary Banner in Toolbar */}
                            {stats.total > 0 && (
                                <div className="stg-toolbar-right" style={{ gap: 16 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                        <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Tổng thu nộp</span>
                                        <span style={{ fontSize: 16, fontWeight: 800, color: '#10b981' }}>{fmt(stats.totalRevenue)}</span>
                                    </div>
                                    <div style={{ width: 1, height: 32, background: '#e5e7eb' }} />
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                        <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Chênh lệch</span>
                                        <span style={{ fontSize: 16, fontWeight: 800, color: stats.totalDiff > 0 ? '#ef4444' : '#10b981' }}>{fmt(stats.totalDiff)}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <table className="stg-table stg-table-fixed">
                            <thead>
                                <tr>
                                    <th style={{ width: '12%' }}>Ngày</th>
                                    <th style={{ width: '12%' }}>Ca</th>
                                    <th style={{ width: '12%' }}>CH</th>
                                    <th style={{ width: '16%' }}>NV</th>
                                    <th style={{ width: '18%', textAlign: 'right' }}>Tổng két</th>
                                    <th style={{ width: '14%', textAlign: 'right' }}>CL</th>
                                    <th style={{ width: '12%', textAlign: 'center' }}>Trạng thái</th>
                                    <th style={{ width: '4%' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px' }}><div className="cashhq-spinner" /></td></tr>
                                ) : settlements.length === 0 ? (
                                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>Không có báo cáo két nào phù hợp</td></tr>
                                ) : settlements.map(s => {
                                    const statusInfo = CASH_STATUS_MAP[s.status] || CASH_STATUS_MAP.DRAFT;
                                    const hasDiff = s.difference && s.difference !== 0;
                                    return (
                                        <tr
                                            key={s.id}
                                            style={{ cursor: 'pointer', background: selectedSettlement?.id === s.id ? '#f0fdf4' : 'transparent', transition: 'all 0.15s ease' }}
                                            onClick={() => setSelectedSettlement(s)}
                                            className="stg-table-row"
                                        >
                                            <td style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>{fmtDate(s.shift?.shift_date || s.created_at)}</td>
                                            <td>
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: '#f3f4f6', borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#4b5563' }}>
                                                    <span className="material-symbols-outlined material-symbols-fill" style={{ fontSize: 14, color: SHIFT_COLORS[s.shift?.shift_type as keyof typeof SHIFT_COLORS] || '#6b7280' }}>
                                                        {SHIFT_ICONS[s.shift?.shift_type as keyof typeof SHIFT_ICONS] || 'schedule'}
                                                    </span>
                                                    {shiftLabel(s.shift?.shift_type || '')}
                                                </div>
                                            </td>
                                            <td style={{ fontSize: 13 }}>{s.shift?.store?.name || '—'}</td>
                                            <td style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{s.shift?.started_by_user?.name || '—'}</td>
                                            <td style={{ fontWeight: 700, fontSize: 14, color: '#111827', textAlign: 'right', fontFamily: 'monospace' }}>
                                                {fmt(s.total_counted || 0)}
                                            </td>
                                            <td style={{ fontWeight: 700, fontSize: 13, color: hasDiff ? '#ef4444' : '#10b981', textAlign: 'right' }}>
                                                {hasDiff ? (
                                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, background: (s.difference || 0) > 0 ? '#fef2f2' : '#fee2e2', padding: '2px 8px', borderRadius: 12 }}>
                                                        {(s.difference || 0) > 0 ? '+' : ''}{fmt(s.difference || 0)}
                                                    </div>
                                                ) : (
                                                    <span className="material-symbols-outlined" style={{ color: '#10b981', fontSize: 16 }}>check</span>
                                                )}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span className={`badge ${statusInfo.class}`} style={{ fontSize: 11, padding: '4px 10px' }}>
                                                    {statusInfo.label}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#9ca3af', opacity: selectedSettlement?.id === s.id ? 1 : 0.5 }}>chevron_right</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {!loading && settlements.length >= loadLimit && (
                            <div style={{ padding: '16px', textAlign: 'center' }}>
                                <button
                                    className="cashhq-btn cashhq-btn-secondary"
                                    onClick={() => setLoadLimit(l => l + 50)}
                                >
                                    Tải thêm
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Detail Modal overlay */}
            {selectedSettlement && (
                <div
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
                    onClick={() => setSelectedSettlement(null)}
                >
                    <div onClick={e => e.stopPropagation()}>
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
                    </div>
                </div>
            )}

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
        <div style={{ background: '#fff', borderRadius: 20, display: 'flex', flexDirection: 'column', height: '85vh', maxHeight: 800, width: '100vw', maxWidth: 640, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            {/* Dark Mode Receipt Header */}
            <div style={{ padding: '24px 32px', background: 'linear-gradient(135deg, #1f2937, #111827)', color: 'white', position: 'relative', flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                            <h3 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#f3f4f6' }}>Két Ca {shiftLabel(cash.shift?.shift_type || '')}</h3>
                            <span className={`badge ${statusInfo.class}`} style={{ fontSize: 12, background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', padding: '4px 10px' }}>{statusInfo.label}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: 14, color: '#9ca3af' }}>{fmtDate(cash.shift?.shift_date || cash.created_at)}</p>
                    </div>
                    <button style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', cursor: 'pointer', padding: 8, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }} onClick={onClose} aria-label="Đóng" onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'} onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}>
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
                    </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 32 }}>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mức chênh lệch thiết lập</div>
                        <div style={{ fontSize: 36, fontWeight: 800, color: (cash.difference || 0) > 0 ? '#ef4444' : (cash.difference || 0) < 0 ? '#ef4444' : '#34d399', lineHeight: 1.2, marginTop: 4, fontFamily: 'monospace' }}>
                            {(cash.difference || 0) > 0 ? '+' : ''}{fmt(cash.difference || 0)}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 24, padding: '16px 20px', background: 'rgba(255,255,255,0.05)', borderRadius: 12 }}>
                        <div>
                            <span style={{ fontSize: 12, color: '#9ca3af' }}>Két Thực Tế</span>
                            <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginTop: 4, fontFamily: 'monospace' }}>{fmt(cash.total_counted || 0)}</div>
                        </div>
                        <div>
                            <span style={{ fontSize: 12, color: '#9ca3af' }}>Dự Kiến</span>
                            <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginTop: 4, fontFamily: 'monospace' }}>{fmt(cash.cash_end_expected || 0)}</div>
                        </div>
                    </div>
                </div>

                {/* Staff / Store Info */}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '24px -32px -24px', padding: '16px 32px', background: 'rgba(0,0,0,0.2)' }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#9ca3af' }}>storefront</span>
                        <span style={{ fontSize: 14, fontWeight: 500 }}>{cash.shift?.store?.name || '—'}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#9ca3af' }}>person</span>
                        <span style={{ fontSize: 14, fontWeight: 500 }}>{cash.shift?.started_by_user?.name || '—'}</span>
                    </div>
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '32px', background: '#f9fafb' }}>
                {cash.difference_reason && (
                    <div style={{ background: '#fff7ed', border: '1px solid #ffedd5', padding: 16, borderRadius: 12, marginBottom: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#c2410c', textTransform: 'uppercase', marginBottom: 4 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>campaign</span>
                            Lý do chênh lệch
                        </div>
                        <div style={{ fontSize: 14, color: '#9a3412', lineHeight: 1.5 }}>{cash.difference_reason}</div>
                    </div>
                )}

                {/* Denomination */}
                <section style={{ marginBottom: 24 }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.02em', margin: '0 0 12px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#9ca3af' }}>account_balance_wallet</span>
                        Kiểm két theo mệnh giá
                    </h4>
                    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                        {DENOMINATION_VALUES.reduce<React.ReactNode[]>((acc, d) => {
                            const qty = (cash as unknown as Record<string, number>)[`denom_${d}`] || 0;
                            if (qty > 0) {
                                acc.push(
                                    <div key={d} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #f3f4f6', alignItems: 'center' }}>
                                        <span style={{ fontSize: 13, color: '#4b5563', fontFamily: 'monospace' }}>{fmt(d)} × {qty}</span>
                                        <span style={{ fontSize: 14, fontWeight: 600, color: '#111827', fontFamily: 'monospace' }}>{fmt(d * qty)}</span>
                                    </div>
                                );
                            }
                            return acc;
                        }, [])}
                    </div>
                </section>

                {/* Revenue */}
                <section style={{ marginBottom: 24 }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.02em', margin: '0 0 12px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#9ca3af' }}>receipt_long</span>
                        Doanh thu & chi phí
                    </h4>
                    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                        {CASH_REVENUE_FIELDS.reduce<React.ReactNode[]>((acc, item) => {
                            const val = (cash as unknown as Record<string, number>)[item.key] || 0;
                            const note = (cash.item_notes as Record<string, string>)?.[item.key];
                            if (val !== 0 || note) {
                                acc.push(
                                    <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #f3f4f6' }}>
                                        <div>
                                            <div style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{item.label}</div>
                                            {note && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2, fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>edit_note</span> {note}
                                            </div>}
                                        </div>
                                        <span style={{ fontSize: 14, fontWeight: 600, color: item.type === 'expense' ? '#ef4444' : '#111827', fontFamily: 'monospace' }}>
                                            {item.type === 'expense' && val > 0 ? '-' : ''}{fmt(val)}
                                        </span>
                                    </div>
                                );
                            }
                            return acc;
                        }, [])}
                    </div>
                </section>

                {/* Payments */}
                <section style={{ marginBottom: 24 }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.02em', margin: '0 0 12px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#9ca3af' }}>credit_card</span>
                        Thanh toán không tiền mặt
                    </h4>
                    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                        {CASH_PAYMENT_FIELDS.reduce<React.ReactNode[]>((acc, item) => {
                            const val = (cash as unknown as Record<string, number>)[item.key] || 0;
                            if (val > 0) {
                                acc.push(
                                    <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #f3f4f6', alignItems: 'center' }}>
                                        <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{item.label}</span>
                                        <span style={{ fontSize: 14, fontWeight: 600, color: '#111827', fontFamily: 'monospace' }}>{fmt(val)}</span>
                                    </div>
                                );
                            }
                            return acc;
                        }, [])}
                    </div>
                </section>
            </div>

            {/* Action Buttons — Only for SUBMITTED status */}
            <div style={{ background: '#fff', borderTop: '1px solid #e5e7eb', padding: '16px 24px', display: 'flex', gap: 12 }}>
                {cash.status === 'SUBMITTED' ? (
                    <>
                        <button
                            style={{ flex: 1, padding: '12px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.15s ease' }}
                            onClick={onReject}
                            disabled={actionLoading}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>cancel</span>
                            Từ chối
                        </button>
                        <button
                            style={{ flex: 1, padding: '12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.15s ease', boxShadow: '0 4px 6px -1px rgba(16,185,129,0.2)' }}
                            onClick={onApprove}
                            disabled={actionLoading}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>check_circle</span>
                            {actionLoading ? 'Đang xử lý...' : 'Duyệt'}
                        </button>
                    </>
                ) : (cash.approved_at && (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', background: cash.status === 'APPROVED' ? '#ecfdf5' : '#fef2f2', color: cash.status === 'APPROVED' ? '#059669' : '#dc2626', borderRadius: 12, fontSize: 14, fontWeight: 600 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                            {cash.status === 'APPROVED' ? 'verified' : 'block'}
                        </span>
                        <span>
                            {cash.status === 'APPROVED' ? 'Đã duyệt' : 'Đã từ chối'} lúc {new Date(cash.approved_at).toLocaleString('vi-VN')}
                        </span>
                    </div>
                ))}
            </div>
            {/* End of content */}
        </div>
    );
};

export default CashHQ;
