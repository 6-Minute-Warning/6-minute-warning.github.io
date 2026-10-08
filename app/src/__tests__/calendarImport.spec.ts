import { describe, expect, it } from 'vitest'
import { eventDays, nameOf, planImport, stageOf, timeOf, type CalendarEvent, type Existing } from '@/lib/calendarImport'

const TODAY = '2026-10-08'
const allDay = (id: string, summary: string, first: string, endExclusive: string, description = ''): CalendarEvent => ({ id, summary, description, start: { date: first }, end: { date: endExclusive } })
const none: Existing = { gigs: [], tours: [] }

describe('reading titles', () => {
  it('takes the status from the title and defaults to confirmed', () => {
    expect(stageOf('6MW gig Okotokos (tentative)')).toBe('tentative')
    expect(stageOf('6MW - Vermillion (Contracting)')).toBe('contracting')
    expect(stageOf('6MW TENTATIVE Gig: Corporate gig')).toBe('tentative')
    expect(stageOf('6MW - OSAC Showcase')).toBe('confirmed')
  })
  it('strips the band prefix and the status', () => {
    expect(nameOf('6MW - OSAC Showcase')).toBe('OSAC Showcase')
    expect(nameOf('6MW gig Okotokos (tentative)')).toBe('Okotokos')
    expect(nameOf('6MW TENTATIVE Gig: Corporate gig')).toBe('Corporate gig')
    expect(nameOf('6MW- evening gig (tentative)')).toBe('evening gig')
    expect(nameOf('Markerville 6MW Perfomance (tentative)')).toBe('Markerville 6MW Perfomance')
  })
  it('reads all-day ends as exclusive and timed events by their local date and time', () => {
    expect(eventDays(allDay('a', 'x', '2026-10-16T00:00:00Z', '2026-10-19T00:00:00Z'))).toEqual({ first: '2026-10-16', last: '2026-10-18' })
    const timed: CalendarEvent = { id: 't', summary: 'x', start: { dateTime: '2027-04-17T17:00:00-06:00' }, end: { dateTime: '2027-04-17T21:00:00-06:00' } }
    expect(eventDays(timed)).toEqual({ first: '2027-04-17', last: '2027-04-17' })
    expect(timeOf(timed)).toBe('5:00pm')
  })
})

