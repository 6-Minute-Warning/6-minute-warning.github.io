import { LINEUP_SIZE } from './call'
import type { Gig } from './gigs'

export const MAX_REHEARSALS = 20
export const NOTE_LENGTH = 200

export interface Rehearsals {
  needed: number
  note: string
  by: string
  at: unknown
  lineupKey: string
}

export function lineupKey(performers: readonly string[] | undefined) {
  return [...new Set(performers ?? [])].sort().join(',')
}

export function lineupChange(r: Pick<Rehearsals, 'lineupKey'>, performers: readonly string[] | undefined) {
  const before = new Set(r.lineupKey ? r.lineupKey.split(',') : [])
  const now = new Set(performers ?? [])
  return { joined: [...now].filter((id) => !before.has(id)), left: [...before].filter((id) => !now.has(id)) }
}

export function isCurrent(gig: Pick<Gig, 'performers' | 'rehearsals'>) {
  return !!gig.rehearsals && gig.rehearsals.lineupKey === lineupKey(gig.performers)
}

/** True when the director owes an answer: a full lineup with none for it yet, or any lineup change since the last one. */
export function needsRehearsalAnswer(gig: Pick<Gig, 'date' | 'stage' | 'performers' | 'rehearsals'>, today: string) {
  if (gig.stage === 'cancelled' || gig.stage === 'done' || !gig.date || gig.date < today) return false
  if (isCurrent(gig)) return false
  const count = gig.performers?.length ?? 0
  return gig.rehearsals ? count > 0 : count >= LINEUP_SIZE
}

export function daysUntil(date: string, today: string) {
  return Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000)
}

export function timeUntil(date: string, today: string) {
  const days = daysUntil(date, today)
  if (days < 0) return 'past'
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days < 14) return `in ${days} days`
  return `in ${Math.floor(days / 7)} weeks`
}

export function rehearsalCount(needed: number) {
  return needed === 0 ? 'No rehearsals needed' : `${needed} rehearsal${needed === 1 ? '' : 's'} needed`
}

export function rehearsalAnswer(needed: number, note: string, by: string, performers: readonly string[] | undefined, at: unknown): Rehearsals {
  const n = Math.round(needed)
  if (!Number.isFinite(n) || n < 0 || n > MAX_REHEARSALS) throw new Error(`Pick between 0 and ${MAX_REHEARSALS} rehearsals.`)
  return { needed: n, note: note.trim().slice(0, NOTE_LENGTH), by, at, lineupKey: lineupKey(performers) }
}
