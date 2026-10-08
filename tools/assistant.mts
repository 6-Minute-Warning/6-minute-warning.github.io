import { readFileSync } from 'node:fs'
import { api, fail, type Json } from './backstage-api.mts'

const USAGE = `Usage:
  node tools/assistant.mts get <doc path>
  node tools/assistant.mts list <collection path>
  node tools/assistant.mts query <collection path> --where "<field> <op> <value>" [--where ...] [--order <field>[:desc]] [--limit <n>]
  node tools/assistant.mts set <doc path> <json | -> --reason "<why>" [--now <field>,...] [--dry-run]
  node tools/assistant.mts update <doc path> <json | -> --reason "<why>" [--now <field>,...] [--dry-run]
  node tools/assistant.mts delete <doc path> --reason "<why>" [--dry-run]
Needs BACKSTAGE_API_KEY.`

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
    return data as Json
  } catch (e) {
    fail(`Could not read the data: ${e instanceof Error ? e.message : String(e)}`)
  }
}

async function main() {
  const [command, ...rest] = process.argv.slice(2)
  const { positional, named } = flags(rest)
  if (!command || command === '--help') fail(USAGE)
  const [path, data] = positional
  if (!path) fail(USAGE)

  if (command === 'get') return console.log(JSON.stringify((await api({ action: 'get', path })).doc, null, 2))
  if (command === 'list') return console.log(JSON.stringify((await api({ action: 'list', collection: path })).docs, null, 2))
  if (command === 'query') {
    const where = (named.where ?? []).map((w) => {
      const m = w.match(/^(\S+)\s+(==|!=|<=|>=|<|>|in|array-contains)\s+(.+)$/)
      if (!m) fail(`Could not read --where "${w}". Write it as "<field> <op> <value>".`)
      return { field: m[1], op: m[2], value: parseValue(m[3]) }
    })
    const orderBy = named.order?.[0] ? [{ field: named.order[0].split(':')[0], desc: named.order[0].split(':')[1] === 'desc' }] : undefined
    const limit = named.limit?.[0] ? Number(named.limit[0]) : undefined
    return console.log(JSON.stringify((await api({ action: 'query', collection: path, where, orderBy, limit })).docs, null, 2))
  }
  if (!['set', 'update', 'delete'].includes(command)) fail(USAGE)

  const reason = named.reason?.[0]?.trim()
  if (!reason) fail('Say why with --reason "<why>". It goes in the audit record managers read.')
  const now = (named.now ?? []).flatMap((n) => n.split(',')).filter(Boolean)
  const reply = await api({ action: command, path, data: command === 'delete' ? undefined : readJson(data), now, reason, dryRun: !!named['dry-run'] })
  console.log(JSON.stringify(reply, null, 2))
}

await main().catch((e: unknown) => fail(e instanceof Error ? e.message : String(e)))
