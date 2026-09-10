import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import useBrowserNotifications from './hooks/useBrowserNotifications';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';

const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Unauthorized = lazy(() => import('./pages/Unauthorized'));
const SuperadminDashboard = lazy(() => import('./pages/SuperadminDashboard'));
const PharmacistDashboard = lazy(() => import('./pages/PharmacistDashboard'));
const CustomerDashboard = lazy(() => import('./pages/CustomerDashboard'));
const CustomerShop = lazy(() => import('./pages/CustomerShop'));
const CustomerBills = lazy(() => import('./pages/CustomerBills'));
const CustomerReminders = lazy(() => import('./pages/CustomerReminders'));
const CustomerProfile = lazy(() => import('./pages/CustomerProfile'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const PrintReceipt = lazy(() => import('./pages/pharmacist/PrintReceipt'));

const RouteFallback = () => (
  <div className="flex min-h-[50vh] items-center justify-center bg-[var(--page-bg)] px-4">
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-teal-200 border-t-teal-600" />
      Loading workspace...
    </div>
  </div>
);

// Browser notification activator — runs the reminder checker for customers
const BrowserNotificationProvider = ({ children }) => {
  useBrowserNotifications();
  return children;
};

// Dashboard Layout wrapper
const DashboardLayout = () => {
  return (
    <BrowserNotificationProvider>
      <div className="flex min-h-screen flex-col bg-[var(--page-bg)] font-sans text-[var(--text-body)] transition-colors duration-200">
        <Navbar />

        <div className="flex flex-1 overflow-hidden">
          <Sidebar />

          <main className="flex-1 overflow-y-auto bg-[var(--page-bg)] pb-14 md:pb-0">
            <Outlet />
          </main>
        </div>
      </div>
    </BrowserNotificationProvider>
  );
};

function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
      {/* Public Pages */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Pharmacist Dashboard */}
      <Route
        path="/pharmacist"
        element={
          <ProtectedRoute allowedRoles={['pharmacist', 'superadmin']}>
            <PharmacistDashboard />
          </ProtectedRoute>
        }
      />

      {/* Pharmacist Receipt */}
      <Route
        path="/pharmacist/receipt/:billId"
        element={
          <ProtectedRoute allowedRoles={['pharmacist', 'superadmin']}>
            <PrintReceipt />
          </ProtectedRoute>
        }
      />

      {/* Customer Shop */}
      <Route
        path="/customer/shop"
        element={
          <ProtectedRoute allowedRoles={['customer']}>
            <BrowserNotificationProvider>
              <CustomerShop />
            </BrowserNotificationProvider>
          </ProtectedRoute>
        }
      />

      {/* Shared Dashboard Layout */}
      <Route element={<DashboardLayout />}>
        {/* Unauthorized */}
        <Route path="/unauthorized" element={<Unauthorized />} />

        {/* Superadmin */}
        <Route
          path="/superadmin"
          element={
            <ProtectedRoute allowedRoles={['superadmin']}>
              <SuperadminDashboard />
            </ProtectedRoute>
          }
        />

        {/* Customer Main Route */}
        <Route
          path="/customer"
          element={
            <ProtectedRoute allowedRoles={['customer']}>
              <Navigate to="/customer/dashboard" replace />
            </ProtectedRoute>
          }
        />

        {/* Customer Dashboard */}
        <Route
          path="/customer/dashboard"
          element={
            <ProtectedRoute allowedRoles={['customer']}>
              <CustomerDashboard />
            </ProtectedRoute>
          }
        />

        {/* Customer Bills */}
        <Route
          path="/customer/bills"
          element={
            <ProtectedRoute allowedRoles={['customer']}>
              <CustomerBills />
            </ProtectedRoute>
          }
        />

        {/* Customer Bill Details */}
        <Route
          path="/customer/bills/:id"
          element={
            <ProtectedRoute allowedRoles={['customer']}>
              <CustomerBills />
            </ProtectedRoute>
          }
        />

        {/* Customer Reminders */}
        <Route
          path="/customer/reminders"
          element={
            <ProtectedRoute allowedRoles={['customer']}>
              <CustomerReminders />
            </ProtectedRoute>
          }
        />

        {/* Customer Profile */}
        <Route
          path="/customer/profile"
          element={
            <ProtectedRoute allowedRoles={['customer']}>
              <CustomerProfile />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Wildcard Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;