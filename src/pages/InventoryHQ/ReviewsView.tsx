import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { InventoryService } from '../../services';
import { User } from '../../types';
import { STORES } from '../../constants';
import ConfirmModal from '../../components/ConfirmModal';
import PromptModal from '../../components/PromptModal';
import ReportDetailModal from './components/ReportDetailModal';
import ItemsDetailPanel from './components/ItemsDetailPanel';

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
    storeId: string;
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
    reviewedBy?: string;
    reviewedAt?: string;
    rejectionReason?: string;
}

type ViewMode = 'PENDING' | 'HISTORY';

const STATUS_CFG: Record<string, { label: string; bg: string; text: string; dot: string; icon: string }> = {
    PENDING: { label: 'Chờ duyệt', bg: '#fef3c7', text: '#92400e', dot: '#f59e0b', icon: 'schedule' },
    APPROVED: { label: 'Đã duyệt', bg: '#d1fae5', text: '#065f46', dot: '#10b981', icon: 'check_circle' },
    REJECTED: { label: 'Từ chối', bg: '#fef2f2', text: '#991b1b', dot: '#ef4444', icon: 'cancel' },
};

const SHIFT_LABELS: Record<number, string> = { 1: 'Ca 1', 2: 'Ca 2', 3: 'Ca 3' };

