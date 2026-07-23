import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import styles from './TopBar.module.css';

export default function TopBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  const initial = user?.username?.charAt(0) || '用';

  return (
    <div className={styles.topbar}>
      <div className={styles.userInfo}>
        <span>{user?.username}</span>
        <div className={styles.avatar}>{initial}</div>
        <button className={styles.logoutBtn} onClick={handleLogout}>
          退出
        </button>
      </div>
    </div>
  );
}
