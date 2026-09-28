import { seatOf, type Person, type Seat } from './people.ts'

export const LINEUP_SIZE = 6

export type Answer = 'yes' | 'no' | 'later'

export interface AnswerRecord {
  answer: Answer
  by: string
  at: number
  until?: string
}

export interface Call {
  openedBy: string
  openedAt: number
  asked: string[]
  subbing: string[]
  abandoned: boolean
  calendarEventId: string
}

export type CallState = 'waiting' | 'decide' | 'subbing' | 'full' | 'abandoned'

export type SeatOf = (id: string) => Seat | null

export const everyoneSings: SeatOf = () => 'singer'

export const callStateLabels: Record<CallState, string> = {
  waiting: 'Waiting on answers',
  decide: 'Someone can\'t make it',
  subbing: 'Finding a sub',
  full: 'Lineup full',
  abandoned: 'Dropped',
}

export interface CallSummary {
  state: CallState
  lineup: string[]
  spare: string[]
  sound: string
  no: string[]
  waiting: string[]
  later: Record<string, string>
  undecided: string[]
  seeking: string[]
}

export function openCall(asked: string[], by: string, at: number): Call {
  return { openedBy: by, openedAt: at, asked: [...new Set(asked)], subbing: [], abandoned: false, calendarEventId: '' }
}

/** Six singer seats plus a required sound seat; asked people who no longer perform drop out. */
export function summarize(call: Call, answers: Record<string, AnswerRecord>, seat: SeatOf): CallSummary {
  const yes = Object.entries(answers)
    .filter(([, a]) => a.answer === 'yes')
    .sort(([, a], [, b]) => a.at - b.at)
    .map(([id]) => id)
  const singers = yes.filter((id) => seat(id) === 'singer')
  const lineup = singers.slice(0, LINEUP_SIZE)
  const spare = singers.slice(LINEUP_SIZE)
  const sound = yes.find((id) => seat(id) === 'sound') ?? ''
  const asked = call.asked.filter((id) => seat(id) !== null)
  const no = asked.filter((id) => answers[id]?.answer === 'no')
  const waiting = asked.filter((id) => !answers[id] || answers[id].answer === 'later')
  const later = Object.fromEntries(asked.filter((id) => answers[id]?.answer === 'later').map((id) => [id, answers[id]!.until ?? '']))
  const covered = (id: string) => (seat(id) === 'sound' ? !!sound : lineup.length >= LINEUP_SIZE)
  const undecided = no.filter((id) => !call.subbing.includes(id) && !covered(id))
  const seeking = no.filter((id) => call.subbing.includes(id) && !covered(id))

  let state: CallState = 'waiting'
  if (call.abandoned) state = 'abandoned'
  else if (lineup.length >= LINEUP_SIZE && sound) state = 'full'
  else if (undecided.length) state = 'decide'
  else if (seeking.length) state = 'subbing'

  return { state, lineup, spare, sound, no, waiting, later, undecided, seeking }
}

export interface SubOption<P> {
  person: P
  why: string
}

/** Who to ask in place of `outId`: people who cover them, then the same voice part (or any sound tech), then other subs. */
export function subCandidates<P extends Person>(people: P[], outId: string, answers: Record<string, AnswerRecord>): SubOption<P>[] {
  return rankSubs(people, outId, (p) => !answers[p.id])
}

/** Ranks the people `free` allows as stand-ins for `outId`, best first. */
export function rankSubs<P extends Person>(people: P[], outId: string, free: (p: P) => boolean): SubOption<P>[] {
  const byId = new Map<string, Person>(people.map((p) => [p.id, p]))
  const out = byId.get(outId)
  const outFirst = out?.name.split(' ')[0] ?? 'them'
  const forSound = seatOf(out, byId) === 'sound'
  const ranked = people.filter((p) => p.id !== outId && p.status !== 'alumni' && free(p)).flatMap((p): (SubOption<P> & { rank: number })[] => {
    if (p.covers.includes(outId)) return [{ person: p, why: `Covers ${outFirst}`, rank: 0 }]
    if (forSound) return p.jobs.includes('sound') ? [{ person: p, why: 'Does sound', rank: 1 }] : []
    if (p.status !== 'sub' || seatOf(p, byId) !== 'singer') return []
    if (out?.voice && p.voice === out.voice) return [{ person: p, why: `Sings ${p.voice}`, rank: 1 }]
    return [{ person: p, why: p.voice ? `Sub, sings ${p.voice}` : 'Sub', rank: 2 }]
  })
  return ranked.sort((a, b) => a.rank - b.rank || a.person.name.localeCompare(b.person.name)).map(({ person, why }) => ({ person, why }))
}

export function whatsappLink(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

export function callMessage(gig: { name: string; when: string; venue: string }, link: string) {
  const where = gig.venue ? ` at ${gig.venue}` : ''
  return `6MW gig: ${gig.name}, ${gig.when}${where}. Can you make it? Tap to answer: ${link}`
}

export function subMessage(gig: { name: string; when: string; venue: string }, part: string) {
  const where = gig.venue ? ` at ${gig.venue}` : ''
  return `Hi! 6 Minute Warning needs a ${part || 'sub'} for ${gig.name}, ${gig.when}${where}. Can you do it?`
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
}
