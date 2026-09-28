import { describe, expect, it } from 'vitest'
import { newGig } from '@/lib/gigs'
import { normalizeTime, planRequest, readRequest, type Directory, type GigRequest } from '@/lib/request'

const BY = 'assistant@example.com'

function read(input: Record<string, unknown>): GigRequest {
  const { request, errors } = readRequest(input)
  if (!request) throw new Error(errors.join('; '))
  return request
}

const pat = { name: 'Pat Lee', email: 'pat@example.com', phone: '780-555-0100' }
const directory: Directory = {
  gigs: [
    { id: 'old-1', ...newGig({ name: 'Old 1', date: '2025-05-01', time: '7:30pm', venue: 'Winspear Centre', contact: pat }) },
    { id: 'old-2', ...newGig({ name: 'Old 2', date: '2025-06-01', time: '7:30pm', venue: 'Winspear Centre', contact: pat }) },
  ],
  venues: [{ name: 'Allard Hall', address: '11 Main St' }],
  presenters: [{ name: 'Sam Roe', email: 'sam@example.com', phone: '', techName: '', techEmail: '', techPhone: '' }],
  people: [
    { id: 'kyle', name: 'Kyle', status: 'active', part: 'Bass', phone: '', emails: [] },
    { id: 'ann', name: 'Ann', status: 'active', part: 'Alto', phone: '', emails: [] },
    { id: 'sub-sam', name: 'Sub Sam', status: 'sub', part: 'Bass', phone: '', emails: [] },
  ],
}

describe('reading a gig request', () => {
  it('accepts the smallest request and fills in the rest', () => {
    expect(read({ name: 'Tree Gala', date: '2026-12-05' })).toEqual({
      name: 'Tree Gala',
      dates: ['2026-12-05'],
      time: '',
      venue: '',
      presenter: { name: '', email: '', phone: '' },
      fee: 0,
      perSinger: 0,
      sets: '',
      notes: '',
      ask: false,
    })
  })

  it('takes several possible dates, dropping repeats and sorting them', () => {
    expect(read({ name: 'Gala', dates: ['2026-12-12', '2026-12-05', '2026-12-12'] }).dates).toEqual(['2026-12-05', '2026-12-12'])
    expect(readRequest({ name: 'Gala', dates: ['2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05', '2026-12-06', '2026-12-07'] }).errors).toContain('dates: at most 6')
  })

  it('names every problem at once', () => {
    const { errors } = readRequest({ name: '', date: '2026-02-30', fee: -5, ask: 'yes', colour: 'red', presenter: { name: 'Pat', fax: '1' } })
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Unknown field "colour"'),
        'name is required',
        expect.stringContaining('"2026-02-30"'),
        'fee must be a number, 0 or more',
        'ask must be true or false',
        expect.stringContaining('Unknown presenter field "fax"'),
      ]),
    )
  })

  it('needs a date, and only one of date or dates', () => {
    expect(readRequest({ name: 'Gala' }).errors).toContain('date or dates is required')
    expect(readRequest({ name: 'Gala', date: '2026-12-05', dates: ['2026-12-06'] }).errors).toContain('Send date or dates, not both')
    expect(readRequest([]).errors).toEqual(['The request must be a JSON object'])
  })

  it('reads money written as text and a presenter given by name only', () => {
    const r = read({ name: 'Gala', date: '2026-12-05', fee: '$3,100', perSinger: 300.4, presenter: 'Pat Lee' })
    expect(r.fee).toBe(3100)
    expect(r.perSinger).toBe(300)
    expect(r.presenter).toEqual({ name: 'Pat Lee', email: '', phone: '' })
  })

  it('writes show times the way the New gig list does', () => {
    expect(normalizeTime('7:30 PM')).toBe('7:30pm')
    expect(normalizeTime('19:30')).toBe('7:30pm')
    expect(normalizeTime('8pm')).toBe('8:00pm')
    expect(normalizeTime('Doors at 7, show after dinner')).toBe('Doors at 7, show after dinner')
  })
})

