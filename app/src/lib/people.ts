import { normalizeEmail, type Role } from './access.ts'

export const WORKSPACE_DOMAIN = '6minutewarning.com'

export type PersonStatus = 'active' | 'sub' | 'crew' | 'alumni'

export const voiceParts = ['T1', 'T2', 'T3/VP', 'T4', 'Bari/VP', 'Bass'] as const
export type VoicePart = (typeof voiceParts)[number]

export const jobs = ['leader', 'director', 'scheduler', 'wardrobe', 'sound', 'bookkeeper'] as const
export type Job = (typeof jobs)[number]

export const jobLabels: Record<Job, string> = {
  leader: 'Band leader',
  director: 'Music director',
  scheduler: 'Scheduler',
  wardrobe: 'Wardrobe',
  sound: 'Sound tech',
  bookkeeper: 'Bookkeeper',
}

export interface ImportedPerson {
  name: string
  status: string
  part: string
  email: string
  phone: string
}

/** `part` is the free-text Notion role, kept for reference; `voice`, `jobs` and `covers` are what the app uses. */
export interface PersonRecord {
  name: string
  status: PersonStatus
  part: string
  phone: string
  emails: string[]
  voice?: VoicePart | ''
  jobs?: Job[]
  covers?: string[]
}

export type Person = PersonRecord & { id: string; voice: VoicePart | ''; jobs: Job[]; covers: string[] }

export function normalizePerson<P extends PersonRecord & { id: string }>(p: P): P & Person {
  return {
    ...p,
    part: typeof p.part === 'string' ? p.part : '',
    voice: voiceParts.includes(p.voice as VoicePart) ? (p.voice as VoicePart) : '',
    jobs: Array.isArray(p.jobs) ? p.jobs.filter((j) => jobs.includes(j)) : [],
    covers: Array.isArray(p.covers) ? p.covers : [],
  }
}

export type Seat = 'singer' | 'sound'

/** Which lineup seat a person's yes fills; null when they don't perform. An id missing from the roster counts as a singer. */
export function seatOf(p: Person | undefined, byId: ReadonlyMap<string, Person>): Seat | null {
  if (!p) return 'singer'
  if (p.status === 'alumni') return null
  if (p.jobs.includes('sound')) return 'sound'
  if (p.status === 'crew') return null
  if (p.status === 'sub' && p.covers.length && p.covers.every((id) => byId.get(id)?.jobs.includes('sound'))) return 'sound'
  return 'singer'
}

export function seatLookup(people: Person[]) {
  const byId = new Map(people.map((p) => [p.id, p]))
  return (id: string) => seatOf(byId.get(id), byId)
}

/** Who a band poll asks: every active singer plus every sound tech who isn't a sub. */
export function pollAsked(people: Person[]): { singers: Person[]; sound: Person[]; ids: string[] } {
  const byId = new Map(people.map((p) => [p.id, p]))
  const singers = people.filter((p) => p.status === 'active' && seatOf(p, byId) === 'singer')
  const sound = people.filter((p) => p.status !== 'sub' && seatOf(p, byId) === 'sound')
  return { singers, sound, ids: [...singers, ...sound].map((p) => p.id) }
}

export function askLine(people: Person[]) {
  const { singers, sound } = pollAsked(people)
  const tech = sound.map((p) => p.name.split(' ')[0]).join(' and ')
  return sound.length
    ? `Asks the ${singers.length} singers and ${tech} on sound. Six singers and a sound tech fill the lineup.`
    : `Asks the ${singers.length} singers. Nobody on Roster has the sound tech job yet, so the sound seat stays open.`
}

const voiceRank = (p: Person) => (p.voice ? voiceParts.indexOf(p.voice) : voiceParts.length)

export interface RosterRow {
  person: Person
  subs: Person[]
}

export interface RosterGroups {
  band: RosterRow[]
  sound: RosterRow[]
  unlinked: Person[]
  others: Person[]
  alumni: Person[]
}

export function rosterGroups(people: Person[]): RosterGroups {
  const byId = new Map(people.map((p) => [p.id, p]))
  const byName = (a: Person, b: Person) => a.name.localeCompare(b.name)
  const subs = people.filter((p) => p.status === 'sub').sort(byName)
  const row = (person: Person): RosterRow => ({ person, subs: subs.filter((s) => s.covers.includes(person.id)) })
  const band = people
    .filter((p) => p.status === 'active' && seatOf(p, byId) === 'singer')
    .sort((a, b) => voiceRank(a) - voiceRank(b) || byName(a, b))
    .map(row)
  const sound = people
    .filter((p) => (p.status === 'active' || p.status === 'crew') && p.jobs.includes('sound'))
    .sort(byName)
    .map(row)
  const shown = new Set([...band, ...sound].map((r) => r.person.id))
  return {
    band,
    sound,
    unlinked: subs.filter((s) => !s.covers.some((id) => shown.has(id))),
    others: people.filter((p) => !shown.has(p.id) && p.status !== 'sub' && p.status !== 'alumni').sort(byName),
    alumni: people.filter((p) => p.status === 'alumni').sort(byName),
  }
}

