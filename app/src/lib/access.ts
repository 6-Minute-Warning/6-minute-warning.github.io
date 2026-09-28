export const OWNER_EMAIL = 'brett@6minutewarning.com'

export const roles = ['admin', 'manager', 'director', 'member', 'assistant'] as const
export type Role = (typeof roles)[number]

export const roleLabels: Record<Role, string> = {
  admin: 'Admin',
  manager: 'Manager',
  director: 'Music director',
  member: 'Singer',
  assistant: 'Assistant',
}

export const duties = ['scheduler'] as const
export type Duty = (typeof duties)[number]

export const dutyLabels: Record<Duty, string> = {
  scheduler: 'Books rehearsals',
}

export interface AccessRecord {
  name: string
  role: Role
  person?: string
  duties?: Duty[]
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}
