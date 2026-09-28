import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, deleteField, doc, getDoc, getDocs, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch, type Firestore } from 'firebase/firestore'
import { planRequest, readRequest, type RequestPlan } from '../app/src/lib/request.ts'

const OWNER = 'brett@6minutewarning.com'
let env: RulesTestEnvironment

function as(email: string, verified = true) {
  return env.authenticatedContext(email, { email, email_verified: verified }).firestore()
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-6mw',
    firestore: { rules: readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8') },
  })
})

afterAll(() => env.cleanup())

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users/member@example.com'), { name: 'Member', role: 'member' })
    await setDoc(doc(db, 'users/admin@example.com'), { name: 'Admin', role: 'admin' })
    await setDoc(doc(db, 'users/manager@example.com'), { name: 'Manager', role: 'manager' })
    await setDoc(doc(db, 'users/director@example.com'), { name: 'Director', role: 'director' })
    await setDoc(doc(db, 'gigs/g1'), { name: 'Sample gig' })
    await setDoc(doc(db, 'events/e1'), { gig: 'g1', kind: 'created' })
  })
})

describe('outsiders', () => {
  it('signed-out visitors read nothing', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'gigs/g1')))
  })

  it('signed-in strangers read no band data', async () => {
    await assertFails(getDoc(doc(as('stranger@example.com'), 'gigs/g1')))
  })

  it('strangers can check their own access record but not add themselves', async () => {
    const db = as('stranger@example.com')
    await assertSucceeds(getDoc(doc(db, 'users/stranger@example.com')))
    await assertFails(setDoc(doc(db, 'users/stranger@example.com'), { name: 'Me', role: 'admin' }))
  })

  it('strangers cannot list the users collection', async () => {
    await assertFails(getDocs(collection(as('stranger@example.com'), 'users')))
  })

  it('strangers cannot delete a gig', async () => {
    await assertFails(deleteDoc(doc(as('stranger@example.com'), 'gigs/g1')))
  })

  it('an unverified owner email gets nothing', async () => {
    await assertFails(getDoc(doc(as(OWNER, false), 'gigs/g1')))
  })
})

describe('members', () => {
  it('read and write gigs', async () => {
    const db = as('member@example.com')
    await assertSucceeds(getDoc(doc(db, 'gigs/g1')))
    await assertSucceeds(updateDoc(doc(db, 'gigs/g1'), { name: 'Renamed' }))
  })

  it('cannot grant access', async () => {
    await assertFails(setDoc(doc(as('member@example.com'), 'users/new@example.com'), { name: 'New', role: 'member' }))
  })

  it('cannot list the users collection', async () => {
    await assertFails(getDocs(collection(as('member@example.com'), 'users')))
  })

  it('cannot delete a gig', async () => {
    await assertFails(deleteDoc(doc(as('member@example.com'), 'gigs/g1')))
  })

  it('can add to the event log but not rewrite it', async () => {
    const db = as('member@example.com')
    await assertSucceeds(setDoc(doc(db, 'events/e2'), { gig: 'g1', kind: 'note' }))
    await assertFails(updateDoc(doc(db, 'events/e1'), { kind: 'edited' }))
    await assertFails(deleteDoc(doc(db, 'events/e1')))
  })
})

describe('money and roster are manager work', () => {
  it('singers read gigs and edit notes but not money, contract or contact', async () => {
    const db = as('member@example.com')
    await assertSucceeds(getDoc(doc(db, 'gigs/g1')))
    await assertSucceeds(updateDoc(doc(db, 'gigs/g1'), { notes: 'Bring the risers' }))
    await assertFails(updateDoc(doc(db, 'gigs/g1'), { money: { fee: 9999 } }))
    await assertFails(updateDoc(doc(db, 'gigs/g1'), { contract: 'signed' }))
    await assertFails(updateDoc(doc(db, 'gigs/g1'), { contact: { name: 'Me' } }))
    await assertFails(updateDoc(doc(db, 'gigs/g1'), { stage: 'cancelled' }))
    await assertFails(setDoc(doc(db, 'gigs/new'), { name: 'New gig' }))
    await assertFails(deleteDoc(doc(db, 'gigs/g1')))
  })

  it('singers cannot bypass money with a dot-path update', async () => {
    const db = as('member@example.com')
    await assertFails(updateDoc(doc(db, 'gigs/g1'), { 'money.fee': 9999 }))
  })

  it('managers handle money, gigs and the roster', async () => {
    const db = as('manager@example.com')
    await assertSucceeds(updateDoc(doc(db, 'gigs/g1'), { money: { fee: 3200 } }))
    await assertSucceeds(setDoc(doc(db, 'gigs/new'), { name: 'New gig' }))
    await assertSucceeds(setDoc(doc(db, 'people/russell'), { name: 'Russell', status: 'crew', part: 'Sound tech', phone: '', emails: [] }))
    await assertSucceeds(setDoc(doc(db, 'payments/p1'), { gig: 'g1', amount: 100 }))
  })

  it('singers cannot change the roster or payments', async () => {
    const db = as('member@example.com')
    await assertFails(setDoc(doc(db, 'people/russell'), { name: 'Russell', status: 'crew', part: 'Sound tech', phone: '', emails: [] }))
    await assertFails(setDoc(doc(db, 'payments/p1'), { gig: 'g1', amount: 100 }))
  })

  it('managers cannot hand out access', async () => {
    await assertFails(setDoc(doc(as('manager@example.com'), 'users/new@example.com'), { name: 'New', role: 'member' }))
  })
})

