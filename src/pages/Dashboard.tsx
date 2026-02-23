import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User } from '../types';
import { DashboardService, type TaskItem } from '../services';
import PortalHeader from '../components/PortalHeader';
import '../styles/hq-sidebar.css';

interface DashboardProps {
  user: User;
  onNavigate?: (view: string) => void; // Keep for backward compatibility if needed, but marked optional
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Calculate XP progress to next level
  const xpForNextLevel = (user.level || 1) * 500;
  const xpProgress = Math.min(((user.xp || 0) / xpForNextLevel) * 100, 100);

  // Mock accuracy data for chart (would come from API in production)
  const accuracyData = [60, 85, 75, 90, 98];
  const weekDays = ['T2', 'T3', 'T4', 'T5', 'T6'];

  useEffect(() => {
    const loadData = async () => {
      try {
        if (user.role === 'ADMIN') {
          const res = await DashboardService.getStats();
          if (res.success) setStats(res.stats);
        }

        const taskRes = await DashboardService.getTasks(user.role === 'ADMIN' ? undefined : user.id);
        if (taskRes.success) setTasks(taskRes.tasks || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user]);

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto hq-skeleton">
        {/* Header skeleton */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div>
            <div className="hq-sk-line" style={{ width: 180, height: 24, marginBottom: 8 }} />
            <div className="hq-sk-line" style={{ width: 220, height: 12 }} />
          </div>
          <div className="hq-sk-pill" style={{ width: 120, height: 32 }} />
        </div>

        {/* Cards skeleton */}
        <div className="hq-sk-line" style={{ width: 80, height: 10, marginBottom: 16 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginBottom: 48 }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="hq-sk-wrap" style={{ padding: 0 }}>
              <div className="hq-sk-card" style={{ height: 128, borderRadius: '14px 14px 0 0' }} />
              <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="hq-sk-line" style={{ width: '50%', height: 12 }} />
                <div className="hq-sk-pill" style={{ width: 60 }} />
              </div>
            </div>
          ))}
        </div>

        {/* Table skeleton */}
        <div className="hq-sk-wrap">
          <div className="hq-sk-toolbar">
            <div className="hq-sk-pill" style={{ width: 140 }} />
          </div>
          <div className="hq-sk-table-head" />
          <div className="hq-sk-body">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="hq-sk-row">
                <div className="hq-sk-circle" />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                  <div className="hq-sk-line" style={{ width: `${75 - i * 8}%` }} />
                  <div className="hq-sk-line" style={{ width: `${45 + i * 5}%`, height: 10 }} />
                </div>
                <div className="hq-sk-pill" style={{ width: 64 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- ADMIN VIEW ---
  if (user.role === 'ADMIN') {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-black text-secondary uppercase tracking-tight">Admin Panel</h2>
            <p className="text-gray-500 text-sm">Trung tâm điều hành hệ thống</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-xl border border-green-200">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span className="text-xs font-bold text-green-700 uppercase">System Active</span>
          </div>
        </header>

        <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-4">Launchpad</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Inventory HQ Card */}
          <div onClick={() => navigate('/hq')} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:border-primary cursor-pointer transition-all shadow-sm hover:shadow-lg group">
            <div className="h-32 bg-gradient-to-br from-yellow-50 to-white p-6 relative">
              <span className="material-symbols-outlined absolute right-4 bottom-2 text-6xl text-yellow-400 opacity-20">inventory_2</span>
              <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center mb-4 text-yellow-700 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined">inventory_2</span>
              </div>
              <h3 className="font-black text-lg text-secondary">Thiết Lập Kiểm Tồn</h3>
            </div>
            <div className="p-4 bg-white flex justify-between items-center">
              <span className="text-xs text-gray-500">Quản lý Master Data</span>
              <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-[10px] font-bold uppercase">Active</span>
            </div>
          </div>

          {/* Expiry HQ Card */}
          <div onClick={() => navigate('/expiry-hq')} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:border-danger cursor-pointer transition-all shadow-sm hover:shadow-lg group">
            <div className="h-32 bg-gradient-to-br from-red-50 to-white p-6 relative">
              <span className="material-symbols-outlined absolute right-4 bottom-2 text-6xl text-red-400 opacity-20">event_busy</span>
              <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center mb-4 text-red-700 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined">event_busy</span>
              </div>
              <h3 className="font-black text-lg text-secondary">Thiết Lập Hạn Dùng</h3>
            </div>
            <div className="p-4 bg-white flex justify-between items-center">
              <span className="text-xs text-gray-500">Cảnh báo hôm nay</span>
              <span className="px-2 py-1 rounded-full bg-red-100 text-red-700 text-[10px] font-bold uppercase">{stats?.urgentItems || 0} URGENT</span>
            </div>
          </div>

          {/* Recovery Hub Card */}
          <div onClick={() => navigate('/recovery')} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:border-purple-500 cursor-pointer transition-all shadow-sm hover:shadow-lg group">
            <div className="h-32 bg-gradient-to-br from-purple-50 to-white p-6 relative">
              <span className="material-symbols-outlined absolute right-4 bottom-2 text-6xl text-purple-400 opacity-20">account_balance_wallet</span>
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center mb-4 text-purple-700 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined">account_balance_wallet</span>
              </div>
              <h3 className="font-black text-lg text-secondary">Truy Thu Hàng Hao</h3>
            </div>
            <div className="p-4 bg-white flex justify-between items-center">
              <span className="text-xs text-gray-500">Recovery Management</span>
              <span className="px-2 py-1 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold uppercase">New</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-500">task_alt</span>
            <h3 className="font-bold text-secondary">Nhiệm vụ hệ thống</h3>
          </div>
          <table className="w-full text-left">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase">Tên Task</th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase">Phụ trách</th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase">Tiến độ</th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(t => (
                <tr key={t.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="p-4 font-bold text-sm text-secondary">{t.title}</td>
                  <td className="p-4 text-sm text-gray-600">{t.assignee || 'Unassigned'}</td>
                  <td className="p-4">
                    <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(t.completed_items / (t.target_items || 1)) * 100}%` }}></div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${t.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
              {tasks.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-gray-400">Không có dữ liệu</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // --- EMPLOYEE VIEW ---
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Buổi sáng tốt lành' : currentHour < 18 ? 'Buổi chiều vui vẻ' : 'Buổi tối an lành';
  const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length;

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <PortalHeader>
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-800 flex items-center gap-2">
            {greeting}, <span className="text-primary">{user.name.split(' ').pop()}</span>! <span className="text-2xl animate-pulse">👋</span>
          </h1>
          <p className="text-sm text-gray-400 mt-1">Chọn công việc để bắt đầu ngày mới đầy năng lượng.</p>
        </div>
        <div className="hidden md:flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs font-semibold text-gray-400 uppercase">Hôm nay</p>
            <p className="text-sm font-bold text-gray-700">{new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-gray-400">calendar_today</span>
          </div>
        </div>
      </PortalHeader>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Stats Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          {/* Level Card */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft relative overflow-hidden">
            <div className="absolute right-0 top-0 w-24 h-24 bg-blue-50 rounded-full blur-2xl -mr-8 -mt-8"></div>
            <div className="relative flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500">
                <span className="material-symbols-outlined text-2xl">military_tech</span>
              </div>
              <div>
                <h3 className="text-2xl font-black text-gray-800">Lv.{user.level || 1}</h3>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Cấp bậc nhân viên</p>
              </div>
            </div>
          </div>

          {/* XP Progress Card */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-yellow-50 rounded-lg flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-lg">star</span>
                </div>
                <h3 className="text-lg font-black text-gray-800">{user.xp?.toLocaleString() || 0} XP</h3>
              </div>
              <span className="text-xs font-semibold text-gray-400">Mục tiêu: {xpForNextLevel.toLocaleString()} XP</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
              <div className="bg-gradient-to-r from-primary to-orange-400 h-3 rounded-full transition-all duration-500" style={{ width: `${xpProgress}%` }}></div>
            </div>
            <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm text-green-500">trending_up</span>
              Còn {(xpForNextLevel - (user.xp || 0)).toLocaleString()} XP để lên level!
            </p>
          </div>

          {/* Today Achievement */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Thành tích hôm nay</p>
              <h3 className="text-3xl font-black text-gray-800">{completedTasks} <span className="text-base font-normal text-gray-500">Nhiệm vụ</span></h3>
            </div>
            <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center border-4 border-white shadow-sm">
              <span className="material-symbols-outlined text-green-500 text-2xl">check_circle</span>
            </div>
          </div>
        </div>

        {/* Main Task Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Inventory Card */}
          <div
            onClick={() => navigate('/inventory')}
            className="group relative bg-white rounded-2xl border border-gray-100 p-7 cursor-pointer transition-all hover:shadow-xl hover:shadow-yellow-100 hover:border-yellow-300 hover:-translate-y-1 overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-100 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>

            <div className="relative">
              <div className="w-14 h-14 bg-primary text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-yellow-200">
                <span className="material-symbols-outlined text-2xl">inventory_2</span>
              </div>

              <h3 className="text-2xl font-black text-gray-800 mb-2">Kiểm Tồn Kho</h3>
              <p className="text-gray-400 mb-6">Đối soát hàng hóa trên kệ theo ca làm việc.</p>

              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 rounded-lg text-xs font-bold text-yellow-700">
                  <span className="material-symbols-outlined text-sm">bolt</span>
                  +200 XP
                </span>
                <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                  <span className="material-symbols-outlined">arrow_forward</span>
                </div>
              </div>
            </div>
          </div>

          {/* Expiry Card */}
          <div
            onClick={() => navigate('/expiry')}
            className="group relative bg-white rounded-2xl border border-gray-100 p-7 cursor-pointer transition-all hover:shadow-xl hover:shadow-orange-100 hover:border-orange-300 hover:-translate-y-1 overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-100 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>

            <div className="relative">
              <div className="w-14 h-14 bg-orange-500 text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-orange-200">
                <span className="material-symbols-outlined text-2xl">schedule</span>
              </div>

              <h3 className="text-2xl font-black text-gray-800 mb-2">Kiểm Date</h3>
              <p className="text-gray-400 mb-6">Kiểm tra hạn sử dụng sản phẩm sắp hết hạn.</p>

              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 rounded-lg text-xs font-bold text-orange-700">
                  <span className="material-symbols-outlined text-sm">bolt</span>
                  +350 XP
                </span>
                <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-colors">
                  <span className="material-symbols-outlined">arrow_forward</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Grid: Tasks + Accuracy Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tasks Section */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-500">task_alt</span>
                Nhiệm vụ của tôi
              </h3>
              <span className="text-xs font-medium text-gray-400">{tasks.length} nhiệm vụ đang chờ</span>
            </div>

            <div className="divide-y divide-gray-100">
              {tasks.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <span className="material-symbols-outlined text-gray-300 text-3xl">inbox</span>
                  </div>
                  <p className="text-gray-400 text-sm">Chưa có nhiệm vụ nào được giao</p>
                </div>
              ) : (
                tasks.slice(0, 3).map(t => (
                  <div key={t.id} className="p-5 hover:bg-gray-50 transition-colors cursor-pointer">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.type === 'AUDIT' ? 'bg-yellow-100 text-yellow-600' : 'bg-orange-100 text-orange-600'}`}>
                          <span className="material-symbols-outlined">{t.type === 'AUDIT' ? 'inventory' : 'update'}</span>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-800 text-sm">{t.title}</h4>
                          <p className="text-xs text-gray-400">{t.type === 'AUDIT' ? 'Kiểm kho' : 'Kiểm date'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-gray-800">{t.completed_items}<span className="text-sm text-gray-400 font-normal">/{t.target_items}</span></span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className={`h-2 rounded-full transition-all ${t.status === 'COMPLETED' ? 'bg-green-500' : 'bg-primary'}`} style={{ width: `${(t.completed_items / (t.target_items || 1)) * 100}%` }}></div>
                    </div>
                    <div className="mt-2 flex justify-between items-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${t.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {t.status === 'COMPLETED' ? 'Hoàn thành' : 'Đang làm'}
                      </span>
                      <button className="text-xs font-medium text-primary hover:text-primary-dark">{t.status === 'COMPLETED' ? 'Chi tiết' : 'Tiếp tục'} &gt;</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Accuracy Chart */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-6 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-gray-800 mb-1">Độ chính xác</h3>
              <p className="text-xs text-gray-400 mb-6">Thống kê 5 ngày gần nhất</p>

              <div className="flex items-end justify-between gap-2 h-32 mb-4">
                {accuracyData.map((value, idx) => (
                  <div key={idx} className="w-full bg-gray-100 rounded-t-lg relative group h-full flex flex-col-reverse">
                    <div
                      className={`w-full rounded-t-lg transition-all duration-500 ${idx === accuracyData.length - 1 ? 'bg-green-500 shadow-glow' : 'bg-primary group-hover:bg-primary-dark'}`}
                      style={{ height: `${value}%` }}
                    ></div>
                    <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-[10px] py-1 px-2 rounded transition-opacity whitespace-nowrap">
                      {value}%
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                {weekDays.map(day => (
                  <span key={day}>{day}</span>
                ))}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">Tổng sai lệch</p>
                  <p className="text-lg font-bold text-red-500">-12 sp</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Tổng khớp</p>
                  <p className="text-lg font-bold text-green-500">845 sp</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
