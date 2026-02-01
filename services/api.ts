/**
 * API Service for Sunmart Portal
 * Supports both Supabase (production) and Mock (development) modes
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';

// ============================================================================
// TYPES
// ============================================================================

export interface LoginResult {
  success: boolean;
  user?: {
    id: string;
    name: string;
    role: 'ADMIN' | 'EMPLOYEE';
    store: string | null;
    level: number;
    xp: number;
    avatar: string;
  };
  token?: string;
  error?: string;
}

export interface InventoryProduct {
  id: string;
  _row?: number;
  productName: string;
  pvn: string;
  barcode: string;
  systemStock: number;
  actualStock: number | null;
  diff: number;
  status: 'PENDING' | 'MATCHED' | 'MISSING' | 'OVER';
  note: string;
}

export interface ExpiryProduct {
  id: string;
  productName: string;
  barcode: string;
  quantity: number | null;
  mfgDate: string | null;
  expiryDate: string | null;
  status: string;
  note: string;
  daysLeft?: number;
}

export interface TaskItem {
  id: string;
  title: string;
  assignee: string;
  type: 'GENERAL' | 'AUDIT' | 'EXPIRY';
  target_items: number;
  completed_items: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
}

export interface DashboardStats {
  urgentItems: number;
  totalChecks: number;
  totalAudits: number;
}

// ============================================================================
// MOCK DATA (for development when Supabase is not configured)
// ============================================================================

const today = new Date();
const addDays = (days: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const MOCK_USERS: Record<string, any> = {
  'admin': { id: '1', name: 'Admin User', role: 'ADMIN', store: null, level: 10, xp: 5000 },
  'ADMIN001': { id: '1', name: 'Admin User', role: 'ADMIN', store: null, level: 10, xp: 5000 },
  'EMP001': { id: '2', name: 'Nguyễn Văn A', role: 'EMPLOYEE', store: 'BEE', level: 2, xp: 150 },
  'EMP002': { id: '3', name: 'Trần Thị B', role: 'EMPLOYEE', store: 'PLAZA', level: 3, xp: 450 },
};

let MOCK_INVENTORY: InventoryProduct[] = [
  { id: '1', productName: 'Coca Cola 330ml', pvn: 'SP001', barcode: '8930001', systemStock: 10, actualStock: null, diff: 0, status: 'PENDING', note: '' },
  { id: '2', productName: 'Pepsi 330ml', pvn: 'SP002', barcode: '8930002', systemStock: 5, actualStock: 5, diff: 0, status: 'MATCHED', note: '' },
  { id: '3', productName: 'Sting 330ml', pvn: 'SP003', barcode: '8930003', systemStock: 20, actualStock: null, diff: 0, status: 'PENDING', note: '' },
  { id: '4', productName: 'Nước suối Lavie 500ml', pvn: 'SP004', barcode: '8930004', systemStock: 15, actualStock: 12, diff: -3, status: 'MISSING', note: '' },
  { id: '5', productName: 'Bánh mì sandwich', pvn: 'SP005', barcode: '8930005', systemStock: 8, actualStock: null, diff: 0, status: 'PENDING', note: '' },
];

let MOCK_EXPIRY: ExpiryProduct[] = [
  { id: '1', productName: 'Sữa tươi TH True Milk', barcode: '8930101', quantity: 10, mfgDate: addDays(-10), expiryDate: addDays(2), status: 'Cận hạn', note: '' },
  { id: '2', productName: 'Yaourt Vinamilk', barcode: '8930102', quantity: 5, mfgDate: addDays(-15), expiryDate: addDays(-1), status: 'Hết hạn', note: 'Đã thu hồi' },
  { id: '3', productName: 'Phô mai con bò cười', barcode: '8930103', quantity: 20, mfgDate: addDays(-5), expiryDate: addDays(10), status: 'Còn hạn', note: '' },
  { id: '4', productName: 'Bơ thực vật', barcode: '8930104', quantity: 3, mfgDate: null, expiryDate: null, status: '', note: '' },
  { id: '5', productName: 'Xúc xích Vissan', barcode: '8930105', quantity: 8, mfgDate: addDays(-7), expiryDate: addDays(0), status: 'Cận hạn', note: 'Giảm giá' },
];

const MOCK_TASKS: TaskItem[] = [
  { id: '1', title: 'Kiểm tra tồn kho Ca 1', assignee: 'Nguyễn Văn A', type: 'AUDIT', target_items: 50, completed_items: 35, status: 'IN_PROGRESS' },
  { id: '2', title: 'Kiểm date tủ mát', assignee: 'Nguyễn Văn A', type: 'EXPIRY', target_items: 30, completed_items: 30, status: 'COMPLETED' },
  { id: '3', title: 'Vệ sinh kệ A', assignee: '', type: 'GENERAL', target_items: 1, completed_items: 0, status: 'PENDING' },
];

// ============================================================================
// AUTH SERVICE
// ============================================================================

export const AuthService = {
  /**
   * Login with username and password
   */
  async login(username: string, password: string): Promise<LoginResult> {
    // Check if Supabase is configured
    if (isSupabaseConfigured()) {
      try {
        const { data: user, error } = await supabase
          .from('users')
          .select('*')
          .eq('username', username)
          .single();

        if (error || !user) {
          return { success: false, error: 'Tên đăng nhập hoặc mật khẩu không đúng' };
        }

        // Verify password (direct comparison for now)
        if (user.password_hash !== password) {
          return { success: false, error: 'Tên đăng nhập hoặc mật khẩu không đúng' };
        }

        // Get store name
        let storeName: string | null = 'Chưa phân công';
        if (user.store_id) {
          const { data: store } = await supabase
            .from('stores')
            .select('name')
            .eq('id', user.store_id)
            .single();
          if (store) storeName = store.name;
        } else {
          storeName = null; // If no store_id, then store is null
        }

        const avatar = user.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}&backgroundColor=fbbf24`;

        return {
          success: true,
          user: {
            id: user.id,
            employeeId: user.employee_id, // Add employeeId to returned user object if needed in frontend
            username: user.username,
            name: user.name,
            role: user.role,
            store: storeName,
            level: user.level,
            xp: user.xp,
            avatar
          },
          token: `session-${Date.now()}`
        };
      } catch (e) {
        console.error('[Auth] Login error:', e);
        return { success: false, error: 'Lỗi kết nối server' };
      }
    }

    // Mock mode
    await new Promise(r => setTimeout(r, 500));
    // Simple mock check
    const mockUser = Object.values(MOCK_USERS).find(u => u.name === username || u.employeeId === username); // Fallback for mock

    if (!mockUser) {
      return { success: false, error: 'Tài khoản không tồn tại' };
    }

    return {
      success: true,
      user: {
        ...mockUser,
        username: username,
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(mockUser.name)}`
      },
      token: `mock-${Date.now()}`
    };
  },

  /**
   * Logout current user
   */
  async logout(): Promise<{ success: boolean }> {
    if (isSupabaseConfigured()) {
      await supabase.auth.signOut();
    }
    sessionStorage.clear();
    return { success: true };
  },

  /**
   * Get current logged in user from session
   */
  getCurrentUser() {
    const userData = sessionStorage.getItem('sunmart_user');
    if (userData) {
      try {
        return JSON.parse(userData);
      } catch {
        return null;
      }
    }
    return null;
  },

  /**
   * Register a new user
   */
  async register(data: {
    username: string;
    name: string;
    password: string;
    store?: string;
    role?: 'ADMIN' | 'EMPLOYEE';
  }): Promise<{ success: boolean; error?: string }> {
    if (isSupabaseConfigured()) {
      try {
        // Check if username already exists
        const { data: existing } = await supabase
          .from('users')
          .select('id')
          .eq('username', data.username)
          .single();

        if (existing) {
          return { success: false, error: 'Tên đăng nhập đã tồn tại' };
        }

        // Get store ID if provided
        let storeId = null;
        if (data.store) {
          const { data: store } = await supabase
            .from('stores')
            .select('id')
            .ilike('name', `%${data.store}%`) // Loose match for store name
            .single();

          if (store) storeId = store.id;
        }

        // Insert new user
        // Note: employee_id is now auto-generated by DB trigger
        const { error } = await supabase
          .from('users')
          .insert([{
            username: data.username,
            name: data.name,
            password_hash: data.password, // In production, hash this!
            role: data.role || 'EMPLOYEE',
            store_id: storeId,
            level: 1,
            xp: 0
          }])
          .select()
          .single();

        if (error) {
          console.error('Registration error:', error);
          return { success: false, error: 'Đăng ký thất bại: ' + error.message };
        }

        return { success: true };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    }

    // Mock mode
    await new Promise(r => setTimeout(r, 500));
    if (MOCK_USERS[data.username]) { // Using username as key for mock
      return { success: false, error: 'Tên đăng nhập đã tồn tại' };
    }
    // Add to mock (won't persist)
    return { success: true };
  }
};

