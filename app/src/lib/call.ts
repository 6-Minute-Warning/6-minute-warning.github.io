import type { PersonRecord } from './people'

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
  no: string[]
  waiting: string[]
  later: Record<string, string>
  undecided: string[]
}

export function openCall(asked: string[], by: string, at: number): Call {
  return { openedBy: by, openedAt: at, asked: [...new Set(asked)], subbing: [], abandoned: false, calendarEventId: '' }
}

export function summarize(call: Call, answers: Record<string, AnswerRecord>): CallSummary {
  const yes = Object.entries(answers)
    .filter(([, a]) => a.answer === 'yes')
    .sort(([, a], [, b]) => a.at - b.at)
    .map(([id]) => id)
  const lineup = yes.slice(0, LINEUP_SIZE)
  const spare = yes.slice(LINEUP_SIZE)
  const no = call.asked.filter((id) => answers[id]?.answer === 'no')
  const waiting = call.asked.filter((id) => !answers[id] || answers[id].answer === 'later')
  const later = Object.fromEntries(call.asked.filter((id) => answers[id]?.answer === 'later').map((id) => [id, answers[id]!.until ?? '']))
  const undecided = no.filter((id) => !call.subbing.includes(id))

  let state: CallState = 'waiting'
  if (call.abandoned) state = 'abandoned'
  else if (lineup.length >= LINEUP_SIZE) state = 'full'
  else if (undecided.length) state = 'decide'
  else if (no.length) state = 'subbing'

  return { state, lineup, spare, no, waiting, later, undecided }
}

export function subCandidates<P extends PersonRecord & { id: string }>(people: P[], outId: string, answers: Record<string, AnswerRecord>): P[] {
  const part = people.find((p) => p.id === outId)?.part.trim().toLowerCase()
  const fits = (p: P) => Number(!!part && p.part.trim().toLowerCase() === part)
  return people
    .filter((p) => p.status === 'sub' && answers[p.id]?.answer !== 'no')
    .sort((a, b) => fits(b) - fits(a) || a.name.localeCompare(b.name))
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
