import { randomBytes } from 'node:crypto'
import { Timestamp, type Firestore, type Query } from 'firebase-admin/firestore'
import { fromJson, merge, same, stamp, toJson, type Data } from './codec'
import {
  ASSISTANT_NAME, AUDIT, COLLECTION_PATH, DAY, DOC_PATH, EVENTS, LIMITS, QUERY_OPS, READ_ACTIONS, WRITE_ACTIONS, type WriteOp,
} from './constants'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

export interface Change {
  op: WriteOp
  path: string
  data?: Data
  now?: string[]
}

const bad = (message: string): never => {
  throw new ApiError(400, message)
}

const isObject = (v: unknown): v is Data => !!v && typeof v === 'object' && !Array.isArray(v)

function docPath(path: unknown): string {
  if (typeof path !== 'string' || !DOC_PATH.test(path)) return bad(`"${String(path)}" is not a document the assistant can use. Try gigs/<id> or gigs/<id>/answers/<person>.`)
  return path
}

function collectionPath(path: unknown): string {
  if (typeof path !== 'string' || !COLLECTION_PATH.test(path)) return bad(`"${String(path)}" is not a collection the assistant can use.`)
  return path
}

const isDay = (v: unknown) => typeof v === 'string' && DAY.test(v)

/** Refuses documents the app could not open; the rest of each collection's shape is the caller's. */
export function validate(path: string, data: Data): void {
  const [collection, , sub] = path.split('/')
  if (sub) return
  if (collection === 'gigs') {
    if (typeof data.name !== 'string' || !data.name.trim() || data.name.length > 120) bad(`${path}: name is required, up to 120 characters.`)
    if (!isDay(data.date)) bad(`${path}: date must be YYYY-MM-DD.`)
  }
  if (collection === 'tours') {
    if (typeof data.name !== 'string' || !data.name.trim() || data.name.length > 120) bad(`${path}: name is required, up to 120 characters.`)
    if (!isDay(data.start) || !isDay(data.end) || (data.start as string) > (data.end as string)) bad(`${path}: start and end must be YYYY-MM-DD, start first.`)
    if (!Array.isArray(data.days)) bad(`${path}: days must be a list.`)
  }
}

function readChanges(body: Data): Change[] {
  const action = body.action as string
  if (action === 'commit') {
    if (!Array.isArray(body.changes) || !body.changes.length) return bad('commit needs a non-empty "changes" list.')
    if (body.changes.length > LIMITS.changes) return bad(`commit takes at most ${LIMITS.changes} changes.`)
    return body.changes.map((c, i) => readChange(c, i))
  }
  return [readChange({ ...body, op: action }, 0)]
}

function readChange(raw: unknown, index: number): Change {
  if (!isObject(raw)) return bad(`changes[${index}] must be an object.`)
  const op = raw.op as WriteOp
  if (!['set', 'update', 'delete'].includes(op)) bad(`changes[${index}].op must be set, update or delete.`)
  const path = docPath(raw.path)
  let data: Data | undefined
  if (op !== 'delete') {
    if (!isObject(raw.data)) bad(`${path}: "data" must be a JSON object.`)
    data = fromJson(raw.data) as Data
  }
  const now = raw.now === undefined ? [] : raw.now
  if (!Array.isArray(now) || now.some((n) => typeof n !== 'string' || !n)) bad(`${path}: "now" must be a list of field names.`)
  return { op, path, data, now: now as string[] }
}

function readReason(body: Data): string {
  const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
  if (!reason) bad('Say why with "reason". It goes in the audit record managers read.')
  if (reason.length > LIMITS.reason) bad(`"reason" is longer than ${LIMITS.reason} characters.`)
  return reason
}

