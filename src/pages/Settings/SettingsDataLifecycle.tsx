import React, { useState, useEffect } from 'react';
import { ToastContextType } from '../../contexts/ToastContext';
import {
    DataLifecycleService,
    SystemService,
    type ArchiveLogEntry,
    type InventoryHistoryItem,
    type StoreConfig,
} from '../../services/system';
import ConfirmDialog from '../../components/ConfirmDialog';

interface SettingsDataLifecycleProps {
    toast: ToastContextType;
    allStores: StoreConfig[];
}

type ViewMode = 'overview' | 'history';
const SHIFT_LABELS: Record<number, string> = { 1: 'Ca Sáng', 2: 'Ca Chiều', 3: 'Ca Tối' };
const STATUS_COLORS: Record<string, string> = {
    MATCHED: '#22c55e', MISSING: '#ef4444', OVER: '#f59e0b', PENDING: '#94a3b8',
};

export const SettingsDataLifecycle: React.FC<SettingsDataLifecycleProps> = ({ toast, allStores }) => {
    const [viewMode, setViewMode] = useState<ViewMode>('overview');
    const [archiveLogs, setArchiveLogs] = useState<ArchiveLogEntry[]>([]);
    const [history, setHistory] = useState<InventoryHistoryItem[]>([]);
    const [retentionDays, setRetentionDays] = useState(30);
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState<string | null>(null);
    const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

    // History filters
    const [filterStore, setFilterStore] = useState('');
    const [filterFrom, setFilterFrom] = useState('');
    const [filterTo, setFilterTo] = useState('');
    const [historyLoading, setHistoryLoading] = useState(false);

    useEffect(() => {
        loadArchiveLogs();
    }, []);

    const loadArchiveLogs = async () => {
        setLoading(true);
        try {
            const logs = await DataLifecycleService.getArchiveLogs();
            setArchiveLogs(logs);
        } catch (err: unknown) {
            toast.error('Lỗi tải log: ' + (err instanceof Error ? err.message : String(err)));
        } finally {
            setLoading(false);
        }
    };

    const loadHistory = async () => {
        setHistoryLoading(true);
        try {
            const data = await DataLifecycleService.getInventoryHistory(
                filterStore || undefined,
                filterFrom || undefined,
                filterTo || undefined
            );
            setHistory(data);
        } catch (err: unknown) {
            toast.error('Lỗi tải lịch sử: ' + (err instanceof Error ? err.message : String(err)));
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleRunCleanup = () => {
        setConfirmDialog({
            title: 'Xóa dữ liệu ca cũ',
            message: `Xóa tất cả dữ liệu két tiền, nhiệm vụ, vật tư, giao ca của ca đã hoàn thành trước ${retentionDays} ngày. Thao tác không thể hoàn tác!`,
            onConfirm: async () => {
                setConfirmDialog(null);
                setRunning('cleanup');
                try {
                    const result = await DataLifecycleService.runCleanup(retentionDays);
                    if (result.status === 'no_data') {
                        toast.info(result.message || 'Không có dữ liệu cần xóa');
                    } else {
                        const d = result.deleted || {};
                        toast.success(`Đã xóa: ${d.shifts || 0} ca, ${d.cash_settlements || 0} két, ${d.checklist_responses || 0} nhiệm vụ, ${d.asset_checks || 0} vật tư`);
                    }
                } catch (err: unknown) {
                    toast.error('Lỗi: ' + (err instanceof Error ? err.message : String(err)));
                } finally {
                    setRunning(null);
                }
            },
        });
    };

    const handleRunArchive = () => {
        setConfirmDialog({
            title: 'Lưu trữ kiểm tồn cũ',
            message: `Chuyển dữ liệu kiểm tồn trước ${retentionDays} ngày vào kho lưu trữ (inventory_history). Dữ liệu vẫn có thể xem lại.`,
            onConfirm: async () => {
                setConfirmDialog(null);
                setRunning('archive');
                try {
                    const result = await DataLifecycleService.runArchive(retentionDays);
                    if (result.status === 'no_data') {
                        toast.info(result.message || 'Không có dữ liệu cần lưu trữ');
                    } else {
                        toast.success(`Đã lưu trữ ${result.items_archived || 0} bản ghi từ ${result.dates_processed || 0} ngày`);
                    }
                    await loadArchiveLogs();
                } catch (err: unknown) {
                    toast.error('Lỗi: ' + (err instanceof Error ? err.message : String(err)));
                } finally {
                    setRunning(null);
                }
            },
        });
    };

    const formatDate = (d: string) => {
        try {
            return new Date(d).toLocaleDateString('vi-VN');
        } catch {
            return d;
        }
    };

    return (
        <>
            <div className="stg-section-animate">
                {/* Tab toggle */}
                <div className="stg-toolbar" style={{ marginBottom: 16 }}>
                    <div className="stg-toolbar-left" style={{ gap: 8 }}>
                        <button
                            className={`stg-btn ${viewMode === 'overview' ? 'stg-btn-primary' : ''}`}
                            onClick={() => setViewMode('overview')}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>auto_delete</span>
                            Quản Lý Dữ Liệu
                        </button>
                        <button
                            className={`stg-btn ${viewMode === 'history' ? 'stg-btn-primary' : ''}`}
                            onClick={() => { setViewMode('history'); if (!history.length) loadHistory(); }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>history</span>
                            Lịch Sử Kiểm Tồn
                        </button>
                    </div>
                </div>

                {viewMode === 'overview' ? (
                    <>
                        {/* Cron Info */}
                        <div style={{
                            padding: '12px 16px', borderRadius: 8, marginBottom: 16,
                            background: 'var(--stg-bg-success, #f0fdf4)',
                            border: '1px solid var(--stg-border-success, #bbf7d0)',
                            display: 'flex', alignItems: 'center', gap: 10
                        }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#22c55e' }}>schedule</span>
                            <div>
                                <strong style={{ fontSize: 13 }}>Tự động chạy lúc 2:00 AM hàng ngày</strong>
                                <div style={{ fontSize: 12, color: 'var(--stg-text-muted)', marginTop: 2 }}>
                                    Két + nhiệm vụ: xóa sau 30 ngày &nbsp;·&nbsp; Kiểm tồn: lưu trữ sau 30 ngày
                                </div>
                            </div>
                        </div>

                        {/* Retention config + Actions */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                            {/* Cleanup Card */}
                            <div style={{
                                padding: 20, borderRadius: 12,
                                background: 'var(--stg-surface, #fff)',
                                border: '1px solid var(--stg-border, #e5e7eb)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 24, color: '#ef4444' }}>delete_sweep</span>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 15 }}>Xóa Két + Nhiệm Vụ</div>
                                        <div style={{ fontSize: 12, color: 'var(--stg-text-muted)' }}>Xóa vĩnh viễn dữ liệu cũ</div>
                                    </div>
                                </div>
                                <div style={{ fontSize: 13, color: 'var(--stg-text-secondary)', marginBottom: 14, lineHeight: 1.6 }}>
                                    Xóa <strong>cash_settlements</strong>, <strong>checklist_responses</strong>,
                                    <strong> shift_asset_checks</strong>, <strong>shift_inventory_handover</strong>,
                                    <strong> shift_quick_reports</strong> của ca đã hoàn thành.
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <label style={{ fontSize: 13, whiteSpace: 'nowrap' }}>Giữ lại:</label>
                                    <input
                                        type="number"
                                        className="stg-input"
                                        style={{ width: 70, textAlign: 'center' }}
                                        value={retentionDays}
                                        onChange={e => setRetentionDays(Math.max(7, parseInt(e.target.value) || 30))}
                                        min={7}
                                    />
                                    <span style={{ fontSize: 13 }}>ngày</span>
                                    <div style={{ flex: 1 }} />
                                    <button
                                        className="stg-btn stg-btn-danger"
                                        onClick={handleRunCleanup}
                                        disabled={running !== null}
                                    >
                                        {running === 'cleanup' ? (
                                            <span className="material-symbols-outlined stg-spin" style={{ fontSize: 16 }}>progress_activity</span>
                                        ) : (
                                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete_sweep</span>
                                        )}
                                        Xóa ngay
                                    </button>
                                </div>
                            </div>

                            {/* Archive Card */}
                            <div style={{
                                padding: 20, borderRadius: 12,
                                background: 'var(--stg-surface, #fff)',
                                border: '1px solid var(--stg-border, #e5e7eb)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 24, color: '#3b82f6' }}>archive</span>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 15 }}>Lưu Trữ Kiểm Tồn</div>
                                        <div style={{ fontSize: 12, color: 'var(--stg-text-muted)' }}>Chuyển vào kho lịch sử</div>
                                    </div>
                                </div>
                                <div style={{ fontSize: 13, color: 'var(--stg-text-secondary)', marginBottom: 14, lineHeight: 1.6 }}>
                                    Di chuyển <strong>inventory_items</strong> cũ sang <strong>inventory_history</strong>.
                                    Dữ liệu vẫn có thể xem lại và truy thu trong tab <em>Lịch Sử Kiểm Tồn</em>.
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <label style={{ fontSize: 13, whiteSpace: 'nowrap' }}>Giữ lại:</label>
                                    <input
                                        type="number"
                                        className="stg-input"
                                        style={{ width: 70, textAlign: 'center' }}
                                        value={retentionDays}
                                        onChange={e => setRetentionDays(Math.max(7, parseInt(e.target.value) || 30))}
                                        min={7}
                                    />
                                    <span style={{ fontSize: 13 }}>ngày</span>
                                    <div style={{ flex: 1 }} />
                                    <button
                                        className="stg-btn stg-btn-primary"
                                        onClick={handleRunArchive}
                                        disabled={running !== null}
                                    >
                                        {running === 'archive' ? (
                                            <span className="material-symbols-outlined stg-spin" style={{ fontSize: 16 }}>progress_activity</span>
                                        ) : (
                                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>archive</span>
                                        )}
                                        Lưu trữ ngay
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Archive log table */}
                        <div className="stg-table-wrap">
                            <div className="stg-toolbar">
                                <div className="stg-toolbar-left">
                                    <span className="stg-badge">{archiveLogs.length} bản ghi</span>
                                    <span style={{ fontSize: 12, color: 'var(--stg-text-muted)' }}>
                                        Lịch sử lưu trữ kiểm tồn
                                    </span>
                                </div>
                                <div className="stg-toolbar-right">
                                    <button className="stg-btn" onClick={loadArchiveLogs} disabled={loading}>
                                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
                                        Làm mới
                                    </button>
                                </div>
                            </div>

                            <table className="stg-table stg-table-fixed">
                                <colgroup>
                                    <col style={{ width: '20%' }} />
                                    <col style={{ width: '15%' }} />
                                    <col style={{ width: '15%' }} />
                                    <col style={{ width: '15%' }} />
                                    <col style={{ width: '20%' }} />
                                    <col style={{ width: '15%' }} />
                                </colgroup>
                                <thead>
                                    <tr>
                                        <th>NGÀY</th>
                                        <th style={{ textAlign: 'center' }}>SỐ ITEMS</th>
                                        <th style={{ textAlign: 'center' }}>SỐ CỬA HÀNG</th>
                                        <th style={{ textAlign: 'center' }}>TRẠNG THÁI</th>
                                        <th>LƯU TRỮ LÚC</th>
                                        <th>NGUỒN</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--stg-text-muted)' }}>Đang tải...</td></tr>
                                    ) : archiveLogs.length === 0 ? (
                                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--stg-text-muted)' }}>
                                            Chưa có bản lưu trữ nào
                                        </td></tr>
                                    ) : archiveLogs.map(log => (
                                        <tr key={log.id} className="stg-table-row">
                                            <td style={{ fontWeight: 600 }}>{formatDate(log.archive_date)}</td>
                                            <td style={{ textAlign: 'center', fontWeight: 600 }}>{log.total_items}</td>
                                            <td style={{ textAlign: 'center' }}>{log.total_stores}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span style={{
                                                    padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                                                    background: log.status === 'ARCHIVED' ? '#dbeafe' : log.status === 'PURGED' ? '#fef3c7' : '#fee2e2',
                                                    color: log.status === 'ARCHIVED' ? '#2563eb' : log.status === 'PURGED' ? '#d97706' : '#dc2626',
                                                }}>
                                                    {log.status}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: 12, color: 'var(--stg-text-muted)' }}>
                                                {new Date(log.archived_at).toLocaleString('vi-VN')}
                                            </td>
                                            <td style={{ fontSize: 12, color: 'var(--stg-text-muted)' }}>
                                                {(log.metadata as Record<string, string>)?.source === 'auto_archive' ? 'Tự động' : 'Thủ công'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                ) : (
                    /* ─── Inventory History View ─── */
                    <>
                        {/* Filters */}
                        <div className="stg-toolbar" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                            <div className="stg-toolbar-left" style={{ gap: 8, flexWrap: 'wrap' }}>
                                <select
                                    className="stg-input"
                                    value={filterStore}
                                    onChange={e => setFilterStore(e.target.value)}
                                    style={{ width: 180 }}
                                >
                                    <option value="">Tất cả cửa hàng</option>
                                    {allStores.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                                <input
                                    type="date"
                                    className="stg-input"
                                    value={filterFrom}
                                    onChange={e => setFilterFrom(e.target.value)}
                                    style={{ width: 150 }}
                                    placeholder="Từ ngày"
                                />
                                <span style={{ fontSize: 12, color: 'var(--stg-text-muted)' }}>→</span>
                                <input
                                    type="date"
                                    className="stg-input"
                                    value={filterTo}
                                    onChange={e => setFilterTo(e.target.value)}
                                    style={{ width: 150 }}
                                    placeholder="Đến ngày"
                                />
                            </div>
                            <div className="stg-toolbar-right">
                                <button className="stg-btn stg-btn-primary" onClick={loadHistory} disabled={historyLoading}>
                                    {historyLoading ? (
                                        <span className="material-symbols-outlined stg-spin" style={{ fontSize: 16 }}>progress_activity</span>
                                    ) : (
                                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>search</span>
                                    )}
                                    Tìm kiếm
                                </button>
                            </div>
                        </div>

                        {/* History table */}
                        <div className="stg-table-wrap">
                            <div className="stg-toolbar">
                                <div className="stg-toolbar-left">
                                    <span className="stg-badge">{history.length} bản ghi</span>
                                    <span style={{ fontSize: 12, color: 'var(--stg-text-muted)' }}>
                                        Dữ liệu kiểm tồn đã lưu trữ (có thể truy thu)
                                    </span>
                                </div>
                            </div>

                            <table className="stg-table stg-table-fixed">
                                <colgroup>
                                    <col style={{ width: '12%' }} />
                                    <col style={{ width: '12%' }} />
                                    <col style={{ width: '10%' }} />
                                    <col style={{ width: '22%' }} />
                                    <col style={{ width: '10%' }} />
                                    <col style={{ width: '10%' }} />
                                    <col style={{ width: '10%' }} />
                                    <col style={{ width: '14%' }} />
                                </colgroup>
                                <thead>
                                    <tr>
                                        <th>NGÀY</th>
                                        <th>CỬA HÀNG</th>
                                        <th>CA</th>
                                        <th>SẢN PHẨM</th>
                                        <th style={{ textAlign: 'center' }}>HỆ THỐNG</th>
                                        <th style={{ textAlign: 'center' }}>THỰC TẾ</th>
                                        <th style={{ textAlign: 'center' }}>CHÊNH LỆCH</th>
                                        <th style={{ textAlign: 'center' }}>TRẠNG THÁI</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {historyLoading ? (
                                        <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--stg-text-muted)' }}>Đang tải...</td></tr>
                                    ) : history.length === 0 ? (
                                        <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--stg-text-muted)' }}>
                                            Chưa có dữ liệu lịch sử. Chọn bộ lọc và bấm Tìm kiếm.
                                        </td></tr>
                                    ) : history.map(item => (
                                        <tr key={item.id} className="stg-table-row">
                                            <td style={{ fontWeight: 600 }}>{formatDate(item.check_date)}</td>
                                            <td style={{ fontSize: 13 }}>{item.store?.name || '—'}</td>
                                            <td style={{ fontSize: 13 }}>{SHIFT_LABELS[item.shift] || `Ca ${item.shift}`}</td>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{item.product?.name || '—'}</div>
                                                <div style={{ fontSize: 11, color: 'var(--stg-text-muted)', fontFamily: 'monospace' }}>
                                                    {item.product?.barcode || ''}
                                                </div>
                                            </td>
                                            <td style={{ textAlign: 'center', fontWeight: 600 }}>{item.system_stock}</td>
                                            <td style={{ textAlign: 'center', fontWeight: 600 }}>{item.actual_stock ?? '—'}</td>
                                            <td style={{
                                                textAlign: 'center', fontWeight: 700,
                                                color: (item.diff || 0) < 0 ? '#ef4444' : (item.diff || 0) > 0 ? '#f59e0b' : '#22c55e'
                                            }}>
                                                {item.diff != null ? (item.diff > 0 ? `+${item.diff}` : item.diff) : '—'}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span style={{
                                                    padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                                                    background: `${STATUS_COLORS[item.status] || '#94a3b8'}22`,
                                                    color: STATUS_COLORS[item.status] || '#94a3b8',
                                                }}>
                                                    {item.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>

            {confirmDialog && (
                <ConfirmDialog
                    title={confirmDialog.title}
                    message={confirmDialog.message}
                    onConfirm={confirmDialog.onConfirm}
                    onCancel={() => setConfirmDialog(null)}
                />
            )}
        </>
    );
};
