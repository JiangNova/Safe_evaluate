import { useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import WorkbenchPage from './pages/WorkbenchPage';
import LoginPage from './pages/LoginPage';
import { clearLeadershipSession, getLeadershipSession } from './services/leaderApi';
import { clearStorageAccount, setStorageAccount } from './services/leaderStorage';

function App() {
  const [session, setSession] = useState(() => getLeadershipSession());

  const completeLogin = (nextSession) => {
    setStorageAccount(nextSession.username);
    setSession(nextSession);
  };

  const logout = () => {
    clearLeadershipSession();
    clearStorageAccount();
    setSession(null);
  };

  return (
    <Routes>
      <Route path="/" element={session ? <WorkbenchPage key={session.username} accountName={session.username} onLogout={logout} /> : <LoginPage onLogin={completeLogin} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
