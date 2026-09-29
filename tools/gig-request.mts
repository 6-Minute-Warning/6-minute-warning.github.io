import { readFileSync } from 'node:fs'
import { planRequest, readRequest, type Directory } from '../app/src/lib/request.ts'
import { account, APP_URL, commitAudited, credentials, encodeFields, fail, list, signIn, type Change } from './backstage-api.mts'

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
  const { email, password } = credentials()
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

  const changes: Change[] = [
    ...plan.writes.map((w) => ({ path: w.path, before: null, after: encodeFields(w.data), stamps: w.stamped ? ['createdAt'] : [] })),
    ...plan.events.map((e, i) => ({ path: `events/${plan.id}-${Date.now().toString(36)}-${i}`, before: null, after: encodeFields({ gig: plan.id, ...e, by: email }), stamps: ['at'] })),
  ]
  await commitAudited(changes, `Gig request: ${request.name}`, email, token).catch((e: Error & { status?: string }) => {
    if (e.status === 'ALREADY_EXISTS' || e.status === 'FAILED_PRECONDITION') fail(`Someone added this gig, or the same venue or presenter, a moment ago. Send the request again. (${e.message})`)
    fail(e.status === 'PERMISSION_DENIED' ? `Refused by the Firestore rules: ${e.message}` : `Firestore failed: ${e.status || e.message}`)
  })
  console.log(JSON.stringify(result, null, 2))
}

await main().catch((e: unknown) => fail(e instanceof Error ? e.message : String(e)))