describe('linked addresses', () => {
  it('admins can link an address to a person', async () => {
    await assertSucceeds(setDoc(doc(as('admin@example.com'), 'users/jo@6minutewarning.com'), { name: 'Jo', role: 'member', person: 'jo-tong' }))
  })

  it('person links must be short strings', async () => {
    const db = as('admin@example.com')
    await assertFails(setDoc(doc(db, 'users/a@example.com'), { name: 'A', role: 'member', person: 'x'.repeat(81) }))
    await assertFails(setDoc(doc(db, 'users/b@example.com'), { name: 'B', role: 'member', person: 42 }))
  })

  it('a person record must match the roster shape', async () => {
    const db = as('manager@example.com')
    await assertSucceeds(setDoc(doc(db, 'people/jo-tong'), { name: 'Jo Tong', status: 'active', part: 'Alto', phone: '', emails: ['jo@6minutewarning.com'] }))
    await assertFails(setDoc(doc(db, 'people/bad'), { name: 'Bad', status: 'retired', part: '', phone: '', emails: [] }))
    await assertFails(setDoc(doc(db, 'people/bad2'), { name: 'Bad', status: 'active', part: '', phone: '', emails: [], isAdmin: true }))
    await assertFails(setDoc(doc(db, 'people/bad3'), { name: 'x'.repeat(121), status: 'active', part: '', phone: '', emails: [] }))
  })
})

describe('admins', () => {
  it('the owner is an admin before any access record exists', async () => {
    const db = as(OWNER)
    await assertSucceeds(getDoc(doc(db, 'gigs/g1')))
    await assertSucceeds(setDoc(doc(db, 'users/new@example.com'), { name: 'New', role: 'member' }))
  })

  it('admins grant access with a valid role only', async () => {
    const db = as('admin@example.com')
    await assertSucceeds(setDoc(doc(db, 'users/new@example.com'), { name: 'New', role: 'director' }))
    await assertFails(setDoc(doc(db, 'users/bad@example.com'), { name: 'Bad', role: 'superuser' }))
    await assertFails(setDoc(doc(db, 'users/Mixed@Example.com'), { name: 'Case', role: 'member' }))
    await assertFails(setDoc(doc(db, 'users/extra@example.com'), { name: 'Extra', role: 'member', isAdmin: true }))
  })

  it('admins cannot remove their own access', async () => {
    await assertFails(deleteDoc(doc(as('admin@example.com'), 'users/admin@example.com')))
    await assertSucceeds(deleteDoc(doc(as('admin@example.com'), 'users/member@example.com')))
  })

  it('admins can list the users collection', async () => {
    await assertSucceeds(getDocs(collection(as('admin@example.com'), 'users')))
  })

  it('admins cannot demote themselves but can demote another admin', async () => {
    await assertFails(updateDoc(doc(as('admin@example.com'), 'users/admin@example.com'), { role: 'member' }))
    await assertSucceeds(updateDoc(doc(as(OWNER), 'users/admin@example.com'), { role: 'member' }))
  })

  it('an owner with a mixed-case Google email still bootstraps as admin', async () => {
    const db = as('Brett@6MinuteWarning.com')
    await assertSucceeds(getDoc(doc(db, 'gigs/g1')))
    await assertSucceeds(setDoc(doc(db, 'users/new2@example.com'), { name: 'New', role: 'member' }))
  })
})

