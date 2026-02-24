import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type {
    RecoveryItem,
    RecoveryDocument,
    RecoveryHistoryEntry,
    CreateRecoveryItemInput,
    UpdateRecoveryItemInput,
    RecoveryFilters,
    RecoveryStats,
    RecoveryStatus
} from '../types/recovery';
import { NotificationService } from './notification';

/* Valid status transitions */
const VALID_TRANSITIONS: Record<RecoveryStatus, RecoveryStatus[]> = {
    PENDING: ['APPROVED', 'REJECTED', 'CANCELLED'],
    APPROVED: ['IN_PROGRESS', 'CANCELLED'],
    IN_PROGRESS: ['RECOVERED', 'CANCELLED'],
    RECOVERED: [],
    REJECTED: [],
    CANCELLED: [],
};

class RecoveryServiceClass {
    async resolveProductIds(barcodes: string[]): Promise<Record<string, string>> {
        if (!isSupabaseConfigured() || barcodes.length === 0) return {};

        try {
            const unique = [...new Set(barcodes.filter(Boolean))];
            const { data, error } = await supabase
                .from('products')
                .select('id, barcode')
                .in('barcode', unique);

            if (error) throw error;

            const map: Record<string, string> = {};
            for (const p of (data || [])) {
                map[p.barcode] = p.id;
            }
            return map;
        } catch (e: any) {
            console.error('[Recovery] Resolve product IDs error:', e);
            return {};
        }
    }

    async getRecoveryItems(filters?: RecoveryFilters): Promise<RecoveryItem[]> {
        if (!isSupabaseConfigured()) {
            console.warn('[Recovery] Supabase not configured');
            return [];
        }

        try {
            let query = supabase
                .from('recovery_items')
                .select('*, products:product_id(name, barcode), assigned_user:assigned_to(id, name)')
                .order('created_at', { ascending: false });

            // Apply filters
            if (filters?.store_id) {
                query = query.eq('store_id', filters.store_id);
            }
            if (filters?.status) {
                query = query.eq('status', filters.status);
            }
            if (filters?.created_by) {
                query = query.eq('created_by', filters.created_by);
            }
            if (filters?.from_date) {
                query = query.gte('created_at', filters.from_date);
            }
            if (filters?.to_date) {
                query = query.lte('created_at', filters.to_date);
            }
            if (filters?.search) {
                query = query.or(`reason.ilike.%${filters.search}%,notes.ilike.%${filters.search}%`);
            }

            const { data, error } = await query;

            if (error) {
                console.error('[Recovery] Error fetching items:', error);
                throw error;
            }

            return (data || []).map((item: any) => ({
                ...item,
                product_name: item.products?.name || '',
                barcode: item.products?.barcode || '',
                assigned_to_name: item.assigned_user?.name || null,
                products: undefined,
                assigned_user: undefined,
            }));
        } catch (e: any) {
            console.error('[Recovery] Get items error:', e);
            return [];
        }
    }

    async getRecoveryItem(id: string): Promise<RecoveryItem | null> {
        if (!isSupabaseConfigured()) return null;

        try {
            const { data, error } = await supabase
                .from('recovery_items')
                .select('*, products:product_id(name, barcode), assigned_user:assigned_to(id, name)')
                .eq('id', id)
                .single();

            if (error) throw error;
            return data ? {
                ...data,
                product_name: data.products?.name || '',
                barcode: data.products?.barcode || '',
                assigned_to_name: data.assigned_user?.name || null,
                products: undefined,
                assigned_user: undefined,
            } : null;
        } catch (e: any) {
            console.error('[Recovery] Get item error:', e);
            return null;
        }
    }

    async createRecoveryItem(input: CreateRecoveryItemInput): Promise<{ success: boolean; data?: RecoveryItem; error?: string }> {
        if (!isSupabaseConfigured()) {
            return { success: false, error: 'Database not configured' };
        }

        if (!input.product_id) {
            return { success: false, error: 'Sản phẩm là bắt buộc' };
        }
        if (!input.quantity || input.quantity <= 0) {
            return { success: false, error: 'Số lượng phải lớn hơn 0' };
        }
        if (input.unit_price < 0) {
            return { success: false, error: 'Đơn giá không hợp lệ' };
        }
        if (!input.reason) {
            return { success: false, error: 'Lý do truy thu là bắt buộc' };
        }

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                return { success: false, error: 'Chưa đăng nhập' };
            }

            const { data, error } = await supabase
                .from('recovery_items')
                .insert([{
                    ...input,
                    created_by: session.user.id,
                    status: 'PENDING'
                }])
                .select('*, products:product_id(name, barcode)')
                .single();

            if (error) {
                console.error('[Recovery] Create error:', error);
                throw error;
            }

