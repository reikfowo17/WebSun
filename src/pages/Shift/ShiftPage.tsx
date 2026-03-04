import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
import { useToast } from '../../contexts';
import { supabase } from '../../lib/supabase';
import SubSidebar, { SubSidebarGroup } from '../../components/SubSidebar';
import '../../styles/hq-sidebar.css';

// ─── Helpers ───
const getTodayDOW = (): DayOfWeek => {
    const d = new Date().getDay();
    return (d === 0 ? 1 : d + 1) as DayOfWeek;
};

interface ShiftPageProps { user: User; }

type ShiftTab = 'tasks' | 'cash' | 'handover' | 'assets';

const TAB_LABELS: Record<ShiftTab, string> = {
    tasks: 'Nhiệm Vụ',
    cash: 'Kiểm Két',
    handover: 'Giao Ca',
    assets: 'Vật Tư',
};

const ShiftPage: React.FC<ShiftPageProps> = ({ user }) => {
    const toast = useToast();
    const [shift, setShift] = useState<Shift | null>(null);
    const [selectedType, setSelectedType] = useState<ShiftType | null>(null);
    const [loading, setLoading] = useState(true);
    const [starting, setStarting] = useState(false);
    const [ending, setEnding] = useState(false);
    const [storeId, setStoreId] = useState<string>('');
    const [activeTab, setActiveTab] = useState<ShiftTab>('cash');

    // Topbar portal
    const [topbarNode, setTopbarNode] = useState<HTMLElement | null>(null);

    // Cash
    const [cash, setCash] = useState<Partial<CashSettlement>>({ item_notes: {} });
    const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const autoSaveRef = useRef<NodeJS.Timeout | null>(null);

    // Checklist
    const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
    const [responses, setResponses] = useState<ChecklistResponse[]>([]);

    // Assets
    const [assets, setAssets] = useState<ShiftAsset[]>([]);
    const [assetChecks, setAssetChecks] = useState<ShiftAssetCheck[]>([]);

    // Handover
    const [handoverItems, setHandoverItems] = useState<ShiftInventoryHandover[]>([]);

    // Quick Reports
    const [quickReports, setQuickReports] = useState<ShiftQuickReport[]>([]);

    const isCompleted = shift?.status === 'COMPLETED' || shift?.status === 'LOCKED';

    // ── Topbar portal ──
    useEffect(() => {
        setTopbarNode(document.getElementById('topbar-left'));
        const titleFallback = document.getElementById('topbar-fallback-title');
        if (titleFallback) titleFallback.style.display = 'none';
        return () => {
            if (titleFallback) titleFallback.style.display = 'flex';
        };
    }, []);

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

    // ── Auto-detect shift ──
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
            const tmpl = await ChecklistService.getTemplates(storeId, selectedType, dayOfWeek);
            setTemplates(tmpl);
            const resp = await ChecklistService.initResponses(newShift.id, tmpl);
            setResponses(resp);
            const assetList = await AssetService.getAssets(storeId);
            setAssets(assetList);
            const checks = await AssetService.initChecks(newShift.id, assetList, user.id);
            setAssetChecks(checks);
            const productTemplates = await HandoverService.getProductTemplates(storeId);
            const handover = await HandoverService.initFromTemplates(newShift.id, productTemplates, user.id);
            setHandoverItems(handover);
            await CashService.upsert(newShift.id, { status: 'DRAFT', item_notes: {} });
            toast.success('Đã bắt đầu ca thành công!');
        } catch (err: unknown) {
            console.error('[ShiftPage] Start error:', err);
            toast.error(err instanceof Error ? err.message : 'Không thể bắt đầu ca');
        } finally {
            setStarting(false);
        }
    };

    // ── End Shift ──
    const handleEndShift = async () => {
        if (!shift || ending) return;
        const denomTotal = getDenomTotal();
        if (denomTotal === 0) {
            toast.error('Vui lòng kiểm két theo mệnh giá trước khi kết ca');
            setActiveTab('cash');
            return;
        }
        const diff = getCashDiff();
        if (diff !== 0 && !cash.difference_reason?.trim()) {
            toast.error('Có chênh lệch két — vui lòng nhập lý do trước khi kết ca');
            setActiveTab('cash');
            return;
        }
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
            toast.success('Đã kết ca và gửi báo cáo két thành công!');
        } catch (err: unknown) {
            console.error('[ShiftPage] End error:', err);
            toast.error(err instanceof Error ? err.message : 'Không thể kết thúc ca');
        } finally {
            setEnding(false);
        }
    };

    // ── Cash handlers ──
    const handleCashChange = (field: string, value: number) => {
        setCash(prev => ({ ...prev, [field]: value }));
        debouncedSave({ [field]: value });
    };

    const handleCashNoteChange = (field: string, note: string) => {
        const newNotes = { ...(cash.item_notes || {}), [field]: note };
        setCash(prev => ({ ...prev, item_notes: newNotes }));
        debouncedSave({ item_notes: newNotes });
    };

    const debouncedSave = (updates: Partial<CashSettlement>) => {
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

    // ── Checklist handlers ──
    const handleToggleChecklist = async (response: ChecklistResponse) => {
        if (!shift || isCompleted) return;
        try {
            const updated = await ChecklistService.toggleItem(response.id, !response.is_completed, user.id);
            setResponses(prev => prev.map(r => r.id === updated.id ? updated : r));
        } catch (err) { console.error('[ShiftPage] Toggle error:', err); }
    };

    // ── Asset handlers ──
    const handleAssetCheck = async (assetId: string, okCount: number, damagedCount: number) => {
        if (!shift) return;
        try {
            const updated = await AssetService.upsertCheck(shift.id, assetId, okCount, damagedCount, user.id);
            setAssetChecks(prev => {
                const idx = prev.findIndex(c => c.asset_id === assetId);
                if (idx >= 0) { const arr = [...prev]; arr[idx] = updated; return arr; }
                return [...prev, updated];
            });
        } catch (err) { console.error('[ShiftPage] Asset check error:', err); }
    };

    // ── Handover handler ──
    const handleHandoverUpdate = async (item: ShiftInventoryHandover, field: 'system_qty' | 'actual_qty', value: number) => {
        try {
            const updated = await HandoverService.updateItem(item.id, { [field]: value });
            setHandoverItems(prev => prev.map(h => h.id === updated.id ? updated : h));
        } catch (err) { console.error('[ShiftPage] Handover error:', err); }
    };

    // ── Computed ──
    const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ';

    const getDenomTotal = () => {
        let total = 0;
        for (const d of DENOMINATION_VALUES) {
            total += ((cash as unknown as Record<string, number>)[`denom_${d}`] || 0) * d;
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

    const noteItems = templates.filter(t => t.category === 'NOTE');
    const checkProgress = useMemo(() => {
        const total = responses.length;
        const completed = responses.filter(r => r.is_completed).length;
        return { total, completed, pct: total > 0 ? Math.round((completed / total) * 100) : 0 };
    }, [responses]);

    const groupedChecklist = useMemo(() => {
        const groups: Record<string, ChecklistResponse[]> = {};
        for (const r of responses) {
            const cat = r.template?.category || 'START_SHIFT';
            if (cat === 'NOTE') continue;
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(r);
        }
        return groups;
    }, [responses]);

    // Sidebar: Kiểm Két FIRST (primary action for employees)
    const sidebarGroups: SubSidebarGroup[] = [
        {
            label: 'KẾT TOÁN',
            items: [
                { id: 'cash', label: 'Kiểm Két', badge: getDenomTotal() > 0 ? fmt(getDenomTotal()) : undefined, badgeColor: 'amber' },
            ],
        },
        {
            label: 'CÔNG VIỆC',
            items: [
                { id: 'tasks', label: 'Nhiệm Vụ', badge: `${checkProgress.completed}/${checkProgress.total}`, badgeColor: checkProgress.pct === 100 ? 'emerald' : 'amber' },
            ],
        },
        {
            label: 'GIAO NHẬN',
            items: [
                { id: 'handover', label: 'Giao Ca', badge: handoverItems.length > 0 ? handoverItems.length : undefined, badgeColor: 'muted' },
                { id: 'assets', label: 'Vật Tư', badge: assets.length > 0 ? assets.length : undefined, badgeColor: 'muted' },
            ],
        },
    ];

    const shiftInfoFooter = shift ? (
        <div className="sp-sidebar-shift-info">
            <div className={`sp-sidebar-badge ${shift.shift_type.toLowerCase()}`}>
                <span className="material-symbols-outlined material-symbols-fill" style={{ fontSize: 18 }}>{SHIFT_ICONS[shift.shift_type]}</span>
            </div>
            <div className="sp-sidebar-shift-detail">
                <div className="sp-sidebar-shift-name">{SHIFT_LABELS[shift.shift_type]}</div>
                <div className="sp-sidebar-shift-meta">{shift.store?.name || ''}</div>
                <div className="sp-sidebar-shift-meta">{new Date(shift.shift_date).toLocaleDateString('vi-VN')} • {user.name}</div>
            </div>
            {isCompleted && <div className="sp-sidebar-completed">✓ Đã kết ca</div>}
        </div>
    ) : null;

    // ═══ LOADING ═══
    if (loading) {
        return (
            <div className="hq-page">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}>
                    <div style={{ width: 48, height: 48, border: '4px solid #f59e0b', borderTopColor: 'transparent', borderRadius: 999, animation: 'spin 1s linear infinite' }} />
                    <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>Đang tải thông tin ca...</p>
                </div>
            </div>
        );
    }

    // ═══ START SHIFT ═══
    if (!shift) {
        return (
            <div className="hq-page">
                {topbarNode && createPortal(
                    <div className="hq-breadcrumb">
                        <span className="material-symbols-outlined hq-breadcrumb-icon">store</span>
                        <span className="hq-breadcrumb-title">Bàn Giao Ca</span>
                    </div>,
                    topbarNode
                )}
                <div className="sp-start-container">
                    <div className="sp-start-card">
                        <div className="sp-start-icon">
                            <span className="material-symbols-outlined material-symbols-fill">store</span>
                        </div>
                        <h2 className="sp-start-title">Bắt đầu Ca Làm Việc</h2>
                        <p className="sp-start-desc">Chọn ca để bắt đầu nhập liệu và báo cáo</p>
                        <div className="sp-type-list">
                            {(['MORNING', 'AFTERNOON', 'EVENING'] as ShiftType[]).map(type => (
                                <button
                                    key={type}
                                    className={`sp-type-btn ${selectedType === type ? 'active' : ''}`}
                                    onClick={() => setSelectedType(type)}
                                >
                                    <div className={`sp-type-icon ${type.toLowerCase()}`}>
                                        <span className="material-symbols-outlined material-symbols-fill">{SHIFT_ICONS[type]}</span>
                                    </div>
                                    <span className="sp-type-label">{SHIFT_LABELS[type]}</span>
                                </button>
                            ))}
                        </div>
                        <button className="sp-start-btn" onClick={handleStartShift} disabled={!selectedType || starting}>
                            <span className="material-symbols-outlined">play_arrow</span>
                            {starting ? 'Đang tạo ca...' : 'Bắt đầu ca'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ═══ ACTIVE SHIFT — SubSidebar Layout ═══
    return (
        <div className="hq-page">
            {/* Breadcrumb in topbar */}
            {topbarNode && createPortal(
                <div className="hq-breadcrumb">
                    <span className="material-symbols-outlined hq-breadcrumb-icon">store</span>
                    <span className="hq-breadcrumb-title">Bàn Giao Ca</span>
                    <span className="material-symbols-outlined hq-breadcrumb-sep">chevron_right</span>
                    <span className="hq-breadcrumb-current">{TAB_LABELS[activeTab]}</span>
                    {autoSaveStatus !== 'idle' && (
                        <span className={`sp-autosave ${autoSaveStatus}`} style={{ marginLeft: 12 }}>
                            <span className="sp-autosave-dot" />
                            {autoSaveStatus === 'saving' && 'Lưu...'}
                            {autoSaveStatus === 'saved' && 'Đã lưu'}
                            {autoSaveStatus === 'error' && 'Lỗi'}
                        </span>
                    )}
                </div>,
                topbarNode
            )}

            <div className="hq-layout">
                {/* SubSidebar */}
                <SubSidebar
                    title="Bàn Giao Ca"
                    groups={sidebarGroups}
                    activeId={activeTab}
                    onSelect={(id) => setActiveTab(id as ShiftTab)}
                    footer={shiftInfoFooter}
                />

                {/* Main Content */}
                <div className="hq-content" key={activeTab}>
                    <div className="hq-section-animate">
                        {activeTab === 'tasks' && (
                            <TasksTab
                                checkProgress={checkProgress}
                                noteItems={noteItems}
                                groupedChecklist={groupedChecklist}
                                onToggle={handleToggleChecklist}
                                quickReports={quickReports}
                                shift={shift}
                                user={user}
                                isCompleted={isCompleted}
                                setQuickReports={setQuickReports}
                            />
                        )}
                        {activeTab === 'cash' && (
                            <CashTab
                                cash={cash}
                                isCompleted={isCompleted}
                                onCashChange={handleCashChange}
                                onNoteChange={handleCashNoteChange}
                                setCash={setCash}
                                debouncedSave={debouncedSave}
                                fmt={fmt}
                                getDenomTotal={getDenomTotal}
                                getCashExpected={getCashExpected}
                                getCashDiff={getCashDiff}
                            />
                        )}
                        {activeTab === 'handover' && (
                            <HandoverTab items={handoverItems} isCompleted={isCompleted} onUpdate={handleHandoverUpdate} fmt={fmt} />
                        )}
                        {activeTab === 'assets' && (
                            <AssetsTab assets={assets} assetChecks={assetChecks} isCompleted={isCompleted} onCheck={handleAssetCheck} fmt={fmt} />
                        )}
                    </div>

                    {/* End-shift bar (inside content, not floating) */}
                    {!isCompleted && (
                        <div className="sp-endbar">
                            <div className="sp-endbar-info">
                                <span style={{ color: checkProgress.pct === 100 ? '#10b981' : '#f59e0b', fontWeight: 700 }}>
                                    {checkProgress.pct}% nhiệm vụ
                                </span>
                                <span style={{ color: '#d1d5db' }}>•</span>
                                <span style={{ color: '#6b7280' }}>Két: {fmt(getDenomTotal())}</span>
                            </div>
                            <button className="sp-end-btn" onClick={handleEndShift} disabled={ending}>
                                <span className="material-symbols-outlined">stop_circle</span>
                                {ending ? 'Đang kết ca...' : 'Kết Ca & Gửi Báo Cáo'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

interface TasksTabProps {
    checkProgress: { total: number; completed: number; pct: number };
    noteItems: ChecklistTemplate[];
    groupedChecklist: Record<string, ChecklistResponse[]>;
    onToggle: (r: ChecklistResponse) => void;
    quickReports: ShiftQuickReport[];
    shift: Shift;
    user: User;
    isCompleted: boolean;
    setQuickReports: React.Dispatch<React.SetStateAction<ShiftQuickReport[]>>;
}

const TasksTab: React.FC<TasksTabProps> = ({
    checkProgress, noteItems, groupedChecklist, onToggle,
    quickReports, shift, user, isCompleted, setQuickReports,
}) => (
    <div className="sp-tab-body">
        {/* 2-column layout: Left = overview, Right = checklist */}
        <div className="sp-tasks-layout">
            {/* LEFT — Summary + Quick reports */}
            <div className="sp-tasks-left">
                {/* Progress */}
                <div className="sp-card">
                    <div className="sp-card-title">
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: checkProgress.pct === 100 ? '#10b981' : '#f59e0b' }}>task_alt</span>
                        Tiến Độ Công Việc
                    </div>
                    <div className="sp-progress-visual">
                        <div className="sp-progress-ring">
                            <svg viewBox="0 0 80 80" width="80" height="80">
                                <circle cx="40" cy="40" r="34" fill="none" stroke="#f3f4f6" strokeWidth="6" />
                                <circle cx="40" cy="40" r="34" fill="none"
                                    stroke={checkProgress.pct === 100 ? '#10b981' : '#f59e0b'}
                                    strokeWidth="6" strokeLinecap="round"
                                    strokeDasharray={`${(checkProgress.pct / 100) * 213.6} 213.6`}
                                    transform="rotate(-90 40 40)" style={{ transition: 'stroke-dasharray 0.4s ease' }}
                                />
                            </svg>
                            <span className="sp-progress-pct">{checkProgress.pct}%</span>
                        </div>
                        <div className="sp-progress-detail">
                            <span className="sp-progress-count">{checkProgress.completed}/{checkProgress.total}</span>
                            <span className="sp-progress-label">công việc hoàn thành</span>
                        </div>
                    </div>
                </div>

                {/* Notes */}
                {noteItems.length > 0 && (
                    <div className="sp-notice">
                        <div className="sp-notice-header">
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>warning</span>
                            Lưu Ý Quan Trọng
                        </div>
                        {noteItems.map(note => (
                            <div key={note.id} className="sp-notice-item">• {note.title}</div>
                        ))}
                    </div>
                )}

                {/* Quick Reports */}
                <div className="sp-card">
                    <div className="sp-card-title">
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#f59e0b' }}>bolt</span>
                        Báo Cáo Nhanh Đầu Ca
                    </div>
                    <div className="sp-quick-grid">
                        {['Trứng gà', 'Gạo', 'Bánh mì tươi', 'Covang', 'Biwase 20L', 'Thức ăn nhanh'].map(name => {
                            const report = quickReports.find(r => r.item_name === name);
                            return (
                                <div key={name} className="sp-quick-item">
                                    <span className="sp-quick-name">{name}</span>
                                    <input
                                        type="number" className="sp-quick-input" value={report?.quantity || ''}
                                        onChange={async e => {
                                            const qty = parseFloat(e.target.value) || 0;
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

            {/* RIGHT — Checklist groups */}
            <div className="sp-tasks-right">
                {Object.keys(groupedChecklist).length === 0 ? (
                    <div className="sp-card sp-empty-state">
                        <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#d1d5db' }}>checklist</span>
                        <p className="sp-empty-title">Không có nhiệm vụ</p>
                        <p className="sp-empty-desc">Chưa có checklist được cấu hình cho ca này</p>
                    </div>
                ) : (
                    Object.entries(groupedChecklist).map(([category, items]) => (
                        <div key={category} className="sp-card" style={{ padding: 0, overflow: 'hidden' }}>
                            <div className="sp-group-header">
                                <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#9ca3af' }}>
                                    {CHECKLIST_ICONS[category as keyof typeof CHECKLIST_ICONS] || 'list'}
                                </span>
                                <span className="sp-group-label">{CHECKLIST_LABELS[category as keyof typeof CHECKLIST_LABELS] || category}</span>
                                <span className="sp-group-count">{items.filter(i => i.is_completed).length}/{items.length}</span>
                            </div>
                            {items.map(response => (
                                <div key={response.id} className={`sp-check-item ${response.is_completed ? 'done' : ''}`} onClick={() => onToggle(response)}>
                                    <div className={`sp-checkbox ${response.is_completed ? 'checked' : ''}`}>
                                        {response.is_completed && <span className="material-symbols-outlined">check</span>}
                                    </div>
                                    <span className="sp-check-text">{response.template?.title || ''}</span>
                                </div>
                            ))}
                        </div>
                    ))
                )}
            </div>
        </div>
    </div>
);

interface CashTabProps {
    cash: Partial<CashSettlement>;
    isCompleted: boolean;
    onCashChange: (field: string, value: number) => void;
    onNoteChange: (field: string, note: string) => void;
    setCash: React.Dispatch<React.SetStateAction<Partial<CashSettlement>>>;
    debouncedSave: (updates: Partial<CashSettlement>) => void;
    fmt: (n: number) => string;
    getDenomTotal: () => number;
    getCashExpected: () => number;
    getCashDiff: () => number;
}

const CashTab: React.FC<CashTabProps> = ({
    cash, isCompleted, onCashChange, onNoteChange, setCash, debouncedSave,
    fmt, getDenomTotal, getCashExpected, getCashDiff,
}) => {
    const [denomOpen, setDenomOpen] = useState(false);
    const diff = getCashDiff();
    const denomTotal = getDenomTotal();

    return (
        <div className="sp-tab-body">
            {/* ── 2-COLUMN: Report + Denomination side by side ── */}
            <div className="sp-cash-2col">
                {/* LEFT — Báo Cáo Kết Két */}
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
                                        onChange={e => onCashChange(item.key, parseFloat(e.target.value) || 0)}
                                        placeholder="0" inputMode="numeric" disabled={isCompleted}
                                    />
                                </div>
                                <input
                                    type="text" className="sp-cash-field-note"
                                    value={(cash.item_notes as Record<string, string>)?.[item.key] || ''}
                                    onChange={e => onNoteChange(item.key, e.target.value)}
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
                                    onChange={e => onCashChange(item.key, parseFloat(e.target.value) || 0)}
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
                                        onChange={e => onCashChange(key, parseInt(e.target.value) || 0)}
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

            {/* ── SUMMARY STRIP — full width below both columns ── */}
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
                            debouncedSave({ difference_reason: e.target.value });
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
                        onChange={e => onNoteChange('_shift_notes', e.target.value)}
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

interface HandoverTabProps {
    items: ShiftInventoryHandover[];
    isCompleted: boolean;
    onUpdate: (item: ShiftInventoryHandover, field: 'system_qty' | 'actual_qty', value: number) => void;
    fmt: (n: number) => string;
}

const HandoverTab: React.FC<HandoverTabProps> = ({ items, isCompleted, onUpdate }) => (
    <div className="sp-tab-body">
        <div className="sp-card">
            <div className="sp-card-head">
                <div className="sp-card-title">
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#8b5cf6' }}>inventory_2</span>
                    Hàng Tồn Giao Ca
                </div>
                <span className="sp-count-badge">{items.length} sản phẩm</span>
            </div>
            {items.length === 0 ? (
                <div className="sp-empty-state">
                    <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#d1d5db' }}>inventory_2</span>
                    <p className="sp-empty-title">Chưa có sản phẩm giao ca</p>
                    <p className="sp-empty-desc">Danh sách sẽ hiển thị khi có sản phẩm cần kiểm đếm khi giao ca</p>
                </div>
            ) : (
                <div className="sp-table-wrap">
                    <table className="sp-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Sản phẩm</th>
                                <th>Barcode</th>
                                <th style={{ textAlign: 'center' }}>Kiot</th>
                                <th style={{ textAlign: 'center' }}>Thực</th>
                                <th style={{ textAlign: 'center' }}>CL</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, idx) => {
                                const d = (item.actual_qty || 0) - (item.system_qty || 0);
                                return (
                                    <tr key={item.id}>
                                        <td>{idx + 1}</td>
                                        <td className="sp-td-product">{item.product_name}</td>
                                        <td className="sp-td-barcode">{item.barcode || '—'}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <input type="number" className="sp-td-input" value={item.system_qty || ''} onChange={e => onUpdate(item, 'system_qty', parseFloat(e.target.value) || 0)} inputMode="numeric" disabled={isCompleted} />
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <input type="number" className="sp-td-input" value={item.actual_qty || ''} onChange={e => onUpdate(item, 'actual_qty', parseFloat(e.target.value) || 0)} inputMode="numeric" disabled={isCompleted} />
                                        </td>
                                        <td style={{ textAlign: 'center', fontWeight: 700, color: d > 0 ? '#10b981' : d < 0 ? '#ef4444' : '#6b7280', fontSize: '0.8125rem' }}>
                                            {d !== 0 ? (d > 0 ? '+' : '') + d : '—'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    </div>
);

interface AssetsTabProps {
    assets: ShiftAsset[];
    assetChecks: ShiftAssetCheck[];
    isCompleted: boolean;
    onCheck: (assetId: string, ok: number, damaged: number) => void;
    fmt: (n: number) => string;
}

const AssetsTab: React.FC<AssetsTabProps> = ({ assets, assetChecks, isCompleted, onCheck, fmt }) => (
    <div className="sp-tab-body">
        <div className="sp-card">
            <div className="sp-card-head">
                <div className="sp-card-title">
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#10b981' }}>handyman</span>
                    Vật Tư & Thiết Bị
                </div>
                <span className="sp-count-badge">{assets.length} vật tư</span>
            </div>
            <div className="sp-table-wrap">
                <table className="sp-table">
                    <thead>
                        <tr>
                            <th>#</th>
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
                                    <td className="sp-td-product">{asset.name}</td>
                                    <td className="sp-td-barcode">{fmt(asset.unit_value || 0)}</td>
                                    <td style={{ textAlign: 'center' }}>
                                        <input type="number" className="sp-td-input" value={check?.ok_count ?? asset.expected_ok} onChange={e => onCheck(asset.id, parseInt(e.target.value) || 0, check?.damaged_count || 0)} min="0" inputMode="numeric" disabled={isCompleted} />
                                    </td>
                                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{check?.ok_count ?? asset.expected_ok}</td>
                                    <td style={{ textAlign: 'center' }}>
                                        <input type="number" className="sp-td-input"
                                            style={{ borderColor: (check?.damaged_count || 0) > 0 ? '#ef4444' : undefined, color: (check?.damaged_count || 0) > 0 ? '#ef4444' : undefined }}
                                            value={check?.damaged_count || ''} onChange={e => onCheck(asset.id, check?.ok_count ?? asset.expected_ok, parseInt(e.target.value) || 0)} min="0" inputMode="numeric" placeholder="0" disabled={isCompleted}
                                        />
                                    </td>
                                </tr>
                            );
                        })}
                        {assets.length === 0 && <tr><td colSpan={6} className="sp-table-empty">Chưa có vật tư</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
);

export default ShiftPage;
