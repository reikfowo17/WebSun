import React, { useState, useEffect, useCallback, useRef } from 'react';
import ExpiryCheckService, {
    ExpiryCheckCategory,
    ExpiryCheckSession,
    ExpiryCheckResult,
} from '../../services/expiryCheck';
import { supabase } from '../../lib/supabase';

interface Store { id: string; name: string; code: string; }
interface User { id: string; display_name?: string; full_name?: string; store_id?: string; }

interface ExpiryCheckWorkerProps {
    user: User;
    currentDate?: string;
    currentShift?: number;
}

const fmt2 = (n: number) => String(n).padStart(2, '0');
const fmtDate = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtTime = (iso: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${fmt2(d.getHours())}:${fmt2(d.getMinutes())}`;
};

function printCheckList(session: ExpiryCheckSession, results: ExpiryCheckResult[], storeName: string) {
    const catName = (session as any).category?.name || 'Kiểm Date';
    const date = fmtDate(session.check_date);
    const rows = results.map((r, i) => `
        <tr>
            <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;width:28px;color:#999">${i + 1}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px">${r.product?.name || '—'}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;color:#666">${r.product?.sp || ''}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;font-size:14px;font-weight:700;width:90px"></td>
            <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;font-size:13px;width:100px;color:#999"></td>
            <td style="padding:8px 10px;border-bottom:1px solid #eee;width:120px"></td>
        </tr>
    `).join('');

    const html = `<!DOCTYPE html><html>
<head><meta charset="utf-8"><title>Kiểm Date – ${catName}</title>
<style>
  @page { margin: 18mm 15mm; }
  body { font-family: Arial, sans-serif; font-size: 13px; color: #111; }
  h2 { margin: 0 0 4px; font-size: 17px; }
  .meta { font-size: 12px; color: #555; margin-bottom: 14px; display: flex; gap: 24px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f3f4f6; padding: 8px 10px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #555; border-bottom: 2px solid #ddd; }
  th.center { text-align: center; }
  .footer { margin-top: 20px; display: flex; justify-content: space-between; font-size: 12px; color: #888; }
  .sign { text-align: center; font-size: 12px; margin-top: 30px; display: flex; justify-content: space-around; }
  .sign-col { text-align: center; }
  .sign p { font-weight: 700; font-size: 13px; margin-bottom: 40px; }
</style>
</head>
<body>
<h2>PHIẾU KIỂM DATE – ${catName.toUpperCase()}</h2>
<div class="meta">
  <span>📅 Ngày: <strong>${date}</strong></span>
  <span>🏪 Cửa hàng: <strong>${storeName}</strong></span>
  <span>🔄 Ca: <strong>${session.shift}</strong></span>
</div>
<table>
  <thead><tr>
    <th>#</th>
    <th>Tên sản phẩm</th>
    <th>Mã SP</th>
    <th class="center">Số lượng</th>
    <th class="center">Date (HSD)</th>
    <th class="center">Ghi chú</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">
  <span>In lúc: ${new Date().toLocaleString('vi-VN')}</span>
  <span>Tổng: ${results.length} sản phẩm</span>
</div>
<div class="sign">
  <div class="sign-col">
      <p>Nhân viên kiểm date</p>
      <span>________________________</span>
  </div>
  <div class="sign-col">
      <p>Quản lý cửa hàng</p>
      <span>________________________</span>
  </div>
</div>
</body></html>`;

    const w = window.open('', '_blank', 'width=800,height=600');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 400);
}


const ExpiryCheckWorker: React.FC<ExpiryCheckWorkerProps> = ({ user, currentDate, currentShift }) => {
    const today = currentDate || new Date().toISOString().slice(0, 10);
    const defaultShift = currentShift || 1;

    const [categories, setCategories] = useState<ExpiryCheckCategory[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [selectedCatId, setSelectedCatId] = useState<string>('');
    const [selectedStoreId, setSelectedStoreId] = useState<string>(user.store_id || '');
    const [selectedShift, setSelectedShift] = useState(defaultShift);
    const [checkDate, setCheckDate] = useState(today);
    const [session, setSession] = useState<ExpiryCheckSession | null>(null);
    const [results, setResults] = useState<ExpiryCheckResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [completing, setCompleting] = useState(false);
    const [syncMsg, setSyncMsg] = useState('');
    const [inputMap, setInputMap] = useState<Record<string, string>>({});
    const [dateMap, setDateMap] = useState<Record<string, string>>({});
    const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    const loadCategories = async () => {
        const res = await ExpiryCheckService.getCategories();
        if (res.success) {
            const active = res.data.filter(c => c.is_active);
            setCategories(active);
            if (active.length > 0 && !selectedCatId) setSelectedCatId(active[0].id);
        }
    };

    const loadStores = async () => {
        const { data } = await supabase.from('stores').select('id, name, code').order('name');
        if (data) {
            setStores(data);
            if (!selectedStoreId && data.length > 0) setSelectedStoreId(data[0].id);
        }
    };

    useEffect(() => { loadCategories(); loadStores(); }, []);

    const loadSession = useCallback(async () => {
        if (!selectedCatId || !selectedStoreId) return;
        setLoading(true);
        const res = await ExpiryCheckService.getSession({
            categoryId: selectedCatId,
            storeId: selectedStoreId,
            checkDate,
            shift: selectedShift,
        });
        if (res.success && res.session) {
            setSession(res.session);
            const rRes = await ExpiryCheckService.getSessionResults(res.session.id);
            if (rRes.success) {
                setResults(rRes.data);
                const initMap: Record<string, string> = {};
                const initDateMap: Record<string, string> = {};
                rRes.data.forEach(r => {
                    initMap[r.id] = r.qty !== null ? String(r.qty) : '';
                    initDateMap[r.id] = r.note || '';
                });
                setInputMap(initMap);
                setDateMap(initDateMap);
            }
        } else {
            setSession(null);
            setResults([]);
        }
        setLoading(false);
    }, [selectedCatId, selectedStoreId, checkDate, selectedShift]);

    useEffect(() => { loadSession(); }, [loadSession]);

    const handleStartSession = async () => {
        if (!selectedCatId || !selectedStoreId) return;
        setLoading(true);
        const res = await ExpiryCheckService.createSession({
            categoryId: selectedCatId,
            storeId: selectedStoreId,
            checkDate,
            shift: selectedShift,
            userId: user.id,
        });
        if (res.success) {
            loadSession();
        }
        setLoading(false);
    };

    const handleResultChange = (resultId: string, field: 'qty' | 'date', val: string) => {
        if (field === 'qty') setInputMap(prev => ({ ...prev, [resultId]: val }));
        else setDateMap(prev => ({ ...prev, [resultId]: val }));

        clearTimeout(saveTimers.current[resultId]);
        saveTimers.current[resultId] = setTimeout(async () => {
            const num = field === 'qty' ? (val === '' ? null : parseFloat(val)) : (inputMap[resultId] === '' ? null : parseFloat(inputMap[resultId]));
            const noteVal = field === 'date' ? val : dateMap[resultId];

            if (field === 'qty' && val !== '' && isNaN(num!)) return;

            let parsedDate: string | null = null;
            if (noteVal) {
                const ms = parseShortDate(noteVal);
                if (ms) parsedDate = new Date(ms).toISOString().split('T')[0];
            }

            await ExpiryCheckService.updateResult(resultId, {
                qty: num,
                note: noteVal,
                expiry_date: parsedDate,
                checked_at: new Date().toISOString(),
            });
            setResults(prev => prev.map(r => r.id === resultId
                ? { ...r, qty: num, note: noteVal, expiry_date: parsedDate }
                : r
            ));
        }, 600);
    };

    const handleSync = async () => {
        // Obsolete in Expiry Check
    };

    const handleComplete = async () => {
        if (!session) return;
        const checked = results.filter(r => r.qty !== null).length;
        if (checked < results.length) {
            if (!confirm(`Còn ${results.length - checked} sản phẩm chưa kiểm. Vẫn hoàn thành?`)) return;
        }
        setCompleting(true);
        await ExpiryCheckService.completeSession(session.id, user.id);
        setSession(prev => prev ? { ...prev, status: 'COMPLETED' } : prev);
        setCompleting(false);
    };

    const handlePrint = () => {
        if (!session) return;
        const storeName = stores.find(s => s.id === selectedStoreId)?.name || '';
        printCheckList(session, results, storeName);
    };

    const checkedCount = results.filter(r => r.qty !== null).length;
    const isCompleted = session?.status === 'COMPLETED';
    const selectedCat = categories.find(c => c.id === selectedCatId);

    const nearExpiryDays = selectedCat?.near_expiry_days || 30;

    const parseShortDate = (str: string): number | null => {
        if (!str) return null;
        // Allows formats: 12/12/24, 12-12-2024, 12.12.24
        const parts = str.match(/(\d+)[/.-](\d+)[/.-](\d+)/);
        if (!parts) return null;
        let [_, d, m, y] = parts;
        if (y.length === 2) y = '20' + y;
        const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        if (isNaN(date.getTime())) return null;
        return date.getTime();
    };

    const getExpiryStatus = (dateStr: string) => {
        const ms = parseShortDate(dateStr);
        if (!ms) return null;
        const diffDays = Math.ceil((ms - new Date().getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return 'EXPIRED';
        if (diffDays <= nearExpiryDays) return 'NEAR_EXPIRY';
        return 'OK';
    };

    return (
        <div className="scw-root">
            <style>{CSS_WORKER}</style>

            {/* ── Config bar ── */}
            <div className="scw-config-bar">
                <div className="scw-config-group">
                    <label className="scw-config-label">Danh mục Date</label>
                    <select className="scw-config-select" value={selectedCatId} onChange={e => setSelectedCatId(e.target.value)}>
                        {categories.length === 0 && <option value="">Chưa có danh mục</option>}
                        {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>
                <div className="scw-config-group">
                    <label className="scw-config-label">Cửa hàng</label>
                    <select className="scw-config-select" value={selectedStoreId} onChange={e => setSelectedStoreId(e.target.value)}>
                        {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
                <div className="scw-config-group">
                    <label className="scw-config-label">Ca</label>
                    <div className="scw-shift-pills">
                        {[1, 2, 3].map(s => (
                            <button key={s} className={`scw-shift-pill ${selectedShift === s ? 'active' : ''}`} onClick={() => setSelectedShift(s)}>
                                Ca {s}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="scw-config-group">
                    <label className="scw-config-label">Ngày</label>
                    <input type="date" className="scw-config-select" value={checkDate} onChange={e => setCheckDate(e.target.value)} />
                </div>
            </div>

            {/* ── Session header ── */}
            {session && (
                <div className="scw-session-header">
                    <div className="scw-session-info">
                        <div className="scw-session-title">
                            <span className="material-symbols-outlined">event_available</span>
                            {selectedCat?.name || 'Kiểm Date'}
                        </div>
                        <div className="scw-session-meta">
                            <span>{fmtDate(session.check_date)}</span>
                            <span>·</span>
                            <span>Ca {session.shift}</span>
                            {session.synced_at && (
                                <>
                                    <span>·</span>
                                    <span className="scw-sync-time">
                                        <span className="material-symbols-outlined">sync</span>
                                        Đồng bộ SL Kiot lúc {fmtTime(session.synced_at)}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Stats row */}
                    <div className="scw-stats-row">
                        <div className="scw-stat">
                            <span className="scw-stat-val">{results.length}</span>
                            <span className="scw-stat-lbl">Tổng SP</span>
                        </div>
                        <div className="scw-stat ok">
                            <span className="scw-stat-val">{checkedCount}</span>
                            <span className="scw-stat-lbl">Đã Ghi Nhận</span>
                        </div>
                    </div>

                    {/* Progress bar */}
                    <div className="scw-progress-bar">
                        <div
                            className="scw-progress-fill"
                            style={{ width: `${results.length > 0 ? Math.round(checkedCount / results.length * 100) : 0}%` }}
                        />
                    </div>

                    {/* Action buttons */}
                    <div className="scw-actions">
                        <button className="scw-btn scw-btn--print" onClick={handlePrint}>
                            <span className="material-symbols-outlined">print</span>
                            In Phiếu Kiểm Date
                        </button>
                        {!isCompleted ? (
                            <button className="scw-btn scw-btn--complete" onClick={handleComplete} disabled={completing}>
                                <span className="material-symbols-outlined">check_circle</span>
                                {completing ? 'Đang lưu...' : 'Hoàn thành ca kiểm'}
                            </button>
                        ) : (
                            <div className="scw-completed-badge">
                                <span className="material-symbols-outlined">verified</span>
                                Đã hoàn thành
                            </div>
                        )}
                    </div>

                    {syncMsg && (
                        <div className="scw-sync-msg">
                            <span className="material-symbols-outlined">check_circle</span>
                            {syncMsg}
                        </div>
                    )}
                </div>
            )}

            {/* ── Results table ── */}
            <div className="scw-table-wrap">
                {loading ? (
                    <div className="scw-loading">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="scw-skeleton-row" />
                        ))}
                    </div>
                ) : !session || results.length === 0 ? (
                    <div className="scw-empty">
                        <span className="material-symbols-outlined">inventory</span>
                        <p>{categories.length === 0 ? 'Chưa có danh mục nào được tạo' : 'Ca kiểm chưa được tạo hoặc chưa bắt đầu'}</p>
                        <p className="scw-empty-sub">Hãy nhấn "Bắt đầu ca kiểm" để lấy danh sách từ danh mục vào kiểm date.</p>
                        {categories.length > 0 && selectedCatId && (
                            <button className="scw-btn scw-btn--complete" onClick={handleStartSession} style={{ marginTop: 12 }}>
                                <span className="material-symbols-outlined">play_arrow</span>
                                Bắt đầu ca kiểm
                            </button>
                        )}
                    </div>
                ) : (
                    <table className="scw-table">
                        <thead>
                            <tr>
                                <th style={{ width: 38 }}>#</th>
                                <th>Tên sản phẩm</th>
                                <th style={{ width: 100 }}>Mã SP</th>
                                <th style={{ width: 100 }} className="center">Hạn Sử Dụng</th>
                                <th style={{ width: 90 }} className="center">Số Lượng</th>
                                <th style={{ width: 50 }} className="center">Xong</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.map((r, idx) => {
                                const val = inputMap[r.id] ?? (r.qty !== null ? String(r.qty) : '');
                                const hasVal = r.qty !== null;

                                const status = getExpiryStatus(dateMap[r.id] || '');

                                return (
                                    <tr key={r.id} className={`scw-row ${hasVal ? 'checked' : ''}`}>
                                        <td className="scw-idx">{idx + 1}</td>
                                        <td className="scw-name">{r.product?.name || '—'}</td>
                                        <td className="scw-sp">{r.product?.sp || ''}</td>
                                        <td className="center scw-sys-qty" style={{ position: 'relative' }}>
                                            <input
                                                type="text"
                                                className={`scw-qty-input ${dateMap[r.id] ? 'has-value' : ''}`}
                                                style={{
                                                    fontSize: 13, width: '100%',
                                                    color: status === 'EXPIRED' ? '#dc2626' : status === 'NEAR_EXPIRY' ? '#ea580c' : undefined,
                                                    fontWeight: (status === 'EXPIRED' || status === 'NEAR_EXPIRY') ? 'bold' : 'normal',
                                                    borderColor: status === 'EXPIRED' ? '#fecaca' : status === 'NEAR_EXPIRY' ? '#fed7aa' : undefined,
                                                    backgroundColor: status === 'EXPIRED' ? '#fef2f2' : status === 'NEAR_EXPIRY' ? '#fff7ed' : undefined
                                                }}
                                                value={dateMap[r.id] || ''}
                                                onChange={e => handleResultChange(r.id, 'date', e.target.value)}
                                                placeholder="VD: 12/12/24"
                                                disabled={isCompleted}
                                                title="Ghi nhận Hạn sử dụng của sản phẩm (hoặc lô gần nhất)"
                                            />
                                            {status === 'EXPIRED' && <span className="scw-date-badge scw-badge-red">Hết hạn</span>}
                                            {status === 'NEAR_EXPIRY' && <span className="scw-date-badge scw-badge-orange">Cận date</span>}
                                        </td>
                                        <td className="scw-qty-cell center">
                                            <input
                                                type="number"
                                                step="0.01"
                                                className={`scw-qty-input ${hasVal ? 'has-value' : ''}`}
                                                value={val}
                                                onChange={e => handleResultChange(r.id, 'qty', e.target.value)}
                                                placeholder="—"
                                                disabled={isCompleted}
                                            />
                                        </td>
                                        <td className="center">
                                            {hasVal || dateMap[r.id] ? (
                                                <span className="scw-check-mark" title="Đã kiểm">
                                                    <span className="material-symbols-outlined">check_circle</span>
                                                </span>
                                            ) : (
                                                <span className="scw-uncheck-mark">
                                                    <span className="material-symbols-outlined">radio_button_unchecked</span>
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div >
    );
};

const CSS_WORKER = `
@keyframes scwSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes scwIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

.scw-root {
    display: flex; flex-direction: column;
    height: 100%; background: #f8fafc; font-family: 'Inter', sans-serif; overflow: hidden;
}

/* ── Config bar ── */
.scw-config-bar {
    display: flex; align-items: flex-end; flex-wrap: wrap; gap: 16px;
    padding: 14px 24px; background: white; border-bottom: 1px solid #e5e7eb; flex-shrink: 0;
}
.scw-config-group { display: flex; flex-direction: column; gap: 5px; }
.scw-config-label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: .05em; }
.scw-config-select {
    height: 38px; padding: 0 12px; border-radius: 10px;
    border: 1.5px solid #e5e7eb; background: #f8fafc;
    font-size: 13px; font-weight: 600; color: #1e293b; outline: none; cursor: pointer;
    transition: all .2s; min-width: 150px;
}
.scw-config-select:focus { border-color: #fbd38d; background: white; }

.scw-shift-pills { display: flex; gap: 4px; }
.scw-shift-pill {
    height: 38px; padding: 0 16px; border-radius: 10px;
    border: 1.5px solid #e5e7eb; background: #f8fafc;
    font-size: 13px; font-weight: 600; color: #64748b;
    cursor: pointer; transition: all .15s;
}
.scw-shift-pill:hover { border-color: #fbd38d; }
.scw-shift-pill.active { background: #ed8936; border-color: #ed8936; color: #fff; }

/* ── Session header ── */
.scw-session-header {
    padding: 16px 24px; background: white; border-bottom: 1px solid #e5e7eb; flex-shrink: 0;
    animation: scwIn .2s ease-out;
}
.scw-session-info { margin-bottom: 14px; }
.scw-session-title {
    display: flex; align-items: center; gap: 8px;
    font-size: 16px; font-weight: 800; color: #1e293b; margin-bottom: 4px;
}
.scw-session-title .material-symbols-outlined { font-size: 20px; color: #ed8936; }
.scw-session-meta { font-size: 12px; color: #94a3b8; display: flex; align-items: center; gap: 6px; }
.scw-sync-time { display: flex; align-items: center; gap: 4px; color: #16a34a; font-weight: 600; }
.scw-sync-time .material-symbols-outlined { font-size: 13px; }

/* Stats */
.scw-stats-row { display: flex; gap: 2px; margin-bottom: 12px; }
.scw-stat {
    flex: 1; text-align: center; padding: 10px 8px; border-radius: 10px;
    background: #f8fafc; border: 1px solid #f1f5f9;
}
.scw-stat.ok { background: rgba(240,253,244,.6); border-color: #bbf7d0; }
.scw-stat.warn { background: rgba(255,251,235,.6); border-color: #fde68a; }
.scw-stat.danger { background: rgba(254,242,242,.6); border-color: #fecaca; }
.scw-stat-val { display: block; font-size: 20px; font-weight: 800; color: #1e293b; line-height: 1.2; }
.scw-stat.ok .scw-stat-val { color: #16a34a; }
.scw-stat.warn .scw-stat-val { color: #d97706; }
.scw-stat.danger .scw-stat-val { color: #dc2626; }
.scw-stat-lbl { display: block; font-size: 10px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: .03em; margin-top: 2px; }

/* Progress */
.scw-progress-bar { height: 6px; background: #f1f5f9; border-radius: 4px; margin-bottom: 14px; overflow: hidden; }
.scw-progress-fill { height: 100%; background: linear-gradient(270deg, #f6ad55, #ed8936); border-radius: 4px; transition: width .4s ease; }

/* Actions */
.scw-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.scw-btn {
    display: flex; align-items: center; gap: 7px; height: 38px;
    padding: 0 16px; border-radius: 10px; font-size: 13px; font-weight: 700;
    cursor: pointer; border: none; transition: all .2s; white-space: nowrap;
}
.scw-btn .material-symbols-outlined { font-size: 17px; }
.scw-btn:disabled { opacity: .5; cursor: not-allowed; }

.scw-btn--sync { background: #1e293b; color: white; }
.scw-btn--sync:hover:not(:disabled) { background: #334155; }
.scw-btn--print { background: #f1f5f9; color: #374151; border: 1.5px solid #e5e7eb; }
.scw-btn--print:hover { background: #e5e7eb; }
.scw-btn--complete { background: linear-gradient(180deg, #fbd38d, #ed8936); color: #fff; box-shadow: 0 2px 8px rgba(237,137,54,.3); text-shadow: 0 1px 2px rgba(0,0,0,0.1); }
.scw-btn--complete:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(237,137,54,.4); filter: brightness(1.05); }

.scw-completed-badge {
    display: flex; align-items: center; gap: 7px;
    padding: 9px 16px; border-radius: 10px;
    background: #d1fae5; color: #065f46; font-size: 13px; font-weight: 700;
}
.scw-completed-badge .material-symbols-outlined { font-size: 16px; }

.scw-sync-msg {
    display: flex; align-items: center; gap: 8px; margin-top: 10px;
    padding: 8px 14px; border-radius: 10px; background: #f0fdf4;
    color: #16a34a; font-size: 13px; font-weight: 600; animation: scwIn .2s ease-out;
}
.scw-sync-msg .material-symbols-outlined { font-size: 16px; }

/* ── Table ── */
.scw-table-wrap { flex: 1; overflow: auto; }
.scw-table {
    width: 100%; border-collapse: collapse;
    font-size: 13px; background: white;
}
.scw-table th {
    position: sticky; top: 0; z-index: 10;
    background: #f8fafc; border-bottom: 2px solid #e5e7eb;
    padding: 10px 14px; font-size: 10px; font-weight: 700;
    text-transform: uppercase; letter-spacing: .05em; color: #64748b;
}
.scw-table th.center { text-align: center; }
.scw-table td { padding: 8px 14px; border-bottom: 1px solid #f1f5f9; }
.scw-table tr:hover td { background: #fafafa; }
.scw-row.checked td { background: rgba(240,253,244,.5); }
.scw-row.checked:hover td { background: rgba(220,252,231,.4); }

.scw-idx { color: #94a3b8; font-size: 11px; width: 38px; text-align: center; }
.scw-name { font-weight: 600; color: #1e293b; }
.scw-sp { font-size: 12px; color: #64748b; font-family: monospace; }
.scw-qty-cell { text-align: center; }

.scw-qty-input {
    width: 80px; height: 36px; text-align: center;
    border: 2px solid #e5e7eb; border-radius: 10px;
    background: #f9fafb; font-size: 15px; font-weight: 700;
    color: #1e293b; outline: none; transition: all .2s;
}
.scw-qty-input:focus { border-color: #ed8936; background: white; box-shadow: 0 0 0 4px rgba(237,137,54,.1); }
.scw-qty-input.has-value { border-color: #86efac; background: #f0fdf4; color: #16a34a; }
.scw-qty-input:disabled { opacity: .7; cursor: not-allowed; }

.scw-sys-qty { color: #374151; font-weight: 600; }
.scw-na { color: #d1d5db; }
.center { text-align: center; }

.scw-diff {
    display: inline-block; padding: 3px 10px; border-radius: 20px;
    font-size: 12px; font-weight: 800;
}
.scw-diff.ok { background: #d1fae5; color: #065f46; }
.scw-diff.pos { background: #dbeafe; color: #1d4ed8; }
.scw-diff.neg { background: #fee2e2; color: #b91c1c; }

.scw-check-mark .material-symbols-outlined { font-size: 18px; color: #16a34a; }
.scw-uncheck-mark .material-symbols-outlined { font-size: 18px; color: #d1d5db; }

/* ── States ── */
.scw-loading { padding: 20px; display: flex; flex-direction: column; gap: 8px; }
.scw-skeleton-row { height: 48px; border-radius: 10px; background: linear-gradient(90deg, #f3f4f6 25%, #e9ebee 50%, #f3f4f6 75%); background-size: 200% 100%; animation: scwSkeletonSlide 1.5s linear infinite; }
@keyframes scwSkeletonSlide { 0%{background-position:-200% 0} 100%{background-position:200% 0} }

.scw-uncheck-mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #cbd5e1;
}
.scw-date-badge {
    position: absolute;
    top: 0px;
    right: 2px;
    font-size: 9px;
    font-weight: 800;
    padding: 1px 4px;
    border-radius: 4px;
    pointer-events: none;
}
.scw-badge-red { background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; }
.scw-badge-orange { background: #ffedd5; color: #ea580c; border: 1px solid #fed7aa; }

.scw-empty {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 80px 24px; gap: 12px; color: #94a3b8; text-align: center;
}
.scw-empty .material-symbols-outlined { font-size: 56px; opacity: .3; }
.scw-empty p { font-size: 15px; color: #64748b; font-weight: 500; }
.scw-empty-sub { font-size: 12px !important; color: #94a3b8 !important; font-weight: 400 !important; }
`;

export default ExpiryCheckWorker;
