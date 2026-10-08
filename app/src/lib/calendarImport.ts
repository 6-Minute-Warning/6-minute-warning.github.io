import { slug } from './directory.ts'
import { gigId, newGig, type Gig, type Stage } from './gigs.ts'
import { normalizeTime } from './request.ts'
import type { Tour, TourDay, TourDayKind } from './tour.ts'

export const IMPORT_BY = 'assistant'
const GIGS = 'gigs'
const TOURS = 'tours'
const EVENTS = 'events'
export const MAX_NOTES = 2000

export interface CalendarEvent {
  id: string
  summary: string
  description?: string
  location?: string
  start: { date?: string; dateTime?: string }
  end: { date?: string; dateTime?: string }
}

export interface Existing {
  gigs: (Partial<Gig> & { id: string })[]
  tours: (Partial<Tour> & { id: string; calendarEventId?: string })[]
}

export interface PlannedChange {
  op: 'set' | 'update'
  path: string
  data: Record<string, unknown>
  now?: string[]
}

export interface ImportPlan {
  created: string[]
  updated: string[]
  skipped: { event: string; summary: string; why: string }[]
  notes: string[]
  changes: PlannedChange[]
}

const NON_GIG = /\b(expense|receipt|reimburse|recording|recorded|rehearsal|invoice|payment)\b/i
const TOUR_TITLE = /\btour\b/i
const TRAVEL = /\b(travel|departure|flight)\b/i
const FREE = /\b(buffer|free|rest)\b/i
const STAGES: [RegExp, Stage][] = [
  [/\(?\s*contracting\s*\)?/i, 'contracting'],
  [/\(?\s*tentative\s*\)?/i, 'tentative'],
  [/\(?\s*confirmed\s*\)?/i, 'confirmed'],
]
const PREFIX = /^\s*6\s*mw\b\s*(?:[-–:]\s*)?(?:gig\s*)?(?:tentative\s*gig\s*:?\s*)?/i
const MARKER = /\(?\s*(contracting|tentative|confirmed)\s*\)?\s*$/i

const day = (v?: string) => (v ? v.slice(0, 10) : '')