describe('band poll', () => {
  const call = { openedBy: 'member@example.com', openedAt: 1, asked: ['kyle'], subbing: [], abandoned: false, calendarEventId: '' }
  const answer = (value: string, by = 'member@example.com') => ({ answer: value, by, at: serverTimestamp() })

  it('members record their own and anyone else\'s answer, signed as themselves', async () => {
    const db = as('member@example.com')
    await assertSucceeds(setDoc(doc(db, 'gigs/g1/answers/kyle'), answer('yes')))
    await assertSucceeds(setDoc(doc(db, 'gigs/g1/answers/sub-sam'), answer('no')))
    await assertSucceeds(getDocs(collection(db, 'gigs/g1/answers')))
    await assertSucceeds(deleteDoc(doc(db, 'gigs/g1/answers/kyle')))
  })

  it('answers cannot be forged, backdated or malformed', async () => {
    const db = as('member@example.com')
    await assertFails(setDoc(doc(db, 'gigs/g1/answers/kyle'), answer('yes', 'admin@example.com')))
    await assertFails(setDoc(doc(db, 'gigs/g1/answers/kyle'), answer('maybe')))
    await assertFails(setDoc(doc(db, 'gigs/g1/answers/kyle'), { answer: 'yes', by: 'member@example.com', at: 0 }))
    await assertFails(setDoc(doc(db, 'gigs/g1/answers/kyle'), { ...answer('yes'), extra: true }))
    await assertSucceeds(setDoc(doc(db, 'gigs/g1/answers/kyle'), { ...answer('later'), until: '2026-10-02' }))
    await assertFails(setDoc(doc(db, 'gigs/g1/answers/kyle'), answer('later')))
    await assertFails(setDoc(doc(db, 'gigs/g1/answers/kyle'), { ...answer('yes'), until: '2026-10-02' }))
    await assertFails(setDoc(doc(db, 'gigs/g1/answers/kyle'), { ...answer('later'), until: 'soon' }))
    await assertFails(setDoc(doc(as('stranger@example.com'), 'gigs/g1/answers/kyle'), answer('yes', 'stranger@example.com')))
  })

  it('any member can open the poll, find a sub, or abandon the gig', async () => {
    const db = as('member@example.com')
    await assertSucceeds(updateDoc(doc(db, 'gigs/g1'), { call }))
    await assertSucceeds(updateDoc(doc(db, 'gigs/g1'), { 'call.subbing': ['kyle'] }))
    await assertSucceeds(updateDoc(doc(db, 'gigs/g1'), { 'call.abandoned': true, stage: 'cancelled' }))
    await assertSucceeds(updateDoc(doc(db, 'gigs/g1'), { 'call.abandoned': false }))
  })

  it('a gig can be created with a poll, but not a malformed one', async () => {
    const db = as('manager@example.com')
    await assertSucceeds(setDoc(doc(db, 'gigs/g2'), { name: 'New', call }))
    await assertFails(setDoc(doc(db, 'gigs/g3'), { name: 'New', call: { ...call, extra: 1 } }))
  })

  it('a malformed poll is refused', async () => {
    const db = as('member@example.com')
    await assertFails(updateDoc(doc(db, 'gigs/g1'), { call: { ...call, asked: 'kyle' } }))
    await assertFails(updateDoc(doc(db, 'gigs/g1'), { call: { ...call, extra: 1 } }))
    await assertFails(updateDoc(doc(as('manager@example.com'), 'gigs/g1'), { call: { ...call, abandoned: 'yes' } }))
  })

  it('abandoning is the only stage change a member can make, and it must cancel', async () => {
    const db = as('member@example.com')
    await assertSucceeds(updateDoc(doc(db, 'gigs/g1'), { call }))
    await assertFails(updateDoc(doc(db, 'gigs/g1'), { stage: 'confirmed', 'call.abandoned': true }))
    await assertFails(updateDoc(doc(db, 'gigs/g1'), { stage: 'cancelled', 'call.abandoned': false }))
    await assertFails(updateDoc(doc(db, 'gigs/g1'), { 'call.abandoned': true }))
  })
})

describe('rehearsals needed', () => {
  const rehearsals = (by: string, extra: Record<string, unknown> = {}) => ({ needed: 3, note: '2 full + 1 sectional', by, at: serverTimestamp(), lineupKey: 'a,b,c', ...extra })

  it('the music director and managers set it, signed as themselves', async () => {
    await assertSucceeds(updateDoc(doc(as('director@example.com'), 'gigs/g1'), { rehearsals: rehearsals('director@example.com') }))
    await assertSucceeds(updateDoc(doc(as('manager@example.com'), 'gigs/g1'), { rehearsals: rehearsals('manager@example.com', { needed: 0, note: '' }) }))
    await assertSucceeds(setDoc(doc(as('manager@example.com'), 'gigs/g2'), { name: 'New', rehearsals: rehearsals('manager@example.com') }))
  })

  it('singers cannot set or clear it, but can still edit the rest of the gig', async () => {
    const member = as('member@example.com')
    await assertFails(updateDoc(doc(member, 'gigs/g1'), { rehearsals: rehearsals('member@example.com') }))
    await assertFails(updateDoc(doc(member, 'gigs/g1'), { 'rehearsals.needed': 1 }))
    await assertSucceeds(updateDoc(doc(as('director@example.com'), 'gigs/g1'), { rehearsals: rehearsals('director@example.com') }))
    await assertFails(updateDoc(doc(member, 'gigs/g1'), { rehearsals: deleteField() }))
    await assertSucceeds(updateDoc(doc(member, 'gigs/g1'), { notes: 'Bring the risers' }))
  })

  it('nobody clears an answer once given', async () => {
    const db = as('director@example.com')
    await assertSucceeds(updateDoc(doc(db, 'gigs/g1'), { rehearsals: rehearsals('director@example.com') }))
    await assertFails(updateDoc(doc(db, 'gigs/g1'), { rehearsals: deleteField() }))
    await assertFails(updateDoc(doc(as('manager@example.com'), 'gigs/g1'), { rehearsals: deleteField() }))
  })

  it('the director still cannot touch money', async () => {
    await assertFails(updateDoc(doc(as('director@example.com'), 'gigs/g1'), { money: { fee: 1 } }))
  })

  it('a forged, backdated or malformed answer is refused', async () => {
    const db = as('director@example.com')
    await assertFails(updateDoc(doc(db, 'gigs/g1'), { rehearsals: rehearsals('manager@example.com') }))
    await assertFails(updateDoc(doc(db, 'gigs/g1'), { rehearsals: rehearsals('director@example.com', { at: 0 }) }))
    await assertFails(updateDoc(doc(db, 'gigs/g1'), { rehearsals: rehearsals('director@example.com', { needed: -1 }) }))
    await assertFails(updateDoc(doc(db, 'gigs/g1'), { rehearsals: rehearsals('director@example.com', { needed: 21 }) }))
    await assertFails(updateDoc(doc(db, 'gigs/g1'), { rehearsals: rehearsals('director@example.com', { needed: 2.5 }) }))
    await assertFails(updateDoc(doc(db, 'gigs/g1'), { rehearsals: rehearsals('director@example.com', { note: 'x'.repeat(201) }) }))
    await assertFails(updateDoc(doc(db, 'gigs/g1'), { rehearsals: rehearsals('director@example.com', { extra: true }) }))
    const { lineupKey: _lineupKey, ...missing } = rehearsals('director@example.com')
    await assertFails(updateDoc(doc(db, 'gigs/g1'), { rehearsals: missing }))
  })
})

