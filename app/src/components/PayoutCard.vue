<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { addDoc, collection, deleteDoc, deleteField, doc, FieldPath, getDocsFromServer, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { day, logEvent, money, today, useCollection } from '@/lib/db'
import { SHARES, SINGER_SEATS, ROUND_TO, expenseKinds, expenseLabels, isManualPay, payout, shareOf, type Expense, type ExpenseKind, type PayoutLine } from '@/lib/payout'
import type { Gig } from '@/lib/gigs'
import { useAuth } from '@/stores/auth'
import { useToast } from '@/stores/toast'

const props = defineProps<{ id: string; gig: Gig; nameOf: (pid: string) => string }>()

const auth = useAuth()
const toast = useToast()
const busy = ref(false)
const { rows: expenses, ready } = useCollection<Expense>(`gigs/${props.id}/expenses`)
const gigRef = () => doc(db, 'gigs', props.id)

const manual = computed(() => isManualPay(props.gig.money))
const result = computed(() =>
  payout({
    fee: props.gig.money?.fee ?? 0,
    expenses: expenses.value,
    performers: props.gig.performers ?? [],
    soundTech: props.gig.soundTech ?? '',
    manualShare: manual.value ? (props.gig.money?.perSinger ?? 0) : null,
  }),
)
const paidOut = computed(() => props.gig.money?.paidOut ?? {})
const payable = computed(() => result.value.lines.filter((l) => l.amount > 0 && (l.person || l.role === 'group')))
const paidCount = computed(() => payable.value.filter((l) => paidOut.value[l.key]).length)
const openSeats = computed(() => result.value.lines.filter((l) => l.role === 'singer' && !l.person).length)
const singerCount = computed(() => result.value.lines.filter((l) => l.role === 'singer').length)

async function syncPay() {
  const spent = await getDocsFromServer(collection(db, 'gigs', props.id, 'expenses'))
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(gigRef())
    const money = (snap.data() as Gig | undefined)?.money
    if (!snap.exists() || isManualPay(money)) return
    const net = (money?.fee ?? 0) - spent.docs.reduce((sum, d) => sum + Math.max(0, Number(d.data().amount) || 0), 0)
    const share = shareOf(net)
    if ((money?.perSinger ?? 0) !== share || money?.payManual !== false) tx.update(snap.ref, { 'money.perSinger': share, 'money.payManual': false })
  })
}

watch(
  [ready, manual, () => result.value.calculated],
  async ([isReady, isManual, calculated]) => {
    if (!isReady || isManual || (props.gig.money?.perSinger ?? 0) === calculated) return
    await toast.run('', syncPay)
  },
  { immediate: true },
)

async function act(done: string, what: string, work: () => Promise<unknown>) {
  busy.value = true
  await toast.run(done, async () => {
    await work()
    await logEvent(props.id, 'money', what, auth.email)
  })
  busy.value = false
}

const dollars = (value: string) => Math.max(0, Math.round((Number(value) || 0) * 100) / 100)

function setFee(value: string) {
  const fee = dollars(value)
  if (fee === (props.gig.money?.fee ?? 0)) return
  return act('Fee saved.', `set the fee to ${money(fee)}`, () => updateDoc(gigRef(), { 'money.fee': fee }))
}

const draft = ref<{ kind: ExpenseKind; description: string; amount: string }>({ kind: 'travel', description: '', amount: '' })

function addExpense() {
  const amount = dollars(draft.value.amount)
  if (!amount) return
  const { kind, description } = draft.value
  return act(`Added ${expenseLabels[kind].toLowerCase()}.`, `added ${expenseLabels[kind].toLowerCase()} ${money(amount)}`, async () => {
    await addDoc(collection(db, 'gigs', props.id, 'expenses'), { kind, description: description.trim().slice(0, 120), amount, by: auth.email, at: serverTimestamp() })
    draft.value = { kind, description: '', amount: '' }
  })
}

function removeExpense(e: Expense & { id: string }) {
  return act(`Removed ${expenseLabels[e.kind].toLowerCase()}.`, `removed ${expenseLabels[e.kind].toLowerCase()} ${money(e.amount)}`, () => deleteDoc(doc(db, 'gigs', props.id, 'expenses', e.id)))
}

const editing = ref(false)
const typed = ref('')

function startEditing() {
  typed.value = String(result.value.share || '')
  editing.value = true
}

