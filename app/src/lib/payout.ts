import type { Gig } from './gigs'

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
  amount: number
}

export interface Payout {
  fee: number
  expenses: number
  net: number
  exact: number
  calculated: number
  share: number
  manual: boolean
  lines: PayoutLine[]
  group: number
  remainder: number
  soundTechShareToGroup: boolean
}

export interface PayoutInput {
  fee: number
  expenses: Pick<Expense, 'amount'>[]
  performers: string[]
  soundTech: string
  manualShare?: number | null
}

const cents = (dollars: number) => Math.round((Number.isFinite(dollars) ? dollars : 0) * 100)
const dollars = (c: number) => c / 100

/** One share of the net: net / 8, rounded down to the nearest $25, never below zero. */
export function shareOf(net: number): number {
  const step = ROUND_TO * 100
  const c = cents(net)
  return c <= 0 ? 0 : dollars(Math.floor(c / SHARES / step) * step)
}

/** Splits fee minus expenses into six singer lines, a sound tech line and the group account, which takes whatever is left. */
export function payout(input: PayoutInput): Payout {
  const fee = cents(input.fee)
  const spent = input.expenses.reduce((sum, e) => sum + Math.max(0, cents(e.amount)), 0)
  const net = fee - spent
  const calculated = cents(shareOf(dollars(net)))
  const manual = input.manualShare != null && Number.isFinite(input.manualShare) && input.manualShare >= 0
  const share = manual ? cents(input.manualShare as number) : calculated

  const seats = Math.max(SINGER_SEATS, input.performers.length)
  const lines: PayoutLine[] = Array.from({ length: seats }, (_, i) => {
    const person = input.performers[i] ?? ''
    return { key: person || `seat-${i + 1}`, role: 'singer', person, amount: dollars(share) }
  })
  if (input.soundTech) lines.push({ key: input.soundTech, role: 'sound', person: input.soundTech, amount: dollars(share) })

  const group = net - lines.reduce((sum, l) => sum + cents(l.amount), 0)
  lines.push({ key: GROUP, role: 'group', person: '', amount: dollars(group) })

  return {
    fee: dollars(fee),
    expenses: dollars(spent),
    net: dollars(net),
    exact: dollars(Math.max(0, Math.floor(net / SHARES))),
    calculated: dollars(calculated),
    share: dollars(share),
    manual,
    lines,
    group: dollars(group),
    remainder: dollars(group - (input.soundTech ? share : 2 * share)),
    soundTechShareToGroup: !input.soundTech,
  }
}

/** True when a manager typed the pay per singer; gigs from before payouts count as typed if they have a figure. */
export function isManualPay(money: Partial<Gig['money']> | undefined): boolean {
  if (typeof money?.payManual === 'boolean') return money.payManual
  return (money?.perSinger ?? 0) > 0
}
