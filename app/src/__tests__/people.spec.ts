import { describe, expect, it } from 'vitest'
import { importWrites, matchName, normalizePerson, parseRole, personId, planImport, pollAsked, rosterGroups, toStatus, workspaceEmail, type ImportedPerson, type PersonRecord } from '@/lib/people'

const row = (over: Partial<ImportedPerson>): ImportedPerson => ({ name: '', status: 'Active', part: '', email: '', phone: '', ...over })

describe('people import', () => {
  it('builds ids and workspace addresses from names', () => {
    expect(personId('Bernard Quilala')).toBe('bernard-quilala')
    expect(personId('Zoë  O’Neil')).toBe('zoe-o-neil')
    expect(workspaceEmail('Jo Tong')).toBe('jo@6minutewarning.com')
    expect(workspaceEmail('Zoë Smith')).toBe('zoe@6minutewarning.com')
  })

  it('maps Notion statuses', () => {
    expect(toStatus('Active')).toBe('active')
    expect(toStatus('Sub')).toBe('sub')
    expect(toStatus('Inactive')).toBe('alumni')
  })

  it('links the Notion email and the workspace address to one active person', () => {
    const plan = planImport([row({ name: 'Jo Tong', email: 'Jo.Tong@Gmail.com' })], {})
    expect(plan.people[0]).toMatchObject({
      id: 'jo-tong',
      record: { name: 'Jo Tong', status: 'active', part: '', phone: '', emails: ['jo.tong@gmail.com', 'jo@6minutewarning.com'], voice: '', jobs: [], covers: [] },
    })
    expect(plan.access.map((a) => [a.email, a.role, a.person, a.isNew])).toEqual([
      ['jo.tong@gmail.com', 'member', 'jo-tong', true],
      ['jo@6minutewarning.com', 'member', 'jo-tong', true],
    ])
  })

  it('does not duplicate an address Notion already holds', () => {
    const plan = planImport([row({ name: 'Brett Ludwig', email: 'brett@6minutewarning.com' })], {})
    expect(plan.people[0]?.record.emails).toEqual(['brett@6minutewarning.com'])
  })

  it('gives a newly linked address the role the person already has', () => {
    const plan = planImport([row({ name: 'Brett Ludwig', email: 'brett@gmail.com' })], { 'brett@6minutewarning.com': 'admin' })
    expect(plan.access.map((a) => [a.email, a.role, a.isNew])).toEqual([
      ['brett@gmail.com', 'admin', true],
      ['brett@6minutewarning.com', 'admin', false],
    ])
  })

  it('keeps existing roles and marks them as not new', () => {
    const plan = planImport([row({ name: 'Brett Ludwig', email: 'brett@6minutewarning.com' })], { 'brett@6minutewarning.com': 'admin' })
    expect(plan.access[0]).toMatchObject({ role: 'admin', isNew: false })
  })

  it('adds subs to the roster without sign-in access or a workspace address', () => {
    const plan = planImport([row({ name: 'Sam Sub', status: 'Sub', email: 'sam@gmail.com' })], {})
    expect(plan.people[0]?.record).toMatchObject({ status: 'sub', emails: ['sam@gmail.com'] })
    expect(plan.access).toEqual([])
  })

  it('never gives the same address to two people', () => {
    const plan = planImport([row({ name: 'Jo Tong', email: 'jo@gmail.com' }), row({ name: 'Jo Smith', email: 'jo.smith@gmail.com' })], {})
    expect(plan.people[1]?.record.emails).toEqual(['jo.smith@gmail.com'])
    expect(plan.skipped).toEqual(["jo@6minutewarning.com already belongs to another person, so it isn't linked to Jo Smith"])
  })

  it('skips rows with no name', () => {
    expect(planImport([row({ name: '  ' })], {}).skipped).toEqual(['A row with no name'])
  })

  it('skips a second person whose name slugifies to an id already taken', () => {
    const plan = planImport([row({ name: 'Jo Ann Smith', email: 'joann@gmail.com' }), row({ name: 'Jo-Ann Smith', email: 'other@gmail.com' })], {})
    expect(plan.people).toHaveLength(1)
    expect(plan.skipped).toEqual(['Jo-Ann Smith has the same id as Jo Ann Smith (both become "jo-ann-smith"); rename one of them in Notion.'])
  })

  it('treats non-string fields in the JSON as empty instead of throwing', () => {
    const bad = { name: 'Bad Row', status: 42, part: null, email: ['not-a-string'], phone: {} } as unknown as ImportedPerson
    expect(() => planImport([bad], {})).not.toThrow()
    const plan = planImport([bad], {})
    expect(plan.people[0]?.record).toMatchObject({ status: 'alumni', part: '', phone: '', emails: [] })
  })

  it('ignores a row that is not an object', () => {
    expect(() => planImport([null, undefined, 'oops'] as unknown[], {})).not.toThrow()
    expect(planImport([null, undefined, 'oops'] as unknown[], {}).skipped).toEqual(['A row with no name', 'A row with no name', 'A row with no name'])
  })

  it('treats an active sound tech or bookkeeper as crew who still signs in', () => {
    const plan = planImport([row({ name: 'Ray Mix', part: 'Sound Technician' }), row({ name: 'Lou Books', part: 'bookkeeper' })], {})
    const byId = Object.fromEntries(plan.people.map((p) => [p.id, p.record]))
    expect(byId['ray-mix']).toMatchObject({ status: 'crew', jobs: ['sound'] })
    expect(byId['lou-books']).toMatchObject({ status: 'crew', jobs: ['bookkeeper'] })
    expect(plan.access.map((a) => a.person)).toContain('lou-books')
  })
})

