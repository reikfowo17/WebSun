import React, { Suspense } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  Outlet,
} from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

// Contexts
import { UserProvider, useUser } from "./contexts";
import { ToastProvider, useToast } from "./contexts";
import type { User } from "./types";

// Components
import Layout from "./components/Layout";
import ErrorBoundary from "./components/ErrorBoundary";
import Login from "./pages/Login";
import Register from "./pages/Register";

// Pages (lazy load)
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const Inventory = React.lazy(() => import("./pages/Inventory"));
const Expiry = React.lazy(() => import("./pages/Expiry/ExpiryCheckWorker"));
const InventoryHQ = React.lazy(() => import("./pages/InventoryHQ"));
const ExpiryHQ = React.lazy(() => import("./pages/Expiry/ExpiryHQ"));
const Profile = React.lazy(() => import("./pages/Profile"));
const Settings = React.lazy(() => import("./pages/Settings/Settings"));
const Schedule = React.lazy(() => import("./pages/Schedule/Schedule"));
const ShiftPage = React.lazy(() => import("./pages/Shift/ShiftPage"));
const CashHQ = React.lazy(() => import("./pages/Shift/CashHQ"));
const TaskHQ = React.lazy(() => import("./pages/Shift/TaskHQ"));

const pageVariants = {
  initial: { opacity: 0, x: 20 },
  in: { opacity: 1, x: 0 },
  out: { opacity: 0, x: -20 },
};

const pageTransition = {
  ease: "anticipate",
  duration: 0.3,
} as const;

const AnimatedPage: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
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
    <Layout user={user} onLogout={logout}>
      <Suspense fallback={<LoadingSkeleton />}>
        <Outlet />
      </Suspense>
    </Layout>
  );
};

// ─── Generic Route Wrappers (DRY) ───

/** Wraps a page component that requires `user` prop */
function withUser<P extends { user: User }>(
  Component: React.ComponentType<P>,
  extraProps?: Partial<P>,
) {
  const Wrapper: React.FC = () => {
    const { user } = useUser();
    if (!user) return null;
    return <Component {...({ user, ...extraProps } as P)} />;
  };
  Wrapper.displayName = `withUser(${Component.displayName || Component.name || 'Component'})`;
  return Wrapper;
}

/** Wraps a page component that requires admin role */
function withAdmin<P extends { user: User }>(
  Component: React.ComponentType<P>,
  extraProps?: Partial<P>,
) {
  const Wrapper: React.FC = () => {
    const { user } = useUser();
    if (!user || user.role !== "ADMIN") return <Navigate to="/" replace />;
    return <Component {...({ user, ...extraProps } as P)} />;
  };
  Wrapper.displayName = `withAdmin(${Component.displayName || Component.name || 'Component'})`;
  return Wrapper;
}

/** Wraps a page component that requires `user` + `toast` props */
function withUserAndToast<P extends { user: User; toast: ReturnType<typeof useToast> }>(
  Component: React.ComponentType<P>,
) {
  const Wrapper: React.FC = () => {
    const { user } = useUser();
    const toast = useToast();
    if (!user) return null;
    return <Component {...({ user, toast } as P)} />;
  };
  Wrapper.displayName = `withUserAndToast(${Component.displayName || Component.name || 'Component'})`;
  return Wrapper;
}

/** Wraps a page component that requires admin + toast */
function withAdminAndToast<P extends { toast: ReturnType<typeof useToast> }>(
  Component: React.ComponentType<P>,
) {
  const Wrapper: React.FC = () => {
    const { user } = useUser();
    const toast = useToast();
    if (!user || user.role !== "ADMIN") return <Navigate to="/" replace />;
    return <Component {...({ toast } as P)} />;
  };
  Wrapper.displayName = `withAdminAndToast(${Component.displayName || Component.name || 'Component'})`;
  return Wrapper;
}

// ─── Route Components ───
const DashboardPage = withUser(Dashboard);
const InventoryPage = withUser(Inventory);
const ExpiryPage = withUser(Expiry);
const InventoryHQPage = withUser(InventoryHQ);
const ExpiryHQPage = withUser(ExpiryHQ);
const ProfilePage = withUser(Profile);
const SettingsPage = withAdminAndToast(Settings);
const SchedulePage = withUserAndToast(Schedule);
const ShiftPageRoute = withUser(ShiftPage);
const CashHQPage = withAdmin(CashHQ);
const TaskHQPage = withAdmin(TaskHQ);

const AppRoutes: React.FC = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/login"
          element={
            <AnimatedPage>
              <PublicOnlyRoute>
                <Login />
              </PublicOnlyRoute>
            </AnimatedPage>
          }
        />
        <Route
          path="/register"
          element={
            <AnimatedPage>
              <PublicOnlyRoute>
                <Register />
              </PublicOnlyRoute>
            </AnimatedPage>
          }
        />

        {/* Protected Routes */}
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<AnimatedPage><DashboardPage /></AnimatedPage>} />
          <Route path="/inventory" element={<AnimatedPage><InventoryPage /></AnimatedPage>} />
          <Route path="/expiry" element={<AnimatedPage><ExpiryPage /></AnimatedPage>} />
          <Route path="/hq" element={<AnimatedPage><InventoryHQPage /></AnimatedPage>} />
          <Route path="/expiry-hq" element={<AnimatedPage><ExpiryHQPage /></AnimatedPage>} />
          <Route path="/profile" element={<AnimatedPage><ProfilePage /></AnimatedPage>} />
          <Route path="/settings" element={<AnimatedPage><SettingsPage /></AnimatedPage>} />
          <Route path="/schedule" element={<AnimatedPage><SchedulePage /></AnimatedPage>} />
          <Route path="/shift" element={<AnimatedPage><ShiftPageRoute /></AnimatedPage>} />
          <Route path="/cash-hq" element={<AnimatedPage><CashHQPage /></AnimatedPage>} />
          <Route path="/task-hq" element={<AnimatedPage><TaskHQPage /></AnimatedPage>} />
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
};

const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isAuthenticated, isLoading } = useUser();
  if (isLoading) return <LoadingSkeleton />;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          <UserProvider>
            <AppRoutes />
          </UserProvider>
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;
