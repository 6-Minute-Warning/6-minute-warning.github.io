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

export function planImport(imported: ImportedPerson[], existingRoles: Record<string, Role>): ImportPlan {
  const people: ImportPlan['people'] = []
  const access: PlannedAccess[] = []
  const skipped: string[] = []
  const claimed = new Set<string>()

  for (const p of imported) {
    const name = p.name.trim()
    const id = personId(name)
    if (!id) {
      skipped.push('A row with no name')
      continue
    }
    const status = toStatus(p.status)
    const workspace = status === 'active' ? workspaceEmail(name) : ''
    if (workspace && claimed.has(workspace)) skipped.push(`${workspace} already belongs to another person, so it isn't linked to ${name}`)
    const candidates = [p.email, workspace]
      .map((e) => normalizeEmail(e))
      .filter((e) => e && !claimed.has(e))
    const emails = [...new Set(candidates)]
    emails.forEach((e) => claimed.add(e))
    people.push({ id, record: { name, status, part: p.part.trim(), phone: p.phone.trim(), emails } })
    if (status !== 'active') continue
    const role = strongestRole(emails.map((e) => existingRoles[e]))
    for (const email of emails) {
      access.push({ email, name, role, person: id, isNew: !(email in existingRoles) })
    }
  }

  return { people, access, skipped }
}
