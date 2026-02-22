// Recovery Module Types
export type RecoveryStatus =
    | 'PENDING'
    | 'APPROVED'
    | 'IN_PROGRESS'
    | 'RECOVERED'
    | 'REJECTED'
    | 'CANCELLED';

export interface RecoveryItem {
    id: string;
    store_id: string;
    product_id?: string;

    // Item details
    product_name: string;
    barcode?: string;
    quantity: number;
    unit_price: number;
    total_amount: number;

    // Recovery details
    reason: string;
    status_enum: RecoveryStatus;

    // Creation
    created_by: string;
    created_at: string;
    submitted_at?: string;

    // Approval
    approved_by?: string;
    approved_at?: string;

    // Recovery
    recovered_amount?: number;
    recovered_at?: string;

    // Rejection
    rejected_by?: string;
    rejected_at?: string;
    rejection_reason?: string;

    // Metadata
    notes?: string;
    updated_at: string;

}

export interface RecoveryDocument {
    id: string;
    recovery_id: string;
    file_name: string;
    file_url: string;
    file_type?: string;
    file_size_bytes?: number;
    uploaded_by: string;
    uploaded_at: string;
}

export interface RecoveryHistoryEntry {
    id: string;
    recovery_id: string;
    changed_by: string;
    previous_status?: string;
    new_status: string;
    notes?: string;
    changed_at: string;
}

export interface CreateRecoveryItemInput {
    store_id: string;
    product_id?: string;
    product_name: string;
    barcode?: string;
    quantity: number;
    unit_price: number;
    reason: string;
    notes?: string;
}

export interface UpdateRecoveryItemInput {
    product_name?: string;
    barcode?: string;
    quantity?: number;
    unit_price?: number;
    reason?: string;
    notes?: string;
}

export interface RecoveryFilters {
    store_id?: string;
    status?: RecoveryStatus;
    created_by?: string;
    from_date?: string;
    to_date?: string;
    search?: string;
}

export interface RecoveryStats {
    total_items: number;
    total_amount: number;
    recovered_amount: number;
    pending_count: number;
    approved_count: number;
    recovered_count: number;
    rejected_count: number;
    by_store?: {
        store_id: string;
        store_name?: string;
        count: number;
        total_amount: number;
    }[];
}

