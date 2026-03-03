// ===========================================================================
// SHIFT MANAGEMENT - SERVICE LAYER (v2 — fixed per Google Sheets analysis)
// ===========================================================================

import { supabase } from '../lib/supabase';
import type {
    Shift,
    ShiftType,
    ShiftStatus,
    CashSettlement,
    ChecklistTemplate,
    ChecklistResponse,
    ShiftAsset,
    ShiftAssetCheck,
    ShiftInventoryHandover,
    ShiftQuickReport,
    ShiftDashboardStats,
    HandoverProduct,
    DayOfWeek,
} from '../types/shift';

// ===========================================================================
// SHIFT SERVICE
// ===========================================================================

export const ShiftService = {
    async getTodayShift(storeId: string, shiftType: ShiftType): Promise<Shift | null> {
        const today = new Date().toLocaleDateString('en-CA');
        const { data } = await supabase
            .from('shifts')
            .select('*, started_by_user:users!shifts_started_by_fkey(name), store:stores!shifts_store_id_fkey(code, name)')
            .eq('store_id', storeId)
            .eq('shift_type', shiftType)
            .eq('shift_date', today)
            .maybeSingle();
        return data;
    },

    async startShift(storeId: string, shiftType: ShiftType, userId: string): Promise<Shift> {
        const today = new Date().toLocaleDateString('en-CA');
        const { data, error } = await supabase
            .from('shifts')
            .insert({
                store_id: storeId,
                shift_type: shiftType,
                shift_date: today,
                started_by: userId,
                status: 'OPEN' as ShiftStatus,
            })
            .select('*, started_by_user:users!shifts_started_by_fkey(name), store:stores!shifts_store_id_fkey(code, name)')
            .single();
        if (error) throw new Error(error.message);
        return data;
    },

    async endShift(shiftId: string, userId: string): Promise<Shift> {
        const { data, error } = await supabase
            .from('shifts')
            .update({
                status: 'COMPLETED' as ShiftStatus,
                ended_at: new Date().toISOString(),
                ended_by: userId,
                updated_at: new Date().toISOString(),
            })
            .eq('id', shiftId)
            .select()
            .single();
        if (error) throw new Error(error.message);
        return data;
    },

    async getShiftById(shiftId: string): Promise<Shift | null> {
        const { data } = await supabase
            .from('shifts')
            .select('*, started_by_user:users!shifts_started_by_fkey(name), store:stores!shifts_store_id_fkey(code, name)')
            .eq('id', shiftId)
            .maybeSingle();
        return data;
    },

    async listShifts(filters: {
        storeId?: string;
        startDate?: string;
        endDate?: string;
        shiftType?: ShiftType;
        status?: ShiftStatus;
        userId?: string;
        limit?: number;
    } = {}): Promise<Shift[]> {
        let query = supabase
            .from('shifts')
            .select('*, started_by_user:users!shifts_started_by_fkey(name), store:stores!shifts_store_id_fkey(code, name)')
            .order('shift_date', { ascending: false })
            .order('created_at', { ascending: false });

        if (filters.storeId) query = query.eq('store_id', filters.storeId);
        if (filters.startDate) query = query.gte('shift_date', filters.startDate);
        if (filters.endDate) query = query.lte('shift_date', filters.endDate);
        if (filters.shiftType) query = query.eq('shift_type', filters.shiftType);
        if (filters.status) query = query.eq('status', filters.status);
        if (filters.userId) query = query.eq('started_by', filters.userId);
        if (filters.limit) query = query.limit(filters.limit);

        const { data } = await query;
        return data || [];
    },

    async getDashboardStats(storeId?: string, startDate?: string, endDate?: string): Promise<ShiftDashboardStats> {
        let query = supabase.from('shifts').select(`
            id,
            cash_settlements(difference, cash_end_actual, revenue_before_midnight, revenue_after_midnight)
        `);

        if (storeId) query = query.eq('store_id', storeId);
        if (startDate) query = query.gte('shift_date', startDate);
        if (endDate) query = query.lte('shift_date', endDate);

        const { data } = await query;
        const shifts = data || [];

        let totalRevenue = 0;
        let totalDifference = 0;
        let shiftsWithDiff = 0;

        for (const s of shifts) {
            const cs = (s as any).cash_settlements?.[0];
            if (cs) {
                totalRevenue += (cs.revenue_before_midnight || 0) + (cs.revenue_after_midnight || 0);
                totalDifference += Math.abs(cs.difference || 0);
                if (cs.difference && cs.difference !== 0) shiftsWithDiff++;
            }
        }

        return {
            total_shifts: shifts.length,
            total_revenue: totalRevenue,
            total_difference: totalDifference,
            shifts_with_difference: shiftsWithDiff,
            avg_checklist_completion: 0,
        };
    },
};

