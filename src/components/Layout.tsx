import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import NotificationBell from "./NotificationBell";
import { User } from "../types";

interface LayoutProps {
  user: User;
  children: React.ReactNode;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ user, children, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // ─── Theme ───
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("sunmart_theme");
    if (saved) return saved === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    document.documentElement.classList.add("theme-transition");
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("sunmart_theme", isDark ? "dark" : "light");
    const tid = setTimeout(() => document.documentElement.classList.remove("theme-transition"), 350);
    return () => clearTimeout(tid);
  }, [isDark]);

  // ─── User Dropdown ───
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen)
      document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDropdownOpen]);

  const userInitial = (user.name || "?").charAt(0).toUpperCase();

  return (
    <>
      <style>{LAYOUT_CSS}</style>
      <div className="layout-root">
        <Sidebar
          user={user}
          onLogout={onLogout}
          collapsed={false}
          onToggle={() => { }}
        />

        <div className="layout-main">
          {/* Topbar */}
          <header className="layout-topbar">
            {/* Left: Breadcrumbs portal */}
            <div className="layout-topbar-left">
              <div id="topbar-left" className="layout-topbar-portal"></div>
            </div>

            {/* Right: Theme toggle + Notifications + User avatar */}
            <div className="layout-topbar-right">
              {/* Theme Toggle */}
              <button
                onClick={() => setIsDark(!isDark)}
                className="layout-topbar-btn"
                title={isDark ? "Chuyển sang sáng" : "Chuyển sang tối"}
                aria-label="Đổi giao diện"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                  {isDark ? "light_mode" : "dark_mode"}
                </span>
              </button>

              {/* Notifications */}
              <NotificationBell userId={user.id} />

              {/* User Avatar Dropdown */}
              <div className="layout-avatar-wrap" ref={dropdownRef}>
                <div
                  className="layout-avatar"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <span className="layout-avatar-initial">{userInitial}</span>
                  )}
                </div>

                {/* Dropdown */}
                <div
                  className={`layout-dropdown ${isDropdownOpen ? "layout-dropdown-open" : ""}`}
                >
                  {/* User Info */}
                  <div className="layout-dropdown-header">
                    <div className="layout-dropdown-avatar">
                      {user.avatar ? (
                        <img src={user.avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        userInitial
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="layout-dropdown-name">{user.name}</div>
                      <div className="layout-dropdown-store">{user.store || "Sunmart"}</div>
                    </div>
                  </div>

                  <div style={{ padding: 6 }}>
                    <button
                      onClick={() => { navigate("/profile"); setIsDropdownOpen(false); }}
                      className="layout-dropdown-item"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18, marginRight: 12, color: "#A3A3A3" }}>person</span>
                      Hồ Sơ Cá Nhân
                    </button>

                    <button
                      onClick={() => { onLogout(); setIsDropdownOpen(false); }}
                      className="layout-dropdown-item layout-dropdown-logout"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18, marginRight: 12 }}>logout</span>
                      Đăng Xuất
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="layout-content">
            {children}
          </main>
        </div>
      </div>
    </>
  );
};

export default Layout;

const LAYOUT_CSS = `
/* ═══ LAYOUT — SunMart Redesign ═══ */
.layout-root {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: #F8F7F4;
  color: #171717;
  font-family: 'Inter', sans-serif;
  transition: background 0.2s, color 0.2s;
}

html.dark .layout-root {
  background: #0e0e0e;
  color: #e5e7eb;
}

.layout-main {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  position: relative;
}

/* ─── Topbar ─── */
.layout-topbar {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  border-bottom: 1px solid #EEEDE9;
  background: #FFFFFF;
  flex-shrink: 0;
  z-index: 30;
  transition: background 0.2s, border-color 0.2s;
}

html.dark .layout-topbar {
  background: #1a1a1a;
  border-bottom-color: rgba(255,255,255,0.06);
}

.layout-topbar-left {
  display: flex;
  align-items: center;
  height: 100%;
  width: 100%;
  flex: 1;
}

.layout-topbar-portal {
  display: flex;
  align-items: center;
  height: 100%;
  width: 100%;
  position: relative;
}

.layout-topbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  margin-left: 16px;
}

.layout-topbar-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  color: #A3A3A3;
  border: none;
  background: #F5F5F5;
  cursor: pointer;
  transition: all 0.2s;
}

.layout-topbar-btn:hover {
  color: #525252;
  background: #F5F5F0;
}

html.dark .layout-topbar-btn:hover {
  color: #D4D4D4;
  background: rgba(255,255,255,0.05);
}

/* ─── Avatar ─── */
.layout-avatar-wrap {
  position: relative;
  margin-left: 4px;
}

.layout-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #FACC15, #F59E0B);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid rgba(250, 204, 21, 0.3);
  transition: transform 0.15s;
}

.layout-avatar:hover {
  transform: scale(1.05);
}

.layout-avatar-initial {
  font-size: 14px;
  font-weight: 800;
  color: #171717;
}

/* ─── Dropdown ─── */
.layout-dropdown {
  position: absolute;
  right: 0;
  top: 100%;
  margin-top: 8px;
  width: 240px;
  background: #FFFFFF;
  border: 1px solid #EEEDE9;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.08);
  padding: 4px 0;
  z-index: 100;
  transform: scale(0.95) translateY(-4px);
  opacity: 0;
  pointer-events: none;
  transition: all 0.2s;
}

.layout-dropdown-open {
  opacity: 1;
  transform: scale(1) translateY(0);
  pointer-events: auto;
}

html.dark .layout-dropdown {
  background: #1f1f1f;
  border-color: rgba(255,255,255,0.08);
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}

.layout-dropdown-header {
  padding: 12px 16px;
  border-bottom: 1px solid #EEEDE9;
  display: flex;
  align-items: center;
  gap: 12px;
}

html.dark .layout-dropdown-header {
  border-bottom-color: rgba(255,255,255,0.06);
}

.layout-dropdown-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #FACC15, #F59E0B);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  color: #171717;
  flex-shrink: 0;
  overflow: hidden;
  border: 2px solid rgba(250, 204, 21, 0.3);
}

.layout-dropdown-name {
  font-size: 14px;
  font-weight: 700;
  color: #171717;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

html.dark .layout-dropdown-name { color: #e5e7eb; }

.layout-dropdown-store {
  font-size: 12px;
  color: #A3A3A3;
  font-weight: 500;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.layout-dropdown-item {
  width: 100%;
  text-align: left;
  padding: 8px 12px;
  font-size: 13px;
  color: #525252;
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  border-radius: 10px;
  font-weight: 600;
  font-family: inherit;
  transition: all 0.15s;
}

.layout-dropdown-item:hover {
  background: #F5F5F0;
  color: #171717;
}

html.dark .layout-dropdown-item { color: #A3A3A3; }
html.dark .layout-dropdown-item:hover { background: rgba(255,255,255,0.05); color: #e5e7eb; }

.layout-dropdown-logout:hover {
  background: #FEF2F2;
  color: #EF4444;
}

html.dark .layout-dropdown-logout:hover {
  background: rgba(239,68,68,0.1);
  color: #f87171;
}

/* ─── Content ─── */
.layout-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  background: #F8F7F4;
  transition: background 0.2s;
}

html.dark .layout-content {
  background: #0e0e0e;
}
`;
