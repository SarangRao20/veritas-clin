import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import EncountersPage from './pages/EncountersPage';
import AuditPage from './pages/AuditPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';
import VivaGuidePage from './pages/VivaGuidePage';

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 font-sans antialiased">
        
        {/* Persistent Enterprise Hospital Sidebar */}
        <Sidebar />

        {/* Dynamic Route Content Area */}
        <main className="flex-1 flex flex-col h-full overflow-y-auto">
          <Routes>
            <Route path="/" element={<EncountersPage />} />
            <Route path="/audit" element={<AuditPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/viva-guide" element={<VivaGuidePage />} />
          </Routes>
        </main>

      </div>
    </BrowserRouter>
  );
}
