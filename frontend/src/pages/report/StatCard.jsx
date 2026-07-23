import styles from './StatCard.module.css';

const TYPE_MAP = {
  success: { card: styles.cardSuccess, value: styles.valueSuccess },
  danger: { card: styles.cardDanger, value: styles.valueDanger },
  warning: { card: styles.cardWarning, value: styles.valueWarning },
};

export default function StatCard({ type = 'success', label, value, desc }) {
  const cls = TYPE_MAP[type] || TYPE_MAP.success;

  return (
    <div className={`${styles.card} ${cls.card}`}>
      <div className={styles.label}>{label}</div>
      <div className={`${styles.value} ${cls.value}`}>{value}</div>
      <div className={styles.desc}>{desc}</div>
    </div>
  );
}
