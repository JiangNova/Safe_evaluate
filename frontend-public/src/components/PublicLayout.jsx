import { Outlet } from 'react-router-dom';
import styles from './PublicLayout.module.css';

export default function PublicLayout() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <a className={styles.brand} href="/" aria-label="返回 AGULAB 官网">
          <span className={styles.brandMark} aria-hidden="true">A</span>
          <span className={styles.brandText}>
            <strong>AGULAB</strong>
            <small>自动安全评估平台</small>
          </span>
        </a>
        <a className={styles.homeLink} href="/">
          返回官网
          <span aria-hidden="true">↗</span>
        </a>
      </header>

      <main className={styles.content}>
        <Outlet />
      </main>

      <footer className={styles.footer}>
        <span>AGULAB · AI EMPOWERMENT</span>
        <span>评估结果仅供安全检查与整改参考</span>
      </footer>
    </div>
  );
}

