import React, { useState, useRef } from 'react';
import { User } from '../types';

interface SidebarProps {
  user: User;
  currentView: string;
  onChangeView: (view: string) => void;
  collapsed: boolean;
  onToggle: () => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ user, currentView, onChangeView, onLogout }) => {
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isAdmin = user.role === 'ADMIN';

  // Auto expand/collapse based on hover - like Supabase
  const isExpanded = isHovered;

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    // Add small delay to prevent flicker when cursor moves slightly
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 100);
  };

  const menuItems = [
    ...(isAdmin ? [
      { id: 'DASHBOARD', label: 'Bảng Điều Khiển', icon: 'dashboard' },
      { id: 'INVENTORY_HQ', label: 'Thiết Lập Kiểm Tồn', icon: 'inventory_2' },
      { id: 'EXPIRY_HQ', label: 'Thiết Lập Hạn Dùng', icon: 'event_busy' },
      { id: 'INVENTORY_REVIEW', label: 'Tổng Hợp Tồn Kho', icon: 'fact_check' },
      { id: 'RECOVERY_HUB', label: 'Truy Thu', icon: 'account_balance_wallet' }
    ] : [
      { id: 'EMPLOYEE_HOME', label: 'Trang chủ', icon: 'grid_view' },
      { id: 'AUDIT', label: 'Kiểm Kho', icon: 'inventory_2' },
      { id: 'EXPIRY_CONTROL', label: 'Kiểm Date', icon: 'history_toggle_off' }
    ]),
    // Profile is now a regular menu item
    { id: 'PROFILE', label: 'Hồ Sơ', icon: 'person' }
  ];

  // Calculate XP progress (kept for future use)
  const xpPerLevel = 500;
  const xpInCurrentLevel = user.xp % xpPerLevel;
  const progressPercent = (xpInCurrentLevel / xpPerLevel) * 100;

  return (
    <aside
      className={`h-full bg-white border-r border-gray-200 flex flex-col flex-shrink-0 transition-all duration-200 ease-out relative z-30 ${isExpanded ? 'w-[280px]' : 'w-[72px]'
        }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Header */}
      <div className={`p-4 flex items-center gap-3 border-b border-gray-100 ${!isExpanded ? 'justify-center' : ''}`}>
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 shadow-lg shadow-yellow-200/50">
          <span className="material-symbols-outlined material-symbols-fill text-white">sunny</span>
        </div>
        {isExpanded && (
          <div className="flex flex-col overflow-hidden">
            <span className="text-sm font-black text-secondary uppercase tracking-tighter whitespace-nowrap">Sunmart</span>
            <span className="text-[10px] font-bold text-primary-dark uppercase tracking-widest whitespace-nowrap">{user.role}</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 overflow-y-auto overflow-x-hidden">
        {menuItems.map(item => (
          <button
            key={item.id}
            onClick={() => onChangeView(item.id)}
            title={!isExpanded ? item.label : undefined}
            className={`w-full flex items-center gap-3 p-3 rounded-xl mb-1 transition-all text-sm font-semibold text-left group
              ${currentView === item.id
                ? 'bg-yellow-50 text-primary-dark font-bold'
                : 'text-gray-500 hover:bg-gray-50 hover:text-secondary'}
              ${!isExpanded ? 'justify-center' : ''}
            `}
          >
            <span className={`material-symbols-outlined text-xl flex-shrink-0 ${currentView === item.id ? 'material-symbols-fill' : ''}`}>
              {item.icon}
            </span>
            {isExpanded && (
              <span className="whitespace-nowrap overflow-hidden">{item.label}</span>
            )}
          </button>
        ))}
      </nav>

      {/* User Footer */}
      <div className={`border-t border-gray-100 p-3 ${!isExpanded ? 'flex justify-center' : ''}`}>
        {isExpanded ? (
          <div className="bg-gray-50 rounded-xl p-3">
            {/* User Info Row with Logout Icon */}
            <div className="flex items-center gap-3">
              <div className="relative flex-shrink-0">
                <img
                  src={user.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}&backgroundColor=fbbf24`}
                  alt={user.name}
                  className="w-10 h-10 rounded-xl border-2 border-yellow-400/50"
                />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-yellow-400 rounded-md flex items-center justify-center text-[10px] font-black text-secondary shadow-sm">
                  {user.level}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-gray-800 truncate">{user.name}</div>
                <div className="text-[10px] text-gray-400 font-medium">{user.store || 'Sunmart'}</div>
              </div>
              {/* Compact Logout Icon */}
              <button
                onClick={onLogout}
                title="Đăng xuất"
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
              >
                <span className="material-symbols-outlined text-lg">logout</span>
              </button>
            </div>
          </div>
        ) : (
          // Collapsed: Just avatar
          <div className="relative group cursor-pointer" title={user.name}>
            <img
              src={user.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}&backgroundColor=fbbf24`}
              alt={user.name}
              className="w-10 h-10 rounded-xl border-2 border-yellow-400/50"
            />
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-yellow-400 rounded flex items-center justify-center text-[8px] font-black text-secondary">
              {user.level}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
