import { Navigate, Route, Routes } from 'react-router-dom';
import WorkbenchPage from './pages/WorkbenchPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<WorkbenchPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
