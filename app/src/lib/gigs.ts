import type { Call } from './call'

export const stages = ['tentative', 'contracting', 'confirmed', 'done', 'cancelled'] as const
export type Stage = (typeof stages)[number]

export const stageLabels: Record<Stage, string> = {
  tentative: 'Tentative',
  contracting: 'Contracting',
  confirmed: 'Confirmed',
  done: 'Done',
  cancelled: 'Cancelled',
}

export const contractStates = ['none', 'drafting', 'sent', 'signed'] as const
export type ContractState = (typeof contractStates)[number]

export const contractLabels: Record<ContractState, string> = {
  none: 'Not started',
  drafting: 'Drafting',
  sent: 'Sent, waiting',
  signed: 'Signed',
}

export interface Gig {
  name: string
  date: string
  time: string
  venue: string
  stage: Stage
  notes: string
  contact: { name: string; email: string; phone: string }
  money: { fee: number; deposit: number; paid: number; merch: number }
  contract: ContractState
  performers: string[]
  soundTech: string
  call?: Call
}

export interface GigRow extends Gig {
  id: string
}

export type Contact = Gig['contact']

export function newGig(fields: Pick<Gig, 'name' | 'date' | 'time' | 'venue'> & { contact?: Contact }): Gig {
  return {
    name: fields.name,
    date: fields.date,
    time: fields.time,
    venue: fields.venue,
    stage: 'tentative',
    notes: '',
    contact: fields.contact ?? { name: '', email: '', phone: '' },
    money: { fee: 0, deposit: 0, paid: 0, merch: 0 },
    contract: 'none',
    performers: [],
    soundTech: '',
  }
}

export function venuesOf(gigs: Pick<Gig, 'venue'>[]): string[] {
  const seen = new Map<string, string>()
  for (const g of gigs) {
    const v = g.venue?.trim()
    if (v && !seen.has(v.toLowerCase())) seen.set(v.toLowerCase(), v)
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b))
}

export function presentersOf(gigs: Pick<Gig, 'contact'>[]): Contact[] {
  const seen = new Map<string, Contact>()
  for (const g of gigs) {
    const c = g.contact
    const key = c?.name?.trim().toLowerCase()
    if (!key) continue
    const had = seen.get(key)
    seen.set(key, {
      name: had?.name || c.name.trim(),
      email: had?.email || c.email?.trim() || '',
      phone: had?.phone || c.phone?.trim() || '',
    })
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export const DEFAULT_TIME = '7:30pm'

export function timeOptions(): string[] {
  const start = 19 * 60 + 30
  return Array.from({ length: 48 }, (_, i) => {
    const minutes = (start + i * 30) % (24 * 60)
    const hour = Math.floor(minutes / 60)
    const shown = hour % 12 || 12
    return `${shown}:${String(minutes % 60).padStart(2, '0')}${hour < 12 ? 'am' : 'pm'}`
  })
}

export function gigId(name: string, date: string) {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
  return [date || 'undated', slug || 'gig'].join('-')
}

export function toStage(status: string): Stage {
  const s = status.trim().toLowerCase()
  if (s === 'confirmed') return 'confirmed'
  if (s === 'contracting') return 'contracting'
  if (s === 'done' || s === 'completed') return 'done'
  if (s === 'cancelled' || s === 'canceled') return 'cancelled'
  return 'tentative'
}

export function toContract(status: string): ContractState {
  const s = status.trim().toLowerCase()
  if (s === 'signed' || s === 'completed') return 'signed'
  if (s.includes('await') || s === 'sent') return 'sent'
  if (s === 'drafting' || s.includes('review') || s.includes('partial')) return 'drafting'
  return 'none'
}

export function balance(gig: Pick<Gig, 'money'>) {
  return Math.max(0, (gig.money.fee ?? 0) - (gig.money.paid ?? 0))
}

export function isUpcoming(gig: Pick<Gig, 'date' | 'stage'>, today: string) {
  return gig.stage !== 'cancelled' && gig.date >= today
}

const str = (value: unknown, max = 200) => (typeof value === 'string' ? value.trim().slice(0, max) : '')
const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 100) / 100 : 0)

export interface PlannedGig {
  id: string
  gig: Gig
}

/** Import fields only; omits performers/soundTech so a merge:true re-import can't wipe lineup set in the app. */
export function importWrite(gig: Gig): Omit<Gig, 'performers' | 'soundTech'> {
  const { performers: _performers, soundTech: _soundTech, ...rest } = gig
  return rest
}

export function planGigImport(rows: unknown[]): { gigs: PlannedGig[]; skipped: string[] } {
  const gigs: PlannedGig[] = []
  const skipped: string[] = []
  const seen = new Set<string>()

  for (const raw of rows) {
    const r = (raw ?? {}) as Record<string, unknown>
    const name = str(r.name, 120)
    if (!name) {
      skipped.push('A row with no name')
      continue
    }
    const date = /^\d{4}-\d{2}-\d{2}/.test(str(r.date)) ? str(r.date).slice(0, 10) : ''
    const id = gigId(name, date)
    if (seen.has(id)) {
      skipped.push(`${name} on ${date || 'no date'} appears twice; the first one wins`)
      continue
    }
    seen.add(id)
    gigs.push({
      id,
      gig: {
        name,
        date,
        time: str(r.time, 80),
        venue: str(r.venue, 160),
        stage: toStage(str(r.status)),
        notes: str(r.notes, 2000),
        contact: { name: str(r.contactName, 120), email: str(r.contactEmail, 160), phone: str(r.contactPhone, 40) },
        money: { fee: num(r.fee), deposit: num(r.deposit), paid: num(r.paid), merch: num(r.merch) },
        contract: toContract(str(r.contractStatus)),
        performers: [],
        soundTech: '',
      },
    })
  }

  return { gigs, skipped }
}
