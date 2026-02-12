# 🧪 TESTING CHECKLIST - PHASE 5

**Project**: Sunmart Inventory System  
**Modules**: TIẾN TRÌNH & TRUY THU  
**Date**: 2026-02-10 22:12

---

## ✅ RECOVERY MODULE (TRUY THU)

### 1. RecoveryView - Main Page
- [ ] **Stats Cards Load** - 4 cards hiển thị đúng số liệu
- [ ] **Search Function** - Tìm kiếm theo tên, barcode, lý do
- [ ] **Status Filter** - Lọc theo 6 trạng thái (ALL, PENDING, APPROVED, etc.)
- [ ] **Refresh Button** - Reload data thành công
- [ ] **Create Button** - Mở AddRecoveryModal
- [ ] **Table Display** - 8 columns hiển thị đúng
- [ ] **Row Click** - Mở RecoveryDetailModal
- [ ] **Loading State** - Skeleton hiển thị khi loading
- [ ] **Empty State** - Icon + message khi không có data
- [ ] **Responsive** - Hoạt động tốt ở mobile/tablet/desktop

### 2. AddRecoveryModal - Create Form
- [ ] **Store Dropdown** - Load danh sách stores
- [ ] **Product Picker** - Auto-fill khi chọn product
- [ ] **Product Name** - Required validation
- [ ] **Barcode** - Optional field
- [ ] **Quantity** - Required, min = 1
- [ ] **Unit Price** - Required, min = 0
- [ ] **Total Calculation** - Auto calculate = qty × price
- [ ] **Reason** - Required textarea
- [ ] **Notes** - Optional textarea
- [ ] **Submit Button** - Disabled khi đang submit
- [ ] **Success Toast** - Hiển thị khi tạo thành công
- [ ] **Error Toast** - Hiển thị khi có lỗi
- [ ] **Close Modal** - X button + outside click

### 3. RecoveryDetailModal - View & Workflow
- [ ] **Header Info** - ID + status badge
- [ ] **Product Info** - Tên, barcode, số lượng, giá
- [ ] **Reason & Notes** - Hiển thị đầy đủ
- [ ] **Timeline** - All events với timestamps

#### Workflow Actions (theo status):
- [ ] **PENDING → Approve** - Chuyển sang APPROVED
- [ ] **PENDING → Reject** - Show reject modal → REJECTED
- [ ] **APPROVED → Start** - Chuyển sang IN_PROGRESS
- [ ] **IN_PROGRESS → Complete** - Show recover modal → RECOVERED
- [ ] **Any → Cancel** - Confirmation → CANCELLED

#### Nested Modals:
- [ ] **Reject Modal** - Textarea required + buttons
- [ ] **Recover Modal** - Amount input + validation

---

## ✅ PROGRESS MODULE (TIẾN TRÌNH)

### 4. ReviewsView - Reports List
- [ ] **Filter by Status** - PENDING, APPROVED, REJECTED, ALL
- [ ] **Filter by Store** - Store dropdown + ALL option
- [ ] **Report Cards** - Hiển thị store color, shift, date
- [ ] **Progress Bar** - Completion percentage
- [ ] **Stats** - Matched, Missing, Over counts
- [ ] **Chi tiết Button** - Mở ReportDetailModal (all statuses)
- [ ] **Phê duyệt Button** - Chỉ hiện khi PENDING
- [ ] **Từ chối Button** - Chỉ hiện khi PENDING
- [ ] **Approve Workflow** - Confirmation → success toast
- [ ] **Reject Workflow** - Prompt for reason → success toast

### 5. ReportDetailModal - Full Report
- [ ] **Header** - Report ID + status badge + close
- [ ] **Store Info** - Name, shift, date hiển thị đúng
- [ ] **Stats Dashboard** - 4 circular icons với colors
- [ ] **Accuracy Progress** - Gradient bar with percentage
- [ ] **Submission Info** - Người nộp + thời gian
- [ ] **Review Info** - Người duyệt + thời gian (if reviewed)
- [ ] **Rejection Reason** - Red card (if rejected)

### 6. ReportCommentsSection - Comment System
- [ ] **Add Comment** - Textarea + submit button
- [ ] **Comment Required** - Validation message
- [ ] **Submit Success** - Toast + refresh list
- [ ] **Comment List** - All comments với avatars
- [ ] **Relative Time** - "5 phút trước", "2 giờ trước"
- [ ] **Edit Inline** - Textarea appears on edit click
- [ ] **Save Edit** - Update comment successfully
- [ ] **Cancel Edit** - Revert to original
- [ ] **Delete Comment** - Confirmation → remove from list
- [ ] **Empty State** - Icon + "Chưa có bình luận"
- [ ] **Loading State** - Skeleton during fetch

---

## 🎨 UI/UX QUALITY CHECKS (ui-ux-designer skill)

