import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loading from './ui/Loading';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <Loading text="验证身份中..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
