import { describe, expect, it } from 'vitest'
import { balance, gigId, isUpcoming, planGigImport, toContract, toStage } from '@/lib/gigs'

describe('gig helpers', () => {
  it('builds ids from date and name', () => {
    expect(gigId('Riverbend Concert Series', '2026-10-03')).toBe('2026-10-03-riverbend-concert-series')
    expect(gigId('Café Olé!', '')).toBe('undated-cafe-ole')
  })

  it('maps Notion statuses to stages', () => {
    expect(toStage('Confirmed')).toBe('confirmed')
    expect(toStage('Contracting')).toBe('contracting')
    expect(toStage('Done')).toBe('done')
    expect(toStage('Cancelled')).toBe('cancelled')
    expect(toStage('')).toBe('tentative')
  })

  it('maps contract states', () => {
    expect(toContract('Signed')).toBe('signed')
    expect(toContract('Awaiting Signature')).toBe('sent')
    expect(toContract('Partially Signed')).toBe('drafting')
    expect(toContract('')).toBe('none')
  })

  it('counts what is still owed', () => {
    expect(balance({ money: { fee: 3200, deposit: 1600, paid: 1600, merch: 0 } })).toBe(1600)
    expect(balance({ money: { fee: 1000, deposit: 0, paid: 1200, merch: 0 } })).toBe(0)
  })

  it('treats cancelled and past gigs as not upcoming', () => {
    expect(isUpcoming({ date: '2026-10-03', stage: 'confirmed' }, '2026-09-21')).toBe(true)
    expect(isUpcoming({ date: '2026-09-21', stage: 'confirmed' }, '2026-09-21')).toBe(true)
    expect(isUpcoming({ date: '2026-09-20', stage: 'confirmed' }, '2026-09-21')).toBe(false)
    expect(isUpcoming({ date: '2026-12-01', stage: 'cancelled' }, '2026-09-21')).toBe(false)
  })
})

describe('gig import', () => {
  const row = (over: Record<string, unknown> = {}) => ({ name: 'Sample gig', date: '2026-10-03', status: 'Confirmed', ...over })

  it('maps a Notion row into a gig', () => {
    const { gigs } = planGigImport([
      row({ time: '7:30 p.m.', venue: 'Old Church', fee: 3200, deposit: 1600, paid: 1600, contactName: 'Pat', contactEmail: 'pat@example.com', contractStatus: 'Signed' }),
    ])
    expect(gigs[0]).toEqual({
      id: '2026-10-03-sample-gig',
      gig: {
        name: 'Sample gig',
        date: '2026-10-03',
        time: '7:30 p.m.',
        venue: 'Old Church',
        stage: 'confirmed',
        notes: '',
        contact: { name: 'Pat', email: 'pat@example.com', phone: '' },
        money: { fee: 3200, deposit: 1600, paid: 1600, merch: 0 },
        contract: 'signed',
        performers: [],
        soundTech: '',
      },
    })
  })

  it('ignores junk values instead of failing', () => {
    const { gigs } = planGigImport([row({ time: 42, fee: 'lots', date: 'someday', notes: null })])
    expect(gigs[0]?.gig).toMatchObject({ time: '', date: '', notes: '', money: { fee: 0 } })
    expect(gigs[0]?.id).toBe('undated-sample-gig')
  })

  it('skips nameless rows and repeats', () => {
    const { gigs, skipped } = planGigImport([row(), row(), row({ name: '' })])
    expect(gigs).toHaveLength(1)
    expect(skipped).toEqual(['Sample gig on 2026-10-03 appears twice; the first one wins', 'A row with no name'])
  })
})