describe('possible dates', () => {
  const dateOptions = ['2026-11-27', '2026-11-28', '2026-12-04']
  const times = (dates: Record<string, string>) => Object.fromEntries(Object.keys(dates).map((d) => [d, serverTimestamp()]))
  const signed = (dates: Record<string, string>, extra = {}) => ({ dates, times: times(dates), by: 'member@example.com', at: serverTimestamp(), ...extra })
  const at = Timestamp.fromMillis(1_700_000_000_000)
  const earlier = Timestamp.fromMillis(1_600_000_000_000)

  beforeEach(() =>
    env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'gigs/g1'), { name: 'Sample gig', date: dateOptions[0], dateOptions })
    }),
  )

  it('members answer per date, signed as themselves', async () => {
    const db = as('member@example.com')
    await assertSucceeds(setDoc(doc(db, 'gigs/g1/answers/kyle'), signed({ '2026-11-27': 'yes', '2026-12-04': 'no' })))
    await assertSucceeds(setDoc(doc(db, 'gigs/g1/answers/kyle'), signed({ '2026-11-28': 'later' }, { until: '2026-10-15' })))
  })

  it('a per-date answer must name the gig\'s own dates with a known answer', async () => {
    const db = as('member@example.com')
    await assertFails(setDoc(doc(db, 'gigs/g1/answers/kyle'), signed({ '2026-11-29': 'yes' })))
    await assertFails(setDoc(doc(db, 'gigs/g1/answers/kyle'), signed({ '2026-11-27': 'maybe' })))
    await assertFails(setDoc(doc(db, 'gigs/g1/answers/kyle'), signed({})))
    await assertFails(setDoc(doc(db, 'gigs/g1/answers/kyle'), signed({ '2026-11-27': 'later' })))
    await assertFails(setDoc(doc(db, 'gigs/g1/answers/kyle'), signed({ '2026-11-27': 'yes' }, { until: '2026-10-15' })))
    await assertFails(setDoc(doc(db, 'gigs/g1/answers/kyle'), { ...signed({ '2026-11-27': 'yes' }), by: 'admin@example.com' }))
    await assertFails(setDoc(doc(db, 'gigs/g1/answers/kyle'), { ...signed({ '2026-11-27': 'yes' }), answer: 'yes' }))
    await assertFails(setDoc(doc(db, 'gigs/g1/answers/kyle'), { ...signed({ '2026-11-27': 'yes' }), times: {} }))
    await assertFails(setDoc(doc(db, 'gigs/g1/answers/kyle'), { ...signed({ '2026-11-27': 'yes' }), times: times({ '2026-11-28': 'yes' }) }))
  })

  it('refuses a single-date answer while the dates are open', async () => {
    await assertFails(setDoc(doc(as('member@example.com'), 'gigs/g1/answers/kyle'), { answer: 'yes', by: 'member@example.com', at: serverTimestamp() }))
  })

  it('a gig with one date takes no per-date answers', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'gigs/g2'), { name: 'One date', date: '2026-11-27' }))
    await assertFails(setDoc(doc(as('member@example.com'), 'gigs/g2/answers/kyle'), signed({ '2026-11-27': 'yes' })))
  })

  it('only managers set or change the possible dates, and there are two to six', async () => {
    await assertFails(updateDoc(doc(as('member@example.com'), 'gigs/g1'), { dateOptions: ['2026-11-27', '2026-11-30'] }))
    await assertFails(updateDoc(doc(as('member@example.com'), 'gigs/g1'), { dateOptions: deleteField(), date: '2026-11-28' }))
    await assertSucceeds(setDoc(doc(as('manager@example.com'), 'gigs/g3'), { name: 'New', date: '2026-11-27', dateOptions }))
    await assertFails(setDoc(doc(as('manager@example.com'), 'gigs/g4'), { name: 'New', date: '2026-11-27', dateOptions: ['2026-11-27'] }))
    await assertFails(setDoc(doc(as('manager@example.com'), 'gigs/g5'), { name: 'New', date: '2026-11-27', dateOptions: '2026-11-27' }))
  })

  describe('locking a date', () => {
    beforeEach(() =>
      env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore()
        await setDoc(doc(db, 'gigs/g1/answers/kyle'), { dates: { '2026-11-28': 'yes', '2026-12-04': 'no' }, times: { '2026-11-28': earlier, '2026-12-04': at }, by: 'kyle@example.com', at })
        await setDoc(doc(db, 'gigs/g1/answers/tim'), { dates: { '2026-11-28': 'later' }, times: { '2026-11-28': at }, by: 'tim@example.com', at, until: '2026-10-15' })
      }),
    )

    function lock(date: string, kyle: object, tim: object) {
      const db = as('manager@example.com')
      const batch = writeBatch(db)
      batch.update(doc(db, 'gigs/g1'), { date, dateOptions: deleteField() })
      batch.set(doc(db, 'gigs/g1/answers/kyle'), kyle)
      batch.set(doc(db, 'gigs/g1/answers/tim'), tim)
      return batch.commit()
    }

    it('carries each answer for the locked date over, keeping who gave it and when', async () => {
      await assertSucceeds(lock('2026-11-28', { answer: 'yes', by: 'kyle@example.com', at: earlier }, { answer: 'later', by: 'tim@example.com', at, until: '2026-10-15' }))
    })

    it('keeps the time of the locked date\'s answer, not the latest change', async () => {
      await assertFails(lock('2026-11-28', { answer: 'yes', by: 'kyle@example.com', at }, { answer: 'later', by: 'tim@example.com', at, until: '2026-10-15' }))
    })

    it('locks a gig with a full band of answers in one batch', async () => {
      const names = Array.from({ length: 12 }, (_, i) => `p${i}`)
      await env.withSecurityRulesDisabled(async (ctx) => {
        for (const n of names) await setDoc(doc(ctx.firestore(), `gigs/g1/answers/${n}`), { dates: { '2026-11-28': 'yes' }, times: { '2026-11-28': at }, by: 'x@example.com', at })
      })
      const db = as('manager@example.com')
      const batch = writeBatch(db)
      batch.update(doc(db, 'gigs/g1'), { date: '2026-11-28', dateOptions: deleteField() })
      batch.set(doc(db, 'gigs/g1/answers/kyle'), { answer: 'yes', by: 'kyle@example.com', at: earlier })
      batch.delete(doc(db, 'gigs/g1/answers/tim'))
      for (const n of names) batch.set(doc(db, `gigs/g1/answers/${n}`), { answer: 'yes', by: 'x@example.com', at })
      await assertSucceeds(batch.commit())
    })

    it('refuses a carried answer that differs from the one given for that date', async () => {
      await assertFails(lock('2026-11-28', { answer: 'no', by: 'kyle@example.com', at: earlier }, { answer: 'later', by: 'tim@example.com', at, until: '2026-10-15' }))
      await assertFails(lock('2026-12-04', { answer: 'yes', by: 'kyle@example.com', at }, { answer: 'later', by: 'tim@example.com', at, until: '2026-10-15' }))
      await assertFails(lock('2026-11-28', { answer: 'yes', by: 'kyle@example.com', at: earlier }, { answer: 'later', by: 'tim@example.com', at, until: '2026-11-01' }))
    })

    it('keeps the old signature only while the dates are being locked', async () => {
      const db = as('member@example.com')
      await assertFails(setDoc(doc(db, 'gigs/g1/answers/kyle'), { answer: 'yes', by: 'kyle@example.com', at }))
    })
  })
})

