import { AppLink } from '../lib/router'
import styles from './PlaceholderPage.module.css'

type PlaceholderPageProps = {
  eyebrow: string
  title: string
  description: string
}

export function PlaceholderPage({
  eyebrow,
  title,
  description,
}: PlaceholderPageProps) {
  return (
    <main id="main-content" className={styles.page}>
      <div className={styles.grid} aria-hidden="true" />
      <div className={styles.content}>
        <span className={styles.eyebrow}>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
        <div className={styles.status}>
          <span aria-hidden="true" />
          页面正在建设中
        </div>
        <AppLink className="button button--primary" to="/">
          返回首页
        </AppLink>
      </div>
    </main>
  )
}
