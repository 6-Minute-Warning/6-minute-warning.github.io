import { describe, expect, it } from 'vitest'
import { GROUP, isManualPay, payout, shareOf } from '@/lib/payout'

const six = ['ana', 'ben', 'cal', 'dee', 'eli', 'fay']
const amounts = (p: ReturnType<typeof payout>) => Object.fromEntries(p.lines.map((l) => [l.key, l.amount]))
const total = (p: ReturnType<typeof payout>) => p.lines.reduce((sum, l) => sum + l.amount, 0)

describe('shareOf', () => {
  it('divides by eight and rounds down to the nearest $25', () => {
    expect(shareOf(2500)).toBe(300)
    expect(shareOf(2400)).toBe(300)
    expect(shareOf(2399.99)).toBe(275)
    expect(shareOf(3200)).toBe(400)
    expect(shareOf(199)).toBe(0)
    expect(shareOf(200)).toBe(25)
  })

  it('never goes below zero', () => {
    expect(shareOf(0)).toBe(0)
    expect(shareOf(-500)).toBe(0)
    expect(shareOf(Number.NaN)).toBe(0)
  })
})

describe('payout', () => {
  it('pays the band calendar example: $3,100 fee, $600 travel and meals', () => {
    const p = payout({ fee: 3100, expenses: [{ amount: 600 }], performers: six, soundTech: 'russ' })
    expect(p.net).toBe(2500)
    expect(p.exact).toBe(312.5)
    expect(p.share).toBe(300)
    expect(p.manual).toBe(false)
    expect(p.lines.filter((l) => l.role === 'singer').map((l) => l.amount)).toEqual([300, 300, 300, 300, 300, 300])
    expect(amounts(p).russ).toBe(300)
    expect(p.group).toBe(400)
    expect(p.remainder).toBe(100)
    expect(total(p)).toBe(2500)
  })

  it('always pays out exactly the net', () => {
    for (const fee of [0, 199, 1234.56, 2000, 2799, 5000]) {
      for (const spent of [0, 10.1, 333, 1999.99]) {
        const p = payout({ fee, expenses: [{ amount: spent }], performers: six, soundTech: 'russ' })
        expect(Math.round(total(p) * 100)).toBe(Math.round((fee - spent) * 100))
      }
    }
  })

  it('adds up several expenses in cents without float drift', () => {
    const p = payout({ fee: 1000, expenses: [{ amount: 0.1 }, { amount: 0.2 }, { amount: 99.7 }], performers: six, soundTech: 'russ' })
    expect(p.expenses).toBe(100)
    expect(p.net).toBe(900)
    expect(p.share).toBe(100)
    expect(p.group).toBe(200)
  })

  it('ignores negative expense amounts', () => {
    expect(payout({ fee: 800, expenses: [{ amount: -200 }], performers: six, soundTech: 'russ' }).net).toBe(800)
  })

  it('pays nothing when expenses eat the fee, and the group carries the loss', () => {
    const zero = payout({ fee: 600, expenses: [{ amount: 600 }], performers: six, soundTech: 'russ' })
    expect(zero.share).toBe(0)
    expect(zero.group).toBe(0)
    const loss = payout({ fee: 500, expenses: [{ amount: 650 }], performers: six, soundTech: 'russ' })
    expect(loss.net).toBe(-150)
    expect(loss.share).toBe(0)
    expect(loss.group).toBe(-150)
  })

  it('gives the group the sound tech share when nobody is on sound', () => {
    const p = payout({ fee: 3100, expenses: [{ amount: 600 }], performers: six, soundTech: '' })
    expect(p.lines.some((l) => l.role === 'sound')).toBe(false)
    expect(p.soundTechShareToGroup).toBe(true)
    expect(p.share).toBe(300)
    expect(p.group).toBe(700)
    expect(p.remainder).toBe(100)
  })

  it('keeps a share for each empty seat until the lineup is full', () => {
    const p = payout({ fee: 3100, expenses: [{ amount: 600 }], performers: ['ana', 'ben'], soundTech: 'russ' })
    const singers = p.lines.filter((l) => l.role === 'singer')
    expect(singers).toHaveLength(6)
    expect(singers.filter((l) => !l.person)).toHaveLength(4)
    expect(singers.every((l) => l.amount === 300)).toBe(true)
    expect(new Set(p.lines.map((l) => l.key)).size).toBe(p.lines.length)
    expect(p.group).toBe(400)
  })

  it('pays a sub the same share as the member they replace', () => {
    const withSub = payout({ fee: 3100, expenses: [{ amount: 600 }], performers: ['ana', 'ben', 'cal', 'dee', 'eli', 'sub-sam'], soundTech: 'russ' })
    expect(amounts(withSub)['sub-sam']).toBe(amounts(withSub).ana)
    expect(withSub.group).toBe(400)
  })

  it('uses a manual share for singers and sound, and the group takes the rest', () => {
    const p = payout({ fee: 3100, expenses: [{ amount: 600 }], performers: six, soundTech: 'russ', manualShare: 250 })
    expect(p.manual).toBe(true)
    expect(p.calculated).toBe(300)
    expect(p.share).toBe(250)
    expect(amounts(p).russ).toBe(250)
    expect(p.group).toBe(750)
  })

  it('shows the group short when a manual share is more than the net allows', () => {
    const p = payout({ fee: 2000, expenses: [], performers: six, soundTech: 'russ', manualShare: 300 })
    expect(p.group).toBe(-100)
    expect(total(p)).toBe(2000)
  })

  it('treats a null manual share as calculated', () => {
    expect(payout({ fee: 3200, expenses: [], performers: six, soundTech: 'russ', manualShare: null }).manual).toBe(false)
  })

  it('pays a seventh singer from the group rather than shrinking everyone', () => {
    const p = payout({ fee: 3200, expenses: [], performers: [...six, 'gus'], soundTech: 'russ' })
    expect(p.lines.filter((l) => l.role === 'singer')).toHaveLength(7)
    expect(p.share).toBe(400)
    expect(p.group).toBe(0)
  })

  it('ends with the group line', () => {
    const p = payout({ fee: 100, expenses: [], performers: [], soundTech: '' })
    expect(p.lines[p.lines.length - 1]).toMatchObject({ key: GROUP, role: 'group' })
  })
})

describe('isManualPay', () => {
  it('reads the flag when it is set', () => {
    expect(isManualPay({ perSinger: 300, payManual: false })).toBe(false)
    expect(isManualPay({ perSinger: 0, payManual: true })).toBe(true)
  })

  it('treats an older gig with a typed pay as manual', () => {
    expect(isManualPay({ perSinger: 300 })).toBe(true)
    expect(isManualPay({})).toBe(false)
    expect(isManualPay(undefined)).toBe(false)
  })
})
