
export const NV_ALLOWED_FIELDS = ['actual_stock', 'note', 'diff_reason'] as const;
export const ADMIN_ALLOWED_FIELDS = [...NV_ALLOWED_FIELDS, 'system_stock', 'status'] as const;
export const REPORT_STATUS = {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
} as const;
export type ReportStatus = typeof REPORT_STATUS[keyof typeof REPORT_STATUS];
export const REVIEW_ALLOWED_ROLES = ['ADMIN', 'MANAGER'] as const;
export const DIFF_REASON_OPTIONS = [
    { value: 'DAMAGED', label: 'Hàng hỏng', icon: 'broken_image' },
    { value: 'EXPIRED', label: 'Hết hạn', icon: 'event_busy' },
    { value: 'LOST', label: 'Mất mát', icon: 'search_off' },
    { value: 'MISCOUNT', label: 'Nhầm lẫn nhập/xuất', icon: 'swap_horiz' },
    { value: 'IN_TRANSIT', label: 'Đang vận chuyển', icon: 'local_shipping' },
    { value: 'OTHER', label: 'Khác', icon: 'more_horiz' },
] as const;
export type DiffReason = typeof DIFF_REASON_OPTIONS[number]['value'];

export const RESOLUTION_CONFIG = {
    PENDING: {
        label: 'Chờ phân loại',
        icon: 'pending',
        color: '#94a3b8',
        bg: '#f8fafc',
        description: 'Chưa xác định hướng xử lý',
    },
    LOST_GOODS: {
        label: 'Mất hàng – Truy thu',
        icon: 'report',
        color: '#dc2626',
        bg: '#fef2f2',
        description: 'Tạo phiếu truy thu cuối tháng cho nhân viên',
    },
    MISPLACED: {
        label: 'Thất lạc – Kiểm lại',
        icon: 'location_searching',
        color: '#d97706',
        bg: '#fffbeb',
        description: 'Đánh dấu cần kiểm tra lại, đặt ngày nhắc nhở',
    },
    STOCK_ADJUSTMENT: {
        label: 'Cân kho',
        icon: 'balance',
        color: '#059669',
        bg: '#f0fdf4',
        description: 'Điều chỉnh tồn trên KiotViet, ghi nhận vào hệ thống',
    },
    INPUT_ERROR: {
        label: 'Sai số nhập liệu',
        icon: 'edit_note',
        color: '#7c3aed',
        bg: '#f5f3ff',
        description: 'Nhập sai số liệu, điều chỉnh hệ thống',
    },
    RETURN_GOODS: {
        label: 'Hàng đổi trả',
        icon: 'undo',
        color: '#0284c7',
        bg: '#f0f9ff',
        description: 'Hàng trả về, cập nhật tồn kho',
    },
    RESOLVED_INTERNAL: {
        label: 'Xử lý nội bộ',
        icon: 'check_circle',
        color: '#16a34a',
        bg: '#f0fdf4',
        description: 'Đã xử lý nội bộ, không cần hành động thêm',
    },
} as const;

export type DiscrepancyResolution = keyof typeof RESOLUTION_CONFIG;
export const RECOVERY_RESOLUTIONS: DiscrepancyResolution[] = ['LOST_GOODS'];
export const RECHECK_RESOLUTIONS: DiscrepancyResolution[] = ['MISPLACED'];
export interface ReportSummary {
    id: string;
    storeId: string;
    store: string;
    shift: number;
    date: string;
    submittedBy: string;
    submittedById?: string;
    submittedAt: string;
    status: ReportStatus;
    total: number;
    matched: number;
    missing: number;
    over: number;
    reviewedBy: string | null;
    reviewedAt: string | null;
    rejectionReason: string | null;
}
export interface ReportDetail {
    id: string;
    store_code: string;
    store_name: string;
    shift: number;
    check_date: string;
    status: ReportStatus;
    submitted_by: string;
    submitted_at: string;
    reviewed_by?: string;
    reviewed_at?: string;
    rejection_reason?: string;
    total_items: number;
    matched_items: number;
    missing_items: number;
    over_items: number;
}
export interface ReviewResult {
    success: boolean;
    message?: string;
    stockUpdateFailed?: boolean;
}
export interface BulkReviewResult {
    success: boolean;
    processed: number;
    failed: number;
    stockWarnings: string[];
    errors: string[];
}
export interface InventoryProduct {
    id: string;
    productName: string;
    sp: string;
    barcode: string;
    systemStock: number;
    actualStock: number | null;
    diff: number;
    status: 'PENDING' | 'MATCHED' | 'MISSING' | 'OVER';
    note: string;
    diffReason?: DiffReason | null;
    snapshotAt?: string | null;
    resolution?: DiscrepancyResolution | null;
    adminNote?: string | null;
}
export interface MasterItem {
    id: string;
    name: string;
    sp: string;
    barcode: string;
    category: string;
    unit: string;
    unitPrice: number;
}

export interface ReportItem {
    id: string;
    product_name: string;
    barcode: string;
    category: string;
    system_stock: number;
    actual_stock: number | null;
    diff: number | null;
    status: string;
    note: string | null;
    diff_reason: string | null;
    resolution: DiscrepancyResolution | null;
    admin_note: string | null;
    recheck_due_date: string | null;
    recheck_note: string | null;
    recheck_completed_at: string | null;
    recovery_id?: string | null;
    source_report_id?: string | null;
}
export interface FlagRecheckInput {
    itemId: string;
    recheckDueDate: string;
    note?: string;
}

export interface CreateRecoveryFromDiscrepancyInput {
    itemId: string;
    reportId: string;
    storeId: string;
    employeeId?: string;
    quantity: number;
    unitPrice: number;
    reason: string;
}
