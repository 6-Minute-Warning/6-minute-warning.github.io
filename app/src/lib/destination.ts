export function destination(status: string, isAdmin: boolean, access: string | undefined): string | null {
  if (status === 'signed-out' || status === 'error') return access === 'guest' ? null : 'sign-in'
  if (status === 'no-access') return access === 'no-access' ? null : 'no-access'
  if (access === 'guest' || access === 'no-access') return 'home'
  if (access === 'admin' && !isAdmin) return 'home'
  return null
}
