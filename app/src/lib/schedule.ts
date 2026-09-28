import { startTime, TIME_ZONE, type EventPerson } from './calendar'
import { timeOptions, type Gig } from './gigs'
import type { PersonRecord } from './people'

export interface Rehearsal {
  date: string
  start: string
  end: string
  place: string
  address: string
  gigs: string[]
  notes: string
  calendarEventId?: string
  createdBy?: string
}

export type RehearsalRow = Rehearsal & { id: string }
export type Reply = 'yes' | 'no'

export interface RehearsalTodo {
  key: string
  title: string
  detail: string
  gig?: string
}

type GigLike = Pick<Gig, 'name' | 'date' | 'stage' | 'performers'> & { rehearsals?: { needed: number } } & { id: string }

export const DEFAULT_START = '7:00pm'
export const DEFAULT_END = '9:30pm'

export function rehearsalTimes(): string[] {
  return timeOptions(9 * 60, 30)
}

const minutes = (time: string) => {
  const t = startTime(time)
  return t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) : 0
}

export function byWhen<R extends Pick<Rehearsal, 'date' | 'start'>>(a: R, b: R) {
  return a.date.localeCompare(b.date) || minutes(a.start) - minutes(b.start)
}

export function upcomingRehearsals<R extends Pick<Rehearsal, 'date' | 'start'>>(rehearsals: R[], today: string): R[] {
  return rehearsals.filter((r) => r.date >= today).sort(byWhen)
}

export function expectedAt(rehearsal: Pick<Rehearsal, 'gigs'>, gigs: GigLike[], people: Pick<PersonRecord & { id: string }, 'id' | 'status'>[]): string[] {
  const linked = gigs.filter((g) => rehearsal.gigs.includes(g.id) && g.stage !== 'cancelled' && g.performers?.length)
  if (linked.length) return [...new Set(linked.flatMap((g) => g.performers))]
  return people.filter((p) => p.status === 'active').map((p) => p.id)
}

export function cantMake(replies: Record<string, Reply>): string[] {
  return Object.entries(replies)
    .filter(([, answer]) => answer === 'no')
    .map(([id]) => id)
}

function latest(rehearsals: Rehearsal[]): Rehearsal | undefined {
  const sorted = [...rehearsals].sort(byWhen)
  return sorted[sorted.length - 1]
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function suggestNext(rehearsals: Rehearsal[], today: string, before = ''): Omit<Rehearsal, 'gigs' | 'notes'> {
  const last = latest(rehearsals)
  if (!last) return { date: '', start: DEFAULT_START, end: DEFAULT_END, place: '', address: '' }
  let date = addDays(last.date, 7)
  while (date < today) date = addDays(date, 7)
  if (before && date > before) {
    const taken = new Set(rehearsals.map((r) => r.date))
    date = addDays(date, -7)
    while (date >= today && (date > before || taken.has(date))) date = addDays(date, -7)
    if (date < today) date = ''
  }
  return { date, start: last.start, end: last.end, place: last.place, address: last.address }
}

export function placesOf(rehearsals: Pick<Rehearsal, 'place' | 'address'>[]): { name: string; address: string }[] {
  const seen = new Map<string, { name: string; address: string }>()
  for (const r of rehearsals) {
    const name = r.place?.trim()
    if (!name) continue
    const had = seen.get(name.toLowerCase())
    seen.set(name.toLowerCase(), { name: had?.name ?? name, address: had?.address || r.address?.trim() || '' })
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function schedulerTodos(rehearsals: Rehearsal[], gigs: GigLike[], today: string, day: (date: string) => string): RehearsalTodo[] {
  const todos: RehearsalTodo[] = []
  if (!rehearsals.some((r) => r.date >= today)) {
    const last = latest(rehearsals)
    todos.push({ key: 'next', title: 'Book the next rehearsal', detail: last ? `Nothing is booked after ${day(last.date)}.` : 'Nothing is booked yet.' })
  }
  for (const g of gigs) {
    const needed = g.rehearsals?.needed ?? 0
    if (g.stage === 'cancelled' || g.date < today || needed <= 0) continue
    const have = rehearsals.filter((r) => r.gigs.includes(g.id) && r.date <= g.date).length
    if (have >= needed) continue
    todos.push({
      key: `gig-${g.id}`,
      title: `Book ${plural(needed - have, 'more rehearsal')} before ${g.name}`,
      detail: `${have} of ${needed} booked. The gig is ${day(g.date)}.`,
      gig: g.id,
    })
  }
  return todos
}

export function rehearsalEventBody(r: Rehearsal, link: string, gigNames: string[], invite: EventPerson[]) {
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const start = startTime(r.start) ?? '19:00'
  const endTime = startTime(r.end)
  const end = endTime && endTime > start ? endTime : `${String(Math.min(23, Number(start.slice(0, 2)) + 2)).padStart(2, '0')}${start.slice(2)}`
  const emails = [...new Set(invite.flatMap((p) => p.emails.map((e) => e.toLowerCase())))]
  return {
    summary: `6MW rehearsal${gigNames.length ? `: ${gigNames.join(', ')}` : ''}`,
    location: [r.place, r.address].filter(Boolean).join(', '),
    description: [
      `<p><a href="${escape(link)}">Can't make it? Say so in Backstage.</a></p>`,
      r.notes.trim() ? `<p>${escape(r.notes).replace(/\n/g, '<br>')}</p>` : '',
    ].join(''),
    start: { dateTime: `${r.date}T${start}:00`, timeZone: TIME_ZONE },
    end: { dateTime: `${r.date}T${end}:00`, timeZone: TIME_ZONE },
    attendees: emails.map((email) => ({ email })),
    guestsCanInviteOthers: false,
  }
}
