import React, { useState, useCallback } from 'react';
import { InventoryArchiveService } from '../../../services/archive';
import type { RecoveryScanResult, MissingProduct } from '../../../services/archive';
import { RecoveryService } from '../../../services/recovery';
import { STORES } from '../../../constants';

interface RecoveryScanModalProps {
    toast: any;
    onClose: () => void;
    onRecoveryCreated: () => void;
}

const MONTHS = [
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4',
    'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8',
    'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
];

const formatCurrency = (n: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);

const RecoveryScanModal: React.FC<RecoveryScanModalProps> = ({ toast, onClose, onRecoveryCreated }) => {
    const now = new Date();
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth()); // last month default
    const [scanning, setScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState({ current: 0, total: 0, fileName: '' });
    const [scanResult, setScanResult] = useState<RecoveryScanResult | null>(null);
    const [selectedStore, setSelectedStore] = useState<string>('ALL');
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [creatingRecovery, setCreatingRecovery] = useState(false);

    // ── Scan Logic ──
    const handleScan = useCallback(async () => {
        setScanning(true);
        setScanProgress({ current: 0, total: 0, fileName: '' });
        setScanResult(null);
        setSelectedItems(new Set());

        try {
            const result = await InventoryArchiveService.scanForMissingProducts(
                selectedYear,
                selectedMonth + 1,
                (current, total, fileName) => {
                    setScanProgress({ current, total, fileName });
                }
            );
            setScanResult(result);

            if (result.total_missing_products === 0) {
                toast.success(`Không có sản phẩm thiếu trong tháng ${selectedMonth + 1}/${selectedYear}!`);
            } else {
                toast.info(`Tìm thấy ${result.total_missing_products} sản phẩm thiếu`);
            }
        } catch (err: any) {
            toast.error('Lỗi quét lịch sử: ' + err.message);
        } finally {
            setScanning(false);
        }
    }, [selectedYear, selectedMonth, toast]);

    // ── Create Recovery Items from selected products ──
    const handleCreateRecovery = async () => {
        if (selectedItems.size === 0) {
            toast.error('Chưa chọn sản phẩm nào');
            return;
        }

        setCreatingRecovery(true);
        let created = 0;
        let failed = 0;

        const allItems = getFilteredItems();

        for (const item of allItems) {
            const key = `${item.store_code}:${item.barcode}:${item.shift}`;
            if (!selectedItems.has(key)) continue;

            try {
                const storeConfig = STORES.find(s => s.code === item.store_code);
                const result = await RecoveryService.createRecoveryItem({
                    store_id: storeConfig?.id || item.store_code,
                    product_name: item.product_name,
                    barcode: item.barcode,
                    quantity: Math.abs(item.diff),
                    unit_price: 0, // Will need to be filled in manually or from KiotViet
                    reason: item.diff_reason || 'Kiểm kho phát hiện thiếu',
                    notes: `Tháng ${selectedMonth + 1}/${selectedYear} | Ca ${item.shift} | ${item.consecutive_missing_days} ngày liên tiếp`,
                });

                if (result.success) created++;
                else failed++;
            } catch {
                failed++;
            }
        }

        setCreatingRecovery(false);

        if (created > 0) {
            toast.success(`Đã tạo ${created} phiếu truy thu${failed > 0 ? ` (${failed} lỗi)` : ''}`);
            onRecoveryCreated();
        } else {
            toast.error(`Không thể tạo phiếu truy thu. ${failed} lỗi.`);
        }
    };

    // ── Helpers ──
    const getFilteredItems = (): MissingProduct[] => {
        if (!scanResult) return [];
        if (selectedStore === 'ALL') {
            return Object.values(scanResult.stores).flat();
        }
        return scanResult.stores[selectedStore] || [];
    };

    const toggleItem = (key: string) => {
        setSelectedItems(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const toggleAll = () => {
        const items = getFilteredItems();
        if (selectedItems.size === items.length) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(items.map(i => `${i.store_code}:${i.barcode}:${i.shift}`)));
        }
    };

    const filteredItems = getFilteredItems();
    const storeKeys = scanResult ? Object.keys(scanResult.stores).filter(k => (scanResult.stores[k]?.length || 0) > 0) : [];

    return (
        <>
            <style>{CSS_TEXT}</style>
            <div className="rsm-overlay" onClick={onClose}>
                <div className="rsm-modal" onClick={e => e.stopPropagation()}>

                    {/* Header */}
                    <div className="rsm-header">
                        <div className="rsm-header-icon">
                            <span className="material-symbols-outlined" style={{ fontSize: 22, color: '#6366f1' }}>history</span>
                        </div>
                        <div>
                            <h2 className="rsm-title">Quét lịch sử kiểm kho</h2>
                            <p className="rsm-subtitle">Quét file lưu trữ để phát hiện sản phẩm thiếu liên tục</p>
                        </div>
                        <button className="rsm-close" onClick={onClose}>
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    {/* Date Selector */}
                    <div className="rsm-date-section">
                        <div className="rsm-date-group">
                            <label className="rsm-label">Năm</label>
                            <select className="rsm-select" value={selectedYear} onChange={e => setSelectedYear(+e.target.value)}>
                                {[now.getFullYear() - 1, now.getFullYear()].map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                        <div className="rsm-date-group" style={{ flex: 1 }}>
                            <label className="rsm-label">Tháng</label>
                            <div className="rsm-month-grid">
                                {MONTHS.map((m, idx) => (
                                    <button
                                        key={idx}
                                        className={`rsm-month-btn ${selectedMonth === idx ? 'active' : ''}`}
                                        onClick={() => setSelectedMonth(idx)}
                                        disabled={scanning}
                                    >
                                        {idx + 1}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <button className="rsm-scan-btn" onClick={handleScan} disabled={scanning}>
                            {scanning ? (
                                <>
                                    <span className="material-symbols-outlined rsm-spin" style={{ fontSize: 18 }}>progress_activity</span>
                                    Đang quét...
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>search</span>
                                    Bắt đầu quét
                                </>
                            )}
                        </button>
                    </div>

                    {/* Progress Bar */}
                    {scanning && (
                        <div className="rsm-progress-section">
                            <div className="rsm-progress-bar">
                                <div
                                    className="rsm-progress-fill"
                                    style={{ width: scanProgress.total ? `${(scanProgress.current / scanProgress.total) * 100}%` : '0%' }}
                                />
                            </div>
                            <span className="rsm-progress-text">
                                📄 {scanProgress.fileName} ({scanProgress.current}/{scanProgress.total})
                            </span>
                        </div>
                    )}

                    {/* Results */}
                    {scanResult && (
                        <>
                            {/* Summary */}
                            <div className="rsm-result-summary">
                                <div className="rsm-result-stat">
                                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#6366f1' }}>description</span>
                                    <span><strong>{scanResult.total_files_scanned}</strong> file đã quét</span>
                                </div>
                                <div className="rsm-result-stat">
                                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#ef4444' }}>error</span>
                                    <span><strong>{scanResult.total_missing_products}</strong> SP thiếu</span>
                                </div>
                                <div className="rsm-result-stat">
                                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#10b981' }}>store</span>
                                    <span><strong>{storeKeys.length}</strong> cửa hàng</span>
                                </div>
                                {scanResult.errors.length > 0 && (
                                    <div className="rsm-result-stat rsm-result-error">
                                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>warning</span>
                                        <span>{scanResult.errors.length} lỗi</span>
                                    </div>
                                )}
                            </div>

                            {scanResult.total_missing_products > 0 && (
                                <>
                                    {/* Store Filter */}
                                    <div className="rsm-store-filter">
                                        <button
                                            className={`rsm-store-chip ${selectedStore === 'ALL' ? 'active' : ''}`}
                                            onClick={() => setSelectedStore('ALL')}
                                        >
                                            Tất cả ({Object.values(scanResult.stores).flat().length})
                                        </button>
                                        {storeKeys.map(code => (
                                            <button
                                                key={code}
                                                className={`rsm-store-chip ${selectedStore === code ? 'active' : ''}`}
                                                onClick={() => setSelectedStore(code)}
                                            >
                                                {code} ({scanResult.stores[code].length})
                                            </button>
                                        ))}
                                    </div>

                                    {/* Products Table */}
                                    <div className="rsm-table-wrap">
                                        <table className="rsm-table">
                                            <thead>
                                                <tr>
                                                    <th style={{ width: 36 }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedItems.size === filteredItems.length && filteredItems.length > 0}
                                                            onChange={toggleAll}
                                                        />
                                                    </th>
                                                    <th>Sản phẩm</th>
                                                    <th style={{ width: 90 }}>Cửa hàng</th>
                                                    <th style={{ width: 60 }}>Ca</th>
                                                    <th style={{ width: 65 }}>HT</th>
                                                    <th style={{ width: 65 }}>TT</th>
                                                    <th style={{ width: 65 }}>Lệch</th>
                                                    <th style={{ width: 80 }}>Ngày thiếu</th>
                                                    <th style={{ width: 100 }}>Ngày OK cuối</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredItems.map((item, idx) => {
                                                    const key = `${item.store_code}:${item.barcode}:${item.shift}`;
                                                    return (
                                                        <tr key={key + idx} className="rsm-row">
                                                            <td>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedItems.has(key)}
                                                                    onChange={() => toggleItem(key)}
                                                                />
                                                            </td>
                                                            <td>
                                                                <div className="rsm-product-name">{item.product_name}</div>
                                                                <div className="rsm-barcode">{item.barcode}</div>
                                                            </td>
                                                            <td><span className="rsm-store-tag">{item.store_code}</span></td>
                                                            <td className="rsm-center">{item.shift}</td>
                                                            <td className="rsm-center rsm-mono">{item.system_stock}</td>
                                                            <td className="rsm-center rsm-mono">{item.actual_stock ?? '—'}</td>
                                                            <td className="rsm-center">
                                                                <span className="rsm-diff-badge">{item.diff}</span>
                                                            </td>
                                                            <td className="rsm-center">
                                                                <span className="rsm-days-badge">{item.consecutive_missing_days}d</span>
                                                            </td>
                                                            <td className="rsm-date-cell">
                                                                {item.last_positive_date || '—'}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </>
                    )}

                    {/* Footer */}
                    <div className="rsm-footer">
                        <span className="rsm-footer-info">
                            {selectedItems.size > 0
                                ? `Đã chọn ${selectedItems.size} sản phẩm`
                                : 'Chọn sản phẩm để tạo phiếu truy thu'
                            }
                        </span>
                        <div className="rsm-footer-actions">
                            <button className="rsm-btn-cancel" onClick={onClose}>Đóng</button>
                            <button
                                className="rsm-btn-create"
                                disabled={selectedItems.size === 0 || creatingRecovery}
                                onClick={handleCreateRecovery}
                            >
                                {creatingRecovery ? (
                                    <>
                                        <span className="material-symbols-outlined rsm-spin" style={{ fontSize: 16 }}>progress_activity</span>
                                        Đang tạo...
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>receipt_long</span>
                                        Tạo {selectedItems.size} phiếu truy thu
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default RecoveryScanModal;

/* ══════ CSS ══════ */
const CSS_TEXT = `
/* Overlay */
.rsm-overlay { position:fixed; inset:0; background:rgba(15,23,42,.45); backdrop-filter:blur(4px); z-index:200; display:flex; align-items:center; justify-content:center; padding:20px; }
.rsm-modal { background:#fff; border-radius:20px; width:100%; max-width:960px; max-height:90vh; display:flex; flex-direction:column; box-shadow:0 25px 50px -12px rgba(0,0,0,.25); overflow:hidden; }

/* Header */
.rsm-header { display:flex; align-items:center; gap:14px; padding:20px 24px; border-bottom:1px solid #f1f5f9; flex-shrink:0; }
.rsm-header-icon { width:42px; height:42px; border-radius:12px; background:#eef2ff; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.rsm-title { font-size:18px; font-weight:800; color:#1e293b; margin:0; line-height:1.3; }
.rsm-subtitle { font-size:12px; color:#94a3b8; margin:2px 0 0; }
.rsm-close { margin-left:auto; width:36px; height:36px; border-radius:10px; border:none; background:transparent; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#94a3b8; transition:all .15s; }
.rsm-close:hover { background:#f1f5f9; color:#475569; }

/* Date Selection */
.rsm-date-section { display:flex; align-items:flex-end; gap:16px; padding:16px 24px; border-bottom:1px solid #f1f5f9; flex-shrink:0; flex-wrap:wrap; }
.rsm-date-group { display:flex; flex-direction:column; gap:6px; }
.rsm-label { font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.04em; }
.rsm-select { padding:8px 12px; border:1.5px solid #e2e8f0; border-radius:10px; font-size:13px; font-weight:600; color:#334155; outline:none; background:#f8fafc; min-width:90px; cursor:pointer; }
.rsm-select:focus { border-color:#818cf8; box-shadow:0 0 0 3px rgba(99,102,241,.1); }
.rsm-month-grid { display:flex; gap:4px; flex-wrap:wrap; }
.rsm-month-btn { width:36px; height:32px; border-radius:8px; border:1.5px solid #e2e8f0; background:#fff; font-size:12px; font-weight:700; color:#64748b; cursor:pointer; transition:all .12s; }
.rsm-month-btn:hover { border-color:#a5b4fc; color:#4f46e5; background:#eef2ff; }
.rsm-month-btn.active { background:linear-gradient(135deg,#6366f1,#4338ca); color:#fff; border-color:#6366f1; box-shadow:0 2px 8px -2px rgba(99,102,241,.4); }
.rsm-month-btn:disabled { opacity:.5; cursor:not-allowed; }
.rsm-scan-btn { display:inline-flex; align-items:center; gap:8px; padding:10px 20px; background:linear-gradient(135deg,#6366f1,#4338ca); color:#fff; border:none; border-radius:12px; font-size:13px; font-weight:700; cursor:pointer; box-shadow:0 4px 14px -3px rgba(99,102,241,.4); transition:transform .15s,box-shadow .2s; white-space:nowrap; }
.rsm-scan-btn:hover { transform:translateY(-1px); box-shadow:0 6px 20px -4px rgba(99,102,241,.5); }
.rsm-scan-btn:disabled { opacity:.7; cursor:not-allowed; transform:none; }

/* Progress */
.rsm-progress-section { padding:12px 24px; border-bottom:1px solid #f1f5f9; flex-shrink:0; }
.rsm-progress-bar { height:6px; background:#e2e8f0; border-radius:3px; overflow:hidden; }
.rsm-progress-fill { height:100%; background:linear-gradient(90deg,#6366f1,#818cf8); border-radius:3px; transition:width .3s ease; }
.rsm-progress-text { font-size:11px; color:#94a3b8; margin-top:6px; display:block; }

/* Result Summary */
.rsm-result-summary { display:flex; gap:16px; padding:12px 24px; border-bottom:1px solid #f1f5f9; flex-shrink:0; flex-wrap:wrap; }
.rsm-result-stat { display:inline-flex; align-items:center; gap:6px; font-size:13px; color:#475569; }
.rsm-result-stat strong { color:#1e293b; font-weight:700; }
.rsm-result-error { color:#ef4444; }

/* Store Filter */
.rsm-store-filter { display:flex; gap:6px; padding:10px 24px; flex-shrink:0; overflow-x:auto; }
.rsm-store-chip { padding:5px 14px; border-radius:20px; font-size:11px; font-weight:700; border:1.5px solid #e2e8f0; background:#fff; color:#64748b; cursor:pointer; transition:all .12s; white-space:nowrap; }
.rsm-store-chip:hover { border-color:#a5b4fc; color:#4f46e5; background:#eef2ff; }
.rsm-store-chip.active { background:linear-gradient(135deg,#6366f1,#4f46e5); color:#fff; border-color:#6366f1; box-shadow:0 2px 8px -2px rgba(99,102,241,.35); }

/* Table */
.rsm-table-wrap { flex:1; overflow:auto; min-height:0; padding:0 24px 12px; }
.rsm-table { width:100%; border-collapse:collapse; font-size:12px; }
.rsm-table thead th { padding:8px 10px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#64748b; background:#f8fafc; border-bottom:1px solid #e2e8f0; position:sticky; top:0; z-index:5; white-space:nowrap; }
.rsm-table tbody td { padding:8px 10px; border-bottom:1px solid #f1f5f9; vertical-align:middle; }
.rsm-row { transition:background .1s; }
.rsm-row:hover { background:#f8fafc; }
.rsm-product-name { font-size:12px; font-weight:600; color:#1e293b; }
.rsm-barcode { font-size:10px; font-family:monospace; color:#94a3b8; margin-top:1px; }
.rsm-center { text-align:center; }
.rsm-mono { font-family:monospace; font-size:12px; color:#475569; }
.rsm-store-tag { display:inline-block; padding:2px 8px; background:#eef2ff; color:#4f46e5; border-radius:6px; font-size:10px; font-weight:700; }
.rsm-diff-badge { display:inline-block; padding:2px 8px; background:#fef2f2; color:#dc2626; border-radius:6px; font-size:11px; font-weight:700; font-family:monospace; }
.rsm-days-badge { display:inline-block; padding:2px 8px; background:#fef3c7; color:#92400e; border-radius:6px; font-size:10px; font-weight:700; }
.rsm-date-cell { font-size:11px; color:#94a3b8; font-family:monospace; }

/* Footer */
.rsm-footer { display:flex; align-items:center; justify-content:space-between; padding:14px 24px; border-top:1px solid #f1f5f9; flex-shrink:0; background:#fafbfc; }
.rsm-footer-info { font-size:12px; color:#94a3b8; font-weight:500; }
.rsm-footer-actions { display:flex; gap:10px; }
.rsm-btn-cancel { padding:8px 16px; border:1.5px solid #e2e8f0; border-radius:10px; background:#fff; font-size:12px; font-weight:700; color:#64748b; cursor:pointer; transition:all .12s; }
.rsm-btn-cancel:hover { border-color:#a5b4fc; color:#4f46e5; background:#eef2ff; }
.rsm-btn-create { display:inline-flex; align-items:center; gap:6px; padding:8px 18px; background:linear-gradient(135deg,#10b981,#059669); color:#fff; border:none; border-radius:10px; font-size:12px; font-weight:700; cursor:pointer; box-shadow:0 4px 14px -3px rgba(16,185,129,.4); transition:transform .12s,box-shadow .15s; }
.rsm-btn-create:hover { transform:translateY(-1px); box-shadow:0 6px 18px -4px rgba(16,185,129,.5); }
.rsm-btn-create:disabled { opacity:.5; cursor:not-allowed; transform:none; }

/* Spin */
@keyframes rsmSpin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
.rsm-spin { animation:rsmSpin 1s linear infinite; }
`;
