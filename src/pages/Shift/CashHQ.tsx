import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { User, Store } from '../../types';
import type { Shift, CashSettlement } from '../../types/shift';
import { SHIFT_ICONS, SHIFT_COLORS, CASH_REVENUE_FIELDS, CASH_PAYMENT_FIELDS, DENOMINATION_VALUES } from '../../types/shift';
import { ShiftService, CashService } from '../../services/shift';
import { useToast } from '../../contexts';
import { supabase } from '../../lib/supabase';
import '../../styles/hq-sidebar.css';
import '../../styles/shift.css';

/* ═══════════════════════════════════════════════
   CASH HQ — Quản Lý Két
   ═══════════════════════════════════════════════ */

const CashHQ: React.FC<{ user: User }> = ({ user }) => {
    const toast = useToast();
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedStore, setSelectedStore] = useState<string>('all');
    const [dateRange, setDateRange] = useState(() => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return {
            start: start.toISOString().split('T')[0],
            end: now.toISOString().split('T')[0],
        };
    });
    const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
    const [shiftCash, setShiftCash] = useState<CashSettlement | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [topbarNode, setTopbarNode] = useState<HTMLElement | null>(null);

    useEffect(() => {
        setTopbarNode(document.getElementById('topbar-left'));
    }, []);

    // ─── Load data ───
    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [storeData, shiftData] = await Promise.all([
                    supabase.from('stores').select('id, code, name').eq('is_active', true).order('sort_order'),
                    ShiftService.listShifts({
                        storeId: selectedStore !== 'all' ? selectedStore : undefined,
                        startDate: dateRange.start,
                        endDate: dateRange.end,
                        limit: 100,
                    }),
                ]);
                setStores((storeData.data as Store[]) || []);
                setShifts(shiftData);
            } catch (err) {
                console.error('[CashHQ] Load error:', err);
                toast.error('Lỗi khi tải danh sách ca');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [selectedStore, dateRange]);

    // ─── Load selected shift cash details ───
    useEffect(() => {
        if (!selectedShift) { setShiftCash(null); return; }
        setDetailLoading(true);
        CashService.getByShift(selectedShift.id)
            .then(setShiftCash)
            .finally(() => setDetailLoading(false));
    }, [selectedShift]);

    // ─── Stats ───
    const stats = useMemo(() => {
        let completedCount = 0;
        for (const s of shifts) {
            if (s.status === 'COMPLETED' || s.status === 'LOCKED') completedCount++;
        }
        return { total: shifts.length, completed: completedCount, open: shifts.length - completedCount };
    }, [shifts]);

    const fmt = (amount: number) => new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
    const fmtDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const fmtTime = (dateStr?: string) => {
        if (!dateStr) return '--:--';
        return new Date(dateStr).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    };
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
                        { label: 'Tổng ca', value: stats.total, icon: 'event', color: '#3b82f6', bg: '#dbeafe' },
                        { label: 'Đã kết két', value: stats.completed, icon: 'check_circle', color: '#10b981', bg: '#d1fae5' },
                        { label: 'Đang mở', value: stats.open, icon: 'schedule', color: '#f59e0b', bg: '#fef3c7' },
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
                    <input type="date" className="cashhq-date" value={dateRange.start} onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))} />
                    <span className="cashhq-arrow">→</span>
                    <input type="date" className="cashhq-date" value={dateRange.end} onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))} />
                </div>

                {/* Main 2-panel layout */}
                <div className={`cashhq-panels ${selectedShift ? 'with-detail' : ''}`}>
                    {/* Left: Shift list */}
                    <div className="card cashhq-list">
                        <div className="cashhq-list-scroll">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Ngày</th>
                                        <th>Ca</th>
                                        <th>Cửa hàng</th>
                                        <th>NV</th>
                                        <th>Trạng thái</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan={6} className="cashhq-loading">
                                            <div className="cashhq-spinner" />
                                        </td></tr>
                                    ) : shifts.length === 0 ? (
                                        <tr><td colSpan={6} className="cashhq-empty">
                                            Không có ca nào trong khoảng thời gian đã chọn
                                        </td></tr>
                                    ) : shifts.map(s => (
                                        <tr
                                            key={s.id}
                                            className={`cashhq-row ${selectedShift?.id === s.id ? 'active' : ''}`}
                                            onClick={() => setSelectedShift(s)}
                                        >
                                            <td className="cashhq-date-cell">{fmtDate(s.shift_date)}</td>
                                            <td>
                                                <div className="cashhq-shift-badge">
                                                    <span className="material-symbols-outlined material-symbols-fill" style={{ fontSize: 14, color: SHIFT_COLORS[s.shift_type] }}>
                                                        {SHIFT_ICONS[s.shift_type]}
                                                    </span>
                                                    <span>{s.shift_type === 'MORNING' ? 'S' : s.shift_type === 'AFTERNOON' ? 'C' : 'T'}</span>
                                                </div>
                                            </td>
                                            <td className="cashhq-cell-sm">{s.store?.name || '—'}</td>
                                            <td className="cashhq-cell-sm cashhq-cell-bold">{s.started_by_user?.name || '—'}</td>
                                            <td>
                                                <span className={`badge ${s.status === 'COMPLETED' ? 'badge-success' : s.status === 'LOCKED' ? 'badge-info' : 'badge-warning'}`}>
                                                    {s.status === 'COMPLETED' ? 'Xong' : s.status === 'LOCKED' ? 'Khóa' : 'Mở'}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="material-symbols-outlined cashhq-chevron">chevron_right</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Right: Cash Detail Panel */}
                    {selectedShift && (
                        <CashDetailPanel
                            shift={selectedShift}
                            cash={shiftCash}
                            loading={detailLoading}
                            onClose={() => setSelectedShift(null)}
                            fmt={fmt}
                            fmtDate={fmtDate}
                            shiftLabel={shiftLabel}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════
   CASH DETAIL PANEL (Extracted component)
   ═══════════════════════════════════════════════ */
interface CashDetailPanelProps {
    shift: Shift;
    cash: CashSettlement | null;
    loading: boolean;
    onClose: () => void;
    fmt: (n: number) => string;
    fmtDate: (s: string) => string;
    shiftLabel: (t: string) => string;
}

const CashDetailPanel: React.FC<CashDetailPanelProps> = ({ shift, cash, loading, onClose, fmt, fmtDate, shiftLabel }) => (
    <div className="card cashhq-detail">
        {/* Sticky header */}
        <div className="cashhq-detail-header">
            <div>
                <h3 className="cashhq-detail-title">Két Ca {shiftLabel(shift.shift_type)}</h3>
                <p className="cashhq-detail-sub">
                    {fmtDate(shift.shift_date)} • {shift.store?.name} • {shift.started_by_user?.name}
                </p>
            </div>
            <button className="cashhq-close-btn" onClick={onClose}>
                <span className="material-symbols-outlined">close</span>
            </button>
        </div>

        <div className="cashhq-detail-body">
            {loading ? (
                <div className="cashhq-detail-empty">Đang tải...</div>
            ) : !cash ? (
                <div className="cashhq-detail-empty">Chưa có báo cáo két cho ca này</div>
            ) : (
                <>
                    {/* Denomination */}
                    <section className="cashhq-section">
                        <h4 className="cashhq-section-title">
                            <span className="material-symbols-outlined">account_balance_wallet</span>
                            Kiểm két theo mệnh giá
                        </h4>
                        <div className="cashhq-denom-grid">
                            {DENOMINATION_VALUES.map(d => {
                                const qty = (cash as any)[`denom_${d}`] || 0;
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
                            const val = (cash as any)[item.key] || 0;
                            const note = (cash.item_notes as any)?.[item.key];
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
                            const val = (cash as any)[item.key] || 0;
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
                </>
            )}
        </div>
    </div>
);

export default CashHQ;
