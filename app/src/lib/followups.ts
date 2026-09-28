import { LINEUP_SIZE } from './call'
import { slug, type Presenter, type Task } from './directory'
import type { GigRow } from './gigs'

export type FollowUpReason = 'season' | 'reply' | 'gig'
export type GigStep = 'quote' | 'contract' | 'chase' | 'decline'

export interface FollowUpTask extends Task {
  kind: 'followup'
  reason: FollowUpReason
  name: string
  email: string
  due: string
  snoozedUntil?: string
  season?: string
  gig?: string
  step?: GigStep
  inquiry?: string
  phone?: string
}

export interface FollowUp {
  id: string
  reason: FollowUpReason
  name: string
  email: string
  phone: string
  presenter: string
  why: string
  due: string
  season?: string
  gig?: GigRow
  step?: GigStep
  inquiry?: string
  stored?: FollowUpTask
}

export interface Season {
  id: string
  label: string
  months: string
  line: string
  askFrom: string
  dueBy: string
  until: string
  gigFrom: string
  gigTo: string
}

export const seasons: Season[] = [
  {
    id: 'spring',
    label: 'Spring and festival season',
    months: 'March to May',
    line: "We're booking spring concerts and festivals now. Are you planning anything for March to May?",
    askFrom: '01-05',
    dueBy: '01-31',
    until: '02-14',
    gigFrom: '03-01',
    gigTo: '05-31',
  },
  {
    id: 'summer',
    label: 'Summer outdoor season',
    months: 'June to August',
    line: "We're booking summer now: outdoor stages, festivals and patio shows. Is anything coming up for June to August?",
    askFrom: '02-15',
    dueBy: '03-31',
    until: '04-30',
    gigFrom: '06-01',
    gigTo: '08-31',
  },
  {
    id: 'fall',
    label: 'Fall concert season',
    months: 'September to mid-November',
    line: "We're booking fall concerts now. Are you planning anything for September to mid-November?",
    askFrom: '05-01',
    dueBy: '06-15',
    until: '08-14',
    gigFrom: '09-01',
    gigTo: '11-14',
  },
  {
    id: 'holiday',
    label: 'Holiday season',
    months: 'late November and December',
    line: "We're booking our holiday season now. Are you planning anything for late November or December?",
    askFrom: '08-15',
    dueBy: '09-30',
    until: '11-14',
    gigFrom: '11-15',
    gigTo: '12-31',
  },
]

export interface SeasonRun {
  key: string
  season: Season
  year: string
  dueBy: string
  gigFrom: string
  gigTo: string
}

export const SNOOZE_DAYS = 7
export const CHASE_DAYS = 5
const LOOKAHEAD_DAYS = 14
const HISTORY_YEARS = 3

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000)
}

export function seasonRun(today: string): SeasonRun | null {
  const year = today.slice(0, 4)
  const md = today.slice(5)
  const season = seasons.find((s) => md >= s.askFrom && md <= s.until)
  if (!season) return null
  return { key: `${season.id}-${year}`, season, year, dueBy: `${year}-${season.dueBy}`, gigFrom: `${year}-${season.gigFrom}`, gigTo: `${year}-${season.gigTo}` }
}

const inSeason = (date: string, s: Season) => date.slice(5) >= s.gigFrom && date.slice(5) <= s.gigTo
const month = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-CA', { month: 'short', year: 'numeric', timeZone: 'UTC' }).replace('.', '')
const shortDay = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).replace(/\./g, '')

type Directory = Map<string, Pick<Presenter, 'name' | 'email' | 'phone'>>

export function directory(gigs: GigRow[], presenters: Pick<Presenter, 'name' | 'email' | 'phone'>[]): Directory {
  const found: Directory = new Map()
  for (const g of [...gigs].sort((a, b) => a.date.localeCompare(b.date))) {
    const name = g.contact?.name?.trim()
    if (!name) continue
    const had = found.get(slug(name))
    found.set(slug(name), { name: had?.name ?? name, email: g.contact.email?.trim() || had?.email || '', phone: g.contact.phone?.trim() || had?.phone || '' })
  }
  for (const p of presenters) {
    const had = found.get(slug(p.name))
    found.set(slug(p.name), { name: p.name, email: p.email || had?.email || '', phone: p.phone || had?.phone || '' })
  }
  return found
}

