import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, InventoryProduct } from '../types';
import { InventoryService, DIFF_REASON_OPTIONS } from '../services';
import type { DiffReason } from '../services/inventory';
import { useToast } from '../contexts';
import ConfirmModal from '../components/ConfirmModal';

interface InventoryProps {
  user: User;
  onBack?: () => void;
}

const INVENTORY_CONFIG = {
  SHIFTS: [
    { id: 1, name: 'Ca 1', time: '06:00 - 14:00', icon: 'wb_sunny', color: 'from-amber-400 to-orange-400' },
    { id: 2, name: 'Ca 2', time: '14:00 - 22:00', icon: 'wb_twilight', color: 'from-blue-400 to-indigo-400' },
    { id: 3, name: 'Ca 3', time: '22:00 - 06:00', icon: 'dark_mode', color: 'from-purple-400 to-violet-400' }
  ],
  STATUS_CONFIG: {
    MATCHED: { label: 'Khớp', emoji: '✓', bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', icon: 'check_circle' },
    MISSING: { label: 'Thiếu', emoji: '↓', bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200', icon: 'trending_down' },
    OVER: { label: 'Thừa', emoji: '↑', bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', icon: 'trending_up' },
    PENDING: { label: 'Chờ', emoji: '•', bg: 'bg-gray-50', text: 'text-gray-400', border: 'border-gray-200', icon: 'pending' }
  }
};

const Inventory: React.FC<InventoryProps> = ({ user }) => {
  const navigate = useNavigate();
  const toast = useToast();
  const [shift, setShift] = useState(() => {
    // Auto-detect current shift based on time
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 14) return 1;
    if (hour >= 14 && hour < 22) return 2;
    return 3;
  });
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'CARD' | 'TABLE'>('CARD');
  const [showSyncModal, setShowSyncModal] = useState(false);
  // E-1: Blind count — hide system_stock until employee finishes entering actual_stock
  const [blindCount, setBlindCount] = useState(true);
  const [confirmSubmit, setConfirmSubmit] = useState<{
    show: boolean;
    message: string;
    title: string;
  }>({ show: false, message: '', title: '' });

  useEffect(() => {
    loadProducts();
  }, [shift, user.store]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const result = await InventoryService.getItems(user.store || 'BEE', shift);
      if (result.success && result.products) {
        setProducts(result.products);
      }
    } catch (error) {
      toast.error('Không thể tải dữ liệu kho');
    } finally {
      setLoading(false);
    }
  };

  const updateField = useCallback((productId: string, field: string, value: string) => {
    setProducts(prev => prev.map(p => {
      if (String(p.id) !== productId) return p;

      const updated = { ...p };

      if (field === 'actualStock') {
        const actual = value === '' ? null : parseInt(value);
        updated.actualStock = actual;

        if (actual !== null && updated.systemStock !== undefined && updated.systemStock !== null) {
          const diff = actual - updated.systemStock;
          updated.diff = diff;
          updated.status = diff === 0 ? 'MATCHED' : diff < 0 ? 'MISSING' : 'OVER';
        } else {
          updated.diff = null;
          updated.status = 'PENDING';
        }
      } else if (field === 'note') {
        updated.note = value;
      } else if (field === 'diffReason') {
        (updated as any).diffReason = value || null;
      }

      const backendField = field === 'actualStock' ? 'actual_stock' : field === 'diffReason' ? 'diff_reason' : field;
      InventoryService.updateItem(String(p.id), backendField, value, user.id, (user as any).role || 'EMPLOYEE');
      return updated;
    }));
  }, [user.id, user]);

  const handleSubmit = () => {
    const pending = stats.pending;
    const missing = stats.missing;

    let message = '';
    let title = '';

    if (pending > 0) {
      title = 'Còn sản phẩm chưa kiểm';
      message = `Còn ${pending} sản phẩm chưa kiểm.\n\nVẫn nộp báo cáo?`;
    } else if (missing > 0) {
      title = 'Tổng kết kiểm kho';
      message = `• Khớp: ${stats.matched}\n• Thiếu: ${stats.missing}\n• Thừa: ${stats.over}\n\nXác nhận nộp báo cáo?`;
    } else {
      title = 'Hoàn thành kiểm kho';
      message = 'Xác nhận nộp báo cáo kiểm kho?';
    }

    setConfirmSubmit({ show: true, message, title });
  };

  const doSubmit = async () => {
    setConfirmSubmit({ show: false, message: '', title: '' });
    setSubmitting(true);
    try {
      const res = await InventoryService.submitReport(user.store || 'BEE', shift, user.id);
      if (res.success) {
        toast.success(res.message || 'Đã nộp báo cáo thành công!');
        navigate('/');
      } else {
        toast.error(res.message || 'Lỗi khi nộp báo cáo');
      }
    } catch (e) {
      toast.error('Lỗi kết nối');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = useCallback(() => {
    if (products.length === 0) {
      toast.error('Không có sản phẩm nào để in');
      return;
    }

    const currentShiftInfo = INVENTORY_CONFIG.SHIFTS.find(s => s.id === shift)!;
    const now = new Date();

    const tableRows = products.map((p, i) => {
      const sapoStr = p.systemStock != null ? String(p.systemStock) : '';
      const thucTeStr = p.actualStock != null ? String(p.actualStock) : '';
      const isChecked = sapoStr.trim() !== '' && thucTeStr.trim() !== '';
      const nameStr = p.productName?.trim() || '';
      const barcodeStr = (p.barcode || '').trim();
      const barcodeLast6 = barcodeStr.length >= 6 ? '.....' + barcodeStr.slice(-6) : barcodeStr;

      return `<tr class="${isChecked ? 'checked-row' : ''}">
        <td class="stt-col">${i + 1}</td>
        <td class="name-col">${nameStr}</td>
        <td class="barcode-col">${barcodeLast6}</td>
        <td class="sapo-col">${sapoStr}</td>
        <td class="thucte-col">${thucTeStr}</td>
      </tr>`;
    }).join('');

    // CSS from SMInvLib.js PRINT_CSS_CACHE — optimized for K80 thermal printers
    const printCSS = `*{box-sizing:border-box}@media print{body{margin:0;padding:3mm;font-size:9px}.no-print{display:none}@page{size:80mm auto;margin:2mm}}body{font-family:"Segoe UI","Arial Unicode MS","Tahoma","Arial",sans-serif;margin:0;padding:3mm;font-size:9px;width:100%;max-width:80mm;line-height:1.2;color:#000}.header{text-align:center;margin-bottom:1mm;border-bottom:2px solid #000;padding-bottom:0.5mm}.header h2{margin:0;font-size:12px;font-weight:800;text-transform:uppercase;padding:0.5mm 1mm}.info{margin-bottom:2mm;font-size:8px;border-bottom:1px solid #ccc;padding:1mm 2mm}.info p{margin:1px 0;font-weight:500}.product-table{width:100%;border-collapse:collapse;font-size:8px;margin-bottom:2mm}.product-table th{background:#fff;color:#000;font-weight:900;text-align:center;padding:1mm;border-bottom:1px solid #000;font-size:9px;text-transform:uppercase;white-space:nowrap}.product-table td{padding:1mm;border-bottom:1px solid #ccc;vertical-align:top;font-weight:600;color:#000}.product-table tr:nth-child(even){background:#f8f8f8}.stt-col{width:7%;text-align:center;font-weight:900;font-size:10px}.name-col{width:42%;text-align:left;padding-left:2mm;word-wrap:break-word;line-height:1.4;font-weight:700;font-size:9px}.barcode-col{width:15%;text-align:center;font-weight:800;font-size:10px;font-family:"Courier New",monospace;color:#333}.sapo-col,.thucte-col{width:18%;text-align:center;font-weight:800;font-size:10px}.checked-row{background:#e8f5e8!important}.checked-row .sapo-col,.checked-row .thucte-col{background:#d4edda;font-weight:bold;color:#155724}.footer{margin-top:2mm;text-align:center;font-size:7px;border-top:1px solid #ccc;padding:1mm}.footer p{margin:1px 0}`;

    const html = `<!DOCTYPE html><html><head><title>Danh sách kiểm tra - ${user.store}</title><meta charset="UTF-8"><style>${printCSS}</style></head><body>
      <div class="header"><h2>DANH SÁCH KIỂM TRA SẢN PHẨM</h2></div>
      <div class="info"><p><strong>Ca:</strong> ${currentShiftInfo.name} (${currentShiftInfo.time}) | <strong>Cửa hàng:</strong> ${user.store} | <strong>Tổng SP:</strong> ${products.length}</p></div>
      <table class="product-table">
        <thead><tr><th class="stt-col">STT</th><th class="name-col">TÊN SẢN PHẨM</th><th class="barcode-col">BARCODE</th><th class="sapo-col">SAPO</th><th class="thucte-col">THỰC TẾ</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
      <div class="footer"><p>In lúc: ${now.toLocaleString('vi-VN')}</p></div>
      <script>window.onload=()=>setTimeout(()=>window.print(),300);</script>
    </body></html>`;

    const printWindow = window.open('', '_blank', 'width=350,height=600');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    } else {
      toast.error('Trình duyệt chặn popup. Hãy cho phép popup để in.');
    }
  }, [products, shift, user.store, toast]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch = p.productName.toLowerCase().includes(search.toLowerCase()) ||
        (p.barcode || '').includes(search);
      const matchStatus = filterStatus === 'ALL' || p.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [products, search, filterStatus]);

  // Stats
  const stats = useMemo(() => ({
    total: products.length,
    checked: products.filter(p => p.status !== 'PENDING').length,
    matched: products.filter(p => p.status === 'MATCHED').length,
    missing: products.filter(p => p.status === 'MISSING').length,
    over: products.filter(p => p.status === 'OVER').length,
    pending: products.filter(p => p.status === 'PENDING').length,
    missingValue: products.filter(p => p.status === 'MISSING').reduce((sum, p) => sum + Math.abs(p.diff || 0), 0)
  }), [products]);

  const progressPercent = stats.total > 0 ? Math.round((stats.checked / stats.total) * 100) : 0;
  const currentShift = INVENTORY_CONFIG.SHIFTS.find(s => s.id === shift)!;

  const getStatusConfig = (status: string) => {
    return INVENTORY_CONFIG.STATUS_CONFIG[status as keyof typeof INVENTORY_CONFIG.STATUS_CONFIG]
      || INVENTORY_CONFIG.STATUS_CONFIG.PENDING;
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-gradient-to-br from-slate-50 to-gray-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200/50 px-6 py-4 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <span className="material-symbols-outlined text-gray-600">arrow_back</span>
            </button>
            <div>
              <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">inventory_2</span>
                Kiểm Kho
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {user.store} • {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Print Button */}
            <button
              onClick={handlePrint}
              disabled={products.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-50 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-lg">print</span>
              <span className="hidden sm:inline">In</span>
            </button>

            {/* Sync Button */}
            <button
              onClick={() => setShowSyncModal(true)}
              className="hidden md:flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-50 transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-lg">sync</span>
              Đồng bộ
            </button>

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={submitting || loading}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-all active:scale-[0.98] ${stats.checked > 0
                ? 'bg-gradient-to-r from-primary to-emerald-500 shadow-lg shadow-primary/20 hover:shadow-primary/30'
                : 'bg-gray-300 cursor-not-allowed shadow-none'
                }`}
            >
              {submitting ? (
                <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-lg">send</span>
              )}
              <span className="hidden sm:inline">Nộp Báo Cáo</span>
            </button>
          </div>
        </div>
      </header>

      {/* Shift Selector */}
      <div className="bg-white/60 backdrop-blur-sm border-b border-gray-100 px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <span className="text-xs font-bold text-gray-400 uppercase">Ca làm việc:</span>
          <div className="flex p-1 bg-gray-100 rounded-xl gap-1">
            {INVENTORY_CONFIG.SHIFTS.map(s => (
              <button
                key={s.id}
                onClick={() => setShift(s.id)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${shift === s.id
                  ? `bg-gradient-to-r ${s.color} text-white shadow-md`
                  : 'text-gray-500 hover:bg-gray-200'
                  }`}
              >
                <span className="material-symbols-outlined text-sm">{s.icon}</span>
                <span className="hidden sm:inline">{s.name}</span>
                <span className="sm:hidden">{s.id}</span>
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-400 hidden sm:inline ml-2">
            {currentShift.time}
          </span>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* Progress Bar */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-gray-700">Tiến độ kiểm kê</span>
              <span className={`text-sm font-black ${progressPercent === 100 ? 'text-emerald-600' : 'text-primary'}`}>
                {progressPercent}%
              </span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${progressPercent === 100
                  ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                  : 'bg-gradient-to-r from-primary to-amber-400'
                  }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-400">
              <span>Đã kiểm {stats.checked}/{stats.total} sản phẩm</span>
              {stats.missing > 0 && (
                <span className="text-red-500 font-medium">
                  Thiếu: {stats.missingValue} đơn vị
                </span>
              )}
            </div>
          </div>

          {/* Search & View Toggle */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">search</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                placeholder="Tìm sản phẩm theo tên hoặc barcode..."
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilterStatus('ALL')}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${filterStatus === 'ALL'
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                Tất cả
              </button>
              <div className="w-px h-6 bg-gray-200" />
              <div className="flex bg-white rounded-xl border border-gray-200 p-1">
                <button
                  onClick={() => setViewMode('CARD')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'CARD' ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                  <span className="material-symbols-outlined text-lg">grid_view</span>
                </button>
                <button
                  onClick={() => setViewMode('TABLE')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'TABLE' ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                  <span className="material-symbols-outlined text-lg">table_rows</span>
                </button>
              </div>
            </div>
          </div>

          {/* Product List */}
          {loading ? (
            <div className="text-center py-16">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-gray-400 mt-4">Đang tải dữ liệu...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-16 bg-white/70 rounded-2xl border border-dashed border-gray-200">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-4xl text-gray-300">inventory_2</span>
              </div>
              <p className="text-gray-500 font-bold">Không có sản phẩm nào</p>
              <p className="text-xs text-gray-400 mt-1">
                {search ? 'Thử tìm kiếm với từ khóa khác' : 'Danh sách trống'}
              </p>
            </div>
          ) : viewMode === 'CARD' ? (
            /* Card View */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map(p => {
                const statusConfig = getStatusConfig(p.status);
                return (
                  <div
                    key={p.id}
                    className={`bg-white/80 backdrop-blur-sm rounded-2xl border-l-4 ${statusConfig.border} border border-gray-100 p-5 hover:shadow-lg transition-all`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0 pr-3">
                        <h3 className="font-bold text-gray-800 truncate">{p.productName}</h3>
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5">{p.barcode}</p>
                      </div>
                      <span className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold ${statusConfig.bg} ${statusConfig.text}`}>
                        <span className="material-symbols-outlined text-xs">{statusConfig.icon}</span>
                        {statusConfig.label}
                      </span>
                    </div>

                    {/* Input Grid: Blind Count hides systemStock */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1.5">Hệ thống</label>
                        <div className="h-11 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-center text-sm font-bold text-gray-600">
                          {blindCount && p.actualStock === null ? (
                            <span className="material-symbols-outlined text-gray-300 text-lg">visibility_off</span>
                          ) : (p.systemStock ?? '-')}
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-primary mb-1.5">Thực tế</label>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={p.actualStock === null || p.actualStock === undefined ? '' : p.actualStock}
                          onChange={e => updateField(String(p.id), 'actualStock', e.target.value)}
                          className="h-11 w-full bg-white border-2 border-primary/30 focus:border-primary rounded-xl text-sm font-bold text-center text-primary outline-none transition-all"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1.5">Chênh lệch</label>
                        <div className={`h-11 border rounded-xl flex items-center justify-center text-sm font-black ${p.diff === null || p.diff === undefined
                          ? 'bg-gray-50 border-gray-200 text-gray-400'
                          : p.diff === 0
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                            : p.diff < 0
                              ? 'bg-red-50 border-red-200 text-red-600'
                              : 'bg-blue-50 border-blue-200 text-blue-600'
                          }`}>
                          {blindCount && p.actualStock === null ? (
                            <span className="material-symbols-outlined text-gray-300 text-lg">visibility_off</span>
                          ) : (p.diff === null || p.diff === undefined ? '-' : p.diff > 0 ? `+${p.diff}` : p.diff)}
                        </div>
                      </div>
                    </div>

                    {/* Discrepancy Reason: shown when diff != 0 */}
                    {p.diff !== null && p.diff !== undefined && p.diff !== 0 && (
                      <div className="mb-3">
                        <label className="block text-[10px] uppercase font-bold text-amber-600 mb-1.5">
                          <span className="material-symbols-outlined text-xs align-middle">report</span> Lý do chênh lệch
                        </label>
                        <select
                          value={(p as any).diffReason || ''}
                          onChange={e => updateField(String(p.id), 'diffReason', e.target.value)}
                          className={`w-full h-10 px-3 border rounded-xl text-xs font-medium outline-none transition-all ${(p as any).diffReason
                            ? 'bg-amber-50 border-amber-300 text-amber-800'
                            : 'bg-red-50 border-red-300 text-red-600 animate-pulse'
                            }`}
                        >
                          <option value="">-- Chọn lý do --</option>
                          {DIFF_REASON_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Note */}
                    <input
                      type="text"
                      value={p.note || ''}
                      onChange={e => updateField(String(p.id), 'note', e.target.value)}
                      className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:border-primary outline-none transition-all"
                      placeholder="Ghi chú (nếu có)..."
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            /* Table View */
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50/80 border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Sản phẩm</th>
                      <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-500 uppercase w-24">{blindCount ? '🔒' : 'Hệ thống'}</th>
                      <th className="px-4 py-3 text-center text-[10px] font-bold text-primary uppercase w-28">Thực tế</th>
                      <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-500 uppercase w-24">{blindCount ? '🔒' : 'Chênh lệch'}</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase w-40">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredProducts.map(p => {
                      const statusConfig = getStatusConfig(p.status);
                      return (
                        <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg ${statusConfig.bg} ${statusConfig.text} flex items-center justify-center`}>
                                <span className="material-symbols-outlined text-sm">{statusConfig.icon}</span>
                              </div>
                              <div>
                                <p className="font-bold text-gray-800 truncate max-w-[200px]">{p.productName}</p>
                                <p className="text-[10px] text-gray-400 font-mono">{p.barcode}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-gray-600">
                            {blindCount && p.actualStock === null ? (
                              <span className="material-symbols-outlined text-gray-300 text-sm">visibility_off</span>
                            ) : (p.systemStock ?? '-')}
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              inputMode="numeric"
                              value={p.actualStock ?? ''}
                              onChange={e => updateField(String(p.id), 'actualStock', e.target.value)}
                              className="w-full h-9 bg-white border-2 border-primary/30 focus:border-primary rounded-lg text-sm font-bold text-center text-primary outline-none"
                              placeholder="0"
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            {blindCount && p.actualStock === null ? (
                              <span className="material-symbols-outlined text-gray-300 text-sm">visibility_off</span>
                            ) : (
                              <span className={`inline-block px-2 py-1 rounded-lg text-xs font-black ${p.diff === null || p.diff === undefined
                                ? 'bg-gray-100 text-gray-400'
                                : p.diff === 0
                                  ? 'bg-emerald-100 text-emerald-600'
                                  : p.diff < 0
                                    ? 'bg-red-100 text-red-600'
                                    : 'bg-blue-100 text-blue-600'
                                }`}>
                                {p.diff === null || p.diff === undefined ? '-' : p.diff > 0 ? `+${p.diff}` : p.diff}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={p.note || ''}
                              onChange={e => updateField(String(p.id), 'note', e.target.value)}
                              className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:bg-white focus:border-primary outline-none"
                              placeholder="..."
                            />
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
      </main>

      {/* Sync Modal */}
      {showSyncModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-cyan-50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">sync</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">Đồng bộ KiotViet</h3>
                  <p className="text-xs text-gray-500">Cập nhật tồn kho từ hệ thống</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Đồng bộ sẽ lấy số liệu tồn kho mới nhất từ KiotViet và cập nhật vào hệ thống.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                <span className="material-symbols-outlined text-amber-500 text-sm mt-0.5">warning</span>
                <p className="text-xs text-amber-700">
                  Dữ liệu chưa lưu sẽ bị ghi đè. Hãy nộp báo cáo trước khi đồng bộ.
                </p>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
              <button
                onClick={() => setShowSyncModal(false)}
                className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  setShowSyncModal(false);
                  loadProducts();
                  toast.success('Đang đồng bộ...');
                }}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-bold hover:shadow-lg transition-all"
              >
                Đồng bộ ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmSubmit.show}
        title={confirmSubmit.title}
        message={confirmSubmit.message}
        variant="warning"
        confirmText="Nộp báo cáo"
        cancelText="Kiểm tra lại"
        onConfirm={doSubmit}
        onCancel={() => setConfirmSubmit({ show: false, message: '', title: '' })}
        loading={submitting}
      />
    </div>
  );
};

export default Inventory;
