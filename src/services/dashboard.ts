import { supabase, isSupabaseConfigured } from '../lib/supabase';

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

const addDays = (days: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
};

export const DashboardService = {
    async getStats(): Promise<{ success: boolean; stats: DashboardStats }> {
        if (isSupabaseConfigured()) {
            try {
                const [urgentResult, totalAuditsResult, totalChecksResult] = await Promise.all([
                    supabase
                        .from('expiry_items')
                        .select('*', { count: 'exact', head: true })
                        .gte('expiry_date', new Date().toISOString().split('T')[0])
                        .lte('expiry_date', addDays(3)),

                    supabase
                        .from('inventory_items')
                        .select('*', { count: 'exact', head: true }),
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

        return {
            success: false,
            stats: {
                urgentItems: 0,
                totalChecks: 0,
                totalAudits: 0,
            },
        };
    },

    async getTasks(userId?: string): Promise<{ success: boolean; tasks: TaskItem[] }> {
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
            assignee_id,
            users (
              name
            )
          `);

                if (userId) {
                    query = query.eq('assignee_id', userId);
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
                    status: t.status === 'NOT_STARTED' ? 'PENDING' : t.status,
                }));

                return { success: true, tasks };
            } catch (e) {
                console.error('[Dashboard] Get tasks error:', e);
            }
        }
        return { success: false, tasks: [] };
    },
};

export default DashboardService;
