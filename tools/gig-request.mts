import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { planRequest, readRequest, type Directory } from '../app/src/lib/request.ts'

const API_KEY = 'AIzaSyDit_axJ1UnfGOkZmrZuNddBfRXPwuqIgY'
const PROJECT = 'six-minute-warning'
const APP_URL = 'https://six-minute-warning.web.app'

const authEmulator = process.env.FIREBASE_AUTH_EMULATOR_HOST
const firestoreEmulator = process.env.FIRESTORE_EMULATOR_HOST
const authBase = authEmulator ? `http://${authEmulator}/identitytoolkit.googleapis.com/v1` : 'https://identitytoolkit.googleapis.com/v1'
const root = `projects/${PROJECT}/databases/(default)/documents`
const firestoreBase = `${firestoreEmulator ? `http://${firestoreEmulator}` : 'https://firestore.googleapis.com'}/v1/${root}`

type Value = Record<string, unknown>

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

function encode(value: unknown): Value {
  if (value === null || value === undefined) return { nullValue: null }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value }
  if (typeof value === 'string') return { stringValue: value }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } }
  return { mapValue: { fields: encodeFields(value as Record<string, unknown>) } }
}

function encodeFields(data: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, encode(v)]))
}

function decode(value: Value): unknown {
  if ('mapValue' in value) return decodeFields(((value.mapValue as { fields?: Record<string, Value> }).fields) ?? {})
  if ('arrayValue' in value) return (((value.arrayValue as { values?: Value[] }).values) ?? []).map(decode)
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return Number(value.doubleValue)
  if ('nullValue' in value) return null
  return Object.values(value)[0]
}

function decodeFields(fields: Record<string, Value>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, decode(v)]))
}

async function call(url: string, init: RequestInit & { token?: string } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (init.token) headers.Authorization = `Bearer ${init.token}`
  const res = await fetch(url, { ...init, headers })
  const body = (await res.json().catch(() => ({}))) as { error?: { message?: string; status?: string } } & Record<string, unknown>
  if (!res.ok) throw Object.assign(new Error((body.error?.message ?? `${res.status} from ${url}`).replace(/\s+/g, ' ').trim()), { status: body.error?.status ?? '' })
  return body
}

async function account(path: string, payload: Record<string, unknown>) {
  return call(`${authBase}/accounts:${path}?key=${API_KEY}`, { method: 'POST', body: JSON.stringify(payload) })
}

async function signIn(email: string, password: string) {
  const res = await account('signInWithPassword', { email, password, returnSecureToken: true }).catch((e: Error & { status?: string }) =>
    fail(e.status ? `Sign-in failed for ${email}: ${e.message}. Check BACKSTAGE_EMAIL and BACKSTAGE_PASSWORD.` : `Could not reach Firebase: ${e.message}`),
  )
  return res.idToken as string
}

async function list(collection: string, token: string) {
  const rows: Record<string, unknown>[] = []
  let pageToken = ''
  do {
    const res = await call(`${firestoreBase}/${collection}?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`, { token })
    for (const d of (res.documents as { name: string; fields?: Record<string, Value> }[]) ?? []) {
      rows.push({ id: d.name.split('/').pop(), ...decodeFields(d.fields ?? {}) })
    }
    pageToken = (res.nextPageToken as string) ?? ''
  } while (pageToken)
  return rows
}

async function setup(email: string, password: string) {
  const res = await account('signUp', { email, password, returnSecureToken: true }).catch(async (e: Error) => {
    if (!e.message.startsWith('EMAIL_EXISTS')) fail(`Could not create ${email}: ${e.message}. Is Email/Password sign-in turned on in Firebase?`)
    return account('signInWithPassword', { email, password, returnSecureToken: true })
  })
  const info = await account('lookup', { idToken: res.idToken })
  if ((info.users as { emailVerified?: boolean }[])?.[0]?.emailVerified) {
    console.log(`${email} is verified. Add it on Backstage's Access page with the Assistant role.`)
    return
  }
  await account('sendOobCode', { requestType: 'VERIFY_EMAIL', idToken: res.idToken })
  console.log(`Sent a verification link to ${email}. Open it, then add ${email} on Backstage's Access page with the Assistant role.`)
}

async function main() {
  const args = process.argv.slice(2)
  const email = process.env.BACKSTAGE_EMAIL?.trim().toLowerCase()
  const password = process.env.BACKSTAGE_PASSWORD
  if (!email || !password) fail('Set BACKSTAGE_EMAIL and BACKSTAGE_PASSWORD.')
  if (args[0] === '--setup') return setup(email, password)

  const dryRun = args.includes('--dry-run')
  const file = args.find((a) => !a.startsWith('--'))
  if (!file) fail('Usage: node tools/gig-request.mts [--dry-run] <request.json | ->   or   node tools/gig-request.mts --setup')
  let input: unknown
  try {
    input = JSON.parse(readFileSync(file === '-' ? 0 : file, 'utf8'))
  } catch (e) {
    fail(`Could not read the request: ${e instanceof Error ? e.message : String(e)}`)
  }
  const { request, errors } = readRequest(input)
  if (!request) fail(`The request was not sent:\n- ${errors.join('\n- ')}`)

  const token = await signIn(email, password)
  const [gigs, venues, presenters, people] = await Promise.all([list('gigs', token), list('venues', token), list('presenters', token), list('people', token)]).catch((e: Error) =>
    fail(`Could not read Backstage as ${email}: ${e.message}. ${email} needs the Assistant role on the Access page and a verified address.`),
  )
  const directory = { gigs, venues, presenters, people } as unknown as Directory
  const plan = planRequest(request, directory, email, Date.now())
  const existing = gigs.some((g) => g.id === plan.id)
  const result = { id: plan.id, url: `${APP_URL}/gigs/${plan.id}`, newVenue: plan.newVenue, newPresenter: plan.newPresenter, asked: plan.asked, gig: plan.gig }
  if (existing) fail(`A gig called ${request.name} on ${plan.gig.date} already exists: ${result.url}`)
  if (dryRun) {
    console.log(JSON.stringify({ dryRun: true, ...result }, null, 2))
    return
  }

  const create = (path: string, data: Record<string, unknown>, stamp: string) => ({
    update: { name: `${root}/${path}`, fields: encodeFields(data) },
    currentDocument: { exists: false },
    ...(stamp ? { updateTransforms: [{ fieldPath: stamp, setToServerValue: 'REQUEST_TIME' }] } : {}),
  })
  const writes = [
    ...plan.writes.map((w) => create(w.path, w.data, w.stamped ? 'createdAt' : '')),
    ...plan.events.map((e) => create(`events/${randomBytes(10).toString('hex')}`, { gig: plan.id, ...e, by: email }, 'at')),
  ]
  await call(`${firestoreBase}:commit`, { method: 'POST', token, body: JSON.stringify({ writes }) }).catch((e: Error & { status?: string }) => {
    if (e.status === 'ALREADY_EXISTS' || e.status === 'FAILED_PRECONDITION') fail(`Someone added this gig, or the same venue or presenter, a moment ago. Send the request again. (${e.message})`)
    fail(e.status === 'PERMISSION_DENIED' ? `Refused by the Firestore rules: ${e.message}` : `Firestore failed: ${e.status || e.message}`)
  })
  console.log(JSON.stringify(result, null, 2))
}

await main().catch((e: unknown) => fail(e instanceof Error ? e.message : String(e)))
