import React from 'react';

export interface ConfirmModalProps {
    isOpen: boolean;
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
    onCancel: () => void;
    loading?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    title = 'Xác nhận hành động',
    message,
    confirmText = 'Xác nhận',
    cancelText = 'Hủy bỏ',
    variant = 'warning',
    onConfirm,
    onCancel,
    loading = false
}) => {
    if (!isOpen) return null;

    const variantStyles = {
        danger: {
            icon: 'delete_forever',
            iconBg: 'bg-red-100',
            iconColor: 'text-red-600',
            buttonBg: 'bg-red-600 hover:bg-red-700',
            shadow: 'shadow-red-200'
        },
        warning: {
            icon: 'warning',
            iconBg: 'bg-amber-100',
            iconColor: 'text-amber-600',
            buttonBg: 'bg-amber-600 hover:bg-amber-700',
            shadow: 'shadow-amber-200'
        },
        info: {
            icon: 'help',
            iconBg: 'bg-indigo-100',
            iconColor: 'text-indigo-600',
            buttonBg: 'bg-indigo-600 hover:bg-indigo-700',
            shadow: 'shadow-indigo-200'
        }
    };

    const styles = variantStyles[variant];

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-[400px] shadow-2xl animate-in zoom-in-95 duration-200">
                {/* Icon */}
                <div className="flex flex-col items-center pt-8 pb-4">
                    <div className={`w-14 h-14 rounded-full ${styles.iconBg} flex items-center justify-center mb-4`}>
                        <span className={`material-symbols-outlined text-3xl ${styles.iconColor}`}>
                            {styles.icon}
                        </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">{title}</h3>
                </div>

                {/* Message */}
                <div className="px-6 pb-6">
                    <p className="text-center text-gray-600 text-sm">{message}</p>
                </div>

                {/* Actions */}
                <div className="flex gap-3 px-6 pb-6">
                    <button
                        onClick={onCancel}
                        disabled={loading}
                        className="flex-1 py-2.5 px-4 bg-gray-100 text-gray-700 font-bold text-sm rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        className={`flex-1 py-2.5 px-4 text-white font-bold text-sm rounded-xl transition-all shadow-lg ${styles.buttonBg} ${styles.shadow} disabled:opacity-50 flex items-center justify-center gap-2`}
                    >
                        {loading && (
                            <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                        )}
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
