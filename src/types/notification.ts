// Notification Module Types

export type NotificationType =
    | 'RECOVERY_ASSIGNED'
    | 'RECOVERY_APPROVED'
    | 'RECOVERY_REJECTED'
    | 'RECOVERY_COMPLETED'
    | 'TASK_ASSIGNED'
    | 'REPORT_APPROVED'
    | 'REPORT_REJECTED'
    | 'SYSTEM';

export interface Notification {
    id: string;
    user_id: string;
    type: NotificationType;
    title: string;
    message?: string;
    link?: string;
    reference_id?: string;
    reference_type?: string;
    is_read: boolean;
    created_at: string;
    read_at?: string;
}

export interface CreateNotificationInput {
    user_id: string;
    type: NotificationType;
    title: string;
    message?: string;
    link?: string;
    reference_id?: string;
    reference_type?: string;
}
