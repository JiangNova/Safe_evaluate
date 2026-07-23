import styles from './FindingItem.module.css';

const LABELS = {
  danger: { icon: '❌', text: '不过关', cls: 'labelDanger' },
  warning: { icon: '⚠️', text: '部分不过关', cls: 'labelWarning' },
  success: { icon: '✅', text: '过关', cls: 'labelSuccess' },
};

export default function FindingItem({ severity = 'success', title, detail, regulation_ref }) {
  const info = LABELS[severity] || LABELS.success;

  return (
    <div className={`${styles.item} ${styles[severity]}`}>
      <div className={styles.header}>
        <span className={`${styles.badge} ${styles[info.cls]}`}>
          {info.icon} {info.text}
        </span>
        <span className={styles.title}>{title}</span>
      </div>
      {detail && <div className={styles.detail}>{detail}</div>}
      {regulation_ref && (
        <div className={styles.ref}>
          📎 依据：{regulation_ref}
        </div>
      )}
    </div>
  );
}
