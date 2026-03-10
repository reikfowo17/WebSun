import React, { useState, useEffect, useCallback, useRef } from 'react';
import { InventoryService } from '../../../services';
import {
    RESOLUTION_CONFIG,
    RECHECK_RESOLUTIONS,
    RECOVERY_RESOLUTIONS,
    type DiscrepancyResolution,
    type ReportItem,
} from '../../../services/inventory';
import { ResolutionSelect } from './ResolutionSelect';
import { RecoveryForm } from './RecoveryForm';
import { RecheckDateField } from './RecheckDateField';
import { AdminNoteField } from './AdminNoteField';

export { ResolutionSelect } from './ResolutionSelect';
export { RecoveryForm } from './RecoveryForm';
export { RecheckDateField } from './RecheckDateField';
export { AdminNoteField } from './AdminNoteField';

export interface ItemsDetailPanelProps {
    storeId: string;
    storeCode?: string;
    checkDate: string;
    shift: number;
    reportId?: string;
    isOpen: boolean;
    /** 'panel' = slide-in side panel (default), 'inline' = embedded in parent */
    mode?: 'panel' | 'inline';
    storeName?: string;
    onClose?: () => void;
    submittedBy?: string;
    reportStatus?: string;
}

/* ── Status chip config ── */
const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    MATCHED: { label: 'Khớp', color: '#16a34a', bg: '#f0fdf4', icon: 'check_circle' },
    MISSING: { label: 'Thiếu', color: '#dc2626', bg: '#fef2f2', icon: 'remove_circle' },
    OVER: { label: 'Thừa', color: '#4f46e5', bg: '#eef2ff', icon: 'add_circle' },
    PENDING: { label: 'Chưa kiểm', color: '#94a3b8', bg: '#f8fafc', icon: 'radio_button_unchecked' },
    UNCHECKED: { label: 'Chưa kiểm', color: '#94a3b8', bg: '#f8fafc', icon: 'radio_button_unchecked' },
};

const REPORT_STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
    PENDING: { label: 'Chờ xử lý', color: '#92400e', bg: '#fef3c7' },
    APPROVED: { label: 'Đã xử lý', color: '#065f46', bg: '#d1fae5' },
    REJECTED: { label: 'Cần kiểm lại', color: '#991b1b', bg: '#fee2e2' },
};

const getStatusInfo = (s: string) => STATUS_MAP[s] || STATUS_MAP.UNCHECKED;

interface ItemActionPanelProps {
    item: ReportItem;
    reportId?: string;
    storeId: string;
    onUpdated: (updated: Partial<ReportItem>) => void;
}

