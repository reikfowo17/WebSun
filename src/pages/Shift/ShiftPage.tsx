import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { User } from '../../types';
import type {
    Shift, ShiftType, CashSettlement,
    ChecklistTemplate, ChecklistResponse,
    ShiftAsset, ShiftAssetCheck,
    ShiftInventoryHandover, ShiftQuickReport,
    HandoverProduct, DayOfWeek,
} from '../../types/shift';
import {
    SHIFT_LABELS, SHIFT_ICONS, CHECKLIST_LABELS,
    CHECKLIST_ICONS, DENOMINATION_VALUES,
    CASH_REVENUE_FIELDS, CASH_PAYMENT_FIELDS,
} from '../../types/shift';
import {
    ShiftService, CashService, ChecklistService,
    AssetService, HandoverService, QuickReportService,
} from '../../services/shift';
import { supabase } from '../../lib/supabase';

// Day of week helper: JS Date.getDay() → 0=Sun → DayOfWeek 1=CN
const getTodayDOW = (): DayOfWeek => {
    const d = new Date().getDay();
    return (d === 0 ? 1 : d + 1) as DayOfWeek;
};

interface ShiftPageProps {
    user: User;
}

const ShiftPage: React.FC<ShiftPageProps> = ({ user }) => {
    // ── State ──
    const [shift, setShift] = useState<Shift | null>(null);
    const [selectedType, setSelectedType] = useState<ShiftType | null>(null);
    const [loading, setLoading] = useState(true);
    const [starting, setStarting] = useState(false);
    const [ending, setEnding] = useState(false);
    const [storeId, setStoreId] = useState<string>('');

    // Cash
    const [cash, setCash] = useState<Partial<CashSettlement>>({ item_notes: {} });
    const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const autoSaveRef = useRef<NodeJS.Timeout | null>(null);

    // Checklist — templates include "NOTE" items shown as notices
    const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
    const [responses, setResponses] = useState<ChecklistResponse[]>([]);

    // Assets
    const [assets, setAssets] = useState<ShiftAsset[]>([]);
    const [assetChecks, setAssetChecks] = useState<ShiftAssetCheck[]>([]);

    // Handover
    const [handoverItems, setHandoverItems] = useState<ShiftInventoryHandover[]>([]);

    // Quick Reports
    const [quickReports, setQuickReports] = useState<ShiftQuickReport[]>([]);

    // ── Load store ──
    useEffect(() => {
        const loadStore = async () => {
            const { data } = await supabase
                .from('user_stores')
                .select('store_id')
                .eq('user_id', user.id)
                .eq('is_primary', true)
                .maybeSingle();
            if (data) {
                setStoreId(data.store_id);
            } else {
                const { data: u } = await supabase
                    .from('users')
                    .select('store_id')
                    .eq('id', user.id)
                    .single();
                if (u?.store_id) setStoreId(u.store_id);
            }
        };
        loadStore();
    }, [user.id]);

    // ── Auto-detect shift + load today's shift ──
    useEffect(() => {
        if (!storeId) return;
        const loadShift = async () => {
            setLoading(true);
            try {
                const hour = new Date().getHours();
                let autoType: ShiftType = 'MORNING';
                if (hour >= 14 && hour < 20) autoType = 'AFTERNOON';
                else if (hour >= 20 || hour < 6) autoType = 'EVENING';
                setSelectedType(autoType);

                const existing = await ShiftService.getTodayShift(storeId, autoType);
                if (existing) {
                    setShift(existing);
                    await loadShiftData(existing.id, autoType);
                }
            } catch (err) {
                console.error('[ShiftPage] Load error:', err);
            } finally {
                setLoading(false);
            }
        };
        loadShift();
    }, [storeId]);

    // ── Load all shift data ──
    const loadShiftData = useCallback(async (shiftId: string, shiftType: ShiftType) => {
        const dayOfWeek = getTodayDOW();
        const [cashData, tmpl, resp, assetList, checks, handover, quickData] = await Promise.all([
            CashService.getByShift(shiftId),
            ChecklistService.getTemplates(storeId, shiftType, dayOfWeek),
            ChecklistService.getResponses(shiftId),
            AssetService.getAssets(storeId),
            AssetService.getChecks(shiftId),
            HandoverService.getItems(shiftId),
            QuickReportService.getReports(shiftId),
        ]);

        if (cashData) setCash(cashData);
        setTemplates(tmpl);
        setResponses(resp);
        setAssets(assetList);
        setAssetChecks(checks);
        setHandoverItems(handover);
        setQuickReports(quickData);
    }, [storeId]);

    // ── Start Shift ──
    const handleStartShift = async () => {
        if (!selectedType || !storeId || starting) return;
        setStarting(true);
        try {
            const newShift = await ShiftService.startShift(storeId, selectedType, user.id);
            setShift(newShift);

            const dayOfWeek = getTodayDOW();

            // Init checklist (filtered by ca + thứ)
            const tmpl = await ChecklistService.getTemplates(storeId, selectedType, dayOfWeek);
            setTemplates(tmpl);
            const resp = await ChecklistService.initResponses(newShift.id, tmpl);
            setResponses(resp);

            // Init assets
            const assetList = await AssetService.getAssets(storeId);
            setAssets(assetList);
            const checks = await AssetService.initChecks(newShift.id, assetList, user.id);
            setAssetChecks(checks);

            // Init handover from admin templates
            const productTemplates = await HandoverService.getProductTemplates(storeId);
            const handover = await HandoverService.initFromTemplates(newShift.id, productTemplates, user.id);
            setHandoverItems(handover);

            // Init cash settlement
            await CashService.upsert(newShift.id, { status: 'DRAFT', item_notes: {} });
        } catch (err: any) {
            console.error('[ShiftPage] Start error:', err);
            alert(err.message || 'Không thể bắt đầu ca');
        } finally {
            setStarting(false);
        }
    };

    // ── End Shift ──
    const handleEndShift = async () => {
        if (!shift || ending) return;
        const incomplete = responses.filter(r => !r.is_completed);
        if (incomplete.length > 0) {
            const ok = confirm(`Còn ${incomplete.length} công việc chưa hoàn thành. Bạn vẫn muốn kết thúc ca?`);
            if (!ok) return;
        }
        setEnding(true);
        try {
            await CashService.submit(shift.id);
            await ShiftService.endShift(shift.id, user.id);
            setShift(prev => prev ? { ...prev, status: 'COMPLETED' } : null);
        } catch (err: any) {
            console.error('[ShiftPage] End error:', err);
            alert(err.message || 'Không thể kết thúc ca');
        } finally {
            setEnding(false);
        }
    };

    // ── Auto-save Cash ──
    const handleCashChange = (field: string, value: number) => {
        setCash(prev => ({ ...prev, [field]: value }));
        debouncedSave({ [field]: value });
    };

    const handleCashNoteChange = (field: string, note: string) => {
        const newNotes = { ...(cash.item_notes || {}), [field]: note };
        setCash(prev => ({ ...prev, item_notes: newNotes }));
        debouncedSave({ item_notes: newNotes });
    };

    const debouncedSave = (updates: Record<string, any>) => {
        if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
        setAutoSaveStatus('saving');
        autoSaveRef.current = setTimeout(async () => {
            if (!shift) return;
            try {
                const updated = await CashService.upsert(shift.id, { ...cash, ...updates });
                setCash(updated);
                setAutoSaveStatus('saved');
                setTimeout(() => setAutoSaveStatus('idle'), 2000);
            } catch {
                setAutoSaveStatus('error');
            }
        }, 1000);
    };

    // ── Toggle Checklist ──
    const handleToggleChecklist = async (response: ChecklistResponse) => {
        if (!shift || isCompleted) return;
        try {
            const updated = await ChecklistService.toggleItem(response.id, !response.is_completed, user.id);
            setResponses(prev => prev.map(r => r.id === updated.id ? updated : r));
        } catch (err) {
            console.error('[ShiftPage] Toggle error:', err);
        }
    };

    // ── Update Asset Check ──
    const handleAssetCheck = async (assetId: string, okCount: number, damagedCount: number) => {
        if (!shift) return;
        try {
            const updated = await AssetService.upsertCheck(shift.id, assetId, okCount, damagedCount, user.id);
            setAssetChecks(prev => {
                const idx = prev.findIndex(c => c.asset_id === assetId);
                if (idx >= 0) { const arr = [...prev]; arr[idx] = updated; return arr; }
                return [...prev, updated];
            });
        } catch (err) {
            console.error('[ShiftPage] Asset check error:', err);
        }
    };

    // ── Update Handover qty ──
    const handleHandoverUpdate = async (item: ShiftInventoryHandover, field: 'system_qty' | 'actual_qty', value: number) => {
        try {
            const updated = await HandoverService.updateItem(item.id, { [field]: value });
            setHandoverItems(prev => prev.map(h => h.id === updated.id ? updated : h));
        } catch (err) {
            console.error('[ShiftPage] Handover error:', err);
        }
    };

    // ── Helpers ──
    const formatCurrency = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ';
    const isCompleted = shift?.status === 'COMPLETED' || shift?.status === 'LOCKED';

    const getDenomTotal = () => {
        let total = 0;
        for (const d of DENOMINATION_VALUES) {
            total += ((cash as any)[`denom_${d}`] || 0) * d;
        }
        return total;
    };

    const getCashExpected = () => {
        return (cash.cash_start || 0)
            + (cash.revenue_before_midnight || 0)
            + (cash.revenue_after_midnight || 0)
            + (cash.refund_amount || 0)
            + (cash.customer_return || 0)
            - (cash.supply_cost || 0)
            - (cash.cancel_amount || 0)
            - (cash.export_amount || 0)
            - (cash.withdraw_amount || 0)
            - (cash.momo_amount || 0)
            - (cash.card_amount || 0)
            - (cash.point_payment || 0);
    };

    const getCashDiff = () => getDenomTotal() - getCashExpected();

    // Checklist: separate notes vs actionable
    const noteItems = templates.filter(t => t.category === 'NOTE');
    const actionableTemplates = templates.filter(t => t.category !== 'NOTE');
    const groupedChecklist = () => {
        const groups: Record<string, ChecklistResponse[]> = {};
        for (const r of responses) {
            const cat = r.template?.category || 'START_SHIFT';
            if (cat === 'NOTE') continue; // Don't show notes in checklist
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(r);
        }
        return groups;
    };
    const checkProgress = (() => {
        const total = responses.length;
        const completed = responses.filter(r => r.is_completed).length;
        return { total, completed, pct: total > 0 ? Math.round((completed / total) * 100) : 0 };
    })();

    // ── RENDER: Loading ──
    if (loading) {
        return (
            <div className="shift-page">
                <div className="shift-empty">
                    <div style={{ width: 48, height: 48, border: '4px solid #f59e0b', borderTopColor: 'transparent', borderRadius: 999, animation: 'spin 1s linear infinite', margin: '0 auto' }} />
                    <p className="shift-empty-desc" style={{ marginTop: '1rem' }}>Đang tải thông tin ca...</p>
                </div>
            </div>
        );
    }

    // ── RENDER: Start Shift ──
    if (!shift) {
        return (
            <div className="shift-page">
                <div className="shift-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
                    <div className="shift-start-card">
                        <div className="shift-header-badge morning" style={{ margin: '0 auto' }}>
                            <span className="material-symbols-outlined material-symbols-fill">store</span>
                        </div>
                        <h2 className="shift-start-title">Bắt đầu Ca Làm Việc</h2>
                        <p className="shift-start-desc">Chọn ca để bắt đầu nhập liệu và báo cáo</p>
                        <div className="shift-type-selector">
                            {(['MORNING', 'AFTERNOON', 'EVENING'] as ShiftType[]).map(type => (
                                <button
                                    key={type}
                                    className={`shift-type-option ${selectedType === type ? 'selected' : ''}`}
                                    onClick={() => setSelectedType(type)}
                                >
                                    <div className={`shift-header-badge ${type.toLowerCase()}`}>
                                        <span className="material-symbols-outlined material-symbols-fill">{SHIFT_ICONS[type]}</span>
                                    </div>
                                    <div className="shift-type-option-info">
                                        <div className="shift-type-option-name">{SHIFT_LABELS[type]}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                        <button className="shift-btn shift-btn-primary" style={{ width: '100%' }} onClick={handleStartShift} disabled={!selectedType || starting}>
                            <span className="material-symbols-outlined">play_arrow</span>
                            {starting ? 'Đang tạo ca...' : 'Bắt đầu ca'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── RENDER: Active Shift — 3-Column Desktop Layout ──
    return (
        <div className="shift-page">
            {/* Header */}
            <div className="shift-header">
                <div className="shift-header-info">
                    <div className={`shift-header-badge ${shift.shift_type.toLowerCase()}`}>
                        <span className="material-symbols-outlined material-symbols-fill">{SHIFT_ICONS[shift.shift_type]}</span>
                    </div>
                    <div>
                        <div className="shift-header-title">{SHIFT_LABELS[shift.shift_type]}</div>
                        <div className="shift-header-meta">
                            {shift.store?.name || user.store} • {new Date(shift.shift_date).toLocaleDateString('vi-VN')} • {user.name}
                            {isCompleted && <span style={{ color: '#10b981', fontWeight: 700, marginLeft: 8 }}>✓ Đã kết ca</span>}
                        </div>
                    </div>
                    <div style={{ marginLeft: 'auto' }}>
                        {autoSaveStatus !== 'idle' && (
                            <div className={`autosave-indicator ${autoSaveStatus}`}>
                                <div className="autosave-dot" />
                                {autoSaveStatus === 'saving' && 'Đang lưu...'}
                                {autoSaveStatus === 'saved' && 'Đã lưu'}
                                {autoSaveStatus === 'error' && 'Lỗi lưu'}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ═══ 3-Column Layout: Công việc | Kết tiền | Kiểm tồn + Vật tư ═══ */}
            <div className="shift-3col">
                {/* ── CỘT 1: Công Việc & Checklist ── */}
                <div className="shift-col">
                    <h3 className="shift-col-title">
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>checklist</span>
                        Công Việc Trong Ca
                        <span className="shift-col-badge">{checkProgress.completed}/{checkProgress.total}</span>
                    </h3>

                    {/* Progress */}
                    <div className="shift-progress">
                        <div className="shift-progress-bar-wrapper">
                            <div className="shift-progress-bar" style={{ width: `${checkProgress.pct}%`, background: checkProgress.pct === 100 ? '#10b981' : undefined }} />
                        </div>
                        <span className="shift-progress-text">{checkProgress.pct}%</span>
                    </div>

                    {/* FIX: "Lưu ý" shown as notice, NOT as checklist */}
                    {noteItems.length > 0 && (
                        <div className="shift-notice">
                            <div className="shift-notice-header">
                                <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#f59e0b' }}>warning</span>
                                <span>Lưu Ý Quan Trọng</span>
                            </div>
                            {noteItems.map(note => (
                                <div key={note.id} className="shift-notice-item">• {note.title}</div>
                            ))}
                        </div>
                    )}

                    {/* Checklist groups */}
                    {Object.entries(groupedChecklist()).map(([category, items]) => (
                        <div key={category} className="checklist-category">
                            <div className="checklist-category-header">
                                <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#9ca3af' }}>
                                    {CHECKLIST_ICONS[category as keyof typeof CHECKLIST_ICONS] || 'list'}
                                </span>
                                <span className="checklist-category-label">
                                    {CHECKLIST_LABELS[category as keyof typeof CHECKLIST_LABELS] || category}
                                </span>
                                <span className="checklist-category-count">{items.filter(i => i.is_completed).length}/{items.length}</span>
                            </div>
                            {items.map(response => (
                                <div
                                    key={response.id}
                                    className={`checklist-item ${response.is_completed ? 'completed' : ''}`}
                                    onClick={() => handleToggleChecklist(response)}
                                >
                                    <div className={`checklist-checkbox ${response.is_completed ? 'checked' : ''}`}>
                                        {response.is_completed && <span className="material-symbols-outlined">check</span>}
                                    </div>
                                    <span className="checklist-text">{response.template?.title || ''}</span>
                                </div>
                            ))}
                        </div>
                    ))}

                    {/* Quick Reports */}
                    <div className="shift-section" style={{ marginTop: 12 }}>
                        <div className="shift-section-header">
                            <div className="shift-section-header-left">
                                <div className="shift-section-icon warning">
                                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>bolt</span>
                                </div>
                                <div className="shift-section-title">Báo Cáo Nhanh Đầu Ca</div>
                            </div>
                        </div>
                        <div className="shift-section-body">
                            {['Trứng gà', 'Gạo', 'Bánh mì tươi', 'Covang', 'Biwase 20L', 'Thức ăn nhanh'].map(name => {
                                const report = quickReports.find(r => r.item_name === name);
                                return (
                                    <div key={name} className="quick-report-item">
                                        <span className="quick-report-name">{name}</span>
                                        <input
                                            type="number"
                                            className="quick-report-qty"
                                            value={report?.quantity || ''}
                                            onChange={async e => {
                                                const qty = parseFloat(e.target.value) || 0;
                                                if (!shift) return;
                                                try {
                                                    const saved = await QuickReportService.upsert({
                                                        ...(report || {}),
                                                        shift_id: shift.id, item_name: name, quantity: qty, checked_by: user.id,
                                                    });
                                                    setQuickReports(prev => {
                                                        const idx = prev.findIndex(r => r.item_name === name);
                                                        if (idx >= 0) { const arr = [...prev]; arr[idx] = saved; return arr; }
                                                        return [...prev, saved];
                                                    });
                                                } catch (err) { console.error(err); }
                                            }}
                                            placeholder="0" inputMode="numeric" disabled={isCompleted}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* ── CỘT 2: Kết Tiền Mặt ── */}
                <div className="shift-col">
                    <h3 className="shift-col-title">
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>payments</span>
                        Quản Lý Tiền Két
                    </h3>

                    {/* Denomination Counter */}
                    <div className="shift-section">
                        <div className="shift-section-header">
                            <div className="shift-section-header-left">
                                <div className="shift-section-icon warning">
                                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>account_balance_wallet</span>
                                </div>
                                <div className="shift-section-title">Kiểm Két Theo Mệnh Giá</div>
                            </div>
                            <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#f59e0b' }}>{formatCurrency(getDenomTotal())}</div>
                        </div>
                        <div className="shift-section-body">
                            <div className="cash-grid">
                                {DENOMINATION_VALUES.map(denom => {
                                    const key = `denom_${denom}`;
                                    const qty = (cash as any)[key] || 0;
                                    return (
                                        <div key={denom} className="cash-denom-item">
                                            <span className="cash-denom-label">{formatCurrency(denom)}</span>
                                            <input type="number" className="cash-denom-input" value={qty || ''} onChange={e => handleCashChange(key, parseInt(e.target.value) || 0)} placeholder="0" min="0" inputMode="numeric" disabled={isCompleted} />
                                            <span className="cash-denom-total">= {formatCurrency(qty * denom)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Revenue Report — FIX: per-item notes */}
                    <div className="shift-section">
                        <div className="shift-section-header">
                            <div className="shift-section-header-left">
                                <div className="shift-section-icon info">
                                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>receipt_long</span>
                                </div>
                                <div className="shift-section-title">Doanh Thu & Chi Phí Trong Ca</div>
                            </div>
                        </div>
                        <div className="shift-section-body">
                            {CASH_REVENUE_FIELDS.map(item => (
                                <div key={item.key} className="revenue-row">
                                    <div className="revenue-row-main">
                                        <span className="revenue-label">{item.label}</span>
                                        <input type="number" className="revenue-input" value={(cash as any)[item.key] || ''} onChange={e => handleCashChange(item.key, parseFloat(e.target.value) || 0)} placeholder="0" inputMode="numeric" disabled={isCompleted} />
                                    </div>
                                    {/* FIX: Per-item note */}
                                    <input
                                        type="text"
                                        className="revenue-note"
                                        value={(cash.item_notes as any)?.[item.key] || ''}
                                        onChange={e => handleCashNoteChange(item.key, e.target.value)}
                                        placeholder="Ghi chú..."
                                        disabled={isCompleted}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Payment Methods */}
                    <div className="shift-section">
                        <div className="shift-section-header">
                            <div className="shift-section-header-left">
                                <div className="shift-section-icon purple">
                                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>credit_card</span>
                                </div>
                                <div className="shift-section-title">Thanh Toán Không Tiền Mặt</div>
                            </div>
                        </div>
                        <div className="shift-section-body">
                            {CASH_PAYMENT_FIELDS.map(item => (
                                <div key={item.key} className="revenue-row">
                                    <div className="revenue-row-main">
                                        <span className="revenue-label">{item.label}</span>
                                        <input type="number" className="revenue-input" value={(cash as any)[item.key] || ''} onChange={e => handleCashChange(item.key, parseFloat(e.target.value) || 0)} placeholder="0" inputMode="numeric" disabled={isCompleted} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Cash Summary */}
                    <div className="cash-summary">
                        <div className="cash-summary-row"><span className="cash-summary-label">Tổng kiểm két thực tế</span><span className="cash-summary-value">{formatCurrency(getDenomTotal())}</span></div>
                        <div className="cash-summary-row"><span className="cash-summary-label">Tiền két cuối ca dự kiến</span><span className="cash-summary-value">{formatCurrency(getCashExpected())}</span></div>
                        <div className="cash-summary-row total">
                            <span className="cash-summary-label">Chênh lệch</span>
                            <span className={`cash-summary-value ${getCashDiff() > 0 ? 'positive' : getCashDiff() < 0 ? 'negative' : ''}`}>
                                {getCashDiff() > 0 && '+'}{formatCurrency(getCashDiff())}
                            </span>
                        </div>
                    </div>

                    {/* Difference alert & reason */}
                    {getCashDiff() !== 0 && (
                        <>
                            <div className={`diff-alert ${Math.abs(getCashDiff()) > 50000 ? 'danger' : 'warning'}`}>
                                <span className="material-symbols-outlined diff-alert-icon">{Math.abs(getCashDiff()) > 50000 ? 'error' : 'warning'}</span>
                                <span className="diff-alert-text">Chênh lệch {getCashDiff() > 0 ? '+' : ''}{formatCurrency(getCashDiff())}</span>
                            </div>
                            <div style={{ marginTop: 8 }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#dc2626', display: 'block', marginBottom: 4 }}>Lý do chênh lệch *</label>
                                <textarea
                                    className="revenue-input"
                                    style={{ width: '100%', minHeight: 48, resize: 'vertical' }}
                                    value={cash.difference_reason || ''}
                                    onChange={e => {
                                        setCash(prev => ({ ...prev, difference_reason: e.target.value }));
                                        debouncedSave({ difference_reason: e.target.value });
                                    }}
                                    placeholder="Nhập lý do chênh lệch..."
                                    disabled={isCompleted}
                                />
                            </div>
                        </>
                    )}
                    {getCashDiff() === 0 && getDenomTotal() > 0 && (
                        <div className="diff-alert ok">
                            <span className="material-symbols-outlined diff-alert-icon">check_circle</span>
                            <span className="diff-alert-text">Khớp! Không có chênh lệch</span>
                        </div>
                    )}
                </div>

                {/* ── CỘT 3: Kiểm Tồn Giao Ca + Vật Tư ── */}
                <div className="shift-col">
                    <h3 className="shift-col-title">
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>swap_horiz</span>
                        Kiểm Tồn & Vật Tư Giao Ca
                    </h3>

                    {/* Handover — FIX: Fixed product list from admin templates */}
                    <div className="shift-section">
                        <div className="shift-section-header">
                            <div className="shift-section-header-left">
                                <div className="shift-section-icon info">
                                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>inventory_2</span>
                                </div>
                                <div>
                                    <div className="shift-section-title">Hàng Tồn Giao Ca</div>
                                    <div className="shift-section-subtitle">{handoverItems.length} sản phẩm kiểm tồn</div>
                                </div>
                            </div>
                        </div>
                        <div className="shift-section-body" style={{ padding: 0 }}>
                            <div style={{ overflowX: 'auto' }}>
                                <table className="asset-table">
                                    <thead>
                                        <tr>
                                            <th>STT</th>
                                            <th>Sản phẩm</th>
                                            <th>Barcode</th>
                                            <th style={{ textAlign: 'center' }}>Kiot</th>
                                            <th style={{ textAlign: 'center' }}>Thực</th>
                                            <th style={{ textAlign: 'center' }}>CL</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {handoverItems.map((item, idx) => {
                                            const diff = (item.actual_qty || 0) - (item.system_qty || 0);
                                            return (
                                                <tr key={item.id}>
                                                    <td>{idx + 1}</td>
                                                    <td style={{ fontWeight: 600, fontSize: '0.75rem', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product_name}</td>
                                                    <td style={{ fontSize: '0.6875rem', color: '#9ca3af', fontFamily: 'monospace' }}>{item.barcode || '—'}</td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <input type="number" className="asset-qty-input" value={item.system_qty || ''} onChange={e => handleHandoverUpdate(item, 'system_qty', parseFloat(e.target.value) || 0)} inputMode="numeric" disabled={isCompleted} />
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <input type="number" className="asset-qty-input" value={item.actual_qty || ''} onChange={e => handleHandoverUpdate(item, 'actual_qty', parseFloat(e.target.value) || 0)} inputMode="numeric" disabled={isCompleted} />
                                                    </td>
                                                    <td style={{ textAlign: 'center', fontWeight: 700, color: diff > 0 ? '#10b981' : diff < 0 ? '#ef4444' : '#6b7280', fontSize: '0.8125rem' }}>
                                                        {diff !== 0 ? (diff > 0 ? '+' : '') + diff : '—'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Asset Check */}
                    <div className="shift-section">
                        <div className="shift-section-header">
                            <div className="shift-section-header-left">
                                <div className="shift-section-icon success">
                                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>handyman</span>
                                </div>
                                <div>
                                    <div className="shift-section-title">Vật Tư & Thiết Bị</div>
                                    <div className="shift-section-subtitle">{assets.length} vật tư</div>
                                </div>
                            </div>
                        </div>
                        <div className="shift-section-body" style={{ padding: 0 }}>
                            <div style={{ overflowX: 'auto' }}>
                                <table className="asset-table">
                                    <thead>
                                        <tr>
                                            <th>STT</th>
                                            <th>Vật tư</th>
                                            <th>Giá trị</th>
                                            <th style={{ textAlign: 'center' }}>Chuẩn</th>
                                            <th style={{ textAlign: 'center' }}>Thực</th>
                                            <th style={{ textAlign: 'center' }}>Hư</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {assets.map((asset, idx) => {
                                            const check = assetChecks.find(c => c.asset_id === asset.id);
                                            return (
                                                <tr key={asset.id}>
                                                    <td>{idx + 1}</td>
                                                    <td style={{ fontWeight: 600, fontSize: '0.75rem' }}>{asset.name}</td>
                                                    <td style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>{formatCurrency(asset.unit_value || 0)}</td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <input type="number" className="asset-qty-input" value={check?.ok_count ?? asset.expected_ok} onChange={e => handleAssetCheck(asset.id, parseInt(e.target.value) || 0, check?.damaged_count || 0)} min="0" inputMode="numeric" disabled={isCompleted} />
                                                    </td>
                                                    <td style={{ textAlign: 'center', fontWeight: 700 }}>
                                                        {check?.ok_count ?? asset.expected_ok}
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <input type="number" className="asset-qty-input" style={{ borderColor: (check?.damaged_count || 0) > 0 ? '#ef4444' : undefined, color: (check?.damaged_count || 0) > 0 ? '#ef4444' : undefined }} value={check?.damaged_count || ''} onChange={e => handleAssetCheck(asset.id, check?.ok_count ?? asset.expected_ok, parseInt(e.target.value) || 0)} min="0" inputMode="numeric" placeholder="0" disabled={isCompleted} />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Action Bar */}
            {!isCompleted && (
                <div className="shift-bottom-bar">
                    <button className="shift-btn shift-btn-danger" onClick={handleEndShift} disabled={ending}>
                        <span className="material-symbols-outlined">stop_circle</span>
                        {ending ? 'Đang kết ca...' : 'Kết Ca & Gửi Báo Cáo'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default ShiftPage;
