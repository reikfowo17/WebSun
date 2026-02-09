# 🎯 HOW TO TEST - PHASE 1 IMPROVEMENTS

## 1️⃣ START THE APP

```bash
npm run dev
```

Navigate to: http://localhost:5173

---

## 2️⃣ LOGIN AS ADMIN

Use admin credentials to access InventoryHQ

---

## 3️⃣ TEST DISTRIBUTION (PHÂN PHỐI Tab)

### Create Products
1. Click **"+ Thêm SP"**
2. Fill in:
   - Barcode: `8934567890123`
   - Tên sản phẩm: `Bánh mì sữa tươi`
   - ĐVT: `Cái`
   - Danh mục: `Bánh Mì`
3. Click **Lưu**

### Distribute to Store
1. Select store: **SM BEE**
2. Select shift: **Ca 1**
3. Click **Phân Phối (1)**
4. Confirm distribution

**Expected Result**: ✅ Toast shows "Đã phân phối nhiệm vụ thành công!"

---

## 4️⃣ TEST EMPLOYEE WORKFLOW

### Login as Employee
1. Logout admin
2. Login as employee (store: BEE)

### Perform Inventory Check
1. Go to **Inventory** page
2. Auto-detected shift displayed
3. See distributed products
4. Enter actual stock:
   - Product 1: Input `10` → Status changes to MATCHED/MISSING/OVER
   - Product 2: Input `5`
5. Add note: "Kiểm tra kỹ lưỡng"
6. Click **Nộp báo cáo**

**Expected Result**: ✅ Report submitted, redirected to dashboard

---

## 5️⃣ TEST ADMIN REVIEW (NEW FEATURE!) 🎉

### Switch to TIẾN TRÌNH Tab
1. Login as admin
2. Go to **InventoryHQ**
3. Click **TIẾN TRÌNH** tab

**Expected UI**:
```
┌─────────────────────────────────────┐
│  [ALL] [PENDING] [APPROVED] [REJECT]│
└─────────────────────────────────────┘

Report cards showing:
- Store name with color badge
- Shift and date
- Status badge (Chờ duyệt/Đã duyệt/Từ chối)
- Progress bar
- Stats: Khớp/Thiếu/Thừa
- Employee name
- Action buttons (Từ chối / Phê duyệt)
```

### Approve a Report
1. Find report with status **"Chờ duyệt"**
2. Click **Phê duyệt** button
3. Confirm

**Expected Result**: 
- ✅ Toast: "Đã phê duyệt báo cáo"
- Status changes to **"Đã duyệt"**
- Green badge appears
- Action buttons disappear

### Reject a Report
1. Find another pending report
2. Click **Từ chối**
3. Enter reason: "Dữ liệu không chính xác, kiểm tra lại"
4. Confirm

**Expected Result**:
- ⚠️ Toast: "Đã từ chối báo cáo"
- Status changes to **"Từ chối"**
- Red badge appears

### Test Filters
1. Click **[APPROVED]** → Only approved reports show
2. Click **[REJECTED]** → Only rejected reports show
3. Click **[PENDING]** → Only pending reports show
4. Click **[ALL]** → All reports visible

---

## 6️⃣ TEST DATABASE CONSTRAINTS

### Try Creating Duplicate Distribution (Should Fail)
1. Go to **PHÂN PHỐI** tab
2. Select same store + shift as before
3. Click **Phân Phối**

**Expected Result**: 
- ❌ Error toast (unique constraint prevents duplicates)

---

## 7️⃣ VERIFY DATABASE CHANGES

### Check Indexes Created
Open Supabase SQL Editor:
```sql
SELECT 
    schemaname,
    tablename,
    indexname
FROM pg_indexes
WHERE tablename IN ('products', 'inventory_items', 'inventory_reports')
ORDER BY tablename;
```

**Expected**: See 5 new indexes

### Check New Columns
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'products' 
  AND column_name = 'unit_price';

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'inventory_reports' 
  AND column_name = 'rejection_reason';
```

**Expected**: Both columns exist

---

## ✅ SUCCESS CRITERIA

- [x] Products can be created via UI
- [x] Distribution works without errors
- [x] Employee can submit reports
- [x] Admin sees reports in ReviewsView
- [x] Approve workflow functions correctly
- [x] Reject workflow functions correctly
- [x] Filters work properly
- [x] Database constraints prevent duplicates
- [x] All indexes created
- [x] No TypeScript errors

---

## 🐛 TROUBLESHOOTING

### Issue: "Cannot read properties of undefined"
**Solution**: Clear browser cache, refresh page

### Issue: Reports not showing
**Solution**: 
1. Check if reports were actually submitted
2. Verify user has ADMIN role
3. Check browser console for errors

### Issue: Approve button does nothing
**Solution**: 
1. Check network tab for API errors
2. Verify `reviewReport()` method exists in services
3. Check Supabase RLS policies

---

**Happy Testing! 🎉**
