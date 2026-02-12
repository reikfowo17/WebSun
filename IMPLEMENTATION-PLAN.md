# IMPLEMENTATION PLAN: HOÀN THIỆN TIẾN TRÌNH & TRUY THU

**Date**: 2026-02-10  
**Objective**: Hoàn thiện frontend, backend, và database cho 2 modules: TIẾN TRÌNH và TRUY THU

---

## 📚 SKILLS SỬ DỤNG

### Core Skills:
- ✅ `database-design` - Schema design, indexing, RLS
- ✅ `postgres-best-practices` - RLS, performance, security
- ✅ `react-best-practices` - Component design, performance
- ✅ `ui-ux-designer` - Professional UI/UX
- ✅ `api-patterns` - RESTful API design
- ✅ `architect-review` - System design review

---

## 🎯 MODULE 1: TIẾN TRÌNH (Progress Monitoring)

### Current Status:
- ✅ OverviewTab - Stats & store cards
- ✅ ReviewsView - Report listing with store filter
- ⚠️ Missing: Detailed progress tracking, analytics

### Improvements Needed:

#### 1.1 Frontend Enhancements

**OverviewTab**:
- [ ] Add real-time progress indicators
- [ ] Add trend charts (Chart.js or Recharts)
- [ ] Add filtering by date range
- [ ] Add export functionality (CSV/Excel)
- [ ] Implement skeleton loading (current: basic)
- [ ] Add tooltips with detailed stats

**ReviewsView**:
- [ ] Add report detail modal
- [ ] Add bulk approval/rejection
- [ ] Add comment system for feedback
- [ ] Add history timeline
- [ ] Add search/filters (by user, status, date)
- [ ] Add pagination (currently showing all)

**New: AnalyticsView**:
- [ ] Daily/Weekly/Monthly charts
- [ ] Store comparison metrics
- [ ] Top performers leaderboard
- [ ] Completion rate trends

#### 1.2 Backend Enhancements

**API Endpoints to Add**:
```typescript
// Get progress analytics
GET /api/inventory/progress/analytics?period=week&storeId=xxx

// Get report history
GET /api/inventory/reports/:id/history

// Bulk operations
POST /api/inventory/reports/bulk-approve
POST /api/inventory/reports/bulk-reject

// Comments
POST /api/inventory/reports/:id/comments
GET /api/inventory/reports/:id/comments
```

**Service Functions**:
- [ ] `getProgressAnalytics()` - with date grouping
- [ ] `getReportHistory()` - audit trail
- [ ] `bulkApproveReports()` - batch operations
- [ ] `addReportComment()` - feedback system

#### 1.3 Database Schema

**New Tables**:
```sql
-- Report comments/feedback
CREATE TABLE inventory_report_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID REFERENCES inventory_reports(id),
  user_id UUID REFERENCES users(id),
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Report audit trail
CREATE TABLE inventory_report_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID REFERENCES inventory_reports(id),
  changed_by UUID REFERENCES users(id),
  previous_status VARCHAR(50),
  new_status VARCHAR(50),
  changed_at TIMESTAMPTZ DEFAULT now()
);
```

**Indexes**:
```sql
CREATE INDEX idx_report_comments_report_id ON inventory_report_comments(report_id);
CREATE INDEX idx_report_history_report_id ON inventory_report_history(report_id);
CREATE INDEX idx_reports_created_at ON inventory_reports(created_at);
CREATE INDEX idx_reports_store_status ON inventory_reports(store_id, status);
```

**RLS Policies**:
```sql
-- Comments: User can add/view for reports they have access to
CREATE POLICY "report_comments_policy" ON inventory_report_comments
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM inventory_reports
    WHERE id = report_id
    AND ((SELECT is_admin()) OR store_id = (SELECT get_user_store_id()))
  )
);
```

---

## 🚨 MODULE 2: TRUY THU (Recovery Tracking)

### Current Status:
- ✅ RecoveryView exists
- ⚠️ Likely minimal/incomplete implementation

### Full Implementation Needed:

#### 2.1 Frontend Components

**RecoveryView**:
- [ ] Recovery items list (table)
- [ ] Add recovery item modal
- [ ] Recovery progress tracker
- [ ] Status workflow (PENDING → APPROVED → RECOVERED)
- [ ] Attach supporting documents/images
- [ ] Calculate total recovery amount
- [ ] Filter by store, status, date range