export function eventDays(e: CalendarEvent): { first: string; last: string } {
  const first = day(e.start.date ?? e.start.dateTime)
  if (e.end.date) {
    const d = new Date(`${day(e.end.date)}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() - 1)
    const last = d.toISOString().slice(0, 10)
    return { first, last: last < first ? first : last }
  }
  return { first, last: day(e.end.dateTime) || first }
}

export function stageOf(summary: string): Stage {
  return STAGES.find(([re]) => re.test(summary))?.[1] ?? 'confirmed'
}

export function nameOf(summary: string): string {
  let name = summary.replace(PREFIX, '').trim()
  name = name.replace(MARKER, '').replace(/^[-–:\s]+|[-–:\s]+$/g, '').trim()
  return name || summary.trim()
}

export function timeOf(e: CalendarEvent): string {
  const t = e.start.dateTime?.slice(11, 16)
  return t ? normalizeTime(t) : ''
}

function eachDay(first: string, last: string): string[] {
  const out: string[] = []
  for (let d = new Date(`${first}T12:00:00Z`); d.toISOString().slice(0, 10) <= last; d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10))
  return out
}

const words = (s: string) => new Set(slug(s).split('-').filter((w) => w.length > 2))
const overlap = (a: string, b: string) => [...words(a)].filter((w) => words(b).has(w)).length

function dayKind(e: CalendarEvent): TourDayKind {
  if (TRAVEL.test(e.summary)) return 'travel'
  if (FREE.test(e.summary)) return 'free'
  return 'show'
}

function placeOf(e: CalendarEvent): string {
  return e.summary.replace(/^6MW\s*[–-]\s*/i, '').replace(/^[^:]*\(presumed\):\s*/i, '').replace(/^Japan:\s*/i, '').trim()
}

function notesFrom(e: CalendarEvent): string {
  return (e.description ?? '').trim().slice(0, MAX_NOTES)
}

/** Turns the band calendar's future events into audited changes; records already in Backstage are matched, not duplicated. */
export function planImport(events: CalendarEvent[], existing: Existing, today: string): ImportPlan {
  const plan: ImportPlan = { created: [], updated: [], skipped: [], notes: [], changes: [] }
  const skip = (e: CalendarEvent, why: string) => plan.skipped.push({ event: e.id, summary: e.summary, why })
  const future = events.filter((e) => eventDays(e).last >= today).sort((a, b) => eventDays(a).first.localeCompare(eventDays(b).first))

  const tours = [...existing.tours]
  const tourEvents = future.filter((e) => TOUR_TITLE.test(e.summary))
  const inTour = new Set<string>()

  for (const e of tourEvents) {
    const span = eventDays(e)
    const known = tours.find((t) => t.start && t.end && t.start <= span.last && t.end >= span.first && (t.name ? overlap(t.name, e.summary) > 0 || /sing/i.test(t.name) : true))
    const window = { first: known?.start && known.start < span.first ? known.start : span.first, last: known?.end && known.end > span.last ? known.end : span.last }
    const children = future.filter((c) => c !== e && !TOUR_TITLE.test(c.summary) && eventDays(c).first >= window.first && eventDays(c).last <= window.last)
    children.forEach((c) => inTour.add(c.id))
    if (known) {
      inTour.add(e.id)
      if (known.calendarEventId === e.id) skip(e, `Already on tour ${known.id}.`)
      else {
        plan.changes.push({ op: 'update', path: `${TOURS}/${known.id}`, data: { calendarEventId: e.id } })
        plan.updated.push(`${TOURS}/${known.id}`)
      }
      const calendarEnd = span.last
      if (known.end !== calendarEnd) plan.notes.push(`Tour ${known.id} runs to ${known.end}; the calendar event ends ${calendarEnd}. Left as is.`)
      for (const c of children) skip(c, `A day of tour ${known.id}, which already lists its days.`)
      continue
    }
    const dated = new Map(children.map((c) => [eventDays(c).first, c]))
    const days: TourDay[] = eachDay(span.first, span.last).map((date) => {
      const c = dated.get(date)
      return c ? { date, kind: dayKind(c), place: placeOf(c) } : { date, kind: 'free', place: 'TBC' }
    })
    const id = slug(`${e.summary.replace(/\(.*?\)/g, '')} ${span.first.slice(0, 4)}`)
    const tour: Tour & { calendarEventId: string; createdBy: string } = {
      name: nameOf(e.summary).replace(/^[^–-]*[–-]\s*/, '') || nameOf(e.summary),
      start: span.first,
      end: span.last,
      rough: true,
      places: '',
      days,
      version: 1,
      covered: '',
      notCovered: '',
      perSinger: 0,
      commitBy: '',
      notes: notesFrom(e),
      stage: 'planning',
      calendarEventId: e.id,
      createdBy: IMPORT_BY,
    }
    plan.changes.push({ op: 'set', path: `${TOURS}/${id}`, data: { ...tour }, now: ['createdAt'] })
    plan.created.push(`${TOURS}/${id}`)
    inTour.add(e.id)
    children.forEach((c) => skip(c, `A day of the new tour ${id}.`))
  }

  const gigs = [...existing.gigs]
  for (const e of future) {
    if (inTour.has(e.id)) continue
    if (NON_GIG.test(e.summary)) {
      skip(e, 'Not a gig (expense note, recording or rehearsal).')
      continue
    }
    const span = eventDays(e)
    const days = new Set(eachDay(span.first, span.last))
    const name = nameOf(e.summary)
    const onDays = gigs.filter((g) => g.date && days.has(g.date))
    const match = onDays.length === 1 ? onDays[0] : onDays.filter((g) => overlap(g.name ?? '', name) > 0).sort((a, b) => overlap(b.name ?? '', name) - overlap(a.name ?? '', name))[0]
    if (onDays.length > 1 && !match) {
      skip(e, `${onDays.length} gigs on those days and none matches the name. Check by hand.`)
      continue
    }
    if (match) {
      const patch: Record<string, unknown> = {}
      if (!(match as { calendarEventId?: string }).calendarEventId) patch.calendarEventId = e.id
      const desc = notesFrom(e)
      if (desc && !(match.notes ?? '').trim()) patch.notes = desc
      const time = timeOf(e)
      if (time && !(match.time ?? '').trim()) patch.time = time
      if (stageOf(e.summary) !== match.stage) plan.notes.push(`${match.id}: Backstage says ${match.stage}, the calendar says ${stageOf(e.summary)}. Left as is.`)
      if (name && slug(name) !== slug(match.name ?? '') && overlap(match.name ?? '', name) === 0) plan.notes.push(`${match.id}: matched "${e.summary}" by date only.`)
      if (Object.keys(patch).length) {
        plan.changes.push({ op: 'update', path: `${GIGS}/${match.id}`, data: patch })
        plan.updated.push(`${GIGS}/${match.id}`)
      } else skip(e, `Already in Backstage as ${match.id}.`)
      continue
    }
    const id = gigId(name, span.first)
    const gig: Gig & { calendarEventId: string } = {
      ...newGig({ name, date: span.first, time: timeOf(e), venue: e.location?.trim() ?? '' }),
      stage: stageOf(e.summary),
      notes: notesFrom(e),
      createdBy: IMPORT_BY,
      calendarEventId: e.id,
    }
    plan.changes.push({ op: 'set', path: `${GIGS}/${id}`, data: { ...gig }, now: ['createdAt'] })
    plan.changes.push({ op: 'set', path: `${EVENTS}/${id}-import`, data: { gig: id, kind: 'created', detail: name, by: IMPORT_BY }, now: ['at'] })
    plan.created.push(`${GIGS}/${id}`)
    gigs.push({ ...gig, id })
    if (!/\b(tentative|contracting|confirmed)\b/i.test(e.summary)) plan.notes.push(`${id}: the title says nothing about status, so it is confirmed.`)
  }
  return plan
}
