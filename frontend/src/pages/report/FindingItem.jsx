import styles from './FindingItem.module.css';

const ICONS = { danger: '🔴', warning: '🟡', success: '🟢' };

export default function FindingItem({ severity = 'success', title, detail }) {
  const capSeverity = severity.charAt(0).toUpperCase() + severity.slice(1);

  return (
    <div className={`${styles.item} ${styles[severity]}`}>
      <div className={`${styles.title} ${styles['title' + capSeverity]}`}>
        {ICONS[severity]} {title}
      </div>
      {detail && <div className={styles.detail}>{detail}</div>}
    </div>
  );
}
