import type { Gig } from './gigs'
import { voiceParts } from './people'

export const SHARES = 8
export const SINGER_SEATS = 6
export const ROUND_TO = 25
export const GROUP = 'group'

export const expenseKinds = ['travel', 'meals', 'gear', 'hotel', 'other'] as const
export type ExpenseKind = (typeof expenseKinds)[number]

export const expenseLabels: Record<ExpenseKind, string> = {
  travel: 'Travel',
  meals: 'Meals',
  gear: 'Gear rental',
  hotel: 'Hotel',
  other: 'Other',
}

export interface Expense {
  kind: ExpenseKind
  description: string
  amount: number
}

export interface PayoutLine {
  key: string
  role: 'singer' | 'sound' | 'group'
  person: string
  voice: string
  amount: number
}

export interface Payout {
  fee: number
  expenses: number
  net: number
  divisor: number
  exact: number
  calculated: number
  share: number
  manual: boolean
  lines: PayoutLine[]
  group: number
  remainder: number
  openSeats: number
}

export interface PayoutInput {
  fee: number
  expenses: Pick<Expense, 'amount'>[]
  performers: string[]
  soundTech: string
  manualShare?: number | null
  voiceOf?: (person: string) => string
  final?: boolean
}

const cents = (dollars: number) => Math.round((Number.isFinite(dollars) ? dollars : 0) * 100)
const dollars = (c: number) => c / 100

/** One share of the net: net / divisor (8 for six singers, sound and the group), rounded down to the nearest $25, never below zero. */
export function shareOf(net: number, divisor = SHARES): number {
  const step = ROUND_TO * 100
  const c = cents(net)
  return c <= 0 ? 0 : dollars(Math.floor(c / divisor / step) * step)
}

/** Voice parts still missing from the booked singers, in seat order. */
export function openVoices(filled: string[]): string[] {
  const left = [...voiceParts] as string[]
  for (const v of filled) {
    const i = left.indexOf(v)
    if (i >= 0) left.splice(i, 1)
  }
  return left
}

/** Six singer seats, a sound seat and the group. Open seats hold their share until the gig is done; after that the split is by who played. */
export function payout(input: PayoutInput): Payout {
  const voiceOf = input.voiceOf ?? (() => '')
  const fee = cents(input.fee)
  const spent = input.expenses.reduce((sum, e) => sum + Math.max(0, cents(e.amount)), 0)
  const net = fee - spent
  const singers = input.performers
  const people = singers.length + (input.soundTech ? 1 : 0)
  const divisor = input.final ? Math.max(1, people) + 1 : Math.max(SINGER_SEATS, singers.length) + 2
  const calculated = cents(shareOf(dollars(net), divisor))
  const manual = input.manualShare != null && Number.isFinite(input.manualShare) && input.manualShare >= 0
  const share = manual ? cents(input.manualShare as number) : calculated

  const missing = openVoices(singers.map(voiceOf))
  const openSinger = input.final ? 0 : Math.max(0, SINGER_SEATS - singers.length)
  const lines: PayoutLine[] = [
    ...singers.map((person) => ({ key: person, role: 'singer' as const, person, voice: voiceOf(person), amount: dollars(share) })),
    ...Array.from({ length: openSinger }, (_, i) => ({ key: `seat-${i + 1}`, role: 'singer' as const, person: '', voice: missing[i] ?? '', amount: dollars(share) })),
  ]
  if (input.soundTech) lines.push({ key: input.soundTech, role: 'sound', person: input.soundTech, voice: 'Sound', amount: dollars(share) })
  else if (!input.final) lines.push({ key: 'seat-sound', role: 'sound', person: '', voice: 'Sound', amount: dollars(share) })

  const group = net - lines.reduce((sum, l) => sum + cents(l.amount), 0)
  lines.push({ key: GROUP, role: 'group', person: '', voice: '', amount: dollars(group) })

  return {
    fee: dollars(fee),
    expenses: dollars(spent),
    net: dollars(net),
    divisor,
    exact: dollars(Math.max(0, Math.floor(net / divisor))),
    calculated: dollars(calculated),
    share: dollars(share),
    manual,
    lines,
    group: dollars(group),
    remainder: dollars(group - share),
    openSeats: lines.filter((l) => l.role !== 'group' && !l.person).length,
  }
}

/** True when a manager typed the pay per singer; gigs from before payouts count as typed if they have a figure. */
export function isManualPay(money: Partial<Gig['money']> | undefined): boolean {
  if (typeof money?.payManual === 'boolean') return money.payManual
  return (money?.perSinger ?? 0) > 0
}
