import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { initializeApp } from 'firebase-admin/app'
import { Timestamp, getFirestore } from 'firebase-admin/firestore'
import { beforeEach, describe, expect, it } from 'vitest'
import { ApiError, handle } from '../src/assistant'
import { keyMatches } from '../src/auth'
import { COLLECTIONS, SUBCOLLECTIONS } from '../src/constants'

initializeApp({ projectId: 'demo-6mw' })
const db = getFirestore()
const NOW = Timestamp.fromDate(new Date('2026-10-08T18:00:00Z'))

const gig = { name: 'Gala', date: '2026-12-05', stage: 'tentative', money: { fee: 100, deposit: 0 } }
const run = (body: unknown) => handle(db, body, NOW) as Promise<{ audit: Record<string, string>; docs: Record<string, unknown>; doc?: Record<string, unknown> }>
const fails = async (body: unknown, status: number) => {
  const err = await run(body).then(() => null, (e: unknown) => e)
  expect(err).toBeInstanceOf(ApiError)
  expect((err as ApiError).status).toBe(status)
}

async function clear() {
  for (const c of [...COLLECTIONS, 'audit']) await db.recursiveDelete(db.collection(c))
}

beforeEach(clear)

describe('writes', () => {
  it('writes the document and its audit row together, signed by the server', async () => {
    const res = await run({ action: 'set', path: 'gigs/g1', data: gig, reason: 'New request' })
    const id = res.audit['gigs/g1']
    const row = (await db.doc(`audit/${id}`).get()).data()!
    expect(row).toMatchObject({ path: 'gigs/g1', before: null, by: 'assistant', reason: 'New request' })
    expect(row.after).toEqual(gig)
    expect(row.at.isEqual(NOW)).toBe(true)
    expect((await db.doc('gigs/g1').get()).data()).toEqual(gig)
  })

  it('records the before and after of an update, with dotted keys and deletes', async () => {
    await db.doc('gigs/g1').set({ ...gig, notes: 'old' })
    const res = await run({ action: 'update', path: 'gigs/g1', data: { 'money.fee': 300, notes: { $delete: true } }, reason: 'Fee raised' })
    const row = (await db.doc(`audit/${res.audit['gigs/g1']}`).get()).data()!
    expect(row.before).toEqual({ ...gig, notes: 'old' })
    expect(row.after).toEqual({ ...gig, money: { fee: 300, deposit: 0 } })
  })

  it('stamps the commit time into the document and the audit copy alike', async () => {
    const res = await run({ action: 'set', path: 'gigs/g1/expenses/e1', data: { kind: 'meals', amount: 40 }, now: ['at'], reason: 'Receipt' })
    const stored = (await db.doc('gigs/g1/expenses/e1').get()).data()!
    const row = (await db.doc(`audit/${res.audit['gigs/g1/expenses/e1']}`).get()).data()!
    expect(stored.at.isEqual(NOW)).toBe(true)
    expect(row.after.at.isEqual(NOW)).toBe(true)
  })

  it('writes timestamps given as {$time}', async () => {
    await run({ action: 'set', path: 'tasks/t1', data: { kind: 'x', createdAt: { $time: '2026-10-01T19:00:00Z' } }, reason: 'Seed' })
    expect(((await db.doc('tasks/t1').get()).data()!.createdAt as Timestamp).toDate().toISOString()).toBe('2026-10-01T19:00:00.000Z')
  })

  it('keeps timestamps already on a document through an update', async () => {
    const at = Timestamp.fromDate(new Date('2026-10-01T00:00:00Z'))
    await db.doc('gigs/g1').set({ ...gig, createdAt: at })
    await run({ action: 'update', path: 'gigs/g1', data: { notes: 'hi' }, reason: 'Note' })
    expect(((await db.doc('gigs/g1').get()).data()!.createdAt as Timestamp).isEqual(at)).toBe(true)
  })

  it('deletes with the removed document in the audit row', async () => {
    await db.doc('venues/v1').set({ name: 'Hall', address: '' })
    const res = await run({ action: 'delete', path: 'venues/v1', reason: 'Duplicate' })
    const row = (await db.doc(`audit/${res.audit['venues/v1']}`).get()).data()!
    expect(row).toMatchObject({ before: { name: 'Hall', address: '' }, after: null })
    expect((await db.doc('venues/v1').get()).exists).toBe(false)
  })

  it('commits several documents atomically with one audit row each', async () => {
    const res = await run({
      action: 'commit',
      reason: 'Gig request',
      changes: [
        { op: 'set', path: 'gigs/g1', data: gig },
        { op: 'set', path: 'venues/hall', data: { name: 'Hall', address: '' } },
      ],
    })
    expect(Object.keys(res.audit).sort()).toEqual(['gigs/g1', 'venues/hall'])
    expect((await db.collection('audit').get()).size).toBe(2)
  })

  it('writes nothing at all when one change in a commit fails', async () => {
    await fails({ action: 'commit', reason: 'Mixed', changes: [{ op: 'set', path: 'venues/v1', data: { name: 'Hall' } }, { op: 'update', path: 'gigs/missing', data: { notes: 'x' } }] }, 404)
    expect((await db.doc('venues/v1').get()).exists).toBe(false)
    expect((await db.collection('audit').get()).size).toBe(0)
  })

  it('shows the change without saving it on a dry run', async () => {
    await db.doc('gigs/g1').set(gig)
    const res = (await run({ action: 'update', path: 'gigs/g1', data: { notes: 'x' }, reason: 'Try', dryRun: true })) as unknown as { dryRun: boolean; changes: { before: unknown; after: { notes: string } }[] }
    expect(res.dryRun).toBe(true)
    expect(res.changes[0].after.notes).toBe('x')
    expect((await db.doc('gigs/g1').get()).data()!.notes).toBeUndefined()
    expect((await db.collection('audit').get()).size).toBe(0)
  })

  it('skips the audit row when nothing changed', async () => {
    await db.doc('gigs/g1').set(gig)
    const res = await run({ action: 'update', path: 'gigs/g1', data: { stage: 'tentative' }, reason: 'No-op' })
    expect(res.audit).toEqual({})
    expect((await db.collection('audit').get()).size).toBe(0)
  })
})

