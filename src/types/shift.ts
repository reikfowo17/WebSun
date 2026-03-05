export type ShiftType = 'MORNING' | 'AFTERNOON' | 'EVENING';
export type ShiftStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'LOCKED';
export type ChecklistCategory = 'NOTE' | 'START_SHIFT' | 'MID_SHIFT' | 'END_SHIFT' | 'HANDOVER';
export type AssetCondition = 'OK' | 'DAMAGED' | 'MISSING';
export type CashSettlementStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const DAY_LABELS: Record<DayOfWeek, string> = {
    1: 'CN', 2: 'T2', 3: 'T3', 4: 'T4', 5: 'T5', 6: 'T6', 7: 'T7',
};

export const SHIFT_LABELS: Record<ShiftType, string> = {
    MORNING: 'Ca Sáng (06h-14h)',
    AFTERNOON: 'Ca Chiều (14h-20h)',
    EVENING: 'Ca Tối (20h-02h)',
};

export const SHIFT_ICONS: Record<ShiftType, string> = {
    MORNING: 'wb_sunny',
    AFTERNOON: 'wb_twilight',
    EVENING: 'dark_mode',
};

export const SHIFT_COLORS: Record<ShiftType, string> = {
    MORNING: '#f59e0b',
    AFTERNOON: '#f97316',
    EVENING: '#6366f1',
};

export const CHECKLIST_LABELS: Record<ChecklistCategory, string> = {
    NOTE: 'Lưu Ý Quan Trọng',
    START_SHIFT: 'Đầu Ca',
    MID_SHIFT: 'Giữa Ca',
    END_SHIFT: 'Cuối Ca',
    HANDOVER: 'Giao Ca',
};

export const CHECKLIST_ICONS: Record<ChecklistCategory, string> = {
    NOTE: 'warning',
    START_SHIFT: 'login',
    MID_SHIFT: 'schedule',
    END_SHIFT: 'logout',
    HANDOVER: 'swap_horiz',
};

export const DENOMINATION_VALUES = [
    1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000
] as const;

export type DenominationValue = typeof DENOMINATION_VALUES[number];

// ─── Cash Settlement field definitions ───
// Used for rendering the form and per-item notes
export const CASH_REVENUE_FIELDS = [
    { key: 'cash_start', label: 'Tiền kết đầu ca', icon: 'savings', type: 'income' as const },
    { key: 'revenue_before_midnight', label: 'Doanh thu trước 0h00', icon: 'trending_up', type: 'income' as const },
    { key: 'revenue_after_midnight', label: 'Doanh thu sau 0h00', icon: 'trending_up', type: 'income' as const },
    { key: 'supply_cost', label: 'Trả tiền nhập hàng', icon: 'shopping_cart', type: 'expense' as const },
    { key: 'cancel_amount', label: 'Hủy hàng', icon: 'delete', type: 'expense' as const },
    { key: 'export_amount', label: 'Xuất hàng dùng chung', icon: 'output', type: 'expense' as const },
    { key: 'withdraw_amount', label: 'Rút kết', icon: 'money_off', type: 'expense' as const },
    { key: 'refund_amount', label: 'Trả hàng / Khách trả', icon: 'keyboard_return', type: 'income' as const },
    { key: 'customer_return', label: 'Khách trả vỏ bình 20L', icon: 'recycling', type: 'income' as const },
] as const;

export const CASH_PAYMENT_FIELDS = [
    { key: 'momo_amount', label: 'Thanh toán Momo', icon: 'phone_android' },
    { key: 'card_amount', label: 'Thanh toán quẹt thẻ', icon: 'credit_card' },
    { key: 'point_payment', label: 'Thanh toán bằng điểm', icon: 'loyalty' },
] as const;

// ----- Interfaces -----

