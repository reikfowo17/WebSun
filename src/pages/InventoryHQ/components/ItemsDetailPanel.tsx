import React, { useState, useEffect, useCallback } from 'react';
import { InventoryService } from '../../../services';

/* ── Types ── */
interface ReportItem {
    id: string;
    product_name: string;
    barcode: string;
    category: string;
    system_stock: number;
    actual_stock: number | null;
    diff: number | null;
    status: string;
    note: string | null;
    diff_reason: string | null;
}

export interface ItemsDetailPanelProps {
    storeId: string;
    checkDate: string;
    shift: number;
    isOpen: boolean;
    /** 'panel' = slide-in side panel (default), 'inline' = embedded in parent */
    mode?: 'panel' | 'inline';
    /** Required for panel mode */
    storeName?: string;
    /** Required for panel mode */
    onClose?: () => void;
    /** Optional extra info to show in header */
    submittedBy?: string;
    reportStatus?: string;
}

/* ── Status helpers ── */
const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    MATCHED: { label: 'Khớp', color: '#16a34a', bg: '#f0fdf4', icon: 'check_circle' },
    MISSING: { label: 'Thiếu', color: '#dc2626', bg: '#fef2f2', icon: 'remove_circle' },
    OVER: { label: 'Thừa', color: '#4f46e5', bg: '#eef2ff', icon: 'add_circle' },
    PENDING: { label: 'Chưa kiểm', color: '#94a3b8', bg: '#f8fafc', icon: 'radio_button_unchecked' },
    UNCHECKED: { label: 'Chưa kiểm', color: '#94a3b8', bg: '#f8fafc', icon: 'radio_button_unchecked' },
};

const REPORT_STATUS: Record<string, { label: string; color: string; bg: string }> = {
    PENDING: { label: 'Chờ duyệt', color: '#92400e', bg: '#fef3c7' },
    APPROVED: { label: 'Đã duyệt', color: '#065f46', bg: '#d1fae5' },
    REJECTED: { label: 'Từ chối', color: '#991b1b', bg: '#fef2f2' },
};

const getStatusInfo = (s: string) => STATUS_MAP[s] || STATUS_MAP.UNCHECKED;

