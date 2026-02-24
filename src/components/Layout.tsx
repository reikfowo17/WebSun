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
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("sunmart_theme", isDark ? "dark" : "light");
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
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-[#0e0e0e] text-gray-800 dark:text-gray-200 font-sans transition-colors duration-200">
      <Sidebar
        user={user}
        onLogout={onLogout}
        collapsed={false}
        onToggle={() => { }}
      />

      <div className="flex flex-col flex-1 overflow-hidden relative">
        {/* Topbar */}
        <header className="h-[60px] flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-800/60 bg-white dark:bg-[#1a1a1a] flex-shrink-0 z-30 transition-colors duration-200">
          {/* Left: Breadcrumbs portal */}
          <div className="flex items-center h-full w-full flex-1">
            <div
              id="topbar-left"
              className="flex items-center h-full w-full relative"
            ></div>
          </div>

          {/* Right: Theme toggle + User avatar */}
          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
            {/* Theme Toggle */}
            <button
              onClick={() => setIsDark(!isDark)}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-all duration-200"
              title={isDark ? "Chuyển sang sáng" : "Chuyển sang tối"}
              aria-label="Đổi giao diện"
            >
              <span className="material-symbols-outlined text-[20px]">
                {isDark ? "light_mode" : "dark_mode"}
              </span>
            </button>

            {/* Notifications */}
            <NotificationBell userId={user.id} />

            {/* User Avatar Dropdown */}
            <div className="relative ml-1" ref={dropdownRef}>
              <div
                className="relative flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-yellow-100 to-yellow-200 overflow-hidden cursor-pointer border-2 border-yellow-300 transform transition-transform hover:scale-105"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-[14px] font-black text-yellow-700">
                    {userInitial}
                  </span>
                )}
              </div>

              {/* Dropdown */}
              <div
                className={`absolute right-0 top-full mt-2 w-56 bg-white dark:bg-[#1f1f1f] border border-gray-100 dark:border-gray-800 rounded-xl shadow-[0px_4px_24px_rgba(0,0,0,0.08)] py-1 transition-all duration-200 z-[100] transform origin-top-right ${isDropdownOpen ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"}`}
              >
                {/* User Info */}
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800/60 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-100 to-yellow-200 flex flex-shrink-0 items-center justify-center text-yellow-700 font-black overflow-hidden border-2 border-yellow-300">
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      userInitial
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                      {user.name}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 font-medium truncate mt-0.5">
                      {user.store || "Sunmart"}
                    </div>
                  </div>
                </div>

                <div className="p-1.5">
                  {/* Profile */}
                  <button
                    onClick={() => {
                      navigate("/profile");
                      setIsDropdownOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg flex items-center transition-colors font-medium"
                  >
                    <span className="material-symbols-outlined text-[18px] mr-3 text-gray-400">
                      person
                    </span>
                    Hồ Sơ Cá Nhân
                  </button>

                  {/* Logout */}
                  <button
                    onClick={() => {
                      onLogout();
                      setIsDropdownOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg flex items-center transition-colors font-medium"
                  >
                    <span className="material-symbols-outlined text-[18px] mr-3">
                      logout
                    </span>
                    Đăng Xuất
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-gray-50 dark:bg-[#0e0e0e] transition-colors duration-200">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
