import { normalizeEmail, type Role } from './access'

export const WORKSPACE_DOMAIN = '6minutewarning.com'

export type PersonStatus = 'active' | 'sub' | 'alumni'

export interface ImportedPerson {
  name: string
  status: string
  part: string
  email: string
  phone: string
}

export interface PersonRecord {
  name: string
  status: PersonStatus
  part: string
  phone: string
  emails: string[]
}

export interface PlannedAccess {
  email: string
  name: string
  role: Role
  person: string
  isNew: boolean
}

export interface ImportPlan {
  people: { id: string; record: PersonRecord }[]
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

const rank: Role[] = ['admin', 'manager', 'director', 'member']

export function strongestRole(existing: (Role | undefined)[]): Role {
  return rank.find((r) => existing.includes(r)) ?? 'member'
}

const MAX_FIELD_LENGTH = 120

function str(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, MAX_FIELD_LENGTH) : ''
}

export function planImport(imported: unknown[], existingRoles: Record<string, Role>): ImportPlan {
  const people: ImportPlan['people'] = []
  const access: PlannedAccess[] = []
  const skipped: string[] = []
  const claimedEmails = new Set<string>()
  const claimedPeople = new Map<string, string>()

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
    const status = toStatus(str(raw.status))
    const workspace = status === 'active' ? workspaceEmail(name) : ''
    if (workspace && claimedEmails.has(workspace)) skipped.push(`${workspace} already belongs to another person, so it isn't linked to ${name}`)
    const candidates = [str(raw.email), workspace]
      .map((e) => normalizeEmail(e))
      .filter((e) => e && !claimedEmails.has(e))
    const emails = [...new Set(candidates)]
    emails.forEach((e) => claimedEmails.add(e))
    people.push({ id, record: { name, status, part: str(raw.part).trim(), phone: str(raw.phone).trim(), emails } })
    if (status !== 'active') continue
    const role = strongestRole(emails.map((e) => existingRoles[e]))
    for (const email of emails) {
      access.push({ email, name, role, person: id, isNew: !(email in existingRoles) })
    }
  }

  return { people, access, skipped }
}
