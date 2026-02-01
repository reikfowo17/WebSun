import React, { useState, useEffect } from 'react';
import { User, ExpiryItem } from '../types';
import { runBackend } from '../services/api';

interface ExpiryProps {
  user: User;
  onBack: () => void;
}

const Expiry: React.FC<ExpiryProps> = ({ user, onBack }) => {
  const [type, setType] = useState('TỦ MÁT');
  const [products, setProducts] = useState<ExpiryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Calculate days left from expiry date
  const getDaysLeft = (dateStr?: string): number => {
    if (!dateStr) return 9999;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = new Date(dateStr);
    const diff = expDate.getTime() - today.getTime();
    return Math.ceil(diff / 86400000);
  };

  // Load products from backend
  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await runBackend('getStoreProducts', {
        store: user.store || 'BEE',
        type
      });

      if (res.success) {
        const mapped = (res.products || []).map((p: any) => ({
          ...p,
          daysLeft: getDaysLeft(p.expiryDate)
        })).sort((a: any, b: any) => a.daysLeft - b.daysLeft);

        setProducts(mapped);
      }
    } catch (e) {
      console.error('Load products error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [type, user.store]);

  // Update a product field
  const updateProduct = async (id: string, field: string, value: any) => {
    setProducts(prev => prev.map(p => {
      if (p.id === id) {
        const updated = { ...p, [field]: value };
        if (field === 'expiryDate') {
          updated.daysLeft = getDaysLeft(value);
        }
        return updated;
      }
      return p;
    }));

    try {
      await runBackend('updateStoreProduct', { id, field, value });
    } catch (e) {
      console.error('Update error:', e);
    }
  };

  // Submit report
  const handleSubmit = async () => {
    if (!confirm('Xác nhận nộp báo cáo kiểm date?')) return;

    setSubmitting(true);
    try {
      const res = await runBackend('submitDateReport', {
        store: user.store,
        type,
        userId: user.id
      });

      if (res.success) {
        alert(res.message || 'Đã nộp báo cáo thành công!');
        loadProducts();
      }
    } catch (e) {
      alert('Lỗi kết nối');
    } finally {
      setSubmitting(false);
    }
  };

  // Get status from daysLeft
  const getStatus = (daysLeft?: number): string => {
    if (daysLeft === undefined || daysLeft === 9999) return 'UNCHECKED';
    if (daysLeft < 0) return 'EXPIRED';
    if (daysLeft <= 3) return 'WARNING';
    return 'SAFE';
  };

  // Filter products
  const filtered = products.filter(p => {
    const matchSearch = p.productName.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode || '').includes(search);
    const status = getStatus(p.daysLeft);
    const matchStatus = filterStatus === 'ALL' || status === filterStatus;
    return matchSearch && matchStatus;
  });

  // Stats
  const stats = {
    total: products.length,
    expired: products.filter(p => getStatus(p.daysLeft) === 'EXPIRED').length,
    warning: products.filter(p => getStatus(p.daysLeft) === 'WARNING').length,
    safe: products.filter(p => getStatus(p.daysLeft) === 'SAFE').length,
    unchecked: products.filter(p => getStatus(p.daysLeft) === 'UNCHECKED').length
  };

  const getStatusConfig = (daysLeft?: number) => {
    const status = getStatus(daysLeft);
    switch (status) {
      case 'EXPIRED': return { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-600', badge: 'bg-red-100 text-red-700', icon: 'error' };
      case 'WARNING': return { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-600', badge: 'bg-amber-100 text-amber-700', icon: 'warning' };
      case 'SAFE': return { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700', icon: 'check_circle' };
      default: return { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-400', badge: 'bg-gray-100 text-gray-500', icon: 'pending' };
    }
  };

  const getDaysLeftLabel = (daysLeft?: number) => {
    if (daysLeft === undefined || daysLeft === 9999) return 'Chưa nhập';
    if (daysLeft < 0) return `Quá hạn`;
    if (daysLeft === 0) return 'Hôm nay';
    return `${daysLeft} ngày`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <span className="material-symbols-outlined text-gray-600">arrow_back</span>
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
                <span className="material-symbols-outlined text-white">event_available</span>
              </div>
              <div>
                <h1 className="font-bold text-gray-900">Kiểm Date</h1>
                <p className="text-xs text-gray-500">{user.store} • {new Date().toLocaleDateString('vi-VN')}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Type Tabs */}
            <div className="hidden sm:flex bg-gray-100 p-1 rounded-lg">
              {['TỦ MÁT', 'BÁNH MÌ'].map(t => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all ${type === t ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  <span className="material-symbols-outlined text-sm">
                    {t === 'TỦ MÁT' ? 'kitchen' : 'bakery_dining'}
                  </span>
                  {t}
                </button>
              ))}
            </div>
            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={submitting || loading}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white rounded-lg text-sm font-bold transition-all shadow-sm"
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

        {/* Mobile Type Selector */}
        <div className="sm:hidden px-6 pb-3">
          <div className="flex bg-gray-100 p-1 rounded-lg">
            {['TỦ MÁT', 'BÁNH MÌ'].map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-md transition-all ${type === t ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500'
                  }`}
              >
                <span className="material-symbols-outlined text-sm">
                  {t === 'TỦ MÁT' ? 'kitchen' : 'bakery_dining'}
                </span>
                {t}
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
          <div className="bg-white rounded-xl p-4 border border-red-200 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-red-600 uppercase">Hết hạn</p>
              <p className="text-2xl font-black text-red-600">{stats.expired}</p>
            </div>
            <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-red-600">error</span>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-amber-200 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-amber-600 uppercase">Cận date</p>
              <p className="text-2xl font-black text-amber-600">{stats.warning}</p>
            </div>
            <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-amber-600">warning</span>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-emerald-200 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-emerald-600 uppercase">Còn hạn</p>
              <p className="text-2xl font-black text-emerald-600">{stats.safe}</p>
            </div>
            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-emerald-600">check_circle</span>
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="bg-white rounded-xl p-4 border border-gray-200 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">search</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full h-10 pl-10 pr-4 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-100 outline-none transition-all"
                placeholder="Tìm kiếm sản phẩm..."
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {[
                { key: 'ALL', label: 'Tất cả' },
                { key: 'EXPIRED', label: 'Hết hạn' },
                { key: 'WARNING', label: 'Cận date' },
                { key: 'SAFE', label: 'Còn hạn' },
                { key: 'UNCHECKED', label: 'Chưa nhập' }
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilterStatus(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterStatus === f.key
                      ? 'bg-amber-500 text-white'
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
            <span className="material-symbols-outlined animate-spin text-4xl text-amber-500">progress_activity</span>
            <p className="text-gray-400 mt-2">Đang tải...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <span className="material-symbols-outlined text-5xl text-gray-300">event_available</span>
            <p className="text-gray-400 mt-2">Không có sản phẩm</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(p => {
              const config = getStatusConfig(p.daysLeft);
              return (
                <div
                  key={p.id}
                  className={`bg-white rounded-xl border-l-4 ${config.border} border border-gray-200 p-4 hover:shadow-md transition-all`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0 pr-2">
                      <h3 className="font-bold text-gray-800 truncate">{p.productName}</h3>
                      <p className="text-[10px] text-gray-400 font-mono">{p.barcode}</p>
                    </div>
                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${config.badge}`}>
                      <span className="material-symbols-outlined text-xs">{config.icon}</span>
                      {getDaysLeftLabel(p.daysLeft)}
                    </div>
                  </div>

                  {/* Date Inputs */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">NSX</label>
                      <input
                        type="date"
                        value={p.mfgDate || ''}
                        onChange={(e) => updateProduct(p.id, 'mfgDate', e.target.value)}
                        className="h-9 w-full px-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:bg-white focus:border-amber-400 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-amber-500 mb-1">HSD ⭐</label>
                      <input
                        type="date"
                        value={p.expiryDate || ''}
                        onChange={(e) => updateProduct(p.id, 'expiryDate', e.target.value)}
                        className="h-9 w-full px-2 bg-amber-50 border-2 border-amber-200 rounded-lg text-xs font-bold text-amber-700 focus:border-amber-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Quantity & Note */}
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="SL"
                      value={p.quantity || ''}
                      onChange={(e) => updateProduct(p.id, 'quantity', e.target.value)}
                      className="w-14 h-8 px-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-center focus:bg-white focus:border-amber-400 outline-none transition-all"
                    />
                    <input
                      type="text"
                      placeholder="Ghi chú..."
                      value={p.note || ''}
                      onChange={(e) => updateProduct(p.id, 'note', e.target.value)}
                      className="flex-1 h-8 px-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:bg-white focus:border-amber-400 outline-none transition-all"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Expiry;
