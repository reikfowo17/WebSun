/**
 * Shared Types
 * 
 * Core types used throughout the application
 */

// ===========================================================================
// USER TYPES
// ===========================================================================

export interface User {
    id: string;
    name: string;
    username?: string;
    role: 'ADMIN' | 'EMPLOYEE';
    store: string;
    xp: number;
    level: number;
    avatar: string;  // For backward compatibility
    avatarUrl?: string;
}

// ===========================================================================
// TASK TYPES
// ===========================================================================

export interface Task {
    id: string;
    title: string;
    description?: string;
    type: 'INVENTORY' | 'EXPIRY' | 'RECOVERY' | 'OTHER' | 'AUDIT' | 'GENERAL';
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
    assignee: string;
    target_items: number;
    completed_items: number;
    dueDate?: string;
}

// ===========================================================================
// ACHIEVEMENT TYPES
// ===========================================================================

export interface Achievement {
    id: string;
    code: string;
    name: string;
    description: string;
    icon: string;
    color: string;
    category: string;
    xpReward: number;
    requirementType: string;
    requirementValue: number;
    unlocked?: boolean;
    earnedAt?: string;
}

// ===========================================================================
// STORE TYPES
// ===========================================================================

export interface Store {
    id: string;
    code: string;
    name: string;
    address?: string;
}

// ===========================================================================
// PRODUCT TYPES
// ===========================================================================

export interface Product {
    id: string;
    name: string;
    barcode: string;
    pvn?: string;
    category?: string;
    unit?: string;
    unitPrice?: number;
    expiryDays?: number;
}

// ===========================================================================
// INVENTORY TYPES
// ===========================================================================

export interface InventoryProduct {
    id: string | number;
    productName: string;
    barcode?: string;
    pvn?: string;
    systemStock?: number | null;
    actualStock?: number | null;
    diff?: number | null;
    status: string;
    note?: string;
}

export interface InventoryItem {
    id: string;
    _row?: number;
    productName: string;
    pvn: string;
    barcode: string;
    systemStock: string | number;
    actualStock: string | number;
    diff: number;
    status: string;
    note: string;
}

// ===========================================================================
// EXPIRY TYPES
// ===========================================================================

export interface ExpiryItem {
    id: string;
    _row?: number;
    productName: string;
    barcode: string;
    quantity: string | number;
    mfgDate: string;
    expiryDate: string;
    status: string;
    note: string;
    daysLeft?: number;
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

// ===========================================================================
// API RESPONSE TYPES
// ===========================================================================

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

// ===========================================================================
// UTILITY TYPES
// ===========================================================================

export type ViewName =
    | 'LOGIN'
    | 'REGISTER'
    | 'DASHBOARD'
    | 'EMPLOYEE_HOME'
    | 'AUDIT'
    | 'EXPIRY_CONTROL'
    | 'INVENTORY_HQ'
    | 'RECOVERY_HUB'
    | 'PROFILE';
