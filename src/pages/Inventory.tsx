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

  /* ─── Loading ─── */
  if (shiftsLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="inv-spinner" />
      </div>
    );
  }

  return (
    <div className="inv-page">
      {/* ══════ PORTAL HEADER ══════ */}
      <PortalHeader>
        <div className="flex items-center justify-between w-full h-full pr-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="inv-icon-btn" aria-label="Quay lại">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div>
              <h1 className="text-base font-extrabold text-gray-900 flex items-center gap-1.5 leading-tight">
                <span className="material-symbols-outlined text-primary text-lg">inventory_2</span>
                Kiểm Kho
              </h1>
              <p className="text-[10px] text-gray-400 leading-tight">
                {user.store} • {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
          </div>

          {!shiftSubmitted.submitted && (
            <button
              onClick={handleSubmit}
              disabled={submitting || loading || stats.checked === 0}
              className="inv-primary-btn"
            >
              {submitting ? (
                <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-base">send</span>
              )}
              <span className="hidden sm:inline">Nộp Báo Cáo</span>
            </button>
          )}
        </div>
      </PortalHeader>

      {/* ══════ CONTROL BAR: Shifts + Tools ══════ */}
      <div className="inv-control-bar">
        {/* Shift pills */}
        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex-shrink-0 hidden sm:block">Ca</span>
          {shifts.map(s => (
            <button
              key={s.id}
              onClick={() => setShift(s.id)}
              className={`inv-shift-pill ${shift === s.id ? 'active' : ''}`}
              style={shift === s.id ? {
                background: `linear-gradient(135deg, var(--sf), var(--st))`,
                ['--sf' as any]: s.color.includes('amber') ? '#fbbf24' : s.color.includes('blue') ? '#60a5fa' : '#a78bfa',
                ['--st' as any]: s.color.includes('orange') ? '#fb923c' : s.color.includes('indigo') ? '#818cf8' : '#8b5cf6',
              } : undefined}
            >
              <span className="material-symbols-outlined text-sm">{s.icon}</span>
              {s.name}
            </button>
          ))}
          <span className="text-[11px] text-gray-400 ml-1 hidden sm:inline flex-shrink-0">{currentShift.time}</span>
        </div>

        {/* Tools */}
        {!shiftSubmitted.submitted && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => setShowSyncModal(true)}
              disabled={syncing || loading}
              className={`inv-tool-btn ${syncing ? 'syncing' : ''}`}
            >
              <span className={`material-symbols-outlined text-sm ${syncing ? 'animate-spin' : ''}`}>
                {syncing ? 'progress_activity' : 'cloud_sync'}
              </span>
              <span className="hidden sm:inline">{syncing ? 'Đang...' : 'Đồng bộ Kiot'}</span>
            </button>
            <button onClick={handlePrint} disabled={products.length === 0} className="inv-tool-btn">
              <span className="material-symbols-outlined text-sm">print</span>
              <span className="hidden sm:inline">In</span>
            </button>
          </div>
        )}
      </div>

      {/* ══════ MAIN CONTENT ══════ */}
      <main className="inv-main">
        <div className="max-w-6xl mx-auto space-y-3">

          {/* ── INLINE PROGRESS ── */}
          <div className="inv-progress-row">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="font-bold">{stats.checked}/{stats.total}</span>
              <span className="text-gray-300">đã kiểm</span>
            </div>
            <div className="inv-progress-track flex-1 mx-3">
              <div
                className={`inv-progress-fill ${progressPercent === 100 ? 'done' : ''}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className={`text-xs font-extrabold ${progressPercent === 100 ? 'text-emerald-600' : 'text-gray-400'}`}>
              {progressPercent}%
            </span>
          </div>

          {/* ══════ SUBMITTED STATE ══════ */}
          {shiftSubmitted.submitted && !shiftSubmitted.viewingData ? (
            <div className="inv-success-card">
              <div className="inv-success-glow" />
              <div className="relative text-center py-10 px-6">
                {/* Icon */}
                <div className="relative inline-flex mb-5">
                  <div className="absolute inset-0 w-20 h-20 rounded-full bg-emerald-400/20 animate-pulse" />
                  <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-xl">
                    <span className="material-symbols-outlined text-white text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  </div>
                </div>
                <h2 className="text-xl font-black text-gray-900 mb-1">Đã hoàn tất!</h2>
                <p className="text-sm text-gray-500 mb-6">{currentShift.name} ({currentShift.time})</p>

                {/* Submitter chip */}
                <div className="inline-flex items-center gap-3 bg-white/80 rounded-xl px-4 py-2.5 ring-1 ring-gray-100 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center">
                    <span className="material-symbols-outlined text-white text-sm">person</span>
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-800">{shiftSubmitted.submittedBy}</span>
                      <span className={`inv-badge ${(shiftSubmitted.status || 'pending').toLowerCase()}`}>
                        {shiftSubmitted.status === 'APPROVED' ? 'Đã duyệt' : shiftSubmitted.status === 'REJECTED' ? 'Từ chối' : 'Chờ duyệt'}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400">
                      {shiftSubmitted.submittedAt
                        ? new Date(shiftSubmitted.submittedAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
                        : 'Vừa xong'}
                    </p>
                  </div>
                </div>

                {/* Action row */}
                <div className="flex gap-3 max-w-xs mx-auto">
                  <button
                    onClick={() => setShiftSubmitted(prev => ({ ...prev, viewingData: true }))}
                    className="flex-1 inv-outline-btn"
                  >
                    <span className="material-symbols-outlined text-lg">visibility</span>
                    Xem báo cáo
                  </button>
                  <button onClick={() => navigate('/')} className="flex-1 inv-dark-btn">
                    <span className="material-symbols-outlined text-lg">home</span>
                    Về trang chủ
                  </button>
                </div>
              </div>
            </div>

          ) : shiftSubmitted.submitted && shiftSubmitted.viewingData ? (
            /* ══════ READ-ONLY DETAIL ══════ */
            <>
              <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-3">
                <button onClick={() => setShiftSubmitted(prev => ({ ...prev, viewingData: false }))} className="inv-icon-btn small">
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                </button>
                <div className="flex-1">
                  <h2 className="text-sm font-extrabold text-gray-900">Báo cáo {currentShift.name}</h2>
                  <p className="text-[10px] text-gray-400">{shiftSubmitted.submittedBy} • {currentShift.time}</p>
                </div>
                <span className={`inv-badge ${(shiftSubmitted.status || 'pending').toLowerCase()}`}>
                  {shiftSubmitted.status === 'APPROVED' ? 'Đã duyệt' : shiftSubmitted.status === 'REJECTED' ? 'Từ chối' : 'Chờ duyệt'}
                </span>
              </div>

              {/* Search + Filter */}
              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                <div className="inv-search flex-1 max-w-sm">
                  <span className="material-symbols-outlined">search</span>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm sản phẩm..." />
                  {search && <button onClick={() => setSearch('')} className="inv-search-x"><span className="material-symbols-outlined text-xs">close</span></button>}
                </div>
                <div className="inv-tabs">
                  {[
                    { key: 'ALL', label: 'Tất cả', count: stats.total },
                    { key: 'MISSING', label: 'Thiếu', count: stats.missing, accent: 'red' },
                    { key: 'OVER', label: 'Thừa', count: stats.over, accent: 'amber' },
                  ].map(t => (
                    <button key={t.key} onClick={() => setFilterStatus(t.key)} className={`inv-tab ${filterStatus === t.key ? 'on' : ''} ${t.accent || ''}`}>
                      {t.label} <span className="inv-tab-count">{t.count}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Read-only table */}
              <div className="inv-card">
                <div className="overflow-x-auto">
                  <table className="inv-table">
                    <colgroup>
                      <col style={{ width: '5%' }} /><col style={{ width: '30%' }} /><col style={{ width: '15%' }} />
                      <col style={{ width: '10%' }} /><col style={{ width: '10%' }} /><col style={{ width: '10%' }} /><col style={{ width: '20%' }} />
                    </colgroup>
                    <thead><tr>
                      <th className="text-center">#</th><th>Sản phẩm</th><th className="text-center">Barcode</th>
                      <th className="text-center">Kiot</th><th className="text-center">Thực tế</th><th className="text-center">Lệch</th><th>Ghi chú</th>
                    </tr></thead>
                    <tbody>
                      {filteredProducts.map((p, i) => {
                        const d = p.diff;
                        const cls = d == null ? '' : d === 0 ? 'ok' : d < 0 ? 'miss' : 'over';
                        return (
                          <tr key={p.id} className={cls ? `row-${cls}` : ''}>
                            <td className="text-center text-gray-400 text-xs">{i + 1}</td>
                            <td className="font-semibold text-gray-800 truncate">{p.productName}</td>
                            <td className="text-center text-xs text-gray-400 font-mono">{p.barcode || ''}</td>
                            <td className="text-center font-bold">{p.systemStock ?? '-'}</td>
                            <td className="text-center font-bold text-gray-900">{p.actualStock ?? '-'}</td>
                            <td className={`text-center font-extrabold diff-${cls}`}>
                              {d == null ? '-' : d > 0 ? `+${d}` : d}
                            </td>
                            <td className="text-xs text-gray-400">{p.note || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>

          ) : !shiftSubmitted.submitted ? (
            /* ══════ EDITABLE MODE ══════ */
            <>
              {/* Search + Filter */}
              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                <div className="inv-search flex-1 max-w-md">
                  <span className="material-symbols-outlined">search</span>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm sản phẩm theo tên hoặc barcode..." />
                  {search && <button onClick={() => setSearch('')} className="inv-search-x"><span className="material-symbols-outlined text-xs">close</span></button>}
                </div>
                <div className="inv-tabs">
                  {[
                    { key: 'ALL', label: 'Tất cả', count: stats.total },
                    { key: 'PENDING', label: 'Chưa kiểm', count: stats.total - stats.checked },
                    { key: 'MISSING', label: 'Thiếu', count: stats.missing, accent: 'red' },
                    { key: 'OVER', label: 'Thừa', count: stats.over, accent: 'amber' },
                  ].map(t => (
                    <button key={t.key} onClick={() => setFilterStatus(t.key)} className={`inv-tab ${filterStatus === t.key ? 'on' : ''} ${t.accent || ''}`}>
                      {t.label} <span className="inv-tab-count">{t.count}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Table */}
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="inv-spinner" />
                  <p className="text-sm text-gray-400">Đang tải...</p>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-16 bg-white/60 rounded-2xl border-2 border-dashed border-gray-200">
                  <span className="material-symbols-outlined text-4xl text-gray-300 mb-2 block">inventory_2</span>
                  <p className="font-bold text-gray-500">{search ? 'Không tìm thấy sản phẩm' : 'Danh sách trống'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{search ? 'Thử từ khóa khác' : ''}</p>
                </div>
              ) : (
                <div className="inv-card">
                  <div className="overflow-x-auto">
                    <table className="inv-table editable">
                      <colgroup>
                        <col style={{ width: '4%' }} /><col style={{ width: '24%' }} /><col style={{ width: '9%' }} />
                        <col style={{ width: '14%' }} /><col style={{ width: '7%' }} /><col style={{ width: '14%' }} />
                        <col style={{ width: '8%' }} /><col style={{ width: '20%' }} />
                      </colgroup>
                      <thead><tr>
                        <th className="text-center">#</th><th>Tên Sản Phẩm</th><th className="text-center">Mã SP</th>
                        <th className="text-center">Barcode</th><th className="text-center">Kiot</th>
                        <th className="text-center inv-th-highlight">Thực tế</th><th className="text-center">Lệch</th><th>Ghi chú</th>
                      </tr></thead>
                      <tbody>
                        {filteredProducts.map((p, i) => {
                          const d = p.diff;
                          const cls = d == null ? '' : d === 0 ? 'ok' : d < 0 ? 'miss' : 'over';
                          return (
                            <tr key={p.id} className={`${i % 2 ? 'alt' : ''} ${cls ? `row-${cls}` : ''}`}>
                              <td className="text-center text-gray-400 text-xs">{i + 1}</td>
                              <td className="font-semibold text-gray-800 truncate">{p.productName}</td>
                              <td className="text-center text-[11px] text-gray-400 font-mono">{p.sp || ''}</td>
                              <td className="text-center text-[11px] text-gray-400 font-mono">{p.barcode || ''}</td>
                              <td className="text-center font-bold text-gray-600">{p.systemStock ?? '-'}</td>
                              <td className="inv-input-cell">
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  value={p.actualStock == null ? '' : p.actualStock}
                                  onChange={e => updateField(String(p.id), 'actualStock', e.target.value)}
                                  placeholder="0"
                                />
                              </td>
                              <td className={`text-center font-extrabold diff-${cls}`}>
                                {d == null ? '-' : d}
                              </td>
                              <td className="inv-note-cell">
                                <input
                                  type="text"
                                  value={p.note || ''}
                                  onChange={e => updateField(String(p.id), 'note', e.target.value)}
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

      {/* ══════ SYNC MODAL ══════ */}
      {showSyncModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="inv-modal">
            <div className="inv-modal-head">
              <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">cloud_sync</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-800">Đồng bộ KiotViet</h3>
                <p className="text-[11px] text-gray-400">Cập nhật tồn kho real-time</p>
              </div>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-gray-600 leading-relaxed">
                Hệ thống sẽ lấy số tồn kho từ <strong>KiotViet</strong> và cập nhật vào cột <strong>"Kiot"</strong>.
              </p>
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                <span className="material-symbols-outlined text-blue-500 text-sm mt-0.5">tips_and_updates</span>
                <p className="text-xs text-blue-700">Nên đồng bộ <strong>trước khi kiểm</strong> để có số liệu chính xác.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
              <button onClick={() => setShowSyncModal(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Hủy</button>
              <button onClick={handleSync} className="px-4 py-2 text-sm font-bold text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">cloud_sync</span>Đồng bộ ngay
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
        confirmText="Nộp báo cáo"
        onConfirm={doSubmit}
        onCancel={() => setConfirmSubmit({ show: false, message: '', title: '' })}
        loading={submitting}
      />
    </div>
  );
};

export default Inventory;
