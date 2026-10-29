import { useEffect } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { configureAuth } from './api';
import Shell from './components/Shell';
import LandingPage from './pages/LandingPage';
import WorkbenchPage from './pages/WorkbenchPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import PatientsPage from './pages/PatientsPage';
import PatientCasePage from './pages/PatientCasePage';

// Wire the auth token into api.js
function AuthConnector() {
  const { token, logout } = useAuth();
  useEffect(() => {
    configureAuth(() => token, logout);
  }, [token, logout]);
  return null;
}

// Redirect authenticated users away from public pages
function PublicRoute() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/patients" replace /> : <Outlet />;
}

// Require authentication; optionally require a specific role
function RequireAuth({ role } = {}) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (role && user?.role !== role) return <Navigate to="/patients" replace />;
  return <Outlet />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Root → Landing Page */}
      <Route path="/" element={<LandingPage />} />

      {/* Public-only routes */}
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      {/* Protected routes inside Shell */}
      <Route element={<RequireAuth />}>
        <Route element={<Shell />}>
          <Route path="/patients" element={<PatientsPage />} />
          <Route path="/patients/:patientId" element={<PatientCasePage />} />
          <Route path="/cases" element={<Navigate to="/patients" replace />} />
          <Route path="/cases/:patientId" element={<PatientCasePage />} />
          <Route path="/workbench" element={<WorkbenchPage />} />
          <Route path="/analysis" element={<Navigate to="/patients" replace />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
      </Route>

      {/* Admin-only route */}
      <Route element={<RequireAuth role="admin" />}>
        <Route element={<Shell />}>
          <Route path="/admin" element={<AdminPage />} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/patients" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AuthConnector />
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
