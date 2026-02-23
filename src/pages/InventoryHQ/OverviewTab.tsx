import React, { useState, useEffect, useCallback, useRef } from 'react';
import { InventoryService } from '../../services';
import { SystemService, StoreConfig } from '../../services/system';
import ItemsDetailPanel from './components/ItemsDetailPanel';
import '../../styles/hq-sidebar.css';

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

const OverviewTab: React.FC<OverviewTabProps> = ({ date, toast }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState<OverviewStats | null>(null);
    const [stores, setStores] = useState<StoreOverview[]>([]);
    const [lastUpdateText, setLastUpdateText] = useState(() => new Date().toLocaleTimeString('vi-VN'));
    const isMountedRef = useRef(true);
    const [selectedStore, setSelectedStore] = useState<StoreOverview | null>(null);
    const [sysStores, setSysStores] = useState<StoreConfig[]>([]);

    useEffect(() => {
        SystemService.getStores().then(setSysStores);
    }, []);

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

    const getShiftStatusColor = (rs: string | null, pct: number) => {
        if (rs || pct === 100) return { bg: '#10b981', glow: 'rgba(16,185,129,.25)' }; // Hoàn tất
        if (pct > 0) return { bg: '#6366f1', glow: 'rgba(99,102,241,.25)' }; // Đang kiểm
        return { bg: '#94a3b8', glow: 'rgba(0,0,0,.05)' }; // Chưa bắt đầu
    };

    const getShiftStatusLabel = (rs: string | null, pct: number) => {
        if (rs || pct === 100) return 'Hoàn tất';
        if (pct > 0) return 'Đang kiểm';
        return 'Chưa bắt đầu';
    };

    const summary = {
        totalStores: sysStores.length,
        completedShifts: stores.filter(s => s.reportStatus || s.progress.percentage === 100).length,
        inProgressShifts: stores.filter(s => s.progress.percentage > 0 && s.progress.percentage < 100 && !s.reportStatus).length,
        issues: stores.filter(s => s.progress.missing > 0 || s.progress.over > 0).length,
    };

    if (loading && stores.length === 0) {
        return (
            <>
                <style>{CSS_TEXT}</style>
                <div className="ov-root hq-skeleton">
                    {/* Summary strip skeleton */}
                    <div className="hq-sk-wrap" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px' }}>
                        {[1, 2, 3].map(i => (
                            <React.Fragment key={i}>
                                {i > 1 && <div style={{ width: 1, height: 32, background: '#f1f5f9', flexShrink: 0 }} />}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div className="hq-sk-circle" style={{ width: 10, height: 10, borderRadius: '50%' }} />
                                    <div className="hq-sk-line" style={{ width: 60, height: 12 }} />
                                    <div className="hq-sk-line" style={{ width: 24, height: 20 }} />
                                </div>
                            </React.Fragment>
                        ))}
                        <div style={{ flex: 1 }} />
                        <div className="hq-sk-pill" style={{ width: 100 }} />
                    </div>

                    {/* Store cards skeleton */}
                    <div className="ov-grid">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="hq-sk-wrap">
                                {/* Card header */}
                                <div style={{ padding: '20px 24px 16px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: '1px solid #f1f5f9' }}>
                                    <div className="hq-sk-circle" style={{ width: 42, height: 42, borderRadius: 12 }} />
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                                        <div className="hq-sk-line" style={{ width: `${70 - i * 10}%`, height: 16 }} />
                                        <div className="hq-sk-line" style={{ width: 80, height: 10 }} />
                                    </div>
                                </div>
                                {/* Shift rows */}
                                <div style={{ padding: 12, display: 'flex', flexDirection: 'column' as const, gap: 8, background: '#f8fafc' }}>
                                    {[1, 2, 3].map(s => (
                                        <div key={s} className="hq-sk-row" style={{ borderRadius: 12, background: '#fff', border: 'none' }}>
                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, gap: 5 }}>
                                                <div className="hq-sk-line" style={{ width: `${90 - s * 15}%`, height: 14 }} />
                                                <div className="hq-sk-line" style={{ width: `${50 + s * 5}%`, height: 10 }} />
                                            </div>
                                            <div className="hq-sk-pill" style={{ width: 72 }} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </>
        );
    }

    if (error && stores.length === 0) {
        return (
            <div className="ov-error">
                <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#ef4444' }}>error</span>
                <h3>Đã có lỗi xảy ra</h3>
                <p>{error}</p>
                <button onClick={() => loadOverview()} className="ov-retry-btn">Thử lại</button>
            </div>
        );
    }

    return (
        <>
            <style>{CSS_TEXT}</style>
            <div className="ov-root">
                {/* ── Compact Summary Strip ── */}
                <div className="ov-summary-strip">
                    <div className="ov-summary-item">
                        <span className="ov-summary-label">Cửa hàng</span>
                        <span className="ov-summary-value">{summary.totalStores}</span>
                    </div>
                    <div className="ov-summary-divider" />
                    <div className="ov-summary-item">
                        <span className="ov-summary-dot" style={{ background: '#10b981' }} />
                        <span className="ov-summary-label">Hoàn tất (Ca)</span>
                        <span className="ov-summary-value" style={{ color: '#10b981' }}>{summary.completedShifts}</span>
                    </div>
                    <div className="ov-summary-divider" />
                    <div className="ov-summary-item">
                        <span className="ov-summary-dot" style={{ background: '#6366f1' }} />
                        <span className="ov-summary-label">Đang kiểm (Ca)</span>
                        <span className="ov-summary-value" style={{ color: '#6366f1' }}>{summary.inProgressShifts}</span>
                    </div>
                    {summary.issues > 0 && (
                        <>
                            <div className="ov-summary-divider" />
                            <div className="ov-summary-item">
                                <span className="ov-summary-dot ov-pulse" style={{ background: '#ef4444' }} />
                                <span className="ov-summary-label">Có lệch (Ca)</span>
                                <span className="ov-summary-value" style={{ color: '#ef4444' }}>{summary.issues}</span>
                            </div>
                        </>
                    )}

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

                {/* ── Grouped Store Grid ── */}
                {sysStores.length === 0 ? (
                    <div className="ov-empty">
                        <div className="ov-empty-icon">
                            <span className="material-symbols-outlined" style={{ fontSize: 40, color: '#cbd5e1' }}>store_mall_directory</span>
                        </div>
                        <p className="ov-empty-title">Chưa có cửa hàng</p>
                    </div>
                ) : (
                    <div className="ov-grid">
                        {sysStores.map(sysStore => {
                            return (
                                <div key={sysStore.id} className="ov-store-card">
                                    <div className="ov-store-hdr">
                                        <div className="ov-store-hdr-main">
                                            <div className="ov-store-hdr-icon">
                                                <span className="material-symbols-outlined" style={{ fontSize: 22, color: '#4f46e5' }}>storefront</span>
                                            </div>
                                            <div className="ov-store-hdr-title">
                                                <h3 className="ov-store-name">{sysStore.name}</h3>
                                                <span style={{
                                                    fontSize: '11px',
                                                    fontWeight: 600,
                                                    color: sysStore.is_active !== false ? '#10b981' : '#ef4444',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.5px',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '5px'
                                                }}>
                                                    <span style={{
                                                        width: '6px',
                                                        height: '6px',
                                                        borderRadius: '50%',
                                                        background: 'currentColor',
                                                        boxShadow: sysStore.is_active !== false ? '0 0 0 2px rgba(16, 185, 129, 0.2)' : '0 0 0 2px rgba(239, 68, 68, 0.2)'
                                                    }} />
                                                    {sysStore.is_active !== false ? 'HOẠT ĐỘNG' : 'NGỪNG HOẠT ĐỘNG'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="ov-shifts-list">
                                        {[1, 2, 3].map(shiftNum => {
                                            const shiftData = stores.find(s => s.code === sysStore.code && s.shift === shiftNum);
                                            const hasData = !!shiftData;
                                            const sc = getShiftStatusColor(shiftData?.reportStatus || null, shiftData?.progress.percentage || 0);
                                            const label = getShiftStatusLabel(shiftData?.reportStatus || null, shiftData?.progress.percentage || 0);
                                            const hasIssues = shiftData ? (shiftData.progress.missing > 0 || shiftData.progress.over > 0) : false;

                                            return (
                                                <div
                                                    key={shiftNum}
                                                    className={`ov-shift-row ${hasData ? 'clickable' : 'ov-shift-empty'} ${selectedStore?.code === sysStore.code && selectedStore?.shift === shiftNum ? 'ov-shift-active' : ''}`}
                                                    onClick={() => {
                                                        if (hasData) {
                                                            setSelectedStore(prev => prev?.id === shiftData!.id ? null : shiftData);
                                                        }
                                                    }}
                                                >
                                                    <div className="ov-shift-info">
                                                        <div className="ov-shift-title">
                                                            <span className="ov-shift-number">Ca {shiftNum}</span>
                                                            {hasData && shiftData.employee && (
                                                                <span className="ov-shift-emp">• {shiftData.employee.name}</span>
                                                            )}
                                                        </div>
                                                        {hasData ? (
                                                            <div className="ov-shift-meta">
                                                                {shiftData.progress.checked}/{shiftData.progress.total} SP
                                                                {hasIssues && <span className="ov-shift-issue ml-1">(Lệch: {shiftData.progress.missing + shiftData.progress.over})</span>}
                                                            </div>
                                                        ) : (
                                                            <div className="ov-shift-meta">--</div>
                                                        )}
                                                    </div>

                                                    <div className="ov-shift-status">
                                                        <span className="ov-badge" style={{ backgroundColor: hasData ? sc.bg + '18' : '#f1f5f9', color: hasData ? sc.bg : '#94a3b8' }}>
                                                            {label}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── Side Panel ── */}
            <ItemsDetailPanel
                storeId={selectedStore?.id || ''}
                storeName={sysStores.find(s => s.code === selectedStore?.code)?.name || selectedStore?.name || ''}
                checkDate={date}
                shift={selectedStore?.shift || 1}
                isOpen={!!selectedStore}
                onClose={() => setSelectedStore(null)}
            />
        </>
    );
};

const CSS_TEXT = `
/* ── Variables & Typography ── */
:root {
  --ov-bg: #f8fafc;
  --ov-card-bg: #ffffff;
  --ov-border: #e2e8f0;
  --ov-text-main: #0f172a;
  --ov-text-muted: #64748b;
  --ov-text-light: #94a3b8;
  --ov-primary: #6366f1;
  --ov-primary-hover: #4f46e5;
  --ov-success: #10b981;
  --ov-success-light: #d1fae5;
  --ov-danger: #ef4444;
  --ov-danger-light: #fee2e2;
  --ov-radius-lg: 16px;
  --ov-radius-md: 12px;
  --ov-shadow-sm: 0 1px 3px rgba(0,0,0,0.04);
  --ov-shadow-hover: 0 12px 24px -6px rgba(0,0,0,0.06), 0 4px 8px -2px rgba(0,0,0,0.04);
}

.ov-root { display: flex; flex-direction: column; gap: 24px; padding: 24px 0; min-height: 80vh; font-family: 'Inter', system-ui, sans-serif; }

/* ── Summary Strip (Glassmorphism inspired) ── */
.ov-summary-strip { 
  display: flex; align-items: center; gap: 4px; 
  background: rgba(255, 255, 255, 0.9); 
  backdrop-filter: blur(8px);
  border: 1px solid var(--ov-border); 
  border-radius: var(--ov-radius-lg); 
  padding: 14px 20px; flex-wrap: wrap; 
  box-shadow: var(--ov-shadow-sm);
}
.ov-summary-item { display: flex; align-items: center; gap: 8px; padding: 0 12px; }
.ov-summary-label { font-size: 13px; font-weight: 600; color: var(--ov-text-muted); white-space: nowrap; text-transform: uppercase; letter-spacing: 0.5px; }
.ov-summary-value { font-size: 20px; font-weight: 800; color: var(--ov-text-main); line-height: 1; min-width: 24px; text-align: center; }
.ov-summary-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; box-shadow: inset 0 0 0 2px rgba(255,255,255,0.5); }
.ov-summary-divider { width: 1px; height: 32px; background: #f1f5f9; margin: 0 8px; flex-shrink: 0; }
.ov-summary-spacer { flex: 1; min-width: 24px; }

/* Live indicator */
.ov-live-indicator { display: flex; align-items: center; gap: 8px; background: #f8fafc; padding: 6px 14px; border-radius: 30px; border: 1px solid #f1f5f9; }
.ov-live-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--ov-success); animation: ov-pulse-live 2s ease-in-out infinite; flex-shrink: 0; }
@keyframes ov-pulse-live { 0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(16,185,129,.4) } 50% { opacity: .6; box-shadow: 0 0 0 6px rgba(16,185,129,0) } }
.ov-live-text { font-size: 13px; color: var(--ov-text-muted); font-weight: 600; white-space: nowrap; }
.ov-refresh-btn { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: transparent; border: none; cursor: pointer; color: var(--ov-text-muted); transition: all .2s; flex-shrink: 0; margin-left: 4px; }
.ov-refresh-btn:hover { background: #eef2ff; color: var(--ov-primary); transform: rotate(15deg); }

/* ── Grid & Cards ── */
.ov-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 24px; align-items: flex-start; }

.ov-store-card { 
  background: var(--ov-card-bg); 
  border: 1px solid var(--ov-border); 
  border-radius: var(--ov-radius-lg); 
  box-shadow: var(--ov-shadow-sm); 
  display: flex; flex-direction: column; 
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
  overflow: hidden;
}
.ov-store-card:hover { 
  box-shadow: var(--ov-shadow-hover); 
  transform: translateY(-4px); 
  border-color: #cbd5e1; 
}

/* Header */
.ov-store-hdr { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 20px 24px 16px; background: #ffffff; border-bottom: 1px solid #f1f5f9; position: relative; }
.ov-store-hdr::after { content: ''; position: absolute; left: 24px; bottom: -1px; width: 40px; height: 2px; background: var(--ov-primary); border-radius: 2px 2px 0 0; }
.ov-store-hdr-main { display: flex; align-items: center; gap: 14px; }
.ov-store-hdr-icon { width: 42px; height: 42px; border-radius: 12px; background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%); display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 2px 4px rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.2); }
.ov-store-hdr-title { display: flex; flex-direction: column; gap: 3px; }
.ov-store-name { font-size: 16px; font-weight: 700; color: var(--ov-text-main); margin: 0; letter-spacing: -0.2px; line-height: 1.2; }

/* Shifts List */
.ov-shifts-list { display: flex; flex-direction: column; padding: 12px; gap: 8px; background: #f8fafc; }
.ov-shift-row { 
  display: flex; justify-content: space-between; align-items: center; 
  padding: 14px 16px; border-radius: var(--ov-radius-md); 
  transition: all 0.25s ease; border: 1px solid transparent; 
  background: #ffffff;
}
.ov-shift-row.clickable { cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.02); }
.ov-shift-row.clickable:hover { background: #ffffff; border-color: #cbd5e1; box-shadow: 0 4px 12px rgba(0,0,0,0.04); transform: translateX(2px); }
.ov-shift-row.ov-shift-active { background: #eff6ff; border-color: #bfdbfe; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02); }
.ov-shift-row.ov-shift-empty { background: transparent; opacity: 0.5; box-shadow: none; }

.ov-shift-info { display: flex; flex-direction: column; gap: 4px; }
.ov-shift-title { display: flex; align-items: center; gap: 8px; }
.ov-shift-number { font-size: 15px; font-weight: 700; color: var(--ov-text-main); }
.ov-shift-emp { font-size: 13px; color: var(--ov-text-muted); font-weight: 500; background: #f1f5f9; padding: 2px 8px; border-radius: 6px; }

.ov-shift-meta { font-size: 13px; color: var(--ov-text-light); display: flex; align-items: center; font-weight: 500; }
.ov-shift-issue { color: var(--ov-danger); font-weight: 700; background: var(--ov-danger-light); padding: 2px 6px; border-radius: 4px; margin-left: 6px; font-size: 12px; }

/* Badges */
.ov-shift-status { display: flex; align-items: center; }
.ov-badge { 
  padding: 6px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; 
  letter-spacing: 0.3px; border: 1px solid transparent; white-space: nowrap; 
}

/* Empty / Loading States */
.ov-loading, .ov-error, .ov-empty { 
  display: flex; flex-direction: column; align-items: center; justify-content: center; 
  padding: 80px 20px; text-align: center; color: var(--ov-text-muted); 
  background: var(--ov-card-bg); border-radius: var(--ov-radius-lg); 
  border: 1px dashed #cbd5e1; box-shadow: var(--ov-shadow-sm); 
}
.ov-empty-icon { width: 64px; height: 64px; background: #f1f5f9; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 16px; }
.ov-empty-title { font-size: 18px; font-weight: 700; color: var(--ov-text-main); margin: 0 0 8px 0; }
.ov-spin { animation: ov-spin 1s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
@keyframes ov-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

.ov-retry-btn { margin-top: 20px; padding: 10px 20px; background: var(--ov-primary); color: white; border-radius: var(--ov-radius-md); border: none; font-size: 14px; font-weight: 600; cursor: pointer; transition: all .2s; box-shadow: 0 4px 6px -1px rgba(99, 102, 241, 0.2); }
.ov-retry-btn:hover { background: var(--ov-primary-hover); transform: translateY(-1px); box-shadow: 0 6px 8px -1px rgba(99, 102, 241, 0.3); }

.ov-pulse { animation: ov-pulse-badge 2s infinite cubic-bezier(0.4, 0, 0.6, 1); }
@keyframes ov-pulse-badge { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.1); } 100% { opacity: 1; transform: scale(1); } }
`;

export default OverviewTab;
