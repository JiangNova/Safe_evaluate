import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/login/LoginPage';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';
import EvaluatePage from './pages/evaluate/EvaluatePage';
import ReportPage from './pages/report/ReportPage';
import HistoryPage from './pages/history/HistoryPage';
import RulesPage from './pages/rules/RulesPage';
import StatsPage from './pages/stats/StatsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/evaluate" element={<EvaluatePage />} />
        <Route path="/report/:id" element={<ReportPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/rules" element={<RulesPage />} />
        <Route path="/stats" element={<StatsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/evaluate" replace />} />
    </Routes>
  );
}
