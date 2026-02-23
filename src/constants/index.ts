export const XP_PER_LEVEL = 500;

export const XP_REWARDS = {
  INVENTORY_CHECK: 10,
  EXPIRY_CHECK: 5,
  REPORT_SUBMIT: 25,
  PERFECT_AUDIT: 50,
  FIRST_TASK: 100,
} as const;

export const STATUS_COLORS = {
  PENDING: {
    bg: "bg-gray-100",
    text: "text-gray-700",
    border: "border-gray-200",
  },
  MATCHED: {
    bg: "bg-green-100",
    text: "text-green-700",
    border: "border-green-200",
  },
  MISSING: {
    bg: "bg-red-100",
    text: "text-red-700",
    border: "border-red-200",
  },
  OVER: {
    bg: "bg-yellow-100",
    text: "text-yellow-700",
    border: "border-yellow-200",
  },
} as const;

export const EXPIRY_STATUS_COLORS = {
  "Còn hạn": {
    bg: "bg-green-100",
    text: "text-green-700",
  },
  "Cận hạn": {
    bg: "bg-yellow-100",
    text: "text-yellow-700",
  },
  "Hết hạn": {
    bg: "bg-red-100",
    text: "text-red-700",
  },
} as const;

export const ADMIN_VIEWS = [
  "DASHBOARD",
  "INVENTORY_HQ",
  "EXPIRY_HQ",
  "RECOVERY_HUB",
  "REPORTS",
  "SETTINGS",
] as const;

export const EMPLOYEE_VIEWS = [
  "EMPLOYEE_HOME",
  "AUDIT",
  "EXPIRY_CONTROL",
  "PROFILE",
] as const;

export const VALIDATION = {
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 50,
  PASSWORD_MIN_LENGTH: 6,
  PASSWORD_MAX_LENGTH: 100,
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 100,
} as const;

export const DATE_FORMAT = {
  DISPLAY: "dd/MM/yyyy",
  ISO: "yyyy-MM-dd",
  DATETIME: "dd/MM/yyyy HH:mm",
} as const;