describe('planning a gig request', () => {
  it('matches a venue loosely and fills in the presenter usually booked there', () => {
    const plan = planRequest(read({ name: 'Tree Gala', date: '2026-12-05', venue: 'winspear  centre' }), directory, BY, 1)
    expect(plan.gig.venue).toBe('Winspear Centre')
    expect(plan.gig.contact).toEqual(pat)
    expect(plan.newVenue).toBe('')
    expect(plan.newPresenter).toBe('')
    expect(plan.writes.map((w) => w.path)).toEqual(['gigs/2026-12-05-tree-gala', 'tasks/request-2026-12-05-tree-gala'])
  })

  it('fills in the usual venue from a known presenter and keeps their details', () => {
    const plan = planRequest(read({ name: 'Gala', date: '2026-12-05', presenter: { name: 'PAT LEE', phone: '000' } }), directory, BY, 1)
    expect(plan.gig.venue).toBe('Winspear Centre')
    expect(plan.gig.contact).toEqual(pat)
  })

  it('knows venues and presenters that only exist in their own collections', () => {
    const plan = planRequest(read({ name: 'Gala', date: '2026-12-05', venue: 'Allard Hall', presenter: 'Sam Roe' }), directory, BY, 1)
    expect(plan.newVenue).toBe('')
    expect(plan.gig.contact).toEqual({ name: 'Sam Roe', email: 'sam@example.com', phone: '' })
  })

  it('adds a new venue and presenter with a to-do for each, like the New gig page', () => {
    const plan = planRequest(read({ name: 'Gala', date: '2026-12-05', venue: 'Glass Hall', presenter: { name: 'Lee Park', email: 'lee@example.com' } }), directory, BY, 1)
    expect(plan.newVenue).toBe('Glass Hall')
    expect(plan.newPresenter).toBe('Lee Park')
    expect(Object.fromEntries(plan.writes.map((w) => [w.path, w.data]))).toMatchObject({
      'venues/glass-hall': { name: 'Glass Hall', address: '' },
      'tasks/venue-glass-hall': { kind: 'venue', target: 'glass-hall', open: true, createdBy: BY },
      'presenters/lee-park': { name: 'Lee Park', email: 'lee@example.com', phone: '', techName: '' },
      'tasks/presenter-lee-park': { kind: 'presenter', target: 'lee-park', open: true, createdBy: BY },
      'tasks/request-2026-12-05-gala': { kind: 'request', target: '2026-12-05-gala', title: 'Check the gig request for Gala', open: true },
    })
    expect(plan.writes.filter((w) => w.stamped).map((w) => w.path.split('/')[0])).toEqual(['gigs', 'tasks', 'tasks', 'tasks'])
  })

  it('lands tentative with pay and sets, marked as the assistant\'s', () => {
    const { gig } = planRequest(read({ name: 'Gala', date: '2026-12-05', fee: 3100, perSinger: 300, sets: '2 × 45 min', notes: 'Emailed Sept 28' }), directory, BY, 1)
    expect(gig).toMatchObject({ stage: 'tentative', contract: 'none', performers: [], sets: '2 × 45 min', notes: 'Emailed Sept 28', createdBy: BY, via: 'assistant' })
    expect(gig.money).toEqual({ fee: 3100, deposit: 0, paid: 0, merch: 0, perSinger: 300 })
    expect(gig).not.toHaveProperty('call')
    expect(gig).not.toHaveProperty('dateOptions')
  })

  it('files the gig under its earliest date and keeps every option', () => {
    const plan = planRequest(read({ name: 'Gala', dates: ['2026-12-12', '2026-12-05'] }), directory, BY, 1)
    expect(plan.id).toBe('2026-12-05-gala')
    expect(plan.gig.date).toBe('2026-12-05')
    expect(plan.gig.dateOptions).toEqual(['2026-12-05', '2026-12-12'])
  })

  it('asks the active members when ask is true', () => {
    const plan = planRequest(read({ name: 'Gala', date: '2026-12-05', ask: true }), directory, BY, 42)
    expect(plan.gig.call).toEqual({ openedBy: BY, openedAt: 42, asked: ['kyle', 'ann'], subbing: [], abandoned: false, calendarEventId: '' })
    expect(plan.asked).toBe(2)
    expect(plan.events).toEqual([
      { kind: 'created', detail: 'Gala' },
      { kind: 'call', detail: 'asked the band' },
    ])
  })
})
