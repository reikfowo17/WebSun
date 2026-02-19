import React, { useState, useEffect } from 'react';
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

interface ItemsDetailPanelProps {
    storeId: string;
    checkDate: string;
    shift: number;
    isOpen: boolean;
    onClose?: () => void;
    /** inline = renders inside card; modal = renders as overlay */
    mode?: 'inline' | 'modal';
}

/* ── Status helpers ── */
const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    MATCHED: { label: 'Khớp', color: '#16a34a', bg: '#f0fdf4', icon: 'check_circle' },
    MISSING: { label: 'Thiếu', color: '#dc2626', bg: '#fef2f2', icon: 'remove_circle' },
    OVER: { label: 'Thừa', color: '#4f46e5', bg: '#eef2ff', icon: 'add_circle' },
    UNCHECKED: { label: 'Chưa kiểm', color: '#94a3b8', bg: '#f8fafc', icon: 'radio_button_unchecked' },
};

const getStatusInfo = (s: string) => STATUS_MAP[s] || STATUS_MAP.UNCHECKED;

const ItemsDetailPanel: React.FC<ItemsDetailPanelProps> = ({
    storeId, checkDate, shift, isOpen, onClose, mode = 'inline'
}) => {
    const [items, setItems] = useState<ReportItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState<string>('ALL');
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (!isOpen || !storeId || !checkDate) return;
        let cancelled = false;
        setLoading(true);
        InventoryService.getReportItems(storeId, checkDate, shift).then(res => {
            if (cancelled) return;
            if (res.success && res.items) setItems(res.items);
            setLoading(false);
        });
        return () => { cancelled = true; };
    }, [isOpen, storeId, checkDate, shift]);

    if (!isOpen) return null;

    /* ── Filter & search ── */
    const filteredItems = items.filter(item => {
        if (filter !== 'ALL' && item.status !== filter) return false;
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
        UNCHECKED: items.filter(i => i.status === 'UNCHECKED').length,
    };

    const content = (
        <div className="idp-container">
            <style>{CSS_TEXT}</style>

            {/* ── Toolbar ── */}
            <div className="idp-toolbar">
                <div className="idp-filters">
                    {(['ALL', 'MISSING', 'OVER', 'MATCHED', 'UNCHECKED'] as const).map(f => {
                        const info = f === 'ALL'
                            ? { label: 'Tất cả', color: '#475569', bg: '#f1f5f9' }
                            : getStatusInfo(f);
                        return (
                            <button
                                key={f}
                                className={`idp-filter-btn ${filter === f ? 'active' : ''}`}
                                style={filter === f ? { background: info.bg, color: info.color, borderColor: info.color + '40' } : {}}
                                onClick={() => setFilter(f)}
                            >
                                {info.label}
                                <span className="idp-filter-count">{counts[f]}</span>
                            </button>
                        );
                    })}
                </div>
                <div className="idp-search">
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#94a3b8' }}>search</span>
                    <input
                        type="text"
                        placeholder="Tìm sản phẩm..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="idp-search-input"
                    />
                </div>
            </div>

            {/* ── Loading ── */}
            {loading ? (
                <div className="idp-loading">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="idp-skeleton-row">
                            <div className="idp-skel" style={{ width: '40%' }} />
                            <div className="idp-skel" style={{ width: '15%' }} />
                            <div className="idp-skel" style={{ width: '15%' }} />
                            <div className="idp-skel" style={{ width: '10%' }} />
                        </div>
                    ))}
                </div>
            ) : filteredItems.length === 0 ? (
                <div className="idp-empty">
                    <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#cbd5e1' }}>
                        {search ? 'search_off' : 'inventory_2'}
                    </span>
                    <span>{search ? 'Không tìm thấy sản phẩm' : 'Không có sản phẩm'}</span>
                </div>
            ) : (
                /* ── Items Table ── */
                <div className="idp-table-wrap">
                    <table className="idp-table">
                        <thead>
                            <tr>
                                <th style={{ width: '4%' }}>#</th>
                                <th style={{ width: '36%' }}>Sản phẩm</th>
                                <th style={{ width: '12%', textAlign: 'center' }}>Hệ thống</th>
                                <th style={{ width: '12%', textAlign: 'center' }}>Thực tế</th>
                                <th style={{ width: '10%', textAlign: 'center' }}>Lệch</th>
                                <th style={{ width: '14%', textAlign: 'center' }}>Trạng thái</th>
                                <th style={{ width: '12%' }}>Ghi chú</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredItems.map((item, idx) => {
                                const si = getStatusInfo(item.status);
                                const hasDiff = item.diff !== null && item.diff !== 0;
                                return (
                                    <tr key={item.id} className={hasDiff ? 'idp-row-issue' : ''}>
                                        <td className="idp-cell-num">{idx + 1}</td>
                                        <td>
                                            <div className="idp-product">
                                                <span className="idp-product-name">{item.product_name}</span>
                                                {item.barcode && <span className="idp-barcode">{item.barcode}</span>}
                                            </div>
                                        </td>
                                        <td className="idp-cell-num">{item.system_stock}</td>
                                        <td className="idp-cell-num" style={{ fontWeight: 700 }}>
                                            {item.actual_stock !== null ? item.actual_stock : '—'}
                                        </td>
                                        <td className="idp-cell-num" style={{
                                            color: hasDiff ? si.color : '#94a3b8',
                                            fontWeight: hasDiff ? 800 : 400
                                        }}>
                                            {item.diff !== null ? (item.diff > 0 ? `+${item.diff}` : item.diff) : '—'}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span className="idp-status-badge" style={{ background: si.bg, color: si.color }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{si.icon}</span>
                                                {si.label}
                                            </span>
                                        </td>
                                        <td className="idp-cell-note">
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
    );

    if (mode === 'modal') {
        return (
            <div className="idp-overlay" onClick={onClose}>
                <div className="idp-modal" onClick={e => e.stopPropagation()}>
                    <div className="idp-modal-header">
                        <h3>Chi tiết kiểm kê — Ca {shift}</h3>
                        <button className="idp-close-btn" onClick={onClose}>
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                    {content}
                </div>
            </div>
        );
    }

    return content;
};

export default ItemsDetailPanel;

const CSS_TEXT = `
/* Container */
.idp-container { display:flex; flex-direction:column; gap:8px; }

/* Toolbar */
.idp-toolbar { display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; padding:8px 0; }
.idp-filters { display:flex; gap:4px; flex-wrap:wrap; }
.idp-filter-btn {
    display:inline-flex; align-items:center; gap:4px;
    padding:4px 10px; border-radius:6px;
    font-size:12px; font-weight:600;
    border:1.5px solid transparent;
    background:#f8fafc; color:#64748b;
    cursor:pointer; transition:all .15s;
}
.idp-filter-btn:hover { background:#f1f5f9; }
.idp-filter-btn.active { border-color:currentColor; }
.idp-filter-count { font-size:11px; opacity:.7; font-weight:700; }

/* Search */
.idp-search {
    display:flex; align-items:center; gap:6px;
    padding:4px 10px; border-radius:8px;
    background:#f8fafc; border:1.5px solid #e2e8f0;
    transition:border-color .15s;
}
.idp-search:focus-within { border-color:#6366f1; }
.idp-search-input {
    border:none; outline:none; background:transparent;
    font-size:12px; width:140px; color:#1e293b;
}

/* Table */
.idp-table-wrap { overflow-x:auto; border-radius:8px; border:1px solid #e2e8f0; }
.idp-table { width:100%; border-collapse:collapse; font-size:12px; }
.idp-table thead { background:#f8fafc; position:sticky; top:0; z-index:1; }
.idp-table th {
    padding:8px 10px; text-align:left; font-weight:700;
    color:#475569; font-size:11px; text-transform:uppercase;
    letter-spacing:.3px; border-bottom:2px solid #e2e8f0;
    white-space:nowrap;
}
.idp-table td { padding:7px 10px; border-bottom:1px solid #f1f5f9; vertical-align:middle; }
.idp-table tbody tr { transition:background .1s; }
.idp-table tbody tr:hover { background:#f8fafc; }
.idp-row-issue { background:#fffbeb !important; }
.idp-row-issue:hover { background:#fef3c7 !important; }

.idp-cell-num { text-align:center; font-variant-numeric:tabular-nums; color:#475569; }
.idp-cell-note { font-size:11px; color:#64748b; max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

/* Product cell */
.idp-product { display:flex; flex-direction:column; gap:1px; }
.idp-product-name { font-weight:600; color:#1e293b; line-height:1.3; }
.idp-barcode { font-size:10px; color:#94a3b8; font-family:monospace; }

/* Status badge */
.idp-status-badge {
    display:inline-flex; align-items:center; gap:3px;
    padding:2px 8px; border-radius:99px;
    font-size:11px; font-weight:700;
    white-space:nowrap;
}

/* Loading skeleton */
.idp-loading { display:flex; flex-direction:column; gap:8px; padding:12px 0; }
.idp-skeleton-row { display:flex; gap:12px; }
.idp-skel { height:14px; background:#f1f5f9; border-radius:4px; animation:idp-shimmer 1.2s ease-in-out infinite alternate; }
@keyframes idp-shimmer { 0%{opacity:.5} 100%{opacity:1} }

/* Empty */
.idp-empty {
    display:flex; flex-direction:column; align-items:center; gap:8px;
    padding:32px 16px; color:#94a3b8; font-size:13px; font-weight:600;
}

/* Modal overlay */
.idp-overlay {
    position:fixed; inset:0; z-index:9999;
    background:rgba(15,23,42,.5); backdrop-filter:blur(4px);
    display:flex; align-items:center; justify-content:center;
    padding:20px;
}
.idp-modal {
    background:#fff; border-radius:16px; width:100%; max-width:900px;
    max-height:85vh; display:flex; flex-direction:column;
    box-shadow:0 25px 50px rgba(0,0,0,.15);
    overflow:hidden;
}
.idp-modal-header {
    display:flex; align-items:center; justify-content:space-between;
    padding:16px 20px; border-bottom:1px solid #e2e8f0;
}
.idp-modal-header h3 { margin:0; font-size:16px; font-weight:800; color:#1e293b; }
.idp-close-btn {
    width:32px; height:32px; border-radius:8px; border:none;
    background:transparent; cursor:pointer; display:flex;
    align-items:center; justify-content:center; color:#64748b;
    transition:all .15s;
}
.idp-close-btn:hover { background:#f1f5f9; color:#1e293b; }
.idp-modal .idp-container { padding:16px 20px; overflow-y:auto; flex:1; }
.idp-modal .idp-table-wrap { max-height:50vh; overflow-y:auto; }
`;