**RecoveryDetail Modal**:
- [ ] Item details
- [ ] Recovery history
- [ ] Approval workflow UI
- [ ] Document viewer
- [ ] Comments/notes section

#### 2.2 Backend Services

**API Endpoints**:
```typescript
// Recovery items CRUD
GET /api/inventory/recovery
POST /api/inventory/recovery
GET /api/inventory/recovery/:id
PUT /api/inventory/recovery/:id
DELETE /api/inventory/recovery/:id

// Recovery workflow
POST /api/inventory/recovery/:id/submit
POST /api/inventory/recovery/:id/approve
POST /api/inventory/recovery/:id/reject
POST /api/inventory/recovery/:id/complete

// Analytics
GET /api/inventory/recovery/stats
GET /api/inventory/recovery/summary
```

**Service Functions**:
```typescript
class RecoveryService {
  // CRUD
  async getRecoveryItems(filters: RecoveryFilters)
  async createRecoveryItem(data: RecoveryItemInput)
  async updateRecoveryItem(id: string, data: Partial<RecoveryItemInput>)
  async deleteRecoveryItem(id: string)
  
  // Workflow
  async submitForApproval(id: string)
  async approveRecovery(id: string, approvedBy: string)
  async rejectRecovery(id: string, reason: string)
  async markAsRecovered(id: string, recoveredAmount: number)
  
  // Analytics
  async getRecoveryStats(storeId?: string)
  async getRecoverySummary(period: 'week' | 'month')
}
```

#### 2.3 Database Schema

**Main Table**:
```sql
CREATE TYPE recovery_status AS ENUM (
  'PENDING',      -- Chờ phê duyệt
  'APPROVED',     -- Đã duyệt
  'IN_PROGRESS',  -- Đang thu
  'RECOVERED',    -- Đã thu xong
  'REJECTED',     -- Từ chối
  'CANCELLED'     -- Hủy bỏ
);

CREATE TABLE recovery_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id),
  product_id UUID REFERENCES products(id),
  
  -- Item details
  product_name VARCHAR(255) NOT NULL,
  barcode VARCHAR(100),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(12,2),
  total_amount DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  
  -- Recovery details
  reason TEXT NOT NULL,
  status recovery_status DEFAULT 'PENDING',
  created_by UUID NOT NULL REFERENCES users(id),
  submitted_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  recovered_amount DECIMAL(12,2),
  recovered_at TIMESTAMPTZ,
  
  -- Rejection
  rejected_by UUID REFERENCES users(id),
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Recovery documents/attachments
CREATE TABLE recovery_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recovery_id UUID NOT NULL REFERENCES recovery_items(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_type VARCHAR(50),
  uploaded_by UUID NOT NULL REFERENCES users(id),
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- Recovery history for audit
CREATE TABLE recovery_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recovery_id UUID NOT NULL REFERENCES recovery_items(id),
  changed_by UUID NOT NULL REFERENCES users(id),
  previous_status recovery_status,
  new_status recovery_status,
  notes TEXT,
  changed_at TIMESTAMPTZ DEFAULT now()
);
```

**Indexes**:
```sql
CREATE INDEX idx_recovery_store_id ON recovery_items(store_id);
CREATE INDEX idx_recovery_status ON recovery_items(status);
CREATE INDEX idx_recovery_created_by ON recovery_items(created_by);
CREATE INDEX idx_recovery_created_at ON recovery_items(created_at);
CREATE INDEX idx_recovery_store_status ON recovery_items(store_id, status);

CREATE INDEX idx_recovery_docs_recovery_id ON recovery_documents(recovery_id);
CREATE INDEX idx_recovery_history_recovery_id ON recovery_history(recovery_id);
```

**RLS Policies**:
```sql
-- Recovery items: Admin sees all, Employee sees own store
CREATE POLICY "recovery_items_select_policy"
ON recovery_items FOR SELECT TO authenticated
USING (
  (SELECT is_admin()) OR
  store_id = (SELECT get_user_store_id())
);

CREATE POLICY "recovery_items_insert_policy"
ON recovery_items FOR INSERT TO authenticated
WITH CHECK (
  (SELECT is_admin()) OR
  store_id = (SELECT get_user_store_id())
);

CREATE POLICY "recovery_items_update_policy"
ON recovery_items FOR UPDATE TO authenticated
USING (
  (SELECT is_admin()) OR
  (store_id = (SELECT get_user_store_id()) AND created_by = auth.uid())
)
WITH CHECK (
  (SELECT is_admin()) OR
  (store_id = (SELECT get_user_store_id()) AND created_by = auth.uid())
);

-- Only admin can delete
CREATE POLICY "recovery_items_delete_policy"
ON recovery_items FOR DELETE TO authenticated
USING ((SELECT is_admin()));
```

