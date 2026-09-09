import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import useBrowserNotifications from './hooks/useBrowserNotifications';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Register from './pages/Register';
import Unauthorized from './pages/Unauthorized';
import SuperadminDashboard from './pages/SuperadminDashboard';
import PharmacistDashboard from './pages/PharmacistDashboard';
import CustomerDashboard from './pages/CustomerDashboard';
import CustomerShop from './pages/CustomerShop';
import CustomerBills from './pages/CustomerBills';
import CustomerReminders from './pages/CustomerReminders';
import CustomerProfile from './pages/CustomerProfile';
import LandingPage from './pages/LandingPage';
import PrintReceipt from './pages/pharmacist/PrintReceipt';

// Browser notification activator — runs the reminder checker for customers
const BrowserNotificationProvider = ({ children }) => {
  useBrowserNotifications();
  return children;
};

// Dashboard Layout wrapper
const DashboardLayout = () => {
  return (
    <BrowserNotificationProvider>
      <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0C1628] text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200">
        <Navbar />

        <div className="flex-1 flex overflow-hidden">
          <Sidebar />

          <main className="flex-1 overflow-y-auto pb-14 md:pb-0">
            <Outlet />
          </main>
        </div>
      </div>
    </BrowserNotificationProvider>
  );
};

function App() {
  return (
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
  );
}

export default App;