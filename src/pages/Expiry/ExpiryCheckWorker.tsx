import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ExpiryCheckService, {
    ExpiryCheckCategory,
    ExpiryCheckSession,
    ExpiryCheckResult,
} from '../../services/expiryCheck';
import { supabase } from '../../lib/supabase';
import PortalHeader from '../../components/PortalHeader';
import ConfirmModal from '../../components/ConfirmModal';
import { useToast } from '../../contexts';
import '../../styles/hq-sidebar.css';

interface Store { id: string; name: string; code: string; }
interface User { id: string; display_name?: string; full_name?: string; store_id?: string; }

interface ExpiryCheckWorkerProps {
    user: User;
    currentDate?: string;
    currentShift?: number;
}

const fmtDate = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

const ExpiryCheckWorker: React.FC<ExpiryCheckWorkerProps> = ({ user, currentDate, currentShift }) => {
    const navigate = useNavigate();
    const today = currentDate || new Date().toISOString().split('T')[0];
    const defaultShift = currentShift || (new Date().getHours() < 14 ? 1 : 2);
    const toast = useToast();

    const [categories, setCategories] = useState<ExpiryCheckCategory[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [selectedCatId, setSelectedCatId] = useState<string>('');
    const [selectedStoreId, setSelectedStoreId] = useState<string>(user.store_id || '');
    const [selectedShift, setSelectedShift] = useState(defaultShift);
    const [checkDate, setCheckDate] = useState(today);
    const [session, setSession] = useState<ExpiryCheckSession | null>(null);
    const [results, setResults] = useState<ExpiryCheckResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [completing, setCompleting] = useState(false);
    const [qtyMap, setQtyMap] = useState<Record<string, string>>({});
    const [dateMap, setDateMap] = useState<Record<string, string>>({});
    const [noteMap, setNoteMap] = useState<Record<string, string>>({});
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('ALL');
    const [syncing, setSyncing] = useState(false);
    const [showSyncModal, setShowSyncModal] = useState(false);
    const [confirmComplete, setConfirmComplete] = useState<{ show: boolean; message: string }>({ show: false, message: '' });
    const [catPopoverOpen, setCatPopoverOpen] = useState(false);
    const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const catPopoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (catPopoverRef.current && !catPopoverRef.current.contains(e.target as Node)) {
                setCatPopoverOpen(false);
            }
        };
        if (catPopoverOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [catPopoverOpen]);

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

    const loadSession = useCallback(async (quiet = false) => {
        if (!selectedCatId || !selectedStoreId) return;
        if (!quiet) setLoading(true);
        const res = await ExpiryCheckService.getSession({
            categoryId: selectedCatId,
            storeId: selectedStoreId,
            checkDate,
            shift: selectedShift,
        });
        if (res.success && res.session) {
            setSession(res.session);
            if (res.session.status !== 'COMPLETED') {
                await ExpiryCheckService.syncSessionResults(res.session.id, selectedCatId);
            }
            const rRes = await ExpiryCheckService.getSessionResults(res.session.id);
            if (rRes.success) {
                setResults(rRes.data);
                const initQty: Record<string, string> = {};
                const initDate: Record<string, string> = {};
                const initNote: Record<string, string> = {};
                rRes.data.forEach(r => {
                    initQty[r.id] = r.qty !== null ? String(r.qty) : '';
                    initDate[r.id] = r.expiry_date || '';
                    initNote[r.id] = r.note || '';
                });
                setQtyMap(initQty);
                setDateMap(initDate);
                setNoteMap(initNote);
            }
        } else {
            setSession(null);
            setResults([]);
        }
        setFilterStatus('ALL');
        setSearch('');
        if (!quiet) setLoading(false);
    }, [selectedCatId, selectedStoreId, checkDate, selectedShift]);

    useEffect(() => { loadSession(false); }, [loadSession]);

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
            loadSession(false);
        }
        setLoading(false);
    };

    /* ── Expiry status helpers ── */
    const selectedCat = categories.find(c => c.id === selectedCatId);
    const nearExpiryDays = selectedCat?.near_expiry_days || 30;

    const getExpiryInfo = (resultId: string): { status: string; label: string; daysLeft: number | null } => {
        const dateStr = dateMap[resultId];
        if (!dateStr) return { status: 'UNKNOWN', label: 'Chưa có', daysLeft: null };
        const expiryMs = new Date(dateStr + 'T00:00:00').getTime();
        if (isNaN(expiryMs)) return { status: 'UNKNOWN', label: 'Chưa có', daysLeft: null };
        const diffDays = Math.ceil((expiryMs - Date.now()) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return { status: 'EXPIRED', label: `Hết hạn ${Math.abs(diffDays)} ngày`, daysLeft: diffDays };
        if (diffDays === 0) return { status: 'EXPIRED', label: 'Hết hạn hôm nay', daysLeft: 0 };
        if (diffDays <= nearExpiryDays) return { status: 'NEAR_EXPIRY', label: `Còn ${diffDays} ngày`, daysLeft: diffDays };
        return { status: 'OK', label: `Còn ${diffDays} ngày`, daysLeft: diffDays };
    };

    /* ── Handle field changes with auto-save ── */
    const handleFieldChange = (resultId: string, field: 'qty' | 'date' | 'note', val: string) => {
        if (field === 'qty') setQtyMap(prev => ({ ...prev, [resultId]: val }));
        else if (field === 'date') setDateMap(prev => ({ ...prev, [resultId]: val }));
        else setNoteMap(prev => ({ ...prev, [resultId]: val }));

        clearTimeout(saveTimers.current[`${resultId}_${field}`]);
        saveTimers.current[`${resultId}_${field}`] = setTimeout(async () => {
            const qtyVal = field === 'qty' ? val : qtyMap[resultId];
            const dateVal = field === 'date' ? val : dateMap[resultId];
            const noteVal = field === 'note' ? val : noteMap[resultId];
            const num = qtyVal === '' ? null : parseFloat(qtyVal);

            if (field === 'qty' && qtyVal !== '' && isNaN(num!)) return;

            await ExpiryCheckService.updateResult(resultId, {
                qty: num,
                expiry_date: dateVal || null,
                note: noteVal,
                checked_at: new Date().toISOString(),
            });
            setResults(prev => prev.map(r => r.id === resultId
                ? { ...r, qty: num, expiry_date: dateVal || null, note: noteVal }
                : r
            ));
        }, 600);
    };

    /* ── Complete session ── */
    const executeComplete = async () => {
        if (!session) return;
        setConfirmComplete({ show: false, message: '' });
        setCompleting(true);
        await ExpiryCheckService.completeSession(session.id, user.id);
        setSession(prev => prev ? { ...prev, status: 'COMPLETED' } : prev);
        setCompleting(false);
    };

    const handleComplete = () => {
        if (!session) return;
        const checked = results.filter(r => qtyMap[r.id] !== '' || noteMap[r.id] !== '').length;
        if (checked < results.length) {
            setConfirmComplete({
                show: true,
                message: `Còn ${results.length - checked} sản phẩm chưa kiểm. Vẫn hoàn thành?`,
            });
            return;
        }
        executeComplete();
    };

    /* ── Print ── */
    const handlePrint = useCallback(() => {
        if (!session || results.length === 0) return;
        const storeName = stores.find(s => s.id === selectedStoreId)?.name || '';
        const now = new Date();
        const catName = selectedCat?.name || 'Kiểm Date';

        const tableRows = results
          .map((r, i) => {
            const nameStr = (r.product?.sp || r.product?.barcode || "—").trim();
            const barcodeStr = r.product?.name?.trim() || "-";
            const barcodeLast6 = barcodeStr.length >= 6 ? "....." + barcodeStr.slice(-6) : barcodeStr;
            const qtyStr = qtyMap[r.id] ?? (r.qty !== null ? String(r.qty) : '');
            const dateStr = dateMap[r.id] ? new Date(dateMap[r.id] + 'T00:00:00').toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '';
            const hasData = qtyStr || dateStr;

            return `<tr class="${hasData ? "checked-row" : ""}">
            <td class="stt-col">${i + 1}</td>
            <td class="name-col">${nameStr}</td>
            <td class="barcode-col">${barcodeLast6}</td>
            <td class="qty-col">${qtyStr}</td>
            <td class="date-col">${dateStr}</td>
          </tr>`;
          })
          .join("");

        const printCSS = `*{box-sizing:border-box}@media print{body{margin:0;padding:3mm;font-size:9px}.no-print{display:none}@page{size:80mm auto;margin:2mm}}body{font-family:"Segoe UI","Arial Unicode MS","Tahoma","Arial",sans-serif;margin:0;padding:3mm;font-size:9px;width:100%;max-width:80mm;line-height:1.2;color:#000}.header{text-align:center;margin-bottom:1mm;border-bottom:2px solid #000;padding-bottom:0.5mm}.header h2{margin:0;font-size:12px;font-weight:800;text-transform:uppercase;padding:0.5mm 1mm}.info{margin-bottom:2mm;font-size:8px;border-bottom:1px solid #ccc;padding:1mm 2mm}.info p{margin:1px 0;font-weight:500}.product-table{width:100%;border-collapse:collapse;font-size:8px;margin-bottom:2mm}.product-table th{background:#fff;color:#000;font-weight:900;text-align:center;padding:1mm;border-bottom:1px solid #000;font-size:9px;text-transform:uppercase;white-space:nowrap}.product-table td{padding:1mm;border-bottom:1px solid #ccc;vertical-align:top;font-weight:600;color:#000}.product-table tr:nth-child(even){background:#f8f8f8}.stt-col{width:7%;text-align:center;font-weight:900;font-size:10px}.name-col{width:42%;text-align:left;padding-left:2mm;word-wrap:break-word;line-height:1.4;font-weight:700;font-size:9px}.barcode-col{width:15%;text-align:center;font-weight:800;font-size:10px;color:#333}.qty-col,.date-col{width:18%;text-align:center;font-weight:800;font-size:10px}.checked-row{background:#e8f5e8!important}.checked-row .qty-col,.checked-row .date-col{background:#d4edda;font-weight:bold;color:#155724}.footer{margin-top:2mm;text-align:center;font-size:7px;border-top:1px solid #ccc;padding:1mm}.footer p{margin:1px 0}`;

        const html = `<!DOCTYPE html><html><head><title>Danh sách kiểm tra - ${storeName}</title><meta charset="UTF-8"><style>${printCSS}</style></head><body>
          <div class="header"><h2>DANH SÁCH ${catName.toUpperCase()}</h2></div>
          <div class="info"><p><strong>Ngày:</strong> ${fmtDate(session.check_date)} | <strong>Cửa hàng:</strong> ${storeName} | <strong>Tổng SP:</strong> ${results.length}</p></div>
          <table class="product-table">
            <thead><tr><th class="stt-col">STT</th><th class="name-col">TÊN SP</th><th class="barcode-col">BARCODE</th><th class="qty-col">SỐ LƯỢNG</th><th class="date-col">DATE</th></tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
          <div class="footer"><p>In lúc: ${now.toLocaleString("vi-VN")}</p></div>
        </body></html>`;

        const existingFrame = document.getElementById("printFrame") as HTMLIFrameElement;
        if (existingFrame) existingFrame.remove();

        const iframe = document.createElement("iframe");
        iframe.id = "printFrame";
        iframe.style.cssText = "position:fixed;width:0;height:0;border:none;left:-9999px;top:-9999px;";
        document.body.appendChild(iframe);

        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(html);
          doc.close();
          setTimeout(() => { iframe.contentWindow?.print(); }, 300);
        }
    }, [session, results, stores, selectedStoreId, selectedCat, qtyMap, noteMap]);

    /* ── Sync KiotViet stock quantities ── */
    const handleSync = async () => {
        if (!session || !selectedStoreId) return;
        setShowSyncModal(false);
        setSyncing(true);
        try {
            const res = await ExpiryCheckService.syncKiotVietStock(session.id, selectedStoreId);
            if (res.success) {
                toast.success(res.message || 'Đồng bộ thành công');
                await loadSession(true);
            } else {
                toast.error(res.message || 'Lỗi đồng bộ');
            }
        } catch (e) {
            toast.error('Lỗi kết nối khi đồng bộ');
        } finally {
            setSyncing(false);
        }
    };

    const isCompleted = session?.status === 'COMPLETED';

    /* ── Enhanced results with expiry info ── */
    const enhancedResults = useMemo(() => {
        return results.map(r => {
            const hasVal = r.qty !== null || !!qtyMap[r.id] || !!dateMap[r.id] || !!noteMap[r.id];
            const expiryInfo = getExpiryInfo(r.id);
            return { ...r, hasVal, expiryInfo };
        });
    }, [results, qtyMap, dateMap, noteMap]);

    const stats = useMemo(() => {
        return {
            total: enhancedResults.length,
            checked: enhancedResults.filter(r => r.hasVal).length,
            expired: enhancedResults.filter(r => r.expiryInfo.status === 'EXPIRED').length,
            near: enhancedResults.filter(r => r.expiryInfo.status === 'NEAR_EXPIRY').length,
            pending: enhancedResults.filter(r => !r.hasVal).length,
        }
    }, [enhancedResults]);

    const filteredResults = useMemo(() => {
        return enhancedResults.filter(r => {
            const matchSearch = (r.product?.name || '').toLowerCase().includes(search.toLowerCase()) ||
                (r.product?.sp || '').includes(search) ||
                (r.product?.barcode || '').includes(search);
            
            let matchStatus = true;
            if (filterStatus === 'PENDING') matchStatus = !r.hasVal;
            if (filterStatus === 'CHECKED') matchStatus = r.hasVal;
            if (filterStatus === 'EXPIRED') matchStatus = r.expiryInfo.status === 'EXPIRED';
            if (filterStatus === 'NEAR_EXPIRY') matchStatus = r.expiryInfo.status === 'NEAR_EXPIRY';

            return matchSearch && matchStatus;
        });
    }, [enhancedResults, search, filterStatus]);

    const progressPercent = results.length > 0 ? Math.round((stats.checked / stats.total) * 100) : 0;

    const tabs = [
        { key: 'ALL', label: 'Tất cả', count: stats.total, accent: 'bg-gray-600 dark:bg-gray-200 text-white dark:text-gray-800' },
        { key: 'PENDING', label: 'Chưa kiểm', count: stats.pending, accent: 'bg-gray-400 text-white' },
        { key: 'EXPIRED', label: 'Hết hạn', count: stats.expired, accent: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' },
        { key: 'NEAR_EXPIRY', label: 'Cận date', count: stats.near, accent: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' },
    ];

    /* ── Render expiry status badge ── */
    const renderStatusBadge = (info: { status: string; label: string; daysLeft: number | null }) => {
        if (info.status === 'UNKNOWN') {
            return (
                <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 w-[110px] rounded-md text-[12px] font-medium font-sans whitespace-nowrap bg-gray-100 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 shrink-0" />
                    {info.label}
                </span>
            );
        }
        if (info.status === 'EXPIRED') {
            return (
                <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 w-[110px] rounded-md text-[12px] font-semibold font-sans whitespace-nowrap bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                    {info.label}
                </span>
            );
        }
        if (info.status === 'NEAR_EXPIRY') {
            return (
                <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 w-[110px] rounded-md text-[12px] font-semibold font-sans whitespace-nowrap bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
                    {info.label}
                </span>
            );
        }
        return (
            <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 w-[110px] rounded-md text-[12px] font-semibold font-sans whitespace-nowrap bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                {info.label}
            </span>
        );
    };

    return (
        <div className="h-full flex flex-col dark:bg-[#0a0a0a]" style={{ background: '#F8F7F4' }}>
            <PortalHeader>
                <div className="hq-breadcrumb">
                    <span className="material-symbols-outlined hq-breadcrumb-icon">event_available</span>
                    <span className="hq-breadcrumb-title cursor-pointer hover:text-gray-900 dark:hover:text-white transition-colors" onClick={() => navigate('/')}>Trang chủ</span>
                    <span className="material-symbols-outlined hq-breadcrumb-sep">chevron_right</span>
                    <span className="hq-breadcrumb-current">Kiểm Date</span>
                </div>

                <div className="flex items-center gap-2">
                    {session && !isCompleted && (
                        <button 
                            onClick={() => setShowSyncModal(true)} 
                            disabled={syncing || results.length === 0} 
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-sm font-medium ${syncing ? 'text-blue-500' : 'text-gray-600 dark:text-gray-300'} hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                            title="Đồng bộ số lượng tồn KiotViet"
                        >
                            <span className={`material-symbols-outlined text-lg ${syncing ? 'animate-spin' : ''}`}>
                                {syncing ? 'progress_activity' : 'cloud_sync'}
                            </span>
                            <span className="hidden sm:inline">{syncing ? 'Đang sync...' : 'Đồng bộ'}</span>
                        </button>
                    )}
                    {session && (
                        <button onClick={handlePrint} disabled={results.length === 0} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 disabled:opacity-50">
                            <span className="material-symbols-outlined text-lg">print</span>
                        </button>
                    )}
                    
                    {!isCompleted && session && (
                        <button
                            onClick={handleComplete}
                            disabled={completing || stats.checked === 0}
                            className="flex items-center gap-2 px-4 py-1.5 ml-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold shadow-sm shadow-orange-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span className={`material-symbols-outlined text-lg ${completing ? 'animate-spin' : ''}`}>
                                {completing ? 'progress_activity' : 'check_circle'}
                            </span>
                            <span className="hidden sm:inline">Nộp báo cáo</span>
                        </button>
                    )}

                    {isCompleted && (
                        <div className="px-4 py-1.5 ml-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-lg font-semibold flex items-center gap-2">
                            <span className="material-symbols-outlined text-lg">verified</span>
                            Đã hoàn thành
                        </div>
                    )}
                </div>
            </PortalHeader>

            <div className="flex-1 overflow-y-auto p-4 lg:p-6">
                <div className="max-w-6xl mx-auto space-y-5">
                    
                    {/* Compact Header Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        {/* Compact Category Selector */}
                        <div className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.02)] border border-gray-200/80 dark:border-gray-800 p-4 flex flex-col justify-center min-h-[64px]" ref={catPopoverRef}>
                            <div className="flex items-center gap-1.5 mb-2.5">
                                <span className="material-symbols-outlined text-[18px] text-gray-400">inventory_2</span>
                                <h3 className="text-[12px] font-bold text-gray-500 uppercase tracking-wider">Danh mục sản phẩm</h3>
                            </div>
                            
                            {/* Custom category dropdown */}
                            <div className="relative">
                                <button
                                    onClick={() => setCatPopoverOpen(!catPopoverOpen)}
                                    className="w-full bg-gray-50 dark:bg-[#0a0a0a] rounded-lg border border-gray-100 dark:border-gray-800 p-1 flex items-center relative group h-[44px] hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors cursor-pointer"
                                >
                                    <div className="absolute inset-1 bg-white dark:bg-[#1a1a1a] rounded-md shadow-sm border border-gray-100 dark:border-gray-800"></div>
                                    
                                    <span className="material-symbols-outlined text-emerald-500 dark:text-emerald-400 text-[18px] ml-3 shrink-0 relative z-10">style</span>
                                    <span className="relative z-10 flex-1 text-left pl-2 pr-8 text-[14px] font-bold text-gray-800 dark:text-gray-200 truncate">
                                        {selectedCat?.name || 'Chọn danh mục'}
                                    </span>
                                    {selectedCat?.item_count !== undefined && (
                                        <span className="relative z-10 mr-8 text-[11px] font-semibold text-gray-400 whitespace-nowrap">{selectedCat.item_count} SP</span>
                                    )}
                                    <span className="material-symbols-outlined absolute right-3 text-gray-400 group-hover:text-emerald-500 transition-colors text-[18px] z-10">
                                        {catPopoverOpen ? 'expand_less' : 'unfold_more'}
                                    </span>
                                </button>

                                {catPopoverOpen && (
                                    <div className="absolute left-0 top-full mt-2 w-full min-w-[280px] bg-white dark:bg-[#1a1a1a] rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50">
                                        <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
                                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Danh mục kiểm date</span>
                                        </div>
                                        {categories.map(c => (
                                            <button
                                                key={c.id}
                                                onClick={() => {
                                                    setSelectedCatId(c.id);
                                                    setCatPopoverOpen(false);
                                                }}
                                                className={`w-full px-3 py-2.5 flex items-center gap-3 transition-colors text-left ${
                                                    c.id === selectedCatId
                                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                                                        : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                                                }`}
                                            >
                                                <span className={`material-symbols-outlined text-[20px] ${c.id === selectedCatId ? 'text-emerald-500' : 'text-gray-400'}`}>
                                                    {c.id === selectedCatId ? 'check_circle' : 'radio_button_unchecked'}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-[14px] font-semibold truncate">{c.name}</div>
                                                    {c.item_count !== undefined && (
                                                        <div className="text-[11px] text-gray-400">{c.item_count} sản phẩm</div>
                                                    )}
                                                </div>
                                                {c.id === selectedCatId && (
                                                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                                )}
                                            </button>
                                        ))}
                                        {categories.length === 0 && (
                                            <div className="px-3 py-4 text-center text-sm text-gray-400">Chưa có danh mục nào</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Compact Progress Card */}
                        <div className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.02)] border border-gray-200/80 dark:border-gray-800 p-4 flex flex-col justify-center min-h-[64px]">
                            {session ? (
                                <div className="space-y-2">
                                    <div className="flex justify-between items-baseline">
                                        <div className="flex items-baseline gap-1.5">
                                            <span className="text-[22px] font-extrabold text-gray-900 dark:text-white leading-none tracking-tight">{stats.checked}/{stats.total}</span>
                                            <span className="text-[13px] text-gray-500 font-medium leading-none">đã kiểm</span>
                                        </div>
                                        <div className="text-[16px] font-bold text-emerald-500 leading-none">{progressPercent}%</div>
                                    </div>
                                    <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                                        <div
                                            className="bg-emerald-500 h-full rounded-full transition-all duration-700 ease-out"
                                            style={{ width: `${progressPercent}%` }}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="flex justify-between items-baseline">
                                        <div className="flex items-baseline gap-1.5 opacity-50">
                                            <span className="text-[22px] font-extrabold text-gray-400 dark:text-gray-500 leading-none tracking-tight">0/0</span>
                                            <span className="text-[13px] text-gray-400 font-medium leading-none">đã kiểm</span>
                                        </div>
                                        {categories.length > 0 && selectedCatId ? (
                                            <button onClick={handleStartSession} className="text-[13px] font-bold text-emerald-500 hover:text-emerald-600 active:scale-95 transition-all outline-none">
                                                BẮT ĐẦU KIỂM
                                            </button>
                                        ) : (
                                            <div className="text-[16px] font-bold text-emerald-500/50 leading-none">0%</div>
                                        )}
                                    </div>
                                    <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden opacity-50">
                                        <div className="bg-emerald-500 h-full w-0" />
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>

                    {/* Table Area */}
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                            <p className="text-sm font-medium text-gray-500">Đang tải dữ liệu...</p>
                        </div>
                    ) : !session ? (
                        <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 py-24 flex flex-col items-center justify-center text-center">
                            <div className="w-20 h-20 bg-gray-50 dark:bg-[#111] rounded-full flex items-center justify-center mb-5 text-gray-300 dark:text-gray-700">
                                <span className="material-symbols-outlined text-5xl">receipt_long</span>
                            </div>
                            <h3 className="text-lg font-bold text-gray-400 dark:text-gray-500 mb-1">
                                {categories.length === 0 ? 'Chưa có danh mục nào được tạo' : 'Chưa có dữ liệu'}
                            </h3>
                            <p className="text-sm text-gray-400 opacity-60">Hãy bắt đầu phiên kiểm date để xem danh sách sản phẩm.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Search & Tabs */}
                            <div className="flex flex-col xl:flex-row gap-4">
                                <div className="relative flex-1 group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <span className="material-symbols-outlined text-gray-400 group-focus-within:text-orange-500 transition-colors">search</span>
                                    </div>
                                    <input
                                        value={search} onChange={e => setSearch(e.target.value)}
                                        className="block w-full pl-12 pr-10 py-3.5 border-none ring-1 ring-gray-200 dark:ring-gray-800 rounded-2xl bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-orange-500 shadow-sm transition-shadow outline-none font-medium"
                                        placeholder="Tìm sản phẩm (tên, barcode)..."
                                    />
                                    {search && (
                                        <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                            <span className="material-symbols-outlined text-sm">close</span>
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-center bg-white dark:bg-[#1a1a1a] p-1.5 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-x-auto hide-scrollbar">
                                    {tabs.map(t => {
                                        const isActive = filterStatus === t.key;
                                        return (
                                            <button
                                                key={t.key}
                                                onClick={() => setFilterStatus(t.key)}
                                                className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${isActive
                                                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm'
                                                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                                                    }`}
                                            >
                                                {t.label}
                                                <span className={`text-[11px] py-0.5 px-2 rounded-md ${isActive ? 'bg-gray-700 dark:bg-gray-200 text-white dark:text-gray-800' : t.accent}`}>
                                                    {t.count}
                                                </span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Data Table */}
                            {filteredResults.length === 0 ? (
                                <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-200 dark:border-gray-800 py-20 flex flex-col items-center justify-center text-center">
                                    <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800/50 rounded-full flex items-center justify-center mb-4">
                                        <span className="material-symbols-outlined text-3xl text-gray-400">inventory_2</span>
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Không tìm thấy</h3>
                                    <p className="text-sm text-gray-500">Hãy thử tìm với từ khóa hoặc bộ lọc khác.</p>
                                </div>
                            ) : (
                                <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
                                    <div className="overflow-x-auto scrollbar-thin">
                                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                                            <thead className="bg-gray-50/50 dark:bg-[#111]">
                                                <tr>
                                                    <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-10">#</th>
                                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Tên sản phẩm</th>
                                                    <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Barcode</th>
                                                    <th className="px-3 py-3 text-center text-xs font-bold text-orange-600 dark:text-orange-500 uppercase tracking-wider w-24">Số lượng</th>
                                                    <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-28">HSD</th>
                                                    <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-36">Trạng thái</th>
                                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-44">Ghi chú</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                                {filteredResults.map((r, i) => {
                                                    const val = qtyMap[r.id] ?? (r.qty !== null ? String(r.qty) : '');
                                                    const noteVal = noteMap[r.id] || '';
                                                    const hasVal = r.hasVal;
                                                    const info = r.expiryInfo;
                                                    const canEdit = !isCompleted;

                                                    const isExpired = info.status === 'EXPIRED';
                                                    const isNearExpiry = info.status === 'NEAR_EXPIRY';

                                                    const rowClass = hasVal
                                                        ? 'bg-emerald-50/20 dark:bg-emerald-900/5 hover:bg-emerald-50/40 dark:hover:bg-emerald-900/10'
                                                        : i % 2 === 0 ? 'bg-white dark:bg-[#1a1a1a] hover:bg-gray-50/80 dark:hover:bg-gray-800/30' : 'bg-gray-50/40 dark:bg-[#171717] hover:bg-gray-50/80 dark:hover:bg-gray-800/30';

                                                    const borderColorClass = isExpired ? 'border-red-400' : isNearExpiry ? 'border-orange-400' : hasVal ? 'border-emerald-400' : 'border-transparent';

                                                    return (
                                                        <tr key={r.id} className={`transition-colors border-l-4 ${borderColorClass} ${rowClass}`}>
                                                            {/* # */}
                                                            <td className="px-3 py-3 text-center text-xs text-gray-400 font-medium">{i + 1}</td>
                                                            
                                                            {/* Tên sản phẩm */}
                                                            <td className="px-5 py-3.5 max-w-[220px]">
                                                                <div className="flex flex-col gap-1">
                                                                    <span className="text-[14px] font-semibold text-gray-800 dark:text-gray-200 leading-snug line-clamp-2 tracking-tight">
                                                                        {r.product?.sp || r.product?.barcode || '—'}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            
                                                            {/* Barcode */}
                                                            <td className="px-4 py-3.5 text-center">
                                                                <span className="inline-flex items-center justify-center font-mono text-[11px] font-medium tracking-wider text-gray-500 dark:text-gray-400 bg-gray-100/80 dark:bg-gray-800/80 border border-gray-200/50 dark:border-gray-700/50 px-2.5 py-1 rounded-md shadow-sm">
                                                                    {r.product?.name || '-'}
                                                                </span>
                                                            </td>
                                                            
                                                            {/* Số lượng */}
                                                            <td className="px-3 py-3 text-center">
                                                                {!canEdit ? (
                                                                    <span className="font-extrabold text-[15px] font-sans text-gray-900 dark:text-white">{val || '-'}</span>
                                                                ) : (
                                                                    <input
                                                                        type="number"
                                                                        inputMode="numeric"
                                                                        value={val}
                                                                        onChange={e => handleFieldChange(r.id, 'qty', e.target.value)}
                                                                        onKeyDown={e => {
                                                                            if (['-', '+', 'e', 'E', '.', ','].includes(e.key)) e.preventDefault();
                                                                        }}
                                                                        max={99999}
                                                                        maxLength={5}
                                                                        className={`w-full h-9 px-1 text-center font-bold text-[15px] font-sans border rounded-lg outline-none transition-all duration-200 ${
                                                                            val ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500' :
                                                                            'bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 shadow-[0_1px_2px_rgba(0,0,0,0.02)]'
                                                                        }`}
                                                                        placeholder="-"
                                                                    />
                                                                )}
                                                            </td>
                                                            
                                                            {/* HSD */}
                                                            <td className="px-3 py-3 text-center">
                                                                {!canEdit ? (
                                                                    <span className={`text-[13px] font-bold ${
                                                                        isExpired ? 'text-red-600 dark:text-red-400' :
                                                                        isNearExpiry ? 'text-orange-600 dark:text-orange-400' :
                                                                        'text-gray-700 dark:text-gray-300'
                                                                    }`}>
                                                                        {dateMap[r.id] ? new Date(dateMap[r.id] + 'T00:00:00').toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}
                                                                    </span>
                                                                ) : (
                                                                    <input
                                                                        type="date"
                                                                        value={dateMap[r.id] || ''}
                                                                        onChange={e => handleFieldChange(r.id, 'date', e.target.value)}
                                                                        className={`w-full h-9 px-1.5 text-center text-[13px] font-semibold font-sans tracking-wide border rounded-lg outline-none transition-all duration-200 ${
                                                                            dateMap[r.id] 
                                                                                ? isExpired ? 'bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400 focus:ring-2 focus:ring-red-500/20 focus:border-red-500'
                                                                                : isNearExpiry ? 'bg-orange-50/50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800/50 text-orange-700 dark:text-orange-400 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500'
                                                                                : 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500'
                                                                            : 'bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 shadow-[0_1px_2px_rgba(0,0,0,0.02)]'
                                                                        }`}
                                                                    />
                                                                )}
                                                            </td>
                                                            
                                                            {/* Trạng thái */}
                                                            <td className="px-3 py-3 text-center">
                                                                {renderStatusBadge(info)}
                                                            </td>
                                                            
                                                            {/* Ghi chú */}
                                                            <td className="px-4 py-3">
                                                                {!canEdit ? (
                                                                    <span className="text-[13px] font-medium text-gray-600 dark:text-gray-400">{noteVal || '-'}</span>
                                                                ) : (
                                                                    <input
                                                                        type="text"
                                                                        value={noteVal}
                                                                        onChange={e => handleFieldChange(r.id, 'note', e.target.value)}
                                                                        className={`w-full h-9 px-2.5 text-[13px] font-medium font-sans border rounded-lg outline-none transition-all duration-200 placeholder-gray-400 shadow-[0_1px_2px_rgba(0,0,0,0.02)] ${
                                                                            noteVal
                                                                                ? 'bg-emerald-50/20 dark:bg-[#0a0a0a] border-emerald-200 dark:border-emerald-800/30 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500'
                                                                                : 'bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500'
                                                                        }`}
                                                                        placeholder="Nhập ghi chú..."
                                                                    />
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Sync Modal */}
            {showSyncModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSyncModal(false)}></div>
                    <div className="relative bg-white dark:bg-[#1a1a1a] rounded-2xl w-full max-w-sm shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                        <div className="p-6">
                            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center mb-4">
                                <span className="material-symbols-outlined text-2xl">cloud_sync</span>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Đồng bộ KiotViet</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                Lấy số liệu tồn kho mới nhất trên KiotViet điền tự động vào cột Số lượng.
                            </p>
                        </div>
                        <div className="flex border-t border-gray-100 dark:border-gray-800">
                            <button
                                onClick={() => setShowSyncModal(false)}
                                className="flex-1 py-3.5 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            >
                                Hủy bỏ
                            </button>
                            <div className="w-px bg-gray-100 dark:bg-gray-800"></div>
                            <button
                                onClick={handleSync}
                                className="flex-1 py-3.5 text-sm font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                            >
                                Đồng bộ ngay
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={confirmComplete.show}
                title="Xác nhận hoàn thành"
                message={confirmComplete.message}
                variant="warning"
                confirmText="Hoàn thành"
                onConfirm={executeComplete}
                onCancel={() => setConfirmComplete({ show: false, message: '' })}
                loading={completing}
            />
        </div>
    );
};

export default ExpiryCheckWorker;
