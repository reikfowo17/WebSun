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
      { path: "/cash-hq", label: "Quản Lý Két", icon: "payments" },
      { path: "/task-hq", label: "Nhiệm Vụ Trong Ca", icon: "checklist" },
      { path: "/schedule", label: "Lịch Làm Việc", icon: "calendar_month" },
    ]
    : [
      { path: "/", label: "Trang chủ", icon: "grid_view" },
      { path: "/inventory", label: "Kiểm Kho", icon: "inventory_2" },
      { path: "/expiry", label: "Kiểm Date", icon: "history_toggle_off" },
      { path: "/shift", label: "Bàn Giao Ca", icon: "swap_horiz" },
      { path: "/schedule", label: "Lịch Làm Việc", icon: "calendar_month" },
    ];

  const bottomItems: NavItem[] = isAdmin
    ? [{ path: "/settings", label: "Cấu Hình Hệ Thống", icon: "settings" }]
    : [];

  const isActive = (path: string) => {
    if (path === "/" && location.pathname !== "/") return false;
    return location.pathname.startsWith(path);
  };

  // Reusable nav button renderer — Dark theme
  const renderNavItem = (item: NavItem) => {
    const active = isActive(item.path);
    return (
      <button
        key={item.path}
        onClick={() => navigate(item.path)}
        title={!isExpanded ? item.label : undefined}
        aria-label={item.label}
        className="sb-nav-item"
        data-active={active || undefined}
      >
        {active && <div className="sb-nav-indicator" />}
        <div className="sb-nav-icon-wrap">
          <span
            className={`material-symbols-outlined sb-nav-icon ${active ? "material-symbols-fill" : ""}`}
          >
            {item.icon}
          </span>
        </div>
        <span
          className="sb-nav-label"
          style={{
            opacity: isExpanded ? 1 : 0,
            width: isExpanded ? "auto" : 0,
            overflow: "hidden",
          }}
        >
          {item.label}
        </span>
      </button>
    );
  };

  return (
    <>
      <style>{SIDEBAR_CSS}</style>
      <aside
        className="sb-spacer"
        style={{ width: sidebarMode === "expanded" ? 260 : 72 }}
      >
        <div
          className={`sb-root ${isExpanded ? "sb-expanded" : "sb-collapsed"} ${sidebarMode === "hover" && isExpanded ? "sb-shadow" : ""}`}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* ─── Header ─── */}
          <div className="sb-header">
            <div className="sb-logo">
              <span className="material-symbols-outlined material-symbols-fill sb-logo-icon">
                sunny
              </span>
            </div>
            <div
              className="sb-brand"
              style={{
                opacity: isExpanded ? 1 : 0,
                width: isExpanded ? "auto" : 0,
                overflow: "hidden",
              }}
            >
              <span className="sb-brand-name">SUNMART</span>
              <span className="sb-brand-role">{user.role === 'ADMIN' ? 'ADMIN PORTAL' : 'EMPLOYEE'}</span>
            </div>
          </div>

          {/* ─── Main Navigation ─── */}
          <nav className="sb-nav">
            <div className="sb-nav-group">
              {mainItems.map(renderNavItem)}
            </div>

            {bottomItems.length > 0 && (
              <>
                <div className="sb-divider" />
                <div className="sb-nav-group">
                  {bottomItems.map(renderNavItem)}
                </div>
              </>
            )}
          </nav>

          {/* ─── Footer: Mode Toggle ─── */}
          <div className="sb-footer">
            <div className="relative" ref={modeMenuRef}>
              <button
                onClick={() => setIsModeMenuOpen(!isModeMenuOpen)}
                className="sb-mode-btn"
                title="Chế độ Sidebar"
                aria-label="Chế độ Sidebar"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                  view_sidebar
                </span>
              </button>

              {isModeMenuOpen && (
                <div className="sb-mode-menu">
                  <div className="sb-mode-menu-title">Chế độ Sidebar</div>
                  {[
                    { mode: "expanded" as SidebarMode, label: "Luôn mở (Ghim)" },
                    { mode: "collapsed" as SidebarMode, label: "Thu gọn" },
                    { mode: "hover" as SidebarMode, label: "Mở khi lướt chuột" },
                  ].map(({ mode, label }) => (
                    <button
                      key={mode}
                      onClick={() => { setSidebarMode(mode); setIsModeMenuOpen(false); }}
                      className="sb-mode-option"
                    >
                      <div style={{ width: 24, display: "flex", justifyContent: "center", marginRight: 8 }}>
                        {sidebarMode === mode && (
                          <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#FACC15" }}>
                            check
                          </span>
                        )}
                      </div>
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;

const SIDEBAR_CSS = `
/* ═══ DARK SIDEBAR — SunMart Redesign ═══ */
.sb-spacer {
  height: 100%;
  flex-shrink: 0;
  position: relative;
  z-index: 40;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.sb-root {
  position: fixed;
  left: 0;
  top: 0;
  height: 100%;
  background: #0F0F0F;
  display: flex;
  flex-direction: column;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 50;
  will-change: width;
}

.sb-expanded { width: 260px; }
.sb-collapsed { width: 72px; }
.sb-shadow { box-shadow: 4px 0 24px rgba(0,0,0,0.3); }

/* ─── Header ─── */
.sb-header {
  height: 72px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.sb-logo {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: linear-gradient(135deg, #FACC15, #F59E0B);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(250, 204, 21, 0.3);
}

.sb-logo-icon {
  color: #FFFFFF;
  font-size: 22px !important;
}

.sb-brand {
  display: flex;
  flex-direction: column;
  transition: opacity 0.3s;
  white-space: nowrap;
}

.sb-brand-name {
  font-size: 16px;
  font-weight: 800;
  color: #FFFFFF;
  letter-spacing: 1px;
  line-height: 1.2;
}

.sb-brand-role {
  font-size: 9px;
  font-weight: 600;
  color: #FACC15;
  text-transform: uppercase;
  letter-spacing: 2px;
  margin-top: 2px;
}

/* ─── Navigation ─── */
.sb-nav {
  flex: 1;
  padding: 16px 12px;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
}

.sb-nav-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sb-divider {
  margin: 12px 4px;
  border-top: 1px solid rgba(255,255,255,0.06);
}

.sb-nav-item {
  width: 100%;
  display: flex;
  align-items: center;
  padding: 6px 8px;
  border-radius: 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  position: relative;
  transition: all 0.2s;
  font-family: inherit;
}

.sb-nav-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.sb-nav-item[data-active] {
  background: rgba(250, 204, 21, 0.12);
}

.sb-nav-indicator {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 24px;
  background: #FACC15;
  border-radius: 0 4px 4px 0;
}

.sb-nav-icon-wrap {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-left: 4px;
}

.sb-nav-icon {
  font-size: 22px !important;
  color: #737373;
  transition: color 0.2s;
}

.sb-nav-item:hover .sb-nav-icon {
  color: #A3A3A3;
}

.sb-nav-item[data-active] .sb-nav-icon {
  color: #FACC15;
}

.sb-nav-label {
  white-space: nowrap;
  font-size: 14px;
  font-weight: 600;
  color: #A3A3A3;
  margin-left: 8px;
  transition: opacity 0.2s;
}

.sb-nav-item[data-active] .sb-nav-label {
  color: #FACC15;
  font-weight: 700;
}

.sb-nav-item:hover .sb-nav-label {
  color: #D4D4D4;
}

/* ─── Footer ─── */
.sb-footer {
  flex-shrink: 0;
  border-top: 1px solid rgba(255,255,255,0.06);
  padding: 8px 12px;
}

.sb-mode-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  color: #737373;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.sb-mode-btn:hover {
  color: #D4D4D4;
  background: rgba(255,255,255,0.06);
}

.sb-mode-menu {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  width: 220px;
  background: #1A1A1A;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  padding: 4px 0;
  z-index: 100;
}

.sb-mode-menu-title {
  padding: 8px 16px;
  font-size: 11px;
  font-weight: 700;
  color: #737373;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  margin-bottom: 4px;
}

.sb-mode-option {
  width: 100%;
  text-align: left;
  padding: 8px 16px;
  font-size: 13px;
  color: #D4D4D4;
  display: flex;
  align-items: center;
  border: none;
  background: transparent;
  cursor: pointer;
  font-weight: 600;
  font-family: inherit;
  transition: background 0.15s;
}

.sb-mode-option:hover {
  background: rgba(255,255,255,0.06);
}

/* Dark mode overrides — sidebar stays dark always */
html.dark .sb-root { background: #0F0F0F; }
`;