describe('reading a Notion role', () => {
  it('reads jobs it can trust and leaves the band leader to Roster', () => {
    expect(parseRole('Singer - Music Director - arranger, sings high falsetto and baritone')).toMatchObject({ jobs: ['director'], voice: 'Bari/VP', crew: false })
    expect(parseRole('Singer - bass singer, manages group scheduling')).toMatchObject({ jobs: ['scheduler'], voice: 'Bass' })
    expect(parseRole('Singer - picks the outfits').jobs).toEqual(['wardrobe'])
    const leader = parseRole('Singer - showmanship, band leader, big personality')
    expect(leader.jobs).toEqual([])
    expect(leader.review.join(' ')).toContain('band leader')
  })

  it('never guesses which tenor or which VP part', () => {
    expect(parseRole('Singer - Tenor, classically trained').voice).toBe('')
    expect(parseRole('Singer - beatboxer, ballads').voice).toBe('')
    expect(parseRole('bass / tenor').voice).toBe('')
    expect(parseRole('bass / tenor').review.join(' ')).toContain('bass / tenor')
  })

  it("reads \"<name>'s sub\" with straight or curly apostrophes and flags second thoughts", () => {
    expect(parseRole('tenor / alto voice, Sam’s sub').coverNames).toEqual(['sam'])
    const unsure = parseRole("bass / tenor, lee's sub but should make him bari/bass sub")
    expect(unsure.coverNames).toEqual(['lee'])
    expect(unsure.review.some((r) => r.startsWith('Notion adds'))).toBe(true)
  })

  it('matches first names and nicknames to one person only', () => {
    const people = [
      { id: 'joseph-t', name: 'Joseph Tee' },
      { id: 'lee-v', name: 'Lee Vee' },
      { id: 'lena-w', name: 'Lena Wu' },
    ]
    expect(matchName('lee', people)).toEqual({ id: 'lee-v', name: 'Lee Vee', guessed: false })
    expect(matchName('jo', people)).toEqual({ id: 'joseph-t', name: 'Joseph Tee', guessed: true })
    expect(matchName('le', people)).toBeNull()
    expect(matchName('nobody', people)).toBeNull()
  })
})

