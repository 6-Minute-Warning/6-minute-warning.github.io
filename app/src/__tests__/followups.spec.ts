import { describe, expect, it } from 'vitest'
import { directory, draft, dueLabel, gigFollowUps, gigStep, greeting, mailto, replyTask, seasonFollowUps, seasonRun, seasons, sortOut, storedFollowUps, type FollowUpTask } from '@/lib/followups'
import { newGig, type GigRow } from '@/lib/gigs'

const gig = (id: string, date: string, contact: string, fields: Partial<GigRow> = {}): GigRow => ({
  id,
  ...newGig({ name: id, date, time: '7:30pm', venue: 'Winspear Centre', contact: { name: contact, email: contact ? `${contact.split(' ')[0]?.toLowerCase()}@example.com` : '', phone: '' } }),
  stage: 'done',
  ...fields,
})

const task = (id: string, fields: Partial<FollowUpTask>): FollowUpTask & { id: string } => ({
  id,
  kind: 'followup',
  reason: 'reply',
  target: 'pat-lee',
  title: '',
  name: 'Pat Lee',
  email: '',
  due: '2026-09-30',
  open: true,
  createdBy: 'm@example.com',
  ...fields,
})

describe('booking seasons', () => {
  it('picks the season being booked now', () => {
    expect(seasonRun('2026-09-28')).toMatchObject({ key: 'holiday-2026', dueBy: '2026-09-30', gigFrom: '2026-11-15' })
    expect(seasonRun('2027-01-20')?.key).toBe('spring-2027')
    expect(seasonRun('2026-05-10')?.key).toBe('fall-2026')
    expect(seasonRun('2026-12-01')).toBeNull()
  })

  it('never has two seasons asking at once', () => {
    for (const s of seasons) {
      const others = seasons.filter((o) => o !== s)
      expect(others.some((o) => s.askFrom >= o.askFrom && s.askFrom <= o.until)).toBe(false)
      expect(s.askFrom <= s.dueBy && s.dueBy <= s.until && s.until < s.gigFrom).toBe(true)
    }
  })
})

describe('seasonal check-ins', () => {
  const today = '2026-09-28'
  const run = seasonRun(today)
  const gigs = [
    gig('trees-2025', '2025-12-05', 'Pat Lee'),
    gig('gala-2024', '2024-11-20', 'Sam Roe'),
    gig('gala-2026', '2026-12-10', 'Sam Roe', { stage: 'tentative' }),
    gig('spring-2026', '2026-04-01', 'Jo Park'),
    gig('old-2021', '2021-12-01', 'Old Friend'),
    gig('dropped-2025', '2025-12-02', 'Kim Ray', { stage: 'cancelled' }),
  ]
  const people = directory(gigs, [{ name: 'Pat Lee', email: 'pat@newmail.com', phone: '' }])

  it('lists past holiday presenters not already booked this holiday', () => {
    const out = seasonFollowUps(run, gigs, people, today)
    expect(out.map((f) => f.name)).toEqual(['Pat Lee'])
    expect(out[0]).toMatchObject({ id: 'followup-holiday-2026-pat-lee', email: 'pat@newmail.com', due: '2026-09-30', why: 'Booked trees-2025, Dec 2025' })
  })

  it('drops a presenter once done, and holds a snoozed one aside', () => {
    const items = seasonFollowUps(run, gigs, people, today)
    expect(sortOut(items, [task('followup-holiday-2026-pat-lee', { open: false })], today).now).toEqual([])
    const snoozed = sortOut(items, [task('followup-holiday-2026-pat-lee', { snoozedUntil: '2026-10-05' })], today)
    expect(snoozed.now).toEqual([])
    expect(snoozed.snoozed.map((f) => f.name)).toEqual(['Pat Lee'])
    expect(sortOut(items, [task('followup-holiday-2026-pat-lee', { snoozedUntil: '2026-09-28' })], today).now).toHaveLength(1)
  })

  it('is empty between seasons', () => {
    expect(seasonFollowUps(null, gigs, people, today)).toEqual([])
  })
})

