import { describe, expect, it } from 'vitest'
import { fuzzyScore, search, usualPartner } from '@/lib/directory'

describe('venue and presenter search', () => {
  const venues = ['Winspear Centre', 'Allard Hall', 'Edmonton Convention Centre', 'Westin Edmonton']

  it('puts prefix matches first, then word starts, then loose letters', () => {
    expect(search('ed', venues)).toEqual(['Edmonton Convention Centre', 'Westin Edmonton'])
    expect(search('wnspr', venues)).toEqual(['Winspear Centre'])
    expect(search('', venues)).toHaveLength(4)
  })

  it('drops options missing a typed letter', () => {
    expect(fuzzyScore('xyz', 'Allard Hall')).toBeNull()
  })

  const gigs = [
    { venue: 'Winspear Centre', contact: { name: 'Pat Lee' }, date: '2025-01-01' },
    { venue: 'Winspear Centre', contact: { name: 'Pat Lee' }, date: '2025-06-01' },
    { venue: 'Winspear Centre', contact: { name: 'Sam Roe' }, date: '2026-01-01' },
    { venue: 'Allard Hall', contact: { name: 'Sam Roe' }, date: '2026-02-01' },
  ]

  it('guesses the presenter most often at a venue', () => {
    expect(usualPartner(gigs, 'venue', 'winspear centre')).toBe('Pat Lee')
    expect(usualPartner(gigs, 'venue', 'Nowhere')).toBe('')
  })

  it('guesses the venue a presenter used most, newest breaking ties', () => {
    expect(usualPartner(gigs, 'presenter', 'Sam Roe')).toBe('Allard Hall')
  })
})