// ===========================================================================
// CASH SETTLEMENT SERVICE
// ===========================================================================

export const CashService = {
    async getByShift(shiftId: string): Promise<CashSettlement | null> {
        const { data } = await supabase
            .from('cash_settlements')
            .select('*')
            .eq('shift_id', shiftId)
            .maybeSingle();
        return data;
    },

    /** Auto-save: upsert entire settlement + per-item notes */
    async upsert(shiftId: string, settlement: Partial<CashSettlement>): Promise<CashSettlement> {
        // Remove generated/computed columns before saving
        const { total_counted, cash_end_expected, difference, id, created_at, updated_at, ...cleanData } = settlement as any;

        const { data, error } = await supabase
            .from('cash_settlements')
            .upsert(
                { ...cleanData, shift_id: shiftId, updated_at: new Date().toISOString() },
                { onConflict: 'shift_id' }
            )
            .select()
            .single();
        if (error) throw new Error(error.message);
        return data;
    },

    async submit(shiftId: string): Promise<CashSettlement> {
        const { data, error } = await supabase
            .from('cash_settlements')
            .update({
                status: 'SUBMITTED',
                submitted_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('shift_id', shiftId)
            .select()
            .single();
        if (error) throw new Error(error.message);
        return data;
    },

    async approve(settlementId: string, adminId: string): Promise<CashSettlement> {
        const { data, error } = await supabase
            .from('cash_settlements')
            .update({
                status: 'APPROVED',
                approved_by: adminId,
                approved_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', settlementId)
            .select()
            .single();
        if (error) throw new Error(error.message);
        return data;
    },
};

// ===========================================================================
// CHECKLIST SERVICE (FIX: filter by day_of_week)
// ===========================================================================

export const ChecklistService = {
    /**
     * Get templates filtered by store, shift type, AND day of week
     * FIX: day_of_week = NULL means all days, otherwise filter by current day
     */
    async getTemplates(storeId?: string, shiftType?: ShiftType, dayOfWeek?: DayOfWeek): Promise<ChecklistTemplate[]> {
        let query = supabase
            .from('shift_checklist_templates')
            .select('*')
            .eq('is_active', true)
            .order('category')
            .order('sort_order');

        if (storeId) {
            query = query.or(`store_id.eq.${storeId},store_id.is.null`);
        } else {
            query = query.is('store_id', null);
        }

        const { data } = await query;
        let templates = data || [];

        // Filter by shift_type
        if (shiftType) {
            templates = templates.filter(t => t.shift_types?.includes(shiftType));
        }

        // FIX: Filter by day of week
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
        // FIX: Only create responses for actionable items (NOT for "NOTE" category)
        const actionableTemplates = templates.filter(t => t.category !== 'NOTE');
        const inserts = actionableTemplates.map(t => ({
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
                is_completed: completed,
                completed_at: completed ? new Date().toISOString() : null,
                completed_by: completed ? userId : null,
                note: note || null,
                photo_url: photoUrl || null,
                updated_at: new Date().toISOString(),
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

// ===========================================================================
// ASSET SERVICE
// ===========================================================================

export const AssetService = {
    async getAssets(storeId?: string): Promise<ShiftAsset[]> {
        let query = supabase
            .from('shift_assets')
            .select('*')
            .eq('is_active', true)
            .order('sort_order');

        if (storeId) {
            query = query.or(`store_id.eq.${storeId},store_id.is.null`);
        } else {
            query = query.is('store_id', null);
        }

        const { data } = await query;
        return data || [];
    },

    async getChecks(shiftId: string): Promise<ShiftAssetCheck[]> {
        const { data } = await supabase
            .from('shift_asset_checks')
            .select('*, asset:shift_assets(*)')
            .eq('shift_id', shiftId);
        return data || [];
    },

    async upsertCheck(shiftId: string, assetId: string, okCount: number, damagedCount: number, userId: string, note?: string): Promise<ShiftAssetCheck> {
        const { data, error } = await supabase
            .from('shift_asset_checks')
            .upsert(
                {
                    shift_id: shiftId,
                    asset_id: assetId,
                    ok_count: okCount,
                    damaged_count: damagedCount,
                    checked_by: userId,
                    checked_at: new Date().toISOString(),
                    note: note || null,
                },
                { onConflict: 'shift_id,asset_id' }
            )
            .select('*, asset:shift_assets(*)')
            .single();
        if (error) throw new Error(error.message);
        return data;
    },

    async initChecks(shiftId: string, assets: ShiftAsset[], userId: string): Promise<ShiftAssetCheck[]> {
        const inserts = assets.map(a => ({
            shift_id: shiftId,
            asset_id: a.id,
            ok_count: a.expected_ok,
            damaged_count: 0,
            checked_by: userId,
        }));

        const { data, error } = await supabase
            .from('shift_asset_checks')
            .upsert(inserts, { onConflict: 'shift_id,asset_id' })
            .select('*, asset:shift_assets(*)');
        if (error) throw new Error(error.message);
        return data || [];
    },

    async createAsset(asset: Partial<ShiftAsset>): Promise<ShiftAsset> {
        const { data, error } = await supabase
            .from('shift_assets')
            .insert(asset)
            .select()
            .single();
        if (error) throw new Error(error.message);
        return data;
    },

    async updateAsset(id: string, updates: Partial<ShiftAsset>): Promise<ShiftAsset> {
        const { data, error } = await supabase
            .from('shift_assets')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw new Error(error.message);
        return data;
    },
};

// ===========================================================================
// HANDOVER SERVICE (FIX: use admin-configured product templates)
// ===========================================================================

export const HandoverService = {
    /** Get admin-configured handover product templates */
    async getProductTemplates(storeId?: string): Promise<HandoverProduct[]> {
        let query = supabase
            .from('shift_handover_products')
            .select('*')
            .eq('is_active', true)
            .order('sort_order');

        if (storeId) {
            query = query.or(`store_id.eq.${storeId},store_id.is.null`);
        }

        const { data } = await query;
        return data || [];
    },

    /** Initialize handover items from templates for a new shift */
    async initFromTemplates(shiftId: string, templates: HandoverProduct[], userId: string): Promise<ShiftInventoryHandover[]> {
        const inserts = templates.map(t => ({
            shift_id: shiftId,
            product_template_id: t.id,
            product_name: t.product_name,
            barcode: t.barcode,
            system_qty: 0,
            actual_qty: 0,
            checked_by: userId,
            checked_at: new Date().toISOString(),
        }));

        if (inserts.length === 0) return [];

        const { data, error } = await supabase
            .from('shift_inventory_handover')
            .insert(inserts)
            .select();
        if (error) throw new Error(error.message);
        return data || [];
    },

    async getItems(shiftId: string): Promise<ShiftInventoryHandover[]> {
        const { data } = await supabase
            .from('shift_inventory_handover')
            .select('*')
            .eq('shift_id', shiftId)
            .order('created_at');
        return data || [];
    },

    /** Update qty for a handover item (employee fills in actual/system qty) */
    async updateItem(id: string, updates: Partial<ShiftInventoryHandover>): Promise<ShiftInventoryHandover> {
        const { difference, ...cleanUpdates } = updates as any;
        const { data, error } = await supabase
            .from('shift_inventory_handover')
            .update(cleanUpdates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw new Error(error.message);
        return data;
    },

    async deleteItem(id: string): Promise<void> {
        const { error } = await supabase
            .from('shift_inventory_handover')
            .delete()
            .eq('id', id);
        if (error) throw new Error(error.message);
    },

    // ─── Admin: CRUD handover product templates ───
    async createProduct(product: Partial<HandoverProduct>): Promise<HandoverProduct> {
        const { data, error } = await supabase
            .from('shift_handover_products')
            .insert(product)
            .select()
            .single();
        if (error) throw new Error(error.message);
        return data;
    },

    async updateProduct(id: string, updates: Partial<HandoverProduct>): Promise<HandoverProduct> {
        const { data, error } = await supabase
            .from('shift_handover_products')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw new Error(error.message);
        return data;
    },

    async deleteProduct(id: string): Promise<void> {
        const { error } = await supabase
            .from('shift_handover_products')
            .delete()
            .eq('id', id);
        if (error) throw new Error(error.message);
    },
};

// ===========================================================================
// QUICK REPORT SERVICE
// ===========================================================================

export const QuickReportService = {
    async getReports(shiftId: string): Promise<ShiftQuickReport[]> {
        const { data } = await supabase
            .from('shift_quick_reports')
            .select('*')
            .eq('shift_id', shiftId)
            .order('created_at');
        return data || [];
    },

    async upsert(report: Partial<ShiftQuickReport>): Promise<ShiftQuickReport> {
        const { data, error } = await supabase
            .from('shift_quick_reports')
            .upsert(
                { ...report, updated_at: new Date().toISOString() },
                { onConflict: 'id' }
            )
            .select()
            .single();
        if (error) throw new Error(error.message);
        return data;
    },

    async deleteReport(id: string): Promise<void> {
        const { error } = await supabase
            .from('shift_quick_reports')
            .delete()
            .eq('id', id);
        if (error) throw new Error(error.message);
    },
};