export interface Shift {
    id: string;
    store_id: string;
    shift_type: ShiftType;
    shift_date: string;
    started_by: string;
    started_at: string;
    ended_at?: string;
    ended_by?: string;
    status: ShiftStatus;
    wifi_password?: string;
    momo_filter_time?: string;
    notes?: string;
    previous_shift_id?: string;
    created_at: string;
    updated_at: string;
    // Joined
    started_by_user?: { name: string };
    ended_by_user?: { name: string };
    store?: { code: string; name: string };
}

export interface CashSettlement {
    id: string;
    shift_id: string;
    // Denominations
    denom_1000: number;
    denom_2000: number;
    denom_5000: number;
    denom_10000: number;
    denom_20000: number;
    denom_50000: number;
    denom_100000: number;
    denom_200000: number;
    denom_500000: number;
    total_counted: number;
    // Revenue
    cash_start: number;
    revenue_before_midnight: number;
    revenue_after_midnight: number;
    refund_amount: number;
    supply_cost: number;
    cancel_amount: number;
    export_amount: number;
    withdraw_amount: number;  // FIX: Rút kết
    // Payment methods
    momo_amount: number;
    card_amount: number;
    point_payment: number;
    customer_return: number;
    // Calculated
    cash_end_expected: number;
    cash_end_actual: number;
    difference: number;
    difference_reason?: string;
    // FIX: Per-item notes + momo filter time
    item_notes: Record<string, string>;  // { "supply_cost": "1 bao đá" }
    momo_filter_time?: string;
    //
    status: CashSettlementStatus;
    submitted_at?: string;
    approved_by?: string;
    approved_at?: string;
    created_at: string;
    updated_at: string;
}

export interface ChecklistTemplate {
    id: string;
    store_ids: string[] | null;
    category: ChecklistCategory;
    title: string;
    description?: string;
    requires_photo: boolean;
    requires_note: boolean;
    sort_order: number;
    shift_types: ShiftType[];
    day_of_week: DayOfWeek[] | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface ChecklistResponse {
    id: string;
    shift_id: string;
    template_id: string;
    is_completed: boolean;
    completed_at?: string;
    completed_by?: string;
    note?: string;
    photo_url?: string;
    created_at: string;
    updated_at: string;
    // Joined
    template?: ChecklistTemplate;
}

export interface ShiftAsset {
    id: string;
    store_ids: string[] | null; // NULL = all stores, array = specific stores
    name: string;
    unit_value: number;
    expected_ok: number;
    expected_total: number;
    sort_order: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface ShiftAssetCheck {
    id: string;
    shift_id: string;
    asset_id: string;
    ok_count: number;
    damaged_count: number;
    note?: string;
    checked_by?: string;
    checked_at: string;
    // Joined
    asset?: ShiftAsset;
}

// FIX: Handover product template (admin-configured fixed list)
export interface HandoverProduct {
    id: string;
    store_ids: string[] | null; // NULL = all stores, array = specific stores
    product_name: string;
    barcode?: string;
    sort_order: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface ShiftInventoryHandover {
    id: string;
    shift_id: string;
    product_template_id?: string;  // FIX: Link to template
    product_name: string;
    barcode?: string;
    system_qty: number;
    actual_qty: number;
    difference: number;
    note?: string;
    checked_by?: string;
    checked_at: string;
    created_at: string;
}

export interface ShiftQuickReport {
    id: string;
    shift_id: string;
    item_name: string;
    quantity: number;
    expiry_date?: string;
    note?: string;
    checked_by?: string;
    created_at: string;
    updated_at: string;
}

// ----- Aggregate types -----

export interface ShiftSummary extends Shift {
    cash_settlement?: CashSettlement;
    checklist_progress: { completed: number; total: number };
    asset_check_progress: { completed: number; total: number };
    handover_count: number;
}

export interface ShiftDashboardStats {
    total_shifts: number;
    total_revenue: number;
    total_difference: number;
    shifts_with_difference: number;
    avg_checklist_completion: number;
}
