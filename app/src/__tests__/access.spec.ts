import { describe, expect, it } from 'vitest'
import { isValidEmail, normalizeEmail } from '@/lib/access'

describe('access helpers', () => {
  it('normalizes emails the way the security rules key them', () => {
    expect(normalizeEmail('  Brett@6MinuteWarning.com ')).toBe('brett@6minutewarning.com')
  })

  it('accepts full addresses only', () => {
    expect(isValidEmail('jo@example.com')).toBe(true)
    expect(isValidEmail('jo@example')).toBe(false)
    expect(isValidEmail('jo example.com')).toBe(false)
  })
})