**Triggers**:
```sql
-- Auto-update updated_at
CREATE TRIGGER update_recovery_items_updated_at
BEFORE UPDATE ON recovery_items
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Auto-log status changes to history
CREATE OR REPLACE FUNCTION log_recovery_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO recovery_history (recovery_id, changed_by, previous_status, new_status)
    VALUES (NEW.id, auth.uid(), OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER recovery_status_change_trigger
AFTER UPDATE OF status ON recovery_items
FOR EACH ROW
EXECUTE FUNCTION log_recovery_status_change();
```

---

## 📊 MATERIALIZED VIEWS

### Progress Analytics View:
```sql
CREATE MATERIALIZED VIEW recovery_stats AS
SELECT
  store_id,
  status,
  COUNT(*) as item_count,
  SUM(total_amount) as total_amount,
  AVG(total_amount) as avg_amount,
  DATE_TRUNC('day', created_at) as date
FROM recovery_items
GROUP BY store_id, status, DATE_TRUNC('day', created_at);

CREATE INDEX idx_recovery_stats_store ON recovery_stats(store_id);
CREATE INDEX idx_recovery_stats_date ON recovery_stats(date);

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_recovery_stats()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY recovery_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 🎨 UI/UX GUIDELINES (from ui-ux-designer skill)

### Design Principles:
1. **Consistency**: Use existing component patterns
2. **Accessibility**: WCAG 2.1 AA compliance
3. **Responsive**: Mobile-first approach
4. **Performance**: Lazy loading, code splitting
5. **Feedback**: Toast notifications, loading states

### Component Standards:
- Tables: Sortable, filterable, paginated
- Forms: Validation, error handling, auto-save
- Modals: Keyboard navigation, focus management
- Charts: Interactive, responsive, colorblind-friendly

---

## 🚀 IMPLEMENTATION PHASES

### Phase 1: Database (Day 1)
- [ ] Create recovery tables
- [ ] Create recovery RLS policies
- [ ] Create indexes
- [ ] Create triggers
- [ ] Create materialized views
- [ ] Test all policies with admin/employee roles

### Phase 2: Backend Services (Day 2)
- [ ] Implement RecoveryService
- [ ] Implement recovery API endpoints
- [ ] Add recovery analytics endpoints
- [ ] Enhance progress analytics in InventoryService
- [ ] Add comprehensive error handling
- [ ] Add input validation

### Phase 3: Frontend - Recovery (Day 3)
- [ ] Build RecoveryView component
- [ ] Build AddRecoveryModal
- [ ] Build RecoveryDetailModal
- [ ] Implement status workflow UI
- [ ] Add file upload for documents
- [ ] Add comments/notes section

### Phase 4: Frontend - Progress (Day 4)
- [ ] Enhance OverviewTab with charts
- [ ] Enhance ReviewsView with filters
- [ ] Build AnalyticsView
- [ ] Add export functionality
- [ ] Add real-time updates

### Phase 5: Polish & Testing (Day 5)
- [ ] Code review
- [ ] Performance optimization
- [ ] Accessibility audit
- [ ] Browser testing
- [ ] Mobile responsive check
- [ ] Documentation

---

## ✅ SUCCESS CRITERIA

### TIẾN TRÌNH Module:
- ✅ Real-time progress dashboard
- ✅ Detailed analytics with charts
- ✅ Report review workflow with comments
- ✅ Export to CSV/Excel
- ✅ Mobile responsive

### TRUY THU Module:
- ✅ Full CRUD for recovery items
- ✅ Approval workflow (4 states minimum)
- ✅ Document attachment support
- ✅ Recovery tracking & history
- ✅ Stats dashboard

### Database:
- ✅ Proper RLS multi-tenant isolation
- ✅ All indexes in place
- ✅ Triggers for audit trail
- ✅ Materialized views for performance

### Code Quality:
- ✅ TypeScript 0 errors
- ✅ React best practices
- ✅ Proper error handling
- ✅ Loading states everywhere
- ✅ Comprehensive logging

---

**NEXT STEP**: Bắt đầu với Phase 1 - Database schema?