describe('venues, presenters and to-dos', () => {
  it('members read them but only managers write', async () => {
    const member = as('member@example.com')
    const manager = as('manager@example.com')
    await assertSucceeds(setDoc(doc(manager, 'presenters/pat'), { name: 'Pat' }))
    await assertSucceeds(setDoc(doc(manager, 'tasks/venue-hall'), { kind: 'venue', target: 'hall', open: true }))
    await assertSucceeds(getDoc(doc(member, 'presenters/pat')))
    await assertSucceeds(getDoc(doc(member, 'tasks/venue-hall')))
    await assertFails(setDoc(doc(member, 'presenters/pat'), { name: 'Me' }))
    await assertFails(updateDoc(doc(member, 'tasks/venue-hall'), { open: false }))
    await assertFails(getDoc(doc(as('stranger@example.com'), 'presenters/pat')))
  })
})

describe('gig expenses and payouts', () => {
  const expense = () => ({ kind: 'travel', description: 'Van to Banff', amount: 600, by: 'manager@example.com', at: serverTimestamp() })

  it('managers record, read and remove expenses', async () => {
    const db = as('manager@example.com')
    await assertSucceeds(setDoc(doc(db, 'gigs/g1/expenses/x1'), expense()))
    await assertSucceeds(setDoc(doc(db, 'gigs/g1/expenses/x2'), { ...expense(), kind: 'hotel', amount: 189.5 }))
    await assertSucceeds(getDocs(collection(db, 'gigs/g1/expenses')))
    await assertSucceeds(deleteDoc(doc(db, 'gigs/g1/expenses/x1')))
  })

  it('singers cannot see or touch expenses', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'gigs/g1/expenses/x1'), { kind: 'meals', description: '', amount: 80 }))
    const db = as('member@example.com')
    await assertFails(getDoc(doc(db, 'gigs/g1/expenses/x1')))
    await assertFails(getDocs(collection(db, 'gigs/g1/expenses')))
    await assertFails(setDoc(doc(db, 'gigs/g1/expenses/x2'), { ...expense(), by: 'member@example.com' }))
    await assertFails(deleteDoc(doc(db, 'gigs/g1/expenses/x1')))
  })

  it('expenses must be well formed and signed by the manager', async () => {
    const db = as('manager@example.com')
    await assertFails(setDoc(doc(db, 'gigs/g1/expenses/x'), { ...expense(), kind: 'bribes' }))
    await assertFails(setDoc(doc(db, 'gigs/g1/expenses/x'), { ...expense(), amount: 0 }))
    await assertFails(setDoc(doc(db, 'gigs/g1/expenses/x'), { ...expense(), amount: -5 }))
    await assertFails(setDoc(doc(db, 'gigs/g1/expenses/x'), { ...expense(), amount: '600' }))
    await assertFails(setDoc(doc(db, 'gigs/g1/expenses/x'), { ...expense(), description: 'x'.repeat(121) }))
    await assertFails(setDoc(doc(db, 'gigs/g1/expenses/x'), { ...expense(), by: 'someone@example.com' }))
    await assertFails(setDoc(doc(db, 'gigs/g1/expenses/x'), { ...expense(), extra: true }))
  })

  it('singers read their pay and paid flag but cannot set them', async () => {
    const manager = as('manager@example.com')
    await assertSucceeds(updateDoc(doc(manager, 'gigs/g1'), { money: { fee: 3100, perSinger: 300, payManual: false, paidOut: {} } }))
    await assertSucceeds(updateDoc(doc(manager, 'gigs/g1'), { 'money.paidOut.ana': '2026-10-04' }))
    const member = as('member@example.com')
    const snap = await assertSucceeds(getDoc(doc(member, 'gigs/g1')))
    expect(snap.data()?.money.paidOut.ana).toBe('2026-10-04')
    await assertFails(updateDoc(doc(member, 'gigs/g1'), { 'money.perSinger': 900 }))
    await assertFails(updateDoc(doc(member, 'gigs/g1'), { 'money.paidOut.ben': '2026-10-04' }))
  })
})

