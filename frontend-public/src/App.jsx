import { Navigate, Route, Routes } from 'react-router-dom';
import PublicLayout from './components/PublicLayout';
import JobWizardPage from './pages/JobWizardPage';
import SummaryPage from './pages/SummaryPage';
import ReportPage from './pages/ReportPage';
import TemplateConfirmPage from './pages/TemplateConfirmPage';
import JobWorkspacePage from './pages/JobWorkspacePage';
import WorkspaceEntryPage from './pages/WorkspaceEntryPage';
import WorkspaceLibraryPage from './pages/WorkspaceLibraryPage';
import WorkspaceNewJobPage from './pages/WorkspaceNewJobPage';

function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<JobWizardPage />} />
        <Route path="/workspace" element={<WorkspaceEntryPage />} />
        <Route path="/workspace/:workspaceId/library" element={<WorkspaceLibraryPage />} />
        <Route path="/workspace/:workspaceId/new" element={<WorkspaceNewJobPage />} />
        <Route path="/jobs/:jobId/templates" element={<TemplateConfirmPage />} />
        <Route path="/jobs/:jobId/workspace" element={<JobWorkspacePage />} />
        <Route path="/summary" element={<SummaryPage />} />
        <Route path="/report/:id" element={<ReportPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
