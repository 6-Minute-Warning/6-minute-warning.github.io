import { randomBytes } from 'node:crypto'

const API_KEY = 'AIzaSyDit_axJ1UnfGOkZmrZuNddBfRXPwuqIgY'
const PROJECT = 'six-minute-warning'
export const APP_URL = 'https://six-minute-warning.web.app'

const authEmulator = process.env.FIREBASE_AUTH_EMULATOR_HOST
const firestoreEmulator = process.env.FIRESTORE_EMULATOR_HOST
const authBase = authEmulator ? `http://${authEmulator}/identitytoolkit.googleapis.com/v1` : 'https://identitytoolkit.googleapis.com/v1'
export const root = `projects/${PROJECT}/databases/(default)/documents`
const firestoreBase = `${firestoreEmulator ? `http://${firestoreEmulator}` : 'https://firestore.googleapis.com'}/v1`

export type Value = Record<string, unknown>
export type Fields = Record<string, Value>
export interface RawDoc {
  path: string
  fields: Fields
  updateTime: string
}

/** One document write; `after: null` deletes, `stamps` are field paths set to the commit time. */
export interface Change {
  path: string
  before: RawDoc | null
  after: Fields | null
  stamps?: string[]
}

export function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

export function encode(value: unknown): Value {
  if (value === null || value === undefined) return { nullValue: null }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value }
  if (typeof value === 'string') return { stringValue: value }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } }
  const map = value as Record<string, unknown>
  if (Object.keys(map).length === 1 && typeof map.$time === 'string') return { timestampValue: new Date(map.$time).toISOString() }
  return { mapValue: { fields: encodeFields(map) } }
}

export function encodeFields(data: Record<string, unknown>): Fields {
  return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, encode(v)]))
}

export function decode(value: Value): unknown {
  if ('mapValue' in value) return decodeFields(((value.mapValue as { fields?: Fields }).fields) ?? {})
  if ('arrayValue' in value) return (((value.arrayValue as { values?: Value[] }).values) ?? []).map(decode)
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return Number(value.doubleValue)
  if ('nullValue' in value) return null
  return Object.values(value)[0]
}

export function decodeFields(fields: Fields): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, decode(v)]))
}

async function call(url: string, init: RequestInit & { token?: string } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (init.token) headers.Authorization = `Bearer ${init.token}`
  const res = await fetch(url, { ...init, headers })
  const body = (await res.json().catch(() => ({}))) as { error?: { message?: string; status?: string } } & Record<string, unknown>
  if (!res.ok) throw Object.assign(new Error((body.error?.message ?? `${res.status} from ${url}`).replace(/\s+/g, ' ').trim()), { status: body.error?.status ?? '', code: res.status })
  return body
}

export async function account(path: string, payload: Record<string, unknown>) {
  return call(`${authBase}/accounts:${path}?key=${API_KEY}`, { method: 'POST', body: JSON.stringify(payload) })
}

export function credentials() {
  const email = process.env.BACKSTAGE_EMAIL?.trim().toLowerCase()
  const password = process.env.BACKSTAGE_PASSWORD
  if (!email || !password) fail('Set BACKSTAGE_EMAIL and BACKSTAGE_PASSWORD.')
  return { email, password }
}

export async function signIn(email: string, password: string) {
  const res = await account('signInWithPassword', { email, password, returnSecureToken: true }).catch((e: Error & { status?: string }) =>
    fail(e.status ? `Sign-in failed for ${email}: ${e.message}. Check BACKSTAGE_EMAIL and BACKSTAGE_PASSWORD.` : `Could not reach Firebase: ${e.message}`),
  )
  return res.idToken as string
}

function toDoc(d: { name: string; fields?: Fields; updateTime: string }): RawDoc {
  return { path: d.name.slice(root.length + 1), fields: d.fields ?? {}, updateTime: d.updateTime }
}

