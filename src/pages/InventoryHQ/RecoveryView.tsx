import React, { useState, useEffect, useCallback } from 'react';
import { RecoveryService } from '../../services/recovery';
import { InventoryArchiveService } from '../../services/archive';
import type { RecoveryScanResult, MissingProduct } from '../../services/archive';
import { SystemService, StoreConfig } from '../../services/system';
import type { RecoveryItem, RecoveryStatus } from '../../types/recovery';
import AddRecoveryModal from './components/AddRecoveryModal';
import RecoveryDetailModal from './components/RecoveryDetailModal';

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

const MONTHS = [
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4',
    'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8',
    'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
];

const getStatus = (s: RecoveryStatus) => STATUS_CFG[s] || STATUS_CFG.PENDING;
const formatCurrency = (n: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
const formatDate = (d: string) => new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

type TabKey = 'scan' | 'list';

const RecoveryView: React.FC<RecoveryViewProps> = ({ toast, date }) => {
    const [activeTab, setActiveTab] = useState<TabKey>('scan');

    /* ── List Tab State ── */
    const [items, setItems] = useState<RecoveryItem[]>([]);
    const [filteredItems, setFilteredItems] = useState<RecoveryItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState<RecoveryStatus | 'ALL'>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<RecoveryItem | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);

    /* ── Scan Tab State ── */
    const now = new Date();
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth() === 0 ? 11 : now.getMonth() - 1);
    const [scanning, setScanning] = useState(false);
    const [stores, setStores] = useState<StoreConfig[]>([]);
    const [scanProgress, setScanProgress] = useState({ current: 0, total: 0, fileName: '' });
    const [scanResult, setScanResult] = useState<RecoveryScanResult | null>(null);
    const [selectedStore, setSelectedStore] = useState<string>('ALL');
    const [selectedScanItems, setSelectedScanItems] = useState<Set<string>>(new Set());
    const [creatingRecovery, setCreatingRecovery] = useState(false);
    const [analyzingKiot, setAnalyzingKiot] = useState(false);

    // Smart Recovery Filters
    const [hideOffset, setHideOffset] = useState(true);
    const [hideUnaudited, setHideUnaudited] = useState(true);

    useEffect(() => { loadRecoveryItems(); SystemService.getStores().then(setStores); }, []);

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

    const handleAddSuccess = () => { setShowAddModal(false); loadRecoveryItems(); toast.success('Đã tạo phiếu truy thu thành công!'); };
    const handleViewDetail = (item: RecoveryItem) => { setSelectedItem(item); setShowDetailModal(true); };
    const handleDetailClose = (refresh?: boolean) => { setShowDetailModal(false); setSelectedItem(null); if (refresh) loadRecoveryItems(); };

    /* ── Scan Logic ── */
    const handleScan = useCallback(async () => {
        setScanning(true);
        setScanProgress({ current: 0, total: 0, fileName: '' });
        setScanResult(null);
        setSelectedScanItems(new Set());
        try {
            const result = await InventoryArchiveService.scanForMissingProducts(
                selectedYear,
                selectedMonth + 1,
                (current, total, fileName) => setScanProgress({ current, total, fileName })
            );
            setScanResult(result);
            if (result.total_missing_products === 0) {
                toast.success(`Không có sản phẩm thiếu trong tháng ${selectedMonth + 1}/${selectedYear}!`);
            } else {
                toast.info(`Tìm thấy ${result.total_missing_products} sản phẩm thiếu`);
            }
        } catch (err: any) {
            toast.error('Lỗi quét lịch sử: ' + err.message);
        } finally { setScanning(false); }
    }, [selectedYear, selectedMonth, toast]);

    const getScanFilteredItems = (): MissingProduct[] => {
        if (!scanResult) return [];
        let rItems = selectedStore === 'ALL' ? Object.values(scanResult.stores).flat() : scanResult.stores[selectedStore] || [];

        if (hideOffset) rItems = rItems.filter(i => !i.is_offset);
        if (hideUnaudited) rItems = rItems.filter(i => i.is_audited !== false); // Handle undefined as true for older data

        return rItems;
    };

    const handleKiotVietAnalyze = async () => {
        if (!scanResult) return;
        setAnalyzingKiot(true);
        try {
            const allMissing = Object.values(scanResult.stores).flat();
            const overItems = scanResult.overItems || [];
            if (allMissing.length === 0) {
                toast.success('Không có sản phẩm thiếu để phân tích.');
                return;
            }

            const res = await InventoryArchiveService.analyzeMissingItemsWithKiotViet(allMissing, overItems);
            if (!res.success) throw new Error(res.error || 'Server không phản hồi');

            if (res.data) {
                const analyzedMissing = res.data.analyzedMissing;
                const newStores: Record<string, MissingProduct[]> = {};
                for (const item of analyzedMissing) {
                    if (!newStores[item.store_code]) newStores[item.store_code] = [];
                    newStores[item.store_code].push(item);
                }
                setScanResult({
                    ...scanResult,
                    stores: newStores
                });
                toast.success(`Đã tự động bù trừ chéo ${res.data.matchedCount} cặp sản phẩm qua KiotViet!`);
            }
        } catch (e: any) {
            toast.error('Lỗi kết nối KiotViet: ' + e.message);
        } finally {
            setAnalyzingKiot(false);
        }
    };

    const toggleScanItem = (key: string) => {
        setSelectedScanItems(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };

    const toggleAllScan = () => {
        const items = getScanFilteredItems();
        if (selectedScanItems.size === items.length) setSelectedScanItems(new Set());
        else setSelectedScanItems(new Set(items.map(i => `${i.store_code}:${i.barcode}:${i.shift}`)));
    };

    const handleCreateRecoveryFromScan = async () => {
        if (selectedScanItems.size === 0) { toast.error('Chưa chọn sản phẩm nào'); return; }
        setCreatingRecovery(true);
        let created = 0, failed = 0, skipped = 0;
        const allItems = getScanFilteredItems();
        const selectedItemsList = allItems.filter(item => {
            const key = `${item.store_code}:${item.barcode}:${item.shift}`;
            return selectedScanItems.has(key);
        });
        const barcodes = selectedItemsList.map(i => i.barcode).filter(Boolean);
        const barcodeToProductId = await RecoveryService.resolveProductIds(barcodes);
        for (const item of selectedItemsList) {
            const productId = item.product_id || barcodeToProductId[item.barcode];
            if (!productId) {
                skipped++;
                console.warn(`[Recovery] Skipped: no product_id for barcode ${item.barcode}`);
                continue;
            }

            try {
                const storeConfig = stores.find(s => s.code === item.store_code);
                const result = await RecoveryService.createRecoveryItem({
                    store_id: storeConfig?.id || item.store_code,
                    product_id: productId,
                    quantity: Math.abs(item.diff),
                    unit_price: 0,
                    reason: item.diff_reason || 'Kiểm kho phát hiện thiếu',
                    notes: `Tháng ${selectedMonth + 1}/${selectedYear} | Ca ${item.shift} | ${item.consecutive_missing_days} ngày liên tiếp`,
                });
                if (result.success) created++; else failed++;
            } catch { failed++; }
        }

        setCreatingRecovery(false);
        if (created > 0) {
            let msg = `Đã tạo ${created} phiếu truy thu`;
            if (failed > 0) msg += ` (${failed} lỗi)`;
            if (skipped > 0) msg += ` (${skipped} bỏ qua - không tìm thấy SP)`;
            toast.success(msg);
            loadRecoveryItems();
            setActiveTab('list');
        } else {
            let msg = `Không thể tạo phiếu truy thu.`;
            if (failed > 0) msg += ` ${failed} lỗi.`;
            if (skipped > 0) msg += ` ${skipped} SP không tìm thấy trong hệ thống.`;
            toast.error(msg);
        }
    };

    const scanFilteredItems = getScanFilteredItems();
    const storeKeys = scanResult ? Object.keys(scanResult.stores).filter(k => (scanResult.stores[k]?.length || 0) > 0) : [];

    /* ── Render ── */
    return (
        <>
            <style>{CSS_TEXT}</style>
            <div className="rv-root">

                {/* ───── Tab Header ───── */}
                <div className="rv-tab-header">
                    <div className="rv-tabs">
                        <button
                            className={`rv-tab ${activeTab === 'scan' ? 'active' : ''}`}
                            onClick={() => setActiveTab('scan')}
                        >
                            <span className="material-symbols-outlined rv-tab-icon">manage_search</span>
                            Quét & Phát hiện
                            {scanResult && scanResult.total_missing_products > 0 && (
                                <span className="rv-tab-badge">{scanResult.total_missing_products}</span>
                            )}
                        </button>
                        <button
                            className={`rv-tab ${activeTab === 'list' ? 'active' : ''}`}
                            onClick={() => setActiveTab('list')}
                        >
                            <span className="material-symbols-outlined rv-tab-icon">receipt_long</span>
                            Danh sách phiếu
                            {items.length > 0 && (
                                <span className="rv-tab-count">{items.length}</span>
                            )}
                        </button>
                    </div>
                </div>

                {/* ═══════ TAB 1: QUÉT & PHÁT HIỆN ═══════ */}
                {activeTab === 'scan' && (
                    <div className="rv-scan-tab">

                        {/* Step 1 — Select & Scan */}
                        <div className="rv-scan-config">
                            <div className="rv-scan-config-header">
                                <div className="rv-scan-step">
                                    <span className="rv-step-num">1</span>
                                    <div>
                                        <h3 className="rv-step-title">Chọn kỳ kiểm kho</h3>
                                        <p className="rv-step-desc">Chọn tháng bạn muốn quét sản phẩm mất</p>
                                    </div>
                                </div>
                            </div>

                            <div className="rv-scan-controls">
                                <div className="rv-scan-year">
                                    <label className="rv-scan-label">Năm</label>
                                    <select className="rv-scan-select" value={selectedYear} onChange={e => setSelectedYear(+e.target.value)} disabled={scanning}>
                                        {[now.getFullYear() - 1, now.getFullYear()].map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="rv-scan-months">
                                    <label className="rv-scan-label">Tháng</label>
                                    <div className="rv-month-grid">
                                        {MONTHS.map((m, idx) => (
                                            <button
                                                key={idx}
                                                className={`rv-month-btn ${selectedMonth === idx ? 'active' : ''}`}
                                                onClick={() => setSelectedMonth(idx)}
                                                disabled={scanning}
                                            >
                                                {idx + 1}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <button className="rv-scan-btn" onClick={handleScan} disabled={scanning}>
                                    {scanning ? (
                                        <>
                                            <span className="material-symbols-outlined rv-spin" style={{ fontSize: 18 }}>progress_activity</span>
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

                            {/* Progress */}
                            {scanning && (
                                <div className="rv-scan-progress">
                                    <div className="rv-progress-bar">
                                        <div
                                            className="rv-progress-fill"
                                            style={{ width: scanProgress.total ? `${(scanProgress.current / scanProgress.total) * 100}%` : '0%' }}
                                        />
                                    </div>
                                    <span className="rv-progress-text">
                                        📄 {scanProgress.fileName} ({scanProgress.current}/{scanProgress.total})
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Step 2 — Results */}
                        {scanResult && (
                            <div className="rv-scan-results">
                                <div className="rv-scan-config-header">
                                    <div className="rv-scan-step">
                                        <span className="rv-step-num">2</span>
                                        <div>
                                            <h3 className="rv-step-title">Kết quả quét</h3>
                                            <p className="rv-step-desc">
                                                Tháng {selectedMonth + 1}/{selectedYear} — {scanResult.total_files_scanned} file, {scanResult.total_missing_products} sản phẩm thiếu
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Result Summary Chips */}
                                <div className="rv-result-chips">
                                    <div className="rv-result-chip">
                                        <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#6366f1' }}>description</span>
                                        <strong>{scanResult.total_files_scanned}</strong> file
                                    </div>
                                    <div className="rv-result-chip rv-result-chip-alert">
                                        <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#ef4444' }}>error</span>
                                        <strong>{scanResult.total_missing_products}</strong> SP thiếu
                                    </div>
                                    <div className="rv-result-chip">
                                        <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#10b981' }}>store</span>
                                        <strong>{storeKeys.length}</strong> cửa hàng
                                    </div>
                                    {scanResult.errors.length > 0 && (
                                        <div className="rv-result-chip rv-result-chip-warn">
                                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>warning</span>
                                            {scanResult.errors.length} lỗi
                                        </div>
                                    )}
                                    <button
                                        className="rv-btn-analyze-kiot"
                                        onClick={handleKiotVietAnalyze}
                                        disabled={analyzingKiot || scanResult.total_missing_products === 0}
                                    >
                                        {analyzingKiot ? (
                                            <><span className="material-symbols-outlined rv-spin" style={{ fontSize: 16 }}>progress_activity</span> Đang phân tích...</>
                                        ) : (
                                            <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>robot_2</span> AI Kiểm tra KiotViet</>
                                        )}
                                    </button>
                                </div>

                                {scanResult.total_missing_products > 0 && (
                                    <>
                                        {/* Store Filter */}
                                        <div className="rv-store-filter">
                                            <button className={`rv-store-chip ${selectedStore === 'ALL' ? 'active' : ''}`} onClick={() => setSelectedStore('ALL')}>
                                                Tất cả ({Object.values(scanResult.stores).flat().length})
                                            </button>
                                            {storeKeys.map(code => (
                                                <button
                                                    key={code}
                                                    className={`rv-store-chip ${selectedStore === code ? 'active' : ''}`}
                                                    onClick={() => setSelectedStore(code)}
                                                >
                                                    {code} ({scanResult.stores[code].length})
                                                </button>
                                            ))}
                                        </div>

                                        {/* Smart Recovery Filters */}
                                        <div className="rv-smart-filters">
                                            <label className="rv-smart-filter">
                                                <input type="checkbox" checked={hideOffset} onChange={e => setHideOffset(e.target.checked)} />
                                                <span>Ẩn SP đã bù trừ chéo</span>
                                            </label>
                                            <label className="rv-smart-filter">
                                                <input type="checkbox" checked={hideUnaudited} onChange={e => setHideUnaudited(e.target.checked)} />
                                                <span>Ẩn SP chưa quét (không Audit)</span>
                                            </label>
                                        </div>

                                        {/* Missing Products Table */}
                                        <div className="rv-scan-table-wrap">
                                            <table className="rv-table">
                                                <thead>
                                                    <tr>
                                                        <th style={{ width: 36 }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedScanItems.size === scanFilteredItems.length && scanFilteredItems.length > 0}
                                                                onChange={toggleAllScan}
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
                                                    {scanFilteredItems.length === 0 ? (
                                                        <tr><td colSpan={9} className="rv-empty-td">
                                                            <div className="rv-empty">
                                                                <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#10b981' }}>check_circle</span>
                                                                <p className="rv-empty-title">Không có sản phẩm thiếu</p>
                                                            </div>
                                                        </td></tr>
                                                    ) : scanFilteredItems.map((item, idx) => {
                                                        const key = `${item.store_code}:${item.barcode}:${item.shift}`;
                                                        return (
                                                            <tr key={key + idx} className="rv-row">
                                                                <td>
                                                                    <input type="checkbox" checked={selectedScanItems.has(key)} onChange={() => toggleScanItem(key)} />
                                                                </td>
                                                                <td>
                                                                    <div className="rv-product-name">{item.product_name}</div>
                                                                    <div className="rv-barcode">{item.barcode}</div>
                                                                    <div className="rv-smart-tags">
                                                                        {item.is_offset && <span className="rv-tag rv-tag-offset" title={`KiotViet bù trừ chéo với SP: ${item.offset_with_barcode}`}>Bù trừ: {item.offset_with_barcode}</span>}
                                                                        {item.is_audited === false && <span className="rv-tag rv-tag-warn" title="Nhân viên chưa dùng máy quét thực tế món này">Chưa kiểm tay</span>}
                                                                        {item.is_new_stock_error && <span className="rv-tag rv-tag-danger">Nghi lỗi GRN</span>}
                                                                    </div>
                                                                </td>
                                                                <td><span className="rv-store-tag">{item.store_code}</span></td>
                                                                <td className="rv-center">{item.shift}</td>
                                                                <td className="rv-center rv-mono">{item.system_stock}</td>
                                                                <td className="rv-center rv-mono">{item.actual_stock ?? '—'}</td>
                                                                <td className="rv-center">
                                                                    <span className="rv-diff-badge">{item.diff}</span>
                                                                </td>
                                                                <td className="rv-center">
                                                                    <span className="rv-days-badge">{item.consecutive_missing_days}d</span>
                                                                </td>
                                                                <td className="rv-date-cell">{item.last_positive_date || '—'}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Action Footer */}
                                        <div className="rv-scan-footer">
                                            <span className="rv-scan-footer-info">
                                                {selectedScanItems.size > 0
                                                    ? `Đã chọn ${selectedScanItems.size} sản phẩm`
                                                    : 'Chọn sản phẩm thiếu để tạo phiếu truy thu'
                                                }
                                            </span>
                                            <button
                                                className="rv-btn-create-from-scan"
                                                disabled={selectedScanItems.size === 0 || creatingRecovery}
                                                onClick={handleCreateRecoveryFromScan}
                                            >
                                                {creatingRecovery ? (
                                                    <>
                                                        <span className="material-symbols-outlined rv-spin" style={{ fontSize: 16 }}>progress_activity</span>
                                                        Đang tạo...
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>receipt_long</span>
                                                        Tạo {selectedScanItems.size} phiếu truy thu
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* No scan yet placeholder */}
                        {!scanResult && !scanning && (
                            <div className="rv-scan-placeholder">
                                <div className="rv-scan-placeholder-icon">
                                    <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#c7d2fe' }}>manage_search</span>
                                </div>
                                <h3 className="rv-scan-placeholder-title">Bắt đầu quét để phát hiện sản phẩm mất</h3>
                                <p className="rv-scan-placeholder-desc">
                                    Hệ thống sẽ so sánh dữ liệu kiểm kho hàng ngày để tìm ra<br />
                                    các sản phẩm bị thiếu liên tục trong tháng đã chọn.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* ═══════ TAB 2: DANH SÁCH PHIẾU ═══════ */}
                {activeTab === 'list' && (
                    <div className="rv-list-tab">

                        {/* Toolbar */}
                        <div className="rv-toolbar-card">
                            <div className="rv-toolbar">
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
                                <div className="rv-toolbar-actions">
                                    <button className="rv-btn-refresh" onClick={loadRecoveryItems} disabled={loading}>
                                        <span className={`material-symbols-outlined ${loading ? 'rv-spin' : ''}`} style={{ fontSize: 18 }}>refresh</span>
                                        Làm mới
                                    </button>
                                    <button className="rv-btn-create" onClick={() => setShowAddModal(true)}>
                                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
                                        Tạo phiếu
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Table */}
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
                                                <th style={{ width: 120 }}>Phụ trách</th>
                                                <th style={{ width: 110 }}>Trạng thái</th>
                                                <th style={{ width: 150 }}>Ngày tạo</th>
                                                <th style={{ width: 70, textAlign: 'center' }}>Chi tiết</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredItems.length === 0 ? (
                                                <tr><td colSpan={10} className="rv-empty-td">
                                                    <div className="rv-empty">
                                                        <div className="rv-empty-icon">
                                                            <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#cbd5e1' }}>inbox</span>
                                                        </div>
                                                        <p className="rv-empty-title">Không có dữ liệu</p>
                                                        <p className="rv-empty-sub">Chưa có phiếu truy thu nào{selectedStatus !== 'ALL' ? ' với trạng thái đã chọn' : ''}</p>
                                                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                                            <button className="rv-empty-btn" onClick={() => setActiveTab('scan')}>
                                                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>manage_search</span>
                                                                Quét phát hiện
                                                            </button>
                                                            <button className="rv-empty-btn" onClick={() => setShowAddModal(true)}>
                                                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
                                                                Tạo thủ công
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
                                                            {item.assigned_to_name ? (
                                                                <div className="rv-assignee-cell">
                                                                    <div className="rv-assignee-avatar">{item.assigned_to_name.charAt(0)}</div>
                                                                    <span className="rv-assignee-name">{item.assigned_to_name}</span>
                                                                </div>
                                                            ) : (
                                                                <span className="rv-no-assignee">
                                                                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>person_off</span>
                                                                </span>
                                                            )}
                                                        </td>
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
                            <div className="rv-footer">
                                <span>Tổng: <strong>{items.length}</strong> phiếu</span>
                                <span>Hiển thị: <strong>{filteredItems.length}</strong></span>
                            </div>
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
        </>
    );
};

export default RecoveryView;

/* ══════ CSS ══════ */
const CSS_TEXT = `
.rv-root { display:flex; flex-direction:column; gap:0; padding-top:16px; height:calc(100vh - 140px); min-height:0; }

/* ── Tab Header ── */
.rv-tab-header {
    flex-shrink: 0;
    padding: 0 0 16px;
}
.rv-tabs {
    display: inline-flex;
    background: #f1f5f9;
    border-radius: 14px;
    padding: 4px;
    gap: 4px;
}
.rv-tab {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 10px 20px; border-radius: 10px;
    border: none; background: transparent;
    font-size: 13px; font-weight: 700;
    color: #64748b; cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
}
.rv-tab:hover { color: #334155; background: rgba(255,255,255,0.5); }
.rv-tab.active {
    background: #fff;
    color: #0f172a;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03);
}
.rv-tab-icon { font-size: 18px !important; }
.rv-tab-badge {
    background: linear-gradient(135deg, #ef4444, #dc2626);
    color: #fff; font-size: 10px; font-weight: 800;
    padding: 1px 7px; border-radius: 99px;
    min-width: 18px; text-align: center;
}
.rv-tab-count {
    background: #e0e7ff; color: #4338ca;
    font-size: 10px; font-weight: 800;
    padding: 1px 7px; border-radius: 99px;
}

/* ── Scan Tab ── */
.rv-scan-tab { display: flex; flex-direction: column; gap: 16px; flex: 1; min-height: 0; overflow-y: auto; }

.rv-scan-config, .rv-scan-results {
    background: #fff; border-radius: 16px; border: 1px solid #e5e7eb;
    padding: 20px; transition: box-shadow 0.25s;
}
.rv-scan-config:hover, .rv-scan-results:hover { box-shadow: 0 4px 20px -4px rgba(0,0,0,0.06); }

.rv-scan-config-header { margin-bottom: 16px; }
.rv-scan-step { display: flex; align-items: flex-start; gap: 14px; }
.rv-step-num {
    width: 32px; height: 32px; border-radius: 50%;
    background: linear-gradient(135deg, #6366f1, #4338ca);
    color: #fff; font-size: 14px; font-weight: 800;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
}
.rv-step-title { font-size: 15px; font-weight: 800; color: #0f172a; margin: 0 0 2px; }
.rv-step-desc { font-size: 12px; color: #94a3b8; margin: 0; font-weight: 500; }

.rv-scan-controls { display: flex; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
.rv-scan-year { display: flex; flex-direction: column; gap: 6px; }
.rv-scan-months { display: flex; flex-direction: column; gap: 6px; flex: 1; }
.rv-scan-label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; }
.rv-scan-select {
    padding: 8px 12px; background: #f8fafc; border: 1.5px solid #e2e8f0;
    border-radius: 10px; font-size: 13px; font-weight: 600; color: #334155;
    outline: none; cursor: pointer;
}
.rv-month-grid { display: flex; gap: 4px; flex-wrap: wrap; }
.rv-month-btn {
    width: 36px; height: 32px; border-radius: 8px; border: 1.5px solid #e2e8f0;
    background: #fff; font-size: 12px; font-weight: 700; color: #64748b;
    cursor: pointer; transition: all 0.15s;
}
.rv-month-btn:hover { border-color: #a5b4fc; color: #4f46e5; background: #eef2ff; }
.rv-month-btn.active {
    background: linear-gradient(135deg, #6366f1, #4338ca);
    color: #fff; border-color: #6366f1;
    box-shadow: 0 2px 8px -2px rgba(99,102,241,0.35);
}
.rv-month-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.rv-scan-btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 10px 22px; border-radius: 12px; border: none;
    background: linear-gradient(135deg, #6366f1, #4338ca);
    color: #fff; font-size: 13px; font-weight: 700;
    cursor: pointer; transition: transform 0.15s, box-shadow 0.2s;
    box-shadow: 0 4px 14px -3px rgba(99,102,241,0.4);
    flex-shrink: 0; align-self: flex-end;
}
.rv-scan-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 20px -4px rgba(99,102,241,0.5); }
.rv-scan-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

/* Progress */
.rv-scan-progress { margin-top: 16px; }
.rv-progress-bar { height: 4px; background: #e5e7eb; border-radius: 4px; overflow: hidden; }
.rv-progress-fill { height: 100%; background: linear-gradient(90deg, #6366f1, #818cf8); border-radius: 4px; transition: width 0.3s; }
.rv-progress-text { font-size: 11px; color: #94a3b8; margin-top: 6px; display: block; font-weight: 500; }

/* Result Chips */
.rv-result-chips { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
.rv-result-chip {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 14px; background: #f8fafc; border: 1px solid #e5e7eb;
    border-radius: 10px; font-size: 12px; color: #475569; font-weight: 500;
}
.rv-result-chip strong { font-weight: 800; color: #0f172a; }
.rv-result-chip-alert { background: #fef2f2; border-color: #fecaca; }
.rv-result-chip-alert strong { color: #dc2626; }
.rv-result-chip-warn { background: #fffbeb; border-color: #fde68a; color: #92400e; }

/* Store Filter */
.rv-store-filter { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
.rv-store-chip {
    padding: 5px 12px; border-radius: 20px; font-size: 11px; font-weight: 700;
    border: 1.5px solid #e2e8f0; background: #fff; color: #64748b;
    cursor: pointer; transition: all 0.15s;
}
.rv-store-chip:hover { border-color: #a5b4fc; color: #4f46e5; }
.rv-store-chip.active { background: #eef2ff; color: #4f46e5; border-color: #a5b4fc; }

/* Scan Table */
.rv-scan-table-wrap { max-height: 380px; overflow: auto; border-radius: 10px; border: 1px solid #e5e7eb; }

/* Scan Item Badges */
.rv-store-tag { padding: 2px 8px; background: #eef2ff; color: #4338ca; border-radius: 6px; font-size: 10px; font-weight: 800; }
.rv-diff-badge { padding: 2px 8px; background: #fef2f2; color: #dc2626; border-radius: 6px; font-size: 11px; font-weight: 800; font-family: monospace; }
.rv-days-badge { padding: 2px 8px; background: #fef3c7; color: #92400e; border-radius: 6px; font-size: 11px; font-weight: 700; }
.rv-center { text-align: center; }
.rv-mono { font-family: monospace; font-size: 12px; }
.rv-date-cell { font-size: 11px; color: #94a3b8; }

/* Scan Footer */
.rv-scan-footer {
    display: flex; align-items: center; justify-content: space-between;
    margin-top: 12px; padding-top: 16px; border-top: 1px solid #f1f5f9;
}
.rv-scan-footer-info { font-size: 12px; color: #94a3b8; font-weight: 600; }
.rv-btn-create-from-scan {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 10px 20px; border-radius: 12px; border: none;
    background: linear-gradient(135deg, #10b981, #059669);
    color: #fff; font-size: 13px; font-weight: 700;
    cursor: pointer; transition: transform 0.15s, box-shadow 0.2s;
    box-shadow: 0 4px 14px -3px rgba(16,185,129,0.4);
}
.rv-btn-create-from-scan:hover { transform: translateY(-1px); box-shadow: 0 6px 20px -4px rgba(16,185,129,0.5); }
.rv-btn-create-from-scan:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

/* Placeholder */
.rv-scan-placeholder {
    flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 12px; padding: 60px 20px;
    background: #fff; border-radius: 16px; border: 1px solid #e5e7eb;
}
.rv-scan-placeholder-icon {
    width: 80px; height: 80px; border-radius: 50%;
    background: #f1f5f9; display: flex; align-items: center; justify-content: center;
}
.rv-scan-placeholder-title { font-size: 16px; font-weight: 800; color: #334155; margin: 0; }
.rv-scan-placeholder-desc { font-size: 13px; color: #94a3b8; margin: 0; text-align: center; line-height: 1.6; }

/* ── List Tab ── */
.rv-list-tab { display: flex; flex-direction: column; gap: 16px; flex: 1; min-height: 0; }

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

/* Assignee */
.rv-assignee-cell { display:flex; align-items:center; gap:6px; }
.rv-assignee-avatar {
    width:24px; height:24px; border-radius:50%; flex-shrink:0;
    background:linear-gradient(135deg,#6366f1,#4338ca); color:#fff;
    font-size:10px; font-weight:800;
    display:flex; align-items:center; justify-content:center;
}
.rv-assignee-name { font-size:12px; font-weight:600; color:#1e293b; white-space:nowrap; }
.rv-no-assignee { color:#cbd5e1; display:flex; align-items:center; }

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
/* Smart Recovery Tags & Filters */
.rv-smart-filters {
    display: flex; gap: 16px; margin-bottom: 12px;
    padding: 10px 16px; background: #fafafa; border-radius: 8px; border: 1px dashed #e2e8f0;
}
.rv-smart-filter {
    display: flex; align-items: center; gap: 6px; cursor: pointer;
    font-size: 13px; color: #475569; font-weight: 500;
}
.rv-smart-filter input { width: 14px; height: 14px; cursor: pointer; }
.rv-smart-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.rv-tag {
    font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 600; white-space: nowrap;
}
.rv-tag-offset { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
.rv-tag-warn { background: #fef9c3; color: #854d0e; border: 1px solid #fef08a; }
.rv-tag-danger { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }

.rv-btn-analyze-kiot {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 14px; background: linear-gradient(135deg, #8b5cf6, #3b82f6);
    color: #fff; border: none; border-radius: 6px;
    font-size: 13px; font-weight: 600; cursor: pointer;
    box-shadow: 0 2px 4px rgba(59,130,246,0.3);
    margin-left: auto;
}
.rv-btn-analyze-kiot:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
}
.rv-btn-analyze-kiot:disabled {
    background: #cbd5e1; cursor: not-allowed; box-shadow: none;
}
`;
