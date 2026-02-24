import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NotificationService } from '../services/notification';
import type { Notification as NotifType } from '../types/notification';

interface NotificationBellProps {
    userId: string;
}

/* ── Icon/Color config per notification type ── */
const TYPE_CFG: Record<string, { icon: string; bg: string; color: string }> = {
    RECOVERY_ASSIGNED: { icon: 'assignment_ind', bg: '#eef2ff', color: '#4f46e5' },
    RECOVERY_APPROVED: { icon: 'verified', bg: '#d1fae5', color: '#065f46' },
    RECOVERY_REJECTED: { icon: 'cancel', bg: '#fef2f2', color: '#dc2626' },
    RECOVERY_COMPLETED: { icon: 'check_circle', bg: '#d1fae5', color: '#10b981' },
    TASK_ASSIGNED: { icon: 'task_alt', bg: '#dbeafe', color: '#1e40af' },
    REPORT_APPROVED: { icon: 'fact_check', bg: '#d1fae5', color: '#065f46' },
    REPORT_REJECTED: { icon: 'rule', bg: '#fef2f2', color: '#dc2626' },
    SYSTEM: { icon: 'info', bg: '#f3f4f6', color: '#6b7280' },
};

const timeAgo = (dateStr: string): string => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Vừa xong';
    if (mins < 60) return `${mins} phút trước`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    return `${days} ngày trước`;
};