// ============================================================================
// INVENTORY SERVICE
// ============================================================================

export const InventoryService = {
  /**
   * Get inventory items for a store and shift
   */
  async getItems(store: string, shift: number): Promise<{ success: boolean; products: InventoryProduct[] }> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('inventory_items')
          .select(`
            id,
            system_stock,
            actual_stock,
            diff,
            status,
            note,
            shift,
            products (
              id,
              name,
              pvn,
              barcode
            ),
            stores!inner (
              code
            )
          `)
          .eq('stores.code', store)
          .eq('shift', shift);

        if (error) throw error;

        const products: InventoryProduct[] = (data || []).map((item: any) => ({
          id: item.id,
          productName: item.products?.name || '',
          pvn: item.products?.pvn || '',
          barcode: item.products?.barcode || '',
          systemStock: item.system_stock || 0,
          actualStock: item.actual_stock,
          diff: item.diff || 0,
          status: item.status || 'PENDING',
          note: item.note || ''
        }));

        return { success: true, products };
      } catch (e) {
        console.error('[Inventory] Get items error:', e);
        return { success: false, products: [] };
      }
    }

    // Mock mode
    await new Promise(r => setTimeout(r, 500));
    return { success: true, products: [...MOCK_INVENTORY] };
  },

  /**
   * Update an inventory item
   */
  async updateItem(id: string, field: string, value: any, userId?: string): Promise<{ success: boolean }> {
    if (isSupabaseConfigured()) {
      try {
        const updateData: any = {
          [field]: value,
          updated_at: new Date().toISOString()
        };

        // Auto-calculate diff and status for stock changes
        if (field === 'actual_stock' && value !== null) {
          const { data: itemData } = await supabase
            .from('inventory_items')
            .select('system_stock')
            .eq('id', id)
            .single();

          const item = itemData as any;
          if (item) {
            const diff = Number(value) - (item.system_stock || 0);
            updateData.diff = diff;
            updateData.status = diff === 0 ? 'MATCHED' : (diff < 0 ? 'MISSING' : 'OVER');
            updateData.checked_by = userId;
            updateData.checked_at = new Date().toISOString();
          }
        }

        const { error } = await supabase
          .from('inventory_items')
          .update(updateData)
          .eq('id', id);

        if (error) throw error;
        return { success: true };
      } catch (e) {
        console.error('[Inventory] Update error:', e);
        return { success: false };
      }
    }

    // Mock mode
    await new Promise(r => setTimeout(r, 300));
    const item = MOCK_INVENTORY.find(p => p.id === id);
    if (item) {
      (item as any)[field] = value;
      if (field === 'actualStock' && value !== null) {
        item.diff = Number(value) - item.systemStock;
        item.status = item.diff === 0 ? 'MATCHED' : (item.diff < 0 ? 'MISSING' : 'OVER');
      }
    }
    return { success: true };
  },

  /**
   * Submit inventory report
   */
  async submitReport(storeCode: string, shift: number, userId: string): Promise<{ success: boolean; message?: string }> {
    if (isSupabaseConfigured()) {
      try {
        // 1. Get store ID
        const { data: store } = await supabase.from('stores').select('id').eq('code', storeCode).single();
        if (!store) throw new Error('Cửa hàng không tồn tại');

        // 2. Get current inventory items for this store/shift
        const { data: items, error: itemsError } = await supabase
          .from('inventory_items')
          .select('*')
          .eq('store_id', store.id)
          .eq('shift', shift);

        if (itemsError) throw itemsError;
        if (!items || items.length === 0) throw new Error('Không có dữ liệu kiểm kê');

        // 3. Create history records
        const checkDate = new Date().toISOString().split('T')[0];
        const historyItems = items.map((item: any) => ({
          store_id: store.id,
          product_id: item.product_id,
          shift: shift,
          check_date: checkDate,
          system_stock: item.system_stock,
          actual_stock: item.actual_stock,
          diff: item.diff,
          status: item.status,
          note: item.note,
          checked_by: userId
        }));

        const { error: histError } = await supabase
          .from('inventory_history')
          .insert(historyItems);

        if (histError) throw histError;

        return { success: true, message: `Đã lưu lịch sử kiểm kê (${items.length} SP)` };
      } catch (e: any) {
        console.error('[Inventory] Submit report error:', e);
        return { success: false, message: 'Lỗi: ' + e.message };
      }
    }

    // Mock
    await new Promise(r => setTimeout(r, 500));
    const checked = MOCK_INVENTORY.filter(p => p.actualStock !== null);
    const matched = checked.filter(p => p.status === 'MATCHED').length;
    return {
      success: true,
      message: `Đã nộp báo cáo: ${checked.length} sản phẩm (${matched} khớp)`
    };
  },

  /**
   * Get all master items (Admin)
   */
  async getMasterItems(): Promise<{ success: boolean; items: any[] }> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .order('name');

        if (error) throw error;
        return { success: true, items: data || [] };
      } catch (e) {
        console.error('[Inventory] Get master items error:', e);
        return { success: false, items: [] };
      }
    }
    await new Promise(r => setTimeout(r, 300));
    return { success: true, items: [] }; // Mock for now
  },

  /**
   * Add a new master item (Admin)
   */
  async addMasterItem(product: any): Promise<{ success: boolean; error?: string }> {
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase
          .from('products')
          .insert([product]);

        if (error) throw error;
        return { success: true };
      } catch (e) {
        console.error('[Inventory] Add master item error:', e);
        return { success: false, error: 'Không thể thêm sản phẩm' };
      }
    }
    return { success: true };
  },

  /**
   * Distribute master items to a store for checking (Admin)
   */
  async distributeToStore(storeCode: string, shift: number): Promise<{ success: boolean; message?: string }> {
    if (isSupabaseConfigured()) {
      try {
        const { data: store, error: storeError } = await supabase
          .from('stores')
          .select('id')
          .eq('code', storeCode)
          .single();

        if (storeError || !store) throw new Error('Cửa hàng không tồn tại');

        const { data: products, error: prodError } = await supabase
          .from('products')
          .select('id');

        if (prodError) throw prodError;
        if (!products || products.length === 0) throw new Error('Chưa có danh mục sản phẩm');

        const newItems = products.map(p => ({
          store_id: store.id,
          product_id: p.id,
          shift: shift,
          system_stock: 0,
          status: 'PENDING'
        }));

        const { error: insertError } = await supabase
          .from('inventory_items')
          .insert(newItems);

        if (insertError) {
          console.error(insertError);
          throw new Error('Lỗi phân bổ: ' + insertError.message);
        }

        return { success: true, message: `Đã phân bổ ${products.length} sản phẩm tới ${storeCode}` };
      } catch (e: any) {
        console.error('[Inventory] Distribute error:', e);
        return { success: false, message: e.message };
      }
    }
    await new Promise(r => setTimeout(r, 1000));
    return { success: true, message: `(Mock) Đã phân bổ tới ${storeCode}` };
  }
};

