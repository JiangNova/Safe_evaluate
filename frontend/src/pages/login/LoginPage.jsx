import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import BrandPanel from './BrandPanel';
import LoginForm from './LoginForm';
import styles from './LoginPage.module.css';
import { getSafeRedirect } from '../../utils/safeRedirect';

export default function LoginPage() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (isAuthenticated) {
    return (
      <Navigate
        to={getSafeRedirect(location.state?.from)}
        replace
      />
    );
  }

  return (
    <div className={styles.page}>
      <BrandPanel />
      <LoginForm />
    </div>
  );
}
