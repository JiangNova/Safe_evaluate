import styles from './BrandPanel.module.css';

export default function BrandPanel() {
  return (
    <div className={styles.panel}>
      <div className={`${styles.circle} ${styles.circleTop}`} />
      <div className={`${styles.circle} ${styles.circleBottom}`} />
      <div className={styles.content}>
        <div className={styles.icon}>🔥</div>
        <div className={styles.title}>天心公安分局暮云派出所场所安全多模态智能研判平台</div>
        <div className={styles.divider} />
        <div className={styles.subtitle}>
          智能评估 · 精准研判
          <br />
          保障消防安全
        </div>
      </div>
    </div>
  );
}
