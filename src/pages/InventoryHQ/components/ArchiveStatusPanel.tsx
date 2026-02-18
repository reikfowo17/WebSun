import React, { useState, useEffect, useCallback } from 'react';
import { InventoryArchiveService } from '../../../services/archive';
import type { ArchiveLogEntry } from '../../../services/archive';

interface ArchiveStatusPanelProps {
    toast: any;
}

const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
};

const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

const STATUS_CFG: Record<string, { label: string; bg: string; text: string; icon: string }> = {
    ARCHIVED: { label: 'Đã lưu', bg: '#dbeafe', text: '#1e40af', icon: 'cloud_done' },
    PURGED: { label: 'Đã dọn', bg: '#d1fae5', text: '#065f46', icon: 'delete_sweep' },
    FAILED: { label: 'Lỗi', bg: '#fef2f2', text: '#991b1b', icon: 'error' },
};

const ArchiveStatusPanel: React.FC<ArchiveStatusPanelProps> = ({ toast }) => {
    const [logs, setLogs] = useState<ArchiveLogEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState<{
        totalArchived: number;
        totalPurged: number;
        totalFailed: number;
        oldestArchive: string | null;
        newestArchive: string | null;
        totalFileSize: number;
    } | null>(null);
    const [archivingDate, setArchivingDate] = useState<string>('');
    const [triggerLoading, setTriggerLoading] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [logData, statsData] = await Promise.all([
                InventoryArchiveService.getArchiveLog(),
                InventoryArchiveService.getArchiveStats()
            ]);
            setLogs(logData);
            setStats(statsData);
        } catch { }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleManualArchive = async () => {
        if (!archivingDate) {
            toast.error('Chọn ngày cần lưu trữ');
            return;
        }
        setTriggerLoading(true);
        try {
            const result = await InventoryArchiveService.triggerArchive(archivingDate);
            if (result.success) {
                toast.success(`Đã lưu trữ ngày ${archivingDate}`);
                loadData();
            } else {
                toast.error(result.error || 'Lỗi lưu trữ');
            }
        } catch (e: any) {
            toast.error('Lỗi: ' + e.message);
        } finally {
            setTriggerLoading(false);
        }
    };

    return (
        <>
            <style>{CSS_TEXT}</style>
            <div className="asp-root">
                {/* Stats Strip */}
                {stats && (
                    <div className="asp-stats">
                        <div className="asp-stat">
                            <div className="asp-stat-icon" style={{ background: '#eef2ff' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#6366f1' }}>cloud_upload</span>
                            </div>
                            <div>
                                <div className="asp-stat-label">Đã lưu trữ</div>
                                <div className="asp-stat-val">{stats.totalArchived + stats.totalPurged} ngày</div>
                            </div>
                        </div>
                        <div className="asp-stat">
                            <div className="asp-stat-icon" style={{ background: '#d1fae5' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#10b981' }}>cleaning_services</span>
                            </div>
                            <div>
                                <div className="asp-stat-label">DB đã dọn</div>
                                <div className="asp-stat-val">{stats.totalPurged} ngày</div>
                            </div>
                        </div>
                        <div className="asp-stat">
                            <div className="asp-stat-icon" style={{ background: '#f3e8ff' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#a855f7' }}>hard_drive</span>
                            </div>
                            <div>
                                <div className="asp-stat-label">Dung lượng</div>
                                <div className="asp-stat-val">{formatBytes(stats.totalFileSize)}</div>
                            </div>
                        </div>
                        <div className="asp-stat">
                            <div className="asp-stat-icon" style={{ background: '#fef3c7' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#f59e0b' }}>date_range</span>
                            </div>
                            <div>
                                <div className="asp-stat-label">Khoảng thời gian</div>
                                <div className="asp-stat-val">
                                    {stats.oldestArchive && stats.newestArchive
                                        ? `${formatDate(stats.oldestArchive)} — ${formatDate(stats.newestArchive)}`
                                        : 'Chưa có'
                                    }
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Manual Archive Trigger */}
                <div className="asp-toolbar">
                    <div className="asp-toolbar-left">
                        <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#6366f1' }}>schedule</span>
                        <span className="asp-toolbar-title">Lưu trữ thủ công</span>
                    </div>
                    <div className="asp-toolbar-right">
                        <input
                            type="date"
                            className="asp-date-input"
                            value={archivingDate}
                            onChange={e => setArchivingDate(e.target.value)}
                            max={new Date().toISOString().split('T')[0]}
                        />
                        <button className="asp-archive-btn" disabled={triggerLoading || !archivingDate} onClick={handleManualArchive}>
                            {triggerLoading ? (
                                <span className="material-symbols-outlined asp-spin" style={{ fontSize: 16 }}>progress_activity</span>
                            ) : (
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>cloud_upload</span>
                            )}
                            Lưu trữ
                        </button>
                        <button className="asp-refresh-btn" onClick={loadData} disabled={loading}>
                            <span className={`material-symbols-outlined ${loading ? 'asp-spin' : ''}`} style={{ fontSize: 16 }}>refresh</span>
                        </button>
                    </div>
                </div>

                {/* Log Table */}
                <div className="asp-table-card">
                    <div className="asp-table-scroll">
                        {loading && logs.length === 0 ? (
                            <div className="asp-loading">
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <div key={i} style={{ height: 42, background: '#f8fafc', borderRadius: 8, animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.1}s` }} />
                                ))}
                            </div>
                        ) : logs.length === 0 ? (
                            <div className="asp-empty">
                                <div className="asp-empty-icon">
                                    <span className="material-symbols-outlined" style={{ fontSize: 36, color: '#cbd5e1' }}>cloud_off</span>
                                </div>
                                <p className="asp-empty-title">Chưa có dữ liệu lưu trữ</p>
                                <p className="asp-empty-sub">Hệ thống sẽ tự động lưu trữ hằng đêm khi pg_cron được kích hoạt</p>
                            </div>
                        ) : (
                            <table className="asp-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 120 }}>Ngày</th>
                                        <th style={{ width: 100 }}>Trạng thái</th>
                                        <th style={{ width: 80 }}>SP</th>
                                        <th style={{ width: 50 }}>CH</th>
                                        <th style={{ width: 80 }}>Kích thước</th>
                                        <th>File</th>
                                        <th style={{ width: 130 }}>Lưu lúc</th>
                                        <th style={{ width: 130 }}>Dọn lúc</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map(log => {
                                        const st = STATUS_CFG[log.status] || STATUS_CFG.FAILED;
                                        return (
                                            <tr key={log.id} className="asp-row">
                                                <td className="asp-date-cell">{formatDate(log.archive_date)}</td>
                                                <td>
                                                    <span className="asp-status" style={{ background: st.bg, color: st.text }}>
                                                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{st.icon}</span>
                                                        {st.label}
                                                    </span>
                                                </td>
                                                <td className="asp-center asp-mono">{log.total_items}</td>
                                                <td className="asp-center asp-mono">{log.total_stores}</td>
                                                <td className="asp-mono">{log.file_size_bytes ? formatBytes(log.file_size_bytes) : '—'}</td>
                                                <td className="asp-filepath">{log.file_path}</td>
                                                <td className="asp-time">{new Date(log.archived_at).toLocaleString('vi-VN')}</td>
                                                <td className="asp-time">{log.purged_at ? new Date(log.purged_at).toLocaleString('vi-VN') : '—'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default ArchiveStatusPanel;

/* ══════ CSS ══════ */
const CSS_TEXT = `
.asp-root { display:flex; flex-direction:column; gap:14px; }

/* Stats */
.asp-stats { display:flex; gap:10px; flex-wrap:wrap; }
.asp-stat { display:flex; align-items:center; gap:10px; padding:12px 16px; background:#fff; border-radius:12px; border:1px solid #e5e7eb; flex:1; min-width:160px; transition:box-shadow .2s,border-color .2s; }
.asp-stat:hover { box-shadow:0 4px 14px -4px rgba(0,0,0,.06); border-color:#c7d2fe; }
.asp-stat-icon { width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.asp-stat-label { font-size:10px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:.04em; }
.asp-stat-val { font-size:14px; font-weight:800; color:#1e293b; white-space:nowrap; }

/* Toolbar */
.asp-toolbar { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; background:#fff; border-radius:12px; border:1px solid #e5e7eb; flex-wrap:wrap; gap:10px; }
.asp-toolbar-left { display:flex; align-items:center; gap:8px; }
.asp-toolbar-title { font-size:13px; font-weight:700; color:#1e293b; }
.asp-toolbar-right { display:flex; align-items:center; gap:8px; }
.asp-date-input { padding:7px 12px; border:1.5px solid #e2e8f0; border-radius:10px; font-size:12px; font-weight:600; color:#334155; outline:none; background:#f8fafc; }
.asp-date-input:focus { border-color:#818cf8; box-shadow:0 0 0 3px rgba(99,102,241,.1); }
.asp-archive-btn { display:inline-flex; align-items:center; gap:5px; padding:7px 14px; background:linear-gradient(135deg,#6366f1,#4338ca); color:#fff; border:none; border-radius:10px; font-size:11px; font-weight:700; cursor:pointer; transition:transform .12s,box-shadow .15s; }
.asp-archive-btn:hover { transform:translateY(-1px); }
.asp-archive-btn:disabled { opacity:.5; cursor:not-allowed; transform:none; }
.asp-refresh-btn { width:32px; height:32px; border-radius:8px; border:1.5px solid #e2e8f0; background:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#64748b; transition:all .12s; }
.asp-refresh-btn:hover { border-color:#a5b4fc; color:#4f46e5; background:#eef2ff; }

/* Table */
.asp-table-card { flex:1; display:flex; flex-direction:column; min-height:0; background:#fff; border-radius:14px; border:1px solid #e5e7eb; overflow:hidden; }
.asp-table-scroll { flex:1; overflow:auto; }
.asp-loading { padding:16px; display:flex; flex-direction:column; gap:8px; }
.asp-table { width:100%; border-collapse:collapse; font-size:12px; }
.asp-table thead th { padding:8px 12px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#64748b; background:#f8fafc; border-bottom:1px solid #e2e8f0; position:sticky; top:0; z-index:5; white-space:nowrap; }
.asp-table tbody td { padding:8px 12px; border-bottom:1px solid #f1f5f9; vertical-align:middle; }
.asp-row { transition:background .1s; }
.asp-row:hover { background:#f8fafc; }
.asp-date-cell { font-weight:600; color:#1e293b; font-size:12px; }
.asp-center { text-align:center; }
.asp-mono { font-family:monospace; font-size:11px; color:#475569; }
.asp-filepath { font-family:monospace; font-size:10px; color:#94a3b8; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.asp-time { font-size:10px; color:#94a3b8; white-space:nowrap; }
.asp-status { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:20px; font-size:10px; font-weight:700; white-space:nowrap; }

/* Empty */
.asp-empty { display:flex; flex-direction:column; align-items:center; gap:8px; padding:48px 20px; }
.asp-empty-icon { width:64px; height:64px; border-radius:50%; background:#f8fafc; display:flex; align-items:center; justify-content:center; }
.asp-empty-title { font-weight:700; color:#64748b; font-size:14px; margin:0; }
.asp-empty-sub { font-size:12px; color:#94a3b8; margin:0; text-align:center; }

/* Spin */
@keyframes aspSpin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
.asp-spin { animation:aspSpin 1s linear infinite; }
@keyframes shimmer { 0%{opacity:.6} 50%{opacity:1} 100%{opacity:.6} }
`;
