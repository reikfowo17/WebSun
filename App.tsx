import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Expiry from './pages/Expiry';
import InventoryHQ from './pages/InventoryHQ';
import RecoveryHub from './pages/RecoveryHub';
import Profile from './pages/Profile';
import { User } from './types';
import { runBackend } from './services/api';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState('LOGIN');
  const [loading, setLoading] = useState(true);

  // Check session on load
  useEffect(() => {
    const checkSession = async () => {
      const savedToken = sessionStorage.getItem('sunmart_token');
      if (savedToken) {
        try {
          // This is a simplified check. In real app, verify token with backend.
          const savedUser = sessionStorage.getItem('sunmart_user');
          if (savedUser) {
            const u = JSON.parse(savedUser);
            setUser(u);
            setView(u.role === 'ADMIN' ? 'DASHBOARD' : 'EMPLOYEE_HOME');
          }
        } catch (e) {
          console.error(e);
        }
      }
      setLoading(false);
    };
    checkSession();
  }, []);

  const handleLogin = (u: User, token: string) => {
    setUser(u);
    sessionStorage.setItem('sunmart_token', token);
    sessionStorage.setItem('sunmart_user', JSON.stringify(u));
    setView(u.role === 'ADMIN' ? 'DASHBOARD' : 'EMPLOYEE_HOME');
  };

  const handleLogout = async () => {
    const token = sessionStorage.getItem('sunmart_token');
    if (token) await runBackend('logout', { token });
    sessionStorage.clear();
    setUser(null);
    setView('LOGIN');
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div></div>;

  // Show Register page
  if (view === 'REGISTER') {
    return (
      <Register
        onRegisterSuccess={() => setView('LOGIN')}
        onSwitchToLogin={() => setView('LOGIN')}
      />
    );
  }

  // Show Login page
  if (!user || view === 'LOGIN') {
    return (
      <Login
        onLoginSuccess={handleLogin}
        onSwitchToRegister={() => setView('REGISTER')}
      />
    );
  }

  const renderView = () => {
    switch (view) {
      case 'DASHBOARD':
      case 'EMPLOYEE_HOME':
        return <Dashboard user={user} onNavigate={setView} />;
      case 'AUDIT':
        return <Inventory user={user} onBack={() => setView('EMPLOYEE_HOME')} />;
      case 'EXPIRY_CONTROL':
        return <Expiry user={user} onBack={() => setView('EMPLOYEE_HOME')} />;
      case 'INVENTORY_HQ':
        return <InventoryHQ user={user} />;
      case 'RECOVERY_HUB':
        return <RecoveryHub />;
      case 'PROFILE':
        return <Profile user={user} />;
      default:
        return (
          <div className="p-10 text-center">
            <h2 className="text-2xl font-bold text-gray-400 mb-4">Under Construction</h2>
            <p className="text-gray-400">View: {view}</p>
            <button onClick={() => setView(user.role === 'ADMIN' ? 'DASHBOARD' : 'EMPLOYEE_HOME')} className="mt-4 px-4 py-2 bg-primary rounded-lg font-bold">Go Back</button>
          </div>
        );
    }
  };

  return (
    <Layout user={user} currentView={view} onNavigate={setView} onLogout={handleLogout}>
      {renderView()}
    </Layout>
  );
};

export default App;
