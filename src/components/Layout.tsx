import React from 'react';
import Sidebar from './Sidebar';
import { User } from '../types';

interface LayoutProps {
  user: User;
  children: React.ReactNode;
  currentView?: string;
  onNavigate?: (view: string) => void;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ user, children, onLogout }) => {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 text-secondary font-sans">
      <Sidebar
        user={user}
        collapsed={false}
        onToggle={() => { }}
        onLogout={onLogout}
      />
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        {children}
      </main>
    </div>
  );
};

export default Layout;