function setByHand() {
  const share = dollars(typed.value)
  editing.value = false
  return act('Pay set by hand.', `set pay by hand to ${money(share)}`, () => updateDoc(gigRef(), { 'money.perSinger': share, 'money.payManual': true }))
}

function useCalculated() {
  editing.value = false
  const share = result.value.calculated
  return act('Pay calculated.', `went back to calculated pay, ${money(share)}`, () => updateDoc(gigRef(), { 'money.perSinger': share, 'money.payManual': false }))
}

function markPaid(line: PayoutLine, on: boolean) {
  const who = lineName(line)
  return act(on ? `${who} paid.` : `${who} not paid.`, `${on ? 'paid' : 'unmarked paid for'} ${who}`, () =>
    updateDoc(gigRef(), new FieldPath('money', 'paidOut', line.key), on ? today() : deleteField()),
  )
}

function lineName(line: PayoutLine) {
  if (line.role === 'group') return 'Group account'
  return line.person ? props.nameOf(line.person) : 'Open seat'
}

function lineNote(line: PayoutLine) {
  const r = result.value
  if (line.role === 'sound') return 'Sound tech'
  if (line.role === 'singer') return line.person ? '' : 'Not filled yet'
  if (r.group < 0) return `Shares exceed what's left of the fee by ${money(-r.group)}`
  if (r.manual || singerCount.value > SINGER_SEATS) return "What's left after the shares"
  const parts = [`${money(r.share)} group share`]
  if (r.soundTechShareToGroup && r.share) parts.push(`${money(r.share)} sound tech's share`)
  if (r.remainder) parts.push(`${money(r.remainder)} rounding`)
  return parts.join(' + ')
}
</script>

<template>
  <section class="card payout" aria-labelledby="payout-title">
    <div class="head">
      <h3 id="payout-title">Payout</h3>
      <span v-if="payable.length && result.share" class="chip" :class="paidCount === payable.length ? 'chip--ok' : ''">Paid {{ paidCount }} of {{ payable.length }}</span>
    </div>

    <div class="inputs">
      <label>Fee<input type="number" min="0" step="50" inputmode="decimal" :value="gig.money?.fee || ''" placeholder="0" :disabled="busy" @change="setFee(($event.target as HTMLInputElement).value)" /></label>
    </div>

    <div class="expenses">
      <h4 class="eyebrow">Expenses</h4>
      <ul v-if="expenses.length" class="list">
        <li v-for="e in expenses" :key="e.id">
          <span class="what"><strong>{{ expenseLabels[e.kind] }}</strong><span v-if="e.description" class="muted"> · {{ e.description }}</span></span>
          <span class="amount">{{ money(e.amount) }}</span>
          <button type="button" class="link" :disabled="busy" :aria-label="`Remove ${expenseLabels[e.kind]} ${money(e.amount)}`" @click="removeExpense(e)">Remove</button>
        </li>
      </ul>
      <p v-else-if="ready" class="muted small">None. Expenses come off the fee before the split.</p>
      <form class="add" @submit.prevent="addExpense">
        <label>Kind
          <select v-model="draft.kind">
            <option v-for="k in expenseKinds" :key="k" :value="k">{{ expenseLabels[k] }}</option>
          </select>
        </label>
        <label class="grow">What for<input v-model="draft.description" maxlength="120" placeholder="Van to Banff" /></label>
        <label class="amt">Amount<input v-model="draft.amount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="600" required /></label>
        <button type="submit" class="btn btn--ghost" :disabled="busy">Add</button>
      </form>
    </div>

    <div class="math" aria-live="polite">
      <p>
        {{ money(result.fee) }} fee − {{ money(result.expenses) }} expenses = <strong>{{ money(result.net) }}</strong> to split
      </p>
      <p v-if="result.net > 0">
        ÷ {{ SHARES }} = {{ money(result.exact) }}<template v-if="result.exact !== result.calculated">, rounded down to the nearest {{ money(ROUND_TO) }}</template>: <strong>{{ money(result.calculated) }}</strong> a share
      </p>
      <p v-else-if="result.fee" class="warn">Expenses cover the whole fee. Nothing to split.</p>
    </div>

    <div class="pay">
      <div class="share">
        <span class="eyebrow">Pay per singer</span>
        <strong class="display big">{{ money(result.share) }}</strong>
        <span class="chip" :class="manual ? 'chip--warn' : ''">{{ manual ? 'Set by hand' : 'Calculated' }}</span>
      </div>
      <p v-if="manual" class="small">
        <template v-if="result.calculated !== result.share">The rule would pay {{ money(result.calculated) }}. </template>
        <button type="button" class="link" :disabled="busy" @click="useCalculated">Calculate it instead</button>
      </p>
      <form v-if="editing" class="row" @submit.prevent="setByHand">
        <label class="amt">Pay per singer<input v-model="typed" type="number" min="0" step="25" inputmode="numeric" required /></label>
        <button type="submit" class="btn" :disabled="busy">Save</button>
        <button type="button" class="link" @click="editing = false">Cancel</button>
      </form>
      <button v-else type="button" class="link" @click="startEditing">{{ manual ? 'Change' : 'Set by hand' }}</button>
    </div>

    <ul class="lines">
      <li v-for="line in result.lines" :key="`${line.role}-${line.key}`" :class="{ group: line.role === 'group', open: line.role === 'singer' && !line.person }">
        <label v-if="payable.includes(line)" class="check">
          <input type="checkbox" :checked="!!paidOut[line.key]" :disabled="busy" @change="markPaid(line, ($event.target as HTMLInputElement).checked)" />
          <span class="sr-only">{{ lineName(line) }} paid</span>
        </label>
        <span v-else class="check" aria-hidden="true"></span>
        <span class="who">
          <strong>{{ lineName(line) }}</strong>
          <span v-if="lineNote(line)" class="muted note" :class="{ warn: line.role === 'group' && result.group < 0 }">{{ lineNote(line) }}</span>
          <span v-if="paidOut[line.key]" class="ok note">Paid {{ day(paidOut[line.key] ?? '', { month: 'short', day: 'numeric' }) }}</span>
        </span>
        <span class="amount" :class="{ warn: line.amount < 0 }">{{ money(line.amount) }}</span>
      </li>
    </ul>
    <p v-if="result.soundTechShareToGroup" class="muted small">No sound tech: their share goes to the group. Add one under Who's on it.</p>
    <p v-if="openSeats" class="muted small">{{ openSeats }} of {{ singerCount }} singer seats open. Their shares are held.</p>
    <p v-if="singerCount > SINGER_SEATS" class="warn small">{{ singerCount }} singers, but the split assumes {{ SINGER_SEATS }}. The extra pay comes from the group account.</p>
  </section>
