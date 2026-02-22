import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User } from '../types';

interface SidebarProps {
  user: User;
  currentView?: string;
  onChangeView?: (view: string) => void;
  collapsed: boolean;
  onToggle: () => void;
  onLogout: () => void;
}

type SidebarMode = 'expanded' | 'collapsed' | 'hover';

const Sidebar: React.FC<SidebarProps> = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(() => {
    const saved = localStorage.getItem('sunmart_sidebar_mode');
    return (saved as SidebarMode) || 'hover';
  });

  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const modeMenuRef = useRef<HTMLDivElement>(null);

  const isAdmin = user.role === 'ADMIN';

  useEffect(() => {
    localStorage.setItem('sunmart_sidebar_mode', sidebarMode);
  }, [sidebarMode]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(event.target as Node)) {
        setIsModeMenuOpen(false);
      }
    };
    if (isModeMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isModeMenuOpen]);

  const isExpanded = sidebarMode === 'expanded' || (sidebarMode === 'hover' && isHovered);

  const handleMouseEnter = () => {
    if (sidebarMode === 'hover') {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    if (sidebarMode === 'hover') {
      hoverTimeoutRef.current = setTimeout(() => {
        setIsHovered(false);
      }, 100);
    }
  };

  const menuItems = [
    ...(isAdmin ? [
      { path: '/', label: 'Bảng Điều Khiển', icon: 'dashboard' },
      { path: '/hq', label: 'Quản Lý Tồn Kho', icon: 'inventory_2' },
      { path: '/expiry-hq', label: 'Quản Lý Hạn Dùng', icon: 'event_busy' },
      { path: '/settings', label: 'Cấu hình Hệ thống', icon: 'settings' }
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
    <aside className="h-full flex-shrink-0 relative z-40 transition-all duration-300" style={{ width: sidebarMode === 'expanded' ? 260 : 72 }}>
      <div
        className={`fixed left-0 top-0 h-full bg-white flex flex-col transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] z-50 border-r border-gray-200 ${isExpanded
          ? `w-[260px] ${sidebarMode === 'hover' ? 'shadow-[4px_0_24px_rgba(0,0,0,0.08)]' : ''}`
          : 'w-[72px]'
          }`}
        style={{ willChange: 'width' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Header */}
        <div className="h-[60px] px-4 flex items-center border-b border-gray-100 flex-shrink-0">
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
                  className={`w-full flex items-center p-2 rounded-xl transition-all duration-200 group relative
                    ${active
                      ? 'bg-yellow-50 text-yellow-700'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                    }
                  `}
                >
                  {/* Active Indicator Line */}
                  {active && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-yellow-400 rounded-r-full" />
                  )}
                  {/* Icon */}
                  <div className="w-[32px] h-[32px] flex items-center justify-center flex-shrink-0 ml-[4px]">
                    <span className={`material-symbols-outlined text-[22px] transition-colors ${active ? 'material-symbols-fill text-yellow-500' : 'group-hover:text-gray-700'}`}>
                      {item.icon}
                    </span>
                  </div>
                  <span className={`whitespace-nowrap font-bold text-sm transition-opacity duration-200 ${isExpanded ? 'opacity-100 ml-2' : 'opacity-0 w-0 overflow-hidden'}`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Footer Area with Sidebar Mode Control */}
        <div className="flex-shrink-0 border-t border-gray-100 bg-white flex flex-col p-2">
          {/* Sidebar control popover menu trigger */}
          <div className="relative" ref={modeMenuRef}>
            <button
              onClick={() => setIsModeMenuOpen(!isModeMenuOpen)}
              className="w-10 h-10 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-800 hover:bg-gray-50 transition-colors"
              title="Chế độ Sidebar"
            >
              <span className="material-symbols-outlined text-[20px]">view_sidebar</span>
            </button>

            {/* Sidebar control Mode Menu Dropdown */}
            {isModeMenuOpen && (
              <div
                className={`absolute ${isExpanded ? 'bottom-[calc(100%+8px)] left-0 w-full min-w-[200px]' : 'bottom-0 left-[calc(100%+8px)] w-[220px]'} bg-white border border-gray-200 rounded-xl shadow-[0px_8px_32px_rgba(0,0,0,0.12)] py-1 z-[100] overflow-hidden`}
              >
                <div className="px-4 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100 mb-1">
                  Chế độ Sidebar
                </div>

                <button
                  onClick={() => { setSidebarMode('expanded'); setIsModeMenuOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-[13px] text-gray-700 flex items-center hover:bg-gray-50 cursor-pointer outline-none font-semibold"
                >
                  <div className="w-6 flex justify-center mr-2">
                    {sidebarMode === 'expanded' && <span className="material-symbols-outlined text-[18px] text-yellow-500">check</span>}
                  </div>
                  Luôn mở (Ghim)
                </button>
                <button
                  onClick={() => { setSidebarMode('collapsed'); setIsModeMenuOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-[13px] text-gray-700 flex items-center hover:bg-gray-50 cursor-pointer outline-none font-semibold"
                >
                  <div className="w-6 flex justify-center mr-2">
                    {sidebarMode === 'collapsed' && <span className="material-symbols-outlined text-[18px] text-yellow-500">check</span>}
                  </div>
                  Thu gọn
                </button>
                <button
                  onClick={() => { setSidebarMode('hover'); setIsModeMenuOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-[13px] text-gray-700 flex items-center hover:bg-gray-50 cursor-pointer outline-none font-semibold"
                >
                  <div className="w-6 flex justify-center mr-2">
                    {sidebarMode === 'hover' && <span className="material-symbols-outlined text-[18px] text-yellow-500">check</span>}
                  </div>
                  Mở khi lướt chuột
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
