import React, { useEffect, useState } from 'react';
import type { User } from '../types';
import { DashboardService } from '../services/dashboard';
import type { DashboardStats, TaskItem } from '../services/dashboard';

interface DashboardProps {
  user: User;
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Chờ xử lý', color: '#D97706', bg: '#FEF3C7' },
  IN_PROGRESS: { label: 'Đang thực hiện', color: '#2563EB', bg: '#DBEAFE' },
  COMPLETED: { label: 'Hoàn thành', color: '#047857', bg: '#D1FAE5' },
};

const TYPE_ICONS: Record<string, string> = {
  INVENTORY: 'inventory_2',
  EXPIRY: 'event_busy',
  RECOVERY: 'receipt_long',
  AUDIT: 'fact_check',
  GENERAL: 'task_alt',
  OTHER: 'more_horiz',
};

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  INVENTORY: { bg: '#F0FDF4', color: '#22C55E' },
  EXPIRY: { bg: '#FEF2F2', color: '#EF4444' },
  RECOVERY: { bg: '#FEF3C7', color: '#F59E0B' },
  AUDIT: { bg: '#DBEAFE', color: '#3B82F6' },
  GENERAL: { bg: '#EDE9FE', color: '#8B5CF6' },
  OTHER: { bg: '#FAFAF8', color: '#A3A3A3' },
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
            <h1 className="dash-greeting">{greeting()}, {user.name}!</h1>
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
              <span className="material-symbols-outlined" style={{ fontSize: 26 }}>warning</span>
            </div>
            <div className="dash-stat-info">
              <span className="dash-stat-value">{stats.urgentItems}</span>
              <span className="dash-stat-label">SP cận hạn (3 ngày)</span>
            </div>
          </div>
          <div className="dash-stat-card dash-stat-checks">
            <div className="dash-stat-icon">
              <span className="material-symbols-outlined" style={{ fontSize: 26 }}>fact_check</span>
            </div>
            <div className="dash-stat-info">
              <span className="dash-stat-value">{stats.totalChecks}</span>
              <span className="dash-stat-label">Đã kiểm tra</span>
            </div>
          </div>
          <div className="dash-stat-card dash-stat-audits">
            <div className="dash-stat-icon">
              <span className="material-symbols-outlined" style={{ fontSize: 26 }}>inventory_2</span>
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
              <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#D4D4D4' }}>task_alt</span>
              <p>Không có công việc nào</p>
            </div>
          ) : (
            <div className="dash-task-list">
              {tasks.map(task => {
                const st = STATUS_MAP[task.status] || STATUS_MAP.PENDING;
                const progress = task.target_items > 0
                  ? Math.round((task.completed_items / task.target_items) * 100)
                  : 0;
                const tc = TYPE_COLORS[task.type] || TYPE_COLORS.OTHER;
                return (
                  <div key={task.id} className="dash-task-card">
                    <div className="dash-task-icon" style={{ background: tc.bg, color: tc.color }}>
                      <span className="material-symbols-outlined"
                        style={{ fontSize: 22 }}>
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
/* ═══ DASHBOARD — SunMart Redesign ═══ */
.dash-container {
  padding: 28px 32px;
  max-width: 960px;
  margin: 0 auto;
  animation: fadeIn 0.3s ease-out;
}

.dash-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.dash-greeting {
  font-size: 24px;
  font-weight: 800;
  color: #171717;
  margin: 0;
  letter-spacing: -0.5px;
}

html.dark .dash-greeting { color: #F5F5F5; }

.dash-subtitle {
  font-size: 13px;
  color: #A3A3A3;
  margin: 4px 0 0;
  font-weight: 500;
}

.dash-refresh {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: 1.5px solid #EEEDE9;
  background: #FFFFFF;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #A3A3A3;
  transition: all .2s;
}

.dash-refresh:hover {
  border-color: #FACC15;
  color: #D97706;
  background: #FFFBEB;
  box-shadow: 0 2px 8px rgba(250,204,21,0.15);
}

.dash-refresh:disabled { opacity: .5; cursor: not-allowed; }

html.dark .dash-refresh {
  background: #1a1a1a;
  border-color: rgba(255,255,255,0.08);
  color: #737373;
}

html.dark .dash-refresh:hover {
  border-color: #FACC15;
  color: #FACC15;
  background: rgba(250,204,21,0.08);
}

/* ─── Stats Cards ─── */
.dash-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 20px;
  margin-bottom: 28px;
}

.dash-stat-card {
  display: flex;
  align-items: center;
  gap: 18px;
  background: #FFFFFF;
  border-radius: 16px;
  padding: 20px 24px;
  height: 100px;
  transition: all .2s;
  box-shadow: 0 2px 12px rgba(0,0,0,0.04);
}

.dash-stat-card:hover {
  box-shadow: 0 4px 16px -4px rgba(0,0,0,.06);
  transform: translateY(-1px);
}

html.dark .dash-stat-card {
  background: #1a1a1a;
  box-shadow: none;
}

.dash-stat-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.dash-stat-urgent .dash-stat-icon { background: #FEF3C7; color: #F59E0B; }
.dash-stat-checks .dash-stat-icon { background: #DBEAFE; color: #3B82F6; }
.dash-stat-audits .dash-stat-icon { background: #EDE9FE; color: #8B5CF6; }

.dash-stat-info {
  display: flex;
  flex-direction: column;
}

.dash-stat-value {
  font-size: 32px;
  font-weight: 800;
  color: #171717;
  line-height: 1.1;
  letter-spacing: -1px;
}

html.dark .dash-stat-value { color: #F5F5F5; }

.dash-stat-label {
  font-size: 12px;
  color: #A3A3A3;
  font-weight: 500;
  margin-top: 2px;
}

/* ─── Section ─── */
.dash-section {
  margin-bottom: 24px;
}

.dash-section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 18px;
  font-weight: 700;
  color: #171717;
  margin: 0 0 16px;
  letter-spacing: -0.3px;
}

html.dark .dash-section-title { color: #E5E5E5; }

.dash-empty {
  text-align: center;
  padding: 48px 20px;
  color: #A3A3A3;
  font-size: 14px;
  background: #FAFAF8;
  border-radius: 14px;
  border: 1.5px dashed #EEEDE9;
}

html.dark .dash-empty {
  background: #141414;
  border-color: rgba(255,255,255,0.06);
}

.dash-empty p { margin: 8px 0 0; }

/* ─── Task Cards ─── */
.dash-task-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dash-task-card {
  display: flex;
  align-items: center;
  gap: 16px;
  background: #FFFFFF;
  border-radius: 14px;
  padding: 18px 20px;
  transition: all .15s;
  box-shadow: 0 1px 6px rgba(0,0,0,0.025);
}

.dash-task-card:hover {
  box-shadow: 0 4px 16px -4px rgba(0,0,0,.06);
  transform: translateY(-1px);
}

html.dark .dash-task-card {
  background: #1a1a1a;
  box-shadow: none;
}

.dash-task-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: #F0FDF4;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #22C55E;
  flex-shrink: 0;
}

html.dark .dash-task-icon {
  background: #252525;
}

.dash-task-body { flex: 1; min-width: 0; }

.dash-task-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.dash-task-title {
  font-size: 14px;
  font-weight: 600;
  color: #171717;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

html.dark .dash-task-title { color: #E5E5E5; }

.dash-task-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 20px;
  white-space: nowrap;
}

.dash-task-assignee {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #A3A3A3;
  margin-bottom: 8px;
}

.dash-task-progress-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dash-task-progress-bar {
  flex: 1;
  height: 6px;
  background: #EEEDE9;
  border-radius: 3px;
  overflow: hidden;
}

html.dark .dash-task-progress-bar { background: #252525; }

.dash-task-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #FACC15, #F59E0B);
  border-radius: 3px;
  transition: width .3s;
}

.dash-task-progress-text {
  font-size: 11px;
  color: #A3A3A3;
  font-family: 'Fira Code', monospace;
  white-space: nowrap;
}

.dash-spin { animation: spin .8s linear infinite; }
`;
