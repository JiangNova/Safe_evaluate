import { Navigate, Route, Routes } from 'react-router-dom';
import PublicLayout from './components/PublicLayout';
import EvaluatePage from './pages/EvaluatePage';
import SummaryPage from './pages/SummaryPage';
import ReportPage from './pages/ReportPage';

function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<EvaluatePage />} />
        <Route path="/summary" element={<SummaryPage />} />
        <Route path="/report/:id" element={<ReportPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
