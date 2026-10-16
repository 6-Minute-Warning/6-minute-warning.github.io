import { getFunctions, httpsCallable } from 'firebase/functions'
import { app } from './firebase'

export const BROADCAST_LIMITS = { title: 60, body: 500 } as const

export interface BroadcastResult {
  sent: number
  devices: number
}

export function broadcastReport(result: BroadcastResult) {
  if (!result.devices) return 'Sent, but no phones have notifications turned on yet.'
  return `Sent to ${result.sent} of ${result.devices} ${result.devices === 1 ? 'phone' : 'phones'}.`
}

export async function sendBroadcast(title: string, body: string) {
  const call = httpsCallable<{ title: string; body: string }, BroadcastResult>(getFunctions(app, 'northamerica-northeast1'), 'broadcast')
  return (await call({ title, body })).data
}