// ============================================================================
// RECOVERY SERVICE (TRUY THU)
// ============================================================================

export interface RecoveryItem {
  id: string;
  store_id: string;
  store_name?: string;
  product_id: string;
  product_name?: string;
  barcode?: string;
  check_date: string;
  missing_qty: number;
  unit_price: number;
  total_amount: number;
  reason: string;
  status: string; // 'TRUY THU', 'ĐÃ XỬ LÝ', 'CHỜ GIẢI TRÌNH'
  note: string;
  created_at: string;
}

export const RecoveryService = {
  /**
   * Scan history for discrepancies (missing items) in a given month/store
   */
  async scanForDiscrepancies(storeCode: string, monthStr: string): Promise<{ success: boolean; items: any[] }> {
    if (isSupabaseConfigured()) {
      try {
        // 1. Get store ID
        const { data: store } = await supabase.from('stores').select('id').eq('code', storeCode).single();
        if (!store) throw new Error('Cửa hàng không tồn tại');

        // 2. Calculate date range for the month
        const [year, month] = monthStr.split('-');
        const startDate = `${year}-${month}-01`;
        const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];

        // 3. Query inventory_history for negative diffs
        const { data: history, error } = await supabase
          .from('inventory_history')
          .select(`
            id,
            check_date,
            diff,
            product_id,
            products (
              name,
              barcode,
              price
            )
          `)
          .eq('store_id', store.id)
          .lt('diff', 0) // Only missing items
          .gte('check_date', startDate)
          .lte('check_date', endDate);

        if (error) throw error;

        // 4. Map to potential recovery items
        // Note: We might want to filter out ones that already have a recovery_item linked?
        // For now, simple map. User can filter in UI.
        const items = (history || []).map((h: any) => ({
          history_id: h.id, // Keep ref?
          product_id: h.product_id,
          product_name: h.products?.name,
          barcode: h.products?.barcode,
          check_date: h.check_date,
          missing_qty: Math.abs(h.diff),
          unit_price: h.products?.price || 0, // Assuming price exists on products, default 0
          total_amount: Math.abs(h.diff) * (h.products?.price || 0)
        }));

        return { success: true, items };
      } catch (e: any) {
        console.error('[Recovery] Scan error:', e);
        return { success: false, items: [] };
      }
    }

    // Mock
    await new Promise(r => setTimeout(r, 800));
    return {
      success: true,
      items: [
        { product_id: '1', product_name: 'Sting Dâu', barcode: '8930003', check_date: '2024-03-10', missing_qty: 2, unit_price: 10000, total_amount: 20000 },
        { product_id: '2', product_name: 'Nước Suối', barcode: '8930004', check_date: '2024-03-12', missing_qty: 5, unit_price: 5000, total_amount: 25000 }
      ]
    };
  },

  /**
   * Create recovery items from scanned list
   */
  async createRecoveryItems(storeCode: string, items: any[]): Promise<{ success: boolean; message?: string }> {
    if (isSupabaseConfigured()) {
      try {
        const { data: store } = await supabase.from('stores').select('id').eq('code', storeCode).single();
        if (!store) throw new Error('Cửa hàng không tồn tại');

        const toInsert = items.map(item => ({
          store_id: store.id,
          product_id: item.product_id,
          check_date: item.check_date,
          missing_qty: item.missing_qty,
          unit_price: item.unit_price,
          // total_amount is generated always usually, but let's see if we can insert it or let DB handle
          // Schema said: total_amount DECIMAL GENERATED ALWAYS AS (missing_qty * unit_price) STORED
          // So we should NOT insert total_amount.
          reason: '',
          status: 'TRUY THU'
        }));

        const { error } = await supabase
          .from('recovery_items')
          .insert(toInsert);

        if (error) throw error;
        return { success: true, message: `Đã tạo ${items.length} phiếu truy thu` };
      } catch (e: any) {
        console.error('[Recovery] Create error:', e);
        return { success: false, message: e.message };
      }
    }
    return { success: true, message: 'Mock Success' };
  },

  /**
   * Get existing recovery items
   */
  async getRecoveryItems(storeCode: string): Promise<{ success: boolean; items: RecoveryItem[] }> {
    if (isSupabaseConfigured()) {
      try {
        let query = supabase
          .from('recovery_items')
          .select(`
            id,
            store_id,
            product_id,
            check_date,
            missing_qty,
            unit_price,
            total_amount,
            reason,
            status,
            note,
            created_at,
            products (name, barcode),
            stores!inner (code, name)
          `)
          .order('check_date', { ascending: false });

        if (storeCode && storeCode !== 'ALL') {
          query = query.eq('stores.code', storeCode);
        }

        const { data, error } = await query;
        if (error) throw error;

        const items = (data || []).map((i: any) => ({
          id: i.id,
          store_id: i.store_id,
          store_name: i.stores?.name,
          product_id: i.product_id,
          product_name: i.products?.name,
          barcode: i.products?.barcode,
          check_date: i.check_date,
          missing_qty: i.missing_qty,
          unit_price: i.unit_price,
          total_amount: i.total_amount,
          reason: i.reason,
          status: i.status,
          note: i.note,
          created_at: i.created_at
        }));

        return { success: true, items };
      } catch (e) {
        console.error(e);
        return { success: false, items: [] };
      }
    }
    // Mock
    return { success: true, items: [] };
  },

  /**
   * Update recovery item status/reason
   */
  async updateRecoveryItem(id: string, updates: any): Promise<{ success: boolean }> {
    if (isSupabaseConfigured()) {
      const { error } = await supabase
        .from('recovery_items')
        .update(updates)
        .eq('id', id);
      return { success: !error };
    }
    return { success: true };
  }
};

