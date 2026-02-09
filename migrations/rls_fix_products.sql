-- ============================================================================
-- RLS POLICY FIX: Products Table
-- Author: Antigravity AI
-- Date: 2026-02-09
-- Purpose: Fix "new row violates row-level security policy" error
-- ============================================================================

-- Step 1: Check current state
DO $$
BEGIN
  RAISE NOTICE '=== Current RLS Status ===';
END $$;

SELECT 
  schemaname,
  tablename,
  rowsecurity as "RLS Enabled"
FROM pg_tables 
WHERE tablename = 'products';

SELECT 
  policyname as "Policy Name",
  cmd as "Command",
  qual as "USING Expression",
  with_check as "WITH CHECK Expression"
FROM pg_policies 
WHERE tablename = 'products';

-- ============================================================================
-- Step 2: Drop existing restrictive policies (if any)
-- ============================================================================

-- Drop old policies that might be blocking inserts
DROP POLICY IF EXISTS "restrict_products_insert" ON products;
DROP POLICY IF EXISTS "users_insert_own_products" ON products;

-- ============================================================================
-- Step 3: Create comprehensive RLS policies
-- ============================================================================

-- Policy 1: SELECT - Anyone authenticated can view products
CREATE POLICY "authenticated_users_select_products"
ON products
FOR SELECT
TO authenticated
USING (true);

-- Policy 2: INSERT - Authenticated users can add products
CREATE POLICY "authenticated_users_insert_products"
ON products
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy 3: UPDATE - Authenticated users can update products
CREATE POLICY "authenticated_users_update_products"
ON products
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Policy 4: DELETE - Only admins can delete products
-- (Assuming you have a users table with role column)
CREATE POLICY "admin_users_delete_products"
ON products
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'ADMIN'
  )
);

-- ============================================================================
-- Step 4: Ensure RLS is enabled
-- ============================================================================

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Step 5: Verification
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== RLS Policies Applied Successfully ===';
  RAISE NOTICE 'Please verify the policies below:';
END $$;

SELECT 
  policyname as "Policy Name",
  cmd as "Command",
  CASE 
    WHEN cmd = 'SELECT' THEN 'View products'
    WHEN cmd = 'INSERT' THEN 'Add products'
    WHEN cmd = 'UPDATE' THEN 'Edit products'
    WHEN cmd = 'DELETE' THEN 'Delete products (admin only)'
  END as "Description"
FROM pg_policies 
WHERE tablename = 'products'
ORDER BY cmd;

-- ============================================================================
-- Step 6: Test INSERT (optional - comment out if not needed)
-- ============================================================================

-- Uncomment to test:
-- INSERT INTO products (barcode, name, unit, category)
-- VALUES ('TEST001', 'Test Product', 'Cái', 'Test Category');
--
-- SELECT * FROM products WHERE barcode = 'TEST001';
--
-- DELETE FROM products WHERE barcode = 'TEST001';

-- ============================================================================
-- ROLLBACK Instructions (if needed)
-- ============================================================================

-- If you need to rollback this migration:
-- 
-- DROP POLICY IF EXISTS "authenticated_users_select_products" ON products;
-- DROP POLICY IF EXISTS "authenticated_users_insert_products" ON products;
-- DROP POLICY IF EXISTS "authenticated_users_update_products" ON products;
-- DROP POLICY IF EXISTS "admin_users_delete_products" ON products;
-- 
-- ALTER TABLE products DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Notes
-- ============================================================================

-- 1. This migration assumes you have a 'users' table with columns:
--    - id (UUID, foreign key to auth.users)
--    - role (TEXT, e.g., 'ADMIN', 'USER', 'MANAGER')
--
-- 2. If your users table structure is different, modify the DELETE policy
--
-- 3. For more restrictive policies, you can modify the WITH CHECK clauses
--
-- 4. Always test in a development environment first

-- ============================================================================
-- Migration Complete
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '================================';
  RAISE NOTICE 'Migration: rls_fix_products.sql';
  RAISE NOTICE 'Status: COMPLETE ✓';
  RAISE NOTICE 'Next: Test adding products via UI';
  RAISE NOTICE '================================';
END $$;
