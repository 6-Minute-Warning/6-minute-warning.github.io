export type Data = Record<string, unknown>

export interface AuditEntry {
  id: string
  path: string
  before: Data | null
  after: Data | null
  by: string
  at?: { toDate(): Date } | null
  reason: string
  undoOf?: string
}

export interface FieldChange {
  field: string
  from: string
  to: string
}

const labels: Record<string, string> = {
  gigs: 'Gig',
  tours: 'Tour',
  rehearsals: 'Rehearsal',
  people: 'Roster',
  venues: 'Venue',
  presenters: 'Presenter',
  tasks: 'To-do',
  inquiries: 'Inquiry',
  payments: 'Payment',
  contracts: 'Contract',
  events: 'Log',
  answers: 'Answer',
  expenses: 'Expense',
  replies: 'Rehearsal reply',
}

function isMap(v: unknown): v is Data {
  return !!v && typeof v === 'object' && !Array.isArray(v) && !('toDate' in v) && !('isEqual' in v)
}

function isStamp(v: unknown): v is { toDate(): Date } {
  return !!v && typeof v === 'object' && typeof (v as { toDate?: unknown }).toDate === 'function'
}

/** Deep equality that treats Firestore Timestamps, GeoPoints and references by value. */
export function sameData(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null || b == null) return a == b
  if (typeof a !== 'object' || typeof b !== 'object') return false
  const eq = (a as { isEqual?: (o: unknown) => boolean }).isEqual
  if (typeof eq === 'function') return eq.call(a, b)
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a as Data)
  const kb = Object.keys(b as Data)
  return ka.length === kb.length && ka.every((k) => k in (b as Data) && sameData((a as Data)[k], (b as Data)[k]))
}

export function formatValue(v: unknown): string {
  if (v === undefined) return '—'
  if (v === null) return 'empty'
  if (v === '') return '""'
  if (isStamp(v)) return v.toDate().toLocaleString('en-CA', { timeZone: 'America/Edmonton', dateStyle: 'medium', timeStyle: 'short' })
  if (Array.isArray(v)) return v.length ? v.map((x) => (typeof x === 'object' && x !== null ? JSON.stringify(x) : String(x))).join(', ') : 'none'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

/** Lists the leaf fields that differ, with dotted names for nested maps. */
export function diffFields(before: Data | null, after: Data | null, prefix = ''): FieldChange[] {
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].sort()
  return keys.flatMap((k) => {
    const a = before?.[k]
    const b = after?.[k]
    const field = prefix + k
    if (sameData(a, b)) return []
    if (isMap(a) && isMap(b)) return diffFields(a, b, `${field}.`)
    return [{ field, from: formatValue(a), to: formatValue(b) }]
  })
}

export function kindOf(e: Pick<AuditEntry, 'before' | 'after'>) {
  return e.before && e.after ? 'changed' : e.after ? 'created' : 'deleted'
}

export function describePath(path: string) {
  const parts = path.split('/')
  const collection = (parts.length > 2 ? parts[2] : parts[0]) ?? ''
  const label = labels[collection] ?? collection
  const link = parts[0] === 'gigs' ? `/gigs/${parts[1]}` : parts[0] === 'tours' ? `/tours/${parts[1]}` : parts[0] === 'rehearsals' ? '/rehearsals' : parts[0] === 'people' ? '/roster' : ''
  return { label, id: parts[parts.length - 1] || path, parent: parts.length > 2 ? parts[1] : '', link }
}

export function titleOf(e: Pick<AuditEntry, 'before' | 'after' | 'path'>) {
  const d = e.after ?? e.before ?? {}
  const name = [d.name, d.title, d.description].find((v) => typeof v === 'string' && v)
  return (name as string | undefined) ?? describePath(e.path).id
}

export type UndoCheck = { ok: true } | { ok: false; why: string }

/** Undo is safe only while the document still holds exactly what the change wrote. */
export function canUndo(entry: AuditEntry, current: Data | null, undone: boolean): UndoCheck {
  if (undone) return { ok: false, why: 'Already undone.' }
  if (!sameData(current, entry.after)) return { ok: false, why: 'Changed since, so undo would lose the newer edit. Fix it by hand.' }
  return { ok: true }
}