const NotificationBell: React.FC<NotificationBellProps> = ({ userId }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<NotifType[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    /* ── Fetch unread count (lightweight, polled) ── */
    const fetchUnreadCount = useCallback(async () => {
        const count = await NotificationService.getUnreadCount();
        setUnreadCount(count);
    }, []);

    useEffect(() => {
        fetchUnreadCount();
        const interval = setInterval(fetchUnreadCount, 30_000);
        const onVis = () => { if (!document.hidden) fetchUnreadCount(); };
        document.addEventListener('visibilitychange', onVis);
        return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVis); };
    }, [fetchUnreadCount]);

    /* ── Load full list when panel opens ── */
    const loadNotifications = async () => {
        setLoading(true);
        try {
            const data = await NotificationService.getNotifications(30);
            setNotifications(data);
        } catch { }
        finally { setLoading(false); }
    };

    const handleOpen = () => {
        setIsOpen(true);
        loadNotifications();
    };

    const handleClose = () => setIsOpen(false);

    /* ── Click outside to close ── */
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                handleClose();
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen]);

    /* ── Mark one as read ── */
    const handleItemClick = async (notif: NotifType) => {
        if (!notif.is_read) {
            await NotificationService.markAsRead(notif.id);
            setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        }
        // Navigate if link exists
        if (notif.link) {
            window.location.hash = notif.link;
        }
        handleClose();
    };

    /* ── Mark all as read ── */
    const handleMarkAllRead = async () => {
        await NotificationService.markAllAsRead();
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
    };

    return (
        <>
            <style>{CSS_TEXT}</style>
            <div className="nb-root" ref={panelRef}>
                {/* Bell Button */}
                <button
                    className="nb-bell"
                    onClick={() => isOpen ? handleClose() : handleOpen()}
                    aria-label="Thông báo"
                >
                    <span className="material-symbols-outlined nb-bell-icon">notifications</span>
                    {unreadCount > 0 && (
                        <span className="nb-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                    )}
                </button>

                {/* Dropdown Panel */}
                {isOpen && (
                    <div className="nb-panel">
                        {/* Panel Header */}
                        <div className="nb-panel-header">
                            <h3 className="nb-panel-title">
                                <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#6366f1' }}>notifications</span>
                                Thông báo
                                {unreadCount > 0 && <span className="nb-unread-tag">{unreadCount} mới</span>}
                            </h3>
                            {unreadCount > 0 && (
                                <button className="nb-mark-all" onClick={handleMarkAllRead}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>done_all</span>
                                    Đọc tất cả
                                </button>
                            )}
                        </div>

                        {/* Notification List */}
                        <div className="nb-list">
                            {loading && notifications.length === 0 ? (
                                <div className="nb-loading">
                                    {Array.from({ length: 3 }).map((_, i) => (
                                        <div key={i} className="nb-skeleton" style={{ animationDelay: `${i * 0.1}s` }} />
                                    ))}
                                </div>
                            ) : notifications.length === 0 ? (
                                <div className="nb-empty">
                                    <span className="material-symbols-outlined" style={{ fontSize: 40, color: '#cbd5e1' }}>notifications_off</span>
                                    <p>Không có thông báo nào</p>
                                </div>
                            ) : (
                                notifications.map(notif => {
                                    const cfg = TYPE_CFG[notif.type] || TYPE_CFG.SYSTEM;
                                    return (
                                        <div
                                            key={notif.id}
                                            className={`nb-item ${!notif.is_read ? 'unread' : ''}`}
                                            onClick={() => handleItemClick(notif)}
                                        >
                                            <div className="nb-item-icon" style={{ background: cfg.bg }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: 18, color: cfg.color }}>{cfg.icon}</span>
                                            </div>
                                            <div className="nb-item-content">
                                                <div className="nb-item-title">{notif.title}</div>
                                                {notif.message && <div className="nb-item-msg">{notif.message}</div>}
                                                <div className="nb-item-time">{timeAgo(notif.created_at)}</div>
                                            </div>
                                            {!notif.is_read && <div className="nb-item-dot" />}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default NotificationBell;

/* ══════ CSS ══════ */
const CSS_TEXT = `
/* Root */
.nb-root { position: relative; display: flex; align-items: center; }

/* Bell */
.nb-bell {
    position: relative;
    width: 36px; height: 36px;
    border-radius: 12px; border: none;
    background: transparent;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: all 0.2s;
    color: #94a3b8;
}
.nb-bell:hover { background: rgba(99,102,241,0.08); color: #6366f1; }
.nb-bell-icon { font-size: 22px !important; transition: transform 0.2s; }
.nb-bell:hover .nb-bell-icon { transform: rotate(-12deg) scale(1.05); }

/* Badge */
.nb-badge {
    position: absolute; top: 2px; right: 1px;
    min-width: 17px; height: 17px;
    background: linear-gradient(135deg, #ef4444, #dc2626);
    color: #fff; font-size: 10px; font-weight: 800;
    border-radius: 99px; padding: 0 4px;
    display: flex; align-items: center; justify-content: center;
    line-height: 1; border: 2px solid #fff;
    animation: nbPulse 2s infinite;
    box-shadow: 0 2px 8px -2px rgba(239,68,68,0.5);
}
@keyframes nbPulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); }
}

/* Panel */
.nb-panel {
    position: absolute; top: calc(100% + 10px); right: 0;
    width: 380px; max-height: 480px;
    background: #fff; border-radius: 16px;
    box-shadow: 0 20px 60px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.04);
    z-index: 200; overflow: hidden;
    display: flex; flex-direction: column;
    animation: nbSlideIn 0.2s ease;
}
@keyframes nbSlideIn {
    from { opacity: 0; transform: translateY(-6px) scale(0.97); }
    to { opacity: 1; transform: translateY(0) scale(1); }
}

/* Dark mode support */
:root.dark .nb-panel { background: #1f1f1f; box-shadow: 0 20px 60px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06); }
:root.dark .nb-badge { border-color: #1a1a1a; }
:root.dark .nb-bell { color: #64748b; }
:root.dark .nb-bell:hover { background: rgba(99,102,241,0.12); color: #818cf8; }

/* Panel Header */
.nb-panel-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 18px; border-bottom: 1px solid #f1f5f9;
    flex-shrink: 0;
}
:root.dark .nb-panel-header { border-color: #2d2d2d; }
.nb-panel-title {
    display: flex; align-items: center; gap: 8px;
    font-size: 15px; font-weight: 800; color: #0f172a; margin: 0;
}
:root.dark .nb-panel-title { color: #e2e8f0; }
.nb-unread-tag {
    font-size: 10px; font-weight: 700; padding: 2px 8px;
    background: linear-gradient(135deg, #ef4444, #dc2626);
    color: #fff; border-radius: 99px;
}
.nb-mark-all {
    display: flex; align-items: center; gap: 4px;
    padding: 4px 10px; border-radius: 8px; border: none;
    background: #eef2ff; color: #4f46e5;
    font-size: 11px; font-weight: 700; cursor: pointer;
    transition: all 0.15s;
}
.nb-mark-all:hover { background: #c7d2fe; }
:root.dark .nb-mark-all { background: #312e81; color: #a5b4fc; }

/* List */
.nb-list { flex: 1; overflow-y: auto; padding: 6px; }

/* Item */
.nb-item {
    display: flex; align-items: flex-start; gap: 12px;
    padding: 12px; border-radius: 12px;
    cursor: pointer; transition: background 0.15s;
    position: relative;
}
.nb-item:hover { background: #f8fafc; }
.nb-item.unread { background: #eef2ff; }
.nb-item.unread:hover { background: #e0e7ff; }
:root.dark .nb-item:hover { background: #2a2a2a; }
:root.dark .nb-item.unread { background: #1e1b4b; }
:root.dark .nb-item.unread:hover { background: #312e81; }

.nb-item-icon {
    width: 36px; height: 36px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
}
.nb-item-content { flex: 1; min-width: 0; }
.nb-item-title {
    font-size: 13px; font-weight: 700; color: #0f172a;
    line-height: 1.3; margin-bottom: 2px;
}
:root.dark .nb-item-title { color: #e2e8f0; }
.nb-item-msg {
    font-size: 12px; color: #64748b; line-height: 1.4;
    display: -webkit-box; -webkit-line-clamp: 2;
    -webkit-box-orient: vertical; overflow: hidden;
}
:root.dark .nb-item-msg { color: #94a3b8; }
.nb-item-time {
    font-size: 11px; color: #94a3b8; margin-top: 4px;
    font-weight: 500;
}
.nb-item-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: #6366f1; flex-shrink: 0; margin-top: 6px;
    box-shadow: 0 0 8px rgba(99,102,241,0.4);
}

/* Empty */
.nb-empty {
    display: flex; flex-direction: column; align-items: center;
    gap: 8px; padding: 40px 20px; color: #94a3b8;
}
.nb-empty p { font-size: 13px; font-weight: 600; margin: 0; }

/* Loading */
.nb-loading { padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.nb-skeleton {
    height: 56px; border-radius: 12px; background: #f1f5f9;
    animation: nbShimmer 1.5s infinite;
}
:root.dark .nb-skeleton { background: #2d2d2d; }
@keyframes nbShimmer {
    0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; }
}
`;