describe('rehearsals', () => {
  const rehearsal = { date: '2026-10-04', start: '2:00pm', end: '5:00pm', place: 'Studio B', address: '', gigs: [], notes: 'Setup at 1:30pm', createdBy: 'joseph@example.com' }
  const reply = (value: string, by = 'member@example.com') => ({ answer: value, by, at: serverTimestamp() })

  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'users/joseph@example.com'), { name: 'Joseph', role: 'member', duties: ['scheduler'] })
      await setDoc(doc(db, 'users/assistant@example.com'), { name: 'Assistant', role: 'assistant' })
      await setDoc(doc(db, 'rehearsals/r1'), rehearsal)
    })
  })

  it('the scheduler books, moves and cancels rehearsals without being a manager', async () => {
    const db = as('joseph@example.com')
    await assertSucceeds(setDoc(doc(db, 'rehearsals/r2'), { ...rehearsal, gigs: ['g1'] }))
    await assertSucceeds(updateDoc(doc(db, 'rehearsals/r1'), { start: '3:00pm', place: "Joseph's place" }))
    await assertSucceeds(deleteDoc(doc(db, 'rehearsals/r2')))
    await assertFails(updateDoc(doc(db, 'gigs/g1'), { money: { fee: 1 } }))
  })

  it('managers can book rehearsals too', async () => {
    await assertSucceeds(setDoc(doc(as('manager@example.com'), 'rehearsals/r3'), rehearsal))
  })

  it('other singers read rehearsals but cannot book or change them', async () => {
    const db = as('member@example.com')
    await assertSucceeds(getDoc(doc(db, 'rehearsals/r1')))
    await assertFails(setDoc(doc(db, 'rehearsals/r4'), rehearsal))
    await assertFails(updateDoc(doc(db, 'rehearsals/r1'), { place: 'Elsewhere' }))
    await assertFails(deleteDoc(doc(db, 'rehearsals/r1')))
    await assertFails(getDoc(doc(as('stranger@example.com'), 'rehearsals/r1')))
  })

  it('a rehearsal must match its shape', async () => {
    const db = as('joseph@example.com')
    await assertFails(setDoc(doc(db, 'rehearsals/bad1'), { ...rehearsal, date: 'Sunday' }))
    await assertFails(setDoc(doc(db, 'rehearsals/bad2'), { ...rehearsal, gigs: 'g1' }))
    await assertFails(setDoc(doc(db, 'rehearsals/bad3'), { ...rehearsal, extra: true }))
    await assertFails(setDoc(doc(db, 'rehearsals/bad4'), { ...rehearsal, notes: 'x'.repeat(2001) }))
    await assertFails(setDoc(doc(db, 'rehearsals/bad5'), { ...rehearsal, gigs: Array.from({ length: 11 }, (_, i) => `g${i}`) }))
  })

  it('any singer says whether they can make it, signed as themselves', async () => {
    const db = as('member@example.com')
    await assertSucceeds(setDoc(doc(db, 'rehearsals/r1/replies/kyle'), reply('no')))
    await assertSucceeds(setDoc(doc(db, 'rehearsals/r1/replies/kyle'), reply('yes')))
    await assertSucceeds(getDocs(collection(db, 'rehearsals/r1/replies')))
    await assertSucceeds(deleteDoc(doc(db, 'rehearsals/r1/replies/kyle')))
    await assertFails(setDoc(doc(db, 'rehearsals/r1/replies/kyle'), reply('no', 'admin@example.com')))
    await assertFails(setDoc(doc(db, 'rehearsals/r1/replies/kyle'), reply('maybe')))
    await assertFails(setDoc(doc(db, 'rehearsals/r1/replies/kyle'), { answer: 'no', by: 'member@example.com', at: 0 }))
    await assertFails(setDoc(doc(as('stranger@example.com'), 'rehearsals/r1/replies/kyle'), reply('no', 'stranger@example.com')))
    await assertFails(setDoc(doc(as('assistant@example.com'), 'rehearsals/r1/replies/kyle'), reply('no', 'assistant@example.com')))
    await assertFails(setDoc(doc(as('assistant@example.com'), 'rehearsals/r5'), rehearsal))
  })

  it('only admins hand out the scheduler duty, and only known duties', async () => {
    await assertSucceeds(updateDoc(doc(as('admin@example.com'), 'users/member@example.com'), { duties: ['scheduler'] }))
    await assertFails(updateDoc(doc(as('admin@example.com'), 'users/member@example.com'), { duties: ['treasurer'] }))
    await assertFails(updateDoc(doc(as('admin@example.com'), 'users/member@example.com'), { duties: 'scheduler' }))
    await assertFails(updateDoc(doc(as('manager@example.com'), 'users/member@example.com'), { duties: ['scheduler'] }))
    await assertFails(updateDoc(doc(as('member@example.com'), 'users/member@example.com'), { duties: ['scheduler'] }))
  })
})