async function commit(db: Firestore, changes: Change[], reason: string, nowTs: Timestamp, dryRun: boolean) {
  const paths = changes.map((c) => c.path)
  if (new Set(paths).size !== paths.length) bad('The same document appears twice in one commit.')
  const refs = paths.map((p) => db.doc(p))
  return db.runTransaction(async (tx) => {
    const before = (await tx.getAll(...refs)).map((s) => (s.exists ? (s.data() as Data) : null))
    const plan = changes.map((c, i) => {
      const was = before[i]
      let after: Data | null
      if (c.op === 'delete') {
        if (!was) throw new ApiError(404, `No document at ${c.path}.`)
        after = null
      } else if (c.op === 'update') {
        if (!was) throw new ApiError(404, `No document at ${c.path}. Use set to create it.`)
        after = stamp(merge(was, c.data!), c.now ?? [], nowTs)
      } else after = stamp(c.data!, c.now ?? [], nowTs)
      if (after) validate(c.path, after)
      if (c.path.startsWith(`${EVENTS}/`) && was) throw new ApiError(409, `${c.path}: log entries are never changed or removed.`)
      return { c, was, after }
    })
    if (dryRun) return { dryRun: true, changes: plan.map(({ c, was, after }) => ({ path: c.path, before: toJson(was), after: toJson(after), unchanged: same(was, after) })) }
    const audit: Record<string, string> = {}
    for (const { c, was, after } of plan) {
      if (same(was, after)) continue
      const id = randomBytes(10).toString('hex')
      audit[c.path] = id
      if (after) tx.set(db.doc(c.path), after)
      else tx.delete(db.doc(c.path))
      tx.create(db.collection(AUDIT).doc(id), { path: c.path, before: was, after, by: ASSISTANT_NAME, at: nowTs, reason })
    }
    return { audit, docs: Object.fromEntries(plan.map(({ c, after }) => [c.path, toJson(after)])) }
  })
}

function applyQuery(db: Firestore, body: Data): Query {
  let q: Query = db.collection(collectionPath(body.collection))
  const where = body.where === undefined ? [] : body.where
  if (!Array.isArray(where)) bad('"where" must be a list of {field, op, value}.')
  for (const w of where as unknown[]) {
    if (!isObject(w) || typeof w.field !== 'string' || !(w.op as string in QUERY_OPS)) return bad(`Each "where" needs field, value and an op of ${Object.keys(QUERY_OPS).join(', ')}.`)
    q = q.where(w.field, QUERY_OPS[w.op as keyof typeof QUERY_OPS], fromJson(w.value))
  }
  const order = body.orderBy === undefined ? [] : body.orderBy
  if (!Array.isArray(order)) bad('"orderBy" must be a list of {field, desc?}.')
  for (const o of order as unknown[]) {
    if (!isObject(o) || typeof o.field !== 'string') return bad('Each "orderBy" needs a field.')
    q = q.orderBy(o.field, o.desc === true ? 'desc' : 'asc')
  }
  const limit = body.limit === undefined ? LIMITS.query : Number(body.limit)
  if (!Number.isInteger(limit) || limit < 1 || limit > LIMITS.list) bad(`"limit" must be 1 to ${LIMITS.list}.`)
  return q.limit(limit)
}

const row = (id: string, path: string, data: Data) => ({ id, path, ...(toJson(data) as Data) })

export async function handle(db: Firestore, body: unknown, now: Timestamp = Timestamp.now()): Promise<unknown> {
  if (!isObject(body)) return bad('Send a JSON object with an "action".')
  const action = body.action
  const known = [...READ_ACTIONS, ...WRITE_ACTIONS] as readonly unknown[]
  if (!known.includes(action)) return bad(`"action" must be one of ${known.join(', ')}.`)

  if (action === 'get') {
    const path = docPath(body.path)
    const snap = await db.doc(path).get()
    if (!snap.exists) throw new ApiError(404, `No document at ${path}.`)
    return { doc: row(snap.id, path, snap.data() as Data) }
  }
  if (action === 'list' || action === 'query') {
    const snap = await (action === 'list' ? db.collection(collectionPath(body.collection)).limit(LIMITS.list) : applyQuery(db, body)).get()
    return { docs: snap.docs.map((d) => row(d.id, d.ref.path, d.data() as Data)) }
  }
  return commit(db, readChanges(body), readReason(body), now, body.dryRun === true)
}
