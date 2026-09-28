import { personId } from './people.ts'

export interface Venue {
  name: string
  address: string
}

export interface Presenter {
  name: string
  email: string
  phone: string
  techName: string
  techEmail: string
  techPhone: string
}

export type TaskKind = 'venue' | 'presenter' | 'request' | 'followup'

export interface Task {
  kind: TaskKind
  target: string
  title: string
  open: boolean
  createdBy: string
}

export const slug = personId

export function blankPresenter(fields: Partial<Presenter> = {}): Presenter {
  return { name: '', email: '', phone: '', techName: '', techEmail: '', techPhone: '', ...fields }
}

export function venueTask(venueId: string, name: string, by: string): Task {
  return { kind: 'venue', target: venueId, title: `Add the address for ${name}`, open: true, createdBy: by }
}

export function presenterTask(presenterId: string, name: string, by: string): Task {
  return { kind: 'presenter', target: presenterId, title: `Complete contact and tech details for ${name}`, open: true, createdBy: by }
}

export function mergeNames(...lists: string[][]): string[] {
  const seen = new Map<string, string>()
  for (const name of lists.flat()) {
    const n = name.trim()
    if (n && !seen.has(n.toLowerCase())) seen.set(n.toLowerCase(), n)
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b))
}

export function fuzzyScore(query: string, option: string): number | null {
  const q = query.trim().toLowerCase()
  const o = option.toLowerCase()
  if (!q) return 0
  const at = o.indexOf(q)
  if (at === 0) return 1000 - o.length
  if (at > 0) return (o[at - 1] === ' ' ? 800 : 600) - at
  let score = 300
  let from = 0
  for (const ch of q) {
    if (ch === ' ') continue
    const i = o.indexOf(ch, from)
    if (i < 0) return null
    score -= i - from
    from = i + 1
  }
  return score
}

export function search(query: string, options: string[], limit = 8): string[] {
  return options
    .map((option) => ({ option, score: fuzzyScore(query, option) }))
    .filter((r): r is { option: string; score: number } => r.score !== null)
    .sort((a, b) => b.score - a.score || a.option.localeCompare(b.option))
    .slice(0, limit)
    .map((r) => r.option)
}

export function usualPartner(gigs: { venue: string; contact: { name: string }; date: string }[], from: 'venue' | 'presenter', value: string): string {
  const key = value.trim().toLowerCase()
  if (!key) return ''
  const counts = new Map<string, { name: string; count: number; last: string }>()
  for (const g of gigs) {
    const venue = g.venue?.trim() ?? ''
    const presenter = g.contact?.name?.trim() ?? ''
    const [mine, other] = from === 'venue' ? [venue, presenter] : [presenter, venue]
    if (mine.toLowerCase() !== key || !other) continue
    const had = counts.get(other.toLowerCase())
    counts.set(other.toLowerCase(), { name: other, count: (had?.count ?? 0) + 1, last: had && had.last > g.date ? had.last : g.date })
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || b.last.localeCompare(a.last))[0]?.name ?? ''
}
