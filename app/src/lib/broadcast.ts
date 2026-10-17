import { auth } from './firebase'

export const BROADCAST_ENDPOINT =
  'https://script.google.com/macros/s/AKfycbzv_4h3kI99BOP2LL5Vz4u_ReWdkLpexJr4hpf2OZHKo12DC4fM0v9E3hHJOxaG-KGL1A/exec'
export const BROADCAST_LIMITS = { title: 60, body: 500 } as const

export interface BroadcastResult {
  sent: number
  devices: number
}

export function broadcastReport(result: BroadcastResult) {
  if (!result.devices) return 'Sent, but no phones have notifications turned on yet.'
  return `Sent to ${result.sent} of ${result.devices} ${result.devices === 1 ? 'phone' : 'phones'}.`
}

export async function sendBroadcast(title: string, body: string): Promise<BroadcastResult> {
  const idToken = await auth.currentUser?.getIdToken()
  if (!idToken) throw new Error('Sign in again, then retry.')
  const res = await fetch(BROADCAST_ENDPOINT, { method: 'POST', body: new URLSearchParams({ action: 'broadcast', idToken, title, body }) })
  const data = (await res.json()) as { ok: boolean; error?: string } & BroadcastResult
  if (!data.ok) throw new Error(data.error || 'The broadcast could not be sent. Try again.')
  return data
}
