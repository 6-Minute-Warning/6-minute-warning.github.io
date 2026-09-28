import { day } from './db'

export const inquiryStatuses = ['new', 'replied', 'booked', 'declined', 'spam'] as const
export type InquiryStatus = (typeof inquiryStatuses)[number]

export interface Inquiry {
  name: string
  email: string
  phone: string
  eventType: string
  date: string
  location: string
  budget: string
  message: string
  status: InquiryStatus
  source: 'website'
  receivedAt: { toMillis(): number } | null
  handledBy?: string
  gig?: string
}

/** Something a manager owes someone. */
export interface Owed {
  kind: 'reply'
  target: string
  title: string
  since: number
}

export function owed(id: string, i: Inquiry): Owed | null {
  if (i.status !== 'new') return null
  return { kind: 'reply', target: `inquiries/${id}`, title: `Reply to ${i.name}`, since: i.receivedAt?.toMillis() ?? 0 }
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? ''
}

function eventPhrase(i: Pick<Inquiry, 'eventType' | 'date'>) {
  const kind = !i.eventType || i.eventType === 'Other' ? 'event' : i.eventType.toLowerCase()
  return `your ${kind}${i.date ? ` on ${day(i.date, { weekday: 'long', month: 'long', day: 'numeric' })}` : ''}`
}

export function replyDraft(i: Inquiry, from: string): { subject: string; body: string } {
  const body = [
    `Hi ${firstName(i.name)},`,
    '',
    `Thanks for getting in touch about ${eventPhrase(i)}.`,
    '',
    '',
    '',
    from,
    '6 Minute Warning',
  ].join('\n')
  return { subject: 'Your inquiry to 6 Minute Warning', body }
}

export function declineDraft(i: Inquiry, from: string): { subject: string; body: string } {
  const body = [
    `Hi ${firstName(i.name)},`,
    '',
    `Thanks for thinking of us for ${eventPhrase(i)}. Unfortunately we can't take it on, but we hope it goes well.`,
    '',
    from,
    '6 Minute Warning',
  ].join('\n')
  return { subject: 'Your inquiry to 6 Minute Warning', body }
}

export function mailto(to: string, draft: { subject: string; body: string }) {
  return `mailto:${encodeURIComponent(to).replace(/%40/g, '@')}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`
}

export function gigName(i: Pick<Inquiry, 'name' | 'eventType'>) {
  const kind = !i.eventType || i.eventType === 'Other' || i.eventType.startsWith('Concert') ? 'Gig' : i.eventType
  return `${kind} for ${i.name}`.slice(0, 120)
}

export function gigDraft(i: Inquiry) {
  return { name: gigName(i), date: i.date, venue: i.location, presenter: i.name, email: i.email, phone: i.phone }
}

export function ago(ms: number, now = Date.now()) {
  if (!ms) return ''
  const minutes = Math.floor((now - ms) / 60000)
  if (minutes < 60) return minutes <= 1 ? 'just now' : `${minutes} minutes ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours === 1 ? 'an hour ago' : `${hours} hours ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'yesterday' : `${days} days ago`
}

export function byNewest<T extends Pick<Inquiry, 'receivedAt'>>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (b.receivedAt?.toMillis() ?? 0) - (a.receivedAt?.toMillis() ?? 0))
}
