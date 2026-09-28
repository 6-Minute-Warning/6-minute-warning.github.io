import { describe, expect, it } from 'vitest'
import { parseView, viewLabel, viewOfPerson, viewedAccess } from '@/lib/viewAs'
import { myPersonId } from '@/lib/poll'

const brett = { name: 'Brett Ludwig', role: 'admin' as const, person: 'brett-ludwig' }

describe('viewedAccess', () => {
  it('keeps the real record when nobody is being viewed', () => {
    expect(viewedAccess(brett, null)).toBe(brett)
  })

  it('takes the role and clears the person when an admin views as a role', () => {
    expect(viewedAccess(brett, { role: 'member' })).toEqual({ name: 'Brett Ludwig', role: 'member', person: '' })
  })

  it('becomes the viewed person', () => {
    expect(viewedAccess(brett, { role: 'director', person: 'anna', name: 'Anna Lee' })).toEqual({ name: 'Anna Lee', role: 'director', person: 'anna' })
  })

  it('ignores a stored view for anyone who is not an admin', () => {
    const singer = { name: 'Sam', role: 'member' as const }
    expect(viewedAccess(singer, { role: 'manager' })).toBe(singer)
    expect(viewedAccess(null, { role: 'manager' })).toBeNull()
  })

  it('never resolves a role view back to the admin through their email', () => {
    const people = [{ id: 'brett-ludwig', name: 'Brett', status: 'active' as const, part: '', phone: '', emails: ['brett@6minutewarning.com'] }]
    const access = viewedAccess(brett, { role: 'member' })
    expect(myPersonId(access?.person, '', people)).toBe('')
  })
})

describe('viewOfPerson', () => {
  const users = [
    { email: 'anna@6minutewarning.com', role: 'member' as const, person: 'anna' },
    { email: 'anna@gmail.com', role: 'director' as const },
  ]

  it('uses the strongest role across the person and their emails', () => {
    expect(viewOfPerson({ id: 'anna', name: 'Anna Lee', emails: ['Anna@gmail.com'] }, users)).toEqual({ role: 'director', person: 'anna', name: 'Anna Lee' })
  })

  it('treats a person with no sign-in as a singer', () => {
    expect(viewOfPerson({ id: 'sub', name: 'Sub', emails: [] }, users).role).toBe('member')
  })
})

describe('viewLabel', () => {
  it('names the role, and the person when there is one', () => {
    expect(viewLabel({ role: 'director' })).toBe('Music director')
    expect(viewLabel({ role: 'member', person: 'anna', name: 'Anna Lee' })).toBe('Anna Lee (Singer)')
  })
})

describe('parseView', () => {
  it('reads a stored view and drops anything malformed', () => {
    expect(parseView('{"role":"manager"}')).toEqual({ role: 'manager', person: undefined, name: undefined })
    expect(parseView('{"role":"owner"}')).toBeNull()
    expect(parseView('not json')).toBeNull()
    expect(parseView(null)).toBeNull()
  })
})