</template>

<style scoped>
.payout {
  display: grid;
  gap: 16px;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.head h3 {
  margin: 0;
}

label {
  display: grid;
  gap: 4px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

label input,
label select {
  font-size: 1rem;
  letter-spacing: normal;
  text-transform: none;
  color: var(--color-text);
  min-width: 0;
}

.inputs {
  max-width: 200px;
}

.expenses {
  display: grid;
  gap: 8px;
}

.list,
.lines {
  list-style: none;
  margin: 0;
  padding: 0;
}

.list li {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border);
}

.what {
  flex: 1 1 160px;
  min-width: 0;
}

.amount {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  text-align: right;
}

.add {
  display: grid;
  grid-template-columns: minmax(110px, 1fr) minmax(0, 2fr) minmax(90px, 1fr) auto;
  align-items: end;
  gap: 8px;
}

.add .btn {
  min-height: 42px;
  padding: 0.4em 1em;
}

@media (max-width: 560px) {
  .add {
    grid-template-columns: 1fr 1fr;
  }

  .add .grow {
    grid-column: 1 / -1;
    grid-row: 1;
  }

  .add .btn {
    grid-column: 1 / -1;
  }
}

.math {
  display: grid;
  gap: 2px;
  padding: 12px 14px;
  border-radius: var(--radius);
  background: var(--color-bg);
  font-variant-numeric: tabular-nums;
}

.math p {
  margin: 0;
}

.pay {
  display: grid;
  gap: 6px;
  justify-items: start;
}

.share {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px 12px;
}

.big {
  font-size: 1.8rem;
  color: var(--color-accent-strong);
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 8px;
}

.amt {
  max-width: 160px;
}

.lines li {
  display: grid;
  grid-template-columns: 28px 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--color-border);
}

.lines li.group {
  border-bottom: 0;
  border-top: 2px solid var(--color-accent);
}

.lines li.open .who strong {
  color: var(--color-text-muted);
  font-weight: 600;
}

.check {
  display: flex;
  align-items: center;
  justify-content: center;
}

.check input {
  width: 20px;
  height: 20px;
}

.who {
  display: grid;
  min-width: 0;
}

.note {
  font-size: 0.85rem;
}

.small {
  font-size: 0.85rem;
  margin: 0;
}

.warn {
  color: var(--color-warning);
}
</style>
