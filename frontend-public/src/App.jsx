import { Navigate, Route, Routes } from 'react-router-dom';
import PublicLayout from './components/PublicLayout';
import JobWizardPage from './pages/JobWizardPage';
import SummaryPage from './pages/SummaryPage';
import ReportPage from './pages/ReportPage';

function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<JobWizardPage />} />
        <Route path="/jobs/:jobId/templates" element={<div>模板字段确认加载中…</div>} />
        <Route path="/jobs/:jobId/workspace" element={<div>评估文书工作台加载中…</div>} />
        <Route path="/summary" element={<SummaryPage />} />
        <Route path="/report/:id" element={<ReportPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
