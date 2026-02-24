import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type {
    Notification,
    CreateNotificationInput,
} from '../types/notification';

class NotificationServiceClass {

    /** Get notifications for current user */
    async getNotifications(limit: number = 30): Promise<Notification[]> {
        if (!isSupabaseConfigured()) return [];

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return [];

            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', session.user.id)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return data || [];
        } catch (e: any) {
            console.error('[Notification] Get error:', e);
            return [];
        }
    }

    /** Get unread count for current user */
    async getUnreadCount(): Promise<number> {
        if (!isSupabaseConfigured()) return 0;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return 0;

            const { count, error } = await supabase
                .from('notifications')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', session.user.id)
                .eq('is_read', false);

            if (error) throw error;
            return count || 0;
        } catch (e: any) {
            console.error('[Notification] Unread count error:', e);
            return 0;
        }
    }

    /** Mark a notification as read */
    async markAsRead(notificationId: string): Promise<boolean> {
        if (!isSupabaseConfigured()) return false;

        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .eq('id', notificationId);

            if (error) throw error;
            return true;
        } catch (e: any) {
            console.error('[Notification] Mark read error:', e);
            return false;
        }
    }

    /** Mark all notifications as read for current user */
    async markAllAsRead(): Promise<boolean> {
        if (!isSupabaseConfigured()) return false;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return false;

            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .eq('user_id', session.user.id)
                .eq('is_read', false);

            if (error) throw error;
            return true;
        } catch (e: any) {
            console.error('[Notification] Mark all read error:', e);
            return false;
        }
    }

    /** Create a notification (used by admin/service actions) */
    async createNotification(input: CreateNotificationInput): Promise<{ success: boolean; error?: string }> {
        if (!isSupabaseConfigured()) return { success: false, error: 'DB not configured' };

        try {
            const { error } = await supabase
                .from('notifications')
                .insert([input]);

            if (error) throw error;
            return { success: true };
        } catch (e: any) {
            console.error('[Notification] Create error:', e);
            return { success: false, error: e.message };
        }
    }

    /** Send notification to multiple users */
    async notifyMultiple(userIds: string[], base: Omit<CreateNotificationInput, 'user_id'>): Promise<number> {
        if (!isSupabaseConfigured() || userIds.length === 0) return 0;

        try {
            const rows = userIds.map(uid => ({ ...base, user_id: uid }));

            const { error } = await supabase
                .from('notifications')
                .insert(rows);

            if (error) throw error;
            return userIds.length;
        } catch (e: any) {
            console.error('[Notification] Notify multiple error:', e);
            return 0;
        }
    }

    /** Delete old read notifications (cleanup) */
    async cleanOldNotifications(daysOld: number = 30): Promise<number> {
        if (!isSupabaseConfigured()) return 0;

        try {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - daysOld);

            const { data, error } = await supabase
                .from('notifications')
                .delete()
                .eq('is_read', true)
                .lt('created_at', cutoff.toISOString())
                .select('id');

            if (error) throw error;
            return data?.length || 0;
        } catch (e: any) {
            console.error('[Notification] Cleanup error:', e);
            return 0;
        }
    }
}

export const NotificationService = new NotificationServiceClass();
export default NotificationService;
