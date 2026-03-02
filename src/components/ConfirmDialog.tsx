import React from 'react';

export interface ConfirmDialogProps {
    isOpen?: boolean;
    title?: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
    /** @deprecated Use confirmLabel */
    confirmText?: string;
    /** @deprecated Use cancelLabel */
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
    loading?: boolean;
}

const VARIANT_STYLES = {
    danger: {
        icon: 'delete_forever',
        iconBg: 'bg-red-100 dark:bg-red-900/20',
        iconColor: 'text-red-600 dark:text-red-400',
        btnBg: 'bg-red-600 hover:bg-red-700',
    },
    warning: {
        icon: 'warning',
        iconBg: 'bg-amber-100 dark:bg-amber-900/20',
        iconColor: 'text-amber-600 dark:text-amber-400',
        btnBg: 'bg-amber-600 hover:bg-amber-700',
    },
    info: {
        icon: 'help',
        iconBg: 'bg-indigo-100 dark:bg-indigo-900/20',
        iconColor: 'text-indigo-600 dark:text-indigo-400',
        btnBg: 'bg-indigo-600 hover:bg-indigo-700',
    },
};

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen = true,
    title = 'Xác nhận',
    message,
    onConfirm,
    onCancel,
    confirmLabel,
    cancelLabel,
    confirmText,
    cancelText,
    variant = 'warning',
    loading = false,
}) => {
    const finalConfirm = confirmLabel ?? confirmText ?? 'Xác nhận';
    const finalCancel = cancelLabel ?? cancelText ?? 'Hủy';
    if (!isOpen) return null;
    const style = VARIANT_STYLES[variant];

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
            <div className="relative bg-white dark:bg-[#1a1a1a] rounded-2xl w-full max-w-sm shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-6 flex flex-col items-center text-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl ${style.iconBg} ${style.iconColor} flex items-center justify-center`}>
                        <span className="material-symbols-outlined text-2xl">{style.icon}</span>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{title}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{message}</p>
                    </div>
                </div>
                <div className="px-6 pb-6 flex gap-3">
                    <button
                        onClick={onCancel}
                        disabled={loading}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                    >
                        {finalCancel}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white ${style.btnBg} shadow-sm transition-colors inline-flex items-center justify-center gap-1.5 disabled:opacity-60`}
                    >
                        {loading && (
                            <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                        )}
                        {finalConfirm}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;
export type { ConfirmDialogProps as ConfirmModalProps };
