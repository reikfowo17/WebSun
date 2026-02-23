import React, { useState, useEffect } from 'react';
import { RecoveryService } from '../../services/recovery';
import type { RecoveryItem, RecoveryStatus, RecoveryStats } from '../../types/recovery';
import AddRecoveryModal from './components/AddRecoveryModal';
import RecoveryDetailModal from './components/RecoveryDetailModal';
import RecoveryScanModal from './components/RecoveryScanModal';
import ArchiveStatusPanel from './components/ArchiveStatusPanel';

interface RecoveryViewProps {
    toast: any;
    date: string;
}

/* ── Status Config ── */
const STATUS_CFG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
    PENDING: { label: 'Chờ duyệt', bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' },
    APPROVED: { label: 'Đã duyệt', bg: '#dbeafe', text: '#1e40af', dot: '#3b82f6' },
    IN_PROGRESS: { label: 'Đang thu', bg: '#f3e8ff', text: '#6b21a8', dot: '#a855f7' },
    RECOVERED: { label: 'Đã thu', bg: '#d1fae5', text: '#065f46', dot: '#10b981' },
    REJECTED: { label: 'Từ chối', bg: '#fef2f2', text: '#991b1b', dot: '#ef4444' },
    CANCELLED: { label: 'Hủy', bg: '#f3f4f6', text: '#374151', dot: '#6b7280' },
};

