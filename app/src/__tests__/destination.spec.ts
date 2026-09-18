import { describe, expect, it } from 'vitest'
import { destination } from '@/lib/destination'

describe('destination', () => {
  it('sends signed-out visitors to sign-in from any page', () => {
    expect(destination('signed-out', false, 'member')).toBe('sign-in')
    expect(destination('signed-out', false, 'admin')).toBe('sign-in')
    expect(destination('signed-out', false, 'guest')).toBeNull()
  })

  it('treats a failed access check like signed out', () => {
    expect(destination('error', false, 'member')).toBe('sign-in')
  })

  it('keeps people without access on the no-access page', () => {
    expect(destination('no-access', false, 'member')).toBe('no-access')
    expect(destination('no-access', false, 'guest')).toBe('no-access')
    expect(destination('no-access', false, 'no-access')).toBeNull()
  })

  it('moves members off the sign-in and no-access pages', () => {
    expect(destination('member', false, 'guest')).toBe('home')
    expect(destination('member', false, 'no-access')).toBe('home')
    expect(destination('member', false, 'member')).toBeNull()
  })

  it('lets only admins onto admin pages', () => {
    expect(destination('member', false, 'admin')).toBe('home')
    expect(destination('member', true, 'admin')).toBeNull()
  })
})
