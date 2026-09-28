import { LINEUP_SIZE } from './call'

export const MAX_TOUR_DAYS = 62

export type TourDayKind = 'travel' | 'show' | 'free'

export const dayKindLabels: Record<TourDayKind, string> = {
  travel: 'Travel',
  show: 'Show',
  free: 'Free',
}

export interface TourDay {
  date: string
  kind: TourDayKind
  place: string
  gig?: string
}

export type TourStage = 'planning' | 'committed' | 'cancelled'

export interface TourCall {
  openedBy: string
  openedAt: number
  asked: string[]
  subbing: string[]
}

export interface Tour {
  name: string
  start: string
  end: string
  rough: boolean
  places: string
  days: TourDay[]
  version: number
  covered: string
  notCovered: string
  perSinger: number
  commitBy: string
  notes: string
  stage: TourStage
  call?: TourCall
  lineup?: Record<string, string[]>
}

export type TourAnswerValue = 'all' | 'some' | 'no' | 'later'

export interface TourAnswer {
  answer: TourAnswerValue
  by: string
  at: number
  version: number
  days?: string[]
  until?: string
  note?: string
}

export type TourState = 'waiting' | 'short' | 'holds' | 'committed' | 'cancelled'

export const tourStateLabels: Record<TourState, string> = {
  waiting: 'Waiting on answers',
  short: 'Short on singers',
  holds: 'Lineup holds',
  committed: 'Committed',
  cancelled: 'Called off',
}

export interface DayCover {
  date: string
  kind: TourDayKind
  place: string
  gig?: string
  in: string[]
  out: string[]
  unknown: string[]
  short: boolean
}

const ms = (date: string) => Date.parse(`${date}T12:00:00Z`)
const iso = (t: number) => new Date(t).toISOString().slice(0, 10)

export function addDays(date: string, n: number) {
  return iso(ms(date) + n * 86400000)
}

export function spanDates(start: string, end: string): string[] {
  if (!start || !end || end < start) return []
  const n = Math.min(MAX_TOUR_DAYS, Math.round((ms(end) - ms(start)) / 86400000) + 1)
  return Array.from({ length: n }, (_, i) => addDays(start, i))
}

export function planDays(start: string, end: string, existing: TourDay[] = []): TourDay[] {
  const kept = new Map(existing.map((d) => [d.date, d]))
  const dates = spanDates(start, end)
  let place = ''
  return dates.map((date, i) => {
    const had = kept.get(date)
    if (had) {
      place = had.place || place
      return had
    }
    const edge = dates.length >= 3 && (i === 0 || i === dates.length - 1)
    return { date, kind: edge ? 'travel' : 'show', place: edge ? '' : place }
  })
}

export interface TourDraft {
  name: string
  start: string
  end: string
  rough: boolean
  places: string
  covered: string
  notCovered: string
  perSinger: string
  commitBy: string
  notes: string
}

export type TourFields = Pick<Tour, 'name' | 'start' | 'end' | 'rough' | 'places' | 'covered' | 'notCovered' | 'perSinger' | 'commitBy' | 'notes'>

export function blankDraft(): TourDraft {
  return { name: '', start: '', end: '', rough: true, places: '', covered: '', notCovered: '', perSinger: '', commitBy: '', notes: '' }
}

export function toDraft(t: TourFields): TourDraft {
  return { ...t, perSinger: t.perSinger ? String(t.perSinger) : '' }
}

export function fromDraft(d: TourDraft): TourFields {
  const end = d.end && d.end >= d.start ? d.end : d.start
  return {
    name: d.name.trim().slice(0, 120),
    start: d.start,
    end: spanDates(d.start, end).slice(-1)[0] ?? end,
    rough: d.rough,
    places: d.places.trim().slice(0, 160),
    covered: d.covered.trim().slice(0, 200),
    notCovered: d.notCovered.trim().slice(0, 200),
    perSinger: Math.max(0, Math.round(Number(d.perSinger) || 0)),
    commitBy: d.commitBy,
    notes: d.notes.trim().slice(0, 2000),
  }
}

export function datesChanged(before: Pick<Tour, 'start' | 'end'>, after: Pick<Tour, 'start' | 'end'>) {
  return before.start !== after.start || before.end !== after.end
}

export function newTour(fields: TourFields): Tour {
  return { ...fields, days: planDays(fields.start, fields.end), version: 1, stage: 'planning' }
}

export function openTourCall(asked: string[], by: string, at: number): TourCall {
  return { openedBy: by, openedAt: at, asked: [...new Set(asked)], subbing: [] }
}

export function weekdays(dates: string[]) {
  return dates.filter((d) => {
    const w = new Date(ms(d)).getUTCDay()
    return w > 0 && w < 6
  }).length
}

export function isCurrent(answer: TourAnswer | undefined, tour: Pick<Tour, 'version'>): answer is TourAnswer {
  return !!answer && answer.version === tour.version
}

export function daysFor(answer: TourAnswer | undefined, tour: Pick<Tour, 'version' | 'days'>): string[] | null {
  if (!isCurrent(answer, tour)) return null
  if (answer.answer === 'all') return tour.days.map((d) => d.date)
  if (answer.answer === 'some') return tour.days.map((d) => d.date).filter((d) => answer.days?.includes(d))
  if (answer.answer === 'no') return []
  return null
}

