import React, { useState, useEffect, useCallback, useRef } from 'react';
import { InventoryService } from '../../services';
import { STORES } from '../../constants';

interface ToastFn {
    success: (msg: string) => void;
    error: (msg: string) => void;
    info: (msg: string) => void;
    warning: (msg: string) => void;
}

interface OverviewStats {
    totalStores: number;
    completedStores: number;
    inProgressStores: number;
    pendingStores: number;
    issuesCount: number;
}

interface StoreOverview {
    id: string;
    code: string;
    name: string;
    color: string;
    shift: number;
    employee: { id: string; name: string } | null;
    progress: {
        total: number;
        checked: number;
        matched: number;
        missing: number;
        over: number;
        percentage: number;
    };
    reportStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
    lastUpdate: string | null;
}

interface OverviewTabProps {
    date: string;
    toast: ToastFn;
    onNavigateToReviews: (storeCode?: string) => void;
}

const POLL_INTERVAL_MS = 10_000;

const OverviewTab: React.FC<OverviewTabProps> = ({ date, toast, onNavigateToReviews }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState<OverviewStats | null>(null);
    const [stores, setStores] = useState<StoreOverview[]>([]);
    // useRef to avoid full re-render just for time text
    const [lastUpdateText, setLastUpdateText] = useState(() => new Date().toLocaleTimeString('vi-VN'));
    const isMountedRef = useRef(true);

    const loadOverview = useCallback(async (isRetry = false) => {
        if (!isRetry) { setLoading(true); setError(null); }
        try {
            const res = await InventoryService.getOverview(date);
            if (!isMountedRef.current) return;
            if (res.success) {
                setStats(res.stats as OverviewStats);
                setStores((res.stores || []) as StoreOverview[]);
                setError(null);
            } else {
                throw new Error('Failed to load data');
            }
        } catch (err: unknown) {
            if (!isMountedRef.current) return;
            const msg = err instanceof Error ? err.message : 'Không thể tải dữ liệu tổng quan';
            setError(msg);
            if (!isRetry) toast.error(msg);
        } finally {
            if (isMountedRef.current) setLoading(false);
        }
    }, [date, toast]);

    // CRITICAL FIX #1: Polling with Page Visibility API
    useEffect(() => {
        isMountedRef.current = true;
        loadOverview();

        let interval = setInterval(() => {
            loadOverview();
            setLastUpdateText(new Date().toLocaleTimeString('vi-VN'));
        }, POLL_INTERVAL_MS);

        const handleVisibility = () => {
            if (document.hidden) {
                clearInterval(interval);
            } else {
                loadOverview();
                setLastUpdateText(new Date().toLocaleTimeString('vi-VN'));
                interval = setInterval(() => {
                    loadOverview();
                    setLastUpdateText(new Date().toLocaleTimeString('vi-VN'));
                }, POLL_INTERVAL_MS);
            }
        };

        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            isMountedRef.current = false;
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [loadOverview]);

    const getStatusColor = (rs: string | null, pct: number) => {
        if (rs === 'APPROVED') return { bg: '#10b981', glow: 'rgba(16,185,129,.25)' };
        if (rs === 'REJECTED') return { bg: '#ef4444', glow: 'rgba(239,68,68,.25)' };
        if (rs === 'PENDING') return { bg: '#f59e0b', glow: 'rgba(245,158,11,.25)' };
        if (pct > 0) return { bg: '#6366f1', glow: 'rgba(99,102,241,.25)' };
        return { bg: '#cbd5e1', glow: 'rgba(0,0,0,.05)' };
    };

    const getStatusLabel = (rs: string | null, pct: number) => {
        if (rs === 'APPROVED') return 'Đã duyệt';
        if (rs === 'REJECTED') return 'Từ chối';
        if (rs === 'PENDING') return 'Chờ duyệt';
        if (pct > 0) return 'Đang kiểm';
        return 'Chưa bắt đầu';
    };

    const getRelativeTime = (d: string | null) => {
        if (!d) return 'Chưa cập nhật';
        const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
        if (mins < 1) return 'Vừa xong';
        if (mins < 60) return `${mins} phút trước`;
        return `${Math.floor(mins / 60)} giờ trước`;
    };

    /* ── Loading State ── */
    if (loading && !stats) {
        return (
            <>
                <style>{CSS_TEXT}</style>
                <div className="ov-root">
                    {/* Skeleton summary strip */}
                    <div className="ov-summary-strip">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="ov-summary-item">
                                <div style={{ height: 10, width: 50, background: '#e2e8f0', borderRadius: 4, marginBottom: 4 }} />
                                <div style={{ height: 20, width: 30, background: '#f1f5f9', borderRadius: 4 }} />
                            </div>
                        ))}
                    </div>
                    <div className="ov-grid">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="ov-store-card" style={{ overflow: 'hidden' }}>
                                <div style={{ height: 4, background: '#f1f5f9' }} />
                                <div style={{ padding: 20 }}>
                                    <div style={{ height: 18, width: 120, background: '#f1f5f9', borderRadius: 6, marginBottom: 10 }} />
                                    <div style={{ height: 12, width: 80, background: '#f8fafc', borderRadius: 4, marginBottom: 16 }} />
                                    <div style={{ height: 6, background: '#f1f5f9', borderRadius: 99, marginBottom: 16 }} />
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        {[1, 2, 3].map(j => <div key={j} style={{ flex: 1, height: 54, background: '#f8fafc', borderRadius: 10 }} />)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </>
        );
    }

    /* ── Error State ── */
    if (error && !loading) {
        return (
            <>
                <style>{CSS_TEXT}</style>
                <div className="ov-error">
                    <div className="ov-error-icon">
                        <span className="material-symbols-outlined" style={{ fontSize: 40, color: '#f87171' }}>error</span>
                    </div>
                    <h3 className="ov-error-title">Không thể tải dữ liệu</h3>
                    <p className="ov-error-sub">{error}</p>
                    <button className="ov-error-btn" onClick={() => loadOverview(true)}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
                        Thử lại
                    </button>
                </div>
            </>
        );
    }

    /* ── Derived summary ── */
    const summary = {
        total: stores.length,
        completed: stores.filter(s => s.reportStatus === 'APPROVED').length,
        inProgress: stores.filter(s => s.progress.percentage > 0 && !s.reportStatus).length,
        pending: stores.filter(s => s.reportStatus === 'PENDING').length,
        issues: stores.filter(s => s.progress.missing > 0 || s.progress.over > 0).length,
    };

    const getStatusIcon = (rs: string | null, pct: number) => {
        if (rs === 'APPROVED') return 'check_circle';
        if (rs === 'REJECTED') return 'cancel';
        if (rs === 'PENDING') return 'hourglass_top';
        if (pct > 0) return 'sync';
        return 'radio_button_unchecked';
    };

    return (
        <>
            <style>{CSS_TEXT}</style>
            <div className="ov-root">

                {/* ── Compact Summary Strip ── */}
                <div className="ov-summary-strip">
                    <div className="ov-summary-item">
                        <span className="ov-summary-label">Cửa hàng</span>
                        <span className="ov-summary-value">{summary.total}</span>
                    </div>
                    <div className="ov-summary-divider" />
                    <div className="ov-summary-item">
                        <span className="ov-summary-dot" style={{ background: '#10b981' }} />
                        <span className="ov-summary-label">Hoàn tất</span>
                        <span className="ov-summary-value" style={{ color: '#10b981' }}>{summary.completed}</span>
                    </div>
                    <div className="ov-summary-divider" />
                    <div className="ov-summary-item">
                        <span className="ov-summary-dot" style={{ background: '#f59e0b' }} />
                        <span className="ov-summary-label">Chờ duyệt</span>
                        <span className="ov-summary-value" style={{ color: '#f59e0b' }}>{summary.pending}</span>
                    </div>
                    <div className="ov-summary-divider" />
                    <div className="ov-summary-item">
                        <span className="ov-summary-dot" style={{ background: '#6366f1' }} />
                        <span className="ov-summary-label">Đang kiểm</span>
                        <span className="ov-summary-value" style={{ color: '#6366f1' }}>{summary.inProgress}</span>
                    </div>
                    {summary.issues > 0 && (
                        <>
                            <div className="ov-summary-divider" />
                            <div className="ov-summary-item">
                                <span className="ov-summary-dot ov-pulse" style={{ background: '#ef4444' }} />
                                <span className="ov-summary-label">Lệch</span>
                                <span className="ov-summary-value" style={{ color: '#ef4444' }}>{summary.issues}</span>
                            </div>
                        </>
                    )}

                    {/* Live indicator + refresh */}
                    <div className="ov-summary-spacer" />
                    <div className="ov-live-indicator">
                        <span className="ov-live-dot" />
                        <span className="ov-live-text">{lastUpdateText}</span>
                        <button
                            className="ov-refresh-btn"
                            aria-label="Làm mới dữ liệu"
                            onClick={() => { loadOverview(); setLastUpdateText(new Date().toLocaleTimeString('vi-VN')); }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
                        </button>
                    </div>
                </div>

                {/* ── Store Grid ── */}
                {stores.length === 0 ? (
                    <div className="ov-empty">
                        <div className="ov-empty-icon">
                            <span className="material-symbols-outlined" style={{ fontSize: 40, color: '#cbd5e1' }}>store_mall_directory</span>
                        </div>
                        <p className="ov-empty-title">Chưa có dữ liệu kiểm kê</p>
                        <p className="ov-empty-sub">Dữ liệu sẽ xuất hiện khi cửa hàng bắt đầu kiểm tồn</p>
                    </div>
                ) : (
                    <div className="ov-grid">
                        {stores.map(store => {
                            const info = STORES.find(s => s.code === store.code);
                            const hasIssues = store.progress.missing > 0 || store.progress.over > 0;
                            const sc = getStatusColor(store.reportStatus, store.progress.percentage);
                            const statusIcon = getStatusIcon(store.reportStatus, store.progress.percentage);

                            return (
                                <div
                                    key={store.id}
                                    className={`ov-store-card ${store.reportStatus === 'PENDING' ? 'clickable ov-card--pending' : ''}`}
                                    onClick={() => { if (store.reportStatus === 'PENDING') onNavigateToReviews(store.code); }}
                                    role={store.reportStatus === 'PENDING' ? 'button' : undefined}
                                    tabIndex={store.reportStatus === 'PENDING' ? 0 : undefined}
                                    onKeyDown={store.reportStatus === 'PENDING' ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigateToReviews(store.code); } } : undefined}
                                    aria-label={store.reportStatus === 'PENDING' ? `Xem báo cáo ${info?.name || store.name}` : undefined}
                                >
                                    {/* Status Bar */}
                                    <div className="ov-status-bar" style={{ background: sc.bg }} />

                                    {/* Header */}
                                    <div className="ov-store-hdr">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div className="ov-store-icon" style={{ background: sc.bg + '14', color: sc.bg }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{statusIcon}</span>
                                            </div>
                                            <div>
                                                <h3 className="ov-store-name">{info?.name || store.name}</h3>
                                                <p className="ov-store-meta">Ca {store.shift} • {store.employee?.name || '--'}</p>
                                            </div>
                                        </div>
                                        <span className="ov-badge" style={{ background: sc.bg + '18', color: sc.bg, borderColor: sc.bg + '30' }}>
                                            {getStatusLabel(store.reportStatus, store.progress.percentage)}
                                        </span>
                                    </div>

                                    {/* Body */}
                                    <div className="ov-store-body">
                                        {store.progress.percentage === 0 && !store.reportStatus ? (
                                            /* Compact "not started" state */
                                            <div className="ov-not-started">
                                                <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#94a3b8' }}>hourglass_empty</span>
                                                <span>Chưa bắt đầu kiểm kê</span>
                                            </div>
                                        ) : (
                                            <>
                                                {/* Progress */}
                                                <div className="ov-progress-hdr">
                                                    <span className="ov-progress-label">Tiến độ</span>
                                                    <span className="ov-progress-pct">{store.progress.percentage}%</span>
                                                </div>
                                                <div className="ov-progress-track">
                                                    <div
                                                        className="ov-progress-fill"
                                                        style={{
                                                            width: `${store.progress.percentage}%`,
                                                            background: hasIssues
                                                                ? 'linear-gradient(90deg,#ef4444,#f97316)'
                                                                : `linear-gradient(90deg,${sc.bg},${sc.bg}cc)`,
                                                            boxShadow: `0 0 10px ${sc.glow}`
                                                        }}
                                                    />
                                                </div>
                                                <div className="ov-progress-sub">
                                                    <span>{store.progress.checked} / {store.progress.total} SP</span>
                                                    {hasIssues && <span className="ov-progress-issue">Lệch: {store.progress.missing + store.progress.over}</span>}
                                                </div>

                                                {/* Stats Row */}
                                                <div className="ov-mini-stats">
                                                    <div className="ov-mini-stat" style={{ background: '#f0fdf4' }}>
                                                        <span className="ov-mini-label">Khớp</span>
                                                        <span className="ov-mini-val" style={{ color: '#16a34a' }}>{store.progress.matched}</span>
                                                    </div>
                                                    <div className="ov-mini-stat" style={{ background: store.progress.missing > 0 ? '#fef2f2' : '#f8fafc' }}>
                                                        <span className="ov-mini-label">Thiếu</span>
                                                        <span className="ov-mini-val" style={{ color: store.progress.missing > 0 ? '#dc2626' : '#94a3b8' }}>{store.progress.missing}</span>
                                                    </div>
                                                    <div className="ov-mini-stat" style={{ background: store.progress.over > 0 ? '#eef2ff' : '#f8fafc' }}>
                                                        <span className="ov-mini-label">Thừa</span>
                                                        <span className="ov-mini-val" style={{ color: store.progress.over > 0 ? '#4f46e5' : '#94a3b8' }}>{store.progress.over}</span>
                                                    </div>
                                                </div>
                                            </>
                                        )}

                                        {/* Footer */}
                                        <div className="ov-store-footer">
                                            <div className="ov-store-time">
                                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>update</span>
                                                {getRelativeTime(store.lastUpdate)}
                                            </div>
                                            {store.reportStatus === 'PENDING' && (
                                                <button className="ov-view-report" onClick={() => onNavigateToReviews(store.code)}>
                                                    Xem báo cáo
                                                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_forward</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </>
    );
};

/* ── Stat Card ── */
const StatCard: React.FC<{ icon: string; iconBg: string; iconColor: string; label: string; value: string | number; accent?: string }> = ({ icon, iconBg, iconColor, label, value, accent }) => (
    <div className="ov-stat-card">
        <div className="ov-stat-icon" style={{ background: iconBg }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: iconColor }}>{icon}</span>
        </div>
        <div>
            <div className="ov-stat-label">{label}</div>
            <div className="ov-stat-val" style={accent ? { color: accent } : {}}>{value}</div>
        </div>
    </div>
);

export default OverviewTab;

/* ══════ CSS ══════ */
const CSS_TEXT = `
.ov-root { display:flex; flex-direction:column; gap:16px; padding-top:16px; }

/* ── Summary Strip ── */
.ov-summary-strip { display:flex; align-items:center; gap:4px; background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:10px 16px; flex-wrap:wrap; }
.ov-summary-item { display:flex; align-items:center; gap:6px; padding:0 8px; }
.ov-summary-label { font-size:12px; font-weight:600; color:#64748b; white-space:nowrap; }
.ov-summary-value { font-size:18px; font-weight:800; color:#1e293b; line-height:1; }
.ov-summary-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.ov-summary-divider { width:1px; height:24px; background:#e5e7eb; margin:0 4px; flex-shrink:0; }
.ov-summary-spacer { flex:1; min-width:16px; }

/* Live indicator */
.ov-live-indicator { display:flex; align-items:center; gap:6px; }
.ov-live-dot { width:8px; height:8px; border-radius:50%; background:#10b981; animation:ov-pulse-live 2s ease-in-out infinite; flex-shrink:0; }
@keyframes ov-pulse-live { 0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(16,185,129,.4)} 50%{opacity:.7;box-shadow:0 0 0 4px rgba(16,185,129,0)} }
.ov-live-text { font-size:12px; color:#64748b; font-weight:500; white-space:nowrap; }
.ov-refresh-btn { width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; background:transparent; border:none; cursor:pointer; color:#64748b; transition:all .2s; flex-shrink:0; }
.ov-refresh-btn:hover { background:#eef2ff; color:#6366f1; }
.ov-refresh-btn:focus-visible { outline:2px solid #6366f1; outline-offset:2px; }

/* Pulse for issues dot */
.ov-pulse { animation:ov-pulse-alert 1.5s ease-in-out infinite; }
@keyframes ov-pulse-alert { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(1.3)} }

/* Grid */
.ov-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:16px; }

/* Store Card */
.ov-store-card { background:#fff; border-radius:16px; border:1px solid #e5e7eb; overflow:hidden; transition:box-shadow .3s,transform .2s; }
.ov-store-card:hover { box-shadow:0 8px 30px -8px rgba(0,0,0,.1); }
.ov-store-card.clickable { cursor:pointer; }
.ov-store-card.clickable:hover { transform:translateY(-2px); }
.ov-store-card.clickable:focus-visible { outline:2px solid #6366f1; outline-offset:2px; }
.ov-card--pending { border-left:3px solid #f59e0b; }
.ov-status-bar { height:4px; width:100%; }
.ov-store-hdr { display:flex; align-items:flex-start; justify-content:space-between; padding:16px 20px 12px; }
.ov-store-icon { width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.ov-store-name { font-size:16px; font-weight:800; color:#1e293b; margin:0; }
.ov-store-meta { font-size:13px; color:#64748b; font-weight:500; margin-top:2px; }
.ov-badge { display:inline-flex; padding:4px 12px; border-radius:8px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; border:1px solid; white-space:nowrap; height:fit-content; }

/* Body */
.ov-store-body { padding:0 20px 16px; }
.ov-progress-hdr { display:flex; justify-content:space-between; margin-bottom:6px; }
.ov-progress-label { font-size:13px; color:#64748b; font-weight:600; }
.ov-progress-pct { font-size:13px; font-weight:800; color:#1e293b; }
.ov-progress-track { height:6px; background:#f1f5f9; border-radius:99px; overflow:hidden; }
.ov-progress-fill { height:100%; border-radius:99px; transition:width 1s ease-out; }
.ov-progress-sub { display:flex; justify-content:space-between; margin-top:4px; font-size:12px; color:#64748b; }
.ov-progress-issue { color:#ef4444; font-weight:700; }

/* Mini Stats */
.ov-mini-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-top:14px; }
.ov-mini-stat { border-radius:10px; padding:10px 8px; text-align:center; }
.ov-mini-label { display:block; font-size:12px; color:#64748b; font-weight:600; margin-bottom:2px; }
.ov-mini-val { font-size:18px; font-weight:800; line-height:1.2; }

/* Not Started compact state */
.ov-not-started { display:flex; align-items:center; gap:8px; padding:16px; background:#f8fafc; border-radius:10px; font-size:13px; color:#94a3b8; font-weight:600; }

/* Store Footer */
.ov-store-footer { display:flex; align-items:center; justify-content:space-between; margin-top:12px; padding-top:12px; border-top:1px solid #f1f5f9; }
.ov-store-time { display:flex; align-items:center; gap:4px; font-size:13px; color:#64748b; }
.ov-view-report { display:inline-flex; align-items:center; gap:6px; padding:10px 18px; background:linear-gradient(135deg,#f59e0b,#d97706); color:#fff; border:none; border-radius:10px; font-size:13px; font-weight:700; cursor:pointer; transition:transform .15s,box-shadow .2s; }
.ov-view-report:hover { transform:translateY(-1px); box-shadow:0 4px 12px -2px rgba(245,158,11,.35); }
.ov-view-report:focus-visible { outline:2px solid #d97706; outline-offset:2px; }

/* Empty */
.ov-empty { display:flex; flex-direction:column; align-items:center; gap:12px; padding:80px 20px; background:#fff; border-radius:16px; border:1px solid #e5e7eb; }
.ov-empty-icon { width:80px; height:80px; border-radius:50%; background:#f8fafc; display:flex; align-items:center; justify-content:center; }
.ov-empty-title { font-size:16px; font-weight:700; color:#475569; margin:0; }
.ov-empty-sub { font-size:13px; color:#64748b; margin:0; }

/* Error */
.ov-error { display:flex; flex-direction:column; align-items:center; gap:12px; padding:80px 20px; }
.ov-error-icon { width:72px; height:72px; border-radius:50%; background:#fef2f2; display:flex; align-items:center; justify-content:center; }
.ov-error-title { font-size:16px; font-weight:800; color:#1e293b; margin:0; }
.ov-error-sub { font-size:13px; color:#64748b; margin:0; }
.ov-error-btn { display:inline-flex; align-items:center; gap:6px; padding:12px 24px; background:linear-gradient(135deg,#6366f1,#4338ca); color:#fff; border:none; border-radius:12px; font-weight:700; font-size:14px; cursor:pointer; box-shadow:0 4px 14px -3px rgba(99,102,241,.4); transition:transform .15s; margin-top:4px; }
.ov-error-btn:hover { transform:translateY(-1px); }
.ov-error-btn:focus-visible { outline:2px solid #4338ca; outline-offset:2px; }
`;
