import { describe, expect, it } from 'vitest'
import { openCall, type Answer } from '@/lib/call'
import { answersOn, datesOf, hasOptions, leader, lockPlan, needsAnswer, normalizeOptions, optionClashes, optionsText, race, withAnswer, type StoredAnswer } from '@/lib/options'

const [A, B, C] = ['2026-11-27', '2026-11-28', '2026-12-04']
const six = ['a', 'b', 'c', 'd', 'e', 'f']
const said = (dates: Record<string, Answer>, at: number, until?: string): StoredAnswer => ({ dates, by: 'x@example.com', at, ...(until ? { until } : {}) })

describe('possible dates', () => {
  it('a gig with one date or none has no options', () => {
    expect(hasOptions({ date: A })).toBe(false)
    expect(hasOptions({ date: A, dateOptions: [A] })).toBe(false)
    expect(hasOptions({ date: A, dateOptions: [A, B] })).toBe(true)
    expect(datesOf({ date: A })).toEqual([A])
    expect(datesOf({ date: '' })).toEqual([])
    expect(datesOf({ date: A, dateOptions: [A, C] })).toEqual([A, C])
  })

  it('sorts, dedupes and caps the dates typed on New gig', () => {
    expect(normalizeOptions([C, '', A, C, 'soon', B])).toEqual([A, B, C])
    expect(normalizeOptions(Array.from({ length: 9 }, (_, i) => `2026-11-0${i + 1}`))).toHaveLength(6)
  })

  it('reads one date out of per-date answers, keeping "know by" only where it applies', () => {
    const on = answersOn({ kyle: said({ [A]: 'yes', [B]: 'later' }, 5, '2026-10-15'), tim: said({ [B]: 'no' }, 6) }, A)
    expect(on).toEqual({ kyle: { answer: 'yes', by: 'x@example.com', at: 5 } })
    expect(answersOn({ kyle: said({ [B]: 'later' }, 5, '2026-10-15') }, B).kyle?.until).toBe('2026-10-15')
  })

  it('the date that reaches six first leads, even if another has as many', () => {
    const stored = Object.fromEntries(six.map((id, i) => [id, said({ [A]: 'yes', [B]: 'yes' }, i)]))
    stored.a = said({ [A]: 'yes', [B]: 'yes' }, 100)
    const standings = race(openCall(six, 'me', 0), stored, [A, B])
    expect(standings.map((s) => s.summary.lineup.length)).toEqual([6, 6])
    expect(leader(standings)).toBe(A)
  })

  it('without a full date, most yeses lead, then fewest can\'ts, then the earlier date', () => {
    const call = openCall(six, 'me', 0)
    expect(leader(race(call, { a: said({ [B]: 'yes' }, 1), b: said({ [B]: 'yes', [A]: 'yes' }, 2) }, [A, B]))).toBe(B)
    expect(leader(race(call, { a: said({ [A]: 'yes', [B]: 'yes' }, 1), b: said({ [A]: 'no' }, 2) }, [A, B]))).toBe(B)
    expect(leader(race(call, { a: said({ [A]: 'yes', [B]: 'yes' }, 1) }, [A, B]))).toBe(A)
    expect(leader(race(call, {}, [A, B]))).toBe('')
  })

  it('works before anyone has been asked', () => {
    expect(race(undefined, { a: said({ [A]: 'yes' }, 1) }, [A, B])[0]!.summary.lineup).toEqual(['a'])
  })

  it('keeps a poll on Home until every date has a yes or no', () => {
    const gig = { date: A, dateOptions: [A, B] }
    expect(needsAnswer(gig, null)).toBe(true)
    expect(needsAnswer(gig, { dates: { [A]: 'yes' } })).toBe(true)
    expect(needsAnswer(gig, { dates: { [A]: 'yes', [B]: 'later' } })).toBe(true)
    expect(needsAnswer(gig, { dates: { [A]: 'yes', [B]: 'no' } })).toBe(false)
    expect(needsAnswer({ date: A }, { answer: 'yes' })).toBe(false)
    expect(needsAnswer({ date: A }, { answer: 'later' })).toBe(true)
  })

  it('changes one date at a time and drops "know by" once nothing is unsure', () => {
    const first = withAnswer(undefined, A, 'later', '2026-10-15')
    expect(first).toEqual({ dates: { [A]: 'later' }, until: '2026-10-15' })
    const second = withAnswer({ ...first!, by: 'x', at: 1 }, B, 'yes')
    expect(second).toEqual({ dates: { [A]: 'later', [B]: 'yes' }, until: '2026-10-15' })
    expect(withAnswer({ ...second!, by: 'x', at: 1 }, A, 'no')).toEqual({ dates: { [A]: 'no', [B]: 'yes' } })
    expect(withAnswer(said({ [A]: 'yes' }, 1), A, null)).toBeNull()
  })

  it('keeps the earliest "know by" while more than one date is unsure', () => {
    const was = said({ [A]: 'later' }, 1, '2026-10-15')
    expect(withAnswer(was, B, 'later', '2026-11-01')?.until).toBe('2026-10-15')
    expect(withAnswer(was, B, 'later', '2026-10-01')?.until).toBe('2026-10-01')
    expect(withAnswer(was, A, 'later', '2026-11-01')?.until).toBe('2026-11-01')
  })

  it('orders each date by when that date was answered', () => {
    const stored = { kyle: { ...said({ [A]: 'yes', [B]: 'yes' }, 50), times: { [A]: 5, [B]: 50 } } }
    expect(answersOn(stored, A).kyle?.at).toBe(5)
    expect(answersOn(stored, B).kyle?.at).toBe(50)
  })

  it('locking carries the chosen date\'s answers over and clears people who skipped it', () => {
    const rows = [
      { id: 'kyle', dates: { [A]: 'yes', [B]: 'no' } as Record<string, Answer> },
      { id: 'tim', dates: { [B]: 'later' } as Record<string, Answer>, until: '2026-10-15' },
      { id: 'sam', dates: { [A]: 'no' } as Record<string, Answer> },
      { id: 'old', answer: 'yes' as Answer },
    ]
    const { carry, clear } = lockPlan(rows, B)
    expect(carry.map(({ row, answer, until }) => [row.id, answer, until])).toEqual([
      ['kyle', 'no', undefined],
      ['tim', 'later', '2026-10-15'],
    ])
    expect(clear).toEqual(['sam', 'old'])
  })

  it('warns about clashes on each possible date separately', () => {
    const gigs = [{ id: 'x', name: 'Xmas', date: '2026-11-29', stage: 'confirmed' as const, performers: ['me'] }]
    const found = optionClashes(gigs, { id: 'g', date: A, dateOptions: [A, B, C] }, 'me')
    expect(found[A]).toEqual([])
    expect(found[B]).toEqual([{ name: 'Xmas', date: '2026-11-29' }])
    expect(found[C]).toEqual([])
  })

  it('writes the dates the way a person says them', () => {
    expect(optionsText([A, B, C])).toBe('Fri Nov 27, Sat Nov 28 or Fri Dec 4')
  })
})
