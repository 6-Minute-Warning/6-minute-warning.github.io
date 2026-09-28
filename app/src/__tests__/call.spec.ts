import { describe, expect, it } from 'vitest'
import { callMessage, initials, openCall, subCandidates, subMessage, summarize, whatsappLink, type AnswerRecord } from '@/lib/call'
import { answersFromAttendees, eventBody, startTime } from '@/lib/calendar'
import type { PersonRecord } from '@/lib/people'

const six = ['a', 'b', 'c', 'd', 'e', 'f']
const yes = (at: number): AnswerRecord => ({ answer: 'yes', by: 'x@example.com', at })
const no = (at: number): AnswerRecord => ({ answer: 'no', by: 'x@example.com', at })

describe('band poll', () => {
  it('waits until everyone answers', () => {
    const s = summarize(openCall(six, 'me', 0), { a: yes(1) })
    expect(s.state).toBe('waiting')
    expect(s.waiting).toEqual(['b', 'c', 'd', 'e', 'f'])
  })

  it('fills the lineup at six yes, in answer order', () => {
    const answers = Object.fromEntries(six.map((id, i) => [id, yes(10 - i)]))
    const s = summarize(openCall(six, 'me', 0), { ...answers, sub: yes(99) })
    expect(s.state).toBe('full')
    expect(s.lineup).toEqual(['f', 'e', 'd', 'c', 'b', 'a'])
    expect(s.spare).toEqual(['sub'])
  })

  it('asks for a decision on a no, then looks for a sub once one is chosen', () => {
    const call = openCall(six, 'me', 0)
    expect(summarize(call, { a: no(1) }).state).toBe('decide')
    expect(summarize({ ...call, subbing: ['a'] }, { a: no(1) }).state).toBe('subbing')
  })

  it('a sub saying yes completes the lineup', () => {
    const answers: Record<string, AnswerRecord> = { a: no(1), b: yes(2), c: yes(3), d: yes(4), e: yes(5), f: yes(6), sam: yes(7) }
    const s = summarize({ ...openCall(six, 'me', 0), subbing: ['a'] }, answers)
    expect(s.state).toBe('full')
    expect(s.lineup).toContain('sam')
  })

  it('counts a "know by" answer as still waiting and keeps its date', () => {
    const s = summarize(openCall(six, 'me', 0), { a: { answer: 'later', by: 'x', at: 1, until: '2026-10-02' } })
    expect(s.waiting).toContain('a')
    expect(s.later).toEqual({ a: '2026-10-02' })
    expect(s.state).toBe('waiting')
  })

  it('writes a sub request and initials', () => {
    expect(subMessage({ name: 'Gala', when: 'Sat, Nov 28', venue: '' }, 'Bass')).toBe('Hi! 6 Minute Warning needs a Bass for Gala, Sat, Nov 28. Can you do it?')
    expect(initials('Kyle  Carter')).toBe('KC')
    expect(initials('Bernard')).toBe('B')
  })

  it('abandoned wins over everything', () => {
    expect(summarize({ ...openCall(six, 'me', 0), abandoned: true }, {}).state).toBe('abandoned')
  })

  it('offers subs who cover the same part first and drops subs who said no', () => {
    const person = (id: string, status: PersonRecord['status'], part: string) => ({ id, name: id, status, part, phone: '', emails: [] })
    const people = [person('kyle', 'active', 'Bass'), person('zed', 'sub', 'Bass'), person('amy', 'sub', 'Tenor'), person('bo', 'sub', 'Bass')]
    expect(subCandidates(people, 'kyle', {}).map((p) => p.id)).toEqual(['bo', 'zed', 'amy'])
    expect(subCandidates(people, 'kyle', { bo: no(1) }).map((p) => p.id)).toEqual(['zed', 'amy'])
  })

  it('builds a WhatsApp link with the message encoded', () => {
    const text = callMessage({ name: 'Gala', when: 'Sat, Nov 28, 2026', venue: 'Hall & Co' }, 'https://x/gigs/1')
    expect(text).toBe('6MW gig: Gala, Sat, Nov 28, 2026 at Hall & Co. Can you make it? Tap to answer: https://x/gigs/1')
    expect(whatsappLink(text)).toContain('Hall%20%26%20Co')
  })
})

describe('calendar event', () => {
  it('reads a start time from free text', () => {
    expect(startTime('7:30pm')).toBe('19:30')
    expect(startTime('Doors 6, show 7:30 p.m.')).toBe('19:30')
    expect(startTime('12am')).toBe('00:00')
    expect(startTime('19:45')).toBe('19:45')
    expect(startTime('TBD')).toBeNull()
  })

  const gig = { name: 'Gala', date: '2026-11-28', time: '10pm', venue: 'Hall', notes: 'Bring <risers>', money: { fee: 3100, deposit: 0, paid: 0, merch: 0 } }
  const people = [
    { name: 'Kyle', emails: ['kyle@6minutewarning.com', 'kyle@gmail.com'] },
    { name: 'Joe', emails: ['Joe@gmail.com'] },
  ]

  it('holds the date with every address invited', () => {
    const body = eventBody({ gig, link: 'https://x/gigs/1', full: false, singers: [], soundTech: null, invite: people })
    expect(body.summary).toBe('6MW HOLD: Gala')
    expect(body.attendees.map((a) => a.email)).toEqual(['kyle@6minutewarning.com', 'kyle@gmail.com', 'joe@gmail.com'])
    expect(body.start).toEqual({ dateTime: '2026-11-28T22:00:00', timeZone: 'America/Edmonton' })
    expect(body.end).toEqual({ dateTime: '2026-11-29T01:00:00', timeZone: 'America/Edmonton' })
    expect(body.description).toContain('Bring &lt;risers&gt;')
    expect(body.description).toContain('Fee: $3,100')
  })

  it('confirms with the lineup and falls back to all day without a time', () => {
    const body = eventBody({ gig: { ...gig, time: '' }, link: 'l', full: true, singers: people, soundTech: { name: 'Russell', emails: [] }, invite: people })
    expect(body.summary).toBe('6MW CONFIRMED GIG: Gala')
    expect(body.start).toEqual({ date: '2026-11-28' })
    expect(body.end).toEqual({ date: '2026-11-29' })
    expect(body.description).toContain('<p>Kyle</p><p>Joe</p>')
    expect(body.description).toContain('<h2>Sound Tech</h2><p>Russell</p>')
  })

  it('turns invite replies into answers, yes winning across a person\'s addresses', () => {
    const roster = [
      { id: 'kyle', emails: ['kyle@6minutewarning.com', 'kyle@gmail.com'] },
      { id: 'joe', emails: ['joe@gmail.com'] },
    ]
    const found = answersFromAttendees(
      [
        { email: 'kyle@gmail.com', responseStatus: 'accepted' },
        { email: 'kyle@6minutewarning.com', responseStatus: 'declined' },
        { email: 'JOE@gmail.com', responseStatus: 'needsAction' },
      ],
      roster,
    )
    expect(found).toEqual({ kyle: 'yes' })
  })
})