const ReviewsView: React.FC<ReviewsViewProps> = ({ toast, user, onReviewDone }) => {
    const [reports, setReports] = useState<ReportSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>('PENDING');
    const [filterStore, setFilterStore] = useState<string>('ALL');
    const [search, setSearch] = useState('');
    const [sortField, setSortField] = useState<'date' | 'store' | 'shift'>('date');
    const [sortAsc, setSortAsc] = useState(false);

    // Modal states
    const [approveReportId, setApproveReportId] = useState<string | null>(null);
    const [rejectReportId, setRejectReportId] = useState<string | null>(null);
    const [deleteReportId, setDeleteReportId] = useState<string | null>(null);
    const [detailReportId, setDetailReportId] = useState<string | null>(null);
    const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const abortRef = useRef<AbortController | null>(null);

    /* ── Data Loading ── */
    const loadReports = useCallback(async () => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        const isInitial = reports.length === 0;
        if (isInitial) setLoading(true);
        else setRefreshing(true);

        try {
            const statusFilter = viewMode === 'PENDING' ? 'PENDING' : undefined;
            const res = await InventoryService.getReports(
                statusFilter,
                filterStore === 'ALL' ? undefined : filterStore
            );
            if (controller.signal.aborted) return;
            if (res.success) {
                let items = res.reports || [];
                // For history mode, show only non-pending
                if (viewMode === 'HISTORY') {
                    items = items.filter((r: any) => r.status !== 'PENDING');
                }
                setReports(items);
            }
        } catch {
            if (!controller.signal.aborted) toast.error('Không thể tải báo cáo');
        } finally {
            if (!controller.signal.aborted) { setLoading(false); setRefreshing(false); }
        }
    }, [viewMode, filterStore, toast]);

    useEffect(() => { loadReports(); }, [loadReports]);
    useEffect(() => {
        if (viewMode !== 'PENDING') return;
        let interval: ReturnType<typeof setInterval>;
        const start = () => { interval = setInterval(loadReports, 30_000); };
        const stop = () => clearInterval(interval);
        const onVis = () => { document.hidden ? stop() : start(); };
        start();
        document.addEventListener('visibilitychange', onVis);
        return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
    }, [loadReports, viewMode]);

    // Reset selection on mode/filter change
    useEffect(() => { setSelectedIds(new Set()); }, [viewMode, filterStore]);

    /* ── Filtered & Sorted ── */
    const displayed = useMemo(() => {
        let list = [...reports];
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(r =>
                (STORES.find(s => s.code === r.store)?.name || r.store).toLowerCase().includes(q) ||
                r.submittedBy.toLowerCase().includes(q) ||
                r.date.includes(q)
            );
        }
        list.sort((a, b) => {
            let cmp = 0;
            if (sortField === 'date') cmp = a.date.localeCompare(b.date);
            else if (sortField === 'store') cmp = a.store.localeCompare(b.store);
            else cmp = a.shift - b.shift;
            return sortAsc ? cmp : -cmp;
        });
        return list;
    }, [reports, search, sortField, sortAsc]);

    /* ── Actions ── */
    const doApprove = async () => {
        if (!approveReportId) return;
        const id = approveReportId;
        setApproveReportId(null);
        setProcessing(true);
        try {
            const res = await InventoryService.reviewReport(id, 'APPROVED', user.id);
            if (res.success) { toast.success('Đã phê duyệt báo cáo'); loadReports(); onReviewDone?.(); }
            else toast.error(res.message || 'Lỗi phê duyệt');
        } catch { toast.error('Lỗi hệ thống'); }
        finally { setProcessing(false); }
    };

    const doReject = async (reason: string) => {
        if (!rejectReportId) return;
        const id = rejectReportId;
        setRejectReportId(null);
        setProcessing(true);
        try {
            const res = await InventoryService.reviewReport(id, 'REJECTED', user.id, reason);
            if (res.success) { toast.warning('Đã từ chối báo cáo'); loadReports(); onReviewDone?.(); }
            else toast.error(res.message || 'Lỗi từ chối');
        } catch { toast.error('Lỗi hệ thống'); }
        finally { setProcessing(false); }
    };

    const doDelete = async () => {
        if (!deleteReportId) return;
        const id = deleteReportId;
        setDeleteReportId(null);
        setProcessing(true);
        try {
            const res = await InventoryService.deleteReport(id);
            if (res.success) {
                toast.success('Đã xóa báo cáo');
                setReports(prev => prev.filter(r => r.id !== id));
                setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
                onReviewDone?.();
            } else {
                toast.error(res.message || 'Lỗi xóa báo cáo');
            }
        } catch {
            toast.error('Lỗi hệ thống khi xóa');
        } finally { setProcessing(false); }
    };

    const doBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        setDeleteReportId(null);
        setProcessing(true);
        const deletedIds: string[] = [];
        let fail = 0;
        for (const id of selectedIds) {
            try {
                const res = await InventoryService.deleteReport(id);
                if (res.success) deletedIds.push(id); else fail++;
            } catch { fail++; }
        }
        setProcessing(false);
        if (deletedIds.length > 0) {
            toast.success(`Đã xóa ${deletedIds.length} báo cáo`);
            setReports(prev => prev.filter(r => !deletedIds.includes(r.id)));
        }
        if (fail > 0) toast.error(`${fail} báo cáo xóa thất bại`);
        setSelectedIds(new Set());
        onReviewDone?.();
    };

    /* ── Selection helpers ── */
    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };
    const toggleSelectAll = () => {
        if (selectedIds.size === displayed.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(displayed.map(r => r.id)));
    };

    /* ── Sort handler ── */
    const handleSort = (field: typeof sortField) => {
        if (sortField === field) setSortAsc(!sortAsc);
        else { setSortField(field); setSortAsc(false); }
    };
    const SortIcon: React.FC<{ field: typeof sortField }> = ({ field }) => (
        <span className="material-symbols-outlined rv2-sort-icon" style={{
            opacity: sortField === field ? 1 : .3,
            transform: sortField === field && sortAsc ? 'scaleY(-1)' : 'none'
        }}>arrow_downward</span>
    );

    /* ── Helpers ── */
    const storeName = (code: string) => STORES.find(s => s.code === code)?.name || code;
    const formatDate = (d: string) => {
        try { return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
        catch { return d; }
    };
    const formatDateTime = (d: string) => {
        try { return new Date(d).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }); }
        catch { return d; }
    };
    const pendingCount = useMemo(() => reports.length, [reports]);

    /* ── Skeleton Loading ── */
    if (loading && reports.length === 0) {
        return (
            <>
                <style>{CSS_TEXT}</style>
                <div className="rv2-root">
                    <div className="rv2-toolbar-wrap">
                        <div style={{ display: 'flex', gap: 8, flex: 1 }}>
                            <div className="rv2-skel" style={{ width: 200, height: 40 }} />
                            <div className="rv2-skel" style={{ width: 160, height: 40 }} />
                        </div>
                    </div>
                    <div className="rv2-table-card">
                        <div className="rv2-table-scroll">
                            <table className="rv2-table"><tbody>
                                {[1, 2, 3, 4, 5].map(i => (
                                    <tr key={i} className="rv2-row">
                                        {[100, 120, 60, 80, 60, 60, 60, 80].map((w, j) => (
                                            <td key={j}><div className="rv2-skel" style={{ width: w, height: 14 }} /></td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody></table>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <style>{CSS_TEXT}</style>
            <div className="rv2-root">

                {/* ── Toolbar ── */}
                <div className="rv2-toolbar-wrap">
                    {refreshing && <div className="rv2-refresh-bar" />}

                    <div className="rv2-toolbar">
                        {/* Left: Mode Toggle */}
                        <div className="rv2-mode-toggle" role="radiogroup" aria-label="Chế độ xem">
                            <button
                                className={`rv2-mode-btn ${viewMode === 'PENDING' ? 'active' : ''}`}
                                onClick={() => setViewMode('PENDING')}
                                role="radio" aria-checked={viewMode === 'PENDING'}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>pending_actions</span>
                                Chờ duyệt
                                {viewMode === 'PENDING' && pendingCount > 0 && (
                                    <span className="rv2-badge-count">{pendingCount}</span>
                                )}
                            </button>
                            <button
                                className={`rv2-mode-btn ${viewMode === 'HISTORY' ? 'active' : ''}`}
                                onClick={() => setViewMode('HISTORY')}
                                role="radio" aria-checked={viewMode === 'HISTORY'}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>history</span>
                                Lịch sử
                            </button>
                        </div>

                        {/* Search */}
                        <div className="rv2-search">
                            <span className="material-symbols-outlined rv2-search-icon">search</span>
                            <input
                                className="rv2-search-input"
                                placeholder="Tìm cửa hàng, người nộp..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                aria-label="Tìm kiếm"
                            />
                            {search && (
                                <button className="rv2-search-clear" onClick={() => setSearch('')} aria-label="Xóa tìm kiếm">
                                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                                </button>
                            )}
                        </div>

                        {/* Store filter */}
                        <div className="rv2-store-filter">
                            <select
                                className="rv2-select"
                                value={filterStore}
                                onChange={e => setFilterStore(e.target.value)}
                                aria-label="Lọc cửa hàng"
                            >
                                <option value="ALL">Tất cả cửa hàng</option>
                                {STORES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
                            </select>
                            <span className="material-symbols-outlined rv2-select-chevron">expand_more</span>
                        </div>

                        {/* History actions */}
                        {viewMode === 'HISTORY' && selectedIds.size > 0 && (
                            <button
                                className="rv2-btn-bulk-delete"
                                onClick={() => setDeleteReportId('__BULK__')}
                                disabled={processing}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete_sweep</span>
                                Xóa {selectedIds.size} mục
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Table ── */}
                <div className="rv2-table-card">
                    {displayed.length === 0 ? (
                        <div className="rv2-empty">
                            <div className="rv2-empty-icon">
                                <span className="material-symbols-outlined" style={{ fontSize: 44, color: '#cbd5e1' }}>
                                    {viewMode === 'PENDING' ? 'task_alt' : 'history'}
                                </span>
                            </div>
                            <p className="rv2-empty-title">
                                {viewMode === 'PENDING' ? 'Không có báo cáo chờ duyệt' : 'Chưa có lịch sử duyệt'}
                            </p>
                            <p className="rv2-empty-sub">
                                {viewMode === 'PENDING'
                                    ? 'Các báo cáo kiểm kê mới sẽ xuất hiện ở đây'
                                    : 'Báo cáo đã duyệt hoặc từ chối sẽ hiện ở đây'}
                            </p>
                        </div>
                    ) : (
                        <div className="rv2-table-scroll">
                            <table className="rv2-table">
                                <thead>
                                    <tr>
                                        {viewMode === 'HISTORY' && (
                                            <th className="rv2-th rv2-th-check" style={{ width: '4%' }}>
                                                <input
                                                    type="checkbox"
                                                    className="rv2-checkbox"
                                                    checked={selectedIds.size === displayed.length && displayed.length > 0}
                                                    onChange={toggleSelectAll}
                                                    aria-label="Chọn tất cả"
                                                />
                                            </th>
                                        )}
                                        <th className="rv2-th rv2-th-sort" style={{ width: '17%' }} onClick={() => handleSort('store')}>
                                            Cửa hàng <SortIcon field="store" />
                                        </th>
                                        <th className="rv2-th rv2-th-sort" style={{ width: '8%' }} onClick={() => handleSort('shift')}>
                                            Ca <SortIcon field="shift" />
                                        </th>
                                        <th className="rv2-th rv2-th-sort" style={{ width: '12%' }} onClick={() => handleSort('date')}>
                                            Ngày <SortIcon field="date" />
                                        </th>
                                        <th className="rv2-th" style={{ width: '18%' }}>Người nộp</th>
                                        <th className="rv2-th rv2-th-num" style={{ width: '8%' }}>Khớp</th>
                                        <th className="rv2-th rv2-th-num" style={{ width: '8%' }}>Thiếu</th>
                                        <th className="rv2-th rv2-th-num" style={{ width: '8%' }}>Thừa</th>
                                        <th className="rv2-th" style={{ width: '17%' }}>Trạng thái</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayed.map(report => {
                                        const cfg = STATUS_CFG[report.status] || STATUS_CFG.PENDING;
                                        const hasIssue = report.missing > 0 || report.over > 0;

                                        return (
                                            <React.Fragment key={report.id}>
                                                <tr
                                                    className={`rv2-row rv2-row--clickable ${report.status === 'PENDING' ? 'rv2-row--pending' : ''} ${selectedIds.has(report.id) ? 'rv2-row--selected' : ''} ${expandedReportId === report.id ? 'rv2-row--expanded' : ''}`}
                                                    onClick={() => setExpandedReportId(prev => prev === report.id ? null : report.id)}
                                                >
                                                    {viewMode === 'HISTORY' && (
                                                        <td className="rv2-td rv2-td-check" onClick={e => e.stopPropagation()}>
                                                            <input
                                                                type="checkbox"
                                                                className="rv2-checkbox"
                                                                checked={selectedIds.has(report.id)}
                                                                onChange={() => toggleSelect(report.id)}
                                                                aria-label={`Chọn báo cáo ${storeName(report.store)}`}
                                                            />
                                                        </td>
                                                    )}

                                                    {/* Store */}
                                                    <td className="rv2-td">
                                                        <div className="rv2-store-cell">
                                                            <span className="rv2-store-dot" style={{ background: cfg.dot }} />
                                                            <span className="rv2-store-name">{storeName(report.store)}</span>
                                                        </div>
                                                    </td>

                                                    {/* Shift */}
                                                    <td className="rv2-td">
                                                        <span className="rv2-shift-pill">{SHIFT_LABELS[report.shift] || `Ca ${report.shift}`}</span>
                                                    </td>

                                                    {/* Date */}
                                                    <td className="rv2-td rv2-td-date">{formatDate(report.date)}</td>

                                                    {/* Submitter */}
                                                    <td className="rv2-td">
                                                        <div className="rv2-submitter-cell">
                                                            <span className="rv2-submitter-name">{report.submittedBy}</span>
                                                            <span className="rv2-submitter-time">{formatDateTime(report.submittedAt)}</span>
                                                        </div>
                                                    </td>

                                                    {/* Stats */}
                                                    <td className="rv2-td rv2-td-num rv2-num-match">{report.matched}<span className="rv2-num-total">/{report.total}</span></td>
                                                    <td className={`rv2-td rv2-td-num ${report.missing > 0 ? 'rv2-num-danger' : 'rv2-num-muted'}`}>{report.missing}</td>
                                                    <td className={`rv2-td rv2-td-num ${report.over > 0 ? 'rv2-num-info' : 'rv2-num-muted'}`}>{report.over}</td>

                                                    {/* Status + Inline Actions */}
                                                    <td className="rv2-td" onClick={e => e.stopPropagation()}>
                                                        <div className="rv2-status-cell">
                                                            <span className="rv2-status-badge" style={{ background: cfg.bg, color: cfg.text }}>
                                                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{cfg.icon}</span>
                                                                {cfg.label}
                                                            </span>

                                                            {report.status === 'PENDING' && (
                                                                <div className="rv2-inline-actions">
                                                                    <button
                                                                        className="rv2-inline-btn rv2-inline-approve"
                                                                        onClick={() => setApproveReportId(report.id)}
                                                                        disabled={processing}
                                                                        title="Phê duyệt"
                                                                    >
                                                                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check</span>
                                                                        Duyệt
                                                                    </button>
                                                                    <button
                                                                        className="rv2-inline-btn rv2-inline-reject"
                                                                        onClick={() => setRejectReportId(report.id)}
                                                                        disabled={processing}
                                                                        title="Từ chối"
                                                                    >
                                                                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                                                                        Từ chối
                                                                    </button>
                                                                </div>
                                                            )}

                                                            {viewMode === 'HISTORY' && (
                                                                <button
                                                                    className="rv2-hover-delete"
                                                                    onClick={() => setDeleteReportId(report.id)}
                                                                    disabled={processing}
                                                                    title="Xóa báo cáo"
                                                                >
                                                                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                                {expandedReportId === report.id && (
                                                    <tr className="rv2-row--detail">
                                                        <td colSpan={viewMode === 'HISTORY' ? 9 : 8} style={{ padding: 0 }}>
                                                            <div className="rv2-items-detail" onClick={e => e.stopPropagation()}>
                                                                <ItemsDetailPanel
                                                                    storeId={report.storeId}
                                                                    checkDate={report.date}
                                                                    shift={report.shift}
                                                                    isOpen={true}
                                                                    mode="inline"
                                                                />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Footer */}
                    {displayed.length > 0 && (
                        <div className="rv2-footer">
                            <span>
                                {viewMode === 'HISTORY' && selectedIds.size > 0
                                    ? <><strong>{selectedIds.size}</strong> đã chọn</>
                                    : <><strong>{displayed.length}</strong> báo cáo</>
                                }
                            </span>
                            <span style={{ color: '#94a3b8' }}>
                                {viewMode === 'PENDING' ? 'Auto-refresh 30s' : 'Lịch sử duyệt'}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Modals ── */}
            <ConfirmModal
                isOpen={!!approveReportId}
                title="Phê duyệt báo cáo"
                message="Xác nhận phê duyệt báo cáo kiểm kho này? Tồn kho hệ thống sẽ được cập nhật."
                variant="info"
                confirmText="Phê duyệt"
                cancelText="Hủy"
                onConfirm={doApprove}
                onCancel={() => setApproveReportId(null)}
                loading={processing}
            />
            <PromptModal
                isOpen={!!rejectReportId}
                title="Từ chối báo cáo"
                message="Vui lòng nhập lý do từ chối báo cáo"
                placeholder="Ví dụ: Dữ liệu không chính xác..."
                confirmText="Từ chối"
                cancelText="Hủy"
                onConfirm={doReject}
                onCancel={() => setRejectReportId(null)}
            />
            <ConfirmModal
                isOpen={!!deleteReportId}
                title="Xóa báo cáo"
                message={deleteReportId === '__BULK__'
                    ? `Xác nhận xóa ${selectedIds.size} báo cáo đã chọn? Hành động này không thể hoàn tác.`
                    : 'Xác nhận xóa báo cáo này? Hành động này không thể hoàn tác.'
                }
                variant="danger"
                confirmText="Xóa"
                cancelText="Hủy"
                onConfirm={deleteReportId === '__BULK__' ? doBulkDelete : doDelete}
                onCancel={() => setDeleteReportId(null)}
                loading={processing}
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
.rv2-root { display:flex; flex-direction:column; gap:10px; height:100%; min-height:0; }

/* ── Toolbar ── */
.rv2-toolbar-wrap { position:relative; background:#fff; border-radius:14px; border:1px solid #e5e7eb; padding:12px 16px; }
.rv2-toolbar { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }

.rv2-refresh-bar { position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg,#a5b4fc,#6366f1,#a5b4fc); background-size:200% 100%; animation:rv2Shimmer 1.5s ease infinite; border-radius:14px 14px 0 0; }
@keyframes rv2Shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

/* Mode Toggle */
.rv2-mode-toggle { display:flex; background:#f1f5f9; border-radius:10px; padding:3px; gap:2px; }
.rv2-mode-btn { display:inline-flex; align-items:center; gap:5px; padding:7px 14px; border:none; background:transparent; border-radius:8px; font-size:12px; font-weight:600; color:#64748b; cursor:pointer; transition:all .2s; white-space:nowrap; }
.rv2-mode-btn:hover { color:#475569; }
.rv2-mode-btn.active { background:#fff; color:#4f46e5; box-shadow:0 1px 3px rgba(0,0,0,.08); }
.rv2-badge-count { min-width:18px; height:18px; padding:0 5px; display:inline-flex; align-items:center; justify-content:center; border-radius:9px; background:#ef4444; color:#fff; font-size:10px; font-weight:800; line-height:1; }

/* Search */
.rv2-search { position:relative; flex:1; min-width:180px; max-width:280px; }
.rv2-search-icon { position:absolute; left:10px; top:50%; transform:translateY(-50%); font-size:18px; color:#94a3b8; pointer-events:none; }
.rv2-search-input { width:100%; height:38px; padding:0 32px 0 34px; border:1.5px solid #e5e7eb; border-radius:10px; font-size:13px; background:#f8fafc; transition:all .2s; outline:none; }
.rv2-search-input:focus { border-color:#818cf8; box-shadow:0 0 0 3px rgba(129,140,248,.15); background:#fff; }
.rv2-search-input::placeholder { color:#94a3b8; }
.rv2-search-clear { position:absolute; right:8px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:#94a3b8; display:flex; padding:2px; border-radius:4px; }
.rv2-search-clear:hover { color:#64748b; background:#f1f5f9; }

/* Store Filter */
.rv2-store-filter { position:relative; min-width:140px; }
.rv2-select { width:100%; height:38px; padding:0 28px 0 12px; border:1.5px solid #e5e7eb; border-radius:10px; font-size:12px; font-weight:600; color:#475569; background:#f8fafc; appearance:none; cursor:pointer; outline:none; transition:all .2s; }
.rv2-select:focus { border-color:#818cf8; box-shadow:0 0 0 3px rgba(129,140,248,.15); }
.rv2-select-chevron { position:absolute; right:8px; top:50%; transform:translateY(-50%); font-size:18px; color:#94a3b8; pointer-events:none; }

/* Bulk delete */
.rv2-btn-bulk-delete { display:inline-flex; align-items:center; gap:5px; padding:7px 14px; border:1.5px solid #fca5a5; border-radius:10px; background:#fef2f2; color:#dc2626; font-size:12px; font-weight:700; cursor:pointer; transition:all .15s; white-space:nowrap; }
.rv2-btn-bulk-delete:hover { background:#fee2e2; border-color:#f87171; transform:translateY(-1px); }
.rv2-btn-bulk-delete:disabled { opacity:.5; cursor:not-allowed; }

/* ── Table Card ── */
.rv2-table-card { flex:1; display:flex; flex-direction:column; min-height:0; background:#fff; border-radius:14px; border:1px solid #e5e7eb; overflow:hidden; }
.rv2-table-scroll { flex:1; overflow:auto; }

.rv2-table { width:100%; border-collapse:collapse; font-size:13px; }
.rv2-th { padding:8px 10px; text-align:left; font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.04em; background:#f8fafc; border-bottom:1px solid #e5e7eb; position:sticky; top:0; z-index:2; white-space:nowrap; user-select:none; }
.rv2-th-sort { cursor:pointer; transition:color .15s; }
.rv2-th-sort:hover { color:#4f46e5; }
.rv2-th-num { text-align:center; }
.rv2-th-check { text-align:center; width:36px; }

.rv2-sort-icon { font-size:14px !important; vertical-align:middle; margin-left:2px; transition:all .2s; }

.rv2-td { padding:8px 10px; border-bottom:1px solid #f3f4f6; vertical-align:middle; }
.rv2-td-check { text-align:center; width:36px; }
.rv2-td-num { text-align:center; font-family:'Inter',monospace; font-weight:700; font-size:13px; }
.rv2-td-date { font-family:'Inter',monospace; font-size:12px; color:#475569; white-space:nowrap; }

.rv2-row { transition:background .12s; }
.rv2-row--clickable { cursor:pointer; }
.rv2-row:hover { background:#f8fafc; }
.rv2-row--pending { background:#fffbeb; }
.rv2-row--pending:hover { background:#fef3c7; }
.rv2-row--selected { background:#eef2ff !important; }
.rv2-row--expanded { background:#f8fafc; }
.rv2-row--expanded td { border-bottom:none; }
.rv2-row--detail { background:#f8fafc; }
.rv2-row--detail:hover { background:#f8fafc; }
.rv2-items-detail { padding:0 20px 16px; border-bottom:2px solid #e2e8f0; }

.rv2-checkbox { width:15px; height:15px; accent-color:#6366f1; cursor:pointer; }

/* Store cell */
.rv2-store-cell { display:flex; align-items:center; gap:6px; }
.rv2-store-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
.rv2-store-name { font-weight:700; color:#1e293b; white-space:nowrap; font-size:13px; }

/* Shift */
.rv2-shift-pill { display:inline-block; padding:2px 8px; border-radius:6px; background:#f1f5f9; font-size:11px; font-weight:700; color:#475569; }

/* Submitter */
.rv2-submitter-cell { display:flex; flex-direction:column; gap:1px; }
.rv2-submitter-name { font-weight:600; color:#334155; font-size:12px; }
.rv2-submitter-time { font-size:10px; color:#94a3b8; }

/* Numbers */
.rv2-num-match { color:#16a34a; }
.rv2-num-total { font-weight:400; color:#94a3b8; font-size:11px; }
.rv2-num-danger { color:#dc2626; }
.rv2-num-info { color:#4f46e5; }
.rv2-num-muted { color:#cbd5e1; }

/* Status cell — badge + inline actions */
.rv2-status-cell { display:flex; align-items:center; gap:6px; flex-wrap:nowrap; }
.rv2-status-badge { display:inline-flex; align-items:center; gap:3px; padding:3px 8px; border-radius:7px; font-size:11px; font-weight:700; white-space:nowrap; flex-shrink:0; }

/* Inline approve/reject buttons next to status */
.rv2-inline-actions { display:flex; gap:3px; }
.rv2-inline-btn { display:inline-flex; align-items:center; gap:2px; padding:3px 8px; border:none; border-radius:6px; font-size:10px; font-weight:700; cursor:pointer; transition:all .15s; white-space:nowrap; }
.rv2-inline-btn:disabled { opacity:.4; cursor:not-allowed; }
.rv2-inline-approve { background:#d1fae5; color:#059669; }
.rv2-inline-approve:hover:not(:disabled) { background:#a7f3d0; transform:translateY(-1px); }
.rv2-inline-reject { background:#fef2f2; color:#dc2626; }
.rv2-inline-reject:hover:not(:disabled) { background:#fecaca; transform:translateY(-1px); }

/* Hover-visible delete button */
.rv2-hover-delete { display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; border:none; border-radius:5px; background:transparent; color:#cbd5e1; cursor:pointer; transition:all .15s; opacity:0; }
.rv2-row:hover .rv2-hover-delete { opacity:1; }
.rv2-hover-delete:hover { background:#fef2f2; color:#dc2626; transform:translateY(-1px); }
.rv2-hover-delete:disabled { opacity:0; cursor:not-allowed; }

/* Footer */
.rv2-footer { padding:10px 16px; background:#f8fafc; border-top:1px solid #f1f5f9; font-size:12px; font-weight:500; color:#64748b; display:flex; justify-content:space-between; flex-shrink:0; }
.rv2-footer strong { color:#1e293b; font-weight:800; }

/* Empty */
.rv2-empty { display:flex; flex-direction:column; align-items:center; gap:10px; padding:80px 20px; }
.rv2-empty-icon { width:80px; height:80px; border-radius:50%; background:#f8fafc; display:flex; align-items:center; justify-content:center; }
.rv2-empty-title { font-size:15px; font-weight:700; color:#475569; margin:0; }
.rv2-empty-sub { font-size:13px; color:#94a3b8; margin:0; }

/* Skeleton */
.rv2-skel { background:#f1f5f9; border-radius:6px; animation:rv2Pulse 1.5s ease-in-out infinite; }
@keyframes rv2Pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
`;
