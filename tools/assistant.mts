import { readFileSync } from 'node:fs'
import { commitAudited, credentials, decodeFields, encode, encodeFields, explain, fail, getRaw, listRaw, query, signIn, type Fields, type RawDoc, type Value } from './backstage-api.mts'

const USAGE = `Usage:
  node tools/assistant.mts get <doc path>
  node tools/assistant.mts list <collection path>
  node tools/assistant.mts query <collection path> --where "<field> <op> <value>" [--where ...] [--order <field>[:desc]] [--limit <n>]
  node tools/assistant.mts set <doc path> <json | -> --reason "<why>" [--now <field>,...] [--dry-run]
  node tools/assistant.mts update <doc path> <json | -> --reason "<why>" [--now <field>,...] [--dry-run]
  node tools/assistant.mts delete <doc path> --reason "<why>" [--dry-run]`

const OPS: Record<string, string> = { '==': 'EQUAL', '!=': 'NOT_EQUAL', '<': 'LESS_THAN', '<=': 'LESS_THAN_OR_EQUAL', '>': 'GREATER_THAN', '>=': 'GREATER_THAN_OR_EQUAL', in: 'IN', 'array-contains': 'ARRAY_CONTAINS' }

function flags(args: string[]) {
  const positional: string[] = []
  const named: Record<string, string[]> = {}
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (!a.startsWith('--') || a === '-') positional.push(a)
    else if (a === '--dry-run') named['dry-run'] = ['1']
    else (named[a.slice(2)] ??= []).push(args[++i] ?? '')
  }
  return { positional, named }
}

function parseValue(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function readJson(source: string | undefined) {
  if (!source) fail(USAGE)
  try {
    const data = JSON.parse(source === '-' ? readFileSync(0, 'utf8') : source.trim().startsWith('{') ? source : readFileSync(source, 'utf8'))
    if (!data || typeof data !== 'object' || Array.isArray(data)) fail('The data must be a JSON object.')
    return data as Record<string, unknown>
  } catch (e) {
    fail(`Could not read the data: ${e instanceof Error ? e.message : String(e)}`)
  }
}

function show(d: RawDoc) {
  return { id: d.path.split('/').pop(), path: d.path, ...decodeFields(d.fields) }
}

function docPath(path: string | undefined) {
  if (!path || path.split('/').length % 2) fail(`Give a document path such as gigs/<id>.\n${USAGE}`)
  if (path.startsWith('users/') || path.startsWith('audit')) fail('The assistant cannot change users or the audit trail.')
  return path
}

/** Applies top-level or dotted keys to a copy of `fields`; `{"$delete": true}` removes the field. */
function merge(fields: Fields, patch: Record<string, unknown>): Fields {
  const out: Fields = structuredClone(fields)
  for (const [key, value] of Object.entries(patch)) {
    const parts = key.split('.')
    let at = out
    for (const part of parts.slice(0, -1)) {
      const next = at[part]
      if (!next || !('mapValue' in next)) at[part] = { mapValue: { fields: {} } }
      const map = at[part].mapValue as { fields?: Fields }
      at = map.fields ??= {}
    }
    const last = parts.at(-1)!
    if (value && typeof value === 'object' && (value as Record<string, unknown>).$delete === true) delete at[last]
    else at[last] = encode(value) as Value
  }
  return out
}

async function main() {
  const [command, ...rest] = process.argv.slice(2)
  const { positional, named } = flags(rest)
  if (!command || command === '--help') fail(USAGE)
  const { email, password } = credentials()
  const token = await signIn(email, password)
  const [path, data] = positional

  if (command === 'get') {
    const d = await getRaw(docPath(path), token)
    if (!d) fail(`No document at ${path}.`)
    return console.log(JSON.stringify(show(d), null, 2))
  }
  if (command === 'list') {
    if (!path) fail(USAGE)
    return console.log(JSON.stringify((await listRaw(path, token)).map(show), null, 2))
  }
  if (command === 'query') {
    if (!path) fail(USAGE)
    const filters = (named.where ?? []).map((w) => {
      const m = w.match(/^(\S+)\s+(==|!=|<=|>=|<|>|in|array-contains)\s+(.+)$/)
      if (!m) fail(`Could not read --where "${w}". Write it as "<field> <op> <value>".`)
      return { fieldFilter: { field: { fieldPath: m[1] }, op: OPS[m[2]], value: encode(parseValue(m[3])) } }
    })
    const structured: Record<string, unknown> = {}
    if (filters.length) structured.where = filters.length === 1 ? filters[0] : { compositeFilter: { op: 'AND', filters } }
    if (named.order?.[0]) {
      const [field, dir] = named.order[0].split(':')
      structured.orderBy = [{ field: { fieldPath: field }, direction: dir === 'desc' ? 'DESCENDING' : 'ASCENDING' }]
    }
    if (named.limit?.[0]) structured.limit = Number(named.limit[0])
    return console.log(JSON.stringify((await query(path, structured, token)).map(show), null, 2))
  }
  if (!['set', 'update', 'delete'].includes(command)) fail(USAGE)

  const target = docPath(path)
  const reason = named.reason?.[0]?.trim()
  if (!reason) fail('Say why with --reason "<why>". It goes in the audit record managers read.')
  const before = await getRaw(target, token)
  let after: Fields | null = null
  if (command === 'set') after = encodeFields(readJson(data))
  if (command === 'update') {
    if (!before) fail(`No document at ${target}. Use set to create it.`)
    after = merge(before.fields, readJson(data))
  }
  if (command === 'delete' && !before) fail(`No document at ${target}.`)
  const stamps = (named.now ?? []).flatMap((n) => n.split(',')).filter(Boolean)
  if (after) for (const s of stamps) delete after[s]

  if (named['dry-run']) {
    return console.log(JSON.stringify({ dryRun: true, path: target, before: before && decodeFields(before.fields), after: after && decodeFields(after), stamped: stamps }, null, 2))
  }
  const ids = await commitAudited([{ path: target, before, after, stamps }], reason, email, token).catch(explain)
  const saved = await getRaw(target, token)
  console.log(JSON.stringify({ audit: ids[target], path: target, doc: saved && show(saved) }, null, 2))
}

await main().catch((e: unknown) => fail(e instanceof Error ? e.message : String(e)))
