export interface User {
  id: string;
  name: string;
  role: 'ADMIN' | 'EMPLOYEE';
  store: string;
  level: number;
  xp: number;
  avatar: string;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  token?: string;
  expiryTime?: number;
  error?: string;
}

export interface Task {
  id: string;
  title: string;
  assignee: string;
  type: 'GENERAL' | 'AUDIT' | 'EXPIRY';
  target_items: number;
  completed_items: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
}

export interface Product {
  id?: string;
  sku?: string; // used in some legacy parts
  pvn?: string;
  barcode: string;
  name: string; // or productName
  product_name?: string;
  category?: string;
  system_stock?: number | string;
  actual_stock?: number | string;
  diff?: number;
  status?: string;
  note?: string;
  mfg_date?: string;
  expiry_date?: string;
}

export interface InventoryItem {
  id: string;
  _row: number;
  productName: string;
  pvn: string;
  barcode: string;
  systemStock: string | number;
  actualStock: string | number;
  diff: number;
  status: string;
  note: string;
}

export interface ExpiryItem {
  id: string;
  _row: number;
  productName: string;
  barcode: string;
  quantity: string | number;
  mfgDate: string;
  expiryDate: string;
  status: string;
  note: string;
  daysLeft?: number;
}

// Alias for inventory products used in Inventory page
export interface InventoryProduct {
  id: string | number;
  productName: string;
  barcode?: string;
  systemStock?: number | null;
  actualStock?: number | null;
  diff?: number | null;
  status: string;
  note?: string;
}
