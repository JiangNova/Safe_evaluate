import styles from './FindingItem.module.css';

const LABELS = {
  danger: { icon: '❌', text: '不过关', cls: 'labelDanger' },
  warning: { icon: '⚠️', text: '部分不过关', cls: 'labelWarning' },
  success: { icon: '✅', text: '过关', cls: 'labelSuccess' },
};

const CATEGORY_LABELS = {
  fire_exit: '消防通道与疏散',
  equipment: '消防设施与器材',
  electrical: '电气与火源管理',
  management: '消防安全管理',
  building: '建筑与场所属性',
  other: '其他',
};

export default function FindingItem({ severity = 'success', title, detail, regulation_ref, category }) {
  const info = LABELS[severity] || LABELS.success;

  return (
    <div className={`${styles.item} ${styles[severity]}`}>
      <div className={styles.header}>
        <span className={`${styles.badge} ${styles[info.cls]}`}>
          {info.icon} {info.text}
        </span>
        {category && CATEGORY_LABELS[category] && (
          <span className={styles.catBadge}>
            {CATEGORY_LABELS[category]}
          </span>
        )}
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
