import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore'

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