describe('refusals', () => {
  it('needs a reason', () => fails({ action: 'set', path: 'gigs/g1', data: gig }, 400))
  it('refuses users, audit and push tokens', async () => {
    for (const path of ['users/a@b.c', 'audit/x', 'pushTokens/x']) await fails({ action: 'set', path, data: {}, reason: 'x' }, 400)
    await fails({ action: 'get', path: 'users/a@b.c' }, 400)
    await fails({ action: 'list', collection: 'audit' }, 400)
  })
  it('refuses a gig the app could not open', () => fails({ action: 'set', path: 'gigs/g1', data: { name: 'No date' }, reason: 'x' }, 400))
  it('refuses a tour that ends before it starts', () =>
    fails({ action: 'set', path: 'tours/t', data: { name: 'T', start: '2027-05-10', end: '2027-05-01', days: [] }, reason: 'x' }, 400))
  it('never changes the event log', async () => {
    await run({ action: 'set', path: 'events/e1', data: { gig: 'g1', kind: 'created' }, reason: 'Log' })
    await fails({ action: 'set', path: 'events/e1', data: { gig: 'g1', kind: 'edited' }, reason: 'Log' }, 409)
  })
  it('refuses the same document twice in one commit', () =>
    fails({ action: 'commit', reason: 'x', changes: [{ op: 'set', path: 'venues/v', data: {} }, { op: 'delete', path: 'venues/v' }] }, 400))
  it('refuses an unknown action', () => fails({ action: 'drop' }, 400))
})

describe('reads', () => {
  beforeEach(async () => {
    await db.doc('gigs/a').set({ ...gig, name: 'A', date: '2026-11-01', created: Timestamp.fromDate(new Date('2026-10-01T00:00:00Z')) })
    await db.doc('gigs/b').set({ ...gig, name: 'B', date: '2026-12-01', stage: 'confirmed' })
  })
  it('gets one with timestamps as {$time}', async () => {
    const res = await run({ action: 'get', path: 'gigs/a' })
    expect(res.doc).toMatchObject({ id: 'a', path: 'gigs/a', created: { $time: '2026-10-01T00:00:00.000Z' } })
  })
  it('lists a collection', async () => {
    expect(((await run({ action: 'list', collection: 'gigs' })) as unknown as { docs: unknown[] }).docs).toHaveLength(2)
  })
  it('queries with where, order and limit', async () => {
    const res = (await run({ action: 'query', collection: 'gigs', where: [{ field: 'date', op: '>=', value: '2026-11-15' }], orderBy: [{ field: 'date', desc: true }], limit: 5 })) as unknown as { docs: { id: string }[] }
    expect(res.docs.map((d) => d.id)).toEqual(['b'])
  })
  it('reports a missing document as 404', () => fails({ action: 'get', path: 'gigs/none' }, 404))
})

describe('key check', () => {
  it('accepts only the exact bearer key', () => {
    expect(keyMatches('Bearer abc', 'abc')).toBe(true)
    expect(keyMatches('Bearer abd', 'abc')).toBe(false)
    expect(keyMatches('abc', 'abc')).toBe(false)
    expect(keyMatches(undefined, 'abc')).toBe(false)
    expect(keyMatches('Bearer ', '')).toBe(false)
  })
})

describe('rules stay in step', () => {
  it('lists the same collections as the audit path rule', () => {
    const rules = readFileSync(join(__dirname, '../../firestore/firestore.rules'), 'utf8')
    const match = /d\.path\.matches\('\^\(([^)]*)\)\/\[\^\/\]\+\(\/\(([^)]*)\)/.exec(rules)!
    expect(match[1].split('|')).toEqual([...COLLECTIONS])
    expect(match[2].split('|')).toEqual([...SUBCOLLECTIONS])
  })
})
