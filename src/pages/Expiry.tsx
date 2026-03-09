import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User, ExpiryProduct } from '../types';
import { ExpiryService } from '../services';
import type { ExpiryConfig } from '../services/expiry';
import { useToast } from '../contexts';
import PortalHeader from '../components/PortalHeader';

interface ExpiryProps {
  user: User;
  onBack?: () => void;
}

const Expiry: React.FC<ExpiryProps> = ({ user }) => {
  const navigate = useNavigate();
  const toast = useToast();
  const [configs, setConfigs] = useState<ExpiryConfig[]>([]);
  const [type, setType] = useState('');
  const [products, setProducts] = useState<ExpiryProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<'LIST' | 'GRID'>('LIST');
  const [filter, setFilter] = useState<'ALL' | 'NEAR_EXPIRY' | 'EXPIRED'>('ALL');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    const res = await ExpiryService.getConfigs();
    if (res.success && res.configs) {
      const enabledConfigs = res.configs.filter(c => c.enabled);
      setConfigs(enabledConfigs);
      if (enabledConfigs.length > 0) {
        setType(enabledConfigs[0].type);
      }
    }
  };

  useEffect(() => {
    if (type) {
      loadData();
      setSelectedItems(new Set());
    }
  }, [type, user.store]);

  const loadData = async () => {
    setLoading(true);
    try {
      const storeCode = user.store || 'BEE';
      const res = await ExpiryService.getItems(storeCode, type);

      if (res.success && res.products) {
        // Find current config
        const currentConfig = configs.find(c => c.type === type);
        const nearExpiryDays = currentConfig?.nearExpiryDays ?? 5;
        const productionThreshold = currentConfig?.productionThreshold ?? 7;

        // Enhance with computed status following GAS logic
        const enhanced = res.products.map(p => {
          const daysLeft = computeDaysLeft(p.expiryDate, p.mfgDate, productionThreshold);
          const status = computeStatus(daysLeft, nearExpiryDays);
          return { ...p, daysLeft, status };
        });
        setProducts(enhanced);
      }
    } catch (error) {
      console.error(error);
      toast.error('Không thể tải dữ liệu hạn sử dụng');
    } finally {
      setLoading(false);
    }
  };

  /** GAS-style: layTrangThai(daysDiff, threshold) */
  const computeStatus = (daysLeft: number | null, nearExpiryDays: number): string => {
    if (daysLeft === null) return 'UNKNOWN';
    if (daysLeft < 0) return 'EXPIRED';
    if (daysLeft <= nearExpiryDays) return 'NEAR_EXPIRY';
    return 'SAFE';
  };

  /** Compute days left from expiry date or production date */
  const computeDaysLeft = (expiryDate: string | null, mfgDate: string | null, productionThreshold: number): number | null => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (expiryDate) {
      const exp = new Date(expiryDate);
      exp.setHours(0, 0, 0, 0);
      return Math.floor((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Fallback: calculate from production date + threshold
    if (mfgDate) {
      const mfg = new Date(mfgDate);
      mfg.setHours(0, 0, 0, 0);
      const pseudoExpiry = new Date(mfg);
      pseudoExpiry.setDate(pseudoExpiry.getDate() + productionThreshold);
      return Math.floor((pseudoExpiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }

    return null;
  };

  // Filter & search combined
  const displayedProducts = useMemo(() => {
    let filtered = products;

    // Status filter
    if (filter === 'NEAR_EXPIRY') {
      filtered = filtered.filter(p => p.status === 'NEAR_EXPIRY');
    } else if (filter === 'EXPIRED') {
      filtered = filtered.filter(p => p.status === 'EXPIRED');
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.productName.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q)
      );
    }

    // Sort by urgency
    return filtered.sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999));
  }, [products, filter, searchQuery]);

  // Stats and dynamic current config
  const currentConfig = useMemo(() => configs.find(c => c.type === type), [configs, type]);

  const stats = useMemo(() => ({
    total: products.length,
    nearExpiry: products.filter(p => p.status === 'NEAR_EXPIRY').length,
    expired: products.filter(p => p.status === 'EXPIRED').length,
    safe: products.filter(p => p.status === 'SAFE').length
  }), [products]);

  const handleSelect = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedItems.size === displayedProducts.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(displayedProducts.map(p => p.id)));
    }
  };

  const handleSubmitReport = async () => {
    if (selectedItems.size === 0) {
      toast.warning('Vui lòng chọn ít nhất 1 sản phẩm để báo cáo');
      return;
    }

    setSubmitting(true);
    try {
      const itemsToReport = products.filter(p => selectedItems.has(p.id));
      const storeCode = user.store || 'BEE';
      const res = await ExpiryService.submitReport(storeCode, itemsToReport);

      if (res.success) {
        toast.success(`Đã báo cáo ${itemsToReport.length} sản phẩm thành công`);
        setSelectedItems(new Set());
        loadData(); // Refresh
      } else {
        toast.error('Gửi báo cáo thất bại');
      }
    } catch (e) {
      toast.error('Lỗi kết nối');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'EXPIRED':
        return {
          label: 'HẾT HẠN',
          emoji: '🔴',
          bgColor: 'bg-red-50',
          textColor: 'text-red-600',
          borderColor: 'border-red-200',
          ringColor: 'ring-red-500/20'
        };
      case 'NEAR_EXPIRY':
        return {
          label: 'CẬN DATE',
          emoji: '🟠',
          bgColor: 'bg-amber-50',
          textColor: 'text-amber-600',
          borderColor: 'border-amber-200',
          ringColor: 'ring-amber-500/20'
        };
      default:
        return {
          label: 'AN TOÀN',
          emoji: '🟢',
          bgColor: 'bg-emerald-50',
          textColor: 'text-emerald-600',
          borderColor: 'border-emerald-200',
          ringColor: 'ring-emerald-500/20'
        };
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('vi-VN');
    } catch { return dateStr; }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: '#F8F7F4' }}>
      {/* Header */}
      <PortalHeader>
        <div className="flex items-center gap-4 py-1">
          <button
            onClick={() => navigate('/')}
            className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <span className="material-symbols-outlined text-gray-600">arrow_back</span>
          </button>
          <div>
            <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-500">schedule</span>
              Kiểm Soát Hạn Dùng
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {user.store || 'Store'} • {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="hidden md:flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50 transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-lg">print</span>
            In Checklist
          </button>
          <button
            onClick={handleSubmitReport}
            disabled={submitting || selectedItems.size === 0}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-all active:scale-[0.98] ${selectedItems.size > 0
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-lg shadow-orange-200 hover:shadow-orange-300'
              : 'bg-gray-300 cursor-not-allowed shadow-none'
              }`}
          >
            {submitting ? (
              <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-lg">send</span>
            )}
            Nộp Báo Cáo {selectedItems.size > 0 && `(${selectedItems.size})`}
          </button>
        </div>
      </PortalHeader>


      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* Stats Cards - Glassmorphism Style */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div
              onClick={() => setFilter('ALL')}
              className={`relative overflow-hidden p-5 rounded-2xl cursor-pointer transition-all hover:-translate-y-0.5 ${filter === 'ALL' ? 'ring-2 ring-blue-200' : ''
                }`}
              style={{ background: '#FFFFFF', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <span className="material-symbols-outlined" style={{ fontSize: 24 }}>inventory_2</span>
                </div>
                <span className="text-xs font-bold text-gray-400 uppercase">Tổng SP</span>
              </div>
              <p className="text-3xl font-black text-gray-800" style={{ letterSpacing: '-1px' }}>{stats.total}</p>
            </div>

            <div
              onClick={() => setFilter('NEAR_EXPIRY')}
              className={`relative overflow-hidden p-5 rounded-2xl cursor-pointer transition-all hover:-translate-y-0.5 ${filter === 'NEAR_EXPIRY' ? 'ring-2 ring-amber-200' : ''
                }`}
              style={{ background: '#FFFFFF', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: '#FEF3C7' }}>
                  <span className="material-symbols-outlined text-amber-500" style={{ fontSize: 24 }}>warning</span>
                </div>
                <span className="text-xs font-bold text-amber-600 uppercase">Cận Date</span>
              </div>
              <p className="text-3xl font-black text-amber-600" style={{ letterSpacing: '-1px' }}>{stats.nearExpiry}</p>
              <p className="text-[10px] text-gray-400 mt-1">≤ {currentConfig?.nearExpiryDays ?? 5} ngày</p>
            </div>

            <div
              onClick={() => setFilter('EXPIRED')}
              className={`relative overflow-hidden p-5 rounded-2xl cursor-pointer transition-all hover:-translate-y-0.5 ${filter === 'EXPIRED' ? 'ring-2 ring-red-200' : ''
                }`}
              style={{ background: '#FFFFFF', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                  <span className="material-symbols-outlined" style={{ fontSize: 24 }}>error</span>
                </div>
                <span className="text-xs font-bold text-red-600 uppercase">Hết Hạn</span>
              </div>
              <p className="text-3xl font-black text-red-600" style={{ letterSpacing: '-1px' }}>{stats.expired}</p>
              <p className="text-[10px] text-gray-400 mt-1">Đã quá hạn</p>
            </div>

            <div
              className="relative overflow-hidden p-5 rounded-2xl"
              style={{ background: '#FFFFFF', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <span className="material-symbols-outlined" style={{ fontSize: 24 }}>verified</span>
                </div>
                <span className="text-xs font-bold text-emerald-600 uppercase">An Toàn</span>
              </div>
              <p className="text-3xl font-black text-emerald-600" style={{ letterSpacing: '-1px' }}>{stats.safe}</p>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            {/* Product Type Tabs */}
            <div className="flex p-1 bg-white rounded-xl overflow-x-auto max-w-full" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.03)' }}>
              {configs.map(c => (
                <button
                  key={c.id}
                  onClick={() => setType(c.type)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${type === c.type
                    ? 'bg-gradient-to-r from-gray-800 to-gray-700 text-white shadow-md'
                    : 'text-gray-500 hover:bg-gray-50'
                    }`}
                >
                  {c.type}
                </button>
              ))}
            </div>

            {/* Search & View Toggle */}
            <div className="flex items-center gap-3 w-full lg:w-auto">
              <div className="relative flex-1 lg:w-64">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">search</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm sản phẩm..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white text-sm focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
                  style={{ border: '1.5px solid #EEEDE9' }}
                />
              </div>
              <div className="flex bg-white rounded-xl p-1" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.03)' }}>
                <button
                  onClick={() => setViewMode('LIST')}
                  className={`p-2 rounded-lg flex items-center justify-center transition-all ${viewMode === 'LIST' ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                  <span className="material-symbols-outlined text-lg">view_list</span>
                </button>
                <button
                  onClick={() => setViewMode('GRID')}
                  className={`p-2 rounded-lg flex items-center justify-center transition-all ${viewMode === 'GRID' ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                  <span className="material-symbols-outlined text-lg">grid_view</span>
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="py-20 text-center">
              <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-gray-400 font-medium mt-4">Đang tải dữ liệu...</p>
            </div>
          ) : displayedProducts.length === 0 ? (
            <div className="py-16 text-center rounded-2xl" style={{ background: '#FAFAF8', border: '1.5px dashed #EEEDE9' }}>
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-4xl text-gray-300">event_available</span>
              </div>
              <p className="text-gray-600 font-bold mb-1">Không có sản phẩm nào</p>
              <p className="text-xs text-gray-400">
                {filter !== 'ALL' ? 'Thử xóa bộ lọc để xem tất cả sản phẩm' : 'Tất cả sản phẩm đều an toàn'}
              </p>
            </div>
          ) : (
            <>
              {/* List Header */}
              {viewMode === 'LIST' && (
                <div className="flex items-center px-4 py-3 rounded-xl text-xs font-bold text-gray-400 uppercase tracking-wider" style={{ background: '#FAFAF8', border: '1px solid #EEEDE9' }}>
                  <div className="w-10">
                    <input
                      type="checkbox"
                      checked={selectedItems.size === displayedProducts.length && displayedProducts.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500 cursor-pointer"
                    />
                  </div>
                  <div className="flex-1">Sản Phẩm</div>
                  <div className="w-24 text-center hidden md:block">SL</div>
                  <div className="w-28 text-center">NSX</div>
                  <div className="w-28 text-center">HSD</div>
                  <div className="w-24 text-center">Còn lại</div>
                  <div className="w-28 text-center">Trạng thái</div>
                </div>
              )}

              {/* Product List/Grid */}
              <div className={viewMode === 'GRID' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' : 'flex flex-col gap-2'}>
                {displayedProducts.map(item => {
                  const statusConfig = getStatusConfig(item.status);
                  const isSelected = selectedItems.has(item.id);
                  const daysLeft = item.daysLeft ?? 0;

                  if (viewMode === 'GRID') {
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleSelect(item.id)}
                        className={`relative p-5 rounded-2xl transition-all cursor-pointer group ${isSelected
                          ? `ring-2 ${statusConfig.ringColor}`
                          : 'hover:-translate-y-0.5'
                          }`}
                        style={{ background: '#FFFFFF', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}
                      >
                        {/* Selection indicator */}
                        <div className={`absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center transition-all ${isSelected ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200'
                          }`}>
                          <span className="material-symbols-outlined text-sm">{isSelected ? 'check' : 'add'}</span>
                        </div>

                        {/* Status Badge */}
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold ${statusConfig.bgColor} ${statusConfig.textColor} ${statusConfig.borderColor} border mb-3`}>
                          <span>{statusConfig.emoji}</span>
                          <span>{statusConfig.label}</span>
                        </div>

                        <h3 className="font-bold text-gray-800 text-sm mb-1 line-clamp-2 min-h-[40px]">{item.productName}</h3>
                        <p className="text-xs text-gray-400 font-mono mb-4">{item.barcode}</p>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                            <p className="text-[10px] text-gray-400 uppercase mb-0.5">HSD</p>
                            <p className="font-bold text-gray-700 text-sm">{formatDate(item.expiryDate)}</p>
                          </div>
                          <div className={`rounded-lg p-2.5 text-center ${statusConfig.bgColor}`}>
                            <p className="text-[10px] text-gray-500 uppercase mb-0.5">Còn lại</p>
                            <p className={`font-black text-lg ${statusConfig.textColor}`}>
                              {daysLeft < 0 ? daysLeft : `+${daysLeft}`}
                              <span className="text-xs font-medium ml-0.5">d</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // List View
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelect(item.id)}
                      className={`bg-white/80 backdrop-blur-sm p-4 rounded-xl border flex items-center gap-4 transition-all cursor-pointer hover:shadow-md ${isSelected ? 'border-amber-400 bg-amber-50/30' : 'border-gray-100'
                        }`}
                    >
                      <div className="w-10" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelect(item.id)}
                          className="w-5 h-5 rounded border-gray-300 text-amber-500 focus:ring-amber-500 cursor-pointer"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-800 text-sm truncate">{item.productName}</h3>
                        <p className="text-xs text-gray-400 font-mono">{item.barcode}</p>
                      </div>

                      <div className="w-24 text-center hidden md:block">
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded">
                          x{item.quantity || 0}
                        </span>
                      </div>

                      <div className="w-28 text-center text-sm text-gray-500">
                        {formatDate(item.mfgDate)}
                      </div>

                      <div className="w-28 text-center text-sm font-semibold text-gray-700">
                        {formatDate(item.expiryDate)}
                      </div>

                      <div className={`w-24 text-center font-black text-lg ${statusConfig.textColor}`}>
                        {daysLeft}
                        <span className="text-xs font-normal ml-0.5">d</span>
                      </div>

                      <div className="w-28 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold ${statusConfig.bgColor} ${statusConfig.textColor} ${statusConfig.borderColor} border`}>
                          {statusConfig.emoji} {statusConfig.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Mobile FAB */}
      <div className="fixed bottom-6 right-6 md:hidden z-40">
        <button
          onClick={handleSubmitReport}
          disabled={selectedItems.size === 0}
          className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl transition-all active:scale-95 ${selectedItems.size > 0 ? 'bg-gradient-to-br from-amber-500 to-orange-500' : 'bg-gray-300'
            }`}
        >
          {selectedItems.size > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {selectedItems.size}
            </span>
          )}
          <span className="material-symbols-outlined text-2xl">send</span>
        </button>
      </div>
    </div >
  );
};

export default Expiry;
