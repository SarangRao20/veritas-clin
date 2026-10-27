import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppShell     from './components/AppShell';
import OverviewPage from './pages/OverviewPage';
import ExplorePage  from './pages/ExplorePage';
import PredictPage  from './pages/PredictPage';
import ResultsPage  from './pages/ResultsPage';
import AboutPage    from './pages/AboutPage';

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/"         element={<OverviewPage />} />
          <Route path="/explore"  element={<ExplorePage />} />
          <Route path="/predict"  element={<PredictPage />} />
          <Route path="/results"  element={<ResultsPage />} />
          <Route path="/about"    element={<AboutPage />} />
          <Route path="*"         element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
