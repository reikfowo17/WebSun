import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, InventoryProduct } from '../types';
import { InventoryService } from '../services';
import { useToast } from '../contexts';

interface InventoryProps {
  user: User;
  onBack?: () => void; // Kept for interface compatibility but unused
}

const Inventory: React.FC<InventoryProps> = ({ user }) => {
  const navigate = useNavigate();
  const toast = useToast();
  const [shift, setShift] = useState(1);
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

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
    } finally {
      setLoading(false);
    }
  };

  const updateField = (productId: string, field: string, value: string) => {
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

      InventoryService.updateItem(String(p.id), field, value, user.id);
      return updated;
    }));
  };

  const handleSubmit = async () => {
    const pending = products.filter(p => p.status === 'PENDING').length;
    if (pending > 0) {
      if (!confirm(`Còn ${pending} sản phẩm chưa kiểm. Vẫn nộp báo cáo?`)) return;
    } else {
      if (!confirm('Xác nhận nộp báo cáo kiểm kho?')) return;
    }

    setSubmitting(true);
    try {
      const res = await InventoryService.submitReport(user.store || 'BEE', shift, user.id);
      if (res.success) {
        toast.success(res.message || 'Đã nộp báo cáo thành công!');
        navigate('/'); // Go back to dashboard after successful submit
      } else {
        toast.error(res.message || 'Lỗi khi nộp báo cáo');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Filter products
  const filtered = products.filter(p => {
    const matchSearch = p.productName.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode || '').includes(search);
    const matchStatus = filterStatus === 'ALL' || p.status === filterStatus;
    return matchSearch && matchStatus;
  });

  // Stats
  const stats = {
    total: products.length,
    checked: products.filter(p => p.status !== 'PENDING').length,
    matched: products.filter(p => p.status === 'MATCHED').length,
    missing: products.filter(p => p.status === 'MISSING').length,
    over: products.filter(p => p.status === 'OVER').length,
    pending: products.filter(p => p.status === 'PENDING').length
  };

  const progressPercent = stats.total > 0 ? Math.round((stats.checked / stats.total) * 100) : 0;

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'MATCHED': return { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', label: 'Khớp', icon: 'check_circle' };
      case 'MISSING': return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', label: 'Thiếu', icon: 'error' };
      case 'OVER': return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', label: 'Thừa', icon: 'add_circle' };
      default: return { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-500', label: 'Chờ', icon: 'pending' };
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <span className="material-symbols-outlined text-gray-600">arrow_back</span>
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                <span className="material-symbols-outlined text-white">inventory_2</span>
              </div>
              <div>
                <h1 className="font-bold text-gray-900">Kiểm Kho</h1>
                <p className="text-xs text-gray-500">{user.store} • {new Date().toLocaleDateString('vi-VN')}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Shift Tabs */}
            <div className="hidden sm:flex bg-gray-100 p-1 rounded-lg">
              {[1, 2, 3].map(s => (
                <button
                  key={s}
                  onClick={() => setShift(s)}
                  className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${shift === s ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  Ca {s}
                </button>
              ))}
            </div>
            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={submitting || loading}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 disabled:bg-gray-300 text-white rounded-lg text-sm font-bold transition-all shadow-sm"
            >
              {submitting ? (
                <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-sm">send</span>
              )}
              <span className="hidden sm:inline">Nộp Báo Cáo</span>
            </button>
          </div>
        </div>

        {/* Mobile Shift Selector */}
        <div className="sm:hidden px-6 pb-3">
          <div className="flex bg-gray-100 p-1 rounded-lg">
            {[1, 2, 3].map(s => (
              <button
                key={s}
                onClick={() => setShift(s)}
                className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${shift === s ? 'bg-white text-primary shadow-sm' : 'text-gray-500'
                  }`}
              >
                Ca {s}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl p-4 border border-gray-200 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase">Tổng SP</p>
              <p className="text-2xl font-black text-gray-900">{stats.total}</p>
            </div>
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-gray-500">inventory</span>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-emerald-200 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-emerald-600 uppercase">Khớp</p>
              <p className="text-2xl font-black text-emerald-600">{stats.matched}</p>
            </div>
            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-emerald-600">check_circle</span>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-red-200 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-red-600 uppercase">Thiếu</p>
              <p className="text-2xl font-black text-red-600">{stats.missing}</p>
            </div>
            <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-red-600">error</span>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-blue-200 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-blue-600 uppercase">Thừa</p>
              <p className="text-2xl font-black text-blue-600">{stats.over}</p>
            </div>
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-blue-600">add_circle</span>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="bg-white rounded-xl p-4 border border-gray-200 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-gray-700">Tiến độ kiểm kê</span>
            <span className="text-sm font-black text-primary">{progressPercent}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">Đã kiểm {stats.checked}/{stats.total} sản phẩm</p>
        </div>

        {/* Search & Filters */}
        <div className="bg-white rounded-xl p-4 border border-gray-200 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">search</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full h-10 pl-10 pr-4 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                placeholder="Tìm kiếm sản phẩm..."
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {[
                { key: 'ALL', label: 'Tất cả' },
                { key: 'PENDING', label: 'Chờ' },
                { key: 'MATCHED', label: 'Khớp' },
                { key: 'MISSING', label: 'Thiếu' },
                { key: 'OVER', label: 'Thừa' }
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilterStatus(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterStatus === f.key
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Product Grid */}
        {loading ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
            <p className="text-gray-400 mt-2">Đang tải...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <span className="material-symbols-outlined text-5xl text-gray-300">inventory_2</span>
            <p className="text-gray-400 mt-2">Không có sản phẩm</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(p => {
              const statusConfig = getStatusConfig(p.status);
              return (
                <div
                  key={p.id}
                  className={`bg-white rounded-xl border-l-4 ${statusConfig.border} border border-gray-200 p-4 hover:shadow-md transition-all`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0 pr-2">
                      <h3 className="font-bold text-gray-800 truncate">{p.productName}</h3>
                      <p className="text-[10px] text-gray-400 font-mono">{p.barcode}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${statusConfig.bg} ${statusConfig.text}`}>
                      {statusConfig.label}
                    </span>
                  </div>

                  {/* Input Grid */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Hệ thống</label>
                      <div className="h-10 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center text-sm font-bold text-gray-600">
                        {p.systemStock ?? '-'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-primary mb-1">Thực tế</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={p.actualStock === null || p.actualStock === undefined ? '' : p.actualStock}
                        onChange={e => updateField(String(p.id), 'actualStock', e.target.value)}
                        className="h-10 w-full bg-white border-2 border-primary/30 focus:border-primary rounded-lg text-sm font-bold text-center text-primary outline-none transition-all"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Chênh lệch</label>
                      <div className={`h-10 border rounded-lg flex items-center justify-center text-sm font-black ${p.diff === null || p.diff === undefined ? 'bg-gray-50 border-gray-200 text-gray-400' :
                        p.diff === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-600' :
                          p.diff < 0 ? 'bg-red-50 border-red-200 text-red-600' :
                            'bg-blue-50 border-blue-200 text-blue-600'
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
                    className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:bg-white focus:border-primary outline-none transition-all"
                    placeholder="Ghi chú..."
                  />
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Inventory;
