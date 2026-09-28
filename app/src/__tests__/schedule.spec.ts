import { describe, expect, it } from 'vitest'
import {
  cantMake,
  expectedAt,
  placesOf,
  rehearsalEventBody,
  rehearsalTimes,
  schedulerTodos,
  suggestNext,
  upcomingRehearsals,
  type Rehearsal,
} from '@/lib/schedule'

const rehearsal = (fields: Partial<Rehearsal>): Rehearsal => ({ date: '2026-10-04', start: '2:00pm', end: '5:00pm', place: 'Studio B', address: '', gigs: [], notes: '', ...fields })
const gig = (id: string, fields: Record<string, unknown> = {}) => ({ id, name: `Gig ${id}`, date: '2026-11-01', stage: 'confirmed' as const, performers: [] as string[], ...fields })
const day = (date: string) => date

describe('rehearsal times', () => {
  it('runs in half hours from 9am to 11:30pm', () => {
    const times = rehearsalTimes()
    expect(times[0]).toBe('9:00am')
    expect(times).toContain('2:00pm')
    expect(times[times.length - 1]).toBe('11:30pm')
  })
})

describe('upcoming rehearsals', () => {
  it('drops past ones and sorts by date, then start time', () => {
    const list = [
      rehearsal({ date: '2026-10-11', start: '7:00pm' }),
      rehearsal({ date: '2026-10-04', start: '7:00pm' }),
      rehearsal({ date: '2026-10-04', start: '10:00am' }),
      rehearsal({ date: '2026-09-27' }),
    ]
    expect(upcomingRehearsals(list, '2026-09-28').map((r) => `${r.date} ${r.start}`)).toEqual(['2026-10-04 10:00am', '2026-10-04 7:00pm', '2026-10-11 7:00pm'])
  })
})

describe('who is expected', () => {
  const people = [
    { id: 'kyle', status: 'active' as const },
    { id: 'joseph', status: 'active' as const },
    { id: 'sam', status: 'sub' as const },
  ]

  it('a whole-band rehearsal expects every active member', () => {
    expect(expectedAt(rehearsal({}), [], people)).toEqual(['kyle', 'joseph'])
  })

  it('a rehearsal for a gig expects the singers booked on it, subs included', () => {
    expect(expectedAt(rehearsal({ gigs: ['g1', 'g2'] }), [gig('g1', { performers: ['kyle', 'sam'] }), gig('g2', { performers: ['sam'] })], people)).toEqual(['kyle', 'sam'])
  })

  it('falls back to the members while the gig has no lineup or is cancelled', () => {
    expect(expectedAt(rehearsal({ gigs: ['g1'] }), [gig('g1')], people)).toEqual(['kyle', 'joseph'])
    expect(expectedAt(rehearsal({ gigs: ['g1'] }), [gig('g1', { stage: 'cancelled', performers: ['sam'] })], people)).toEqual(['kyle', 'joseph'])
  })

  it('lists who said they cannot make it', () => {
    expect(cantMake({ kyle: 'no', joseph: 'yes' })).toEqual(['kyle'])
  })
})

describe('booking the next one', () => {
  it('suggests a week after the last rehearsal, same time and place', () => {
    const last = rehearsal({ date: '2026-09-27', start: '2:00pm', end: '5:00pm', place: "Joseph's place", address: '1 Main St' })
    expect(suggestNext([rehearsal({ date: '2026-09-20' }), last], '2026-09-28')).toEqual({ date: '2026-10-04', start: '2:00pm', end: '5:00pm', place: "Joseph's place", address: '1 Main St' })
  })

  it('skips ahead whole weeks when the last one was long ago', () => {
    expect(suggestNext([rehearsal({ date: '2026-08-02' })], '2026-09-28').date).toBe('2026-10-04')
  })

  it('keeps the suggestion before the gig it prepares for', () => {
    const history = [rehearsal({ date: '2026-10-11' })]
    expect(suggestNext(history, '2026-09-28', '2026-10-17').date).toBe('2026-10-04')
    expect(suggestNext(history, '2026-10-12', '2026-10-17').date).toBe('')
  })

  it('starts blank with evening times when there is no history', () => {
    expect(suggestNext([], '2026-09-28')).toMatchObject({ date: '', start: '7:00pm', end: '9:30pm', place: '' })
  })

  it('offers places used before, with the address someone filled in', () => {
    expect(placesOf([rehearsal({ place: 'Studio B' }), rehearsal({ place: 'studio b', address: '10 Jasper Ave' }), rehearsal({ place: '' })])).toEqual([
      { name: 'Studio B', address: '10 Jasper Ave' },
    ])
  })
})

describe('the scheduler to-dos', () => {
  it('asks for the next rehearsal when nothing is booked from today on', () => {
    const todos = schedulerTodos([rehearsal({ date: '2026-09-20' })], [], '2026-09-28', day)
    expect(todos).toEqual([{ key: 'next', title: 'Book the next rehearsal', detail: 'Nothing is booked after 2026-09-20.' }])
    expect(schedulerTodos([rehearsal({ date: '2026-09-28' })], [], '2026-09-28', day)).toEqual([])
  })

  it('counts the rehearsals a gig still needs, from the director’s number', () => {
    const rehearsals = [rehearsal({ date: '2026-09-20', gigs: ['g1'] }), rehearsal({ date: '2026-10-04', gigs: ['g1'] }), rehearsal({ date: '2026-11-08', gigs: ['g1'] })]
    const todos = schedulerTodos(rehearsals, [gig('g1', { rehearsals: { needed: 4 } })], '2026-09-28', day)
    expect(todos).toEqual([
      { key: 'gig-g1', title: 'Book 2 more rehearsals before Gig g1', detail: '2 of 4 booked. The gig is 2026-11-01.', gig: 'g1' },
    ])
  })

  it('stays quiet when a gig has enough, has no number, is past or is cancelled', () => {
    const rehearsals = [rehearsal({ date: '2026-10-04', gigs: ['g1'] })]
    const gigs = [gig('g1', { rehearsals: { needed: 1 } }), gig('g2'), gig('g3', { rehearsals: { needed: 2 }, date: '2026-09-01' }), gig('g4', { rehearsals: { needed: 2 }, stage: 'cancelled' })]
    expect(schedulerTodos(rehearsals, gigs, '2026-09-28', day)).toEqual([])
  })
})

describe('band calendar event', () => {
  it('names the gigs, times the event and invites each address once', () => {
    const body = rehearsalEventBody(rehearsal({ notes: 'Setup at 1:30pm', address: '1 Main St' }), 'https://app/rehearsals', ['Gala'], [
      { name: 'Kyle', emails: ['Kyle@x.com', 'kyle@x.com'] },
    ])
    expect(body.summary).toBe('6MW rehearsal: Gala')
    expect(body.location).toBe('Studio B, 1 Main St')
    expect(body.start).toEqual({ dateTime: '2026-10-04T14:00:00', timeZone: 'America/Edmonton' })
    expect(body.end).toEqual({ dateTime: '2026-10-04T17:00:00', timeZone: 'America/Edmonton' })
    expect(body.attendees).toEqual([{ email: 'kyle@x.com' }])
    expect(body.description).toContain('Setup at 1:30pm')
  })

  it('runs two hours when the end is missing or before the start', () => {
    expect(rehearsalEventBody(rehearsal({ end: '' }), '', [], []).end.dateTime).toBe('2026-10-04T16:00:00')
    expect(rehearsalEventBody(rehearsal({ end: '1:00pm' }), '', [], []).end.dateTime).toBe('2026-10-04T16:00:00')
  })
})
