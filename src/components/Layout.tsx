import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { User } from '../types';
import { useLocation } from 'react-router-dom';

interface LayoutProps {
  user: User;
  children: React.ReactNode;
  currentView?: string;
  onNavigate?: (view: string) => void;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ user, children, onLogout }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const location = useLocation();

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/': return 'Bảng Điều Khiển';
      case '/hq': return 'Quản Lý Tồn Kho';
      case '/expiry-hq': return 'Quản Lý Hạn Dùng';
      case '/inventory': return 'Kiểm Kho';
      case '/expiry': return 'Kiểm Date';
      case '/profile': return 'Hồ Sơ';
      default: return 'Trang Chủ';
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 text-gray-800 font-sans">
      <Sidebar user={user} onLogout={onLogout} collapsed={false} onToggle={() => { }} />

      <div className="flex flex-col flex-1 overflow-hidden relative">
        {/* Topbar matching Supabase's structural placement */}
        <header className="h-[60px] flex items-center justify-between px-6 border-b border-gray-200 bg-white flex-shrink-0 z-30">
          {/* Left side: Navigation / Breadcrumbs portal target */}
          <div className="flex items-center h-full w-full flex-1">
            <div id="topbar-left" className="flex items-center h-full w-full relative">
            </div>
          </div>

          {/* Right side: Actions & User Menu */}
          <div className="flex items-center gap-4 flex-shrink-0 ml-4">
            <button className="text-gray-400 hover:text-gray-700 transition-colors p-1" title="Tìm kiếm">
              <span className="material-symbols-outlined text-[20px]">search</span>
            </button>
            <button className="text-gray-400 hover:text-gray-700 transition-colors p-1" title="Trợ giúp">
              <span className="material-symbols-outlined text-[20px]">help_outline</span>
            </button>

            {/* User Dropdown */}
            <div className="relative group ml-1">
              <div
                className="relative flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 overflow-hidden cursor-pointer border border-gray-200 transform transition-transform group-hover:scale-105"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                onMouseEnter={() => setIsDropdownOpen(true)}
                onMouseLeave={() => setIsDropdownOpen(false)}
              >
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[14px] font-bold text-gray-600">{user.name?.charAt(0)?.toUpperCase()}</span>
                )}
              </div>

              {/* Dropdown Menu */}
              <div
                className={`absolute right-0 top-full mt-2 w-56 bg-white border border-gray-100 rounded-xl shadow-[0px_4px_24px_rgba(0,0,0,0.08)] py-1 transition-all duration-200 z-[100] transform origin-top-right ${isDropdownOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}
                onMouseEnter={() => setIsDropdownOpen(true)}
                onMouseLeave={() => setIsDropdownOpen(false)}
              >
                <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-3 bg-gray-50/50">
                  <div className="w-10 h-10 rounded-full bg-yellow-100 flex flex-shrink-0 items-center justify-center text-yellow-600 font-bold overflow-hidden border border-yellow-200/50">
                    {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : user.name?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-gray-900 truncate">{user.name}</div>
                    <div className="text-xs text-gray-500 font-medium truncate mt-0.5">{user.store || 'Sunmart Space'}</div>
                  </div>
                </div>
                <div className="p-2">
                  <button
                    onClick={onLogout}
                    className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg flex items-center transition-colors font-medium"
                  >
                    <span className="material-symbols-outlined text-[18px] mr-3">logout</span>
                    Đăng xuất
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
