import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, InventoryProduct } from '../types';
import { InventoryService } from '../services';
import { useToast } from '../contexts';

interface InventoryProps {
  user: User;
  onBack?: () => void;
}

/**
 * Config aligned with GAS SMInvLib.js
 * Shifts match the store operation hours
 */
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
      }

      // Debounced save to backend
      InventoryService.updateItem(String(p.id), field, value, user.id);
      return updated;
    }));
  }, [user.id]);

  const handleSubmit = async () => {
    const pending = stats.pending;
    const missing = stats.missing;

    if (pending > 0) {
      if (!confirm(`⚠️ Còn ${pending} sản phẩm chưa kiểm.\n\nVẫn nộp báo cáo?`)) return;
    } else if (missing > 0) {
      if (!confirm(`📋 Tổng kết:\n• Khớp: ${stats.matched}\n• Thiếu: ${stats.missing}\n• Thừa: ${stats.over}\n\nXác nhận nộp báo cáo?`)) return;
    } else {
      if (!confirm('Xác nhận nộp báo cáo kiểm kho?')) return;
    }

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

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {/* Total */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-gray-100 p-4 relative overflow-hidden">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">inventory</span>
                </div>
                <span className="text-[10px] font-bold text-gray-400 uppercase">Tổng SP</span>
              </div>
              <p className="text-2xl font-black text-gray-800">{stats.total}</p>
              <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-gray-100 rounded-full opacity-30" />
            </div>

            {/* Matched */}
            <div
              onClick={() => setFilterStatus(filterStatus === 'MATCHED' ? 'ALL' : 'MATCHED')}
              className={`bg-white/70 backdrop-blur-sm rounded-2xl border p-4 relative overflow-hidden cursor-pointer transition-all hover:shadow-md ${filterStatus === 'MATCHED' ? 'border-emerald-400 ring-2 ring-emerald-200' : 'border-gray-100'
                }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">check_circle</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-600 uppercase">Khớp</span>
              </div>
              <p className="text-2xl font-black text-emerald-600">{stats.matched}</p>
              <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-emerald-100 rounded-full opacity-30" />
            </div>

            {/* Missing */}
            <div
              onClick={() => setFilterStatus(filterStatus === 'MISSING' ? 'ALL' : 'MISSING')}
              className={`bg-white/70 backdrop-blur-sm rounded-2xl border p-4 relative overflow-hidden cursor-pointer transition-all hover:shadow-md ${filterStatus === 'MISSING' ? 'border-red-400 ring-2 ring-red-200' : 'border-gray-100'
                }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">trending_down</span>
                </div>
                <span className="text-[10px] font-bold text-red-600 uppercase">Thiếu</span>
              </div>
              <p className="text-2xl font-black text-red-600">{stats.missing}</p>
              <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-red-100 rounded-full opacity-30" />
            </div>

            {/* Over */}
            <div
              onClick={() => setFilterStatus(filterStatus === 'OVER' ? 'ALL' : 'OVER')}
              className={`bg-white/70 backdrop-blur-sm rounded-2xl border p-4 relative overflow-hidden cursor-pointer transition-all hover:shadow-md ${filterStatus === 'OVER' ? 'border-blue-400 ring-2 ring-blue-200' : 'border-gray-100'
                }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">trending_up</span>
                </div>
                <span className="text-[10px] font-bold text-blue-600 uppercase">Thừa</span>
              </div>
              <p className="text-2xl font-black text-blue-600">{stats.over}</p>
              <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-blue-100 rounded-full opacity-30" />
            </div>

            {/* Pending */}
            <div
              onClick={() => setFilterStatus(filterStatus === 'PENDING' ? 'ALL' : 'PENDING')}
              className={`bg-white/70 backdrop-blur-sm rounded-2xl border p-4 relative overflow-hidden cursor-pointer transition-all hover:shadow-md ${filterStatus === 'PENDING' ? 'border-amber-400 ring-2 ring-amber-200' : 'border-gray-100'
                }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center animate-pulse">
                  <span className="material-symbols-outlined text-lg">pending</span>
                </div>
                <span className="text-[10px] font-bold text-amber-600 uppercase">Chờ</span>
              </div>
              <p className="text-2xl font-black text-amber-600">{stats.pending}</p>
              <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-amber-100 rounded-full opacity-30" />
            </div>
          </div>

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

                    {/* Input Grid */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1.5">Hệ thống</label>
                        <div className="h-11 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-center text-sm font-bold text-gray-600">
                          {p.systemStock ?? '-'}
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
                          {p.diff === null || p.diff === undefined ? '-' : p.diff > 0 ? `+${p.diff}` : p.diff}
                        </div>
                      </div>
                    </div>

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
                      <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-500 uppercase w-24">Hệ thống</th>
                      <th className="px-4 py-3 text-center text-[10px] font-bold text-primary uppercase w-28">Thực tế</th>
                      <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-500 uppercase w-24">Chênh lệch</th>
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
                          <td className="px-4 py-3 text-center font-bold text-gray-600">{p.systemStock ?? '-'}</td>
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
    </div>
  );
};

export default Inventory;
