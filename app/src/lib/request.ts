import { openCall } from './call.ts'
import { blankPresenter, presenterTask, slug, usualPartner, venueTask, type Presenter, type Task, type Venue } from './directory.ts'
import { gigId, newGig, presentersOf, timeOptions, venuesOf, type Contact, type Gig } from './gigs.ts'
import { normalizePerson, pollAsked, type PersonRecord } from './people.ts'

export const MAX_DATES = 6

export interface GigRequest {
  name: string
  dates: string[]
  time: string
  venue: string
  presenter: Contact
  fee: number
  perSinger: number
  sets: string
  notes: string
  ask: boolean
}

export interface Directory {
  gigs: (Gig & { id: string })[]
  venues: Venue[]
  presenters: Presenter[]
  people: (PersonRecord & { id: string })[]
}

export interface PlannedWrite {
  path: string
  data: Record<string, unknown>
  stamped: boolean
}

export interface RequestPlan {
  id: string
  gig: Gig
  writes: PlannedWrite[]
  events: { kind: string; detail: string }[]
  newVenue: string
  newPresenter: string
  asked: number
}

const fields = ['name', 'date', 'dates', 'time', 'venue', 'presenter', 'fee', 'perSinger', 'sets', 'notes', 'ask']
const presenterFields = ['name', 'email', 'phone']

function text(errors: string[], raw: Record<string, unknown>, key: string, max: number): string {
  const value = raw[key]
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') {
    errors.push(`${key} must be a string`)
    return ''
  }
  if (value.trim().length > max) errors.push(`${key} is longer than ${max} characters`)
  return value.trim()
}

function amount(errors: string[], raw: Record<string, unknown>, key: string): number {
  const value = raw[key]
  if (value === undefined || value === null || value === '') return 0
  const n = typeof value === 'string' ? Number(value.replace(/[$,\s]/g, '')) : value
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) {
    errors.push(`${key} must be a number, 0 or more`)
    return 0
  }
  return Math.round(n)
}

function isDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

export function normalizeTime(value: string): string {
  const t = value.trim().toLowerCase().replace(/\s+/g, '').replace(/\./g, '')
  if (!t) return ''
  const twelve = /^(\d{1,2})(?::(\d{2}))?(am|pm)$/.exec(t)
  const twentyFour = /^(\d{1,2}):(\d{2})$/.exec(t)
  let shown = ''
  if (twelve) shown = `${Number(twelve[1])}:${twelve[2] ?? '00'}${twelve[3]}`
  else if (twentyFour && Number(twentyFour[1]) < 24) {
    const hour = Number(twentyFour[1])
    shown = `${hour % 12 || 12}:${twentyFour[2]}${hour < 12 ? 'am' : 'pm'}`
  }
  return timeOptions().includes(shown) ? shown : value.trim().slice(0, 80)
}

export function readRequest(input: unknown): { request: GigRequest; errors: [] } | { request: null; errors: string[] } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { request: null, errors: ['The request must be a JSON object'] }
  const raw = input as Record<string, unknown>
  const errors = Object.keys(raw)
    .filter((k) => !fields.includes(k))
    .map((k) => `Unknown field "${k}"; allowed: ${fields.join(', ')}`)

  const name = text(errors, raw, 'name', 120)
  if (!name) errors.push('name is required')

  const given = raw.dates !== undefined ? raw.dates : raw.date !== undefined ? [raw.date] : []
  if (raw.dates !== undefined && raw.date !== undefined) errors.push('Send date or dates, not both')
  const list = Array.isArray(given) ? given : [given]
  const bad = list.filter((d) => !isDay(d))
  if (bad.length) errors.push(`Bad date ${bad.map((d) => JSON.stringify(d)).join(', ')}. Use YYYY-MM-DD.`)
  const dates = [...new Set(list.filter(isDay))].sort()
  if (!list.length) errors.push('date or dates is required')
  if (dates.length > MAX_DATES) errors.push(`dates: at most ${MAX_DATES}`)

  let presenter: Contact = { name: '', email: '', phone: '' }
  if (typeof raw.presenter === 'string') presenter.name = text(errors, raw, 'presenter', 120)
  else if (raw.presenter && typeof raw.presenter === 'object' && !Array.isArray(raw.presenter)) {
    const p = raw.presenter as Record<string, unknown>
    Object.keys(p)
      .filter((k) => !presenterFields.includes(k))
      .forEach((k) => errors.push(`Unknown presenter field "${k}"; allowed: ${presenterFields.join(', ')}`))
    presenter = { name: text(errors, p, 'name', 120), email: text(errors, p, 'email', 160), phone: text(errors, p, 'phone', 40) }
    if (!presenter.name && (presenter.email || presenter.phone)) errors.push('presenter.name is required when an email or phone is given')
  } else if (raw.presenter !== undefined && raw.presenter !== null) errors.push('presenter must be a name or an object with name, email and phone')

  if (typeof raw.venue === 'string' && raw.venue.trim() && !slug(raw.venue)) errors.push('venue needs at least one letter or digit')
  if (presenter.name && !slug(presenter.name)) errors.push('presenter.name needs at least one letter or digit')
  if (raw.ask !== undefined && typeof raw.ask !== 'boolean') errors.push('ask must be true or false')

  const request: GigRequest = {
    name,
    dates,
    time: normalizeTime(text(errors, raw, 'time', 80)),
    venue: text(errors, raw, 'venue', 160),
    presenter,
    fee: amount(errors, raw, 'fee'),
    perSinger: amount(errors, raw, 'perSinger'),
    sets: text(errors, raw, 'sets', 60),
    notes: text(errors, raw, 'notes', 2000),
    ask: raw.ask === true,
  }
  return errors.length ? { request: null, errors } : { request, errors: [] }
}

