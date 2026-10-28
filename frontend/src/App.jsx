import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Shell from './components/Shell';
import WorkbenchPage from './pages/WorkbenchPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route path="*" element={<WorkbenchPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
