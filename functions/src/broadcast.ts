import type { Firestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import { BROADCAST_LIMITS, BROADCAST_TITLE, BROADCAST_TOPIC, MANAGER_ROLES, OWNER_EMAIL, PUSH_TOKENS } from './constants'

export class BroadcastError extends Error {
  constructor(readonly code: 'permission-denied' | 'invalid-argument', message: string) {
    super(message)
  }
}

export interface Message {
  title: string
  body: string
}

export function parseMessage(input: unknown): Message {
  const raw = (input ?? {}) as { title?: unknown; body?: unknown }
  const title = typeof raw.title === 'string' ? raw.title.trim() : ''
  const body = typeof raw.body === 'string' ? raw.body.trim() : ''
  if (!body) throw new BroadcastError('invalid-argument', 'Write a message to send.')
  if (body.length > BROADCAST_LIMITS.body) throw new BroadcastError('invalid-argument', `Keep the message under ${BROADCAST_LIMITS.body} characters.`)
  if (title.length > BROADCAST_LIMITS.title) throw new BroadcastError('invalid-argument', `Keep the title under ${BROADCAST_LIMITS.title} characters.`)
  return { title: title || BROADCAST_TITLE, body }
}

export async function requireManager(db: Firestore, email: string | undefined) {
  const key = email?.toLowerCase()
  if (!key) throw new BroadcastError('permission-denied', 'Sign in first.')
  if (key === OWNER_EMAIL) return
  const role = (await db.doc(`users/${key}`).get()).get('role')
  if (!(MANAGER_ROLES as readonly string[]).includes(role)) throw new BroadcastError('permission-denied', 'Only managers can send a broadcast.')
}

export async function send(db: Firestore, message: Message) {
  const rows = (await db.collection(PUSH_TOKENS).where('topics', 'array-contains', BROADCAST_TOPIC).get()).docs
  if (!rows.length) return { sent: 0, devices: 0 }
  const data = { title: message.title, body: message.body, link: '/', tag: `broadcast-${Date.now()}` }
  const result = await getMessaging().sendEachForMulticast({
    tokens: rows.map((r) => r.get('token') as string),
    data,
    webpush: { headers: { Urgency: 'high', TTL: '86400' } },
  })
  const dead = rows.filter((_, i) => result.responses[i]?.error?.code === 'messaging/registration-token-not-registered')
  await Promise.all(dead.map((r) => r.ref.delete()))
  return { sent: result.successCount, devices: rows.length }
}
