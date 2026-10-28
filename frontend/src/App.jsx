import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/toast';
import DiscoverPage   from './pages/DiscoverPage';
import DashboardPage  from './pages/DashboardPage';
import PatientPage    from './pages/PatientPage';
import ResearchPage   from './pages/ResearchPage';
import Shell          from './components/Shell';

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/"              element={<DiscoverPage />} />
            <Route path="/patients"      element={<DashboardPage />} />
            <Route path="/patient/:id"   element={<PatientPage />} />
            <Route path="/research"      element={<ResearchPage />} />
            <Route path="/dashboard"     element={<Navigate to="/patients" replace />} />
            <Route path="/pipeline"      element={<Navigate to="/" replace />} />
            <Route path="/triage"        element={<Navigate to="/" replace />} />
            <Route path="/explore"       element={<Navigate to="/research" replace />} />
            <Route path="/about"         element={<Navigate to="/research" replace />} />
            <Route path="*"              element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
