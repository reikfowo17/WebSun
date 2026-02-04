/**
 * Dashboard Service
 * 
 * Handles dashboard statistics and task management
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ExpiryService } from './expiry';

// ===========================================================================
// TYPES
// ===========================================================================

export interface DashboardStats {
    urgentItems: number;
    totalChecks: number;
    totalAudits: number;
}

export interface TaskItem {
    id: string;
    title: string;
    assignee: string;
    type: 'INVENTORY' | 'EXPIRY' | 'RECOVERY' | 'OTHER' | 'AUDIT' | 'GENERAL';
    target_items: number;
    completed_items: number;
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
}

// ===========================================================================
// MOCK DATA
// ===========================================================================

const MOCK_TASKS: TaskItem[] = [
    {
        id: '1',
        title: 'Kiểm kê Ca 1 - CHN',
        assignee: 'Nhân viên 1',
        type: 'INVENTORY',
        target_items: 50,
        completed_items: 45,
        status: 'IN_PROGRESS'
    },
    {
        id: '2',
        title: 'Báo cáo hạn dùng TM - CHN',
        assignee: 'Nhân viên 2',
        type: 'EXPIRY',
        target_items: 30,
        completed_items: 30,
        status: 'COMPLETED'
    },
];

// ===========================================================================
// UTILITY
// ===========================================================================

const addDays = (days: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
};

// ===========================================================================
// DASHBOARD SERVICE
// ===========================================================================

export const DashboardService = {
    /**
     * Get dashboard statistics
     */
    async getStats(): Promise<{ success: boolean; stats: DashboardStats }> {
        if (isSupabaseConfigured()) {
            try {
                // Parallel fetch for better performance
                const [urgentResult, totalAuditsResult, totalChecksResult] = await Promise.all([
                    // Get urgent expiry items (within 3 days)
                    supabase
                        .from('expiry_items')
                        .select('*', { count: 'exact', head: true })
                        .gte('expiry_date', new Date().toISOString().split('T')[0])
                        .lte('expiry_date', addDays(3)),

                    // Get total inventory items
                    supabase
                        .from('inventory_items')
                        .select('*', { count: 'exact', head: true }),

                    // Get checked inventory items
                    supabase
                        .from('inventory_items')
                        .select('*', { count: 'exact', head: true })
                        .not('actual_stock', 'is', null),
                ]);

                return {
                    success: true,
                    stats: {
                        urgentItems: urgentResult.count || 0,
                        totalAudits: totalAuditsResult.count || 0,
                        totalChecks: totalChecksResult.count || 0,
                    },
                };
            } catch (e) {
                console.error('[Dashboard] Get stats error:', e);
            }
        }

        // Mock mode
        await new Promise(r => setTimeout(r, 300));
        return {
            success: true,
            stats: {
                urgentItems: 5,
                totalChecks: 45,
                totalAudits: 50,
            },
        };
    },

    /**
     * Get tasks for a user
     */
    async getTasks(assignee?: string): Promise<{ success: boolean; tasks: TaskItem[] }> {
        if (isSupabaseConfigured()) {
            try {
                let query = supabase
                    .from('tasks')
                    .select(`
            id,
            title,
            type,
            target_items,
            completed_items,
            status,
            users (
              name
            )
          `);

                if (assignee) {
                    query = query.eq('users.name', assignee);
                }

                const { data, error } = await query;
                if (error) throw error;

                const tasks: TaskItem[] = (data || []).map((t: any) => ({
                    id: t.id,
                    title: t.title,
                    assignee: t.users?.name || '',
                    type: t.type,
                    target_items: t.target_items,
                    completed_items: t.completed_items,
                    status: t.status,
                }));

                return { success: true, tasks };
            } catch (e) {
                console.error('[Dashboard] Get tasks error:', e);
            }
        }

        // Mock mode
        await new Promise(r => setTimeout(r, 300));
        let tasks = [...MOCK_TASKS];
        if (assignee) {
            tasks = tasks.filter(t => t.assignee === assignee);
        }
        return { success: true, tasks };
    },
};

export default DashboardService;
