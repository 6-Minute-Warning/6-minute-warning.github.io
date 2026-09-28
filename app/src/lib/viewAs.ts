import { duties, normalizeEmail, roleLabels, roles, type AccessRecord, type Duty, type Role } from './access'
import { strongestRole } from './people'

export const viewRoles: Role[] = ['member', 'director', 'manager', 'assistant']

export interface ViewAs {
  role: Role
  person?: string
  name?: string
  duties?: Duty[]
}

export function viewedAccess(real: AccessRecord | null, view: ViewAs | null): AccessRecord | null {
  if (!real || !view || real.role !== 'admin') return real
  return { name: view.name ?? real.name, role: view.role, person: view.person ?? '', duties: view.duties ?? [] }
}

export function viewLabel(view: ViewAs) {
  return view.name ? `${view.name} (${roleLabels[view.role]})` : roleLabels[view.role]
}

export function viewOfPerson(person: { id: string; name: string; emails: string[] }, users: { email: string; role: Role; person?: string; duties?: Duty[] }[]): ViewAs {
  const emails = person.emails.map(normalizeEmail)
  const theirs = users.filter((u) => u.person === person.id || emails.includes(u.email))
  const role = strongestRole(theirs.map((u) => u.role))
  return { role, person: person.id, name: person.name, duties: [...new Set(theirs.flatMap((u) => u.duties ?? []))] }
}

export function parseView(raw: string | null): ViewAs | null {
  try {
    const v = raw ? JSON.parse(raw) : null
    if (!v || !roles.includes(v.role)) return null
    return { role: v.role, person: v.person, name: v.name, duties: Array.isArray(v.duties) ? v.duties.filter((d: Duty) => duties.includes(d)) : [] }
  } catch {
    return null
  }
}