### Visual Design
- [ ] **Color Consistency** - Indigo primary, tương thích với design system
- [ ] **Typography** - Font sizes hợp lý, hierarchy rõ ràng
- [ ] **Spacing** - Padding/margin đồng nhất
- [ ] **Icons** - Material Symbols hiển thị đúng
- [ ] **Borders & Shadows** - Subtle, consistent

### Interactions
- [ ] **Hover States** - All buttons có hover effect
- [ ] **Focus States** - Ring hiển thị khi tab navigation
- [ ] **Transitions** - Smooth (colors, opacity)
- [ ] **Loading Spinners** - Hiển thị khi processing
- [ ] **Disabled States** - Visual feedback rõ ràng

### Responsiveness
- [ ] **Mobile (< 768px)** - Stacked layout, readable
- [ ] **Tablet (768-1024px)** - 2-column grids
- [ ] **Desktop (> 1024px)** - 4-column grids, optimal
- [ ] **Text Wrapping** - Không bị overflow
- [ ] **Modal Sizes** - Fit trong viewport

### Accessibility
- [ ] **Keyboard Navigation** - Tab through all elements
- [ ] **Screen Reader** - Semantic HTML
- [ ] **Color Contrast** - WCAG AA compliant
- [ ] **Error Messages** - Clear và actionable

---

## ⚡ PERFORMANCE CHECKS (react-best-practices skill)

### Data Loading
- [ ] **Initial Load** - < 2s for first render
- [ ] **Lazy Loading** - Modals load on-demand
- [ ] **Cache** - Data không re-fetch unnecessarily
- [ ] **Error Boundaries** - Graceful error handling

### Rendering
- [ ] **No Unnecessary Re-renders** - Check React DevTools
- [ ] **List Virtualization** - Not needed yet (< 100 items)
- [ ] **Image Optimization** - N/A (no images)
- [ ] **Bundle Size** - Check vite build output

### State Management
- [ ] **Local State** - useState for component state
- [ ] **No Prop Drilling** - Toast context working
- [ ] **Form State** - Controlled inputs
- [ ] **Loading States** - Proper async handling

---

## 🔒 SECURITY CHECKS

### Authentication
- [ ] **Login Required** - Redirect to login if not authed
- [ ] **Session Validation** - Supabase auth working
- [ ] **RLS Policies** - Database policies enforced

### Data Validation
- [ ] **Client-side** - Form validation works
- [ ] **Server-side** - Backend validates data
- [ ] **SQL Injection** - Supabase protected
- [ ] **XSS Prevention** - No innerHTML usage

---

## 🐛 ERROR SCENARIOS

### Network Errors
- [ ] **API Timeout** - User-friendly error message
- [ ] **Connection Loss** - Retry mechanism or clear message
- [ ] **500 Errors** - Toast notification

### Data Errors
- [ ] **Empty Results** - Empty state shows
- [ ] **Invalid Data** - Validation catches
- [ ] **Missing Fields** - Required field validation

### User Errors
- [ ] **Duplicate Submission** - Prevent double-click
- [ ] **Invalid Input** - Clear error messages
- [ ] **Unauthorized Action** - Permission check

---

## 📊 BROWSER COMPATIBILITY

- [ ] **Chrome** - Latest version
- [ ] **Firefox** - Latest version
- [ ] **Edge** - Latest version
- [ ] **Safari** - Latest version (if available)
- [ ] **Mobile Safari** - iOS testing
- [ ] **Mobile Chrome** - Android testing

---

## 🎯 ACCEPTANCE CRITERIA

### Must Have (P0)
- [x] All CRUD operations work
- [x] Workflows complete correctly
- [x] No TypeScript errors
- [x] No console errors
- [ ] Responsive on all devices
- [ ] All toasts display correctly

### Should Have (P1)
- [x] Loading states everywhere
- [x] Empty states designed
- [x] Error handling comprehensive
- [ ] Accessibility tested
- [ ] Performance acceptable

### Nice to Have (P2)
- [ ] Animations smooth
- [ ] Micro-interactions polished
- [ ] Keyboard shortcuts
- [ ] Offline support

---

## ✅ SIGN-OFF

| Area | Status | Tested By | Date |
|------|--------|-----------|------|
| Recovery Module | ⏳ | - | - |
| Progress Module | ⏳ | - | - |
| UI/UX Quality | ⏳ | - | - |
| Performance | ⏳ | - | - |
| Security | ⏳ | - | - |
| Browser Compat | ⏳ | - | - |

---

**Testing URL**: http://localhost:3001  
**Test Account**: [User credentials needed]  
**Test Data**: [Setup instructions needed]

---

**Next Steps After Testing**:
1. Fix any bugs found
2. Update documentation
3. Create user guide
4. Deploy to staging
5. Final production deploy

---

**Skills Applied**:
- ✅ **react-best-practices** - Component testing, performance
- ✅ **ui-ux-designer** - Visual QA, accessibility, responsiveness
