export function destination(status: string, isAdmin: boolean, access: string | undefined, isManager = isAdmin): string | null {
  if (access === 'public') return null
  if (status === 'signed-out' || status === 'error') return access === 'guest' ? null : 'sign-in'
  if (status === 'no-access') return access === 'no-access' ? null : 'no-access'
  if (access === 'guest' || access === 'no-access') return 'home'
  if (access === 'admin' && !isAdmin) return 'home'
  if (access === 'manager' && !isManager) return 'home'
  return null
}
