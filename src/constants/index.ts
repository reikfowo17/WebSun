/**
 * Constants
 * 
 * Application-wide constants and configuration
 */

// ===========================================================================
// XP & LEVELING
// ===========================================================================

export const XP_PER_LEVEL = 500;

export const XP_REWARDS = {
    INVENTORY_CHECK: 10,
    EXPIRY_CHECK: 5,
    REPORT_SUBMIT: 25,
    PERFECT_AUDIT: 50,
    FIRST_TASK: 100,
} as const;

// ===========================================================================
// STATUS COLORS
// ===========================================================================

export const STATUS_COLORS = {
    PENDING: {
        bg: 'bg-gray-100',
        text: 'text-gray-700',
        border: 'border-gray-200',
    },
    MATCHED: {
        bg: 'bg-green-100',
        text: 'text-green-700',
        border: 'border-green-200',
    },
    MISSING: {
        bg: 'bg-red-100',
        text: 'text-red-700',
        border: 'border-red-200',
    },
    OVER: {
        bg: 'bg-yellow-100',
        text: 'text-yellow-700',
        border: 'border-yellow-200',
    },
} as const;

export const EXPIRY_STATUS_COLORS = {
    'Còn hạn': {
        bg: 'bg-green-100',
        text: 'text-green-700',
    },
    'Cận hạn': {
        bg: 'bg-yellow-100',
        text: 'text-yellow-700',
    },
    'Hết hạn': {
        bg: 'bg-red-100',
        text: 'text-red-700',
    },
} as const;

// ===========================================================================
// ROUTES & VIEWS
// ===========================================================================

export const ADMIN_VIEWS = [
    'DASHBOARD',
    'INVENTORY_HQ',
    'EXPIRY_HQ',
    'RECOVERY_HUB',
    'REPORTS',
    'SETTINGS',
] as const;

export const EMPLOYEE_VIEWS = [
    'EMPLOYEE_HOME',
    'AUDIT',
    'EXPIRY_CONTROL',
    'PROFILE',
] as const;

// ===========================================================================
// STORES
// ===========================================================================

export interface StoreConfig {
    id: string;
    code: string;
    name: string;
    color: string;
    bgColor: string;
}

export const STORES: StoreConfig[] = [
    { id: 'BEE', code: 'BEE', name: 'SM BEE', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
    { id: 'PLAZA', code: 'PLAZA', name: 'SM PLAZA', color: 'text-blue-700', bgColor: 'bg-blue-100' },
    { id: 'MIEN_DONG', code: 'MIỀN ĐÔNG', name: 'SM MIỀN ĐÔNG', color: 'text-green-700', bgColor: 'bg-green-100' },
    { id: 'HT_PEARL', code: 'HT PEARL', name: 'SM HT PEARL', color: 'text-purple-700', bgColor: 'bg-purple-100' },
    { id: 'GREEN_TOPAZ', code: 'GREEN_TOPAZ', name: 'SM GREEN TOPAZ', color: 'text-cyan-700', bgColor: 'bg-cyan-100' },
];

export const SHIFTS = [
    { value: 1, label: 'Ca 1 (6:00 - 14:00)' },
    { value: 2, label: 'Ca 2 (14:00 - 22:00)' },
    { value: 3, label: 'Ca 3 (22:00 - 6:00)' },
] as const;


// ===========================================================================
// VALIDATION
// ===========================================================================

export const VALIDATION = {
    USERNAME_MIN_LENGTH: 3,
    USERNAME_MAX_LENGTH: 50,
    PASSWORD_MIN_LENGTH: 6,
    PASSWORD_MAX_LENGTH: 100,
    NAME_MIN_LENGTH: 2,
    NAME_MAX_LENGTH: 100,
} as const;

// ===========================================================================
// DATE FORMATS
// ===========================================================================

export const DATE_FORMAT = {
    DISPLAY: 'dd/MM/yyyy',
    ISO: 'yyyy-MM-dd',
    DATETIME: 'dd/MM/yyyy HH:mm',
} as const;
