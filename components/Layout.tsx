import React from 'react';
import Sidebar from './Sidebar';
import { User } from '../types';

interface LayoutProps {
  user: User;
  children: React.ReactNode;
  currentView: string;
  onNavigate: (view: string) => void;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ user, children, currentView, onNavigate, onLogout }) => {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 text-secondary font-sans">
      <Sidebar
        user={user}
        currentView={currentView}
        onChangeView={onNavigate}
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
