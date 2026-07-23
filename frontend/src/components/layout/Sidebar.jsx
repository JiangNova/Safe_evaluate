import { NavLink } from 'react-router-dom';
import styles from './Sidebar.module.css';

const NAV_ITEMS = [
  { path: '/evaluate', label: '新建评估', icon: '📋' },
  { path: '/history', label: '历史记录', icon: '📜' },
  { path: '/rules', label: '规则管理', icon: '📖' },
  { path: '/stats', label: '统计分析', icon: '📊' },
];

export default function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.brandIcon}>🔥</span>
        <span className={styles.brandName}>消防安全评估</span>
      </div>
      <div className={styles.divider}>功能</div>
      <nav>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.active : ''}`
            }
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