export function seasonFollowUps(run: SeasonRun | null, gigs: GigRow[], people: Directory, today: string): FollowUp[] {
  if (!run) return []
  const since = `${Number(run.year) - HISTORY_YEARS}${today.slice(4)}`
  const last = new Map<string, GigRow>()
  const booked = new Set<string>()
  for (const g of gigs) {
    const name = g.contact?.name?.trim()
    if (!name || g.stage === 'cancelled') continue
    const key = slug(name)
    if (g.date >= run.gigFrom && g.date <= run.gigTo) booked.add(key)
    else if (g.date && g.date < today && g.date >= since && inSeason(g.date, run.season) && (last.get(key)?.date ?? '') < g.date) last.set(key, g)
  }
  return [...last]
    .filter(([key]) => !booked.has(key))
    .map(([key, g]) => {
      const who = people.get(key)
      return {
        id: `followup-${run.key}-${key}`,
        reason: 'season' as const,
        name: who?.name ?? g.contact.name.trim(),
        email: who?.email ?? '',
        phone: who?.phone ?? '',
        presenter: key,
        why: `Booked ${g.name}, ${month(g.date)}`,
        due: run.dueBy,
        season: run.key,
        gig: g,
      }
    })
}

export function gigStep(g: GigRow): GigStep | null {
  if (g.stage === 'cancelled') return g.call?.abandoned ? 'decline' : null
  if (g.stage === 'tentative' && g.contract === 'none') return (g.performers?.length ?? 0) >= LINEUP_SIZE ? 'quote' : null
  if (g.contract === 'sent' && g.stage !== 'confirmed' && g.stage !== 'done') return 'chase'
  if (g.stage === 'contracting' && (g.contract === 'none' || g.contract === 'drafting')) return 'contract'
  return null
}

const stepWhy: Record<GigStep, string> = {
  quote: 'Lineup is full. Send the quote.',
  contract: 'Send the contract.',
  chase: 'Contract sent, not signed yet.',
  decline: "The band dropped it. Tell them we can't make it.",
}

function stepDue(step: GigStep, g: GigRow, today: string): string {
  if (step === 'quote') return g.call?.openedAt ? addDays(new Date(g.call.openedAt).toLocaleDateString('en-CA', { timeZone: 'America/Edmonton' }), 3) : today
  if (step === 'contract') return addDays(g.date, -60)
  if (step === 'chase') return addDays(g.date, -45)
  return today
}

export function gigFollowUps(gigs: GigRow[], people: Directory, today: string): FollowUp[] {
  const out: FollowUp[] = []
  for (const g of gigs) {
    if (!g.date || g.date < today) continue
    const step = gigStep(g)
    const name = g.contact?.name?.trim() || g.contact?.email?.trim()
    if (!step || !name) continue
    const key = slug(name)
    const who = people.get(key)
    out.push({
      id: `followup-${g.id}-${step}`,
      reason: 'gig',
      name: who?.name ?? name,
      email: g.contact.email?.trim() || who?.email || '',
      phone: g.contact.phone?.trim() || who?.phone || '',
      presenter: key,
      why: `${g.name}, ${shortDay(g.date)}. ${stepWhy[step]}`,
      due: stepDue(step, g, today),
      gig: g,
      step,
    })
  }
  return out.filter((f) => f.due <= addDays(today, LOOKAHEAD_DAYS))
}

export function storedFollowUps(tasks: (FollowUpTask & { id: string })[], people: Directory, gigs: GigRow[]): FollowUp[] {
  return tasks
    .filter((t) => t.reason === 'reply' && t.open)
    .map((t) => {
      const who = people.get(t.target)
      return {
        id: t.id,
        reason: 'reply' as const,
        name: t.name || who?.name || t.target,
        email: t.email || who?.email || '',
        phone: t.phone || who?.phone || '',
        presenter: t.target,
        why: t.title,
        due: t.due,
        gig: gigs.find((g) => g.id === t.gig),
        inquiry: t.inquiry,
        stored: t,
      }
    })
}

export function sortOut(items: FollowUp[], tasks: (FollowUpTask & { id: string })[], today: string): { now: FollowUp[]; snoozed: FollowUp[] } {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const now: FollowUp[] = []
  const snoozed: FollowUp[] = []
  for (const item of items) {
    const stored = item.stored ?? byId.get(item.id)
    if (stored && !stored.open) continue
    const withStored = stored ? { ...item, stored } : item
    if (stored?.snoozedUntil && stored.snoozedUntil > today) snoozed.push(withStored)
    else now.push(withStored)
  }
  const order = (a: FollowUp, b: FollowUp) => a.due.localeCompare(b.due) || a.name.localeCompare(b.name)
  return { now: now.sort(order), snoozed: snoozed.sort((a, b) => (a.stored?.snoozedUntil ?? '').localeCompare(b.stored?.snoozedUntil ?? '')) }
}

