import { navItems } from '../content/siteContent'
import { AppLink } from '../lib/router'
import styles from './SiteFooter.module.css'

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.top}>
        <div>
          <AppLink className={styles.brand} to="/">
            <span>AGU</span>LAB
          </AppLink>
          <p>Autonomous Intelligence at the Limits, AI for the Real World.</p>
        </div>
        <nav className={styles.links} aria-label="页脚导航">
          {navItems.slice(1).map((item) => (
            <AppLink key={item.path} to={item.path}>
              {item.label}
            </AppLink>
          ))}
        </nav>
      </div>
      <div className={styles.bottom}>
        <span>© {new Date().getFullYear()} AGULAB</span>
        <span>From Racing Limits to Real-World Intelligence.</span>
      </div>
    </footer>
  )
}