describe('gig follow-ups', () => {
  const today = '2026-09-28'
  const six = ['a', 'b', 'c', 'd', 'e', 'f']
  const call = { openedBy: 'm@example.com', openedAt: Date.parse('2026-09-21T03:00:00Z'), asked: six, subbing: [], abandoned: false, calendarEventId: '' }

  it('follows the gig pipeline', () => {
    expect(gigStep(gig('g', '2026-11-01', 'Pat', { stage: 'tentative', performers: six }))).toBe('quote')
    expect(gigStep(gig('g', '2026-11-01', 'Pat', { stage: 'tentative', performers: six.slice(1) }))).toBeNull()
    expect(gigStep(gig('g', '2026-11-01', 'Pat', { stage: 'contracting', contract: 'drafting' }))).toBe('contract')
    expect(gigStep(gig('g', '2026-11-01', 'Pat', { stage: 'contracting', contract: 'sent' }))).toBe('chase')
    expect(gigStep(gig('g', '2026-11-01', 'Pat', { stage: 'contracting', contract: 'signed' }))).toBeNull()
    expect(gigStep(gig('g', '2026-11-01', 'Pat', { stage: 'confirmed', contract: 'signed' }))).toBeNull()
    expect(gigStep(gig('g', '2026-11-01', 'Pat', { stage: 'cancelled', call: { ...call, abandoned: true } }))).toBe('decline')
    expect(gigStep(gig('g', '2026-11-01', 'Pat', { stage: 'cancelled' }))).toBeNull()
  })

  it('dates each step and leaves out steps not due for weeks', () => {
    const gigs = [
      gig('quote', '2027-03-01', 'Pat Lee', { stage: 'tentative', performers: six, call }),
      gig('contract-soon', '2026-11-20', 'Sam Roe', { stage: 'contracting' }),
      gig('contract-later', '2027-06-01', 'Jo Park', { stage: 'contracting' }),
      gig('past', '2026-09-01', 'Kim Ray', { stage: 'contracting' }),
      gig('nobody', '2026-11-20', '', { stage: 'contracting' }),
    ]
    const out = gigFollowUps(gigs, directory(gigs, []), today)
    expect(out.map((f) => [f.id, f.due])).toEqual([
      ['followup-quote-quote', '2026-09-23'],
      ['followup-contract-soon-contract', '2026-09-21'],
    ])
    expect(out[0]?.why).toBe('quote, Mon, Mar 1. Lineup is full. Send the quote.')
  })
})

describe('replies owed', () => {
  it('shows open replies, including one raised from an inquiry', () => {
    const tasks = [task('r1', { title: 'Wants a quote', inquiry: 'inq1', email: 'pat@example.com' }), task('r2', { open: false }), task('r3', { reason: 'season' })]
    const out = storedFollowUps(tasks, directory([], []), [])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ id: 'r1', why: 'Wants a quote', inquiry: 'inq1', email: 'pat@example.com' })
  })

  it('builds a reply task keyed to the presenter', () => {
    expect(replyTask({ name: ' Pat Lee ', email: 'pat@example.com', about: ' Quote? ', due: '2026-09-30', inquiry: 'inq1' }, 'm@example.com')).toEqual({
      kind: 'followup',
      reason: 'reply',
      target: 'pat-lee',
      title: 'Quote?',
      name: 'Pat Lee',
      email: 'pat@example.com',
      due: '2026-09-30',
      open: true,
      createdBy: 'm@example.com',
      inquiry: 'inq1',
    })
  })
})

describe('what the manager sees and sends', () => {
  it('says how late something is', () => {
    expect(dueLabel('2026-09-25', '2026-09-28')).toEqual({ text: '3 days overdue', late: true })
    expect(dueLabel('2026-09-27', '2026-09-28')).toEqual({ text: '1 day overdue', late: true })
    expect(dueLabel('2026-09-28', '2026-09-28')).toEqual({ text: 'Today', late: false })
    expect(dueLabel('2026-10-12', '2026-09-28')).toEqual({ text: 'By Oct 12', late: false })
  })

  it('greets people by first name and organisations politely', () => {
    expect(greeting('Pat Lee')).toBe('Hi Pat,')
    expect(greeting('Festival of Trees')).toBe('Hello,')
    expect(greeting('St. Albert Rotary Club')).toBe('Hello,')
    expect(greeting('Madonna')).toBe('Hello,')
  })

  it('drafts the email for the step', () => {
    const g = gig('Festival of Trees Gala', '2026-12-05', 'Pat Lee', { stage: 'tentative', money: { fee: 3100, deposit: 0, paid: 0, merch: 0 } })
    const quote = draft({ id: 'x', reason: 'gig', step: 'quote', name: 'Pat Lee', email: 'p@x.com', phone: '', presenter: 'pat-lee', why: '', due: '', gig: g }, 'Brett')
    expect(quote.subject).toBe('Festival of Trees Gala, Sat, Dec 5')
    expect(quote.body).toContain('Hi Pat,')
    expect(quote.body).toContain('Our fee is $3,100.')
    expect(quote.body).toMatch(/Thanks,\nBrett\n6 Minute Warning$/)
    const holiday = seasons.find((s) => s.id === 'holiday')
    const check = draft({ id: 'x', reason: 'season', name: 'Pat Lee', email: 'p@x.com', phone: '', presenter: 'pat-lee', why: '', due: '', gig: { ...g, date: '2025-12-05' } }, 'Brett', holiday)
    expect(check.subject).toBe('Holiday season with 6 Minute Warning')
    expect(check.body).toContain('singing Festival of Trees Gala for you in Dec 2025')
  })

  it('encodes the mailto link', () => {
    expect(mailto('pat@example.com', { subject: 'A & B', body: 'Hi,\nthere' })).toBe('mailto:pat@example.com?subject=A%20%26%20B&body=Hi%2C%0Athere')
  })
})
