import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { User } from "../types";

interface SidebarProps {
  user: User;
  currentView?: string;
  onChangeView?: (view: string) => void;
  collapsed: boolean;
  onToggle: () => void;
  onLogout: () => void;
}

type SidebarMode = "expanded" | "collapsed" | "hover";

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

const Sidebar: React.FC<SidebarProps> = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(() => {
    const saved = localStorage.getItem("sunmart_sidebar_mode");
    return (saved as SidebarMode) || "hover";
  });

  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const modeMenuRef = useRef<HTMLDivElement>(null);

  const isAdmin = user.role === "ADMIN";

  useEffect(() => {
    localStorage.setItem("sunmart_sidebar_mode", sidebarMode);
  }, [sidebarMode]);

  // Close mode menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        modeMenuRef.current &&
        !modeMenuRef.current.contains(event.target as Node)
      ) {
        setIsModeMenuOpen(false);
      }
    };
    if (isModeMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isModeMenuOpen]);

  const isExpanded =
    sidebarMode === "expanded" || (sidebarMode === "hover" && isHovered);

  const handleMouseEnter = () => {
    if (sidebarMode === "hover") {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    if (sidebarMode === "hover") {
      hoverTimeoutRef.current = setTimeout(() => {
        setIsHovered(false);
      }, 100);
    }
  };

  // ─── Navigation Groups ───
  const mainItems: NavItem[] = isAdmin
    ? [
        { path: "/", label: "Bảng Điều Khiển", icon: "dashboard" },
        { path: "/hq", label: "Quản Lý Tồn Kho", icon: "inventory_2" },
        { path: "/expiry-hq", label: "Quản Lý Hạn Dùng", icon: "event_busy" },
      ]
    : [
        { path: "/", label: "Trang chủ", icon: "grid_view" },
        { path: "/inventory", label: "Kiểm Kho", icon: "inventory_2" },
        { path: "/expiry", label: "Kiểm Date", icon: "history_toggle_off" },
      ];

  const bottomItems: NavItem[] = isAdmin
    ? [{ path: "/settings", label: "Cấu Hình Hệ Thống", icon: "settings" }]
    : [];

  const isActive = (path: string) => {
    if (path === "/" && location.pathname !== "/") return false;
    return location.pathname.startsWith(path);
  };

  // Reusable nav button renderer
  const renderNavItem = (item: NavItem) => {
    const active = isActive(item.path);
    return (
      <button
        key={item.path}
        onClick={() => navigate(item.path)}
        title={!isExpanded ? item.label : undefined}
        aria-label={item.label}
        className={`w-full flex items-center p-2 rounded-xl transition-all duration-200 group relative
          ${
            active
              ? "bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
              : "text-gray-500 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-white/5"
          }
        `}
      >
        {active && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-yellow-400 rounded-r-full" />
        )}
        <div className="w-[32px] h-[32px] flex items-center justify-center flex-shrink-0 ml-[4px]">
          <span
            className={`material-symbols-outlined text-[22px] transition-colors ${active ? "material-symbols-fill text-yellow-500" : "group-hover:text-gray-700"}`}
          >
            {item.icon}
          </span>
        </div>
        <span
          className={`whitespace-nowrap font-bold text-sm transition-opacity duration-200 ${isExpanded ? "opacity-100 ml-2" : "opacity-0 w-0 overflow-hidden"}`}
        >
          {item.label}
        </span>
      </button>
    );
  };

  return (
    <aside
      className="h-full flex-shrink-0 relative z-40 transition-all duration-300"
      style={{ width: sidebarMode === "expanded" ? 260 : 72 }}
    >
      <div
        className={`fixed left-0 top-0 h-full bg-white dark:bg-[#1a1a1a] flex flex-col transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] z-50 border-r border-gray-200 dark:border-gray-800/60 ${
          isExpanded
            ? `w-[260px] ${sidebarMode === "hover" ? "shadow-[4px_0_24px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_24px_rgba(0,0,0,0.3)]" : ""}`
            : "w-[72px]"
        }`}
        style={{ willChange: "width" }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* ─── Header ─── */}
        <div className="h-[60px] px-4 flex items-center border-b border-gray-100 dark:border-gray-800/60 flex-shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-yellow-500/20">
            <span className="material-symbols-outlined material-symbols-fill text-white">
              sunny
            </span>
          </div>
          <div
            className={`ml-3 flex flex-col overflow-hidden transition-opacity duration-300 ${isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0"}`}
          >
            <span
              className="text-sm font-black text-gray-800 dark:text-gray-100 tracking-tight"
              style={{ fontFamily: '"Arial Rounded MT Bold", sans-serif' }}
            >
              SUNMART
            </span>
            <span className="text-[10px] font-bold text-yellow-600 dark:text-yellow-500 uppercase tracking-widest leading-none mt-0.5">
              {user.role}
            </span>
          </div>
        </div>

        {/* ─── Main Navigation ─── */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto overflow-x-hidden custom-scrollbar flex flex-col">
          <div className="flex flex-col gap-1">
            {mainItems.map(renderNavItem)}
          </div>

          {/* Separator + Bottom Nav Group (Settings) */}
          {bottomItems.length > 0 && (
            <>
              <div className="my-3 mx-1 border-t border-gray-100 dark:border-gray-800/60" />
              <div className="flex flex-col gap-1">
                {bottomItems.map(renderNavItem)}
              </div>
            </>
          )}
        </nav>

        {/* ─── Footer: Mode Toggle ─── */}
        <div className="flex-shrink-0 border-t border-gray-100 dark:border-gray-800/60 bg-white dark:bg-[#1a1a1a] p-2 flex flex-col gap-1">
          {/* Sidebar Mode Toggle */}
          <div className="relative" ref={modeMenuRef}>
            <button
              onClick={() => setIsModeMenuOpen(!isModeMenuOpen)}
              className="w-10 h-10 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
              title="Chế độ Sidebar"
              aria-label="Chế độ Sidebar"
            >
              <span className="material-symbols-outlined text-[20px]">
                view_sidebar
              </span>
            </button>

            {isModeMenuOpen && (
              <div className="absolute bottom-[calc(100%+8px)] left-0 w-[220px] bg-white dark:bg-[#1f1f1f] border border-gray-200 dark:border-gray-800 rounded-xl shadow-[0px_8px_32px_rgba(0,0,0,0.12)] py-1 z-[100] overflow-hidden">
                <div className="px-4 py-2 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-800 mb-1">
                  Chế độ Sidebar
                </div>

                <button
                  onClick={() => {
                    setSidebarMode("expanded");
                    setIsModeMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-[13px] text-gray-700 dark:text-gray-300 flex items-center hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer outline-none font-semibold"
                >
                  <div className="w-6 flex justify-center mr-2">
                    {sidebarMode === "expanded" && (
                      <span className="material-symbols-outlined text-[18px] text-yellow-500">
                        check
                      </span>
                    )}
                  </div>
                  Luôn mở (Ghim)
                </button>
                <button
                  onClick={() => {
                    setSidebarMode("collapsed");
                    setIsModeMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-[13px] text-gray-700 dark:text-gray-300 flex items-center hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer outline-none font-semibold"
                >
                  <div className="w-6 flex justify-center mr-2">
                    {sidebarMode === "collapsed" && (
                      <span className="material-symbols-outlined text-[18px] text-yellow-500">
                        check
                      </span>
                    )}
                  </div>
                  Thu gọn
                </button>
                <button
                  onClick={() => {
                    setSidebarMode("hover");
                    setIsModeMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-[13px] text-gray-700 dark:text-gray-300 flex items-center hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer outline-none font-semibold"
                >
                  <div className="w-6 flex justify-center mr-2">
                    {sidebarMode === "hover" && (
                      <span className="material-symbols-outlined text-[18px] text-yellow-500">
                        check
                      </span>
                    )}
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
