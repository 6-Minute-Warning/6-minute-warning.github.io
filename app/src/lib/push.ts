import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { app, db } from './firebase'

export const pushTopics = ['inquiries'] as const
export type PushTopic = (typeof pushTopics)[number]

export type PushState = 'unsupported' | 'install-first' | 'default' | 'granted' | 'denied'

export interface PushToken {
  token: string
  email: string
  topics: PushTopic[]
  device: string
}

export function isIos(ua: string) {
  return /iPhone|iPad|iPod/.test(ua)
}

export function pushState(env: { ua: string; standalone: boolean; hasPush: boolean; permission?: NotificationPermission }): PushState {
  if (!env.hasPush) return isIos(env.ua) && !env.standalone ? 'install-first' : 'unsupported'
  return env.permission ?? 'default'
}

export function currentPushState(): PushState {
  return pushState({
    ua: navigator.userAgent,
    standalone: matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true,
    hasPush: 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window,
    permission: 'Notification' in window ? Notification.permission : undefined,
  })
}

export function deviceName(ua: string) {
  const os = /Android/.test(ua) ? 'Android' : isIos(ua) ? 'iPhone' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Linux'
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'browser'
  return `${browser} on ${os}`
}

export async function tokenId(token: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function messagingToken() {
  const { getMessaging, getToken, isSupported } = await import('firebase/messaging')
  if (!(await isSupported())) throw new Error("This browser can't get notifications.")
  const registration = await navigator.serviceWorker.register('/sw.js')
  return getToken(getMessaging(app), { serviceWorkerRegistration: registration })
}

/** Asks for permission if needed and saves this device's token for the given topics. */
export async function subscribe(email: string, topics: PushTopic[]) {
  if ((await Notification.requestPermission()) !== 'granted') return false
  const token = await messagingToken()
  const record: PushToken = { token, email, topics, device: deviceName(navigator.userAgent) }
  await setDoc(doc(db, 'pushTokens', await tokenId(token)), { ...record, updatedAt: serverTimestamp() })
  return true
}

export async function unsubscribe() {
  const { deleteToken, getMessaging } = await import('firebase/messaging')
  const token = await messagingToken()
  await deleteDoc(doc(db, 'pushTokens', await tokenId(token))).catch(() => undefined)
  await deleteToken(getMessaging(app))
}

/** Stops this device getting the signed-in person's notifications; safe to call when none were set up. */
export async function forgetDevice() {
  if (currentPushState() !== 'granted') return
  await unsubscribe().catch(() => undefined)
}