export function dueLabel(due: string, today: string): { text: string; late: boolean } {
  const days = daysBetween(today, due)
  if (days < 0) return { text: days === -1 ? '1 day overdue' : `${-days} days overdue`, late: true }
  if (days === 0) return { text: 'Today', late: false }
  if (days === 1) return { text: 'Tomorrow', late: false }
  return { text: `By ${shortDay(due).replace(/^\w+, /, '')}`, late: false }
}

export function followUpTask(f: FollowUp, by: string): FollowUpTask {
  const task: FollowUpTask = { kind: 'followup', reason: f.reason, target: f.presenter, title: f.why, name: f.name, email: f.email, due: f.due, open: true, createdBy: by }
  if (f.season) task.season = f.season
  if (f.reason === 'gig' && f.gig) task.gig = f.gig.id
  if (f.step) task.step = f.step
  if (f.inquiry) task.inquiry = f.inquiry
  return task
}

export function replyTask(fields: { name: string; email: string; about: string; due: string; phone?: string; gig?: string; inquiry?: string }, by: string): FollowUpTask {
  const task: FollowUpTask = { kind: 'followup', reason: 'reply', target: slug(fields.name), title: fields.about.trim(), name: fields.name.trim(), email: fields.email.trim(), due: fields.due, open: true, createdBy: by }
  if (fields.phone?.trim()) task.phone = fields.phone.trim()
  if (fields.gig) task.gig = fields.gig
  if (fields.inquiry) task.inquiry = fields.inquiry
  return task
}

const orgWords = /\b(the|of|and|society|festival|church|centre|center|club|association|foundation|choir|chorus|school|hall|inc|ltd|city|county|events?|productions?|theatre|theater|arts|music|series|legion|lodge|group|company|&)\b/i

export function greeting(name: string): string {
  const words = name.trim().split(/\s+/)
  const person = words.length >= 2 && words.length <= 3 && !orgWords.test(name) && words.every((w) => /^[A-Z][a-z'’-]+$/.test(w))
  return person ? `Hi ${words[0]},` : 'Hello,'
}

export function draft(f: FollowUp, sender: string, season?: Season): { subject: string; body: string } {
  const g = f.gig
  const when = g ? shortDay(g.date) : ''
  const sign = `\n\nThanks,\n${sender ? `${sender}\n` : ''}6 Minute Warning`
  let subject = '6 Minute Warning'
  let text = 'Thanks for getting in touch.'
  if (f.reason === 'season' && season) {
    subject = `${season.label} with 6 Minute Warning`
    text = `${g ? `We loved singing ${g.name} for you in ${month(g.date)}. ` : ''}${season.line} We'd be glad to hold a date and send a quote.`
  } else if (f.reason === 'reply') {
    subject = g ? `${g.name}, ${when}` : 'Following up from 6 Minute Warning'
  } else if (g && f.step === 'quote') {
    subject = `${g.name}, ${when}`
    const fee = g.money?.fee ? ` Our fee is $${g.money.fee.toLocaleString('en-CA')}.` : ''
    text = `6 Minute Warning is available for ${g.name} on ${when}${g.time ? ` at ${g.time}` : ''}${g.venue ? `, ${g.venue}` : ''}.${fee}\n\nIf that works for you, I'll send the contract to hold the date.`
  } else if (g && f.step === 'contract') {
    subject = `Contract: ${g.name}, ${when}`
    text = `The contract for ${g.name} on ${when} is attached. Please sign it and send a copy back to hold the date.`
  } else if (g && f.step === 'chase') {
    subject = `Contract: ${g.name}, ${when}`
    text = `Checking in on the contract for ${g.name} on ${when}. Could you sign it and send a copy back? If anything in it needs changing, reply here.`
  } else if (g && f.step === 'decline') {
    subject = `${g.name}, ${when}`
    text = `I'm sorry to say 6 Minute Warning can't make ${g.name} on ${when}. We couldn't put the full group together that day. Thank you for thinking of us. We'd love to sing for you another time.`
  }
  return { subject, body: `${greeting(f.name)}\n\n${text}${sign}` }
}

export function mailto(email: string, mail: { subject: string; body: string }): string {
  return `mailto:${encodeURIComponent(email).replace(/%40/g, '@')}?subject=${encodeURIComponent(mail.subject)}&body=${encodeURIComponent(mail.body)}`
}
