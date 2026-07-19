import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import LeadsPage from './pages/LeadsPage';
import CustomersPage from './pages/CustomersPage';
import JobCardsPage from './pages/JobCardsPage';
import JobCardNewPage from './pages/JobCardNewPage';
import JobCardDetailPage from './pages/JobCardDetailPage';
import JobCardEditPage from './pages/JobCardEditPage';
import QuotationsPage from './pages/QuotationsPage';
import InvoicesPage from './pages/InvoicesPage';
import InventoryPage from './pages/InventoryPage';
import StaffPage from './pages/StaffPage';
import StaffDetailPage from './pages/StaffDetailPage';
import StaffAttendancePaymentsPage from './pages/StaffAttendancePaymentsPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import CommissionsPage from './pages/CommissionsPage';
import MarketingPage from './pages/MarketingPage';
import AppShell from './components/layout/AppShell';
import InvoicePrintPage from './pages/InvoicePrintPage';
import QuickJobCards from './pages/QuickJobCards';
import AdvanceBookings from './pages/AdvanceBookings';
import PublicTrackingPage from './pages/PublicTrackingPage';
import StaffManagementPage from './pages/admin/StaffManagementPage';
import StaffPermissionsPage from './pages/admin/StaffPermissionsPage';
import SystemLogsPage from './pages/admin/SystemLogsPage';
import KioskAttendancePage from './pages/KioskAttendancePage';
import WarrantiesPage from './pages/WarrantiesPage';
import PublicWarrantyCheck from './pages/PublicWarrantyCheck';
import RecycleBinPage from './pages/RecycleBinPage';



/**
 * GOC Studio Management System v2.0
 * Main Application Router
 */

// Protect authenticated routes
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

// Redirect authenticated users away from login
function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />

      {/* Protected — Shell with Sidebar + Topbar */}
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/leads" element={<LeadsPage />} />
        <Route path="/customers" element={<CustomersPage />} />

        <Route path="/jobs" element={<JobCardsPage />} />
        <Route path="/jobs/new" element={<JobCardNewPage />} />
        <Route path="/jobs/:id" element={<JobCardDetailPage />} />
        <Route path="/jobs/:id/edit" element={<JobCardEditPage />} />
        <Route path="/quick-jobs" element={<QuickJobCards />} />
        <Route path="/advance-bookings" element={<AdvanceBookings />} />
        <Route path="/quotations" element={<QuotationsPage />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/staff" element={<StaffPage />} />
        <Route path="/staff/:id" element={<StaffDetailPage />} />
        <Route path="/staff/attendance-payments" element={<StaffAttendancePaymentsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/marketing" element={<MarketingPage />} />
        <Route path="/commissions" element={<CommissionsPage />} />
        <Route path="/warranties" element={<WarrantiesPage />} />
        <Route path="/admin/staff" element={<StaffManagementPage />} />
        <Route path="/admin/staff/:id/permissions" element={<StaffPermissionsPage />} />
        <Route path="/admin/logs" element={<SystemLogsPage />} />
        <Route path="/recycle-bin" element={<RecycleBinPage />} />
      </Route>

      <Route
        path="/invoice/:type/:id"
        element={
          <ProtectedRoute>
            <InvoicePrintPage />
          </ProtectedRoute>
        }
      />

      <Route path="/track/:token" element={<PublicTrackingPage />} />
      <Route path="/warranty-check" element={<PublicWarrantyCheck />} />

      <Route
        path="/kiosk-attendance"
        element={
          <ProtectedRoute>
            <KioskAttendancePage />
          </ProtectedRoute>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
