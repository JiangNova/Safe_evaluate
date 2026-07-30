import { useEffect } from 'react'
import { SiteFooter } from './components/SiteFooter'
import { SiteHeader } from './components/SiteHeader'
import { navItems } from './content/siteContent'
import { useRouter } from './lib/router-context'
import { AiEmpowermentPage } from './pages/AiEmpowermentPage'
import { HomePage } from './pages/HomePage'
import { PlaceholderPage } from './pages/PlaceholderPage'

function ScrollToTop({ pathname }: { pathname: string }) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  return null
}

export default function App() {
  const { pathname } = useRouter()
  const currentPage = navItems.find((item) => item.path === pathname)

  let page = (
    <PlaceholderPage
      eyebrow="404"
      title="页面未找到"
      description="你访问的页面不存在，或者仍在建设中。"
    />
  )

  if (pathname === '/') {
    page = <HomePage />
  } else if (pathname === '/ai-empowerment') {
    page = <AiEmpowermentPage />
  } else if (currentPage) {
    page = (
      <PlaceholderPage
        eyebrow={currentPage.english}
        title={currentPage.label}
        description={currentPage.description}
      />
    )
  }

  return (
    <>
      <ScrollToTop pathname={pathname} />
      <a className="skip-link" href="#main-content">
        跳至主要内容
      </a>
      <SiteHeader />
      {page}
      <SiteFooter />
    </>
  )
}
