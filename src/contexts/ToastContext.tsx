/**
 * ToastContext - Global Toast Notification System
 * 
 * Replaces all alert() calls throughout the app.
 * Provides success, error, warning, and info toasts.
 */
import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

// ===========================================================================
// TYPES
// ===========================================================================

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
}

interface ToastContextType {
    toasts: Toast[];
    showToast: (type: ToastType, message: string, duration?: number) => void;
    success: (message: string) => void;
    error: (message: string) => void;
    warning: (message: string) => void;
    info: (message: string) => void;
    removeToast: (id: string) => void;
    clearAll: () => void;
}

interface ToastProviderProps {
    children: ReactNode;
}

// ===========================================================================
// CONTEXT
// ===========================================================================

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// ===========================================================================
// TOAST COMPONENT
// ===========================================================================

const ToastItem: React.FC<{ toast: Toast; onRemove: (id: string) => void }> = ({ toast, onRemove }) => {
    React.useEffect(() => {
        const timer = setTimeout(() => {
            onRemove(toast.id);
        }, toast.duration || 4000);
        return () => clearTimeout(timer);
    }, [toast.id, toast.duration, onRemove]);

    const bgColors: Record<ToastType, string> = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        warning: 'bg-yellow-500',
        info: 'bg-blue-500',
    };

    const icons: Record<ToastType, string> = {
        success: 'check_circle',
        error: 'error',
        warning: 'warning',
        info: 'info',
    };

    return (
        <div
            className={`${bgColors[toast.type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-fade-in-up min-w-[300px] max-w-[500px]`}
            role="alert"
        >
            <span className="material-symbols-outlined text-xl">{icons[toast.type]}</span>
            <span className="flex-1 text-sm font-medium">{toast.message}</span>
            <button
                onClick={() => onRemove(toast.id)}
                className="hover:opacity-70 transition-opacity"
                aria-label="Close"
            >
                <span className="material-symbols-outlined text-lg">close</span>
            </button>
        </div>
    );
};

// ===========================================================================
// PROVIDER
// ===========================================================================

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const generateId = () => `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const showToast = useCallback((type: ToastType, message: string, duration = 4000) => {
        const newToast: Toast = {
            id: generateId(),
            type,
            message,
            duration,
        };
        setToasts(prev => [...prev, newToast]);
    }, []);

    const success = useCallback((message: string) => showToast('success', message), [showToast]);
    const error = useCallback((message: string) => showToast('error', message), [showToast]);
    const warning = useCallback((message: string) => showToast('warning', message), [showToast]);
    const info = useCallback((message: string) => showToast('info', message), [showToast]);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const clearAll = useCallback(() => {
        setToasts([]);
    }, []);

    const value: ToastContextType = {
        toasts,
        showToast,
        success,
        error,
        warning,
        info,
        removeToast,
        clearAll,
    };

    return (
        <ToastContext.Provider value={value}>
            {children}
            {/* Toast Container */}
            <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
                {toasts.map(toast => (
                    <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
                ))}
            </div>
        </ToastContext.Provider>
    );
};

// ===========================================================================
// HOOK
// ===========================================================================

export const useToast = (): ToastContextType => {
    const context = useContext(ToastContext);
    if (context === undefined) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export default ToastContext;
