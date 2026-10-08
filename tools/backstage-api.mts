export const APP_URL = 'https://six-minute-warning.web.app'
export const DEFAULT_ENDPOINT = 'https://northamerica-northeast1-six-minute-warning.cloudfunctions.net/assistant'
export const TIME_KEY = '$time'

export type Json = Record<string, unknown>
export interface Change {
  op: 'set' | 'update' | 'delete'
  path: string
  data?: Json
  now?: string[]
}

export function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

/** Posts one action to the assistant endpoint and returns the JSON reply. */
export async function api(body: Json): Promise<Json> {
  const key = process.env.BACKSTAGE_API_KEY?.trim()
  if (!key) fail('Set BACKSTAGE_API_KEY. Print it with: npx firebase functions:secrets:access ASSISTANT_API_KEY --project six-minute-warning')
  const url = process.env.BACKSTAGE_API_URL?.trim() || DEFAULT_ENDPOINT
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify(body) }).catch((e: Error) =>
    fail(`Could not reach ${url}: ${e.message}`),
  )
  const reply = (await res.json().catch(() => ({}))) as Json
  if (!res.ok) fail(`${res.status}: ${(reply.error as string) ?? res.statusText}`)
  return reply
}

export async function list(collection: string) {
  return ((await api({ action: 'list', collection })).docs as Json[]) ?? []
}

export async function commit(changes: Change[], reason: string, dryRun = false) {
  return api({ action: 'commit', changes, reason, dryRun })
}
