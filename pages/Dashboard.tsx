import React, { useEffect, useState } from 'react';
import { User, Task } from '../types';
import { runBackend } from '../services/api';

interface DashboardProps {
  user: User;
  onNavigate: (view: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onNavigate }) => {
  const [stats, setStats] = useState<any>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        if (user.role === 'ADMIN') {
          const res = await runBackend('getDashboardStats');
          if (res.success) setStats(res.stats);
        }

        const taskRes = await runBackend('getTasks', { assignee: user.role === 'ADMIN' ? null : user.name });
        if (taskRes.success) setTasks(taskRes.tasks);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user]);

  if (loading) return <div className="p-8 text-center text-gray-400">Đang tải dữ liệu...</div>;

  // --- ADMIN VIEW ---
  if (user.role === 'ADMIN') {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-black text-secondary uppercase tracking-tight">Admin Panel</h2>
            <p className="text-gray-500 text-sm">Trung tâm điều hành hệ thống</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span className="text-xs font-bold text-green-700 uppercase">System Active</span>
          </div>
        </header>

        <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-4">Launchpad</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Inventory HQ Card */}
          <div onClick={() => onNavigate('INVENTORY_HQ')} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:border-primary cursor-pointer transition-all shadow-sm hover:shadow-lg group">
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
          <div onClick={() => onNavigate('EXPIRY_HQ')} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:border-danger cursor-pointer transition-all shadow-sm hover:shadow-lg group">
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

          {/* Tasks Card */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:border-blue-500 cursor-pointer transition-all shadow-sm hover:shadow-lg group">
            <div className="h-32 bg-gradient-to-br from-blue-50 to-white p-6 relative">
              <span className="material-symbols-outlined absolute right-4 bottom-2 text-6xl text-blue-400 opacity-20">post_add</span>
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mb-4 text-blue-700 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined">post_add</span>
              </div>
              <h3 className="font-black text-lg text-secondary">Quản Lý Nhiệm Vụ</h3>
            </div>
            <div className="p-4 bg-white flex justify-between items-center">
              <span className="text-xs text-gray-500">Task Overview</span>
              <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold uppercase">{tasks.length} Active</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100"><h3 className="font-bold text-secondary">Nhiệm vụ hệ thống</h3></div>
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
                    <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${(t.completed_items / (t.target_items || 1)) * 100}%` }}></div>
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

  return (
    <div className="min-h-full bg-gray-50">
      {/* Clean Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-800">
              {greeting}, <span className="text-primary">{user.name.split(' ')[0]}</span>! 👋
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">Chọn công việc để bắt đầu ngày mới</p>
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-gray-400">{user.store || 'Sunmart'}</div>
              <div className="text-sm font-bold text-gray-700">{new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'short' })}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-gray-400">calendar_today</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Main Task Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
          {/* Inventory Card */}
          <div
            onClick={() => onNavigate('AUDIT')}
            className="group relative bg-white rounded-2xl border border-gray-200 p-6 cursor-pointer transition-all hover:shadow-xl hover:shadow-yellow-100 hover:border-yellow-300 overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/10 rounded-full translate-x-10 -translate-y-10" />

            <div className="relative">
              <div className="w-14 h-14 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-yellow-200 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined material-symbols-fill text-white text-2xl">inventory_2</span>
              </div>

              <h3 className="text-xl font-black text-gray-800 mb-1">Kiểm Tồn Kho</h3>
              <p className="text-sm text-gray-400 mb-6">Đối soát hàng hóa trên kệ theo ca</p>

              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 rounded-lg text-xs font-bold text-yellow-700">
                  <span className="material-symbols-outlined text-sm">bolt</span>
                  +200 XP
                </span>
                <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                  <span className="material-symbols-outlined text-lg">arrow_forward</span>
                </span>
              </div>
            </div>
          </div>

          {/* Expiry Card */}
          <div
            onClick={() => onNavigate('EXPIRY_CONTROL')}
            className="group relative bg-white rounded-2xl border border-gray-200 p-6 cursor-pointer transition-all hover:shadow-xl hover:shadow-orange-100 hover:border-orange-300 overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-400/10 rounded-full translate-x-10 -translate-y-10" />

            <div className="relative">
              <div className="w-14 h-14 bg-gradient-to-br from-orange-400 to-orange-500 rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-orange-200 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined material-symbols-fill text-white text-2xl">schedule</span>
              </div>

              <h3 className="text-xl font-black text-gray-800 mb-1">Kiểm Date</h3>
              <p className="text-sm text-gray-400 mb-6">Kiểm tra hạn sử dụng sản phẩm</p>

              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 rounded-lg text-xs font-bold text-orange-700">
                  <span className="material-symbols-outlined text-sm">bolt</span>
                  +350 XP
                </span>
                <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-all">
                  <span className="material-symbols-outlined text-lg">arrow_forward</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <span className="material-symbols-outlined text-blue-500">military_tech</span>
              </div>
              <div>
                <div className="text-xl font-black text-gray-800">Lv.{user.level}</div>
                <div className="text-[10px] text-gray-400 uppercase">Cấp bậc</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-50 flex items-center justify-center">
                <span className="material-symbols-outlined text-yellow-500">star</span>
              </div>
              <div>
                <div className="text-xl font-black text-gray-800">{user.xp}</div>
                <div className="text-[10px] text-gray-400 uppercase">Tổng XP</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                <span className="material-symbols-outlined text-green-500">check_circle</span>
              </div>
              <div>
                <div className="text-xl font-black text-gray-800">0</div>
                <div className="text-[10px] text-gray-400 uppercase">Hôm nay</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tasks Section */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-gray-400">task_alt</span>
              Nhiệm vụ của tôi
            </h3>
            <span className="text-xs text-gray-400">{tasks.length} nhiệm vụ</span>
          </div>
          <div className="p-4">
            {tasks.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-gray-300 text-3xl">inbox</span>
                </div>
                <p className="text-gray-400 text-sm">Chưa có nhiệm vụ nào được giao</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map(t => (
                  <div key={t.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.type === 'AUDIT' ? 'bg-yellow-100 text-yellow-600' : 'bg-orange-100 text-orange-600'}`}>
                        <span className="material-symbols-outlined">{t.type === 'AUDIT' ? 'inventory_2' : 'schedule'}</span>
                      </div>
                      <div>
                        <div className="font-bold text-sm text-gray-800">{t.title}</div>
                        <div className="text-xs text-gray-400">{t.type === 'AUDIT' ? 'Kiểm kho' : 'Kiểm date'}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-gray-800">{t.completed_items}/{t.target_items}</div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.status === 'COMPLETED' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}`}>
                        {t.status === 'COMPLETED' ? 'Hoàn thành' : 'Đang làm'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
