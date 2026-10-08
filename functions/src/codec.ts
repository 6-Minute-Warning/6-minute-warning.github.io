import { Timestamp } from 'firebase-admin/firestore'
import { DELETE_KEY, TIME_KEY } from './constants'

export type Data = Record<string, unknown>

function clone<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clone) as T
  if (isPlain(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clone(v)])) as T
  return value
}

const isPlain = (v: unknown): v is Data => !!v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Timestamp)

/** Firestore data to JSON, with timestamps as `{"$time": iso}`. */
export function toJson(value: unknown): unknown {
  if (value instanceof Timestamp) return { [TIME_KEY]: value.toDate().toISOString() }
  if (Array.isArray(value)) return value.map(toJson)
  if (isPlain(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toJson(v)]))
  return value
}

/** JSON from a caller to Firestore data; `{"$time": iso}` becomes a timestamp. */
export function fromJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(fromJson)
  if (isPlain(value)) {
    const keys = Object.keys(value)
    if (keys.length === 1 && keys[0] === TIME_KEY) {
      const d = new Date(String(value[TIME_KEY]))
      if (Number.isNaN(d.getTime())) throw new Error(`Bad ${TIME_KEY} value ${JSON.stringify(value[TIME_KEY])}`)
      return Timestamp.fromDate(d)
    }
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fromJson(v)]))
  }
  return value
}

function walk(root: Data, key: string): [Data, string] {
  const parts = key.split('.')
  let at = root
  for (const part of parts.slice(0, -1)) {
    if (!isPlain(at[part])) at[part] = {}
    at = at[part] as Data
  }
  return [at, parts[parts.length - 1]]
}

/** Applies top-level or dotted keys to a copy of `doc`; `{"$delete": true}` removes a field. */
export function merge(doc: Data, patch: Data): Data {
  const out = clone(doc)
  for (const [key, value] of Object.entries(patch)) {
    const [at, last] = walk(out, key)
    if (isPlain(value) && value[DELETE_KEY] === true) delete at[last]
    else at[last] = value
  }
  return out
}

export function stamp(doc: Data, paths: string[], now: Timestamp): Data {
  const out = clone(doc)
  for (const path of paths) {
    const [at, last] = walk(out, path)
    at[last] = now
  }
  return out
}

export function same(a: unknown, b: unknown): boolean {
  if (a instanceof Timestamp && b instanceof Timestamp) return a.isEqual(b)
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => same(v, b[i]))
  if (isPlain(a) && isPlain(b)) {
    const ka = Object.keys(a)
    return ka.length === Object.keys(b).length && ka.every((k) => k in b && same(a[k], b[k]))
  }
  return a === b
}