describe('gigs', () => {
  it('creates a gig from a future event, with the calendar id and description as notes', () => {
    const plan = planImport([allDay('ev1', '6MW gig Okotokos (tentative)', '2027-03-05', '2027-03-08', 'Set 1: A, B')], none, TODAY)
    expect(plan.created).toEqual(['gigs/2027-03-05-okotokos'])
    expect(plan.changes[0]).toMatchObject({ op: 'set', path: 'gigs/2027-03-05-okotokos', now: ['createdAt'], data: { name: 'Okotokos', stage: 'tentative', notes: 'Set 1: A, B', calendarEventId: 'ev1', createdBy: 'assistant' } })
    expect(plan.changes[1]).toMatchObject({ path: 'events/2027-03-05-okotokos-import', now: ['at'] })
  })

  it('skips past events and non-gig entries', () => {
    const plan = planImport([allDay('p', 'Old gig', '2026-09-01', '2026-09-02'), allDay('x', 'Expense note: gas', '2026-11-01', '2026-11-02'), allDay('r', 'Recording session', '2026-11-03', '2026-11-04')], none, TODAY)
    expect(plan.changes).toEqual([])
    expect(plan.skipped.map((s) => s.event)).toEqual(['x', 'r'])
  })

  it('matches an existing gig by date instead of duplicating it, and fills only what is empty', () => {
    const existing: Existing = { gigs: [{ id: '2026-10-16-osac', name: 'OSAC', date: '2026-10-16', stage: 'confirmed', notes: '', time: '' }], tours: [] }
    const plan = planImport([allDay('ev', '6MW - OSAC Showcase', '2026-10-16', '2026-10-19', 'Load in 10:35')], existing, TODAY)
    expect(plan.created).toEqual([])
    expect(plan.changes).toEqual([{ op: 'update', path: 'gigs/2026-10-16-osac', data: { calendarEventId: 'ev', notes: 'Load in 10:35' } }])
  })

  it('never overwrites notes, time or stage already in Backstage, and says when the stage differs', () => {
    const existing: Existing = { gigs: [{ id: 'g', name: 'Markerville', date: '2027-04-17', stage: 'contracting', notes: 'mine', time: '7pm' }], tours: [] }
    const ev: CalendarEvent = { id: 'm', summary: 'Markerville 6MW Perfomance (tentative)', description: 'theirs', start: { dateTime: '2027-04-17T17:00:00-06:00' }, end: { dateTime: '2027-04-17T21:00:00-06:00' } }
    const plan = planImport([ev], existing, TODAY)
    expect(plan.changes).toEqual([{ op: 'update', path: 'gigs/g', data: { calendarEventId: 'm' } }])
    expect(plan.notes.join(' ')).toContain('contracting')
  })

  it('does nothing for a gig that already carries the event id and has its notes', () => {
    const existing: Existing = { gigs: [{ id: 'g', name: 'Okotoks', date: '2027-03-05', stage: 'tentative', notes: 'x', time: '', calendarEventId: 'ev' } as never], tours: [] }
    const plan = planImport([allDay('ev', '6MW gig Okotokos (tentative)', '2027-03-05', '2027-03-06')], existing, TODAY)
    expect(plan.changes).toEqual([])
  })

  it('picks the gig whose name matches when several share a day, and flags it when none does', () => {
    const existing: Existing = {
      gigs: [
        { id: 'a', name: 'Corporate Gig tip', date: '2026-11-28', stage: 'tentative', notes: '', time: '' },
        { id: 'b', name: 'Festive Mosiac', date: '2026-11-28', stage: 'tentative', notes: 'x', time: '' },
      ],
      tours: [],
    }
    expect(planImport([allDay('c', '6MW TENTATIVE Gig: Corporate gig', '2026-11-28', '2026-11-29')], existing, TODAY).changes[0]?.path).toBe('gigs/a')
    expect(planImport([allDay('d', 'Something else', '2026-11-28', '2026-11-29')], existing, TODAY).skipped[0]?.why).toContain('2 gigs')
  })
})

describe('tours', () => {
  const japan = allDay('jp', '6MW-Japan tour (tentative)', '2027-05-02', '2027-05-11')
  const radio = allDay('r', '6MW – Japan: FM radio appearances', '2027-04-29', '2027-05-01')
  const kyoto = allDay('k', '6MW – Japan: choir workshops, Kyoto University', '2027-05-03', '2027-05-04')

  it('tags the tour already in Backstage and leaves its days to the tour, including days before the event starts', () => {
    const existing: Existing = { gigs: [], tours: [{ id: 'japan-2027', name: 'SING! Japan tour', start: '2027-04-28', end: '2027-05-10' }] }
    const plan = planImport([japan, radio, kyoto], existing, TODAY)
    expect(plan.changes).toEqual([{ op: 'update', path: 'tours/japan-2027', data: { calendarEventId: 'jp' } }])
    expect(plan.skipped.map((s) => s.event).sort()).toEqual(['k', 'r'])
  })

  it('creates a tour with its days when none exists', () => {
    const plan = planImport([japan, kyoto, allDay('t', '6MW – Japan (presumed): travel day Osaka', '2027-05-06', '2027-05-07')], none, TODAY)
    expect(plan.created).toEqual(['tours/6mw-japan-tour-2027'])
    const tour = plan.changes[0]?.data as { start: string; end: string; days: { date: string; kind: string }[]; stage: string; calendarEventId: string }
    expect(tour).toMatchObject({ start: '2027-05-02', end: '2027-05-10', stage: 'planning', calendarEventId: 'jp' })
    expect(tour.days).toHaveLength(9)
    expect(tour.days.find((d) => d.date === '2027-05-06')?.kind).toBe('travel')
    expect(tour.days.find((d) => d.date === '2027-05-03')?.kind).toBe('show')
    expect(tour.days.find((d) => d.date === '2027-05-02')?.kind).toBe('free')
  })
})