describe('the assistant registers gig requests', () => {
  const ASSISTANT = 'assistant@example.com'
  const directory = { gigs: [], venues: [], presenters: [], people: [{ id: 'kyle', name: 'Kyle', status: 'active' as const, part: 'Bass', phone: '', emails: [] }] }
  const plan = (fields: Record<string, unknown> = {}, by = ASSISTANT) => {
    const { request, errors } = readRequest({ name: 'Tree Gala', dates: ['2026-12-05', '2026-12-12'], venue: 'Glass Hall', presenter: { name: 'Pat Lee', email: 'pat@example.com' }, fee: 3000, perSinger: 300, ...fields })
    if (!request) throw new Error(errors.join('; '))
    return planRequest(request, directory, by, 1)
  }
  function commit(db: ReturnType<typeof as>, p: RequestPlan, change: (path: string, data: Record<string, unknown>) => Record<string, unknown> | null = (_, d) => d) {
    const batch = writeBatch(db as unknown as Firestore)
    for (const w of p.writes) {
      const data = change(w.path, w.data)
      if (data) batch.set(doc(db, w.path), w.stamped ? { ...data, createdAt: serverTimestamp() } : data)
    }
    for (const e of p.events) batch.set(doc(collection(db, 'events')), { gig: p.id, ...e, by: ASSISTANT, at: serverTimestamp() })
    return batch.commit()
  }

  beforeEach(async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), `users/${ASSISTANT}`), { name: 'Robin', role: 'assistant' }))
  })

  it('admins can give an address the Assistant role', async () => {
    await assertSucceeds(setDoc(doc(as('admin@example.com'), 'users/helper@example.com'), { name: 'Helper', role: 'assistant' }))
  })

  it('creates a tentative gig with its new venue, presenter and to-dos in one write', async () => {
    const db = as(ASSISTANT)
    const p = plan()
    await assertSucceeds(commit(db, p))
    await assertSucceeds(getDoc(doc(db, `gigs/${p.id}`)))
    await assertSucceeds(getDocs(collection(db, 'people')))
  })

  it('can ask the band when it creates the gig', async () => {
    await assertSucceeds(commit(as(ASSISTANT), plan({ ask: true })))
  })

  it('must leave a to-do for the managers', async () => {
    await assertFails(commit(as(ASSISTANT), plan(), (path, d) => (path.startsWith('tasks/request-') ? null : d)))
  })

  it('cannot skip past tentative, record money received or sign as someone else', async () => {
    const db = as(ASSISTANT)
    const gig = (edit: Record<string, unknown>) => (path: string, d: Record<string, unknown>) => (path.startsWith('gigs/') ? { ...d, ...edit } : d)
    await assertFails(commit(db, plan(), gig({ stage: 'confirmed' })))
    await assertFails(commit(db, plan(), gig({ contract: 'signed' })))
    await assertFails(commit(db, plan(), gig({ money: { fee: 3000, deposit: 0, paid: 3000, merch: 0 } })))
    await assertFails(commit(db, plan(), gig({ performers: ['kyle'] })))
    await assertFails(commit(db, plan({}, 'manager@example.com')))
  })

  it('cannot reuse an old to-do to skip a new one', async () => {
    const db = as(ASSISTANT)
    const p = plan()
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), `tasks/request-${p.id}`), { kind: 'request', target: p.id, open: false }))
    await assertFails(commit(db, p, (path, d) => (path.startsWith('tasks/request-') ? null : d)))
  })

  it('cannot add malformed details or a to-do with nothing behind it', async () => {
    const db = as(ASSISTANT)
    const gig = (edit: Record<string, unknown>) => (path: string, d: Record<string, unknown>) => (path.startsWith('gigs/') ? { ...d, ...edit } : d)
    await assertFails(commit(db, plan(), gig({ money: { fee: -5, deposit: 0, paid: 0, merch: 0, perSinger: 0 } })))
    await assertFails(commit(db, plan(), gig({ notes: 'x'.repeat(2001) })))
    await assertFails(commit(db, plan(), gig({ dateOptions: ['2026-12-05', 'soon'] })))
    await assertFails(setDoc(doc(db, 'tasks/venue-nowhere'), { kind: 'venue', target: 'nowhere', title: 'x', open: true, createdBy: ASSISTANT, createdAt: serverTimestamp() }))
    await assertFails(setDoc(doc(db, 'venues/Not A Slug'), { name: 'Hall', address: '' }))
  })

  it('cannot change or delete anything that already exists', async () => {
    const db = as(ASSISTANT)
    await assertFails(updateDoc(doc(db, 'gigs/g1'), { notes: 'Changed' }))
    await assertFails(deleteDoc(doc(db, 'gigs/g1')))
    await assertFails(setDoc(doc(db, 'gigs/g1/answers/kyle'), { answer: 'yes', by: ASSISTANT, at: serverTimestamp() }))
    await assertFails(setDoc(doc(db, 'people/kyle'), { name: 'Kyle', status: 'active', part: 'Bass', phone: '', emails: [] }))
    await assertFails(setDoc(doc(db, 'payments/p1'), { gig: 'g1', amount: 100 }))
    await assertFails(setDoc(doc(db, 'users/new@example.com'), { name: 'New', role: 'admin' }))
    await assertFails(setDoc(doc(db, 'tasks/request-g1'), { kind: 'request', target: 'g1', title: 'x', open: true, createdBy: ASSISTANT, createdAt: serverTimestamp() }))
  })

  it('cannot fill in a venue address or close a to-do', async () => {
    const db = as(ASSISTANT)
    const p = plan()
    await assertSucceeds(commit(db, p))
    await assertFails(updateDoc(doc(db, 'venues/glass-hall'), { address: '1 Main St' }))
    await assertFails(updateDoc(doc(db, `tasks/request-${p.id}`), { open: false }))
  })
})

