import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import BrandPanel from './BrandPanel';
import LoginForm from './LoginForm';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/evaluate" replace />;
  }

  return (
    <div className={styles.page}>
      <BrandPanel />
      <LoginForm />
    </div>
  );
}
