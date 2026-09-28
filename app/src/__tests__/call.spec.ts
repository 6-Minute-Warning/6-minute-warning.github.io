import { describe, expect, it } from 'vitest'
import { callMessage, everyoneSings, initials, openCall, subCandidates, subMessage, summarize, whatsappLink, type AnswerRecord } from '@/lib/call'
import { answersFromAttendees, eventBody, startTime } from '@/lib/calendar'
import { normalizePerson, seatLookup, type PersonRecord } from '@/lib/people'

const six = ['a', 'b', 'c', 'd', 'e', 'f']
const yes = (at: number): AnswerRecord => ({ answer: 'yes', by: 'x@example.com', at })
const no = (at: number): AnswerRecord => ({ answer: 'no', by: 'x@example.com', at })
const soundIs = (...ids: string[]) => (id: string) => (ids.includes(id) ? 'sound' : 'singer') as 'sound' | 'singer'
const withSound = [...six, 'tech']
const seat = soundIs('tech')
const person = (id: string, over: Partial<PersonRecord> = {}) =>
  normalizePerson({ id, name: id, status: 'sub' as const, part: '', phone: '', emails: [], ...over })

describe('band poll', () => {
  it('waits until everyone answers', () => {
    const s = summarize(openCall(six, 'me', 0), { a: yes(1) }, everyoneSings)
    expect(s.state).toBe('waiting')
    expect(s.waiting).toEqual(['b', 'c', 'd', 'e', 'f'])
  })

  it('fills six singer seats in answer order and needs sound to be full', () => {
    const answers = Object.fromEntries(six.map((id, i) => [id, yes(10 - i)]))
    const singersOnly = summarize(openCall(withSound, 'me', 0), { ...answers, sub: yes(99) }, seat)
    expect(singersOnly.state).toBe('waiting')
    expect(singersOnly.lineup).toEqual(['f', 'e', 'd', 'c', 'b', 'a'])
    expect(singersOnly.spare).toEqual(['sub'])
    expect(singersOnly.sound).toBe('')
    const s = summarize(openCall(withSound, 'me', 0), { ...answers, tech: yes(1) }, seat)
    expect(s.state).toBe('full')
    expect(s.sound).toBe('tech')
  })

  it('never lets a sound yes fill a singer seat', () => {
    const answers = { ...Object.fromEntries(six.slice(0, 5).map((id, i) => [id, yes(i)])), tech: yes(0) }
    const s = summarize(openCall(withSound, 'me', 0), answers, seat)
    expect(s.lineup).toHaveLength(5)
    expect(s.lineup).not.toContain('tech')
    expect(s.sound).toBe('tech')
    expect(s.state).toBe('waiting')
  })

  it('asks for a decision when the sound tech says no, and a sound sub closes it', () => {
    const call = openCall(withSound, 'me', 0)
    expect(summarize(call, { tech: no(1) }, seat)).toMatchObject({ state: 'decide', undecided: ['tech'] })
    expect(summarize({ ...call, subbing: ['tech'] }, { tech: no(1) }, seat).state).toBe('subbing')
    const done = summarize(call, { ...Object.fromEntries(six.map((id) => [id, yes(2)])), tech: no(1), soundsub: yes(3) }, soundIs('tech', 'soundsub'))
    expect(done).toMatchObject({ state: 'full', sound: 'soundsub', undecided: [] })
  })

  it('asks for a decision on a no, then looks for a sub once one is chosen', () => {
    const call = openCall(six, 'me', 0)
    expect(summarize(call, { a: no(1) }, seat).state).toBe('decide')
    expect(summarize({ ...call, subbing: ['a'] }, { a: no(1) }, seat).state).toBe('subbing')
  })

  it('does not ask for a sub once the singer seats are already full', () => {
    const answers = { ...Object.fromEntries(six.map((id) => [id, yes(1)])), sam: no(2) }
    expect(summarize(openCall([...withSound, 'sam'], 'me', 0), answers, seat)).toMatchObject({ state: 'waiting', undecided: [] })
  })

  it('a sub saying yes completes the lineup', () => {
    const answers: Record<string, AnswerRecord> = { a: no(1), b: yes(2), c: yes(3), d: yes(4), e: yes(5), f: yes(6), sam: yes(7), tech: yes(1) }
    const s = summarize({ ...openCall(withSound, 'me', 0), subbing: ['a'] }, answers, seat)
    expect(s.state).toBe('full')
    expect(s.lineup).toContain('sam')
  })

  it('reads an old poll that asked the sound tech and a non-performer as singers', () => {
    const roster = [
      person('tech', { status: 'active', jobs: ['sound'] }),
      person('books', { status: 'crew', jobs: ['bookkeeper'] }),
      ...six.map((id) => person(id, { status: 'active' })),
    ]
    const old = openCall(['tech', 'books', ...six], 'me', 0)
    const answers = { ...Object.fromEntries(six.slice(0, 5).map((id) => [id, yes(1)])), tech: yes(0) }
    const s = summarize(old, answers, seatLookup(roster))
    expect(s.sound).toBe('tech')
    expect(s.lineup).toHaveLength(5)
    expect(s.waiting).toEqual(['f'])
  })

  it('counts a "know by" answer as still waiting and keeps its date', () => {
    const s = summarize(openCall(six, 'me', 0), { a: { answer: 'later', by: 'x', at: 1, until: '2026-10-02' } }, everyoneSings)
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
    expect(summarize({ ...openCall(six, 'me', 0), abandoned: true }, {}, everyoneSings).state).toBe('abandoned')
  })
})

describe('finding a sub', () => {
  const roster = [
    person('kim', { name: 'Kim Low', status: 'active', voice: 'Bass' }),
    person('zed', { name: 'Zed', voice: 'Bass' }),
    person('amy', { name: 'Amy', voice: 'T1' }),
    person('bo', { name: 'Bo', voice: 'Bass' }),
    person('cal', { name: 'Cal', voice: 'T2', covers: ['kim'] }),
    person('dee', { name: 'Dee' }),
    person('old', { name: 'Old', status: 'alumni', voice: 'Bass' }),
    person('ray', { name: 'Ray Sound', status: 'crew', jobs: ['sound'] }),
    person('mix', { name: 'Mix', covers: ['ray'] }),
    person('pat', { name: 'Pat', status: 'crew', jobs: ['sound'] }),
    person('lou', { name: 'Lou', status: 'crew', jobs: ['bookkeeper'] }),
  ]

  it('offers who covers the member, then the same voice part, then other subs, with a reason', () => {
    expect(subCandidates(roster, 'kim', {}).map((o) => [o.person.id, o.why])).toEqual([
      ['cal', 'Covers Kim'],
      ['bo', 'Sings Bass'],
      ['zed', 'Sings Bass'],
      ['amy', 'Sub, sings T1'],
      ['dee', 'Sub'],
    ])
  })

  it('skips anyone who already answered', () => {
    expect(subCandidates(roster, 'kim', { bo: no(1), cal: yes(2) }).map((o) => o.person.id)).toEqual(['zed', 'amy', 'dee'])
  })

  it('offers sound subs first, then anyone else with the sound job, and never a singer', () => {
    expect(subCandidates(roster, 'ray', {}).map((o) => [o.person.id, o.why])).toEqual([
      ['mix', 'Covers Ray'],
      ['pat', 'Does sound'],
    ])
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
