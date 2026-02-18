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

class RecoveryServiceClass {
    async getRecoveryItems(filters?: RecoveryFilters): Promise<RecoveryItem[]> {
        if (!isSupabaseConfigured()) {
            console.warn('[Recovery] Supabase not configured');
            return [];
        }

        try {
            let query = supabase
                .from('recovery_items')
                .select('*')
                .order('created_at', { ascending: false });

            // Apply filters
            if (filters?.store_id) {
                query = query.eq('store_id', filters.store_id);
            }
            if (filters?.status) {
                query = query.eq('status_enum', filters.status);
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
                query = query.or(`product_name.ilike.%${filters.search}%,barcode.ilike.%${filters.search}%,reason.ilike.%${filters.search}%`);
            }

            const { data, error } = await query;

            if (error) {
                console.error('[Recovery] Error fetching items:', error);
                throw error;
            }

            return data || [];
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
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            return data;
        } catch (e: any) {
            console.error('[Recovery] Get item error:', e);
            return null;
        }
    }

    async createRecoveryItem(input: CreateRecoveryItemInput): Promise<{ success: boolean; data?: RecoveryItem; error?: string }> {
        if (!isSupabaseConfigured()) {
            return { success: false, error: 'Database not configured' };
        }

        if (!input.product_name) {
            return { success: false, error: 'Tên sản phẩm là bắt buộc' };
        }
        if (!input.quantity || input.quantity <= 0) {
            return { success: false, error: 'Số lượng phải lớn hơn 0' };
        }
        if (!input.unit_price || input.unit_price < 0) {
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
                    status_enum: 'PENDING'
                }])
                .select()
                .single();

            if (error) {
                console.error('[Recovery] Create error:', error);
                throw error;
            }
            return { success: true, data };
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
                .update(input)
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
                    status_enum: 'PENDING',
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
            const { data, error } = await supabase
                .from('recovery_items')
                .update({
                    status_enum: 'APPROVED',
                    approved_by: session.user.id,
                    approved_at: new Date().toISOString(),
                    notes: notes || null
                })
                .eq('id', id)
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
            const { data, error } = await supabase
                .from('recovery_items')
                .update({
                    status_enum: 'REJECTED',
                    rejected_by: session.user.id,
                    rejected_at: new Date().toISOString(),
                    rejection_reason: reason
                })
                .eq('id', id)
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
            const { data, error } = await supabase
                .from('recovery_items')
                .update({
                    status_enum: 'RECOVERED',
                    recovered_at: new Date().toISOString(),
                    recovered_amount: recoveredAmount || null
                })
                .eq('id', id)
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
            const { data, error } = await supabase
                .from('recovery_items')
                .update({ status_enum: status })
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
                .select('status_enum, total_amount, recovered_amount, store_id');

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
                pending_count: data.filter(i => i.status_enum === 'PENDING').length,
                approved_count: data.filter(i => i.status_enum === 'APPROVED').length,
                recovered_count: data.filter(i => i.status_enum === 'RECOVERED').length,
                rejected_count: data.filter(i => i.status_enum === 'REJECTED').length
            };

            return stats;
        } catch (e: any) {
            console.error('[Recovery] Get stats error:', e);
            return null;
        }
    }
}

export const RecoveryService = new RecoveryServiceClass();
export default RecoveryService;
