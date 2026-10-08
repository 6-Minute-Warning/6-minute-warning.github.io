import { readFileSync, writeFileSync } from 'node:fs'
import { planImport, type CalendarEvent, type Existing, type ImportPlan } from '../app/src/lib/calendarImport.ts'
import { commit, fail, list, type Change } from './backstage-api.mts'

const USAGE = `Usage:
  node tools/calendar-import.mts plan <events.json> <plan.json>   writes the planned changes; saves nothing to Backstage
  node tools/calendar-import.mts apply <plan.json> [--dry-run]    sends the plan, one audit record per change
events.json is the band calendar's events as the Google Calendar API lists them. Needs BACKSTAGE_API_KEY.`

const REASON = 'Calendar import: future gigs and tours from the band calendar'
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Edmonton' })

function read<T>(file: string | undefined): T {
  if (!file) fail(USAGE)
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T
  } catch (e) {
    return fail(`Could not read ${file}: ${e instanceof Error ? e.message : String(e)}`)
  }
}

async function main() {
  const [command, first, second, flag] = process.argv.slice(2)
  if (command === 'plan') {
    if (!second) fail(USAGE)
    const raw = read<{ events?: CalendarEvent[] } | CalendarEvent[]>(first)
    const events = Array.isArray(raw) ? raw : (raw.events ?? [])
    const [gigs, tours] = await Promise.all([list('gigs'), list('tours')])
    const plan = planImport(events, { gigs, tours } as unknown as Existing, today())
    writeFileSync(second, JSON.stringify(plan, null, 2))
    console.log(JSON.stringify({ created: plan.created, updated: plan.updated, skipped: plan.skipped, notes: plan.notes, writtenTo: second }, null, 2))
    return
  }
  if (command === 'apply') {
    const plan = read<ImportPlan>(first)
    if (!plan.changes?.length) return console.log('Nothing to apply.')
    const reply = await commit(plan.changes as Change[], REASON, flag === '--dry-run' || second === '--dry-run')
    console.log(JSON.stringify(reply, null, 2))
    return
  }
  fail(USAGE)
}

await main().catch((e: unknown) => fail(e instanceof Error ? e.message : String(e)))