export function coverage(tour: Pick<Tour, 'version' | 'days' | 'call'>, answers: Record<string, TourAnswer>): DayCover[] {
  const ids = [...new Set([...(tour.call?.asked ?? []), ...Object.keys(answers)])]
  const byTime = (a: string, b: string) => (answers[a]?.at ?? 0) - (answers[b]?.at ?? 0)
  const known = new Map(ids.map((id) => [id, daysFor(answers[id], tour)]))
  return tour.days.map((d) => {
    const cover: DayCover = { ...d, in: [], out: [], unknown: [], short: false }
    for (const id of ids) {
      const days = known.get(id)
      if (days === null || days === undefined) {
        if (tour.call?.asked.includes(id)) cover.unknown.push(id)
      } else if (days.includes(d.date)) cover.in.push(id)
      else cover.out.push(id)
    }
    cover.in.sort(byTime)
    cover.short = d.kind === 'show' && cover.in.length < LINEUP_SIZE
    return cover
  })
}

export function tourState(tour: Pick<Tour, 'stage' | 'version' | 'days' | 'call'>, answers: Record<string, TourAnswer>): TourState {
  if (tour.stage === 'cancelled') return 'cancelled'
  if (tour.stage === 'committed') return 'committed'
  const shows = coverage(tour, answers).filter((d) => d.kind === 'show')
  if (shows.length && shows.every((d) => !d.short)) return 'holds'
  if (shows.some((d) => d.in.length + d.unknown.length < LINEUP_SIZE)) return 'short'
  return 'waiting'
}

export function pickLineup(tour: Pick<Tour, 'version' | 'days' | 'call'>, answers: Record<string, TourAnswer>, isSub: (id: string) => boolean): Record<string, string[]> {
  return Object.fromEntries(
    coverage(tour, answers)
      .filter((d) => d.kind === 'show')
      .map((d) => [d.date, [...d.in.filter((id) => !isSub(id)), ...d.in.filter(isSub)].slice(0, LINEUP_SIZE)]),
  )
}

export interface Gap {
  person: string
  dates: string[]
}

export function gaps(tour: Pick<Tour, 'version' | 'days' | 'call'>, answers: Record<string, TourAnswer>): Gap[] {
  const short = coverage(tour, answers).filter((d) => d.short)
  return (tour.call?.asked ?? [])
    .map((person) => ({ person, dates: short.filter((d) => d.out.includes(person)).map((d) => d.date) }))
    .filter((g) => g.dates.length)
}

const fmt = (date: string, o: Intl.DateTimeFormatOptions) => new Date(`${date}T12:00:00-06:00`).toLocaleDateString('en-CA', { ...o, timeZone: 'America/Edmonton' })

export function shortDate(date: string) {
  return date ? fmt(date, { month: 'short', day: 'numeric' }) : 'No date'
}

export function spanText(start: string, end: string) {
  if (!start) return 'Dates not set'
  const year = fmt(end || start, { year: 'numeric' })
  if (!end || end === start) return `${shortDate(start)}, ${year}`
  const sameMonth = start.slice(0, 7) === end.slice(0, 7)
  return `${shortDate(start)} – ${sameMonth ? fmt(end, { day: 'numeric' }) : shortDate(end)}, ${year}`
}

export function datesText(dates: string[]) {
  const sorted = [...new Set(dates)].sort()
  const runs: string[][] = []
  for (const d of sorted) {
    const run = runs[runs.length - 1]
    if (run && addDays(run[run.length - 1]!, 1) === d) run.push(d)
    else runs.push([d])
  }
  return runs.map((r) => (r.length === 1 ? shortDate(r[0]!) : spanText(r[0]!, r[r.length - 1]!).replace(/, \d{4}$/, ''))).join(', ')
}

export function answerText(answer: TourAnswer | undefined, tour: Pick<Tour, 'version' | 'days'>) {
  if (!answer) return 'Waiting'
  if (!isCurrent(answer, tour)) return 'Dates changed'
  if (answer.answer === 'all') return 'All of it'
  if (answer.answer === 'no') return "Can't go"
  if (answer.answer === 'later') return `Knows by ${shortDate(answer.until ?? '')}`
  const days = daysFor(answer, tour) ?? []
  return `${days.length} ${days.length === 1 ? 'day' : 'days'}: ${datesText(days)}`
}

export function daysLeft(date: string, today: string) {
  return date ? Math.round((ms(date) - ms(today)) / 86400000) : null
}

export function tourMessage(tour: Pick<Tour, 'name' | 'start' | 'end' | 'commitBy'>, link: string) {
  const by = tour.commitBy ? ` We need to know by ${shortDate(tour.commitBy)}.` : ''
  return `6MW tour: ${tour.name}, ${spanText(tour.start, tour.end)}. Can you come?${by} Tap to answer: ${link}`
}

export function tourSubMessage(tour: Pick<Tour, 'name' | 'places'>, part: string, dates: string[]) {
  const where = tour.places ? ` in ${tour.places}` : ''
  return `Hi! 6 Minute Warning needs a ${part || 'sub'} for ${tour.name}${where}, ${datesText(dates)}. Could you come?`
}
