import { describe, expect, it } from 'vitest'
import {
  answerText,
  coverage,
  datesChanged,
  datesText,
  fromDraft,
  blankDraft,
  gaps,
  newTour,
  openTourCall,
  pickLineup,
  planDays,
  spanDates,
  spanText,
  tourState,
  weekdays,
  type Tour,
  type TourAnswer,
} from '@/lib/tour'
import { answerWrite } from '@/lib/tourPoll'

const six = ['a', 'b', 'c', 'd', 'e', 'f']
const all = (at: number, version = 1): TourAnswer => ({ answer: 'all', by: 'x', at, version })
const some = (at: number, days: string[]): TourAnswer => ({ answer: 'some', by: 'x', at, version: 1, days })
const no = (at: number): TourAnswer => ({ answer: 'no', by: 'x', at, version: 1 })

function tour(extra: Partial<Tour> = {}): Tour {
  const t = newTour({ name: 'SING! in Japan', start: '2027-05-10', end: '2027-05-14', rough: true, places: '', covered: '', notCovered: '', perSinger: 0, commitBy: '', notes: '' })
  return { ...t, call: openTourCall(six, 'm', 0), ...extra }
}

describe('tour days', () => {
  it('spans every day from leaving to coming home', () => {
    expect(spanDates('2027-04-29', '2027-05-02')).toEqual(['2027-04-29', '2027-04-30', '2027-05-01', '2027-05-02'])
    expect(spanDates('2027-05-02', '2027-05-01')).toEqual([])
  })

  it('starts with travel days at each end and shows between', () => {
    expect(tour().days.map((d) => d.kind)).toEqual(['travel', 'show', 'show', 'show', 'travel'])
  })

  it('keeps planned days when the dates move', () => {
    const planned = tour().days.map((d) => (d.date === '2027-05-12' ? { ...d, kind: 'free' as const, place: 'Kyoto' } : d))
    const moved = planDays('2027-05-11', '2027-05-16', planned)
    expect(moved.map((d) => d.date)).toEqual(['2027-05-11', '2027-05-12', '2027-05-13', '2027-05-14', '2027-05-15', '2027-05-16'])
    expect(moved[1]).toMatchObject({ kind: 'free', place: 'Kyoto' })
    expect(moved[moved.length - 1]?.kind).toBe('travel')
  })

  it('counts weekdays off work', () => {
    expect(weekdays(spanDates('2027-05-10', '2027-05-16'))).toBe(5)
  })

  it('writes spans and runs of dates for people', () => {
    expect(spanText('2027-05-10', '2027-05-24')).toBe('May 10 – 24, 2027')
    expect(spanText('2027-04-28', '2027-05-03')).toBe('Apr 28 – May 3, 2027')
    expect(datesText(['2027-05-13', '2027-05-11', '2027-05-12', '2027-05-20'])).toBe('May 11 – 13, May 20')
  })

  it('turns a rough form into a tour, never ending before it starts', () => {
    const f = fromDraft({ ...blankDraft(), name: ' Japan ', start: '2027-05-10', end: '2027-05-01', perSinger: '250.4' })
    expect(f).toMatchObject({ name: 'Japan', start: '2027-05-10', end: '2027-05-10', perSinger: 250 })
    expect(fromDraft({ ...blankDraft(), start: '2027-05-10', commitBy: '2027-06-01' }).commitBy).toBe('')
    expect(datesChanged(tour(), { start: '2027-05-10', end: '2027-05-15' })).toBe(true)
  })
})

describe('tour poll', () => {
  it('counts each show day from all-in and some-days answers', () => {
    const answers = { a: all(1), b: all(2), c: all(3), d: all(4), e: all(5), f: some(6, ['2027-05-11']) }
    const cover = coverage(tour(), answers)
    expect(cover[1]).toMatchObject({ date: '2027-05-11', short: false })
    expect(cover[1]!.in).toHaveLength(6)
    expect(cover[2]!.short).toBe(true)
    expect(cover[2]!.out).toEqual(['f'])
    expect(tourState(tour(), answers)).toBe('short')
  })

  it('waits while unanswered singers could still fill a day', () => {
    expect(tourState(tour(), { a: all(1) })).toBe('waiting')
  })

  it('holds once every show day has six, and a sub can fill the gap', () => {
    const answers = { a: all(1), b: all(2), c: all(3), d: all(4), e: all(5), f: some(6, ['2027-05-11']), sam: some(7, ['2027-05-12', '2027-05-13']) }
    expect(tourState(tour(), answers)).toBe('holds')
    const lineup = pickLineup(tour(), answers, (id) => id === 'sam')
    expect(lineup['2027-05-11']).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
    expect(lineup['2027-05-12']).toEqual(['a', 'b', 'c', 'd', 'e', 'sam'])
  })

  it('prefers members over subs when more than six can come', () => {
    const answers = { sam: all(0), a: all(1), b: all(2), c: all(3), d: all(4), e: all(5), f: all(6) }
    expect(pickLineup(tour(), answers, (id) => id === 'sam')['2027-05-11']).toEqual(six)
  })

  it('lists who leaves a show short, on which days', () => {
    const answers = { a: no(1), b: all(2), c: all(3), d: all(4), e: all(5), f: some(6, ['2027-05-11']) }
    expect(gaps(tour(), answers)).toEqual([
      { person: 'a', dates: ['2027-05-11', '2027-05-12', '2027-05-13'] },
      { person: 'f', dates: ['2027-05-12', '2027-05-13'] },
    ])
  })

  it('treats answers to old dates as unanswered', () => {
    const moved = tour({ version: 2 })
    expect(coverage(moved, { a: all(1, 1) })[1]!.unknown).toContain('a')
    expect(answerText(all(1, 1), moved)).toBe('Dates changed')
    expect(answerText(some(1, ['2027-05-11', '2027-05-12']), tour())).toBe('2 days: May 11 – 12')
  })

  it('writes only the fields each answer needs', () => {
    expect(answerWrite('all', 'me', 3, { days: ['x'], until: 'y', note: ' ' })).toEqual({ answer: 'all', by: 'me', version: 3 })
    expect(answerWrite('some', 'me', 1, { days: ['2027-05-12', '2027-05-11', '2027-05-12'] })).toMatchObject({ days: ['2027-05-11', '2027-05-12'] })
    expect(answerWrite('later', 'me', 1, { until: '2027-01-02' })).toMatchObject({ until: '2027-01-02' })
  })
})
