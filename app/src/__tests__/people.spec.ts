import { describe, expect, it } from 'vitest'
import { personId, planImport, toStatus, workspaceEmail, type ImportedPerson } from '@/lib/people'

const row = (over: Partial<ImportedPerson>): ImportedPerson => ({ name: '', status: 'Active', part: '', email: '', phone: '', ...over })

describe('people import', () => {
  it('builds ids and workspace addresses from names', () => {
    expect(personId('Bernard Quilala')).toBe('bernard-quilala')
    expect(personId('Zoë  O’Neil')).toBe('zoe-o-neil')
    expect(workspaceEmail('Jo Tong')).toBe('jo@6minutewarning.com')
    expect(workspaceEmail('Zoë Smith')).toBe('zoe@6minutewarning.com')
  })

  it('maps Notion statuses', () => {
    expect(toStatus('Active')).toBe('active')
    expect(toStatus('Sub')).toBe('sub')
    expect(toStatus('Inactive')).toBe('alumni')
  })

  it('links the Notion email and the workspace address to one active person', () => {
    const plan = planImport([row({ name: 'Jo Tong', email: 'Jo.Tong@Gmail.com' })], {})
    expect(plan.people[0]).toEqual({
      id: 'jo-tong',
      record: { name: 'Jo Tong', status: 'active', part: '', phone: '', emails: ['jo.tong@gmail.com', 'jo@6minutewarning.com'] },
    })
    expect(plan.access.map((a) => [a.email, a.role, a.person, a.isNew])).toEqual([
      ['jo.tong@gmail.com', 'member', 'jo-tong', true],
      ['jo@6minutewarning.com', 'member', 'jo-tong', true],
    ])
  })

  it('does not duplicate an address Notion already holds', () => {
    const plan = planImport([row({ name: 'Brett Ludwig', email: 'brett@6minutewarning.com' })], {})
    expect(plan.people[0]?.record.emails).toEqual(['brett@6minutewarning.com'])
  })

  it('gives a newly linked address the role the person already has', () => {
    const plan = planImport([row({ name: 'Brett Ludwig', email: 'brett@gmail.com' })], { 'brett@6minutewarning.com': 'admin' })
    expect(plan.access.map((a) => [a.email, a.role, a.isNew])).toEqual([
      ['brett@gmail.com', 'admin', true],
      ['brett@6minutewarning.com', 'admin', false],
    ])
  })

  it('keeps existing roles and marks them as not new', () => {
    const plan = planImport([row({ name: 'Brett Ludwig', email: 'brett@6minutewarning.com' })], { 'brett@6minutewarning.com': 'admin' })
    expect(plan.access[0]).toMatchObject({ role: 'admin', isNew: false })
  })

  it('adds subs to the roster without sign-in access or a workspace address', () => {
    const plan = planImport([row({ name: 'Sam Sub', status: 'Sub', email: 'sam@gmail.com' })], {})
    expect(plan.people[0]?.record).toMatchObject({ status: 'sub', emails: ['sam@gmail.com'] })
    expect(plan.access).toEqual([])
  })

  it('never gives the same address to two people', () => {
    const plan = planImport([row({ name: 'Jo Tong', email: 'jo@gmail.com' }), row({ name: 'Jo Smith', email: 'jo.smith@gmail.com' })], {})
    expect(plan.people[1]?.record.emails).toEqual(['jo.smith@gmail.com'])
    expect(plan.skipped).toEqual(["jo@6minutewarning.com already belongs to another person, so it isn't linked to Jo Smith"])
  })

  it('skips rows with no name', () => {
    expect(planImport([row({ name: '  ' })], {}).skipped).toEqual(['A row with no name'])
  })
})