const ItemActionPanel: React.FC<ItemActionPanelProps> = ({ item, reportId, storeId, onUpdated }) => {
    const [resolution, setResolution] = useState<DiscrepancyResolution>(item.resolution || 'PENDING');
    const [adminNote, setAdminNote] = useState(item.admin_note || '');
    const [recheckDate, setRecheckDate] = useState(item.recheck_due_date || '');
    const [saving, setSaving] = useState(false);
    const [savingRecovery, setSavingRecovery] = useState(false);
    const [unitPrice, setUnitPrice] = useState('');
    const [recoveryDone, setRecoveryDone] = useState(false);
    const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const needsRecheck = RECHECK_RESOLUTIONS.includes(resolution);
    const needsRecovery = RECOVERY_RESOLUTIONS.includes(resolution);
    const diff = item.diff ?? 0;
    const absQty = Math.abs(diff);

    /* Auto-save resolution change */
    const handleResolutionChange = async (newRes: DiscrepancyResolution) => {
        setResolution(newRes);
        setSaving(true);
        try {
            await InventoryService.updateItemResolution(item.id, newRes, adminNote, {
                recheckDueDate: recheckDate || undefined,
            });
            onUpdated({ resolution: newRes });
        } finally {
            setSaving(false);
        }
    };

    const handleNoteChange = (val: string) => {
        setAdminNote(val);
        if (noteTimer.current) clearTimeout(noteTimer.current);
        noteTimer.current = setTimeout(async () => {
            await InventoryService.updateItemResolution(item.id, resolution, val, {
                recheckDueDate: recheckDate || undefined,
            });
            onUpdated({ admin_note: val });
        }, 800);
    };

    const handleRecheckDateChange = async (date: string) => {
        setRecheckDate(date);
        setSaving(true);
        try {
            await InventoryService.updateItemResolution(item.id, resolution, adminNote, {
                recheckDueDate: date || undefined,
                recheckNote: adminNote || undefined,
            });
            onUpdated({ recheck_due_date: date });
        } finally {
            setSaving(false);
        }
    };

    const handleCreateRecovery = async (unitPriceValue: number) => {
        const res = await InventoryService.createRecoveryFromDiscrepancy({
            itemId: item.id,
            reportId: reportId || '',
            storeId,
            quantity: absQty,
            unitPrice: unitPriceValue,
            reason: adminNote || `Mất hàng – ${item.product_name} (lệch ${diff})`,
        });
        if (res.success) {
            onUpdated({ resolution: 'LOST_GOODS' });
        }
    };

    return (
        <div className="iap-root">
            <ResolutionSelect
                value={resolution}
                onChange={handleResolutionChange}
            />

            {needsRecheck && (
                <RecheckDateField
                    value={recheckDate}
                    onChange={handleRecheckDateChange}
                    completedAt={item.recheck_completed_at}
                />
            )}

            {needsRecovery && (
                <RecoveryForm
                    quantity={absQty}
                    onCreateRecovery={handleCreateRecovery}
                />
            )}

            <AdminNoteField
                value={adminNote}
                onChange={handleNoteChange}
            />
        </div>
    );
};

