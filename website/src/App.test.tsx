import { describe, expect, it } from 'vitest'
import appSource from './App.tsx?raw'
import heroSource from './components/DualSceneHero.tsx?raw'
import homeSource from './pages/HomePage.tsx?raw'

describe('AI empowerment routing', () => {
  it('uses the dedicated AI empowerment page', () => {
    expect(appSource).toContain("import { AiEmpowermentPage }")
    expect(appSource).toContain("pathname === '/ai-empowerment'")
  })

  it('keeps the platform entry out of homepage surfaces', () => {
    expect(heroSource).not.toContain('getPlatformUrl')
    expect(homeSource).not.toContain('getPlatformUrl')
  })
})
