import { normalizeEmail, roleLabels, roles, type AccessRecord, type Role } from './access'
import { strongestRole } from './people'

export const viewRoles: Role[] = ['member', 'director', 'manager']

export interface ViewAs {
  role: Role
  person?: string
  name?: string
}

export function viewedAccess(real: AccessRecord | null, view: ViewAs | null): AccessRecord | null {
  if (!real || !view || real.role !== 'admin') return real
  return { name: view.name ?? real.name, role: view.role, person: view.person ?? '' }
}

export function viewLabel(view: ViewAs) {
  return view.name ? `${view.name} (${roleLabels[view.role]})` : roleLabels[view.role]
}

export function viewOfPerson(person: { id: string; name: string; emails: string[] }, users: { email: string; role: Role; person?: string }[]): ViewAs {
  const emails = person.emails.map(normalizeEmail)
  const role = strongestRole(users.filter((u) => u.person === person.id || emails.includes(u.email)).map((u) => u.role))
  return { role, person: person.id, name: person.name }
}

export function parseView(raw: string | null): ViewAs | null {
  try {
    const v = raw ? JSON.parse(raw) : null
    return v && roles.includes(v.role) ? { role: v.role, person: v.person, name: v.name } : null
  } catch {
    return null
  }
}
