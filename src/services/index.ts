/**
 * Services barrel export
 * 
 * Import services from here instead of individual files
 */

// Auth
export { AuthService } from './auth';
export type { LoginResult, RegisterResult } from './auth';

// Inventory
export { InventoryService } from './inventory';
export type { InventoryProduct, MasterItem } from './inventory';

// Expiry
export { ExpiryService } from './expiry';
export type { ExpiryProduct } from './expiry';

// Dashboard
export { DashboardService } from './dashboard';
export type { DashboardStats, TaskItem } from './dashboard';

// Recovery
export { RecoveryService } from './recovery';
export type { RecoveryItem, ScannedItem } from './recovery';