export function requestTask(id: string, name: string, by: string): Task {
  return { kind: 'request', target: id, title: `Check the gig request for ${name}`, open: true, createdBy: by }
}

export function planRequest(request: GigRequest, directory: Directory, by: string, now: number): RequestPlan {
  const venueNames = new Map<string, string>()
  for (const v of [...venuesOf(directory.gigs), ...directory.venues.map((v) => v.name)]) if (v?.trim() && !venueNames.has(slug(v))) venueNames.set(slug(v), v.trim())
  const contacts = new Map(presentersOf(directory.gigs).map((c) => [slug(c.name), c]))
  for (const p of directory.presenters) if (p.name?.trim()) contacts.set(slug(p.name), { name: p.name, email: p.email ?? '', phone: p.phone ?? '' })

  const knownVenue = request.venue ? venueNames.get(slug(request.venue)) : undefined
  let presenterName = request.presenter.name
  let venue = knownVenue ?? request.venue
  if (knownVenue && !presenterName) presenterName = usualPartner(directory.gigs, 'venue', knownVenue)
  const knownPresenter = presenterName ? contacts.get(slug(presenterName)) : undefined
  if (knownPresenter && !venue) venue = usualPartner(directory.gigs, 'presenter', knownPresenter.name)

  const contact: Contact = knownPresenter
    ? { name: knownPresenter.name, email: knownPresenter.email || request.presenter.email, phone: knownPresenter.phone || request.presenter.phone }
    : presenterName
      ? { name: presenterName, email: request.presenter.email, phone: request.presenter.phone }
      : { name: '', email: '', phone: '' }

  const [date = ''] = request.dates
  const id = gigId(request.name, date)
  const members = pollAsked(directory.people.map(normalizePerson)).ids
  const base = newGig({ name: request.name, date, time: request.time, venue, contact })
  const gig: Gig = {
    ...base,
    notes: request.notes,
    sets: request.sets,
    money: { ...base.money, fee: request.fee, perSinger: request.perSinger },
    ...(request.dates.length > 1 ? { dateOptions: request.dates } : {}),
    ...(request.ask ? { call: openCall(members, by, now) } : {}),
    createdBy: by,
    via: 'assistant',
  }

  const writes: PlannedWrite[] = [{ path: `gigs/${id}`, data: { ...gig }, stamped: true }]
  const venueId = venue && !venueNames.has(slug(venue)) ? slug(venue) : ''
  const presenterId = contact.name && !knownPresenter ? slug(contact.name) : ''
  if (venueId) {
    writes.push({ path: `venues/${venueId}`, data: { name: venue, address: '' }, stamped: false })
    writes.push({ path: `tasks/venue-${venueId}`, data: { ...venueTask(venueId, venue, by) }, stamped: true })
  }
  if (presenterId) {
    writes.push({ path: `presenters/${presenterId}`, data: { ...blankPresenter(contact) }, stamped: false })
    writes.push({ path: `tasks/presenter-${presenterId}`, data: { ...presenterTask(presenterId, contact.name, by) }, stamped: true })
  }
  writes.push({ path: `tasks/request-${id}`, data: { ...requestTask(id, request.name, by) }, stamped: true })

  const events = [{ kind: 'created', detail: request.name }]
  if (request.ask) events.push({ kind: 'call', detail: 'asked the band' })
  return { id, gig, writes, events, newVenue: venueId ? venue : '', newPresenter: presenterId ? contact.name : '', asked: request.ask ? members.length : 0 }
}