const getStatus = (s: RecoveryStatus) => STATUS_CFG[s] || STATUS_CFG.PENDING;
const formatCurrency = (n: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
const formatDate = (d: string) => new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const RecoveryView: React.FC<RecoveryViewProps> = ({ toast, date }) => {
    const [items, setItems] = useState<RecoveryItem[]>([]);
    const [filteredItems, setFilteredItems] = useState<RecoveryItem[]>([]);
    const [stats, setStats] = useState<RecoveryStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState<RecoveryStatus | 'ALL'>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<RecoveryItem | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showScanModal, setShowScanModal] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'archive'>('list');

    useEffect(() => { loadRecoveryItems(); loadStats(); }, []);

    useEffect(() => {
        let filtered = items;
        if (selectedStatus !== 'ALL') filtered = filtered.filter(i => i.status === selectedStatus);
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(i =>
                i.product_name?.toLowerCase().includes(q) ||
                i.barcode?.toLowerCase().includes(q) ||
                i.reason?.toLowerCase().includes(q)
            );
        }
        setFilteredItems(filtered);
    }, [items, selectedStatus, searchQuery]);

    const loadRecoveryItems = async () => {
        setLoading(true);
        try { const d = await RecoveryService.getRecoveryItems(); setItems(d); setFilteredItems(d); }
        catch { toast.error('Không thể tải danh sách truy thu'); }
        finally { setLoading(false); }
    };

    const loadStats = async () => {
        try { setStats(await RecoveryService.getStats()); } catch { }
    };

    const handleAddSuccess = () => { setShowAddModal(false); loadRecoveryItems(); loadStats(); toast.success('Đã tạo phiếu truy thu thành công!'); };
    const handleViewDetail = (item: RecoveryItem) => { setSelectedItem(item); setShowDetailModal(true); };
    const handleDetailClose = (refresh?: boolean) => { setShowDetailModal(false); setSelectedItem(null); if (refresh) { loadRecoveryItems(); loadStats(); } };

    /* ── Render ── */
    return (
        <>
            <style>{CSS_TEXT}</style>
            <div className="rv-root">

                {/* ───── Summary Strip ───── */}
                {stats && (
                    <div className="rv-summary">
                        <StatCard icon="description" iconBg="#eef2ff" iconColor="#6366f1" label="Tổng phiếu" value={stats.total_items} />
                        <StatCard icon="payments" iconBg="#f3e8ff" iconColor="#a855f7" label="Tổng tiền" value={formatCurrency(stats.total_amount)} />
                        <StatCard icon="check_circle" iconBg="#d1fae5" iconColor="#10b981" label="Đã thu" value={formatCurrency(stats.recovered_amount)} />
                        <StatCard icon="pending" iconBg="#fef3c7" iconColor="#f59e0b" label="Chờ duyệt" value={stats.pending_count} />
                    </div>
                )}

                {/* ───── Toolbar ───── */}
                <div className="rv-toolbar-card">
                    <div className="rv-toolbar">
                        {/* Search */}
                        <div className="rv-search">
                            <span className="material-symbols-outlined rv-search-icon">search</span>
                            <input
                                className="rv-search-input"
                                placeholder="Tìm theo tên, mã vạch, lý do..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button className="rv-search-clear" onClick={() => setSearchQuery('')}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                                </button>
                            )}
                        </div>

                        {/* Status Filter Chips */}
                        <div className="rv-chips">
                            {(['ALL', 'PENDING', 'APPROVED', 'IN_PROGRESS', 'RECOVERED', 'REJECTED', 'CANCELLED'] as const).map(s => (
                                <button
                                    key={s}
                                    className={`rv-chip ${selectedStatus === s ? 'active' : ''}`}
                                    onClick={() => setSelectedStatus(s)}
                                >
                                    {s === 'ALL' ? 'Tất cả' : STATUS_CFG[s]?.label || s}
                                </button>
                            ))}
                        </div>

                        {/* Actions */}
                        <div className="rv-toolbar-actions">
                            <button className="rv-btn-scan" onClick={() => setShowScanModal(true)}>
                                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>history</span>
                                Quét lịch sử
                            </button>
                            <button className="rv-btn-archive" onClick={() => setViewMode(viewMode === 'list' ? 'archive' : 'list')}>
                                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{viewMode === 'list' ? 'cloud' : 'list'}</span>
                                {viewMode === 'list' ? 'Lưu trữ' : 'Danh sách'}
                            </button>
                            <button className="rv-btn-refresh" onClick={() => { loadRecoveryItems(); loadStats(); }} disabled={loading}>
                                <span className={`material-symbols-outlined ${loading ? 'rv-spin' : ''}`} style={{ fontSize: 18 }}>refresh</span>
                                Làm mới
                            </button>
                            <button className="rv-btn-create" onClick={() => setShowAddModal(true)}>
                                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
                                Tạo phiếu truy thu
                            </button>
                        </div>
                    </div>
                </div>

                {/* ───── Content Area ───── */}
                {viewMode === 'archive' ? (
                    <ArchiveStatusPanel toast={toast} />
                ) : (
                    <div className="rv-table-card">
                        <div className="rv-table-scroll">
                            {loading && items.length === 0 ? (
                                <div className="rv-loading">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <div key={i} style={{ height: 48, background: '#f8fafc', borderRadius: 8, animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.1}s` }} />
                                    ))}
                                </div>
                            ) : (
                                <table className="rv-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: 50 }}>STT</th>
                                            <th>Sản phẩm</th>
                                            <th style={{ width: 90 }}>Số lượng</th>
                                            <th style={{ width: 120 }}>Đơn giá</th>
                                            <th style={{ width: 130 }}>Tổng tiền</th>
                                            <th>Lý do</th>
                                            <th style={{ width: 110 }}>Trạng thái</th>
                                            <th style={{ width: 150 }}>Ngày tạo</th>
                                            <th style={{ width: 70, textAlign: 'center' }}>Chi tiết</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredItems.length === 0 ? (
                                            <tr><td colSpan={9} className="rv-empty-td">
                                                <div className="rv-empty">
                                                    <div className="rv-empty-icon">
                                                        <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#cbd5e1' }}>inbox</span>
                                                    </div>
                                                    <p className="rv-empty-title">Không có dữ liệu</p>
                                                    <p className="rv-empty-sub">Chưa có phiếu truy thu nào{selectedStatus !== 'ALL' ? ' với trạng thái đã chọn' : ''}</p>
                                                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                                        <button className="rv-empty-btn" onClick={() => setShowAddModal(true)}>
                                                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
                                                            Tạo phiếu mới
                                                        </button>
                                                        <button className="rv-empty-btn rv-empty-btn-scan" onClick={() => setShowScanModal(true)}>
                                                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>history</span>
                                                            Quét lịch sử
                                                        </button>
                                                    </div>
                                                </div>
                                            </td></tr>
                                        ) : filteredItems.map((item, idx) => {
                                            const st = getStatus(item.status);
                                            return (
                                                <tr key={item.id} className="rv-row" onClick={() => handleViewDetail(item)}>
                                                    <td><span className="rv-rownum">{idx + 1}</span></td>
                                                    <td>
                                                        <div className="rv-product-name">{item.product_name}</div>
                                                        {item.barcode && <div className="rv-barcode">{item.barcode}</div>}
                                                    </td>
                                                    <td><span className="rv-qty">{item.quantity}</span></td>
                                                    <td className="rv-money">{formatCurrency(item.unit_price)}</td>
                                                    <td className="rv-money rv-money-bold">{formatCurrency(item.total_amount)}</td>
                                                    <td><div className="rv-reason">{item.reason}</div></td>
                                                    <td>
                                                        <span className="rv-status" style={{ background: st.bg, color: st.text }}>
                                                            <span className="rv-status-dot" style={{ background: st.dot }} />
                                                            {st.label}
                                                        </span>
                                                    </td>
                                                    <td className="rv-date">{formatDate(item.created_at)}</td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <button className="rv-detail-btn" onClick={e => { e.stopPropagation(); handleViewDetail(item); }}>
                                                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>open_in_new</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        {/* Footer */}
                        <div className="rv-footer">
                            <span>Tổng: <strong>{items.length}</strong> phiếu</span>
                            <span>Hiển thị: <strong>{filteredItems.length}</strong></span>
                        </div>
                    </div>
                )}
            </div>

            {/* ───── Modals ───── */}
            {showAddModal && (
                <AddRecoveryModal toast={toast} onClose={() => setShowAddModal(false)} onSuccess={handleAddSuccess} />
            )}
            {showDetailModal && selectedItem && (
                <RecoveryDetailModal item={selectedItem} toast={toast} onClose={handleDetailClose} />
            )}
            {showScanModal && (
                <RecoveryScanModal
                    toast={toast}
                    onClose={() => setShowScanModal(false)}
                    onRecoveryCreated={() => { setShowScanModal(false); loadRecoveryItems(); loadStats(); }}
                />
            )}
        </>
    );
};

/* ── Stat Card sub-component ── */
const StatCard: React.FC<{ icon: string; iconBg: string; iconColor: string; label: string; value: any }> = ({ icon, iconBg, iconColor, label, value }) => (
    <div className="rv-stat-card">
        <div className="rv-stat-icon" style={{ background: iconBg }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: iconColor }}>{icon}</span>
        </div>
        <div>
            <div className="rv-stat-label">{label}</div>
            <div className="rv-stat-val">{value}</div>
        </div>
    </div>
);

export default RecoveryView;

/* ══════ CSS ══════ */
const CSS_TEXT = `
.rv-root { display:flex; flex-direction:column; gap:16px; padding-top:20px; height:calc(100vh - 140px); min-height:0; }

/* Summary */
.rv-summary { display:flex; gap:12px; flex-shrink:0; overflow-x:auto; }
.rv-stat-card { display:flex; align-items:center; gap:12px; padding:14px 20px; background:#fff; border-radius:14px; border:1px solid #e5e7eb; min-width:140px; flex:1 0 auto; transition:box-shadow .25s,border-color .25s; }
.rv-stat-card:hover { box-shadow:0 4px 16px -4px rgba(0,0,0,.07); border-color:#c7d2fe; }
.rv-stat-icon { width:38px; height:38px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.rv-stat-label { font-size:11px; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:.04em; }
.rv-stat-val { font-size:18px; font-weight:800; color:#1e293b; line-height:1.2; white-space:nowrap; }

/* Toolbar Card */
.rv-toolbar-card { background:#fff; border-radius:16px; border:1px solid #e5e7eb; padding:14px 18px; flex-shrink:0; transition:box-shadow .25s; }
.rv-toolbar-card:hover { box-shadow:0 4px 20px -4px rgba(0,0,0,.06); }
.rv-toolbar { display:flex; align-items:center; gap:14px; flex-wrap:wrap; }

/* Search */
.rv-search { position:relative; width:260px; flex-shrink:0; }
.rv-search-icon { position:absolute; left:10px; top:50%; transform:translateY(-50%); font-size:18px; color:#94a3b8; pointer-events:none; }
.rv-search-input { width:100%; padding:8px 30px 8px 34px; background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:10px; font-size:13px; outline:none; font-weight:500; color:#334155; transition:border-color .2s,box-shadow .2s; }
.rv-search-input:focus { border-color:#818cf8; box-shadow:0 0 0 3px rgba(99,102,241,.1); }
.rv-search-clear { position:absolute; right:8px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:#94a3b8; display:flex; }

/* Filter Chips */
.rv-chips { display:flex; gap:6px; flex-wrap:wrap; flex:1; }
.rv-chip { padding:6px 14px; border-radius:20px; font-size:11px; font-weight:700; border:1.5px solid #e2e8f0; background:#fff; color:#64748b; cursor:pointer; transition:all .15s; white-space:nowrap; }
.rv-chip:hover { border-color:#a5b4fc; color:#4f46e5; background:#eef2ff; }
.rv-chip.active { background:linear-gradient(135deg,#6366f1,#4f46e5); color:#fff; border-color:#6366f1; box-shadow:0 2px 8px -2px rgba(99,102,241,.35); }

/* Actions */
.rv-toolbar-actions { display:flex; gap:8px; flex-shrink:0; }
.rv-btn-refresh { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; background:#fff; border:1.5px solid #e2e8f0; border-radius:10px; font-size:12px; font-weight:700; color:#64748b; cursor:pointer; transition:all .15s; }
.rv-btn-refresh:hover { border-color:#a5b4fc; color:#4f46e5; background:#eef2ff; }
.rv-btn-create { display:inline-flex; align-items:center; gap:6px; padding:8px 16px; background:linear-gradient(135deg,#6366f1,#4338ca); color:#fff; border:none; border-radius:10px; font-size:12px; font-weight:700; cursor:pointer; box-shadow:0 4px 14px -3px rgba(99,102,241,.4); transition:transform .15s,box-shadow .2s; }
.rv-btn-create:hover { transform:translateY(-1px); box-shadow:0 6px 20px -4px rgba(99,102,241,.5); }
.rv-btn-create:active { transform:scale(.97); }
.rv-btn-scan { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; background:linear-gradient(135deg,#f59e0b,#d97706); color:#fff; border:none; border-radius:10px; font-size:12px; font-weight:700; cursor:pointer; box-shadow:0 4px 14px -3px rgba(245,158,11,.35); transition:transform .15s,box-shadow .2s; }
.rv-btn-scan:hover { transform:translateY(-1px); box-shadow:0 6px 18px -4px rgba(245,158,11,.5); }
.rv-btn-scan:active { transform:scale(.97); }
.rv-btn-archive { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; background:#fff; border:1.5px solid #e2e8f0; border-radius:10px; font-size:12px; font-weight:700; color:#64748b; cursor:pointer; transition:all .15s; }
.rv-btn-archive:hover { border-color:#a5b4fc; color:#4f46e5; background:#eef2ff; }
.rv-empty-btn-scan { background:#fef3c7; color:#92400e; }

/* Table */
.rv-table-card { flex:1; display:flex; flex-direction:column; min-height:0; background:#fff; border-radius:16px; border:1px solid #e5e7eb; overflow:hidden; transition:box-shadow .25s; }
.rv-table-card:hover { box-shadow:0 4px 20px -4px rgba(0,0,0,.06); }
.rv-table-scroll { flex:1; overflow:auto; }
.rv-loading { padding:20px; display:flex; flex-direction:column; gap:8px; }
.rv-table { width:100%; border-collapse:collapse; font-size:13px; }
.rv-table thead th { padding:10px 14px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#64748b; background:#f8fafc; border-bottom:1px solid #e2e8f0; position:sticky; top:0; z-index:5; white-space:nowrap; }
.rv-table tbody td { padding:10px 14px; border-bottom:1px solid #f1f5f9; vertical-align:middle; }
.rv-row { transition:background .12s; cursor:pointer; }
.rv-row:hover { background:#f8fafc; }
.rv-rownum { font-size:11px; font-weight:600; color:#94a3b8; font-family:monospace; }
.rv-product-name { font-size:13px; font-weight:600; color:#1e293b; }
.rv-barcode { font-size:11px; font-family:monospace; color:#94a3b8; margin-top:2px; }
.rv-qty { display:inline-block; padding:2px 10px; background:#eef2ff; color:#4f46e5; border-radius:6px; font-size:12px; font-weight:700; font-family:monospace; }
.rv-money { font-size:12px; color:#475569; font-family:monospace; white-space:nowrap; }
.rv-money-bold { font-weight:700; color:#1e293b; }
.rv-reason { font-size:12px; color:#64748b; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.rv-status { display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:700; white-space:nowrap; }
.rv-status-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
.rv-date { font-size:11px; color:#94a3b8; white-space:nowrap; }
.rv-detail-btn { width:30px; height:30px; border-radius:8px; display:flex; align-items:center; justify-content:center; color:#6366f1; background:transparent; border:none; cursor:pointer; transition:background .15s,transform .1s; }
.rv-detail-btn:hover { background:#eef2ff; transform:scale(1.08); }

/* Empty */
.rv-empty-td { padding:0 !important; }
.rv-empty { display:flex; flex-direction:column; align-items:center; gap:8px; padding:60px 20px; }
.rv-empty-icon { width:64px; height:64px; border-radius:50%; background:#f8fafc; display:flex; align-items:center; justify-content:center; }
.rv-empty-title { font-weight:700; color:#64748b; font-size:14px; margin:0; }
.rv-empty-sub { font-size:12px; color:#94a3b8; margin:0; }
.rv-empty-btn { display:inline-flex; align-items:center; gap:4px; padding:6px 14px; background:#eef2ff; color:#4f46e5; border:none; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer; margin-top:4px; }

/* Footer */
.rv-footer { padding:10px 20px; background:#f8fafc; border-top:1px solid #f1f5f9; font-size:12px; font-weight:500; color:#94a3b8; display:flex; justify-content:space-between; flex-shrink:0; }
.rv-footer strong { color:#1e293b; }

/* Spin */
@keyframes rvSpin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
.rv-spin { animation:rvSpin 1s linear infinite; }

@keyframes shimmer { 0%{opacity:.6} 50%{opacity:1} 100%{opacity:.6} }
`;