// ============================================================================
// DASHBOARD SERVICE
// ============================================================================

export const ExpiryService = {
  /**
   * Calculate days left from expiry date
   */
  getDaysLeft(dateStr: string | null): number {
    if (!dateStr) return 9999;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = new Date(dateStr);
    return Math.ceil((expDate.getTime() - today.getTime()) / 86400000);
  },

  /**
   * Get expiry items for a store and type
   */
  async getItems(store: string, type: string): Promise<{ success: boolean; products: ExpiryProduct[] }> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('expiry_items')
          .select(`
            id,
            quantity,
            mfg_date,
            expiry_date,
            status,
            note,
            type,
            products (
              name,
              barcode
            ),
            stores!inner (
              code
            )
          `)
          .eq('stores.code', store)
          .eq('type', type);

        if (error) throw error;

        const products: ExpiryProduct[] = (data || []).map((item: any) => ({
          id: item.id,
          productName: item.products?.name || '',
          barcode: item.products?.barcode || '',
          quantity: item.quantity,
          mfgDate: item.mfg_date,
          expiryDate: item.expiry_date,
          status: item.status || '',
          note: item.note || '',
          daysLeft: this.getDaysLeft(item.expiry_date)
        }));

        return { success: true, products };
      } catch (e) {
        console.error('[Expiry] Get items error:', e);
        return { success: false, products: [] };
      }
    }

    // Mock mode
    await new Promise(r => setTimeout(r, 500));
    const products = MOCK_EXPIRY.map(p => ({
      ...p,
      daysLeft: this.getDaysLeft(p.expiryDate)
    }));
    return { success: true, products };
  },

  /**
   * Update an expiry item
   */
  async updateItem(id: string, field: string, value: any): Promise<{ success: boolean }> {
    if (isSupabaseConfigured()) {
      try {
        const updateData: any = {
          updated_at: new Date().toISOString()
        };

        // Map frontend field names to database columns
        const fieldMap: Record<string, string> = {
          mfgDate: 'mfg_date',
          expiryDate: 'expiry_date'
        };
        updateData[fieldMap[field] || field] = value;

        // Auto-calculate status for expiry date changes
        if (field === 'expiryDate' && value) {
          const daysLeft = this.getDaysLeft(value);
          if (daysLeft < 0) updateData.status = 'Hết hạn';
          else if (daysLeft <= 3) updateData.status = 'Cận hạn';
          else updateData.status = 'Còn hạn';
        }

        const { error } = await supabase
          .from('expiry_items')
          .update(updateData)
          .eq('id', id);

        if (error) throw error;
        return { success: true };
      } catch (e) {
        console.error('[Expiry] Update error:', e);
        return { success: false };
      }
    }

    // Mock mode
    await new Promise(r => setTimeout(r, 300));
    const item = MOCK_EXPIRY.find(p => p.id === id);
    if (item) {
      (item as any)[field] = value;
      if (field === 'expiryDate' && value) {
        const daysLeft = this.getDaysLeft(value);
        if (daysLeft < 0) item.status = 'Hết hạn';
        else if (daysLeft <= 3) item.status = 'Cận hạn';
        else item.status = 'Còn hạn';
      }
    }
    return { success: true };
  },

  /**
   * Submit expiry report
   */
  async submitReport(store: string, type: string, userId: string): Promise<{ success: boolean; message?: string }> {
    await new Promise(r => setTimeout(r, 500));

    const expired = MOCK_EXPIRY.filter(p => this.getDaysLeft(p.expiryDate) < 0).length;
    const warning = MOCK_EXPIRY.filter(p => {
      const d = this.getDaysLeft(p.expiryDate);
      return d >= 0 && d <= 3;
    }).length;

    return {
      success: true,
      message: `Đã nộp báo cáo: ${MOCK_EXPIRY.length} sản phẩm (${expired} hết hạn, ${warning} cận hạn)`
    };
  }
};

