import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/AppShell';
import EncountersPage from './pages/EncountersPage';
import AuditPage from './pages/AuditPage';
import AnalyticsPage from './pages/AnalyticsPage';
import NlpLabPage from './pages/NlpLabPage';
import SettingsPage from './pages/SettingsPage';
import VivaGuidePage from './pages/VivaGuidePage';

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<EncountersPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/nlp-lab" element={<NlpLabPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/viva-guide" element={<VivaGuidePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
