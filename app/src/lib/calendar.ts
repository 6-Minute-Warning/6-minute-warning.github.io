import { GoogleAuthProvider, reauthenticateWithPopup } from 'firebase/auth'
import { auth } from './firebase'
import type { Gig } from './gigs'
import type { Answer } from './call'

export const BAND_CALENDAR = 'l2bn21umhm590bt5b10354e30s@group.calendar.google.com'
const TIME_ZONE = 'America/Edmonton'
const SHOW_HOURS = 3

export interface EventPerson {
  name: string
  emails: string[]
}

export interface EventInput {
  gig: Pick<Gig, 'name' | 'date' | 'time' | 'venue' | 'notes' | 'money'>
  link: string
  full: boolean
  singers: EventPerson[]
  soundTech: EventPerson | null
  invite: EventPerson[]
}

export function startTime(time: string): string | null {
  const m = time.match(/(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m\b/i) ?? time.match(/\b(\d{1,2}):(\d{2})\b/)
  if (!m) return null
  let hour = Number(m[1])
  const minute = Number(m[2] ?? 0)
  const half = m[3]?.toLowerCase()
  if (half === 'p' && hour < 12) hour += 12
  if (half === 'a' && hour === 12) hour = 0
  if (hour > 23 || minute > 59) return null
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function when(date: string, time: string) {
  const start = startTime(time)
  if (!start) {
    const next = new Date(`${date}T00:00:00Z`)
    next.setUTCDate(next.getUTCDate() + 1)
    return { start: { date }, end: { date: next.toISOString().slice(0, 10) } }
  }
  const end = new Date(`${date}T${start}:00Z`)
  end.setUTCHours(end.getUTCHours() + SHOW_HOURS)
  return {
    start: { dateTime: `${date}T${start}:00`, timeZone: TIME_ZONE },
    end: { dateTime: end.toISOString().slice(0, 19), timeZone: TIME_ZONE },
  }
}

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const tbd = (s: string) => (s.trim() ? escape(s) : 'TBD')

export function eventBody(input: EventInput) {
  const { gig, link, full, singers, soundTech, invite } = input
  const fee = gig.money?.fee ? `$${gig.money.fee.toLocaleString('en-CA')}` : 'TBD'
  const singerLines = singers.length ? singers.map((s) => `<p>${escape(s.name)}</p>`).join('') : '<p>TBD</p>'
  const description = [
    `<p><a href="${escape(link)}">${full ? 'Gig page in Backstage' : 'Answer Yes or No in Backstage'}</a></p>`,
    '<h3>Contract link:</h3><p>TBD</p>',
    '<h1>Outfits</h1><p>TBD</p>',
    '<h3>Recording Duty</h3><p>TBD</p>',
    `<h1>Fee</h1><p><strong>Fee: ${fee}</strong></p>`,
    `<h1>Personnel</h1><h2>Singers${full ? '' : ' (so far)'}</h2>${singerLines}`,
    `<h2>Sound Tech</h2><p>${soundTech ? escape(soundTech.name) : 'TBD'}</p>`,
    '<h3>Pay Breakdown</h3><p>TBD</p>',
    '<h1>Set List</h1><p>TBD</p>',
    `<h1>Schedule</h1><p>${tbd(gig.time)}</p>`,
    gig.notes.trim() ? `<h1>Notes</h1><p>${escape(gig.notes).replace(/\n/g, '<br>')}</p>` : '',
  ].join('')
  const emails = [...new Set(invite.flatMap((p) => p.emails.map((e) => e.toLowerCase())))]
  return {
    summary: `${full ? '6MW CONFIRMED GIG' : '6MW HOLD'}: ${gig.name}`,
    location: gig.venue,
    description,
    ...when(gig.date, gig.time),
    attendees: emails.map((email) => ({ email })),
    guestsCanInviteOthers: false,
  }
}

export function answersFromAttendees(attendees: { email: string; responseStatus?: string }[], people: { id: string; emails: string[] }[]) {
  const found: Record<string, Answer> = {}
  for (const a of attendees) {
    const answer = a.responseStatus === 'accepted' ? 'yes' : a.responseStatus === 'declined' ? 'no' : null
    const person = people.find((p) => p.emails.some((e) => e.toLowerCase() === a.email.toLowerCase()))
    if (answer && person && !(person.id in found && found[person.id] === 'yes')) found[person.id] = answer
  }
  return found
}

export async function calendarToken() {
  const user = auth.currentUser
  if (!user) throw new Error('Sign in first.')
  const provider = new GoogleAuthProvider()
  provider.addScope('https://www.googleapis.com/auth/calendar.events')
  provider.setCustomParameters({ login_hint: user.email ?? '' })
  const result = await reauthenticateWithPopup(user, provider)
  const token = GoogleAuthProvider.credentialFromResult(result)?.accessToken
  if (!token) throw new Error('Google did not grant calendar access.')
  return token
}

async function call<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(BAND_CALENDAR)}/events${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const reason = (body as { error?: { message?: string } }).error?.message ?? res.statusText
    throw new Error(res.status === 403 || res.status === 404 ? `The band calendar refused this account (${reason}). It needs "Make changes to events" on the 6 Minute Warning calendar.` : reason)
  }
  return body as T
}

export function readEvent(token: string, eventId: string) {
  return call<{ attendees?: { email: string; responseStatus?: string }[] }>(token, `/${encodeURIComponent(eventId)}`)
}

export async function saveEvent(token: string, eventId: string, body: ReturnType<typeof eventBody>) {
  if (!eventId) return call<{ id: string; htmlLink: string }>(token, '?sendUpdates=all', { method: 'POST', body: JSON.stringify(body) })
  const current = await readEvent(token, eventId)
  const replied = new Map((current.attendees ?? []).map((a) => [a.email.toLowerCase(), a.responseStatus]))
  const attendees = body.attendees.map((a) => ({ ...a, responseStatus: replied.get(a.email) ?? 'needsAction' }))
  return call<{ id: string; htmlLink: string }>(token, `/${encodeURIComponent(eventId)}?sendUpdates=all`, {
    method: 'PATCH',
    body: JSON.stringify({ ...body, attendees }),
  })
}
