import { describe, expect, it } from 'vitest'
import { Timestamp } from 'firebase/firestore'
import { canUndo, describePath, diffFields, kindOf, sameData, titleOf, type AuditEntry } from '@/lib/audit'

const entry = (before: AuditEntry['before'], after: AuditEntry['after']): AuditEntry => ({ id: 'a1', path: 'gigs/g1', before, after, by: 'assistant@example.com', reason: 'Asked' })

describe('audit', () => {
  it('compares Firestore data by value, timestamps included', () => {
    expect(sameData({ a: 1, t: Timestamp.fromMillis(5), m: { x: [1, 2] } }, { m: { x: [1, 2] }, t: Timestamp.fromMillis(5), a: 1 })).toBe(true)
    expect(sameData({ t: Timestamp.fromMillis(5) }, { t: Timestamp.fromMillis(6) })).toBe(false)
    expect(sameData({ a: 1 }, { a: 1, b: 2 })).toBe(false)
    expect(sameData(null, null)).toBe(true)
    expect(sameData(null, {})).toBe(false)
    expect(sameData([1], { 0: 1 })).toBe(false)
  })

  it('lists changed leaf fields with dotted names', () => {
    expect(diffFields({ name: 'Gala', money: { fee: 3000, paid: 0 }, tags: ['a'] }, { name: 'Gala', money: { fee: 3200, paid: 0 }, notes: 'Bring risers', tags: [] })).toEqual([
      { field: 'money.fee', from: '3000', to: '3200' },
      { field: 'notes', from: '—', to: 'Bring risers' },
      { field: 'tags', from: 'a', to: 'none' },
    ])
    expect(diffFields(null, { name: 'New' })).toEqual([{ field: 'name', from: '—', to: 'New' }])
  })

  it('names the change and where it lives', () => {
    expect(kindOf(entry(null, { name: 'x' }))).toBe('created')
    expect(kindOf(entry({ name: 'x' }, null))).toBe('deleted')
    expect(kindOf(entry({ name: 'x' }, { name: 'y' }))).toBe('changed')
    expect(describePath('gigs/g1/answers/kyle')).toEqual({ label: 'Answer', id: 'kyle', parent: 'g1', link: '/gigs/g1' })
    expect(describePath('people/russell').link).toBe('/roster')
    expect(titleOf({ path: 'venues/hall', before: { name: 'Old Hall' }, after: null })).toBe('Old Hall')
    expect(titleOf({ path: 'payments/p1', before: null, after: { amount: 3 } })).toBe('p1')
  })

  it('undoes only while the record still holds what the change wrote', () => {
    const e = entry({ name: 'Gala' }, { name: 'Tree Gala' })
    expect(canUndo(e, { name: 'Tree Gala' }, false)).toEqual({ ok: true })
    expect(canUndo(e, { name: 'Changed again' }, false).ok).toBe(false)
    expect(canUndo(e, null, false).ok).toBe(false)
    expect(canUndo(e, { name: 'Tree Gala' }, true).ok).toBe(false)
    expect(canUndo(entry({ name: 'Gala' }, null), null, false)).toEqual({ ok: true })
  })
})