const ItemsDetailPanel: React.FC<ItemsDetailPanelProps> = ({
    storeId, storeName = '', checkDate, shift, isOpen, onClose = () => { },
    mode = 'panel', submittedBy, reportStatus,
}) => {
    const isInline = mode === 'inline';
    const [items, setItems] = useState<ReportItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState<string>('ALL');
    const [search, setSearch] = useState('');
    const [animateIn, setAnimateIn] = useState(false);

    // Animate open/close (panel mode only)
    useEffect(() => {
        if (isInline) return;
        if (isOpen) {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => setAnimateIn(true));
            });
        } else {
            setAnimateIn(false);
        }
    }, [isOpen, isInline]);

    // Fetch items
    useEffect(() => {
        if (!isOpen || !storeId || !checkDate) return;
        let cancelled = false;
        setLoading(true);
        setItems([]);
        setFilter('ALL');
        setSearch('');
        InventoryService.getReportItems(storeId, checkDate, shift).then(res => {
            if (cancelled) return;
            if (res.success && res.items) setItems(res.items);
            setLoading(false);
        });
        return () => { cancelled = true; };
    }, [isOpen, storeId, checkDate, shift]);

    // Close on Escape key (panel mode only)
    useEffect(() => {
        if (!isOpen || isInline) return;
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [isOpen, isInline, onClose]);

    // Graceful close with animation (panel mode only)
    const handleClose = useCallback(() => {
        if (isInline) return;
        setAnimateIn(false);
        setTimeout(onClose, 280);
    }, [onClose, isInline]);

    if (!isOpen) return null;

    /* ── Filter & search ── */
    const filteredItems = items.filter(item => {
        if (filter !== 'ALL') {
            if (filter === 'UNCHECKED') {
                if (item.status !== 'UNCHECKED' && item.status !== 'PENDING') return false;
            } else if (item.status !== filter) {
                return false;
            }
        }
        if (search) {
            const q = search.toLowerCase();
            return item.product_name.toLowerCase().includes(q) || item.barcode.includes(q);
        }
        return true;
    });

    /* ── Counts ── */
    const counts = {
        ALL: items.length,
        MATCHED: items.filter(i => i.status === 'MATCHED').length,
        MISSING: items.filter(i => i.status === 'MISSING').length,
        OVER: items.filter(i => i.status === 'OVER').length,
        UNCHECKED: items.filter(i => i.status === 'UNCHECKED' || i.status === 'PENDING').length,
    };

    const reportSt = reportStatus ? REPORT_STATUS[reportStatus] : null;

    /* ── Shared toolbar + table content (used by both modes) ── */
    const renderContent = () => (
        <>
            {/* ── Toolbar (filter + search) ── */}
            <div className="sp-toolbar">
                <div className="sp-filters">
                    {(['ALL', 'MISSING', 'OVER', 'MATCHED', 'UNCHECKED'] as const).map(f => {
                        const info = f === 'ALL'
                            ? { label: 'Tất cả', color: '#475569', bg: '#f1f5f9' }
                            : getStatusInfo(f);
                        return (
                            <button
                                key={f}
                                className={`sp-filter-btn ${filter === f ? 'active' : ''}`}
                                style={filter === f ? { background: info.bg, color: info.color, borderColor: info.color + '40' } : {}}
                                onClick={() => setFilter(f)}
                            >
                                {info.label}
                                <span className="sp-filter-cnt">{counts[f]}</span>
                            </button>
                        );
                    })}
                </div>
                <div className="sp-search">
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#94a3b8' }}>search</span>
                    <input
                        type="text"
                        placeholder="Tìm sản phẩm..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="sp-search-input"
                    />
                    {search && (
                        <button className="sp-search-clear" onClick={() => setSearch('')}>
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                        </button>
                    )}
                </div>
            </div>

            {/* ── Items List ── */}
            <div className={isInline ? 'sp-content sp-content--inline' : 'sp-content'}>
                {loading ? (
                    <div className="sp-loading">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                            <div key={i} className="sp-skel-row">
                                <div className="sp-skel" style={{ width: '45%' }} />
                                <div className="sp-skel" style={{ width: '18%' }} />
                                <div className="sp-skel" style={{ width: '12%' }} />
                                <div className="sp-skel" style={{ width: '15%' }} />
                            </div>
                        ))}
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="sp-empty">
                        <span className="material-symbols-outlined" style={{ fontSize: 40, color: '#cbd5e1' }}>
                            {search ? 'search_off' : 'inventory_2'}
                        </span>
                        <span className="sp-empty-title">{search ? 'Không tìm thấy sản phẩm' : 'Không có sản phẩm nào'}</span>
                        <span className="sp-empty-sub">
                            {search ? 'Thử từ khóa khác' : 'Chưa có dữ liệu kiểm kê cho báo cáo này'}
                        </span>
                    </div>
                ) : (
                    <div className="sp-table-wrap">
                        <table className="sp-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '5%' }}>#</th>
                                    <th style={{ width: '37%' }}>Sản phẩm</th>
                                    <th style={{ width: '12%', textAlign: 'center' }}>Hệ thống</th>
                                    <th style={{ width: '12%', textAlign: 'center' }}>Thực tế</th>
                                    <th style={{ width: '10%', textAlign: 'center' }}>Lệch</th>
                                    <th style={{ width: '12%', textAlign: 'center' }}>Trạng thái</th>
                                    <th style={{ width: '12%' }}>Ghi chú</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredItems.map((item, idx) => {
                                    const si = getStatusInfo(item.status);
                                    const hasDiff = item.diff !== null && item.diff !== 0;
                                    return (
                                        <tr key={item.id} className={hasDiff ? 'sp-row-issue' : ''}>
                                            <td className="sp-cell-num">{idx + 1}</td>
                                            <td>
                                                <div className="sp-product">
                                                    <span className="sp-product-name">{item.product_name}</span>
                                                    {item.barcode && <span className="sp-barcode">{item.barcode}</span>}
                                                </div>
                                            </td>
                                            <td className="sp-cell-num">{item.system_stock}</td>
                                            <td className="sp-cell-num" style={{ fontWeight: 700 }}>
                                                {item.actual_stock !== null ? item.actual_stock : '—'}
                                            </td>
                                            <td className="sp-cell-num" style={{
                                                color: hasDiff ? si.color : '#94a3b8',
                                                fontWeight: hasDiff ? 800 : 400
                                            }}>
                                                {item.diff !== null ? (item.diff > 0 ? `+${item.diff}` : item.diff) : '—'}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span className="sp-status-badge" style={{ background: si.bg, color: si.color }}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{si.icon}</span>
                                                    {si.label}
                                                </span>
                                            </td>
                                            <td className="sp-cell-note">
                                                {item.note || item.diff_reason || ''}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Footer ── */}
            {!loading && items.length > 0 && (
                <div className="sp-footer">
                    <span>
                        Hiển thị <strong>{filteredItems.length}</strong> / {items.length} sản phẩm
                    </span>
                    {filter !== 'ALL' && (
                        <button className="sp-footer-reset" onClick={() => { setFilter('ALL'); setSearch(''); }}>
                            Xóa bộ lọc
                        </button>
                    )}
                </div>
            )}
        </>
    );

    /* ── INLINE mode: just render content directly ── */
    if (isInline) {
        return (
            <div className="sp-inline-root">
                <style>{CSS_TEXT}</style>
                {renderContent()}
            </div>
        );
    }

    /* ── PANEL mode: slide-in with backdrop ── */
    return (
        <>
            <style>{CSS_TEXT}</style>

            {/* Backdrop overlay */}
            <div
                className={`sp-backdrop ${animateIn ? 'sp-backdrop--visible' : ''}`}
                onClick={handleClose}
                aria-hidden="true"
            />

            {/* Side Panel */}
            <aside
                className={`sp-panel ${animateIn ? 'sp-panel--open' : ''}`}
                role="dialog"
                aria-label={`Chi tiết kiểm kê - ${storeName}`}
                onClick={e => e.stopPropagation()}
            >
                {/* ── Header ── */}
                <div className="sp-header">
                    <div className="sp-header-top">
                        <button className="sp-close-btn" onClick={handleClose} aria-label="Đóng">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                        <div className="sp-header-info">
                            <h2 className="sp-title">{storeName}</h2>
                            <div className="sp-meta">
                                <span className="sp-meta-item">
                                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>calendar_today</span>
                                    {new Date(checkDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                </span>
                                <span className="sp-meta-sep">•</span>
                                <span className="sp-meta-item">Ca {shift}</span>
                                {submittedBy && (
                                    <>
                                        <span className="sp-meta-sep">•</span>
                                        <span className="sp-meta-item">
                                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>person</span>
                                            {submittedBy}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                        {reportSt && (
                            <span className="sp-report-badge" style={{ background: reportSt.bg, color: reportSt.color }}>
                                {reportSt.label}
                            </span>
                        )}
                    </div>

                    {/* Stats summary */}
                    {!loading && items.length > 0 && (
                        <div className="sp-stats-row">
                            <div className="sp-stat">
                                <span className="sp-stat-val">{counts.ALL}</span>
                                <span className="sp-stat-label">Tổng</span>
                            </div>
                            <div className="sp-stat sp-stat--ok">
                                <span className="sp-stat-val">{counts.MATCHED}</span>
                                <span className="sp-stat-label">Khớp</span>
                            </div>
                            <div className="sp-stat sp-stat--danger">
                                <span className="sp-stat-val">{counts.MISSING}</span>
                                <span className="sp-stat-label">Thiếu</span>
                            </div>
                            <div className="sp-stat sp-stat--info">
                                <span className="sp-stat-val">{counts.OVER}</span>
                                <span className="sp-stat-label">Thừa</span>
                            </div>
                            <div className="sp-stat">
                                <span className="sp-stat-val">{counts.UNCHECKED}</span>
                                <span className="sp-stat-label">Chưa kiểm</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Shared content (toolbar + table + footer) */}
                {renderContent()}
            </aside>
        </>
    );
};

export default ItemsDetailPanel;

/* ═══════════════════════ CSS ═══════════════════════ */
const CSS_TEXT = `
/* ── Backdrop ── */
.sp-backdrop {
    position:fixed; inset:0; z-index:998;
    background:rgba(15,23,42,.35);
    backdrop-filter:blur(4px);
    opacity:0;
    transition:opacity .28s cubic-bezier(.4,0,.2,1);
    pointer-events:none;
}
.sp-backdrop--visible { opacity:1; pointer-events:auto; }

/* ── Side Panel ── */
.sp-panel {
    position:fixed; top:0; right:0; bottom:0; z-index:999;
    width:min(560px, 90vw);
    background:#fff;
    display:flex; flex-direction:column;
    box-shadow:-20px 0 60px rgba(0,0,0,.12), -4px 0 16px rgba(0,0,0,.06);
    transform:translateX(100%);
    transition:transform .28s cubic-bezier(.4,0,.2,1);
    will-change:transform;
}
.sp-panel--open { transform:translateX(0); }

/* ── Header ── */
.sp-header {
    padding:20px 24px 0;
    border-bottom:1px solid #e5e7eb;
    flex-shrink:0;
    background:linear-gradient(180deg,#fafbff 0%,#fff 100%);
}
.sp-header-top { display:flex; align-items:flex-start; gap:12px; padding-bottom:16px; }
.sp-close-btn {
    width:36px; height:36px; border-radius:10px; border:1px solid #e5e7eb;
    background:#fff; cursor:pointer; display:flex;
    align-items:center; justify-content:center; color:#64748b;
    transition:all .15s; flex-shrink:0;
}
.sp-close-btn:hover { background:#f1f5f9; color:#1e293b; border-color:#cbd5e1; }
.sp-close-btn:focus-visible { outline:2px solid #6366f1; outline-offset:2px; }
.sp-header-info { flex:1; min-width:0; }
.sp-title { margin:0; font-size:18px; font-weight:800; color:#0f172a; letter-spacing:-.01em; }
.sp-meta { display:flex; align-items:center; gap:6px; margin-top:4px; flex-wrap:wrap; }
.sp-meta-item { display:inline-flex; align-items:center; gap:3px; font-size:13px; color:#64748b; font-weight:500; }
.sp-meta-sep { color:#cbd5e1; font-size:10px; }
.sp-report-badge {
    padding:4px 12px; border-radius:7px; font-size:11px;
    font-weight:700; white-space:nowrap; align-self:flex-start; margin-top:2px;
}

/* ── Stats Row ── */
.sp-stats-row {
    display:flex; gap:2px; padding:12px 0;
}
.sp-stat {
    flex:1; text-align:center; padding:8px 4px;
    border-radius:10px; background:#f8fafc;
    transition:transform .15s;
}
.sp-stat:hover { transform:translateY(-1px); }
.sp-stat--ok { background:#f0fdf44d; }
.sp-stat--danger { background:#fef2f24d; }
.sp-stat--info { background:#eef2ff4d; }
.sp-stat-val { display:block; font-size:20px; font-weight:800; color:#1e293b; line-height:1.2; font-variant-numeric:tabular-nums; }
.sp-stat--ok .sp-stat-val { color:#16a34a; }
.sp-stat--danger .sp-stat-val { color:#dc2626; }
.sp-stat--info .sp-stat-val { color:#4f46e5; }
.sp-stat-label { display:block; font-size:11px; color:#94a3b8; font-weight:600; margin-top:2px; text-transform:uppercase; letter-spacing:.02em; }

/* ── Toolbar ── */
.sp-toolbar {
    display:flex; align-items:center; gap:8px; flex-wrap:wrap;
    padding:12px 24px; border-bottom:1px solid #f1f5f9;
    flex-shrink:0; background:#fff;
}
.sp-filters { display:flex; gap:4px; flex-wrap:wrap; flex:1; }
.sp-filter-btn {
    display:inline-flex; align-items:center; gap:4px;
    padding:5px 11px; border-radius:7px;
    font-size:12px; font-weight:600;
    border:1.5px solid transparent;
    background:#f8fafc; color:#64748b;
    cursor:pointer; transition:all .15s;
}
.sp-filter-btn:hover { background:#f1f5f9; }
.sp-filter-btn.active { border-color:currentColor; }
.sp-filter-cnt { font-size:10px; opacity:.6; font-weight:700; margin-left:1px; }

.sp-search {
    display:flex; align-items:center; gap:6px;
    padding:5px 10px; border-radius:8px;
    background:#f8fafc; border:1.5px solid #e2e8f0;
    transition:border-color .15s, box-shadow .15s;
}
.sp-search:focus-within { border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,.08); }
.sp-search-input {
    border:none; outline:none; background:transparent;
    font-size:12px; width:120px; color:#1e293b;
}
.sp-search-clear {
    display:flex; align-items:center; justify-content:center;
    width:18px; height:18px; border:none; background:transparent;
    color:#94a3b8; cursor:pointer; border-radius:50%;
    transition:all .12s;
}
.sp-search-clear:hover { background:#f1f5f9; color:#475569; }

/* ── Content (scrollable) ── */
.sp-content { flex:1; overflow-y:auto; padding:0 24px; }

/* Table */
.sp-table-wrap { padding:4px 0 16px; }
.sp-table { width:100%; border-collapse:collapse; font-size:12px; }
.sp-table thead { position:sticky; top:0; z-index:2; background:#fff; }
.sp-table th {
    padding:10px 10px; text-align:left; font-weight:700;
    color:#475569; font-size:11px; text-transform:uppercase;
    letter-spacing:.04em; border-bottom:2px solid #e5e7eb;
    white-space:nowrap; background:#fff;
}
.sp-table td { padding:9px 10px; border-bottom:1px solid #f3f4f6; vertical-align:middle; }
.sp-table tbody tr { transition:background .1s; }
.sp-table tbody tr:hover { background:#f8fafc; }
.sp-row-issue { background:#fffbeb !important; }
.sp-row-issue:hover { background:#fef3c7 !important; }
.sp-cell-num { text-align:center; font-variant-numeric:tabular-nums; color:#475569; }
.sp-cell-note { font-size:11px; color:#64748b; max-width:100px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

/* Product cell */
.sp-product { display:flex; flex-direction:column; gap:1px; }
.sp-product-name { font-weight:600; color:#1e293b; line-height:1.3; }
.sp-barcode { font-size:10px; color:#94a3b8; font-family:'Courier New',monospace; }

/* Status badge */
.sp-status-badge {
    display:inline-flex; align-items:center; gap:3px;
    padding:2px 8px; border-radius:99px;
    font-size:11px; font-weight:700;
    white-space:nowrap;
}

/* ── Loading skeleton ── */
.sp-loading { display:flex; flex-direction:column; gap:10px; padding:20px 0; }
.sp-skel-row { display:flex; gap:12px; align-items:center; }
.sp-skel { height:14px; background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%); background-size:200% 100%; border-radius:6px; animation:sp-shimmer 1.5s ease-in-out infinite; }
@keyframes sp-shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

/* ── Empty ── */
.sp-empty {
    display:flex; flex-direction:column; align-items:center; gap:8px;
    padding:60px 20px; text-align:center;
}
.sp-empty-title { font-size:15px; font-weight:700; color:#475569; }
.sp-empty-sub { font-size:13px; color:#94a3b8; }

/* ── Footer ── */
.sp-footer {
    padding:10px 24px; border-top:1px solid #f1f5f9;
    font-size:12px; color:#64748b; font-weight:500;
    display:flex; align-items:center; justify-content:space-between;
    flex-shrink:0; background:#fafbfc;
}
.sp-footer strong { color:#1e293b; font-weight:800; }
.sp-footer-reset {
    border:none; background:none; color:#6366f1; font-size:12px;
    font-weight:600; cursor:pointer; padding:4px 8px; border-radius:6px;
    transition:background .12s;
}
.sp-footer-reset:hover { background:#eef2ff; }

/* Custom scrollbar for panel content */
.sp-content::-webkit-scrollbar { width:5px; }
.sp-content::-webkit-scrollbar-track { background:transparent; }
.sp-content::-webkit-scrollbar-thumb { background:#e2e8f0; border-radius:99px; }
.sp-content::-webkit-scrollbar-thumb:hover { background:#cbd5e1; }

/* ── Inline mode ── */
.sp-inline-root { padding:12px 0 4px; }
.sp-inline-root .sp-stats { margin-bottom:8px; }
.sp-inline-root .sp-toolbar { margin-bottom:8px; }
.sp-content--inline { max-height:400px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:8px; }
`;
