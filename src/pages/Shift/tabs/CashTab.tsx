import React, { useState } from 'react';
import { useShiftContext } from '../ShiftContext';
import { DENOMINATION_VALUES, CASH_REVENUE_FIELDS, CASH_PAYMENT_FIELDS } from '../../../types/shift';

const CashTab: React.FC = () => {
    const {
        cash, isCompleted, handleCashChange, handleCashNoteChange,
        setCash, fmt, getDenomTotal, getCashExpected, getCashDiff,
    } = useShiftContext();

    const diff = getCashDiff();
    const denomTotal = getDenomTotal();
    const [activeNote, setActiveNote] = useState<string | null>(null);

    return (
        <div className="ck-page">
            {/* ═══ TOP ROW: 3 stat cards ═══ */}
            <div className="ck-stats-row">
                <div className="ck-stat-card amber">
                    <span className="material-symbols-outlined ck-stat-icon">account_balance</span>
                    <div className="ck-stat-info">
                        <span className="ck-stat-label">Tổng tiền két (thực đếm)</span>
                        <span className="ck-stat-value">{fmt(denomTotal)}</span>
                    </div>
                </div>
                <div className="ck-stat-card blue">
                    <span className="material-symbols-outlined ck-stat-icon">calculate</span>
                    <div className="ck-stat-info">
                        <span className="ck-stat-label">Tiền cuối ca (dự kiến)</span>
                        <span className="ck-stat-value">{fmt(getCashExpected())}</span>
                    </div>
                </div>
                <div className={`ck-stat-card diff ${diff === 0 ? 'ok' : diff > 0 ? 'warn' : 'danger'}`}>
                    <span className="material-symbols-outlined ck-stat-icon">
                        {diff === 0 ? 'check_circle' : 'error'}
                    </span>
                    <div className="ck-stat-info">
                        <span className="ck-stat-label">Chênh lệch</span>
                        <span className="ck-stat-value">{diff > 0 && '+'}{fmt(diff)}</span>
                    </div>
                </div>
            </div>

            {/* ═══ MAIN: 3-column layout ═══ */}
            <div className="ck-main-grid">
                {/* LEFT — Báo Cáo Kết Két */}
                <div className="ck-col ck-report-col">
                    <div className="ck-col-header">
                        <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#3b82f6' }}>receipt_long</span>
                        <span className="ck-col-title">Báo Cáo Kết Két</span>
                        <button className="ck-history-btn" title="Lịch sử">
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>history</span>
                        </button>
                    </div>
                    <div className="ck-report-list">
                        {CASH_REVENUE_FIELDS.map(item => (
                            <div key={item.key} className={`ck-report-row ${item.type}`}>
                                <span className="ck-report-label">{item.label}</span>
                                <div className="ck-report-input-group">
                                    <input
                                        type="number" className="ck-report-input"
                                        value={(cash as unknown as Record<string, number>)[item.key] || ''}
                                        onChange={e => handleCashChange(item.key, parseFloat(e.target.value) || 0)}
                                        placeholder="0" inputMode="numeric" disabled={isCompleted}
                                    />
                                    <button
                                        className={`ck-note-toggle ${activeNote === item.key ? 'active' : ''} ${(cash.item_notes as Record<string, string>)?.[item.key] ? 'has-note' : ''}`}
                                        onClick={() => setActiveNote(activeNote === item.key ? null : item.key)}
                                        title="Ghi chú"
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>edit_note</span>
                                    </button>
                                </div>
                                {activeNote === item.key && (
                                    <input
                                        type="text" className="ck-report-note"
                                        value={(cash.item_notes as Record<string, string>)?.[item.key] || ''}
                                        onChange={e => handleCashNoteChange(item.key, e.target.value)}
                                        placeholder="Ghi chú..." disabled={isCompleted}
                                        autoFocus
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                    {/* Payment methods inline */}
                    <div className="ck-payments">
                        {CASH_PAYMENT_FIELDS.map(item => (
                            <div key={item.key} className="ck-pay-row">
                                <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#94a3b8' }}>{item.icon}</span>
                                <span className="ck-pay-label">{item.label}</span>
                                <input
                                    type="number" className="ck-report-input sm"
                                    value={(cash as unknown as Record<string, number>)[item.key] || ''}
                                    onChange={e => handleCashChange(item.key, parseFloat(e.target.value) || 0)}
                                    placeholder="0" inputMode="numeric" disabled={isCompleted}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* CENTER — Quản Lý Tiền Két (denominations) */}
                <div className="ck-col ck-denom-col">
                    <div className="ck-col-header">
                        <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#f59e0b' }}>account_balance_wallet</span>
                        <span className="ck-col-title">Quản Lý Tiền Két</span>
                    </div>
                    <div className="ck-denom-grid">
                        <div className="ck-denom-head">
                            <span>Mệnh giá</span>
                            <span>SL</span>
                            <span>Thành tiền</span>
                        </div>
                        {DENOMINATION_VALUES.map(denom => {
                            const key = `denom_${denom}`;
                            const qty = (cash as unknown as Record<string, number>)[key] || 0;
                            return (
                                <div key={denom} className="ck-denom-row">
                                    <span className="ck-denom-label">{fmt(denom)}</span>
                                    <input
                                        type="number" className="ck-denom-input" value={qty || ''}
                                        onChange={e => handleCashChange(key, parseInt(e.target.value) || 0)}
                                        placeholder="0" min="0" inputMode="numeric" disabled={isCompleted}
                                    />
                                    <span className="ck-denom-total">{fmt(qty * denom)}</span>
                                </div>
                            );
                        })}
                    </div>
                    <div className="ck-denom-footer">
                        <span className="ck-denom-footer-label">Tổng tiền két:</span>
                        <span className="ck-denom-footer-value">{fmt(denomTotal)}</span>
                    </div>
                </div>

                {/* RIGHT — Nộp kết két / Notes / Signatures */}
                <div className="ck-col ck-submit-col">
                    <div className="ck-col-header">
                        <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#10b981' }}>task_alt</span>
                        <span className="ck-col-title">Nộp Kết Két</span>
                    </div>

                    {/* Difference reason */}
                    {diff !== 0 && (
                        <div className="ck-diff-card">
                            <div className="ck-diff-header">
                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>warning</span>
                                Lý do chênh lệch (bắt buộc)
                            </div>
                            <textarea
                                className="ck-diff-input"
                                value={cash.difference_reason || ''}
                                onChange={e => {
                                    setCash(prev => ({ ...prev, difference_reason: e.target.value }));
                                    handleCashNoteChange('_diff_reason_trigger', e.target.value);
                                }}
                                placeholder="Nhập lý do chênh lệch..."
                                disabled={isCompleted}
                                rows={2}
                            />
                        </div>
                    )}

                    {/* Shift notes */}
                    <div className="ck-notes-card">
                        <div className="ck-notes-header">
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit_note</span>
                            Ghi chú ca làm việc
                        </div>
                        <textarea
                            className="ck-notes-input"
                            value={(cash.item_notes as Record<string, string>)?._shift_notes || ''}
                            onChange={e => handleCashNoteChange('_shift_notes', e.target.value)}
                            placeholder="Ghi chú thêm về vận hành ca (nếu có)..."
                            disabled={isCompleted}
                            rows={3}
                        />
                    </div>

                    {/* Signatures */}
                    <div className="ck-signatures">
                        <div className="ck-sig-row">
                            <div className="ck-sig-info">
                                <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#64748b' }}>person</span>
                                <span className="ck-sig-label">Người giao ca</span>
                            </div>
                            <div className="ck-sig-status">
                                {isCompleted ? (
                                    <span className="ck-sig-done">
                                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span>
                                        Đã xác nhận
                                    </span>
                                ) : (
                                    <span className="ck-sig-pending">Chưa xác nhận</span>
                                )}
                            </div>
                        </div>
                        <div className="ck-sig-row">
                            <div className="ck-sig-info">
                                <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#64748b' }}>supervisor_account</span>
                                <span className="ck-sig-label">Quản lý nhận ca</span>
                            </div>
                            <div className="ck-sig-status">
                                {isCompleted ? (
                                    <span className="ck-sig-done">
                                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span>
                                        Đã xác nhận
                                    </span>
                                ) : (
                                    <button className="ck-sig-btn" disabled={isCompleted}>Ký nhận</button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CashTab;
