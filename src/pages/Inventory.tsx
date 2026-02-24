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

const makeFilterTabs = (stats: { total: number; checked: number; missing: number; over: number }, editable: boolean) => {
  const tabs: { key: string; label: string; count: number; accent: string }[] = [
    { key: 'ALL', label: 'Tất cả', count: stats.total, accent: 'bg-gray-600 dark:bg-gray-200 text-white dark:text-gray-800' },
  ];
  if (editable) tabs.push({ key: 'PENDING', label: 'Chưa kiểm', count: stats.total - stats.checked, accent: 'bg-gray-400 text-white' });
  tabs.push({ key: 'MISSING', label: 'Thiếu', count: stats.missing, accent: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' });
  tabs.push({ key: 'OVER', label: 'Thừa', count: stats.over, accent: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400' });
  return tabs;
};

const Inventory: React.FC<InventoryProps> = ({ user }) => {
  const navigate = useNavigate();
  const {
    shifts, shiftsLoading, shift, setShift,
    products, loading, submitting, syncing,
    search, setSearch, filterStatus, setFilterStatus,
    showSyncModal, setShowSyncModal,
    shiftSubmitted, setShiftSubmitted,
    confirmSubmit, setConfirmSubmit,
    stats, filteredProducts, progressPercent, currentShift,
    updateField, handleSubmit, doSubmit, handlePrint, handleSync
  } = useInventory(user);

  if (shiftsLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-[#0a0a0a]" role="status">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-[#0a0a0a]">
      <PortalHeader>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
            <span className="material-symbols-outlined text-emerald-500">inventory_2</span>
            <span>Kiểm Kho</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!shiftSubmitted.submitted && (
            <>
              <button
                onClick={() => setShowSyncModal(true)}
                disabled={syncing || loading}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-sm font-medium ${syncing ? 'text-blue-500' : 'text-gray-600 dark:text-gray-300'} hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <span className={`material-symbols-outlined text-lg ${syncing ? 'animate-spin' : ''}`}>
                  {syncing ? 'progress_activity' : 'cloud_sync'}
                </span>
                <span className="hidden sm:inline">{syncing ? 'Đang sync...' : 'Đồng bộ'}</span>
              </button>
              <button onClick={handlePrint} disabled={products.length === 0} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 disabled:opacity-50">
                <span className="material-symbols-outlined text-lg">print</span>
              </button>
            </>
          )}

          {!shiftSubmitted.submitted && (
            <button
              onClick={handleSubmit}
              disabled={submitting || loading || stats.checked === 0}
              className="flex items-center gap-2 px-4 py-1.5 ml-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-semibold shadow-sm shadow-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className={`material-symbols-outlined text-lg ${submitting ? 'animate-spin' : ''}`}>
                {submitting ? 'progress_activity' : 'send'}
              </span>
              <span className="hidden sm:inline">Nộp báo cáo</span>
            </button>
          )}
        </div>
      </PortalHeader>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="max-w-6xl mx-auto space-y-5">

          {/* Controls & Progress Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Shifts */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-[#1a1a1a] p-2 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800">
              <div className="flex p-1 bg-gray-100 dark:bg-[#0a0a0a] rounded-xl w-full sm:w-auto overflow-x-auto hide-scrollbar">
                {shifts.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setShift(s.id)}
                    className={`flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-sm whitespace-nowrap transition-all ${shift === s.id
                      ? 'bg-white dark:bg-[#1a1a1a] shadow-sm text-emerald-600 dark:text-emerald-400 font-bold transform hover:-translate-y-0.5'
                      : 'text-gray-500 dark:text-gray-400 font-medium hover:text-gray-700 dark:hover:text-gray-200'
                      }`}
                  >
                    <span className="material-symbols-outlined text-lg">{s.icon}</span>
                    {s.name}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 px-4 font-medium">
                <span className="material-symbols-outlined text-base">schedule</span>
                {currentShift.time}
              </div>
            </div>

            {/* Progress */}
            <div className="bg-white dark:bg-[#1a1a1a] p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800">
              <div className="flex justify-between items-end mb-2">
                <div>
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">{stats.checked}/{stats.total}</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">đã kiểm</span>
                </div>
                <span className="text-emerald-500 font-bold text-lg">{progressPercent}%</span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Success / Data View */}
          {shiftSubmitted.submitted && !shiftSubmitted.viewingData ? (
            <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-md overflow-hidden relative mt-8">
              <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-emerald-50 to-transparent dark:from-emerald-900/10 pointer-events-none"></div>
              <div className="p-10 flex flex-col items-center text-center relative z-10">
                <div className="mb-8 relative">
                  <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center animate-pulse">
                    <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30">
                      <span className="material-symbols-outlined text-white text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                    </div>
                  </div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full animate-bounce delay-75 opacity-80" />
                  <div className="absolute -bottom-1 -left-2 w-4 h-4 bg-blue-400 rounded-full animate-bounce delay-150 opacity-80" />
                </div>
                <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2 tracking-tight">Đã hoàn tất!</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm">
                  Báo cáo kiểm kho <strong>{currentShift.name} ({currentShift.time})</strong> đã được ghi nhận.
                </p>

                <div className="bg-gray-50 dark:bg-[#0a0a0a] rounded-xl p-4 flex items-center gap-4 mb-8 border border-gray-100 dark:border-gray-800 shadow-sm max-w-md w-full">
                  <div className="w-10 h-10 bg-gray-800 text-white rounded-lg flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined">person</span>
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-bold text-gray-900 dark:text-white">{shiftSubmitted.submittedBy}</div>
                    <div className="text-xs text-gray-500">{shiftSubmitted.submittedAt ? new Date(shiftSubmitted.submittedAt).toLocaleString('vi-VN') : 'Vừa xong'}</div>
                  </div>
                  <span className={`px-3 py-1 text-xs font-bold uppercase rounded-lg border ${shiftSubmitted.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                    shiftSubmitted.status === 'REJECTED' ? 'bg-red-100 text-red-700 border-red-200' :
                      'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800'
                    }`}>
                    {shiftSubmitted.status === 'APPROVED' ? 'Đã duyệt' : shiftSubmitted.status === 'REJECTED' ? 'Từ chối' : 'Chờ duyệt'}
                  </span>
                </div>

                <div className="flex gap-4">
                  <button onClick={() => setShiftSubmitted(prev => ({ ...prev, viewingData: true }))} className="px-6 py-2.5 bg-white dark:bg-transparent border border-gray-300 dark:border-gray-600 rounded-lg font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex items-center gap-2">
                    <span className="material-symbols-outlined text-xl">visibility</span>
                    Xem báo cáo
                  </button>
                  <button onClick={() => navigate('/')} className="px-6 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-semibold hover:bg-gray-800 dark:hover:bg-gray-100 transition-all flex items-center gap-2">
                    <span className="material-symbols-outlined text-xl">home</span>
                    Trang chủ
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Table Area */
            <div className="space-y-4">
              {shiftSubmitted.submitted && shiftSubmitted.viewingData && (
                <div className="flex items-center gap-3 bg-white dark:bg-[#1a1a1a] p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
                  <button onClick={() => setShiftSubmitted(prev => ({ ...prev, viewingData: false }))} className="w-8 h-8 rounded hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center">
                    <span className="material-symbols-outlined">arrow_back</span>
                  </button>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">Chi tiết {currentShift.name}</h3>
                    <p className="text-xs text-gray-500">{shiftSubmitted.submittedBy}</p>
                  </div>
                </div>
              )}

              {/* Search & Tabs */}
              <div className="flex flex-col xl:flex-row gap-4">
                <div className="relative flex-1 group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="material-symbols-outlined text-gray-400 group-focus-within:text-emerald-500 transition-colors">search</span>
                  </div>
                  <input
                    value={search} onChange={e => setSearch(e.target.value)}
                    className="block w-full pl-12 pr-10 py-3.5 border-none ring-1 ring-gray-200 dark:ring-gray-800 rounded-2xl bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 shadow-sm transition-shadow outline-none font-medium"
                    placeholder="Tìm sản phẩm (tên, barcode)..."
                  />
                  {search && (
                    <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center bg-white dark:bg-[#1a1a1a] p-1.5 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-x-auto hide-scrollbar">
                  {makeFilterTabs(stats, !shiftSubmitted.submitted).map(t => {
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
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm font-medium text-gray-500">Đang tải dữ liệu...</p>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-200 dark:border-gray-800 py-20 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800/50 rounded-full flex items-center justify-center mb-4">
                    <span className="material-symbols-outlined text-3xl text-gray-400">inventory_2</span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Không tìm thấy</h3>
                  <p className="text-sm text-gray-500">Hãy thử tìm với từ khóa hoặc bộ lọc khác.</p>
                </div>
              ) : (
                <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                      <thead className="bg-gray-50/50 dark:bg-[#111]">
                        <tr>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-12">#</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Sản phẩm</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-24">Mã Kiot</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-wider w-32">Thực tế</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-24">Lệch</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-48">Ghi chú</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {filteredProducts.map((p, i) => {
                          const isSubmitted = shiftSubmitted.submitted;
                          const d = p.diff;
                          const hasDiff = d != null && d !== 0;

                          const rowClass = hasDiff
                            ? 'bg-yellow-50/30 dark:bg-yellow-900/10 hover:bg-yellow-50/60 dark:hover:bg-yellow-900/20'
                            : i % 2 === 0 ? 'bg-white dark:bg-[#1a1a1a] hover:bg-gray-50/80 dark:hover:bg-gray-800/30' : 'bg-gray-50/40 dark:bg-[#171717] hover:bg-gray-50/80 dark:hover:bg-gray-800/30';

                          return (
                            <tr key={p.id} className={`transition-colors border-l-4 ${hasDiff ? (d > 0 ? 'border-yellow-400' : 'border-red-400') : 'border-transparent'} ${rowClass}`}>
                              <td className="px-4 py-3 text-center text-xs text-gray-400 font-medium">{i + 1}</td>
                              <td className="px-4 py-3">
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{p.productName}</span>
                                  <span className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">{p.barcode || p.sp || 'N/A'}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center text-sm font-semibold text-gray-600 dark:text-gray-400">
                                {p.systemStock ?? '-'}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {isSubmitted ? (
                                  <span className="font-extrabold text-base text-gray-900 dark:text-white">{p.actualStock ?? '-'}</span>
                                ) : (
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    value={p.actualStock == null ? '' : p.actualStock}
                                    onChange={e => updateField(String(p.id), 'actualStock', e.target.value)}
                                    className="w-full h-10 text-center font-bold text-lg bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow"
                                    placeholder="-"
                                  />
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {d == null ? (
                                  <span className="text-gray-400 font-medium">-</span>
                                ) : (
                                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold leading-none ${d === 0 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                                    d > 0 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-500' :
                                      'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                    }`}>
                                    {d > 0 ? `+${d}` : d}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {isSubmitted ? (
                                  <span className="text-sm text-gray-600 dark:text-gray-400">{p.note || '—'}</span>
                                ) : (
                                  <input
                                    type="text"
                                    value={p.note || ''}
                                    onChange={e => updateField(String(p.id), 'note', e.target.value)}
                                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-[#1a1a1a] outline-none transition-shadow"
                                    placeholder="Ghi chú..."
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
                Lấy số liệu tồn kho mới nhất từ hệ thống KiotViet. Vui lòng đồng bộ trước khi bắt đầu kiểm hàng.
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
                onClick={() => { handleSync(); setShowSyncModal(false); }}
                className="flex-1 py-3.5 text-sm font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                Đồng bộ ngay
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmSubmit.show}
        title={confirmSubmit.title}
        message={confirmSubmit.message}
        variant="warning"
        confirmText="Xác nhận nộp"
        onConfirm={doSubmit}
        onCancel={() => setConfirmSubmit({ show: false, message: '', title: '' })}
        loading={submitting}
      />
    </div>
  );
};

export default Inventory;