describe('import review', () => {
  const rows = [
    row({ name: 'Joseph Tee', part: 'Singer - bass singer, manages group scheduling' }),
    row({ name: 'Lee Vee', part: 'Singer - Tenor' }),
    row({ name: 'Ann Dee', status: 'Sub', part: 'bass, Jo’s sub' }),
    row({ name: 'Kit Cee', status: 'Sub', part: "bass / tenor, lee's sub but should make him bari/bass sub" }),
    row({ name: 'Zed Zee', status: 'Sub', part: "tenor, Quinn's sub" }),
  ]

  it('links covers and explains every guess', () => {
    const plan = planImport(rows, {})
    const get = (id: string) => plan.people.find((p) => p.id === id)!
    expect(get('ann-dee').record.covers).toEqual(['joseph-tee'])
    expect(get('ann-dee').review).toContain('Covers Joseph Tee (read "jo" as Joseph Tee).')
    expect(get('kit-cee').record.covers).toEqual(['lee-vee'])
    expect(get('zed-zee').record.covers).toEqual([])
    expect(get('zed-zee').review.join(' ')).toContain("quinn's sub")
  })

  it('keeps voice, jobs and covers a manager set unless the admin ticks the row', () => {
    const existing: Record<string, Partial<PersonRecord>> = {
      'joseph-tee': { name: 'Joseph Tee', status: 'active', voice: 'T4', jobs: ['scheduler', 'leader'] },
      'ann-dee': { name: 'Ann Dee', status: 'sub', covers: ['joseph-tee'] },
    }
    const plan = planImport(rows, {}, existing)
    const joseph = plan.people.find((p) => p.id === 'joseph-tee')!
    expect(joseph.kept).toEqual(['voice', 'jobs'])
    expect(plan.people.find((p) => p.id === 'ann-dee')!.kept).toEqual([])
    const kept = importWrites(plan).find((w) => w.id === 'joseph-tee')!.data
    expect(kept).not.toHaveProperty('voice')
    expect(kept).not.toHaveProperty('jobs')
    const replaced = importWrites(plan, new Set(['joseph-tee'])).find((w) => w.id === 'joseph-tee')!.data
    expect(replaced).toMatchObject({ voice: 'Bass', jobs: ['scheduler'] })
  })

  it('never blanks a field Notion has nothing for', () => {
    const plan = planImport([row({ name: 'Lee Vee', part: 'Singer - Tenor' })], {}, { 'lee-vee': { name: 'Lee Vee', status: 'active', voice: 'T2', jobs: ['leader'] } })
    expect(plan.people[0]).toMatchObject({ kept: [], record: { voice: 'T2', jobs: ['leader'] } })
  })

  it('says when a status changes', () => {
    const plan = planImport([row({ name: 'Ray Mix', part: 'Sound Technician' })], {}, { 'ray-mix': { name: 'Ray Mix', status: 'active' } })
    expect(plan.people[0]!.review[0]).toBe('Status changes from active to crew.')
  })
})

describe('roster', () => {
  const p = (id: string, over: Partial<PersonRecord>) => normalizePerson({ id, name: id, status: 'active' as const, part: '', phone: '', emails: [], ...over })
  const people = [
    p('bass', { voice: 'Bass' }),
    p('t1', { voice: 'T1' }),
    p('nopart', {}),
    p('bari', { voice: 'Bari/VP', jobs: ['leader'] }),
    p('ray', { status: 'crew', jobs: ['sound'] }),
    p('lou', { status: 'crew', jobs: ['bookkeeper'] }),
    p('sub1', { status: 'sub', covers: ['bass'] }),
    p('sub2', { status: 'sub', covers: ['ray'] }),
    p('sub3', { status: 'sub' }),
    p('sub4', { status: 'sub', covers: ['gone'] }),
    p('gone', { status: 'alumni' }),
  ]

  it('groups the band by voice part with subs nested, then sound, unlinked subs, others and alumni', () => {
    const g = rosterGroups(people)
    expect(g.band.map((r) => r.person.id)).toEqual(['t1', 'bari', 'bass', 'nopart'])
    expect(g.band.find((r) => r.person.id === 'bass')!.subs.map((s) => s.id)).toEqual(['sub1'])
    expect(g.sound.map((r) => [r.person.id, r.subs.map((s) => s.id)])).toEqual([['ray', ['sub2']]])
    expect(g.unlinked.map((s) => s.id)).toEqual(['sub3', 'sub4'])
    expect(g.others.map((s) => s.id)).toEqual(['lou'])
    expect(g.alumni.map((s) => s.id)).toEqual(['gone'])
  })

  it('asks every active singer and the sound tech, never the bookkeeper or subs', () => {
    expect(pollAsked(people).ids.sort()).toEqual(['bari', 'bass', 'nopart', 'ray', 't1'])
  })
})
