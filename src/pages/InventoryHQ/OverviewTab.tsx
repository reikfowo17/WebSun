import React, { useState, useEffect } from 'react';
import { InventoryService } from '../../services';
import { STORES } from '../../constants';

interface OverviewTabProps {
    date: string;
    toast: any;
    onNavigateToReviews: (storeCode: string) => void;
}

const OverviewTab: React.FC<OverviewTabProps> = ({ date, toast, onNavigateToReviews }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState<any>(null);
    const [stores, setStores] = useState<any[]>([]);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

    useEffect(() => {
        loadOverview();
        const interval = setInterval(() => { loadOverview(); setLastUpdate(new Date()); }, 10000);
        return () => clearInterval(interval);
    }, [date]);

    const loadOverview = async (isRetry = false) => {
        if (!isRetry) { setLoading(true); setError(null); }
        try {
            const res = await InventoryService.getOverview(date);
            if (res.success) { setStats(res.stats); setStores(res.stores || []); setError(null); }
            else throw new Error('Failed to load data');
        } catch (err: any) {
            const msg = err.message || 'Không thể tải dữ liệu tổng quan';
            setError(msg);
            if (!isRetry) toast.error(msg);
        } finally { setLoading(false); }
    };

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
                    <div className="ov-summary">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="ov-stat-card">
                                <div style={{ width: 38, height: 38, borderRadius: 10, background: '#f1f5f9' }} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ height: 10, width: 50, background: '#f1f5f9', borderRadius: 4, marginBottom: 6 }} />
                                    <div style={{ height: 22, width: 40, background: '#e2e8f0', borderRadius: 6 }} />
                                </div>
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

    return (
        <>
            <style>{CSS_TEXT}</style>
            <div className="ov-root">

                {/* ── Summary Strip ── */}
                <div className="ov-summary">
                    <StatCard icon="store" iconBg="#eef2ff" iconColor="#6366f1" label="Tổng cửa hàng" value={stats?.totalStores || 0} />
                    <StatCard icon="check_circle" iconBg="#d1fae5" iconColor="#10b981" label="Hoàn tất" value={`${stats?.completedStores || 0}/${stats?.totalStores || 0}`} />
                    <StatCard icon="pending" iconBg="#dbeafe" iconColor="#3b82f6" label="Đang kiểm" value={stats?.inProgressStores || 0} />
                    <StatCard icon="warning" iconBg="#fef2f2" iconColor="#ef4444" label="Vấn đề" value={stats?.issuesCount || 0} accent={stats?.issuesCount > 0 ? '#ef4444' : undefined} />
                </div>

                {/* ── Last Update ── */}
                <div className="ov-update-bar">
                    <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#94a3b8' }}>schedule</span>
                    <span>Cập nhật: {lastUpdate.toLocaleTimeString('vi-VN')}</span>
                    <button className="ov-refresh-btn" onClick={() => { loadOverview(); setLastUpdate(new Date()); }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span>
                    </button>
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

                            return (
                                <div
                                    key={store.id}
                                    className={`ov-store-card ${store.reportStatus === 'PENDING' ? 'clickable' : ''}`}
                                    onClick={() => { if (store.reportStatus === 'PENDING') onNavigateToReviews(store.code); }}
                                >
                                    {/* Status Bar */}
                                    <div className="ov-status-bar" style={{ background: sc.bg }} />

                                    {/* Header */}
                                    <div className="ov-store-hdr">
                                        <div>
                                            <h3 className="ov-store-name">{info?.name || store.name}</h3>
                                            <p className="ov-store-meta">Ca {store.shift} • {store.employee?.name || '--'}</p>
                                        </div>
                                        <span className="ov-badge" style={{ background: sc.bg + '18', color: sc.bg, borderColor: sc.bg + '30' }}>
                                            {getStatusLabel(store.reportStatus, store.progress.percentage)}
                                        </span>
                                    </div>

                                    {/* Progress */}
                                    <div className="ov-store-body">
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
                                            <div className="ov-mini-stat" style={{ background: '#fef2f2' }}>
                                                <span className="ov-mini-label">Thiếu</span>
                                                <span className="ov-mini-val" style={{ color: '#dc2626' }}>{store.progress.missing}</span>
                                            </div>
                                            <div className="ov-mini-stat" style={{ background: '#eef2ff' }}>
                                                <span className="ov-mini-label">Thừa</span>
                                                <span className="ov-mini-val" style={{ color: '#4f46e5' }}>{store.progress.over}</span>
                                            </div>
                                        </div>

                                        {/* Footer */}
                                        <div className="ov-store-footer">
                                            <div className="ov-store-time">
                                                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>update</span>
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
const StatCard: React.FC<{ icon: string; iconBg: string; iconColor: string; label: string; value: any; accent?: string }> = ({ icon, iconBg, iconColor, label, value, accent }) => (
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
.ov-root { display:flex; flex-direction:column; gap:16px; padding-top:20px; }

/* Summary */
.ov-summary { display:flex; gap:12px; flex-wrap:wrap; }
.ov-stat-card { display:flex; align-items:center; gap:12px; padding:14px 20px; background:#fff; border-radius:14px; border:1px solid #e5e7eb; flex:1; min-width:150px; transition:box-shadow .25s,border-color .25s; }
.ov-stat-card:hover { box-shadow:0 4px 16px -4px rgba(0,0,0,.07); border-color:#c7d2fe; }
.ov-stat-icon { width:38px; height:38px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.ov-stat-label { font-size:11px; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:.04em; }
.ov-stat-val { font-size:22px; font-weight:800; color:#1e293b; line-height:1.2; }

/* Update bar */
.ov-update-bar { display:flex; align-items:center; gap:6px; font-size:11px; color:#94a3b8; font-weight:500; justify-content:flex-end; }
.ov-refresh-btn { width:24px; height:24px; border-radius:6px; display:flex; align-items:center; justify-content:center; background:transparent; border:none; cursor:pointer; color:#94a3b8; transition:all .15s; }
.ov-refresh-btn:hover { background:#eef2ff; color:#6366f1; }

/* Grid */
.ov-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:16px; }

/* Store Card */
.ov-store-card { background:#fff; border-radius:16px; border:1px solid #e5e7eb; overflow:hidden; transition:box-shadow .3s,transform .2s; }
.ov-store-card:hover { box-shadow:0 8px 30px -8px rgba(0,0,0,.1); }
.ov-store-card.clickable { cursor:pointer; }
.ov-store-card.clickable:hover { transform:translateY(-2px); }
.ov-status-bar { height:4px; width:100%; }
.ov-store-hdr { display:flex; align-items:flex-start; justify-content:space-between; padding:16px 20px 12px; }
.ov-store-name { font-size:16px; font-weight:800; color:#1e293b; margin:0; }
.ov-store-meta { font-size:11px; color:#94a3b8; font-weight:500; margin-top:3px; }
.ov-badge { display:inline-flex; padding:3px 10px; border-radius:8px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; border:1px solid; }

/* Body */
.ov-store-body { padding:0 20px 16px; }
.ov-progress-hdr { display:flex; justify-content:space-between; margin-bottom:6px; }
.ov-progress-label { font-size:11px; color:#94a3b8; font-weight:600; }
.ov-progress-pct { font-size:12px; font-weight:800; color:#1e293b; }
.ov-progress-track { height:6px; background:#f1f5f9; border-radius:99px; overflow:hidden; }
.ov-progress-fill { height:100%; border-radius:99px; transition:width 1s ease-out; }
.ov-progress-sub { display:flex; justify-content:space-between; margin-top:4px; font-size:10px; color:#94a3b8; }
.ov-progress-issue { color:#ef4444; font-weight:700; }

/* Mini Stats */
.ov-mini-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-top:14px; }
.ov-mini-stat { border-radius:10px; padding:8px; text-align:center; }
.ov-mini-label { display:block; font-size:10px; color:#94a3b8; font-weight:600; margin-bottom:2px; }
.ov-mini-val { font-size:18px; font-weight:800; line-height:1.2; }

/* Store Footer */
.ov-store-footer { display:flex; align-items:center; justify-content:space-between; margin-top:12px; padding-top:12px; border-top:1px solid #f1f5f9; }
.ov-store-time { display:flex; align-items:center; gap:4px; font-size:11px; color:#94a3b8; }
.ov-view-report { display:inline-flex; align-items:center; gap:4px; padding:6px 14px; background:linear-gradient(135deg,#f59e0b,#d97706); color:#fff; border:none; border-radius:8px; font-size:11px; font-weight:700; cursor:pointer; transition:transform .15s,box-shadow .2s; }
.ov-view-report:hover { transform:translateY(-1px); box-shadow:0 4px 12px -2px rgba(245,158,11,.35); }

/* Empty */
.ov-empty { display:flex; flex-direction:column; align-items:center; gap:10px; padding:80px 20px; background:#fff; border-radius:16px; border:1px solid #e5e7eb; }
.ov-empty-icon { width:80px; height:80px; border-radius:50%; background:#f8fafc; display:flex; align-items:center; justify-content:center; }
.ov-empty-title { font-size:15px; font-weight:700; color:#64748b; margin:0; }
.ov-empty-sub { font-size:12px; color:#94a3b8; margin:0; }

/* Error */
.ov-error { display:flex; flex-direction:column; align-items:center; gap:12px; padding:80px 20px; }
.ov-error-icon { width:72px; height:72px; border-radius:50%; background:#fef2f2; display:flex; align-items:center; justify-content:center; }
.ov-error-title { font-size:16px; font-weight:800; color:#1e293b; margin:0; }
.ov-error-sub { font-size:13px; color:#94a3b8; margin:0; }
.ov-error-btn { display:inline-flex; align-items:center; gap:6px; padding:10px 20px; background:linear-gradient(135deg,#6366f1,#4338ca); color:#fff; border:none; border-radius:12px; font-weight:700; font-size:13px; cursor:pointer; box-shadow:0 4px 14px -3px rgba(99,102,241,.4); transition:transform .15s; margin-top:4px; }
.ov-error-btn:hover { transform:translateY(-1px); }
`;
