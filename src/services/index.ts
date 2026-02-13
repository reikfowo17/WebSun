// Auth
export { AuthService } from './auth';
export type { LoginResult, RegisterResult } from './auth';

// Inventory
export { InventoryService, DIFF_REASON_OPTIONS } from './inventory';
export type { InventoryProduct, MasterItem, DiffReason } from './inventory';

// Expiry
export { ExpiryService } from './expiry';
export type { ExpiryProduct, ExpiryConfig, ExpiryReport } from './expiry';

// Dashboard
export { DashboardService } from './dashboard';
export type { DashboardStats, TaskItem } from './dashboard';

// Recovery
export { RecoveryService } from './recovery';
export type { RecoveryItem } from '../types/recovery';

// Tasks
export { TasksService } from './tasks';
export type { Task } from './tasks';
