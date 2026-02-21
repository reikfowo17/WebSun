import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User } from '../types';

interface SidebarProps {
  user: User;
  currentView?: string; // Optional now
  onChangeView?: (view: string) => void; // Optional now
  collapsed: boolean;
  onToggle: () => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isAdmin = user.role === 'ADMIN';

  // Auto expand/collapse based on hover
  const isExpanded = isHovered;

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 100);
  };

  const menuItems = [
    ...(isAdmin ? [
      { path: '/', label: 'Bảng Điều Khiển', icon: 'dashboard' },
      { path: '/hq', label: 'Quản Lý Tồn Kho', icon: 'inventory_2' },
      { path: '/expiry-hq', label: 'Quản Lý Hạn Dùng', icon: 'event_busy' }
    ] : [
      { path: '/', label: 'Trang chủ', icon: 'grid_view' },
      { path: '/inventory', label: 'Kiểm Kho', icon: 'inventory_2' },
      { path: '/expiry', label: 'Kiểm Date', icon: 'history_toggle_off' }
    ]),
    { path: '/profile', label: 'Hồ Sơ', icon: 'person' }
  ];

  const isActive = (path: string) => {
    if (path === '/' && location.pathname !== '/') return false;
    return location.pathname.startsWith(path);
  };

  return (
    <aside className="h-full flex-shrink-0 relative z-40 transition-all duration-300" style={{ width: 72 }}>
      <div
        className={`fixed top-0 left-0 h-full bg-white flex flex-col transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden ${isExpanded ? 'w-[280px] shadow-[4px_0_24px_rgba(0,0,0,0.08)] border-r-transparent' : 'w-[72px] border-r border-gray-200'
          }`}
        style={{ willChange: 'width' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Header */}
        <div className="h-[72px] px-4 flex items-center border-b border-gray-100 flex-shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-yellow-500/20">
            <span className="material-symbols-outlined material-symbols-fill text-white">sunny</span>
          </div>
          <div className={`ml-3 flex flex-col overflow-hidden transition-opacity duration-300 ${isExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}>
            <span className="text-sm font-black text-gray-800 tracking-tight" style={{ fontFamily: '"Arial Rounded MT Bold", sans-serif' }}>SUNMART</span>
            <span className="text-[10px] font-bold text-yellow-600 uppercase tracking-widest leading-none mt-0.5">{user.role}</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto overflow-x-hidden custom-scrollbar">
          <div className="flex flex-col gap-1">
            {menuItems.map(item => {
              const active = isActive(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  title={!isExpanded ? item.label : undefined}
                  className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 group relative
                ${active
                      ? 'bg-yellow-50/50 text-yellow-700'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}
              `}
                >
                  {/* Active Indicator Line */}
                  {active && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-yellow-500 rounded-r-full" />
                  )}
                  {/* Fixed width icon to prevent layout shift */}
                  <div className="w-[24px] h-[24px] flex items-center justify-center flex-shrink-0 ml-[4px]">
                    <span className={`material-symbols-outlined text-[24px] transition-colors ${active ? 'material-symbols-fill text-yellow-500' : 'group-hover:text-gray-700'}`}>
                      {item.icon}
                    </span>
                  </div>
                  <span className={`whitespace-nowrap font-bold text-sm transition-opacity duration-200 ${isExpanded ? 'opacity-100 ml-3' : 'opacity-0 w-0 overflow-hidden'}`}>{item.label}</span>
                </button>
              )
            })}
          </div>
        </nav>

        {/* User Footer */}
        <div className={`mt-auto border-t border-gray-100 bg-white p-3 ${!isExpanded ? 'flex justify-center' : ''}`}>
          <div className={`relative group transition-all duration-300 ${isExpanded ? 'bg-gray-50 rounded-xl p-3 w-full' : ''}`}>
            <div className="flex items-center w-full justify-between">
              {/* Avatar */}
              <div className="relative flex-shrink-0 cursor-pointer" title={!isExpanded ? user.name : undefined} onClick={!isExpanded ? onLogout : undefined}>
                <img
                  src={user.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}&backgroundColor=fbbf24`}
                  alt={user.name}
                  className="w-10 h-10 rounded-xl border border-gray-200 shadow-sm"
                />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-lg flex items-center justify-center text-[10px] font-black text-white shadow-sm border border-white">
                  {user.level}
                </div>

                {/* Tooltip Logout when collapsed */}
                {!isExpanded && (
                  <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 bg-gray-900 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                    <span className="material-symbols-outlined text-[12px] mr-1 align-middle">logout</span>
                    Đăng xuất
                  </div>
                )}
              </div>

              {/* Info */}
              <div className={`ml-3 flex-1 min-w-0 transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0 w-0 hidden'}`}>
                <div className="font-bold text-sm text-gray-800 truncate leading-tight">{user.name}</div>
                <div className="text-[11px] text-gray-500 font-medium truncate mt-0.5">{user.store || 'Sunmart'}</div>
              </div>

              {/* Logout Btn Expanded */}
              {isExpanded && (
                <button
                  onClick={onLogout}
                  title="Đăng xuất"
                  className="w-8 h-8 flex flex-shrink-0 items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">logout</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