export interface PlannedAccess {
  email: string
  name: string
  role: Role
  person: string
  isNew: boolean
}

export type ProtectedField = 'voice' | 'jobs' | 'covers'

export interface PlannedPerson {
  id: string
  record: PersonRecord & { voice: VoicePart | ''; jobs: Job[]; covers: string[] }
  review: string[]
  kept: ProtectedField[]
  current: Partial<PersonRecord> | null
}

export interface ImportPlan {
  people: PlannedPerson[]
  access: PlannedAccess[]
  skipped: string[]
}

export function personId(name: string) {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function workspaceEmail(name: string) {
  const first = personId(name.trim().split(/\s+/)[0] ?? '').replace(/-/g, '')
  return first ? `${first}@${WORKSPACE_DOMAIN}` : ''
}

export function toStatus(status: string): PersonStatus {
  const s = status.trim().toLowerCase()
  if (s === 'active') return 'active'
  if (s === 'sub') return 'sub'
  return 'alumni'
}

export interface ParsedRole {
  voice: VoicePart | ''
  jobs: Job[]
  crew: boolean
  coverNames: string[]
  review: string[]
}

const voiceWords: [RegExp, string][] = [
  [/\bbass\b/, 'bass'],
  [/\bbari(tone)?\b/, 'baritone'],
  [/\btenor\b/, 'tenor'],
  [/\balto\b/, 'alto'],
  [/beat\s*box|vocal perc|\bvp\b/, 'beatbox'],
]

/** Reads what it reliably can from a Notion Role; everything else lands in `review`. */
export function parseRole(role: string): ParsedRole {
  const text = role.toLowerCase().replace(/’/g, "'")
  const found: Job[] = []
  const review: string[] = []
  if (/sound\s*tech/.test(text)) found.push('sound')
  if (/bookkeep/.test(text)) found.push('bookkeeper')
  if (/music director/.test(text)) found.push('director')
  if (/schedul/.test(text)) found.push('scheduler')
  if (/wardrobe|outfit/.test(text)) found.push('wardrobe')
  if (/\bleader\b/.test(text)) review.push('Notion calls them band leader. That isn\'t copied: set the band leader on Roster.')
  const sings = /\bsing/.test(text)
  const crew = (found.includes('sound') || found.includes('bookkeeper')) && !sings

  const coverNames = [...text.matchAll(/([a-z][a-z.-]*)\s*'s\s+sub\b/g)].map((m) => m[1]!)
  if (/\b(but|should)\b/.test(text)) review.push(`Notion adds: "${role.trim()}". Check this on Roster.`)

  const kinds = voiceWords.filter(([re]) => re.test(text)).map(([, w]) => w)
  let voice: VoicePart | '' = ''
  if (kinds.length === 1 && kinds[0] === 'bass') voice = 'Bass'
  else if (kinds.length === 1 && kinds[0] === 'baritone') voice = 'Bari/VP'
  if (voice) review.push(`Voice part ${voice}, read from "${kinds[0]}".`)
  else if (kinds.length) review.push(`Notion says ${kinds.join(' / ')}; pick a voice part on Roster.`)
  else if (!crew && !found.includes('bookkeeper')) review.push('No voice part in Notion; pick one on Roster.')
  return { voice, jobs: found, crew, coverNames, review }
}

/** Matches a first name, or a nickname that starts one ("Jo" for Joseph), to exactly one person. */
export function matchName(token: string, people: { id: string; name: string }[]): { id: string; name: string; guessed: boolean } | null {
  const t = token.toLowerCase()
  const first = (n: string) => (n.trim().split(/\s+/)[0] ?? '').toLowerCase()
  const exact = people.filter((p) => first(p.name) === t || p.name.toLowerCase() === t)
  if (exact.length === 1) return { ...exact[0]!, guessed: false }
  if (exact.length > 1 || t.length < 2) return null
  const prefix = people.filter((p) => first(p.name).startsWith(t))
  return prefix.length === 1 ? { ...prefix[0]!, guessed: true } : null
}

const rank: Role[] = ['admin', 'manager', 'director', 'member']

export function strongestRole(existing: (Role | undefined)[]): Role {
  return rank.find((r) => existing.includes(r)) ?? 'member'
}

const MAX_FIELD_LENGTH = 120

function str(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, MAX_FIELD_LENGTH) : ''
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x))

function differs(field: ProtectedField, current: Partial<PersonRecord>, proposed: PlannedPerson['record']) {
  const now = current[field]
  if (field === 'voice') return !!now && now !== proposed.voice
  return Array.isArray(now) && now.length > 0 && !sameSet(now, proposed[field])
}

export function planImport(imported: unknown[], existingRoles: Record<string, Role>, existingPeople: Record<string, Partial<PersonRecord>> = {}): ImportPlan {
  const people: PlannedPerson[] = []
  const access: PlannedAccess[] = []
  const skipped: string[] = []
  const claimedEmails = new Set<string>()
  const claimedPeople = new Map<string, string>()
  const parsed = new Map<string, ParsedRole>()

  for (const entry of imported) {
    const raw = (entry ?? {}) as Record<string, unknown>
    const name = str(raw.name).trim()
    const id = personId(name)
    if (!id) {
      skipped.push('A row with no name')
      continue
    }
    const claimedName = claimedPeople.get(id)
    if (claimedName && claimedName !== name) {
      skipped.push(`${name} has the same id as ${claimedName} (both become "${id}"); rename one of them in Notion.`)
      continue
    }
    claimedPeople.set(id, name)
    const part = str(raw.part).trim()
    const role = parseRole(part)
    parsed.set(id, role)
    const notionStatus = toStatus(str(raw.status))
    const status: PersonStatus = notionStatus === 'active' && role.crew ? 'crew' : notionStatus
    const signsIn = status === 'active' || status === 'crew'
    const workspace = signsIn ? workspaceEmail(name) : ''
    if (workspace && claimedEmails.has(workspace)) skipped.push(`${workspace} already belongs to another person, so it isn't linked to ${name}`)
    const candidates = [str(raw.email), workspace]
      .map((e) => normalizeEmail(e))
      .filter((e) => e && !claimedEmails.has(e))
    const emails = [...new Set(candidates)]
    emails.forEach((e) => claimedEmails.add(e))
    const current = existingPeople[id] ?? null
    const review = [...role.review]
    if (status === 'crew') review.unshift(role.jobs.includes('sound') ? 'Crew on sound: asked about every gig, never to sing.' : 'Crew: never asked about gigs.')
    if (current?.status && current.status !== status) review.unshift(`Status changes from ${current.status} to ${status}.`)
    people.push({
      id,
      record: { name, status, part, phone: str(raw.phone).trim(), emails, voice: role.voice, jobs: role.jobs, covers: [] },
      review,
      kept: [],
      current,
    })
    if (!signsIn) continue
    const accessRole = strongestRole(emails.map((e) => existingRoles[e]))
    for (const email of emails) {
      access.push({ email, name, role: accessRole, person: id, isNew: !(email in existingRoles) })
    }
  }

  const known = new Map<string, string>()
  Object.entries(existingPeople).forEach(([id, p]) => p.name && known.set(id, p.name))
  people.forEach((p) => known.set(p.id, p.record.name))
  const directory = [...known].map(([id, name]) => ({ id, name }))

  for (const p of people) {
    const others = directory.filter((d) => d.id !== p.id)
    for (const token of parsed.get(p.id)?.coverNames ?? []) {
      const hit = matchName(token, others)
      if (!hit) {
        p.review.push(`Notion says "${token}'s sub", but no one on the roster matches; link them on Roster.`)
        continue
      }
      if (!p.record.covers.includes(hit.id)) p.record.covers.push(hit.id)
      p.review.push(hit.guessed ? `Covers ${hit.name} (read "${token}" as ${hit.name}).` : `Covers ${hit.name}.`)
    }
    if (!p.current) continue
    const c = p.current
    if (c.voice && !p.record.voice) p.record.voice = c.voice
    if (c.jobs?.length && !p.record.jobs.length) p.record.jobs = [...c.jobs]
    if (c.covers?.length && !p.record.covers.length) p.record.covers = [...c.covers]
    p.kept = (['voice', 'jobs', 'covers'] as const).filter((f) => differs(f, c, p.record))
  }

  return { people, access, skipped }
}

/** The people writes for an import; a field set in Backstage is kept unless its person is in `replace`. */
export function importWrites(plan: ImportPlan, replace: ReadonlySet<string> = new Set()) {
  return plan.people.map(({ id, record, kept }) => {
    const data: Partial<PersonRecord> = { ...record }
    if (!replace.has(id)) kept.forEach((f) => delete data[f])
    return { id, data }
  })
}