// ============================================================================
// DASHBOARD SERVICE
// ============================================================================

export const DashboardService = {
  /**
   * Get dashboard statistics
   */
  async getStats(): Promise<{ success: boolean; stats: DashboardStats }> {
    if (isSupabaseConfigured()) {
      try {
        // Get urgent expiry items (within 3 days)
        const { count: urgentItems } = await supabase
          .from('expiry_items')
          .select('*', { count: 'exact', head: true })
          .gte('expiry_date', new Date().toISOString().split('T')[0])
          .lte('expiry_date', addDays(3));

        // Get inventory stats
        const { count: totalAudits } = await supabase
          .from('inventory_items')
          .select('*', { count: 'exact', head: true });

        const { count: totalChecks } = await supabase
          .from('inventory_items')
          .select('*', { count: 'exact', head: true })
          .not('actual_stock', 'is', null);

        return {
          success: true,
          stats: {
            urgentItems: urgentItems || 0,
            totalChecks: totalChecks || 0,
            totalAudits: totalAudits || 0
          }
        };
      } catch (e) {
        console.error('[Dashboard] Get stats error:', e);
      }
    }

    // Mock mode
    await new Promise(r => setTimeout(r, 300));
    const urgentItems = MOCK_EXPIRY.filter(p => {
      const d = ExpiryService.getDaysLeft(p.expiryDate);
      return d >= 0 && d <= 3;
    }).length;

    return {
      success: true,
      stats: {
        urgentItems,
        totalChecks: MOCK_INVENTORY.filter(p => p.actualStock !== null).length,
        totalAudits: MOCK_INVENTORY.length
      }
    };
  },

  /**
   * Get tasks for a user
   */
  async getTasks(assignee?: string): Promise<{ success: boolean; tasks: TaskItem[] }> {
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
            users (
              name
            )
          `);

        if (assignee) {
          query = query.eq('users.name', assignee);
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
          status: t.status
        }));

        return { success: true, tasks };
      } catch (e) {
        console.error('[Dashboard] Get tasks error:', e);
      }
    }

    // Mock mode
    await new Promise(r => setTimeout(r, 300));
    let tasks = [...MOCK_TASKS];
    if (assignee) {
      tasks = tasks.filter(t => t.assignee === assignee);
    }
    return { success: true, tasks };
  }
};

// ============================================================================
// XP & ACHIEVEMENT SERVICE
// ============================================================================

export const XPService = {
  /**
   * Award XP to a user
   */
  async awardXP(userId: string, amount: number, reason?: string): Promise<{ success: boolean; newXp?: number; levelUp?: boolean }> {
    if (isSupabaseConfigured()) {
      try {
        // Get current XP and level
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('xp, level')
          .eq('id', userId)
          .single();

        if (userError || !userData) throw new Error('User not found');

        const user = userData as any;
        const currentXp = user.xp || 0;
        const currentLevel = user.level || 1;
        const newXp = currentXp + amount;

        // Calculate new level (500 XP per level)
        const xpPerLevel = 500;
        const newLevel = Math.floor(newXp / xpPerLevel) + 1;
        const levelUp = newLevel > currentLevel;

        // Update user
        const { error: updateError } = await supabase
          .from('users')
          .update({ xp: newXp, level: newLevel })
          .eq('id', userId);

        if (updateError) throw updateError;

        console.log(`[XP] Awarded ${amount} XP to user ${userId}. New total: ${newXp}, Level: ${newLevel}`);

        return { success: true, newXp, levelUp };
      } catch (e: any) {
        console.error('[XP] Award error:', e);
        return { success: false };
      }
    }

    // Mock mode
    return { success: true, newXp: 0, levelUp: false };
  },

  /**
   * Get user's XP and level info
   */
  async getUserStats(userId: string): Promise<{ xp: number; level: number; xpToNextLevel: number }> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('xp, level')
          .eq('id', userId)
          .single();

        if (error || !data) return { xp: 0, level: 1, xpToNextLevel: 500 };

        const user = data as any;
        const xpPerLevel = 500;
        const xpInCurrentLevel = user.xp % xpPerLevel;
        const xpToNextLevel = xpPerLevel - xpInCurrentLevel;

        return { xp: user.xp, level: user.level, xpToNextLevel };
      } catch (e) {
        return { xp: 0, level: 1, xpToNextLevel: 500 };
      }
    }

    return { xp: 0, level: 1, xpToNextLevel: 500 };
  }
};

export const AchievementService = {
  /**
   * Get all achievements (unlocked and locked)
   */
  async getAchievements(userId: string): Promise<any[]> {
    if (isSupabaseConfigured()) {
      try {
        // Get all achievements
        const { data: allAchievements } = await supabase
          .from('achievements')
          .select('*')
          .order('category', { ascending: true });

        // Get user's unlocked achievements
        const { data: userAchievements } = await supabase
          .from('user_achievements')
          .select('achievement_id, earned_at')
          .eq('user_id', userId);

        const userAchMap = new Map(
          (userAchievements || []).map((ua: any) => [ua.achievement_id, ua.earned_at])
        );

        return (allAchievements || []).map((a: any) => ({
          ...a,
          unlocked: userAchMap.has(a.id),
          earned_at: userAchMap.get(a.id)
        }));
      } catch (e) {
        console.error('[Achievement] Get error:', e);
        return [];
      }
    }

    return [];
  },

  /**
   * Award an achievement to a user
   */
  async awardAchievement(userId: string, achievementCode: string): Promise<{ success: boolean; achievement?: any }> {
    if (isSupabaseConfigured()) {
      try {
        // Get achievement by code
        const { data: achievement, error: achError } = await supabase
          .from('achievements')
          .select('*')
          .eq('code', achievementCode)
          .single();

        if (achError || !achievement) throw new Error('Achievement not found');

        const ach = achievement as any;

        // Check if already earned
        const { data: existing } = await supabase
          .from('user_achievements')
          .select('id')
          .eq('user_id', userId)
          .eq('achievement_id', ach.id)
          .single();

        if (existing) {
          return { success: true, achievement: ach }; // Already has it
        }

        // Award the achievement
        const { error: insertError } = await supabase
          .from('user_achievements')
          .insert([{ user_id: userId, achievement_id: ach.id }] as any);

        if (insertError) throw insertError;

        // Award XP reward
        if (ach.xp_reward > 0) {
          await XPService.awardXP(userId, ach.xp_reward, `Achievement: ${ach.name}`);
        }

        console.log(`[Achievement] Awarded "${ach.name}" to user ${userId}`);

        return { success: true, achievement: ach };
      } catch (e: any) {
        console.error('[Achievement] Award error:', e);
        return { success: false };
      }
    }

    return { success: false };
  },

  /**
   * Check and update achievements for a user based on their activity
   */
  async checkAchievements(userId: string, category: string, count?: number): Promise<void> {
    if (!isSupabaseConfigured()) return;

    // Get relevant achievements for the category
    const { data: achievements } = await supabase
      .from('achievements')
      .select('*')
      .eq('category', category);

    if (!achievements) return;

    for (const ach of achievements) {
      const achievement = ach as any;
      // Check if user meets requirement
      if (achievement.requirement_type === 'count' && count && count >= achievement.requirement_value) {
        await this.awardAchievement(userId, achievement.code);
      }
    }
  }
};

// ============================================================================
// LEGACY API BRIDGE (for backward compatibility)
// ============================================================================

export const runBackend = async (action: string, params: any = {}): Promise<any> => {
  console.log(`[API] ${action}`, params);

  switch (action) {
    case 'login':
      return AuthService.login(params.username, params.password);
    case 'logout':
      return AuthService.logout();
    case 'getDashboardStats':
      return DashboardService.getStats();
    case 'getTasks':
      return DashboardService.getTasks(params.assignee);
    case 'getStoreData':
      return InventoryService.getItems(params.store, parseInt(params.shift) || 1);
    case 'updateStoreData':
      return InventoryService.updateItem(params.id || params.rowNum?.toString(), params.field, params.value, params.userId);
    case 'submitInventoryReport':
      return InventoryService.submitReport(params.store, params.shift, params.userId);
    case 'getStoreProducts':
      return ExpiryService.getItems(params.store, params.type);
    case 'updateStoreProduct':
      return ExpiryService.updateItem(params.id, params.field, params.value);
    case 'submitDateReport':
      return ExpiryService.submitReport(params.store, params.type, params.userId);
    default:
      console.warn(`[API] Unknown action: ${action}`);
      return { success: false, error: `Unknown action: ${action}` };
  }
};
