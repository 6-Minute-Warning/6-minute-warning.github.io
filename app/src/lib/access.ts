export const OWNER_EMAIL = 'brett@6minutewarning.com'

export const roles = ['admin', 'manager', 'director', 'member'] as const
export type Role = (typeof roles)[number]

export const roleLabels: Record<Role, string> = {
  admin: 'Admin',
  manager: 'Manager',
  director: 'Music director',
  member: 'Singer',
}

export interface AccessRecord {
  name: string
  role: Role
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}
