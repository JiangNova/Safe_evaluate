import { useEffect, useRef, useState } from 'react'
import { navItems } from '../content/siteContent'
import { AppLink } from '../lib/router'
import { useRouter } from '../lib/router-context'
import styles from './SiteHeader.module.css'

export function SiteHeader() {
  const [isOpen, setIsOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { pathname } = useRouter()

  useEffect(() => {
    document.body.classList.toggle('menu-open', isOpen)
    return () => document.body.classList.remove('menu-open')
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
        buttonRef.current?.focus()
      }
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [isOpen])

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <AppLink
          className={styles.brand}
          to="/"
          aria-label="AGULAB 首页"
          onClick={() => setIsOpen(false)}
        >
          <span className={styles.brandAccent}>AGU</span>LAB
          <span className={styles.brandDot} aria-hidden="true" />
        </AppLink>

        <button
          ref={buttonRef}
          className={styles.menuButton}
          type="button"
          aria-expanded={isOpen}
          aria-controls="site-navigation"
          aria-label={isOpen ? '关闭导航菜单' : '打开导航菜单'}
          onClick={() => setIsOpen((value) => !value)}
        >
          <span />
          <span />
        </button>

        <nav
          id="site-navigation"
          className={`${styles.navigation} ${isOpen ? styles.open : ''}`}
          aria-label="主导航"
        >
          {navItems.map((item) => {
            const isActive = pathname === item.path

            return (
              <AppLink
                key={item.path}
                to={item.path}
                className={`${styles.navLink} ${isActive ? styles.active : ''}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => setIsOpen(false)}
              >
                {item.label}
              </AppLink>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
