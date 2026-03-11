import React, { useState, useRef, useEffect } from 'react';
import { useShiftContext } from '../ShiftContext';
import { useToast } from '../../../contexts';
import { DENOMINATION_VALUES, CASH_REVENUE_FIELDS, CASH_PAYMENT_FIELDS } from '../../../types/shift';

const CashInput = ({ itemKey, value, onChange, disabled, className }: { itemKey: string; value: number; onChange: (key: string, val: number) => void; disabled: boolean; className?: string }) => {
    const [localVal, setLocalVal] = useState<string>(value ? value.toString() : '');
    
    useEffect(() => { setLocalVal(value ? value.toString() : ''); }, [value]);

    const handleBlur = () => {
        const parsed = parseFloat(localVal) || 0;
        if (parsed !== value) onChange(itemKey, parsed);
    };

    return (
        <input
            type="number" className={className || "ck-report-input"}
            value={localVal}
            onChange={e => setLocalVal(e.target.value)}
            onBlur={handleBlur}
            placeholder="0" inputMode="numeric" disabled={disabled}
        />
    );
};

const DenomRow = ({ denom, qty, disabled, onChange, fmt }: { denom: number, qty: number, disabled: boolean, onChange: (k: string, v: number) => void, fmt: (v: number) => string }) => {
    const key = `denom_${denom}`;
    const [localQty, setLocalQty] = useState<string>(qty ? qty.toString() : '');

    useEffect(() => { setLocalQty(qty ? qty.toString() : ''); }, [qty]);

    const handleBlur = () => {
        const parsed = parseInt(localQty) || 0;
        if (parsed !== qty) onChange(key, parsed);
    };

    const displayQty = parseInt(localQty) || 0;

    return (
        <div className="ck-denom-row">
            <span className="ck-denom-label">{fmt(denom)}</span>
            <input
                type="number" className="ck-denom-input" value={localQty}
                onChange={e => setLocalQty(e.target.value)}
                onBlur={handleBlur}
                placeholder="0" min="0" inputMode="numeric" disabled={disabled}
            />
            <span className="ck-denom-total">{fmt(displayQty * denom)}</span>
        </div>
    );
};

const NoteInput = ({ itemKey, value, onChange, disabled, className, placeholder, isArea, autoFocus }: { itemKey: string, value: string, onChange: (k: string, v: string) => void, disabled: boolean, className: string, placeholder: string, isArea?: boolean, autoFocus?: boolean }) => {
    const [localVal, setLocalVal] = useState(value || '');

    useEffect(() => { setLocalVal(value || ''); }, [value]);

    const handleBlur = () => {
        if (localVal !== (value || '')) onChange(itemKey, localVal);
    };

    if (isArea) {
        return <textarea className={className} value={localVal} onChange={e => setLocalVal(e.target.value)} onBlur={handleBlur} placeholder={placeholder} disabled={disabled} rows={3} />;
    }
    return <input type="text" className={className} value={localVal} onChange={e => setLocalVal(e.target.value)} onBlur={handleBlur} placeholder={placeholder} disabled={disabled} autoFocus={autoFocus} />;
};

const CashTab: React.FC = () => {
    const {
        cash, isCompleted, handleCashChange, handleCashNoteChange,
        setCash, fmt, getDenomTotal, getCashExpected, getCashDiff,
    } = useShiftContext();
    const toast = useToast();

    const diff = getCashDiff();
    const denomTotal = getDenomTotal();
    const [activeNote, setActiveNote] = useState<string | null>(null);
    const [isResubmitting, setIsResubmitting] = useState(false);

    const isCashLocked = isCompleted && cash.status !== 'REJECTED';

    const handleResubmit = async () => {
        if (!cash || !cash.difference_reason?.trim() && getCashDiff() !== 0) {
            toast.warning('Vui lòng nhập lý do chênh lệch trước khi bấm Nộp lại.');
            return;
        }
        setIsResubmitting(true);
        try {
            const { CashService } = await import('../../../services/shift/cash');
            await CashService.submit(cash.shift_id);
            setCash(prev => prev ? { ...prev, status: 'SUBMITTED' } : null);
            toast.success('Nộp lại báo cáo thành công!');
        } catch (e) {
            toast.error('Gặp lỗi khi nộp báo cáo.');
        } finally {
            setIsResubmitting(false);
        }
    };

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
                                    <CashInput
                                        itemKey={item.key}
                                        value={(cash as unknown as Record<string, number>)[item.key] || 0}
                                        onChange={handleCashChange}
                                        disabled={isCashLocked}
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
                                    <NoteInput
                                        className="ck-report-note"
                                        itemKey={item.key}
                                        value={(cash.item_notes as Record<string, string>)?.[item.key] || ''}
                                        onChange={handleCashNoteChange}
                                        placeholder="Ghi chú..."
                                        disabled={isCashLocked}
                                        autoFocus={true}
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
                                <CashInput
                                    className="ck-report-input sm"
                                    itemKey={item.key}
                                    value={(cash as unknown as Record<string, number>)[item.key] || 0}
                                    onChange={handleCashChange}
                                    disabled={isCashLocked}
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
                                <DenomRow key={denom} denom={denom} qty={qty} disabled={isCashLocked} onChange={handleCashChange} fmt={fmt} />
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
                    {Math.abs(diff) > 0 && (
                        <div className="ck-diff-card">
                            <div className="ck-diff-header">
                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>warning</span>
                                Lý do chênh lệch (bắt buộc)
                            </div>
                            <NoteInput
                                className="ck-diff-input"
                                itemKey="_diff_reason_trigger"
                                value={cash.difference_reason || ''}
                                onChange={(k, v) => {
                                    setCash(prev => prev ? ({ ...prev, difference_reason: v }) : null);
                                    handleCashNoteChange(k, v);
                                }}
                                placeholder="Nhập lý do chênh lệch..."
                                disabled={isCashLocked}
                                isArea={true}
                            />
                        </div>
                    )}

                    {/* Shift notes */}
                    <div className="ck-notes-card">
                        <div className="ck-notes-header">
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit_note</span>
                            Ghi chú ca làm việc
                        </div>
                        <NoteInput
                            className="ck-notes-input"
                            itemKey="_shift_notes"
                            value={(cash.item_notes as Record<string, string>)?._shift_notes || ''}
                            onChange={handleCashNoteChange}
                            placeholder="Ghi chú thêm về vận hành ca (nếu có)..."
                            disabled={isCashLocked}
                            isArea={true}
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
                                {cash.status === 'REJECTED' ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <span className="ck-sig-done" style={{ color: '#ef4444' }}>
                                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>cancel</span>
                                            Bị từ chối duyệt
                                        </span>
                                        <button
                                            onClick={handleResubmit}
                                            disabled={isResubmitting}
                                            style={{ backgroundColor: '#f59e0b', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                                        >
                                            {isResubmitting ? 'Đang nộp lại...' : 'Nộp lại Báo Cáo'}
                                        </button>
                                    </div>
                                ) : isCompleted ? (
                                    <span className="ck-sig-done">
                                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span>
                                        Đã xác nhận
                                    </span>
                                ) : (
                                    <button className="ck-sig-btn" disabled={isCashLocked}>Ký nhận</button>
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