export async function getRaw(path: string, token: string): Promise<RawDoc | null> {
  try {
    return toDoc((await call(`${firestoreBase}/${root}/${path}`, { token })) as { name: string; fields?: Fields; updateTime: string })
  } catch (e) {
    if ((e as { code?: number }).code === 404) return null
    throw e
  }
}

export async function listRaw(collection: string, token: string) {
  const rows: RawDoc[] = []
  let pageToken = ''
  do {
    const res = await call(`${firestoreBase}/${root}/${collection}?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`, { token })
    rows.push(...((res.documents as { name: string; fields?: Fields; updateTime: string }[]) ?? []).map(toDoc))
    pageToken = (res.nextPageToken as string) ?? ''
  } while (pageToken)
  return rows
}

export async function list(collection: string, token: string) {
  return (await listRaw(collection, token)).map((d) => ({ id: d.path.split('/').pop(), ...decodeFields(d.fields) }))
}

export async function query(collection: string, structured: Record<string, unknown>, token: string) {
  const parts = collection.split('/')
  const parent = [root, ...parts.slice(0, -1)].join('/')
  const res = (await call(`${firestoreBase}/${parent}:runQuery`, {
    method: 'POST',
    token,
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: parts.at(-1) }], ...structured } }),
  })) as unknown as { document?: { name: string; fields?: Fields; updateTime: string } }[]
  return res.filter((r) => r.document).map((r) => toDoc(r.document!))
}

function fieldPath(path: string) {
  return path
    .split('.')
    .map((s) => (/^[A-Za-z_][A-Za-z_0-9]*$/.test(s) ? s : `\`${s.replace(/[`\\]/g, '\\$&')}\``))
    .join('.')
}

const now = (path: string) => ({ fieldPath: fieldPath(path), setToServerValue: 'REQUEST_TIME' })

/** Commits the changes with one audit record each, as the rules require of the assistant. */
export async function commitAudited(changes: Change[], reason: string, email: string, token: string) {
  const writes: Record<string, unknown>[] = []
  const paths: Fields = {}
  const ids: Record<string, string> = {}
  for (const c of changes) {
    const id = randomBytes(10).toString('hex')
    ids[c.path] = id
    paths[c.path] = { stringValue: id }
    const stamps = c.after ? (c.stamps ?? []) : []
    if (c.after) {
      writes.push({
        update: { name: `${root}/${c.path}`, fields: c.after },
        currentDocument: c.before ? { updateTime: c.before.updateTime } : { exists: false },
        ...(stamps.length ? { updateTransforms: stamps.map(now) } : {}),
      })
    } else {
      writes.push({ delete: `${root}/${c.path}`, currentDocument: c.before ? { updateTime: c.before.updateTime } : { exists: true } })
    }
    const record: Fields = {
      path: { stringValue: c.path },
      before: c.before ? { mapValue: { fields: c.before.fields } } : { nullValue: null },
      after: c.after ? { mapValue: { fields: c.after } } : { nullValue: null },
      by: { stringValue: email },
      reason: { stringValue: reason },
    }
    writes.push({ update: { name: `${root}/audit/${id}`, fields: record }, currentDocument: { exists: false }, updateTransforms: [now('at'), ...stamps.map((s) => now(`after.${s}`))] })
  }
  writes.push({ update: { name: `${root}/auditHead/${email}`, fields: { paths: { mapValue: { fields: paths } } } }, updateTransforms: [now('at')] })
  await call(`${firestoreBase}/${root}:commit`, { method: 'POST', token, body: JSON.stringify({ writes }) })
  return ids
}

export function explain(e: Error & { status?: string }): never {
  if (e.status === 'ALREADY_EXISTS' || e.status === 'FAILED_PRECONDITION' || e.status === 'NOT_FOUND') fail(`The document changed or appeared since it was read. Read it again and retry. (${e.message})`)
  fail(e.status === 'PERMISSION_DENIED' ? `Refused by the Firestore rules: ${e.message}` : `Firestore failed: ${e.status || e.message}`)
}
