import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/AppShell';
import OverviewPage   from './pages/OverviewPage';
import CorpusPage     from './pages/CorpusPage';
import EmbeddingsPage from './pages/EmbeddingsPage';
import EvaluationPage from './pages/EvaluationPage';
import AboutPage      from './pages/AboutPage';

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/"           element={<OverviewPage />} />
          <Route path="/corpus"     element={<CorpusPage />} />
          <Route path="/embeddings" element={<EmbeddingsPage />} />
          <Route path="/evaluation" element={<EvaluationPage />} />
          <Route path="/about"      element={<AboutPage />} />
          <Route path="*"           element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
