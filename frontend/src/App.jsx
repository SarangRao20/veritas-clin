import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Shell from './components/Shell';
import WorkbenchPage from './pages/WorkbenchPage';
import PatientsPage from './pages/PatientsPage';
import PatientPage from './pages/PatientPage';
import PipelinePage from './pages/PipelinePage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route path="/"           element={<WorkbenchPage />} />
          <Route path="/patients"   element={<PatientsPage />} />
          <Route path="/patient/:id" element={<PatientPage />} />
          <Route path="/pipeline"   element={<PipelinePage />} />
          <Route path="*"           element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