            try {
                const productName = (data as any)?.products?.name || 'Sản phẩm';
                await this.notifyStoreEmployeesForRecovery(
                    input.store_id,
                    data.id,
                    productName,
                    input.quantity,
                    session.user.id
                );
            } catch (notifErr) {
                console.warn('[Recovery] Failed to notify store employees:', notifErr);
            }

            return { success: true, data: { ...data, products: undefined } as RecoveryItem };
        } catch (e: any) {
            console.error('[Recovery] Create item error:', e);
            return { success: false, error: 'Không thể tạo: ' + e.message };
        }
    }

    async updateRecoveryItem(
        id: string,
        input: UpdateRecoveryItemInput
    ): Promise<{ success: boolean; data?: RecoveryItem; error?: string }> {
        if (!isSupabaseConfigured()) {
            return { success: false, error: 'Database not configured' };
        }

        try {
            const { data, error } = await supabase
                .from('recovery_items')
                .update({ ...input, updated_at: new Date().toISOString() })
                .eq('id', id)
                .select()
                .single();

            if (error) {
                console.error('[Recovery] Update error:', error);
                throw error;
            }
            return { success: true, data };
        } catch (e: any) {
            console.error('[Recovery] Update item error:', e);
            return { success: false, error: 'Không thể cập nhật: ' + e.message };
        }
    }

    async deleteRecoveryItem(id: string): Promise<{ success: boolean; error?: string }> {
        if (!isSupabaseConfigured()) {
            return { success: false, error: 'Database not configured' };
        }

        try {
            const { error } = await supabase
                .from('recovery_items')
                .delete()
                .eq('id', id);

            if (error) {
                console.error('[Recovery] Delete error:', error);
                throw error;
            }
            return { success: true };
        } catch (e: any) {
            console.error('[Recovery] Delete item error:', e);
            return { success: false, error: 'Không thể xóa: ' + e.message };
        }
    }

    async submitForApproval(id: string): Promise<{ success: boolean; error?: string }> {
        if (!isSupabaseConfigured()) {
            return { success: false, error: 'Database not configured' };
        }

        try {
            const { data, error } = await supabase
                .from('recovery_items')
                .update({
                    status: 'PENDING',
                    submitted_at: new Date().toISOString()
                })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return { success: true };
        } catch (e: any) {
            console.error('[Recovery] Submit error:', e);
            return { success: false, error: 'Không thể gửi duyệt: ' + e.message };
        }
    }

    async approveRecovery(id: string, notes?: string): Promise<{ success: boolean; error?: string }> {
        if (!isSupabaseConfigured()) {
            return { success: false, error: 'Database not configured' };
        }

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                return { success: false, error: 'Chưa đăng nhập' };
            }

            const { data: current } = await supabase.from('recovery_items').select('status').eq('id', id).single();
            if (current && !VALID_TRANSITIONS[current.status as RecoveryStatus]?.includes('APPROVED')) {
                return { success: false, error: `Không thể duyệt phiếu ở trạng thái ${current.status}` };
            }

            const { data, error } = await supabase
                .from('recovery_items')
                .update({
                    status: 'APPROVED',
                    approved_by: session.user.id,
                    approved_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    notes: notes || null
                })
                .eq('id', id)
                .eq('status', 'PENDING')
                .select()
                .single();

            if (error) {
                console.error('[Recovery] Approve error:', error);
                throw error;
            }
            return { success: true };
        } catch (e: any) {
            console.error('[Recovery] Approve error:', e);
            return { success: false, error: 'Không thể duyệt: ' + e.message };
        }
    }

    async rejectRecovery(id: string, reason: string): Promise<{ success: boolean; error?: string }> {
        if (!isSupabaseConfigured()) {
            return { success: false, error: 'Database not configured' };
        }

        if (!reason) {
            return { success: false, error: 'Lý do từ chối là bắt buộc' };
        }

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                return { success: false, error: 'Chưa đăng nhập' };
            }
            // Validate status transition
            const { data: current } = await supabase.from('recovery_items').select('status').eq('id', id).single();
            if (current && !VALID_TRANSITIONS[current.status as RecoveryStatus]?.includes('REJECTED')) {
                return { success: false, error: `Không thể từ chối phiếu ở trạng thái ${current.status}` };
            }

            const { data, error } = await supabase
                .from('recovery_items')
                .update({
                    status: 'REJECTED',
                    rejected_by: session.user.id,
                    rejected_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    rejection_reason: reason
                })
                .eq('id', id)
                .eq('status', 'PENDING')
                .select()
                .single();

            if (error) {
                console.error('[Recovery] Reject error:', error);
                throw error;
            }
            return { success: true };
        } catch (e: any) {
            console.error('[Recovery] Reject error:', e);
            return { success: false, error: 'Không thể từ chối: ' + e.message };
        }
    }

    async markInProgress(id: string): Promise<{ success: boolean; error?: string }> {
        return this.updateStatus(id, 'IN_PROGRESS');
    }

    async markAsRecovered(id: string, recoveredAmount?: number): Promise<{ success: boolean; error?: string }> {
        if (!isSupabaseConfigured()) {
            return { success: false, error: 'Database not configured' };
        }

        try {
            // Validate status transition
            const { data: current } = await supabase.from('recovery_items').select('status').eq('id', id).single();
            if (current && !VALID_TRANSITIONS[current.status as RecoveryStatus]?.includes('RECOVERED')) {
                return { success: false, error: `Không thể hoàn thành phiếu ở trạng thái ${current.status}` };
            }

            const { data, error } = await supabase
                .from('recovery_items')
                .update({
                    status: 'RECOVERED',
                    recovered_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    recovered_amount: recoveredAmount || null
                })
                .eq('id', id)
                .eq('status', 'IN_PROGRESS')
                .select()
                .single();

            if (error) throw error;
            return { success: true };
        } catch (e: any) {
            console.error('[Recovery] Mark recovered error:', e);
            return { success: false, error: 'Không thể cập nhật: ' + e.message };
        }
    }

    async cancelRecovery(id: string): Promise<{ success: boolean; error?: string }> {
        return this.updateStatus(id, 'CANCELLED');
    }

    private async updateStatus(id: string, status: RecoveryStatus): Promise<{ success: boolean; error?: string }> {
        if (!isSupabaseConfigured()) {
            return { success: false, error: 'Database not configured' };
        }

        try {
            // Validate status transition
            const { data: current } = await supabase.from('recovery_items').select('status').eq('id', id).single();
            if (current && !VALID_TRANSITIONS[current.status as RecoveryStatus]?.includes(status)) {
                return { success: false, error: `Không thể chuyển từ ${current.status} sang ${status}` };
            }

            const { data, error } = await supabase
                .from('recovery_items')
                .update({ status, updated_at: new Date().toISOString() })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return { success: true };
        } catch (e: any) {
            console.error('[Recovery] Update status error:', e);
            return { success: false, error: 'Không thể cập nhật trạng thái: ' + e.message };
        }
    }

    async getDocuments(recoveryId: string): Promise<RecoveryDocument[]> {
        if (!isSupabaseConfigured()) return [];

        try {
            const { data, error } = await supabase
                .from('recovery_documents')
                .select('*')
                .eq('recovery_id', recoveryId)
                .order('uploaded_at', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (e: any) {
            console.error('[Recovery] Get documents error:', e);
            return [];
        }
    }

    async addDocument(
        recoveryId: string,
        fileName: string,
        fileUrl: string,
        fileType?: string,
        fileSizeBytes?: number
    ): Promise<{ success: boolean; data?: RecoveryDocument; error?: string }> {
        if (!isSupabaseConfigured()) {
            return { success: false, error: 'Database not configured' };
        }

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                return { success: false, error: 'Chưa đăng nhập' };
            }

            const { data, error } = await supabase
                .from('recovery_documents')
                .insert([{
                    recovery_id: recoveryId,
                    file_name: fileName,
                    file_url: fileUrl,
                    file_type: fileType,
                    file_size_bytes: fileSizeBytes,
                    uploaded_by: session.user.id
                }])
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (e: any) {
            console.error('[Recovery] Add document error:', e);
            return { success: false, error: 'Không thể thêm tài liệu: ' + e.message };
        }
    }

    async deleteDocument(documentId: string): Promise<{ success: boolean; error?: string }> {
        if (!isSupabaseConfigured()) {
            return { success: false, error: 'Database not configured' };
        }

        try {
            const { error } = await supabase
                .from('recovery_documents')
                .delete()
                .eq('id', documentId);

            if (error) throw error;
            return { success: true };
        } catch (e: any) {
            console.error('[Recovery] Delete document error:', e);
            return { success: false, error: 'Không thể xóa tài liệu: ' + e.message };
        }
    }

    async getHistory(recoveryId: string): Promise<RecoveryHistoryEntry[]> {
        if (!isSupabaseConfigured()) return [];

        try {
            const { data, error } = await supabase
                .from('recovery_history')
                .select('*')
                .eq('recovery_id', recoveryId)
                .order('changed_at', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (e: any) {
            console.error('[Recovery] Get history error:', e);
            return [];
        }
    }

    async getStats(storeId?: string): Promise<RecoveryStats | null> {
        if (!isSupabaseConfigured()) return null;

        try {
            let query = supabase
                .from('recovery_items')
                .select('status, total_amount, recovered_amount, store_id');

            if (storeId) {
                query = query.eq('store_id', storeId);
            }

            const { data, error } = await query;

            if (error) throw error;
            if (!data) return null;

            // Calculate stats
            const stats: RecoveryStats = {
                total_items: data.length,
                total_amount: data.reduce((sum, item) => sum + (item.total_amount || 0), 0),
                recovered_amount: data.reduce((sum, item) => sum + (item.recovered_amount || 0), 0),
                pending_count: data.filter(i => i.status === 'PENDING').length,
                approved_count: data.filter(i => i.status === 'APPROVED').length,
                recovered_count: data.filter(i => i.status === 'RECOVERED').length,
                rejected_count: data.filter(i => i.status === 'REJECTED').length
            };

            return stats;
        } catch (e: any) {
            console.error('[Recovery] Get stats error:', e);
            return null;
        }
    }

    async assignRecovery(
        recoveryId: string,
        assigneeId: string,
        assigneeName?: string
    ): Promise<{ success: boolean; error?: string }> {
        if (!isSupabaseConfigured()) {
            return { success: false, error: 'Database not configured' };
        }

        try {
            const { data, error } = await supabase
                .from('recovery_items')
                .update({
                    assigned_to: assigneeId,
                    updated_at: new Date().toISOString()
                })
                .eq('id', recoveryId)
                .select('id, reason, total_amount, products:product_id(name)')
                .single();

            if (error) throw error;

            const productName = (data as any)?.products?.name || 'Sản phẩm';
            await NotificationService.createNotification({
                user_id: assigneeId,
                type: 'RECOVERY_ASSIGNED',
                title: 'Phiếu truy thu mới được giao',
                message: `Bạn được giao truy thu "${productName}" - ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(data?.total_amount || 0)}`,
                reference_id: recoveryId,
                reference_type: 'recovery_item',
            });

            return { success: true };
        } catch (e: any) {
            console.error('[Recovery] Assign error:', e);
            return { success: false, error: 'Không thể giao phiếu: ' + e.message };
        }
    }

    async getAssignableUsers(storeId?: string): Promise<{ id: string; name: string; store_name?: string }[]> {
        if (!isSupabaseConfigured()) return [];

        try {
            if (storeId) {
                const { data, error } = await supabase
                    .from('user_stores')
                    .select('users!inner(id, name, role), stores!inner(name)')
                    .eq('store_id', storeId)
                    .eq('users.role', 'EMPLOYEE');

                if (!error && data && data.length > 0) {
                    return data.map((row: any) => ({
                        id: row.users.id,
                        name: row.users.name,
                        store_name: row.stores?.name || '',
                    }));
                }
            }

            // Fallback: all employees (for admin or when no store filter)
            const { data, error } = await supabase
                .from('users')
                .select('id, name, stores:store_id(name)')
                .eq('role', 'EMPLOYEE')
                .order('name');

            if (error) throw error;

            return (data || []).map((u: any) => ({
                id: u.id,
                name: u.name,
                store_name: u.stores?.name || '',
            }));
        } catch (e: any) {
            console.error('[Recovery] Get assignable users error:', e);
            return [];
        }
    }

    /**
     * Get employee IDs linked to a specific store via user_stores.
     * Used for auto-notification when a recovery item is created.
     */
    async getStoreEmployees(storeId: string): Promise<{ id: string; name: string }[]> {
        if (!isSupabaseConfigured()) return [];

        try {
            const { data, error } = await supabase
                .from('user_stores')
                .select('users!inner(id, name, role)')
                .eq('store_id', storeId)
                .eq('users.role', 'EMPLOYEE');

            if (error) throw error;
            return (data || []).map((row: any) => ({
                id: row.users.id,
                name: row.users.name,
            }));
        } catch (e: any) {
            console.error('[Recovery] Get store employees error:', e);
            return [];
        }
    }

    /**
     * Send notifications to all employees at a store when a recovery item is created.
     * Excludes the creator themselves from notifications.
     */
    async notifyStoreEmployeesForRecovery(
        storeId: string,
        recoveryId: string,
        productName: string,
        quantity: number,
        excludeUserId?: string
    ): Promise<number> {
        const employees = await this.getStoreEmployees(storeId);
        const targetIds = employees
            .map(e => e.id)
            .filter(id => id !== excludeUserId);

        if (targetIds.length === 0) return 0;

        return await NotificationService.notifyMultiple(targetIds, {
            type: 'RECOVERY_ASSIGNED',
            title: 'Phiếu truy thu mới tại cửa hàng của bạn',
            message: `Sản phẩm "${productName}" (SL: ${quantity}) cần được truy thu.`,
            reference_id: recoveryId,
            reference_type: 'recovery_item',
        });
    }
}

export const RecoveryService = new RecoveryServiceClass();
export default RecoveryService;
