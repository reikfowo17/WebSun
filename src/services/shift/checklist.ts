// ===========================================================================
// CHECKLIST SERVICE (filter by day_of_week)
// ===========================================================================

import { supabase } from '../../lib/supabase';
import type {
    ChecklistTemplate, ChecklistResponse, ShiftType, DayOfWeek,
} from '../../types/shift';

export const ChecklistService = {
    /**
     * Get templates filtered by store, shift type, AND day of week
     * day_of_week = NULL means all days, otherwise filter by current day
     */
    async getTemplates(storeId?: string, shiftType?: ShiftType, dayOfWeek?: DayOfWeek): Promise<ChecklistTemplate[]> {
        let query = supabase
            .from('shift_checklist_templates')
            .select('*')
            .eq('is_active', true)
            .order('category')
            .order('sort_order');

        // store_ids NULL = all stores, or array contains this store
        if (storeId) {
            query = query.or(`store_ids.cs.{${storeId}},store_ids.is.null`);
        }
        // When no storeId filter, return all templates

        const { data } = await query;
        let templates = data || [];

        // Filter by shift_type
        if (shiftType) {
            templates = templates.filter(t => t.shift_types?.includes(shiftType));
        }

        // Filter by day of week
        // day_of_week = null → applies to ALL days
        // day_of_week = [2,4,6] → only applies on Mon/Wed/Fri
        if (dayOfWeek) {
            templates = templates.filter(t =>
                t.day_of_week === null || t.day_of_week?.includes(dayOfWeek)
            );
        }

        return templates;
    },

    async getResponses(shiftId: string): Promise<ChecklistResponse[]> {
        const { data } = await supabase
            .from('shift_checklist_responses')
            .select('*, template:shift_checklist_templates(*)')
            .eq('shift_id', shiftId);
        return data || [];
    },

    async initResponses(shiftId: string, templates: ChecklistTemplate[]): Promise<ChecklistResponse[]> {
        const inserts = templates.map(t => ({
            shift_id: shiftId,
            template_id: t.id,
            is_completed: false,
        }));

        if (inserts.length === 0) return [];

        const { data, error } = await supabase
            .from('shift_checklist_responses')
            .upsert(inserts, { onConflict: 'shift_id,template_id' })
            .select('*, template:shift_checklist_templates(*)');
        if (error) throw new Error(error.message);
        return data || [];
    },

    async toggleItem(responseId: string, completed: boolean, userId: string, note?: string, photoUrl?: string): Promise<ChecklistResponse> {
        const { data, error } = await supabase
            .from('shift_checklist_responses')
            .update({
                completed,
                completed_by: userId,
                completed_at: completed ? new Date().toISOString() : null,
                note: note || null,
                photo_url: photoUrl || null,
            })
            .eq('id', responseId)
            .select('*, template:shift_checklist_templates(*)')
            .single();
        if (error) throw new Error(error.message);
        return data;
    },

    // ─── Admin CRUD ───
    async createTemplate(template: Partial<ChecklistTemplate>): Promise<ChecklistTemplate> {
        const { data, error } = await supabase
            .from('shift_checklist_templates')
            .insert(template)
            .select()
            .single();
        if (error) throw new Error(error.message);
        return data;
    },

    async updateTemplate(id: string, updates: Partial<ChecklistTemplate>): Promise<ChecklistTemplate> {
        const { data, error } = await supabase
            .from('shift_checklist_templates')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw new Error(error.message);
        return data;
    },

    async deleteTemplate(id: string): Promise<void> {
        const { error } = await supabase
            .from('shift_checklist_templates')
            .delete()
            .eq('id', id);
        if (error) throw new Error(error.message);
    },
};
