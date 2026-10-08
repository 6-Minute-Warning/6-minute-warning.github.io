import { readFileSync } from 'node:fs'
import { planRequest, readRequest, type Directory } from '../app/src/lib/request.ts'
import { APP_URL, commit, fail, list, type Change } from './backstage-api.mts'

const BY = 'assistant'

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const file = args.find((a) => !a.startsWith('--'))
  if (!file) fail('Usage: node tools/gig-request.mts [--dry-run] <request.json | ->  (needs BACKSTAGE_API_KEY)')
  let input: unknown
  try {
    input = JSON.parse(readFileSync(file === '-' ? 0 : file, 'utf8'))
  } catch (e) {
    fail(`Could not read the request: ${e instanceof Error ? e.message : String(e)}`)
  }
  const { request, errors } = readRequest(input)
  if (!request) fail(`The request was not sent:\n- ${errors.join('\n- ')}`)

  const [gigs, venues, presenters, people] = await Promise.all([list('gigs'), list('venues'), list('presenters'), list('people')])
  const plan = planRequest(request, { gigs, venues, presenters, people } as unknown as Directory, BY, Date.now())
  const result = { id: plan.id, url: `${APP_URL}/gigs/${plan.id}`, newVenue: plan.newVenue, newPresenter: plan.newPresenter, asked: plan.asked, gig: plan.gig }
  if (gigs.some((g) => g.id === plan.id)) fail(`A gig called ${request.name} on ${plan.gig.date} already exists: ${result.url}`)
  if (dryRun) return console.log(JSON.stringify({ dryRun: true, ...result }, null, 2))

  const changes: Change[] = [
    ...plan.writes.map((w) => ({ op: 'set' as const, path: w.path, data: w.data, now: w.stamped ? ['createdAt'] : [] })),
    ...plan.events.map((e, i) => ({ op: 'set' as const, path: `events/${plan.id}-${Date.now().toString(36)}-${i}`, data: { gig: plan.id, ...e, by: BY }, now: ['at'] })),
  ]
  await commit(changes, `Gig request: ${request.name}`)
  console.log(JSON.stringify(result, null, 2))
}

await main().catch((e: unknown) => fail(e instanceof Error ? e.message : String(e)))
