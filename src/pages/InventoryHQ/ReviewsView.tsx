import React, { useState, useEffect, useRef, useCallback } from 'react';
import { InventoryService } from '../../services';
import { User } from '../../types';
import { STORES } from '../../constants';
import ConfirmModal from '../../components/ConfirmModal';
import PromptModal from '../../components/PromptModal';
import ReportDetailModal from './components/ReportDetailModal';

interface ToastFn {
    success: (msg: string) => void;
    error: (msg: string) => void;
    info: (msg: string) => void;
    warning: (msg: string) => void;
}

interface ReviewsViewProps {
    toast: ToastFn;
    user: User;
    onReviewDone?: () => void;
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

const STATUS_LABELS: Record<string, string> = { ALL: 'Tất cả', PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối' };

const ReviewsView: React.FC<ReviewsViewProps> = ({ toast, user, onReviewDone }) => {
    const [reports, setReports] = useState<ReportSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    // FIX #4: Separate state per modal to avoid conflicts
    const [approveReportId, setApproveReportId] = useState<string | null>(null);
    const [rejectReportId, setRejectReportId] = useState<string | null>(null);
    const [detailReportId, setDetailReportId] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('PENDING');
    const [filterStore, setFilterStore] = useState<string>('ALL');
    const [processing, setProcessing] = useState(false);
    // FIX #7: Abort stale requests when filter changes
    const abortRef = useRef<AbortController | null>(null);

    const loadReports = useCallback(async () => {
        // Cancel previous in-flight request
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        const isInitial = reports.length === 0;
        if (isInitial) setLoading(true);
        else setRefreshing(true);

        try {
            const res = await InventoryService.getReports(
                filterStatus === 'ALL' ? undefined : filterStatus,
                filterStore === 'ALL' ? undefined : filterStore
            );
            if (controller.signal.aborted) return;
            if (res.success) setReports(res.reports || []);
        } catch {
            if (!controller.signal.aborted) toast.error('Không thể tải báo cáo');
        } finally {
            if (!controller.signal.aborted) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, [filterStatus, filterStore, toast]);

    useEffect(() => { loadReports(); }, [loadReports]);
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        const start = () => { interval = setInterval(loadReports, 30000); };
        const stop = () => clearInterval(interval);
        const onVisChange = () => { document.hidden ? stop() : start(); };
        start();
        document.addEventListener('visibilitychange', onVisChange);
        return () => { stop(); document.removeEventListener('visibilitychange', onVisChange); };
    }, [loadReports]);

    const handleApprove = (id: string) => setApproveReportId(id);
    const doApprove = async () => {
        if (!approveReportId) return;
        const reportId = approveReportId;
        setApproveReportId(null);
        setProcessing(true);
        try {
            const res = await InventoryService.reviewReport(reportId, 'APPROVED', user.id);
            if (res.success) { toast.success('Đã phê duyệt báo cáo'); loadReports(); onReviewDone?.(); }
            else toast.error(res.message || 'Lỗi phê duyệt');
        } catch { toast.error('Lỗi hệ thống'); }
        finally { setProcessing(false); }
    };

    const handleReject = (id: string) => setRejectReportId(id);
    const doReject = async (reason: string) => {
        if (!rejectReportId) return;
        const reportId = rejectReportId;
        setRejectReportId(null);
        setProcessing(true);
        try {
            const res = await InventoryService.reviewReport(reportId, 'REJECTED', user.id, reason);
            if (res.success) { toast.warning('Đã từ chối báo cáo'); loadReports(); onReviewDone?.(); }
            else toast.error(res.message || 'Lỗi từ chối');
        } catch { toast.error('Lỗi hệ thống'); }
        finally { setProcessing(false); }
    };

    const getStatusStyle = (s: string) => {
        const m: Record<string, { bg: string; text: string; dot: string }> = {
            PENDING: { bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' },
            APPROVED: { bg: '#d1fae5', text: '#065f46', dot: '#10b981' },
            REJECTED: { bg: '#fef2f2', text: '#991b1b', dot: '#ef4444' },
        };
        return m[s] || m.PENDING;
    };

    /* ── Loading ── */
    if (loading && reports.length === 0) {
        return (
            <>
                <style>{CSS_TEXT}</style>
                <div className="rw-root">
                    <div className="rw-filter-bar" style={{ opacity: .5 }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                            {[1, 2, 3, 4].map(i => <div key={i} style={{ width: 80, height: 36, borderRadius: 10, background: '#f1f5f9' }} />)}
                        </div>
                    </div>
                    <div className="rw-grid">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="rw-card" style={{ overflow: 'hidden' }}>
                                <div style={{ height: 4, background: '#f1f5f9' }} />
                                <div style={{ padding: 20 }}>
                                    <div style={{ height: 18, width: 130, background: '#f1f5f9', borderRadius: 6, marginBottom: 10 }} />
                                    <div style={{ height: 12, width: 90, background: '#f8fafc', borderRadius: 4, marginBottom: 18 }} />
                                    <div style={{ height: 6, background: '#f1f5f9', borderRadius: 99, marginBottom: 14 }} />
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        {[1, 2, 3].map(j => <div key={j} style={{ flex: 1, height: 52, background: '#f8fafc', borderRadius: 10 }} />)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <style>{CSS_TEXT}</style>
            <div className="rw-root">

                {/* Filter Bar */}
                <div className="rw-filter-bar">
                    {refreshing && <div className="rw-refresh-bar" />}
                    <div className="rw-status-chips" role="radiogroup" aria-label="Lọc theo trạng thái">
                        {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(s => {
                            const count = s === 'ALL' ? reports.length : reports.filter(r => r.status === s).length;
                            return (
                                <button
                                    key={s}
                                    className={`rw-chip ${filterStatus === s ? 'active' : ''}`}
                                    onClick={() => setFilterStatus(s)}
                                    role="radio"
                                    aria-checked={filterStatus === s}
                                >
                                    {s !== 'ALL' && <span className="rw-chip-dot" style={{ background: getStatusStyle(s).dot }} />}
                                    {STATUS_LABELS[s]}
                                    {count > 0 && <span className="rw-chip-count">{count}</span>}
                                </button>
                            );
                        })}
                    </div>

                    <div className="rw-store-filter">
                        <label htmlFor="rw-store-select" className="rw-store-filter-icon">
                            <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#64748b' }}>store</span>
                        </label>
                        <div className="rw-select-wrap">
                            <select
                                id="rw-store-select"
                                className="rw-select"
                                value={filterStore}
                                onChange={e => setFilterStore(e.target.value)}
                                aria-label="Lọc theo cửa hàng"
                            >
                                <option value="ALL">Tất cả cửa hàng</option>
                                {STORES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
                            </select>
                            <span className="material-symbols-outlined rw-chevron">expand_more</span>
                        </div>
                        {filterStore !== 'ALL' && (
                            <button
                                className="rw-clear-filter"
                                onClick={() => setFilterStore('ALL')}
                                aria-label="Xóa bộ lọc cửa hàng"
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Reports Grid ── */}
                {reports.length === 0 ? (
                    <div className="rw-empty">
                        <div className="rw-empty-icon">
                            <span className="material-symbols-outlined" style={{ fontSize: 40, color: '#cbd5e1' }}>description</span>
                        </div>
                        <p className="rw-empty-title">Chưa có báo cáo nào</p>
                        <p className="rw-empty-sub">Các báo cáo kiểm kê sẽ xuất hiện ở đây</p>
                    </div>
                ) : (
                    <div className="rw-grid">
                        {reports.map(report => {
                            const storeInfo = STORES.find(s => s.code === report.store);
                            const completion = report.total > 0 ? Math.round(((report.matched + report.missing + report.over) / report.total) * 100) : 0;
                            const hasDiscrepancy = report.missing > 0 || report.over > 0;
                            const ss = getStatusStyle(report.status);

                            return (
                                <div key={report.id} className="rw-card">
                                    {/* Status Bar */}
                                    <div className="rw-card-bar" style={{ background: ss.dot }} />

                                    {/* Header */}
                                    <div className="rw-card-hdr">
                                        <div>
                                            <h3 className="rw-card-title">{storeInfo?.name || report.store}</h3>
                                            <p className="rw-card-meta">Ca {report.shift} • {new Date(report.date).toLocaleDateString('vi-VN')}</p>
                                        </div>
                                        <span className="rw-badge" style={{ background: ss.bg, color: ss.text }}>
                                            <span className="rw-badge-dot" style={{ background: ss.dot }} />
                                            {STATUS_LABELS[report.status] || report.status}
                                        </span>
                                    </div>

                                    {/* Body */}
                                    <div className="rw-card-body">
                                        {/* Progress */}
                                        <div className="rw-progress-row">
                                            <span className="rw-progress-label">Hoàn thành</span>
                                            <span className="rw-progress-pct">{completion}%</span>
                                        </div>
                                        <div className="rw-progress-track">
                                            <div
                                                className="rw-progress-fill"
                                                style={{
                                                    width: `${completion}%`,
                                                    background: hasDiscrepancy
                                                        ? 'linear-gradient(90deg,#f97316,#ef4444)'
                                                        : 'linear-gradient(90deg,#10b981,#059669)',
                                                }}
                                            />
                                        </div>

                                        {/* Mini Stats */}
                                        <div className="rw-mini-stats">
                                            <div className="rw-mini" style={{ background: '#f0fdf4' }}>
                                                <span className="rw-mini-label">Khớp</span>
                                                <span className="rw-mini-val" style={{ color: '#16a34a' }}>{report.matched}</span>
                                            </div>
                                            <div className="rw-mini" style={{ background: '#fef2f2' }}>
                                                <span className="rw-mini-label">Thiếu</span>
                                                <span className="rw-mini-val" style={{ color: '#dc2626' }}>{report.missing}</span>
                                            </div>
                                            <div className="rw-mini" style={{ background: '#eef2ff' }}>
                                                <span className="rw-mini-label">Thừa</span>
                                                <span className="rw-mini-val" style={{ color: '#4f46e5' }}>{report.over}</span>
                                            </div>
                                        </div>

                                        {/* Submitter */}
                                        <div className="rw-submitter">
                                            <div>
                                                <span className="rw-submitter-label">Người nộp</span>
                                                <span className="rw-submitter-name">{report.submittedBy}</span>
                                            </div>
                                            <span className="rw-submitter-time">{new Date(report.submittedAt).toLocaleString('vi-VN')}</span>
                                        </div>

                                        {/* Actions */}
                                        <div className="rw-actions">
                                            <button className="rw-btn-detail" onClick={() => setDetailReportId(report.id)}>
                                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>visibility</span>
                                                Chi tiết
                                            </button>
                                            {report.status === 'PENDING' && (
                                                <>
                                                    <button className="rw-btn-reject" onClick={() => handleReject(report.id)}>
                                                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                                                        Từ chối
                                                    </button>
                                                    <button className="rw-btn-approve" onClick={() => handleApprove(report.id)}>
                                                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check</span>
                                                        Phê duyệt
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── Modals ── */}
            <ConfirmModal
                isOpen={!!approveReportId}
                title="✅ Phê duyệt báo cáo"
                message="Xác nhận phê duyệt báo cáo kiểm kho này?"
                variant="info"
                confirmText="Phê duyệt"
                cancelText="Hủy"
                onConfirm={doApprove}
                onCancel={() => setApproveReportId(null)}
                loading={processing}
            />
            <PromptModal
                isOpen={!!rejectReportId}
                title="❌ Từ chối báo cáo"
                message="Vui lòng nhập lý do từ chối báo cáo"
                placeholder="Ví dụ: Dữ liệu không chính xác, thiếu quá nhiều sản phẩm..."
                confirmText="Từ chối"
                cancelText="Hủy"
                onConfirm={doReject}
                onCancel={() => setRejectReportId(null)}
            />
            {detailReportId && (
                <ReportDetailModal
                    reportId={detailReportId}
                    toast={toast}
                    onClose={() => setDetailReportId(null)}
                />
            )}
        </>
    );
};

export default ReviewsView;

/* ══════ CSS ══════ */
const CSS_TEXT = `
.rw-root { display:flex; flex-direction:column; gap:16px; padding-top:20px; }

/* Filter Bar */
.rw-filter-bar { display:flex; align-items:center; gap:16px; flex-wrap:wrap; position:relative; }
.rw-refresh-bar { position:absolute; bottom:0; left:0; right:0; height:2px; background:linear-gradient(90deg,transparent,#6366f1,transparent); border-radius:2px; animation:rw-slide 1.2s ease-in-out infinite; }
@keyframes rw-slide { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
.rw-status-chips { display:flex; gap:6px; background:#fff; border-radius:14px; padding:4px; border:1px solid #e5e7eb; }
.rw-chip { display:inline-flex; align-items:center; gap:6px; padding:10px 18px; border-radius:10px; font-size:13px; font-weight:700; border:none; background:transparent; color:#475569; cursor:pointer; transition:all .15s; }
.rw-chip:hover { background:#f8fafc; color:#334155; }
.rw-chip:focus-visible { outline:2px solid #6366f1; outline-offset:2px; }
.rw-chip.active { background:linear-gradient(135deg,#6366f1,#4f46e5); color:#fff; box-shadow:0 2px 8px -2px rgba(99,102,241,.35); }
.rw-chip-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
.rw-chip.active .rw-chip-dot { background:#fff !important; }
.rw-chip-count { font-size:11px; font-weight:700; background:#f1f5f9; color:#475569; padding:1px 7px; border-radius:10px; min-width:18px; text-align:center; line-height:1.4; }
.rw-chip.active .rw-chip-count { background:rgba(255,255,255,.25); color:#fff; }

/* Store filter */
.rw-store-filter { display:flex; align-items:center; gap:8px; }
.rw-store-filter-icon { display:flex; align-items:center; cursor:default; }
.rw-select-wrap { position:relative; }
.rw-select { padding:10px 36px 10px 14px; background:#fff; border:1.5px solid #e2e8f0; border-radius:10px; font-size:13px; font-weight:700; color:#1e293b; outline:none; appearance:none; cursor:pointer; transition:border-color .15s; }
.rw-select:focus { border-color:#818cf8; box-shadow:0 0 0 3px rgba(99,102,241,.1); }
.rw-select:focus-visible { outline:2px solid #6366f1; outline-offset:2px; }
.rw-chevron { position:absolute; right:10px; top:50%; transform:translateY(-50%); font-size:18px; color:#64748b; pointer-events:none; }
.rw-clear-filter { width:36px; height:36px; border-radius:8px; display:flex; align-items:center; justify-content:center; background:#fef2f2; border:none; cursor:pointer; color:#ef4444; transition:all .15s; }
.rw-clear-filter:hover { background:#fee2e2; }
.rw-clear-filter:focus-visible { outline:2px solid #ef4444; outline-offset:2px; }

/* Grid */
.rw-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(340px,1fr)); gap:16px; }

/* Card */
.rw-card { background:#fff; border-radius:16px; border:1px solid #e5e7eb; overflow:hidden; transition:box-shadow .3s,transform .2s; }
.rw-card:hover { box-shadow:0 8px 30px -8px rgba(0,0,0,.1); transform:translateY(-2px); }
.rw-card-bar { height:4px; width:100%; }
.rw-card-hdr { display:flex; align-items:flex-start; justify-content:space-between; padding:16px 20px 10px; }
.rw-card-title { font-size:16px; font-weight:800; color:#1e293b; margin:0; }
.rw-card-meta { font-size:13px; color:#64748b; font-weight:500; margin-top:3px; }
.rw-badge { display:inline-flex; align-items:center; gap:5px; padding:4px 12px; border-radius:20px; font-size:11px; font-weight:700; white-space:nowrap; }
.rw-badge-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }

/* Body */
.rw-card-body { padding:0 20px 16px; }
.rw-progress-row { display:flex; justify-content:space-between; margin-bottom:6px; }
.rw-progress-label { font-size:13px; color:#64748b; font-weight:600; }
.rw-progress-pct { font-size:13px; font-weight:800; color:#1e293b; }
.rw-progress-track { height:6px; background:#f1f5f9; border-radius:99px; overflow:hidden; }
.rw-progress-fill { height:100%; border-radius:99px; transition:width .8s ease-out; }

/* Mini stats */
.rw-mini-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-top:14px; }
.rw-mini { border-radius:10px; padding:10px 8px; text-align:center; }
.rw-mini-label { display:block; font-size:12px; color:#64748b; font-weight:600; margin-bottom:2px; }
.rw-mini-val { font-size:18px; font-weight:800; line-height:1.2; }

/* Submitter */
.rw-submitter { display:flex; align-items:center; justify-content:space-between; margin-top:14px; padding-top:12px; border-top:1px solid #f1f5f9; }
.rw-submitter-label { display:block; font-size:12px; color:#64748b; font-weight:600; }
.rw-submitter-name { display:block; font-size:13px; font-weight:700; color:#1e293b; }
.rw-submitter-time { font-size:12px; color:#64748b; }

/* Actions */
.rw-actions { display:flex; gap:8px; margin-top:14px; padding-top:12px; border-top:1px solid #f1f5f9; }
.rw-btn-detail { flex:1; display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:12px 0; border-radius:10px; background:#eef2ff; border:1px solid #c7d2fe; color:#4f46e5; font-size:13px; font-weight:700; cursor:pointer; transition:all .15s; }
.rw-btn-detail:hover { background:#e0e7ff; }
.rw-btn-detail:focus-visible { outline:2px solid #4f46e5; outline-offset:2px; }
.rw-btn-reject { flex:1; display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:12px 0; border-radius:10px; background:#fff; border:1.5px solid #fca5a5; color:#dc2626; font-size:13px; font-weight:700; cursor:pointer; transition:all .15s; }
.rw-btn-reject:hover { background:#fef2f2; border-color:#ef4444; }
.rw-btn-reject:focus-visible { outline:2px solid #dc2626; outline-offset:2px; }
.rw-btn-approve { flex:1; display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:12px 0; border-radius:10px; background:linear-gradient(135deg,#10b981,#059669); border:none; color:#fff; font-size:13px; font-weight:700; cursor:pointer; box-shadow:0 4px 14px -3px rgba(16,185,129,.4); transition:transform .15s,box-shadow .2s; }
.rw-btn-approve:hover { transform:translateY(-1px); box-shadow:0 6px 20px -4px rgba(16,185,129,.5); }
.rw-btn-approve:focus-visible { outline:2px solid #059669; outline-offset:2px; }

/* Empty */
.rw-empty { display:flex; flex-direction:column; align-items:center; gap:12px; padding:80px 20px; background:#fff; border-radius:16px; border:1px solid #e5e7eb; }
.rw-empty-icon { width:80px; height:80px; border-radius:50%; background:#f8fafc; display:flex; align-items:center; justify-content:center; }
.rw-empty-title { font-size:16px; font-weight:700; color:#475569; margin:0; }
.rw-empty-sub { font-size:13px; color:#64748b; margin:0; }
`;
