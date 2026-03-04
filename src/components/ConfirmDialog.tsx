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
        iconBg: '#FEE2E2',
        iconBgDark: 'rgba(220,38,38,0.15)',
        iconColor: '#DC2626',
        iconColorDark: '#F87171',
        btnBg: '#DC2626',
        btnHover: '#B91C1C',
    },
    warning: {
        icon: 'warning',
        iconBg: '#FEF3C7',
        iconBgDark: 'rgba(245,158,11,0.15)',
        iconColor: '#D97706',
        iconColorDark: '#FBBF24',
        btnBg: '#D97706',
        btnHover: '#B45309',
    },
    info: {
        icon: 'help',
        iconBg: '#FEF3C7',
        iconBgDark: 'rgba(245,158,11,0.15)',
        iconColor: '#D97706',
        iconColorDark: '#FBBF24',
        btnBg: '#F59E0B',
        btnHover: '#D97706',
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
        <>
            <style>{CONFIRM_CSS}</style>
            <div className="cd-overlay">
                <div className="cd-backdrop" onClick={onCancel} />
                <div className="cd-dialog">
                    <div className="cd-body">
                        <div className="cd-icon" style={{ background: style.iconBg, color: style.iconColor }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 24 }}>{style.icon}</span>
                        </div>
                        <div>
                            <h3 className="cd-title">{title}</h3>
                            <p className="cd-message">{message}</p>
                        </div>
                    </div>
                    <div className="cd-actions">
                        <button
                            onClick={onCancel}
                            disabled={loading}
                            className="cd-btn cd-btn-cancel"
                        >
                            {finalCancel}
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={loading}
                            className="cd-btn cd-btn-confirm"
                            style={{ background: style.btnBg }}
                        >
                            {loading && (
                                <span className="material-symbols-outlined cd-spin" style={{ fontSize: 16 }}>sync</span>
                            )}
                            {finalConfirm}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default ConfirmDialog;
export type { ConfirmDialogProps as ConfirmModalProps };

const CONFIRM_CSS = `
.cd-overlay {
    position: fixed; inset: 0; z-index: 9999;
    display: flex; align-items: center; justify-content: center; padding: 16px;
}
.cd-backdrop {
    position: absolute; inset: 0;
    background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
}
.cd-dialog {
    position: relative; background: #FFFFFF;
    border-radius: 16px; width: 100%; max-width: 360px;
    overflow: hidden; animation: fadeInScale 0.2s ease-out;
    box-shadow: 0 8px 32px rgba(0,0,0,0.12);
}
html.dark .cd-dialog {
    background: #1a1a1a; border: 1px solid #2e2e2e;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}
.cd-body {
    padding: 24px; display: flex; flex-direction: column;
    align-items: center; text-align: center; gap: 16px;
}
.cd-icon {
    width: 56px; height: 56px; border-radius: 16px;
    display: flex; align-items: center; justify-content: center;
}
.cd-title {
    font-size: 18px; font-weight: 700; color: #171717; margin: 0 0 4px;
}
html.dark .cd-title { color: #F5F5F5; }
.cd-message {
    font-size: 14px; color: #737373; line-height: 1.5; margin: 0;
}
html.dark .cd-message { color: #A3A3A3; }
.cd-actions {
    padding: 0 24px 24px; display: flex; gap: 12px;
}
.cd-btn {
    flex: 1; padding: 10px 16px; border-radius: 12px;
    font-size: 14px; font-weight: 700; cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    border: none; transition: all 0.15s; font-family: inherit;
}
.cd-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.cd-btn-cancel {
    background: transparent; color: #525252;
    border: 1.5px solid #E5E7EB;
}
.cd-btn-cancel:hover { background: #F5F5F5; }
html.dark .cd-btn-cancel {
    border-color: #3E3E3E; color: #D4D4D4;
}
html.dark .cd-btn-cancel:hover { background: #2E2E2E; }
.cd-btn-confirm {
    color: #FFFFFF; box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}
.cd-btn-confirm:hover { filter: brightness(0.9); }
.cd-spin { animation: spin 0.8s linear infinite; }
`;
