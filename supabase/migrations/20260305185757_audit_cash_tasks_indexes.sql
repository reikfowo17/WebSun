-- Add GIN indexes for array columns in shift_checklist_templates to improve performance
CREATE INDEX IF NOT EXISTS idx_checklist_templates_shift_types ON public.shift_checklist_templates USING gin (shift_types);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_day_of_week ON public.shift_checklist_templates USING gin (day_of_week);
