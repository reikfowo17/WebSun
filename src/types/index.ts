export interface User {
    id: string;
    name: string;
    username?: string;
    role: 'ADMIN' | 'EMPLOYEE';
    store: string;
    xp: number;
    level: number;
    avatar: string;
    avatarUrl?: string;
}

export interface Task {
    id: string;
    title: string;
    description?: string;
    type: 'INVENTORY' | 'EXPIRY' | 'RECOVERY' | 'OTHER' | 'AUDIT' | 'GENERAL';
    status: 'NOT_STARTED' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SUBMITTED';
    assignee: string;
    assigneeId?: string;
    storeId?: string;
    storeName?: string;
    target_items: number;
    completed_items: number;
    progress?: number;
    dueDate?: string;
    shift?: number;
}


export interface Store {
    id: string;
    code: string;
    name: string;
    address?: string;
}

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

export interface InventoryProduct {
    id: string;
    productName: string;
    barcode?: string;
    pvn?: string;
    systemStock?: number | null;
    actualStock?: number | null;
    diff?: number | null;
    status: string;
    note?: string;
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

export * from './recovery';
