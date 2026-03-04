import React, { createContext, useContext, useState, useCallback, useRef, useMemo, useEffect } from 'react';
import type { User } from '../../types';
import type {
    Shift, ShiftType, CashSettlement,
    ChecklistTemplate, ChecklistResponse,
    ShiftAsset, ShiftAssetCheck,
    ShiftInventoryHandover, ShiftQuickReport,
    DayOfWeek,
} from '../../types/shift';
import {
    ShiftService, CashService, ChecklistService,
    AssetService, HandoverService, QuickReportService,
    computeDenomTotal, computeCashExpected,
} from '../../services/shift';
import { useToast } from '../../contexts';
import { supabase } from '../../lib/supabase';

// ─── Helpers ───
const getTodayDOW = (): DayOfWeek => {
    const d = new Date().getDay();
    return (d === 0 ? 1 : d + 1) as DayOfWeek;
};

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ';

// ─── Context Types ───
interface ShiftContextType {
    // State
    user: User;
    shift: Shift | null;
    selectedType: ShiftType | null;
    setSelectedType: (t: ShiftType | null) => void;
    loading: boolean;
    starting: boolean;
    ending: boolean;
    storeId: string;
    activeTab: ShiftTab;
    setActiveTab: (t: ShiftTab) => void;
    isCompleted: boolean;

    // Cash
    cash: Partial<CashSettlement>;
    setCash: React.Dispatch<React.SetStateAction<Partial<CashSettlement>>>;
    autoSaveStatus: 'idle' | 'saving' | 'saved' | 'error';
    handleCashChange: (field: string, value: number) => void;
    handleCashNoteChange: (field: string, note: string) => void;
    getDenomTotal: () => number;
    getCashExpected: () => number;
    getCashDiff: () => number;

    // Checklist
    templates: ChecklistTemplate[];
    responses: ChecklistResponse[];
    checkProgress: { total: number; completed: number; pct: number };
    groupedChecklist: Record<string, ChecklistResponse[]>;
    noteItems: ChecklistTemplate[];
    handleToggleChecklist: (response: ChecklistResponse) => void;

    // Assets
    assets: ShiftAsset[];
    assetChecks: ShiftAssetCheck[];
    handleAssetCheck: (assetId: string, okCount: number, damagedCount: number) => void;

    // Handover
    handoverItems: ShiftInventoryHandover[];
    handleHandoverUpdate: (item: ShiftInventoryHandover, field: 'system_qty' | 'actual_qty', value: number) => void;

    // Quick Reports
    quickReports: ShiftQuickReport[];
    setQuickReports: React.Dispatch<React.SetStateAction<ShiftQuickReport[]>>;

    // Actions
    handleStartShift: () => Promise<void>;
    handleEndShift: () => Promise<void>;

    // Formatting
    fmt: (n: number) => string;
}

export type ShiftTab = 'tasks' | 'cash' | 'handover' | 'assets';

export const TAB_LABELS: Record<ShiftTab, string> = {
    tasks: 'Nhiệm Vụ',
    cash: 'Kiểm Két',
    handover: 'Giao Ca',
    assets: 'Vật Tư',
};

const ShiftCtx = createContext<ShiftContextType | null>(null);

export function useShiftContext() {
    const ctx = useContext(ShiftCtx);
    if (!ctx) throw new Error('useShiftContext must be used within ShiftProvider');
    return ctx;
}

