import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

// Contexts
import { UserProvider, useUser } from './contexts';
import { ToastProvider, useToast } from './contexts';

// Components
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';

// Pages (lazy load)
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Inventory = React.lazy(() => import('./pages/Inventory'));
const Expiry = React.lazy(() => import('./pages/Expiry'));
const InventoryHQ = React.lazy(() => import('./pages/InventoryHQ'));
const ExpiryHQ = React.lazy(() => import('./pages/ExpiryHQ'));
const Profile = React.lazy(() => import('./pages/Profile'));
const Settings = React.lazy(() => import('./pages/Settings'));

const pageVariants = {
  initial: { opacity: 0, x: 20 },
  in: { opacity: 1, x: 0 },
  out: { opacity: 0, x: -20 }
};

const pageTransition = {
  ease: 'anticipate',
  duration: 0.3
} as const;

const AnimatedPage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <motion.div
    initial="initial"
    animate="in"
    exit="out"
    variants={pageVariants}
    transition={pageTransition}
    className="h-full w-full"
  >
    {children}
  </motion.div>
);

const LoadingSkeleton: React.FC = () => (
  <div className="h-full flex items-center justify-center bg-gray-50 min-h-screen">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
      <p className="text-gray-500 mt-4 text-sm">Đang tải...</p>
    </div>
  </div>
);

const ProtectedLayout: React.FC = () => {
  const { isAuthenticated, isLoading, user, logout } = useUser();
  const location = useLocation();

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <Layout
      user={user}
      onLogout={logout}
    >
      <Suspense fallback={<LoadingSkeleton />}>
        <Outlet />
      </Suspense>
    </Layout>
  );
};

const AppRoutes: React.FC = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode='wait'>
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<AnimatedPage><PublicOnlyRoute><Login /></PublicOnlyRoute></AnimatedPage>} />
        <Route path="/register" element={<AnimatedPage><PublicOnlyRoute><Register /></PublicOnlyRoute></AnimatedPage>} />

        {/* Protected Routes */}
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<AnimatedPage><DashboardWrapper /></AnimatedPage>} />
          <Route path="/inventory" element={<AnimatedPage><InventoryWrapper /></AnimatedPage>} />
          <Route path="/expiry" element={<AnimatedPage><ExpiryWrapper /></AnimatedPage>} />
          <Route path="/hq" element={<AnimatedPage><InventoryHQWrapper /></AnimatedPage>} />
          <Route path="/expiry-hq" element={<AnimatedPage><ExpiryHQWrapper /></AnimatedPage>} />
          <Route path="/profile" element={<AnimatedPage><ProfileWrapper /></AnimatedPage>} />
          <Route path="/settings" element={<AnimatedPage><SettingsWrapper /></AnimatedPage>} />
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
};

const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useUser();
  if (isLoading) return <LoadingSkeleton />;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
};

// Props Adapters
const DashboardWrapper = () => {
  const { user } = useUser();
  return user ? <Dashboard user={user} /> : null;
};

const InventoryWrapper = () => {
  const { user } = useUser();
  return user ? <Inventory user={user} /> : null;
};

const ExpiryWrapper = () => {
  const { user } = useUser();
  return user ? <Expiry user={user} /> : null;
};

const InventoryHQWrapper = () => {
  const { user } = useUser();
  return user ? <InventoryHQ user={user} /> : null;
};

const ExpiryHQWrapper = () => {
  const { user } = useUser();
  return user ? <ExpiryHQ user={user} /> : null;
};

const ProfileWrapper = () => {
  const { user } = useUser();
  return user ? <Profile user={user} /> : null;
};

const SettingsWrapper = () => {
  const { user } = useUser();
  const toast = useToast();
  // Assume admin checking inside or we can check here
  return user && user.role === 'ADMIN' ? <Settings toast={toast} /> : <Navigate to="/" replace />;
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ToastProvider>
        <UserProvider>
          <AppRoutes />
        </UserProvider>
      </ToastProvider>
    </BrowserRouter>
  );
};

export default App;
