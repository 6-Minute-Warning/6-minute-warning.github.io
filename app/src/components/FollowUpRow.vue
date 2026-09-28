<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { logEvent } from '@/lib/db'
import { CHASE_DAYS, SNOOZE_DAYS, addDays, draft, dueLabel, followUpTask, mailto, type FollowUp, type GigStep, type Season } from '@/lib/followups'
import { useAuth } from '@/stores/auth'
import { useToast } from '@/stores/toast'

const props = defineProps<{ item: FollowUp; today: string; season?: Season }>()

const auth = useAuth()
const toast = useToast()
const busy = ref(false)
const emailed = ref(false)
const due = computed(() => dueLabel(props.item.due, props.today))
const sender = computed(() => auth.access?.name?.split(' ')[0] ?? '')
const mail = computed(() => draft(props.item, sender.value, props.season))
const doneLabels: Partial<Record<GigStep, string>> = { quote: 'Quote sent', contract: 'Contract sent', chase: 'Chase sent' }
const doneLabel = computed(() => (props.item.step && doneLabels[props.item.step]) || 'Done')
const gigLink = computed(() => (props.item.gig && props.item.reason !== 'season' ? `/gigs/${props.item.gig.id}` : ''))

function mark(fields: Record<string, unknown>) {
  const base = props.item.stored ? {} : { ...followUpTask(props.item, auth.email), createdAt: serverTimestamp() }
  return setDoc(doc(db, 'tasks', props.item.id), { ...base, ...fields }, { merge: true })
}

async function act(message: string, work: () => Promise<unknown>) {
  busy.value = true
  await toast.run(message, work)
  busy.value = false
}

function done() {
  const { step, gig, name } = props.item
  if (gig && step === 'quote')
    return act(`${gig.name} moved to Contracting.`, async () => {
      await updateDoc(doc(db, 'gigs', gig.id), { stage: 'contracting' })
      await logEvent(gig.id, 'followup', `sent the quote to ${name}`, auth.email)
    })
  if (gig && step === 'contract')
    return act(`Contract for ${gig.name} marked sent.`, async () => {
      await updateDoc(doc(db, 'gigs', gig.id), { contract: 'sent' })
      await logEvent(gig.id, 'followup', `sent the contract to ${name}`, auth.email)
    })
  if (step === 'chase') return act(`Chase logged. Back on your list in ${CHASE_DAYS} days.`, () => mark({ open: true, snoozedUntil: addDays(props.today, CHASE_DAYS) }))
  return act(`${name}: done.`, () => mark({ open: false, doneBy: auth.email, doneAt: serverTimestamp() }))
}

function snooze() {
  const until = addDays(props.today, SNOOZE_DAYS)
  return act(`${props.item.name} is snoozed for a week.`, () => mark({ open: true, snoozedUntil: until }))
}
</script>

<template>
  <li class="row">
    <div class="what">
      <span class="who">
        <strong>{{ item.name }}</strong>
        <span class="due" :class="{ late: due.late }">{{ due.text }}</span>
      </span>
      <RouterLink v-if="gigLink" :to="gigLink" class="why">{{ item.why }}</RouterLink>
      <span v-else class="why">{{ item.why }}</span>
      <span v-if="item.step === 'contract'" class="hint muted">Attach the contract PDF before you send.</span>
    </div>
    <span class="buttons">
      <a v-if="item.email" class="mini" :class="{ primary: !emailed }" :href="mailto(item.email, mail)" @click="emailed = true">Email</a>
      <a v-else-if="item.phone" class="mini" :class="{ primary: !emailed }" :href="`tel:${item.phone.replace(/[^0-9+]/g, '')}`" @click="emailed = true">Call</a>
      <span v-else class="muted none">No email or phone on file</span>
      <button type="button" class="mini" :class="{ primary: emailed }" :disabled="busy" @click="done">{{ doneLabel }}</button>
      <button type="button" class="mini" :disabled="busy" @click="snooze">Snooze</button>
    </span>
  </li>
</template>

<style scoped>
.row {
  display: grid;
  gap: 10px;
  padding: 14px 0;
  border-bottom: 1px solid var(--color-border);
}

.row:last-child {
  border-bottom: 0;
}

.what {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.who {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 12px;
}

.due {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.due.late {
  color: var(--color-warning);
}

.why {
  color: var(--color-text);
}

a.why {
  text-decoration: none;
}

a.why:hover {
  color: var(--color-accent-strong);
}

.hint {
  font-size: 0.85rem;
}

.buttons {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.mini {
  text-decoration: none;
  display: inline-flex;
  align-items: center;
}

.mini.primary {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-accent-ink);
}

.none {
  font-size: 0.85rem;
}
</style>
