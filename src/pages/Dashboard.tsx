import React, { useEffect, useState } from 'react';
import type { User } from '../types';
import { DashboardService } from '../services/dashboard';
import type { DashboardStats, TaskItem } from '../services/dashboard';

interface DashboardProps {
    user: User;
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
    PENDING: { label: 'Chờ xử lý', color: '#f59e0b', bg: '#fef3c7' },
    IN_PROGRESS: { label: 'Đang thực hiện', color: '#3b82f6', bg: '#dbeafe' },
    COMPLETED: { label: 'Hoàn thành', color: '#10b981', bg: '#d1fae5' },
};

const TYPE_ICONS: Record<string, string> = {
    INVENTORY: 'inventory_2',
    EXPIRY: 'event_busy',
    RECOVERY: 'receipt_long',
    AUDIT: 'fact_check',
    GENERAL: 'task_alt',
    OTHER: 'more_horiz',
};

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
    const [stats, setStats] = useState<DashboardStats>({ urgentItems: 0, totalChecks: 0, totalAudits: 0 });
    const [tasks, setTasks] = useState<TaskItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [statsRes, tasksRes] = await Promise.all([
                DashboardService.getStats(),
                DashboardService.getTasks(user.role === 'EMPLOYEE' ? user.id : undefined),
            ]);
            if (statsRes.success) setStats(statsRes.stats);
            if (tasksRes.success) setTasks(tasksRes.tasks);
        } catch (e) {
            console.error('[Dashboard] Load error:', e);
        } finally {
            setLoading(false);
        }
    };

    const greeting = () => {
        const h = new Date().getHours();
        if (h < 12) return 'Chào buổi sáng';
        if (h < 18) return 'Chào buổi chiều';
        return 'Chào buổi tối';
    };

    return (
        <>
            <style>{CSS}</style>
            <div className="dash-container">
                {/* Header */}
                <div className="dash-header">
                    <div>
                        <h1 className="dash-greeting">{greeting()}, {user.name}! 👋</h1>
                        <p className="dash-subtitle">Tổng quan hoạt động hôm nay</p>
                    </div>
                    <button className="dash-refresh" onClick={loadData} disabled={loading}>
                        <span className={`material-symbols-outlined ${loading ? 'dash-spin' : ''}`}
                            style={{ fontSize: 18 }}>refresh</span>
                    </button>
                </div>

                {/* Stats Cards */}
                <div className="dash-stats">
                    <div className="dash-stat-card dash-stat-urgent">
                        <div className="dash-stat-icon">
                            <span className="material-symbols-outlined" style={{ fontSize: 24 }}>warning</span>
                        </div>
                        <div className="dash-stat-info">
                            <span className="dash-stat-value">{stats.urgentItems}</span>
                            <span className="dash-stat-label">SP cận hạn (3 ngày)</span>
                        </div>
                    </div>
                    <div className="dash-stat-card dash-stat-checks">
                        <div className="dash-stat-icon">
                            <span className="material-symbols-outlined" style={{ fontSize: 24 }}>fact_check</span>
                        </div>
                        <div className="dash-stat-info">
                            <span className="dash-stat-value">{stats.totalChecks}</span>
                            <span className="dash-stat-label">Đã kiểm tra</span>
                        </div>
                    </div>
                    <div className="dash-stat-card dash-stat-audits">
                        <div className="dash-stat-icon">
                            <span className="material-symbols-outlined" style={{ fontSize: 24 }}>inventory_2</span>
                        </div>
                        <div className="dash-stat-info">
                            <span className="dash-stat-value">{stats.totalAudits}</span>
                            <span className="dash-stat-label">Tổng SP kiểm kho</span>
                        </div>
                    </div>
                </div>

                {/* Tasks */}
                <div className="dash-section">
                    <h2 className="dash-section-title">
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>assignment</span>
                        Công việc
                    </h2>
                    {tasks.length === 0 ? (
                        <div className="dash-empty">
                            <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#cbd5e1' }}>task_alt</span>
                            <p>Không có công việc nào</p>
                        </div>
                    ) : (
                        <div className="dash-task-list">
                            {tasks.map(task => {
                                const st = STATUS_MAP[task.status] || STATUS_MAP.PENDING;
                                const progress = task.target_items > 0
                                    ? Math.round((task.completed_items / task.target_items) * 100)
                                    : 0;
                                return (
                                    <div key={task.id} className="dash-task-card">
                                        <div className="dash-task-icon">
                                            <span className="material-symbols-outlined"
                                                style={{ fontSize: 20 }}>
                                                {TYPE_ICONS[task.type] || 'task'}
                                            </span>
                                        </div>
                                        <div className="dash-task-body">
                                            <div className="dash-task-header">
                                                <span className="dash-task-title">{task.title}</span>
                                                <span className="dash-task-badge"
                                                    style={{ color: st.color, background: st.bg }}>
                                                    {st.label}
                                                </span>
                                            </div>
                                            {task.assignee && (
                                                <span className="dash-task-assignee">
                                                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>person</span>
                                                    {task.assignee}
                                                </span>
                                            )}
                                            <div className="dash-task-progress-wrap">
                                                <div className="dash-task-progress-bar">
                                                    <div className="dash-task-progress-fill"
                                                        style={{ width: `${progress}%` }} />
                                                </div>
                                                <span className="dash-task-progress-text">
                                                    {task.completed_items}/{task.target_items} ({progress}%)
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default Dashboard;

const CSS = `
.dash-container { padding: 24px; max-width: 960px; margin: 0 auto; }
.dash-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
.dash-greeting { font-size: 22px; font-weight: 800; color: #1e293b; margin: 0; }
.dash-subtitle { font-size: 13px; color: #94a3b8; margin: 4px 0 0; }
.dash-refresh { width: 36px; height: 36px; border-radius: 10px; border: 1.5px solid #e2e8f0; background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #64748b; transition: all .15s; }
.dash-refresh:hover { border-color: #a5b4fc; color: #4f46e5; background: #eef2ff; }
.dash-refresh:disabled { opacity: .5; cursor: not-allowed; }

.dash-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 28px; }
.dash-stat-card { display: flex; align-items: center; gap: 14px; background: #fff; border: 1.5px solid #f1f5f9; border-radius: 16px; padding: 18px 20px; transition: all .2s; }
.dash-stat-card:hover { border-color: #e2e8f0; box-shadow: 0 4px 16px -4px rgba(0,0,0,.06); }
.dash-stat-icon { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.dash-stat-urgent .dash-stat-icon { background: #fef3c7; color: #f59e0b; }
.dash-stat-checks .dash-stat-icon { background: #dbeafe; color: #3b82f6; }
.dash-stat-audits .dash-stat-icon { background: #ede9fe; color: #8b5cf6; }
.dash-stat-info { display: flex; flex-direction: column; }
.dash-stat-value { font-size: 24px; font-weight: 800; color: #1e293b; line-height: 1.2; }
.dash-stat-label { font-size: 12px; color: #94a3b8; font-weight: 500; margin-top: 2px; }

.dash-section { margin-bottom: 24px; }
.dash-section-title { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; color: #334155; margin: 0 0 14px; }
.dash-empty { text-align: center; padding: 48px 20px; color: #94a3b8; font-size: 14px; background: #fafbfc; border-radius: 14px; border: 1.5px dashed #e2e8f0; }
.dash-empty p { margin: 8px 0 0; }

.dash-task-list { display: flex; flex-direction: column; gap: 10px; }
.dash-task-card { display: flex; gap: 14px; background: #fff; border: 1.5px solid #f1f5f9; border-radius: 14px; padding: 16px; transition: all .15s; }
.dash-task-card:hover { border-color: #e2e8f0; box-shadow: 0 2px 10px -3px rgba(0,0,0,.05); }
.dash-task-icon { width: 40px; height: 40px; border-radius: 12px; background: #f1f5f9; display: flex; align-items: center; justify-content: center; color: #64748b; flex-shrink: 0; }
.dash-task-body { flex: 1; min-width: 0; }
.dash-task-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
.dash-task-title { font-size: 14px; font-weight: 600; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dash-task-badge { font-size: 10px; font-weight: 700; padding: 3px 10px; border-radius: 20px; white-space: nowrap; }
.dash-task-assignee { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: #94a3b8; margin-bottom: 8px; }
.dash-task-progress-wrap { display: flex; align-items: center; gap: 10px; }
.dash-task-progress-bar { flex: 1; height: 6px; background: #f1f5f9; border-radius: 3px; overflow: hidden; }
.dash-task-progress-fill { height: 100%; background: linear-gradient(90deg, #6366f1, #818cf8); border-radius: 3px; transition: width .3s; }
.dash-task-progress-text { font-size: 11px; color: #94a3b8; font-family: monospace; white-space: nowrap; }

@keyframes dashSpin { from { transform: rotate(0) } to { transform: rotate(360deg) } }
.dash-spin { animation: dashSpin .8s linear infinite; }
`;
