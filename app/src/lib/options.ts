import { LINEUP_SIZE, everyoneSings, summarize, type Answer, type AnswerRecord, type Call, type CallSummary, type SeatOf } from './call'
import { clashes, type Gig } from './gigs'

export const MAX_DATE_OPTIONS = 6

export interface StoredAnswer {
  answer?: Answer
  dates?: Record<string, Answer>
  times?: Record<string, number>
  by: string
  at: number
  until?: string
}

export interface Standing {
  date: string
  summary: CallSummary
  filledAt: number | null
}

type Dated = Pick<Gig, 'date' | 'dateOptions'>

export function hasOptions(gig: Partial<Dated> | null | undefined): boolean {
  return (gig?.dateOptions?.length ?? 0) > 1
}

export function datesOf(gig: Dated): string[] {
  return hasOptions(gig) ? gig.dateOptions! : gig.date ? [gig.date] : []
}

export function normalizeOptions(dates: string[]): string[] {
  return [...new Set(dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort().slice(0, MAX_DATE_OPTIONS)
}

export function answersOn(stored: Record<string, StoredAnswer>, date: string): Record<string, AnswerRecord> {
  const out: Record<string, AnswerRecord> = {}
  for (const [id, a] of Object.entries(stored)) {
    const value = a.dates?.[date]
    if (value) out[id] = { answer: value, by: a.by, at: a.times?.[date] ?? a.at, ...(value === 'later' && a.until ? { until: a.until } : {}) }
  }
  return out
}

const noCall: Call = { openedBy: '', openedAt: 0, asked: [], subbing: [], abandoned: false, calendarEventId: '' }

export function race(call: Call | undefined, stored: Record<string, StoredAnswer>, dates: string[], seat: SeatOf = everyoneSings): Standing[] {
  return dates.map((date) => {
    const on = answersOn(stored, date)
    const summary = summarize(call ?? noCall, on, seat)
    const sixth = summary.lineup[LINEUP_SIZE - 1]
    return { date, summary, filledAt: sixth ? on[sixth]!.at : null }
  })
}

/** The date that filled six first, else the one with most yeses and fewest can'ts; '' until anyone says yes. */
export function leader(standings: Standing[]): string {
  const ranked = [...standings].sort(
    (a, b) =>
      (a.filledAt ?? Infinity) - (b.filledAt ?? Infinity) ||
      b.summary.lineup.length - a.summary.lineup.length ||
      a.summary.no.length - b.summary.no.length ||
      a.date.localeCompare(b.date),
  )
  return ranked[0]?.summary.lineup.length ? ranked[0].date : ''
}

export function needsAnswer(gig: Dated, mine: Pick<StoredAnswer, 'answer' | 'dates'> | null | undefined): boolean {
  if (!hasOptions(gig)) return !mine?.answer || mine.answer === 'later'
  return datesOf(gig).some((d) => !mine?.dates?.[d] || mine.dates[d] === 'later')
}

export function withAnswer(was: StoredAnswer | undefined, date: string, value: Answer | null, until?: string): { dates: Record<string, Answer>; until?: string } | null {
  const dates = { ...was?.dates }
  if (value) dates[date] = value
  else delete dates[date]
  if (!Object.keys(dates).length) return null
  const others = Object.entries(dates).some(([d, v]) => d !== date && v === 'later')
  const fresh = value === 'later' ? until : undefined
  const keep = fresh && others && was?.until ? [fresh, was.until].sort()[0] : fresh || (others ? was?.until : undefined)
  return keep ? { dates, until: keep } : { dates }
}

export function lockPlan<T extends Pick<StoredAnswer, 'dates' | 'until'>>(rows: (T & { id: string })[], date: string) {
  const carry: { row: T & { id: string }; answer: Answer; until?: string }[] = []
  const clear: string[] = []
  for (const row of rows) {
    const value = row.dates?.[date]
    if (value) carry.push({ row, answer: value, ...(value === 'later' && row.until ? { until: row.until } : {}) })
    else clear.push(row.id)
  }
  return { carry, clear }
}

export function optionClashes<G extends Pick<Gig, 'name' | 'date' | 'stage' | 'performers'> & { id: string }>(gigs: G[], gig: Dated & { id: string }, person: string) {
  return Object.fromEntries(datesOf(gig).map((date) => [date, clashes(gigs, { id: gig.id, date }, person).map((g) => ({ name: g.name, date: g.date }))]))
}

function short(date: string, options: Intl.DateTimeFormatOptions) {
  return new Date(`${date}T12:00:00-06:00`).toLocaleDateString('en-CA', { ...options, timeZone: 'America/Edmonton' })
}

export function optionsText(dates: string[]): string {
  const days = dates.map((d) => `${short(d, { weekday: 'short' })} ${short(d, { month: 'short', day: 'numeric' })}`.replace(/\./g, ''))
  return days.length > 1 ? `${days.slice(0, -1).join(', ')} or ${days[days.length - 1]}` : (days[0] ?? '')
}

export function dateSaid(date: string, value: Answer): string {
  const when = optionsText([date])
  return value === 'yes' ? `You're in for ${when}.` : value === 'no' ? `Saved: you can't do ${when}.` : `Saved: not sure about ${when} yet.`
}

export function monthSpan(dates: string[]): string {
  const months = [...new Set(dates.map((d) => short(d, { month: 'short' }).replace('.', '')))]
  return months.length > 1 ? `${months[0]}–${months[months.length - 1]}` : (months[0] ?? '')
}
