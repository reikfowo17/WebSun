import { supabase, isSupabaseConfigured } from "../../lib/supabase";
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
export interface ReportSummary {
    id: string;
    storeId: string;
    store: string;
    shift: number;
    date: string;
    submittedBy: string;
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