// ─── Provider ───
export const ShiftProvider: React.FC<{ user: User; children: React.ReactNode }> = ({ user, children }) => {
    const toast = useToast();
    const [shift, setShift] = useState<Shift | null>(null);
    const [selectedType, setSelectedType] = useState<ShiftType | null>(null);
    const [loading, setLoading] = useState(true);
    const [starting, setStarting] = useState(false);
    const [ending, setEnding] = useState(false);
    const [storeId, setStoreId] = useState('');
    const [activeTab, setActiveTab] = useState<ShiftTab>('cash');

    // Cash
    const [cash, setCash] = useState<Partial<CashSettlement>>({ item_notes: {} });
    const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // FIX stale closure: keep latest cash in ref (react-best-practices: rerender-defer-reads)
    const cashRef = useRef(cash);
    cashRef.current = cash;
    const shiftRef = useRef(shift);
    shiftRef.current = shift;

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

    // ── Load shift data ──
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
                console.error('[ShiftContext] Load error:', err);
            } finally {
                setLoading(false);
            }
        };
        loadShift();
    }, [storeId, loadShiftData]);

    const handleStartShift = useCallback(async () => {
        if (!selectedType || !storeId || starting) return;
        setStarting(true);
        try {
            const newShift = await ShiftService.startShift(storeId, selectedType, user.id);
            setShift(newShift);

            const [prevCash, prevAssets, prevHandover] = await Promise.all([
                ShiftService.getPreviousShiftCash(newShift.id),
                ShiftService.getPreviousShiftAssets(newShift.id),
                ShiftService.getPreviousShiftHandover(newShift.id),
            ]);

            const dayOfWeek = getTodayDOW();
            const tmpl = await ChecklistService.getTemplates(storeId, selectedType, dayOfWeek);
            setTemplates(tmpl);
            const resp = await ChecklistService.initResponses(newShift.id, tmpl);
            setResponses(resp);

            const assetList = await AssetService.getAssets(storeId);
            setAssets(assetList);
            const checks = await AssetService.initChecks(newShift.id, assetList, user.id, prevAssets);
            setAssetChecks(checks);

            const productTemplates = await HandoverService.getProductTemplates(storeId);
            const handover = await HandoverService.initFromTemplates(newShift.id, productTemplates, user.id, prevHandover);
            setHandoverItems(handover);

            const cashStart = prevCash?.total_counted || 0;
            const cashData = await CashService.upsert(newShift.id, {
                status: 'DRAFT',
                item_notes: {},
                cash_start: cashStart,
            });
            setCash(cashData);

            toast.success(
                cashStart > 0
                    ? `Đã bắt đầu ca! Tiền kết đầu ca: ${fmt(cashStart)} (từ ca trước)`
                    : 'Đã bắt đầu ca thành công!'
            );
        } catch (err: unknown) {
            console.error('[ShiftContext] Start error:', err);
            toast.error(err instanceof Error ? err.message : 'Không thể bắt đầu ca');
        } finally {
            setStarting(false);
        }
    }, [selectedType, storeId, starting, user.id, toast]);

    const handleEndShift = useCallback(async () => {
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
            console.error('[ShiftContext] End error:', err);
            toast.error(err instanceof Error ? err.message : 'Không thể kết thúc ca');
        } finally {
            setEnding(false);
        }
    }, [shift, ending, cash, responses, user.id, toast]);

    const debouncedSave = useCallback((updates: Partial<CashSettlement>) => {
        if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
        setAutoSaveStatus('saving');
        autoSaveRef.current = setTimeout(async () => {
            const currentShift = shiftRef.current;
            if (!currentShift) return;
            try {
                const merged = { ...cashRef.current, ...updates };
                const updated = await CashService.upsert(currentShift.id, merged);
                setCash(updated);
                setAutoSaveStatus('saved');
                setTimeout(() => setAutoSaveStatus('idle'), 2000);
            } catch {
                setAutoSaveStatus('error');
            }
        }, 1000);
    }, []);

    const handleCashChange = useCallback((field: string, value: number) => {
        setCash(prev => ({ ...prev, [field]: value }));
        debouncedSave({ [field]: value });
    }, [debouncedSave]);

    const handleCashNoteChange = useCallback((field: string, note: string) => {
        setCash(prev => {
            const newNotes = { ...(prev.item_notes || {}), [field]: note };
            return { ...prev, item_notes: newNotes };
        });
        debouncedSave({});
    }, [debouncedSave]);

    const getDenomTotal = useCallback(() => computeDenomTotal(cashRef.current), []);
    const getCashExpected = useCallback(() => computeCashExpected(cashRef.current), []);
    const getCashDiff = useCallback(() => getDenomTotal() - getCashExpected(), [getDenomTotal, getCashExpected]);
    const handleToggleChecklist = useCallback(async (response: ChecklistResponse) => {
        if (!shift || isCompleted) return;
        try {
            const updated = await ChecklistService.toggleItem(response.id, !response.is_completed, user.id);
            setResponses(prev => prev.map(r => r.id === updated.id ? updated : r));
        } catch (err) { console.error('[ShiftContext] Toggle error:', err); }
    }, [shift, isCompleted, user.id]);

    const handleAssetCheck = useCallback(async (assetId: string, okCount: number, damagedCount: number) => {
        if (!shift) return;
        try {
            const updated = await AssetService.upsertCheck(shift.id, assetId, okCount, damagedCount, user.id);
            setAssetChecks(prev => {
                const idx = prev.findIndex(c => c.asset_id === assetId);
                if (idx >= 0) { const arr = [...prev]; arr[idx] = updated; return arr; }
                return [...prev, updated];
            });
        } catch (err) { console.error('[ShiftContext] Asset check error:', err); }
    }, [shift, user.id]);

    const handleHandoverUpdate = useCallback(async (item: ShiftInventoryHandover, field: 'system_qty' | 'actual_qty', value: number) => {
        try {
            const updated = await HandoverService.updateItem(item.id, { [field]: value });
            setHandoverItems(prev => prev.map(h => h.id === updated.id ? updated : h));
        } catch (err) { console.error('[ShiftContext] Handover error:', err); }
    }, []);

    const noteItems = useMemo(() => templates.filter(t => t.category === 'NOTE'), [templates]);

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

    const value = useMemo<ShiftContextType>(() => ({
        user, shift, selectedType, setSelectedType, loading, starting, ending,
        storeId, activeTab, setActiveTab, isCompleted,
        cash, setCash, autoSaveStatus, handleCashChange, handleCashNoteChange,
        getDenomTotal, getCashExpected, getCashDiff,
        templates, responses, checkProgress, groupedChecklist, noteItems, handleToggleChecklist,
        assets, assetChecks, handleAssetCheck,
        handoverItems, handleHandoverUpdate,
        quickReports, setQuickReports,
        handleStartShift, handleEndShift,
        fmt,
    }), [
        user, shift, selectedType, loading, starting, ending,
        storeId, activeTab, isCompleted,
        cash, autoSaveStatus, handleCashChange, handleCashNoteChange,
        getDenomTotal, getCashExpected, getCashDiff,
        templates, responses, checkProgress, groupedChecklist, noteItems, handleToggleChecklist,
        assets, assetChecks, handleAssetCheck,
        handoverItems, handleHandoverUpdate,
        quickReports,
        handleStartShift, handleEndShift,
    ]);

    return <ShiftCtx.Provider value={value}>{children}</ShiftCtx.Provider>;
};