const ItemsDetailPanel: React.FC<ItemsDetailPanelProps> = ({
    storeId, storeCode, storeName = '', checkDate, shift, reportId,
    isOpen, onClose = () => { }, mode = 'panel', submittedBy, reportStatus,
}) => {
    const isInline = mode === 'inline';
    const [items, setItems] = useState<ReportItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState<string>('ALL');
    const [resFilter, setResFilter] = useState<string>('ALL');
    const [search, setSearch] = useState('');
    const [animateIn, setAnimateIn] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        if (isInline) return;
        if (isOpen) {
            requestAnimationFrame(() => requestAnimationFrame(() => setAnimateIn(true)));
        } else {
            setAnimateIn(false);
        }
    }, [isOpen, isInline]);

    useEffect(() => {
        if (!isOpen || !storeId || !checkDate) return;
        let cancelled = false;
        setLoading(true);
        setItems([]);
        setFilter('ALL');
        setResFilter('ALL');
        setSearch('');
        setExpandedId(null);
        InventoryService.getReportItems(storeId, checkDate, shift).then(res => {
            if (cancelled) return;
            if (res.success && res.items) setItems(res.items as ReportItem[]);
            setLoading(false);
        });
        return () => { cancelled = true; };
    }, [isOpen, storeId, checkDate, shift]);

    useEffect(() => {
        if (!isOpen || isInline) return;
        const h = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
        document.addEventListener('keydown', h);
        return () => document.removeEventListener('keydown', h);
    }, [isOpen, isInline]);

    const handleClose = useCallback(() => {
        if (isInline) return;
        setAnimateIn(false);
        setTimeout(onClose, 280);
    }, [onClose, isInline]);

    const handleItemUpdated = useCallback((itemId: string, patch: Partial<ReportItem>) => {
        setItems(prev => prev.map(i => i.id === itemId ? { ...i, ...patch } : i));
    }, []);

    if (!isOpen) return null;

    const discrepant = items.filter(i => i.diff !== null && i.diff !== 0);
    const filteredItems = items.filter(item => {
        if (filter !== 'ALL') {
            if (filter === 'UNCHECKED') {
                if (item.status !== 'UNCHECKED' && item.status !== 'PENDING') return false;
            } else if (filter === 'DISCREPANT') {
                if (item.diff === null || item.diff === 0) return false;
            } else if (item.status !== filter) {
                return false;
            }
        }
        if (resFilter !== 'ALL' && item.resolution !== resFilter) return false;
        if (search) {
            const q = search.toLowerCase();
            return item.product_name.toLowerCase().includes(q) || item.barcode.includes(q);
        }
        return true;
    });

    const counts = {
        ALL: items.length,
        MATCHED: items.filter(i => i.status === 'MATCHED').length,
        MISSING: items.filter(i => i.status === 'MISSING').length,
        OVER: items.filter(i => i.status === 'OVER').length,
        UNCHECKED: items.filter(i => i.status === 'UNCHECKED' || i.status === 'PENDING').length,
        DISCREPANT: discrepant.length,
    };

    const resPending = discrepant.filter(i => !i.resolution || i.resolution === 'PENDING').length;
    const reportSt = reportStatus ? REPORT_STATUS_MAP[reportStatus] : null;

    const renderRow = (item: ReportItem, idx: number) => {
        const si = getStatusInfo(item.status);
        const hasDiff = item.diff !== null && item.diff !== 0;
        const isExpanded = expandedId === item.id;
        const res = item.resolution || 'PENDING';
        const resCfg = RESOLUTION_CONFIG[res as DiscrepancyResolution] || RESOLUTION_CONFIG.PENDING;

        return (
            <React.Fragment key={item.id}>
                <tr
                    className={`sp-row ${hasDiff ? 'sp-row--issue' : ''} ${isExpanded ? 'sp-row--expanded' : ''}`}
                    onClick={() => hasDiff ? setExpandedId(prev => prev === item.id ? null : item.id) : undefined}
                    style={{ cursor: hasDiff ? 'pointer' : 'default' }}
                >
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
                        fontWeight: hasDiff ? 800 : 400,
                    }}>
                        {item.diff !== null ? (item.diff > 0 ? `+${item.diff}` : item.diff) : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                        <span className="sp-status-badge" style={{ background: si.bg, color: si.color }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{si.icon}</span>
                            {si.label}
                        </span>
                    </td>
                    <td className="sp-cell-note">{item.note || item.diff_reason || ''}</td>
                    <td>
                        {hasDiff ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span
                                    className="sp-res-chip"
                                    style={{ background: resCfg.bg, color: resCfg.color }}
                                    title={resCfg.description}
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{resCfg.icon}</span>
                                    {resCfg.label}
                                </span>
                                {hasDiff && (
                                    <span
                                        className="sp-expand-chevron material-symbols-outlined"
                                        style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }}
                                    >
                                        expand_more
                                    </span>
                                )}
                            </div>
                        ) : (
                            <span style={{ color: '#94a3b8', fontSize: 11 }}>—</span>
                        )}
                    </td>
                </tr>

                {hasDiff && isExpanded && (
                    <tr className="sp-row--action-panel">
                        <td colSpan={8} style={{ padding: 0 }}>
                            <div onClick={e => e.stopPropagation()}>
                                <ItemActionPanel
                                    item={item}
                                    reportId={reportId}
                                    storeId={storeId}
                                    onUpdated={(patch) => handleItemUpdated(item.id, patch)}
                                />
                            </div>
                        </td>
                    </tr>
                )}
            </React.Fragment>
        );
    };

    const renderContent = () => (
        <>
            {resPending > 0 && (
                <div className="sp-notice sp-notice--warn">
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>warning</span>
                    <span>
                        <strong>{resPending}</strong> sản phẩm lệch chưa được phân loại xử lý.
                        Nhấn vào hàng để mở panel xử lý.
                    </span>
                </div>
            )}

            <div className="sp-toolbar">
                <div className="sp-filters">
                    {(['ALL', 'DISCREPANT', 'MISSING', 'OVER', 'MATCHED', 'UNCHECKED'] as const).map(f => {
                        const info = f === 'ALL'
                            ? { label: 'Tất cả', color: '#475569', bg: '#f1f5f9' }
                            : f === 'DISCREPANT'
                                ? { label: 'Lệch', color: '#dc2626', bg: '#fef2f2' }
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

            {filter === 'DISCREPANT' && discrepant.length > 0 && (
                <div className="sp-res-filter-bar">
                    <span className="sp-res-filter-label">Lọc hướng xử lý:</span>
                    <button
                        className={`sp-res-filter-btn ${resFilter === 'ALL' ? 'active' : ''}`}
                        onClick={() => setResFilter('ALL')}
                    >
                        Tất cả
                    </button>
                    {(['PENDING', 'LOST_GOODS', 'MISPLACED', 'STOCK_ADJUSTMENT', 'INPUT_ERROR', 'RETURN_GOODS', 'RESOLVED_INTERNAL'] as DiscrepancyResolution[]).map(r => {
                        const cfg = RESOLUTION_CONFIG[r];
                        const cnt = discrepant.filter(i => i.resolution === r || (!i.resolution && r === 'PENDING')).length;
                        if (cnt === 0) return null;
                        return (
                            <button
                                key={r}
                                className={`sp-res-filter-btn ${resFilter === r ? 'active' : ''}`}
                                style={resFilter === r ? { background: cfg.bg, color: cfg.color, borderColor: cfg.color + '50' } : {}}
                                onClick={() => setResFilter(r)}
                            >
                                {cfg.label} <span className="sp-filter-cnt">{cnt}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            <div className={isInline ? 'sp-content sp-content--inline' : 'sp-content'}>
                {loading ? (
                    <div className="sp-loading">
                        {[1, 2, 3, 4, 5, 6].map(i => (
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
                                    <th style={{ width: '4%' }}>#</th>
                                    <th style={{ width: '32%' }}>Sản phẩm</th>
                                    <th style={{ width: '10%', textAlign: 'center' }}>Hệ thống</th>
                                    <th style={{ width: '10%', textAlign: 'center' }}>Thực tế</th>
                                    <th style={{ width: '8%', textAlign: 'center' }}>Lệch</th>
                                    <th style={{ width: '11%', textAlign: 'center' }}>Trạng thái</th>
                                    <th style={{ width: '10%' }}>Ghi chú NV</th>
                                    <th style={{ width: '15%' }}>Xử lý</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredItems.map((item, idx) => renderRow(item, idx))}
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
                        {discrepant.length > 0 && (
                            <> • <span style={{ color: '#dc2626', fontWeight: 700 }}>{discrepant.length} lệch</span>
                                {resPending > 0 && <> (<span style={{ color: '#d97706' }}>{resPending} chờ phân loại</span>)</>}
                            </>
                        )}
                    </span>
                    {(filter !== 'ALL' || resFilter !== 'ALL' || search) && (
                        <button className="sp-footer-reset" onClick={() => { setFilter('ALL'); setResFilter('ALL'); setSearch(''); }}>
                            Xóa bộ lọc
                        </button>
                    )}
                </div>
            )}
        </>
    );

    /* ── INLINE mode ── */
    if (isInline) {
        return (
            <div className="sp-inline-root">
                <style>{CSS_TEXT}</style>
                {renderContent()}
            </div>
        );
    }

    /* ── PANEL mode ── */
    return (
        <>
            <style>{CSS_TEXT}</style>
            <div
                className={`sp-backdrop ${animateIn ? 'sp-backdrop--visible' : ''}`}
                onClick={handleClose}
                aria-hidden="true"
            />
            <aside
                className={`sp-panel ${animateIn ? 'sp-panel--open' : ''}`}
                role="dialog"
                aria-label={`Chi tiết kiểm kê - ${storeName}`}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
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
                            {[
                                { label: 'Tổng', val: counts.ALL, cls: '' },
                                { label: 'Khớp', val: counts.MATCHED, cls: 'sp-stat--ok' },
                                { label: 'Thiếu', val: counts.MISSING, cls: 'sp-stat--danger' },
                                { label: 'Thừa', val: counts.OVER, cls: 'sp-stat--info' },
                                { label: 'Chờ phân loại', val: resPending, cls: resPending > 0 ? 'sp-stat--warn' : '' },
                            ].map(s => (
                                <div key={s.label} className={`sp-stat ${s.cls}`}>
                                    <span className="sp-stat-val">{s.val}</span>
                                    <span className="sp-stat-label">{s.label}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {renderContent()}
            </aside>
        </>
    );
};

export default ItemsDetailPanel;

const CSS_TEXT = `
.sp-backdrop {
    position:fixed; inset:0; z-index:998;
    background:rgba(15,23,42,.35);
    backdrop-filter:blur(4px);
    opacity:0; transition:opacity .28s cubic-bezier(.4,0,.2,1);
    pointer-events:none;
}
.sp-backdrop--visible { opacity:1; pointer-events:auto; }

.sp-panel {
    position:fixed; top:0; right:0; bottom:0; z-index:999;
    width:min(640px, 92vw);
    background:#fff;
    display:flex; flex-direction:column;
    box-shadow:-20px 0 60px rgba(0,0,0,.12), -4px 0 16px rgba(0,0,0,.06);
    transform:translateX(100%);
    transition:transform .28s cubic-bezier(.4,0,.2,1);
    will-change:transform;
}
.sp-panel--open { transform:translateX(0); }

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
.sp-close-btn:hover { background:#f1f5f9; color:#1e293b; }
.sp-header-info { flex:1; min-width:0; }
.sp-title { margin:0; font-size:18px; font-weight:800; color:#0f172a; }
.sp-meta { display:flex; align-items:center; gap:6px; margin-top:4px; flex-wrap:wrap; }
.sp-meta-item { display:inline-flex; align-items:center; gap:3px; font-size:13px; color:#64748b; font-weight:500; }
.sp-meta-sep { color:#cbd5e1; font-size:10px; }
.sp-report-badge { padding:4px 12px; border-radius:7px; font-size:11px; font-weight:700; white-space:nowrap; align-self:flex-start; margin-top:2px; }

.sp-stats-row { display:flex; gap:2px; padding:12px 0; }
.sp-stat { flex:1; text-align:center; padding:8px 4px; border-radius:10px; background:#f8fafc; }
.sp-stat--ok { background:#f0fdf44d; }
.sp-stat--danger { background:#fef2f24d; }
.sp-stat--info { background:#eef2ff4d; }
.sp-stat--warn { background:#fffbeb4d; }
.sp-stat-val { display:block; font-size:20px; font-weight:800; color:#1e293b; line-height:1.2; }
.sp-stat--ok .sp-stat-val { color:#16a34a; }
.sp-stat--danger .sp-stat-val { color:#dc2626; }
.sp-stat--info .sp-stat-val { color:#4f46e5; }
.sp-stat--warn .sp-stat-val { color:#d97706; }
.sp-stat-label { display:block; font-size:10px; color:#94a3b8; font-weight:600; margin-top:2px; text-transform:uppercase; letter-spacing:.02em; }

.sp-notice {
    display:flex; align-items:center; gap:8px;
    padding:8px 16px; font-size:12px; font-weight:600;
    margin: 8px 24px 0;
    border-radius:8px;
}
.sp-notice--warn { background:#fffbeb; color:#92400e; border:1px solid #fde68a; }

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
.sp-search-input { border:none; outline:none; background:transparent; font-size:12px; width:120px; color:#1e293b; }
.sp-search-clear {
    display:flex; align-items:center; justify-content:center;
    width:18px; height:18px; border:none; background:transparent;
    color:#94a3b8; cursor:pointer; border-radius:50%; transition:all .12s;
}
.sp-search-clear:hover { background:#f1f5f9; color:#475569; }

/* ── Resolution filter bar ── */
.sp-res-filter-bar {
    display:flex; align-items:center; gap:6px; flex-wrap:wrap;
    padding:8px 24px; border-bottom:1px solid #f1f5f9;
    background:#fafbfc;
}
.sp-res-filter-label { font-size:11px; font-weight:600; color:#64748b; white-space:nowrap; }
.sp-res-filter-btn {
    padding:3px 10px; border-radius:6px; font-size:11px; font-weight:600;
    border:1.5px solid transparent;
    background:#f1f5f9; color:#64748b; cursor:pointer; transition:all .15s;
}
.sp-res-filter-btn.active { border-color:currentColor; }

/* ── Content ── */
.sp-content { flex:1; overflow-y:auto; padding:0 24px; }
.sp-content--inline { max-height:420px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:8px; }

/* ── Table ── */
.sp-table-wrap { padding:4px 0 16px; }
.sp-table { width:100%; border-collapse:collapse; font-size:12px; }
.sp-table thead { position:sticky; top:0; z-index:2; }
.sp-table th {
    padding:10px 10px; text-align:left; font-weight:700;
    color:#475569; font-size:11px; text-transform:uppercase;
    letter-spacing:.04em; border-bottom:2px solid #e5e7eb;
    white-space:nowrap; background:#fff;
}
.sp-table td { padding:9px 10px; border-bottom:1px solid #f3f4f6; vertical-align:middle; }
.sp-table tbody tr { transition:background .1s; }
.sp-table tbody tr:hover { background:#f8fafc; }
.sp-row--issue { background:#fffbeb !important; }
.sp-row--issue:hover { background:#fef3c7 !important; }
.sp-row--expanded { background:#f0f9ff !important; }
.sp-row--action-panel td { background:#f8fafc; border-bottom:2px solid #e0e7ff; }

.sp-cell-num { text-align:center; font-variant-numeric:tabular-nums; color:#475569; }
.sp-cell-note { font-size:11px; color:#64748b; max-width:100px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.sp-product { display:flex; flex-direction:column; gap:1px; }
.sp-product-name { font-weight:600; color:#1e293b; line-height:1.3; }
.sp-barcode { font-size:10px; color:#94a3b8; font-family:'Courier New',monospace; }

.sp-status-badge {
    display:inline-flex; align-items:center; gap:3px;
    padding:2px 8px; border-radius:99px;
    font-size:11px; font-weight:700; white-space:nowrap;
}
.sp-res-chip {
    display:inline-flex; align-items:center; gap:3px;
    padding:2px 7px; border-radius:6px;
    font-size:11px; font-weight:600; white-space:nowrap;
    border:1px solid transparent;
}
.sp-expand-chevron {
    font-size:16px; color:#94a3b8;
    transition:transform .2s; cursor:pointer;
}

/* ── Action Panel ── */
.iap-root {
    display:flex; gap:12px; flex-wrap:wrap;
    padding:12px 24px 16px; align-items:flex-start;
}
.iap-field { display:flex; flex-direction:column; gap:5px; min-width:180px; }
.iap-label {
    display:inline-flex; align-items:center; gap:4px;
    font-size:11px; font-weight:700; color:#475569;
    text-transform:uppercase; letter-spacing:.04em;
}
.iap-saving-dot {
    display:inline-block; width:6px; height:6px;
    border-radius:50%; background:#6366f1;
    animation:iapPulse .8s ease infinite;
}
@keyframes iapPulse { 0%,100%{opacity:1} 50%{opacity:.3} }

.iap-select-wrap { position:relative; }
.iap-select {
    width:100%; padding:6px 28px 6px 10px;
    border-radius:8px; border:1.5px solid;
    font-size:12px; font-weight:600; appearance:none;
    outline:none; cursor:pointer;
    transition:all .15s;
}
.iap-select-icon {
    position:absolute; right:8px; top:50%; transform:translateY(-50%);
    font-size:15px; pointer-events:none;
}
.iap-desc { font-size:11px; color:#94a3b8; line-height:1.4; margin:0; }

.iap-field--recheck { border-left:3px solid #d97706; padding-left:10px; }
.iap-date-input {
    padding:6px 10px; border:1.5px solid #e5e7eb; border-radius:8px;
    font-size:12px; font-weight:500; color:#1e293b;
    outline:none; transition:all .15s;
}
.iap-date-input:focus { border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,.1); }
.iap-recheck-done {
    display:inline-flex; align-items:center; gap:4px;
    font-size:11px; color:#16a34a; font-weight:600;
}

.iap-field--recovery { border-left:3px solid #dc2626; padding-left:10px; }
.iap-recovery-done {
    display:inline-flex; align-items:center; gap:6px;
    padding:6px 10px; border-radius:8px;
    background:#f0fdf4; font-size:12px; font-weight:600; color:#16a34a;
}
.iap-recovery-form { display:flex; flex-direction:column; gap:6px; }
.iap-recovery-qty { display:flex; align-items:center; gap:6px; }
.iap-qty-label { font-size:11px; color:#64748b; }
.iap-qty-val { font-size:14px; font-weight:800; color:#dc2626; }
.iap-recovery-price-row { display:flex; align-items:center; gap:8px; }
.iap-price-input {
    width:150px; padding:6px 10px; border:1.5px solid #e5e7eb; border-radius:8px;
    font-size:12px; font-weight:500; outline:none; transition:all .15s;
}
.iap-price-input:focus { border-color:#6366f1; }
.iap-total { font-size:12px; font-weight:700; color:#dc2626; white-space:nowrap; }
.iap-btn-recovery {
    display:inline-flex; align-items:center; gap:5px;
    padding:7px 14px; border-radius:8px; border:none;
    background:linear-gradient(135deg,#dc2626,#b91c1c);
    color:#fff; font-size:12px; font-weight:700;
    cursor:pointer; transition:all .15s;
}
.iap-btn-recovery:hover:not(:disabled) { background:linear-gradient(135deg,#b91c1c,#991b1b); transform:translateY(-1px); }
.iap-btn-recovery:disabled { opacity:.6; cursor:not-allowed; }
.iap-spinner {
    width:14px; height:14px; border:2px solid rgba(255,255,255,.3);
    border-top-color:#fff; border-radius:50%; animation:iapSpin .6s linear infinite;
}
@keyframes iapSpin { to { transform:rotate(360deg); } }

.iap-note {
    padding:6px 10px; border:1.5px solid #e5e7eb; border-radius:8px;
    font-size:12px; color:#1e293b; resize:vertical; min-height:52px;
    outline:none; transition:all .15s; font-family:inherit;
    background:#f8fafc;
}
.iap-note:focus { border-color:#6366f1; background:#fff; box-shadow:0 0 0 3px rgba(99,102,241,.08); }
.iap-note::placeholder { color:#94a3b8; }

/* ── Loading ── */
.sp-loading { display:flex; flex-direction:column; gap:10px; padding:20px 0; }
.sp-skel-row { display:flex; gap:12px; align-items:center; }
.sp-skel { height:14px; background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%); background-size:200% 100%; border-radius:6px; animation:sp-shimmer 1.5s ease-in-out infinite; }
@keyframes sp-shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

/* ── Empty ── */
.sp-empty { display:flex; flex-direction:column; align-items:center; gap:8px; padding:60px 20px; text-align:center; }
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
    font-weight:600; cursor:pointer; padding:4px 8px; border-radius:6px; transition:background .12s;
}
.sp-footer-reset:hover { background:#eef2ff; }

/* Custom scrollbar */
.sp-content::-webkit-scrollbar { width:5px; }
.sp-content::-webkit-scrollbar-track { background:transparent; }
.sp-content::-webkit-scrollbar-thumb { background:#e2e8f0; border-radius:99px; }
.sp-content::-webkit-scrollbar-thumb:hover { background:#cbd5e1; }

/* ── Inline mode ── */
.sp-inline-root { padding:12px 0 4px; }
`;
