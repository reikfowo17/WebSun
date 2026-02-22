import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../types';
import { useInventory } from '../hooks/useInventory';
import ConfirmModal from '../components/ConfirmModal';
import PortalHeader from '../components/PortalHeader';

interface InventoryProps {
  user: User;
  onBack?: () => void;
}

const Inventory: React.FC<InventoryProps> = ({ user }) => {
  const navigate = useNavigate();

  const {
    shifts,
    shiftsLoading,
    shift,
    setShift,
    products,
    loading,
    submitting,
    syncing,
    search,
    setSearch,
    filterStatus,
    setFilterStatus,
    showSyncModal,
    setShowSyncModal,
    shiftSubmitted,
    setShiftSubmitted,
    confirmSubmit,
    setConfirmSubmit,
    stats,
    filteredProducts,
    progressPercent,
    currentShift,
    updateField,
    handleSubmit,
    doSubmit,
    handlePrint,
    handleSync
  } = useInventory(user);

  if (shiftsLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-gradient-to-br from-slate-50 to-gray-100">
      {/* Header mapped to global topbar */}
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

          {!shiftSubmitted.submitted && (<>
            {/* Sync KiotViet Button */}
            <button
              onClick={() => setShowSyncModal(true)}
              disabled={syncing || loading}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all shadow-sm ${syncing
                ? 'bg-blue-50 border border-blue-200 text-blue-500 cursor-wait'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600'
                }`}
            >
              <span className={`material-symbols-outlined text-lg ${syncing ? 'animate-spin' : ''}`}>{syncing ? 'progress_activity' : 'sync'}</span>
              <span className="hidden sm:inline">{syncing ? 'Đang đồng bộ...' : 'Đồng bộ KiotViet'}</span>
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
          </>)}
        </div>
      </PortalHeader>

      {/* Shift Selector */}
      <div className="bg-white/60 backdrop-blur-sm border-b border-gray-100 px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <span className="text-xs font-bold text-gray-400 uppercase">Ca làm việc:</span>
          <div className="flex p-1 bg-gray-100 rounded-xl gap-1">
            {shifts.map(s => (
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
      </div >

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
              <span>Đã kiểm {shiftSubmitted.submitted ? stats.total : stats.checked}/{stats.total} sản phẩm</span>
              {stats.missing > 0 && (
                <span className="text-red-500 font-medium">
                  Thiếu: {stats.missingValue} đơn vị
                </span>
              )}
            </div>
          </div>

          {/* Shift Already Submitted Overlay */}
          {shiftSubmitted.submitted && !shiftSubmitted.viewingData ? (
            <div className="relative bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
              {/* Subtle gradient background */}
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/60 pointer-events-none" />
              <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-100/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />

              <div className="relative px-8 pt-10 pb-8">
                {/* Animated success icon */}
                <div className="flex justify-center mb-6">
                  <div className="relative">
                    <div className="absolute inset-0 w-24 h-24 rounded-full bg-emerald-400/20 animate-ping" style={{ animationDuration: '2s' }} />
                    <div className="absolute inset-2 w-20 h-20 rounded-full bg-emerald-400/10 animate-pulse" />
                    <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-2xl shadow-emerald-200/60">
                      <span className="material-symbols-outlined text-white text-5xl" style={{ fontVariationSettings: "'FILL' 1, 'wght' 600" }}>check_circle</span>
                    </div>
                  </div>
                </div>

                {/* Title */}
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight mb-1.5">Đã kiểm tra xong!</h2>
                  <p className="text-sm text-gray-500 font-medium">
                    {currentShift.name} ({currentShift.time}) đã được nộp báo cáo
                  </p>
                </div>

                {/* Submitter info */}
                <div className="flex items-start gap-4 bg-white/80 backdrop-blur-sm rounded-2xl p-4 ring-1 ring-gray-100 shadow-sm mb-8">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                    <span className="material-symbols-outlined text-white text-lg">person</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-gray-800">{shiftSubmitted.submittedBy}</p>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${shiftSubmitted.status === 'APPROVED'
                        ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200'
                        : shiftSubmitted.status === 'REJECTED'
                          ? 'bg-red-100 text-red-700 ring-1 ring-red-200'
                          : 'bg-amber-100 text-amber-700 ring-1 ring-amber-200'
                        }`}>
                        <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>
                          {shiftSubmitted.status === 'APPROVED' ? 'verified' : shiftSubmitted.status === 'REJECTED' ? 'cancel' : 'schedule'}
                        </span>
                        {shiftSubmitted.status === 'APPROVED' ? 'Đã duyệt' : shiftSubmitted.status === 'REJECTED' ? 'Bị từ chối' : 'Chờ duyệt'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">schedule</span>
                      {shiftSubmitted.submittedAt
                        ? new Date(shiftSubmitted.submittedAt).toLocaleString('vi-VN', {
                          hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
                        })
                        : 'Hôm nay'}
                    </p>
                  </div>
                </div>

                {/* Action buttons — prominent, clearly separated */}
                <div className="flex gap-4">
                  <button
                    onClick={() => setShiftSubmitted(prev => ({ ...prev, viewingData: true }))}
                    className="flex-1 flex items-center justify-center gap-2.5 px-5 py-4 bg-white text-gray-800 rounded-2xl font-bold text-sm border-2 border-gray-200 shadow-md hover:border-primary hover:shadow-lg hover:shadow-primary/10 active:scale-[0.98] transition-all duration-200 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-xl text-primary">visibility</span>
                    Xem chi tiết
                  </button>
                  <button
                    onClick={() => navigate('/')}
                    className="flex-1 flex items-center justify-center gap-2.5 px-5 py-4 bg-secondary text-white rounded-2xl font-bold text-sm border-2 border-secondary shadow-md shadow-secondary/30 hover:bg-gray-800 hover:shadow-lg active:scale-[0.98] transition-all duration-200 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-xl">home</span>
                    Về trang chủ
                  </button>
                </div>
              </div>
            </div>
          ) : shiftSubmitted.submitted && shiftSubmitted.viewingData ? (
            /* ── READ-ONLY Report Detail ── */
            <div className="space-y-4">
              {/* ── Report Header ── */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                {/* Back + Title + Status */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShiftSubmitted(prev => ({ ...prev, viewingData: false }))}
                    className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
                  >
                    <span className="material-symbols-outlined text-gray-600 text-lg">arrow_back</span>
                  </button>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-black text-gray-900 tracking-tight">Báo cáo kiểm kê</h2>
                    <p className="text-xs text-gray-400 font-medium">{currentShift.name} ({currentShift.time})</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide flex-shrink-0 ${shiftSubmitted.status === 'APPROVED'
                    ? 'bg-emerald-100 text-emerald-700'
                    : shiftSubmitted.status === 'REJECTED'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-700'
                    }`}>
                    <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {shiftSubmitted.status === 'APPROVED' ? 'verified' : shiftSubmitted.status === 'REJECTED' ? 'cancel' : 'schedule'}
                    </span>
                    {shiftSubmitted.status === 'APPROVED' ? 'Đã duyệt' : shiftSubmitted.status === 'REJECTED' ? 'Bị từ chối' : 'Chờ duyệt'}
                  </span>
                </div>

                {/* Metadata line */}
                <div className="flex items-center gap-3 text-xs text-gray-400 mt-3 pl-12">
                  <div className="inline-flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">person</span>
                    <span className="font-semibold text-gray-600">{shiftSubmitted.submittedBy}</span>
                  </div>
                  <span>•</span>
                  <div className="inline-flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">schedule</span>
                    {shiftSubmitted.submittedAt
                      ? new Date(shiftSubmitted.submittedAt).toLocaleString('vi-VN', {
                        hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
                      })
                      : 'Hôm nay'}
                  </div>
                </div>
              </div>

              {/* Search filter for report */}
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div className="relative flex-1 max-w-md">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">search</span>
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    placeholder="Tìm sản phẩm..."
                  />
                </div>
                <div className="inline-flex items-center bg-gray-100 rounded-xl p-1 gap-0.5">
                  {[
                    { key: 'ALL', label: 'Tất cả', count: stats.total },
                    { key: 'MISSING', label: 'Thiếu', count: stats.missing, color: 'red' },
                    { key: 'OVER', label: 'Thừa', count: stats.over, color: 'amber' },
                  ].map(tab => {
                    const isActive = filterStatus === tab.key;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setFilterStatus(tab.key)}
                        className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${isActive
                          ? 'bg-secondary text-white shadow-sm'
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/60'
                          }`}
                      >
                        {tab.label}
                        <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'}`}>
                          {tab.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* READ-ONLY Report Table */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm table-fixed">
                    <colgroup>
                      <col style={{ width: '5%' }} />
                      <col style={{ width: '28%' }} />
                      <col style={{ width: '15%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '20%' }} />
                    </colgroup>
                    <thead>
                      <tr className="bg-secondary text-white">
                        <th className="px-3 py-3.5 text-center text-[11px] font-bold uppercase tracking-wider">STT</th>
                        <th className="px-3 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider">Tên Sản Phẩm</th>
                        <th className="px-3 py-3.5 text-center text-[11px] font-bold uppercase tracking-wider">Barcode</th>
                        <th className="px-3 py-3.5 text-center text-[11px] font-bold uppercase tracking-wider">Kiot</th>
                        <th className="px-3 py-3.5 text-center text-[11px] font-bold uppercase tracking-wider">Thực tế</th>
                        <th className="px-3 py-3.5 text-center text-[11px] font-bold uppercase tracking-wider">Chênh lệch</th>
                        <th className="px-3 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider">Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map((p, index) => {
                        const diff = p.diff;
                        const diffBg = diff === null || diff === undefined
                          ? ''
                          : diff === 0
                            ? 'bg-emerald-50'
                            : diff < 0
                              ? 'bg-red-50'
                              : 'bg-amber-50';
                        const diffText = diff === null || diff === undefined
                          ? 'text-gray-400'
                          : diff === 0
                            ? 'text-emerald-600'
                            : diff < 0
                              ? 'text-red-600'
                              : 'text-amber-600';

                        return (
                          <tr
                            key={p.id}
                            className={`border-b border-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                          >
                            <td className="px-3 py-3 text-center text-xs font-semibold text-gray-400">{index + 1}</td>
                            <td className="px-3 py-3 truncate">
                              <span className="font-semibold text-gray-800 text-sm">{p.productName}</span>
                            </td>
                            <td className="px-3 py-3 text-center text-xs text-gray-500 font-mono truncate">{p.barcode || ''}</td>
                            <td className="px-3 py-3 text-center font-bold text-gray-700">{p.systemStock ?? '-'}</td>
                            <td className="px-3 py-3 text-center font-bold text-gray-900">{p.actualStock ?? '-'}</td>
                            <td className={`px-3 py-3 text-center font-black text-sm ${diffBg} ${diffText}`}>
                              {diff === null || diff === undefined ? '-' : diff > 0 ? `+${diff}` : diff}
                            </td>
                            <td className="px-3 py-3 text-xs text-gray-500 truncate">{p.note || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : !shiftSubmitted.submitted ? (
            <>

              {/* Search & Filters */}
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
                <div className="inline-flex items-center bg-gray-100 rounded-xl p-1 gap-0.5">
                  {[
                    { key: 'ALL', label: 'Tất cả', count: stats.total, color: '' },
                    { key: 'PENDING', label: 'Chưa kiểm', count: stats.total - stats.checked, color: '' },
                    { key: 'MISSING', label: 'Thiếu', count: stats.missing, color: 'red' },
                    { key: 'OVER', label: 'Thừa', count: stats.over, color: 'amber' },
                  ].map(tab => {
                    const isActive = filterStatus === tab.key;
                    const badgeColor = !isActive && tab.color === 'red' && tab.count > 0
                      ? 'bg-red-100 text-red-600'
                      : !isActive && tab.color === 'amber' && tab.count > 0
                        ? 'bg-amber-100 text-amber-600'
                        : isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-gray-200 text-gray-500';

                    return (
                      <button
                        key={tab.key}
                        onClick={() => setFilterStatus(tab.key)}
                        className={`relative px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${isActive
                          ? 'bg-secondary text-white shadow-sm'
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/60'
                          }`}
                      >
                        {tab.label}
                        <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${badgeColor}`}>
                          {tab.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Product Table - Spreadsheet Style */}
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
              ) : (
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm table-fixed">
                      <colgroup>
                        <col style={{ width: '5%' }} />
                        <col style={{ width: '25%' }} />
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '14%' }} />
                        <col style={{ width: '8%' }} />
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '14%' }} />
                      </colgroup>
                      <thead>
                        <tr className="bg-secondary text-white">
                          <th className="px-3 py-3.5 text-center text-[11px] font-bold uppercase tracking-wider">STT</th>
                          <th className="px-3 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider">Tên Sản Phẩm</th>
                          <th className="px-3 py-3.5 text-center text-[11px] font-bold uppercase tracking-wider">Mã SP</th>
                          <th className="px-3 py-3.5 text-center text-[11px] font-bold uppercase tracking-wider">Barcode</th>
                          <th className="px-3 py-3.5 text-center text-[11px] font-bold uppercase tracking-wider">Kiot</th>
                          <th className="px-3 py-3.5 text-center text-[11px] font-bold uppercase tracking-wider text-primary">Thực tế</th>
                          <th className="px-3 py-3.5 text-center text-[11px] font-bold uppercase tracking-wider">Chênh lệch</th>
                          <th className="px-3 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider">Ghi chú</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProducts.map((p, index) => {
                          const diff = p.diff;
                          const diffBg = diff === null || diff === undefined
                            ? ''
                            : diff === 0
                              ? 'bg-emerald-50'
                              : diff < 0
                                ? 'bg-red-50'
                                : 'bg-amber-50';
                          const diffText = diff === null || diff === undefined
                            ? 'text-gray-400'
                            : diff === 0
                              ? 'text-emerald-600'
                              : diff < 0
                                ? 'text-red-600'
                                : 'text-amber-600';

                          return (
                            <tr
                              key={p.id}
                              className={`border-b border-gray-100 hover:bg-primary/5 transition-colors duration-150 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                                }`}
                            >
                              <td className="px-3 py-2.5 text-center text-xs font-semibold text-gray-400">{index + 1}</td>
                              <td className="px-3 py-2.5 truncate">
                                <span className="font-semibold text-gray-800 text-sm">{p.productName}</span>
                              </td>
                              <td className="px-3 py-2.5 text-center text-xs text-gray-500 font-mono truncate">{p.pvn || ''}</td>
                              <td className="px-3 py-2.5 text-center text-xs text-gray-500 font-mono truncate">{p.barcode || ''}</td>
                              <td className="px-3 py-2.5 text-center font-bold text-gray-700">{p.systemStock ?? '-'}</td>
                              <td className="px-3 py-1.5">
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  value={p.actualStock === null || p.actualStock === undefined ? '' : p.actualStock}
                                  onChange={e => updateField(String(p.id), 'actualStock', e.target.value)}
                                  className="w-full h-9 bg-primary/10 border border-primary/30 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-lg text-sm font-bold text-center text-gray-800 outline-none transition-all"
                                  placeholder="0"
                                />
                              </td>
                              <td className={`px-3 py-2.5 text-center font-black text-sm ${diffBg} ${diffText}`}>
                                {diff === null || diff === undefined ? '-' : diff}
                              </td>
                              <td className="px-3 py-1.5">
                                <input
                                  type="text"
                                  value={p.note || ''}
                                  onChange={e => updateField(String(p.id), 'note', e.target.value)}
                                  className="w-full h-9 px-2.5 bg-gray-50 border border-gray-200 focus:border-secondary/30 focus:bg-white rounded-lg text-xs outline-none transition-all"
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
            </>
          ) : null}
        </div>
      </main>

      {/* Sync KiotViet Modal */}
      {
        showSyncModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 no-print">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-cyan-50">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
                    <span className="material-symbols-outlined text-2xl">sync</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">Đồng bộ KiotViet</h3>
                    <p className="text-xs text-gray-500">Lấy tồn kho real-time từ KiotViet</p>
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-gray-600">
                  Hệ thống sẽ kết nối <strong>KiotViet</strong> để lấy số tồn kho chính xác tại thời điểm này và cập nhật vào cột <strong>"Hệ thống"</strong>.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
                  <span className="material-symbols-outlined text-blue-500 text-sm mt-0.5">tips_and_updates</span>
                  <p className="text-xs text-blue-700">
                    Nên đồng bộ <strong>trước khi bắt đầu kiểm</strong> để có số liệu chính xác nhất.
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
                  onClick={handleSync}
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-bold hover:shadow-lg transition-all flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">cloud_sync</span>
                  Đồng bộ ngay
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Submit Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmSubmit.show}
        title={confirmSubmit.title}
        message={confirmSubmit.message}
        variant="warning"
        confirmText="Nộp báo cáo"
        onConfirm={doSubmit}
        onCancel={() => setConfirmSubmit({ show: false, message: '', title: '' })}
        loading={submitting}
      />
    </div >
  );
};

export default Inventory;
