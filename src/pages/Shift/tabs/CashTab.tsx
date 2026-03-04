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

    return (
        <div className="sp-tab-body">
            <div className="sp-cash-2col">
                <div className="sp-card sp-cash-report">
                    <div className="sp-card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <div className="sp-card-title" style={{ margin: 0 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#3b82f6' }}>receipt_long</span>
                            Báo Cáo Kết Két
                        </div>
                        <button className="sp-sig-btn" style={{ padding: '0.25rem 0.625rem', background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 4 }}>history</span>
                            Lịch sử
                        </button>
                    </div>
                    <div className="sp-cash-fields">
                        {CASH_REVENUE_FIELDS.map(item => (
                            <div key={item.key} className={`sp-cash-field ${item.type}`}>
                                <div className="sp-cash-field-top">
                                    <span className="sp-cash-field-label">{item.label}</span>
                                    <input
                                        type="number" className="sp-cash-field-input"
                                        value={(cash as unknown as Record<string, number>)[item.key] || ''}
                                        onChange={e => handleCashChange(item.key, parseFloat(e.target.value) || 0)}
                                        placeholder="0" inputMode="numeric" disabled={isCompleted}
                                    />
                                </div>
                                <input
                                    type="text" className="sp-cash-field-note"
                                    value={(cash.item_notes as Record<string, string>)?.[item.key] || ''}
                                    onChange={e => handleCashNoteChange(item.key, e.target.value)}
                                    placeholder="Ghi chú..." disabled={isCompleted}
                                />
                            </div>
                        ))}
                    </div>
                    {/* Payment methods inline */}
                    <div className="sp-cash-payment-bar">
                        {CASH_PAYMENT_FIELDS.map(item => (
                            <div key={item.key} className="sp-cash-pay-item">
                                <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#9ca3af' }}>{item.icon}</span>
                                <span className="sp-cash-pay-label">{item.label}</span>
                                <input
                                    type="number" className="sp-cash-field-input"
                                    value={(cash as unknown as Record<string, number>)[item.key] || ''}
                                    onChange={e => handleCashChange(item.key, parseFloat(e.target.value) || 0)}
                                    placeholder="0" inputMode="numeric" disabled={isCompleted}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT — Quản Lý Tiền Két (mệnh giá) */}
                <div className="sp-card sp-cash-denom">
                    <div className="sp-card-title">
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#f59e0b' }}>account_balance_wallet</span>
                        Quản Lý Tiền Két
                    </div>
                    <div className="sp-denom-table">
                        <div className="sp-denom-thead">
                            <span>Mệnh giá</span>
                            <span>SL</span>
                            <span>Thành tiền</span>
                        </div>
                        {DENOMINATION_VALUES.map(denom => {
                            const key = `denom_${denom}`;
                            const qty = (cash as unknown as Record<string, number>)[key] || 0;
                            return (
                                <div key={denom} className="sp-denom-row">
                                    <span className="sp-denom-label">{fmt(denom)}</span>
                                    <input
                                        type="number" className="sp-denom-input" value={qty || ''}
                                        onChange={e => handleCashChange(key, parseInt(e.target.value) || 0)}
                                        placeholder="0" min="0" inputMode="numeric" disabled={isCompleted}
                                    />
                                    <span className="sp-denom-total">{fmt(qty * denom)}</span>
                                </div>
                            );
                        })}
                    </div>
                    <div className="sp-denom-footer">
                        <span className="sp-denom-footer-label">Tổng tiền két:</span>
                        <span className="sp-denom-footer-value">{fmt(denomTotal)}</span>
                    </div>
                </div>
            </div>

            {/* ── SUMMARY STRIP ── */}
            <div className="sp-cash-strip">
                <div className="sp-strip-row">
                    <span className="sp-strip-label">Tổng tiền két (thực đếm)</span>
                    <span className="sp-strip-value amber">{fmt(denomTotal)}</span>
                </div>
                <div className="sp-strip-row">
                    <span className="sp-strip-label">Tiền cuối ca (dự kiến)</span>
                    <span className="sp-strip-value blue">{fmt(getCashExpected())}</span>
                </div>
                <div className={`sp-strip-row highlight ${diff === 0 ? 'ok' : diff > 0 ? 'warn' : 'danger'}`}>
                    <span className="sp-strip-label bold">Chênh lệch</span>
                    <span className="sp-strip-value bold">{diff > 0 && '+'}{fmt(diff)}</span>
                </div>
            </div>

            {/* Difference reason */}
            {diff !== 0 && (
                <div className="sp-card" style={{ borderColor: '#fecaca' }}>
                    <label className="sp-diff-reason-label">
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>warning</span>
                        Lý do chênh lệch (bắt buộc)
                    </label>
                    <textarea
                        className="sp-diff-reason-input"
                        value={cash.difference_reason || ''}
                        onChange={e => {
                            setCash(prev => ({ ...prev, difference_reason: e.target.value }));
                            handleCashNoteChange('_diff_reason_trigger', e.target.value);
                        }}
                        placeholder="Nhập lý do chênh lệch..."
                        disabled={isCompleted}
                    />
                </div>
            )}

            {/* ── FOOTER: CA NOTES & SIGNATURES ── */}
            <div className="sp-cash-bottom-actions">
                <div className="sp-card sp-shift-notes">
                    <label className="sp-diff-reason-label" style={{ color: '#334155' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit_note</span>
                        Ghi chú ca làm việc
                    </label>
                    <textarea
                        className="sp-diff-reason-input"
                        style={{ borderColor: '#e2e8f0', background: '#f8fafc', color: '#1e293b' }}
                        value={(cash.item_notes as Record<string, string>)?._shift_notes || ''}
                        onChange={e => handleCashNoteChange('_shift_notes', e.target.value)}
                        placeholder="Ghi chú thêm về vận hành ca (nếu có)..."
                        disabled={isCompleted}
                    />
                </div>

                <div className="sp-card sp-signatures">
                    <div className="sp-sig-box">
                        <div className="sp-sig-title">Người giao ca</div>
                        <div className="sp-sig-area">
                            {isCompleted ? <span className="sp-sig-done"><span className="material-symbols-outlined">check_circle</span> Đã xác nhận</span> : <span className="sp-sig-todo">Chưa xác nhận</span>}
                        </div>
                    </div>
                    <div className="sp-sig-box">
                        <div className="sp-sig-title">Quản lý nhận ca</div>
                        <div className="sp-sig-area">
                            {isCompleted ? <span className="sp-sig-done"><span className="material-symbols-outlined">check_circle</span> Đã xác nhận</span> : <button className="sp-sig-btn" disabled={isCompleted}>Ký nhận</button>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CashTab;
