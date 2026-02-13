import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface Task {
    id: string;
    title: string;
    description: string;
    type: string;
    storeId: string;
    storeName?: string;
    assigneeId: string;
    assigneeName?: string;
    targetItems: number;
    completedItems: number;
    progress?: number;
    status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'SUBMITTED';
    dueDate: string;
    shift: number;
}

export const TasksService = {
    async getTasks(filters?: { shift?: number }): Promise<{ success: boolean; tasks: Task[] }> {
        if (isSupabaseConfigured()) {
            try {
                let query = supabase
                    .from('tasks')
                    .select(`
                        id,
                        title,
                        description,
                        type,
                        store_id,
                        assignee_id,
                        target_items,
                        completed_items,
                        status,
                        due_date,
                        shift,
                        stores ( name, code ),
                        users ( name )
                    `)
                    .order('created_at', { ascending: false });

                if (filters?.shift) {
                    query = query.eq('shift', filters.shift);
                }

                const { data, error } = await query;
                if (error) throw error;

                const tasks: Task[] = (data || []).map((t: any) => {
                    const target = t.target_items || 1;
                    const completed = t.completed_items || 0;
                    const progress = Math.round((completed / target) * 100);

                    return {
                        id: t.id,
                        title: t.title,
                        description: t.description || '',
                        type: t.type,
                        storeId: t.stores?.code || '',
                        storeName: t.stores?.name,
                        assigneeId: t.assignee_id,
                        assigneeName: t.users?.name || 'Chưa phân công',
                        targetItems: target,
                        completedItems: completed,
                        progress: progress,
                        status: t.status,
                        dueDate: t.due_date,
                        shift: t.shift || 1
                    };
                });

                return { success: true, tasks };
            } catch (e) {
                console.error('Get tasks error', e);
                return { success: false, tasks: [] };
            }
        }
        return { success: false, tasks: [] };
    },

    async createTask(task: Partial<Task>): Promise<{ success: boolean }> {
        if (isSupabaseConfigured()) {
            try {
                let storeId = task.storeId;
                if (task.storeId && task.storeId.length < 10) { 
                    const { data: store } = await supabase.from('stores').select('id').eq('code', task.storeId).single();
                    if (store) storeId = store.id;
                }

                const { error } = await supabase.from('tasks').insert({
                    title: task.title,
                    type: task.type || 'AUDIT',
                    store_id: storeId,
                    assignee_id: task.assigneeId || null,  
                    shift: task.shift,
                    status: 'NOT_STARTED',
                    target_items: task.targetItems || 0
                });

                if (error) throw error;
                return { success: true };
            } catch (e) {
                return { success: false };
            }
        }
        return { success: false };
    }
};
