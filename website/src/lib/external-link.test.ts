import { describe, expect, it } from 'vitest'
import { getPlatformUrl } from './external-link'

describe('getPlatformUrl', () => {
  it('uses the standalone platform dev server during development', () => {
    expect(getPlatformUrl(true)).toBe('http://127.0.0.1:3001/evaluate/')
  })

  it('uses the same-origin route in production', () => {
    expect(getPlatformUrl(false)).toBe('/evaluate')
  })

  it('never exposes the platform dev port in production', () => {
    expect(getPlatformUrl(false)).not.toContain(':3001')
  })
})