describe('booking inquiries', () => {
  const inquiry = { name: 'Jane Doe', email: 'jane@example.com', message: 'Our wedding', status: 'new', source: 'website' }
  const handled = (status: string, by = 'manager@example.com') => ({ status, handledBy: by, handledAt: serverTimestamp() })

  beforeEach(() =>
    env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'inquiries/i1'), inquiry)
    }),
  )

  it('only managers read them', async () => {
    await assertSucceeds(getDoc(doc(as('manager@example.com'), 'inquiries/i1')))
    await assertSucceeds(getDocs(collection(as(OWNER), 'inquiries')))
    await assertFails(getDoc(doc(as('member@example.com'), 'inquiries/i1')))
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'inquiries/i1')))
  })

  it('nobody creates or deletes one from the app; the booking form script writes them', async () => {
    await assertFails(setDoc(doc(as('manager@example.com'), 'inquiries/i2'), inquiry))
    await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'inquiries/i2'), inquiry))
    await assertFails(deleteDoc(doc(as('manager@example.com'), 'inquiries/i1')))
  })

  it('a manager moves one along and signs it', async () => {
    const db = as('manager@example.com')
    await assertSucceeds(updateDoc(doc(db, 'inquiries/i1'), handled('replied')))
    await assertSucceeds(updateDoc(doc(db, 'inquiries/i1'), { ...handled('booked'), gig: '2026-10-01-wedding' }))
    await assertFails(updateDoc(doc(db, 'inquiries/i1'), handled('lost')))
    await assertFails(updateDoc(doc(db, 'inquiries/i1'), handled('replied', 'admin@example.com')))
    await assertFails(updateDoc(doc(db, 'inquiries/i1'), { ...handled('replied'), message: 'edited' }))
    await assertFails(updateDoc(doc(as('member@example.com'), 'inquiries/i1'), handled('spam', 'member@example.com')))
  })
})

describe('push tokens', () => {
  const token = (email: string, topics: string[] = []) => ({ token: 'fcm-token', email, topics, device: 'Chrome on Android', updatedAt: serverTimestamp() })

  it('a member saves their own device, for member topics only', async () => {
    const db = as('member@example.com')
    await assertSucceeds(setDoc(doc(db, 'pushTokens/t1'), token('member@example.com')))
    await assertFails(setDoc(doc(db, 'pushTokens/t2'), token('manager@example.com')))
    await assertFails(setDoc(doc(db, 'pushTokens/t3'), token('member@example.com', ['inquiries'])))
    await assertFails(setDoc(doc(db, 'pushTokens/t4'), { ...token('member@example.com'), extra: 1 }))
  })

  it('managers get inquiry notifications', async () => {
    await assertSucceeds(setDoc(doc(as('manager@example.com'), 'pushTokens/t1'), token('manager@example.com', ['inquiries'])))
    await assertSucceeds(setDoc(doc(as(OWNER), 'pushTokens/t2'), token(OWNER, ['inquiries'])))
  })

  it('nobody reads tokens, and only the owner deletes theirs', async () => {
    await assertSucceeds(setDoc(doc(as('manager@example.com'), 'pushTokens/t1'), token('manager@example.com', ['inquiries'])))
    await assertFails(getDoc(doc(as('manager@example.com'), 'pushTokens/t1')))
    await assertFails(getDocs(collection(as('admin@example.com'), 'pushTokens')))
    await assertFails(deleteDoc(doc(as('member@example.com'), 'pushTokens/t1')))
    await assertSucceeds(deleteDoc(doc(as('manager@example.com'), 'pushTokens/t1')))
  })

  it('strangers save nothing', async () => {
    await assertFails(setDoc(doc(as('stranger@example.com'), 'pushTokens/t1'), token('stranger@example.com')))
  })
})
