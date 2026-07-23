import styles from './Loading.module.css';

export default function Loading({ text = '加载中...', inline = false }) {
  return (
    <div className={`${styles.overlay} ${inline ? styles.inline : ''}`}>
      <div className={styles.spinner}>
        <div className={styles.ring} />
        {text && <span className={styles.text}>{text}</span>}
      </div>
    </div>
  );
}
