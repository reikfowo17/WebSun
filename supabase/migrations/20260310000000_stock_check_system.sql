-- ═══════════════════════════════════════════════════════════════
-- Stock Check Category System
-- Cho phép admin tạo danh mục kiểm tồn cố định hằng đêm
-- ═══════════════════════════════════════════════════════════════

-- 1. Danh mục kiểm tồn (admin tạo/quản lý)
CREATE TABLE IF NOT EXISTS public.stock_check_categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    description TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    sort_order  INT NOT NULL DEFAULT 0,
    created_by  UUID REFERENCES public.users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Sản phẩm trong từng danh mục
CREATE TABLE IF NOT EXISTS public.stock_check_category_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES public.stock_check_categories(id) ON DELETE CASCADE,
    product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(category_id, product_id)
);

-- 3. Phiên kiểm (nhân viên bắt đầu kiểm 1 danh mục vào 1 ngày)
CREATE TABLE IF NOT EXISTS public.stock_check_sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES public.stock_check_categories(id),
    store_id    UUID NOT NULL REFERENCES public.stores(id),
    check_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    shift       INT NOT NULL DEFAULT 1 CHECK (shift BETWEEN 1 AND 3),
    status      TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS','COMPLETED','CANCELLED')),
    started_by  UUID REFERENCES public.users(id),
    completed_by UUID REFERENCES public.users(id),
    started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    note        TEXT,
    -- Snapshot nguồn (dùng để sync số liệu KiotViet)
    synced_at   TIMESTAMPTZ,
    UNIQUE(category_id, store_id, check_date, shift)
);

-- 4. Kết quả kiểm từng sản phẩm trong phiên
CREATE TABLE IF NOT EXISTS public.stock_check_results (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID NOT NULL REFERENCES public.stock_check_sessions(id) ON DELETE CASCADE,
    product_id  UUID NOT NULL REFERENCES public.products(id),
    system_qty  NUMERIC,          -- Số hệ thống (sync từ KiotViet / inventory_items)
    actual_qty  NUMERIC,          -- Số thực đếm bởi nhân viên
    diff        NUMERIC GENERATED ALWAYS AS (actual_qty - system_qty) STORED,
    note        TEXT,
    checked_at  TIMESTAMPTZ,
    UNIQUE(session_id, product_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scc_active ON public.stock_check_categories(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_scci_cat   ON public.stock_check_category_items(category_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_scs_date   ON public.stock_check_sessions(check_date, store_id);
CREATE INDEX IF NOT EXISTS idx_scs_cat    ON public.stock_check_sessions(category_id, check_date);
CREATE INDEX IF NOT EXISTS idx_scr_session ON public.stock_check_results(session_id);

-- RLS
ALTER TABLE public.stock_check_categories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_check_category_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_check_sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_check_results          ENABLE ROW LEVEL SECURITY;

-- Policies: tất cả authenticated users đều có thể đọc/ghi (giống pattern hiện tại)
CREATE POLICY "auth_all_stock_check_categories"
    ON public.stock_check_categories FOR ALL
    TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_all_stock_check_category_items"
    ON public.stock_check_category_items FOR ALL
    TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_all_stock_check_sessions"
    ON public.stock_check_sessions FOR ALL
    TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_all_stock_check_results"
    ON public.stock_check_results FOR ALL
    TO authenticated USING (true) WITH CHECK (true);

-- Updated_at trigger for categories
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_scc_updated_at ON public.stock_check_categories;
CREATE TRIGGER trg_scc_updated_at
    BEFORE UPDATE ON public.stock_check_categories
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
