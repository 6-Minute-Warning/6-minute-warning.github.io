import { describe, expect, it } from 'vitest'
import type { Gig } from '@/lib/gigs'
import { isCurrent, lineupChange, lineupKey, needsRehearsalAnswer, rehearsalAnswer, rehearsalCount, timeUntil } from '@/lib/rehearsals'

const six = ['a', 'b', 'c', 'd', 'e', 'f']
const today = '2026-09-28'
type G = Pick<Gig, 'date' | 'stage' | 'performers' | 'rehearsals'>
const gig = (extra: Partial<G> = {}): G => ({ date: '2026-11-01', stage: 'tentative', performers: six, ...extra })
const answered = (performers: string[], needed = 2) => rehearsalAnswer(needed, '', 'bryan@example.com', performers, 0)

describe('rehearsals needed', () => {
  it('keys a lineup by who is in, not the order they said yes', () => {
    expect(lineupKey(['c', 'a', 'b'])).toBe(lineupKey(['a', 'b', 'c']))
    expect(lineupKey(undefined)).toBe('')
  })

  it('asks once the lineup fills and stops once answered for that lineup', () => {
    expect(needsRehearsalAnswer(gig({ performers: six.slice(0, 5) }), today)).toBe(false)
    expect(needsRehearsalAnswer(gig(), today)).toBe(true)
    expect(needsRehearsalAnswer(gig({ rehearsals: answered([...six].reverse()) }), today)).toBe(false)
  })

  it('asks again when a sub comes in or someone drops', () => {
    const before = answered(six)
    expect(needsRehearsalAnswer(gig({ performers: ['a', 'b', 'c', 'd', 'e', 'sam'], rehearsals: before }), today)).toBe(true)
    expect(needsRehearsalAnswer(gig({ performers: six.slice(0, 5), rehearsals: before }), today)).toBe(true)
    expect(needsRehearsalAnswer(gig({ performers: [], rehearsals: before }), today)).toBe(false)
  })

  it('an early guess is re-asked when the lineup fills', () => {
    const guess = answered([])
    expect(needsRehearsalAnswer(gig({ performers: [], rehearsals: guess }), today)).toBe(false)
    expect(needsRehearsalAnswer(gig({ rehearsals: guess }), today)).toBe(true)
  })

  it('never asks about past, cancelled or finished gigs', () => {
    expect(needsRehearsalAnswer(gig({ date: '2026-09-27' }), today)).toBe(false)
    expect(needsRehearsalAnswer(gig({ stage: 'cancelled' }), today)).toBe(false)
    expect(needsRehearsalAnswer(gig({ stage: 'done' }), today)).toBe(false)
  })

  it('says who joined and left since the last answer', () => {
    expect(lineupChange(answered(six), ['a', 'b', 'c', 'd', 'e', 'sam'])).toEqual({ joined: ['sam'], left: ['f'] })
    expect(isCurrent({ performers: six, rehearsals: answered(six) })).toBe(true)
  })

  it('rounds the count, trims the note and refuses silly numbers', () => {
    const r = rehearsalAnswer(2.4, '  2 full + 1 sectional  ', 'bryan@example.com', ['b', 'a'], 'now')
    expect(r).toEqual({ needed: 2, note: '2 full + 1 sectional', by: 'bryan@example.com', at: 'now', lineupKey: 'a,b' })
    expect(() => rehearsalAnswer(-1, '', 'x', [], 0)).toThrow('between 0 and 20')
    expect(() => rehearsalAnswer(21, '', 'x', [], 0)).toThrow('between 0 and 20')
    expect(() => rehearsalAnswer(Number.NaN, '', 'x', [], 0)).toThrow('between 0 and 20')
  })

  it('writes the count and the time left the way people say them', () => {
    expect(rehearsalCount(0)).toBe('No rehearsals needed')
    expect(rehearsalCount(1)).toBe('1 rehearsal needed')
    expect(rehearsalCount(3)).toBe('3 rehearsals needed')
    expect(timeUntil('2026-09-28', today)).toBe('today')
    expect(timeUntil('2026-09-29', today)).toBe('tomorrow')
    expect(timeUntil('2026-10-08', today)).toBe('in 10 days')
    expect(timeUntil('2026-11-01', today)).toBe('in 4 weeks')
  })
})
