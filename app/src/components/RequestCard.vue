<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { doc, getDoc, onSnapshot, serverTimestamp, updateDoc, type Timestamp } from 'firebase/firestore'
import DateBlock from '@/components/DateBlock.vue'
import GigFacts from '@/components/GigFacts.vue'
import { db } from '@/lib/firebase'
import { day, money } from '@/lib/db'
import type { Task } from '@/lib/directory'
import type { Gig, GigRow } from '@/lib/gigs'
import { useAuth } from '@/stores/auth'
import { useToast } from '@/stores/toast'

const props = defineProps<{ id: string; task: Task & { createdAt?: Timestamp }; allGigs: GigRow[] }>()

const auth = useAuth()
const toast = useToast()
const gig = ref<Gig | null>(null)
const loaded = ref(false)
const failed = ref('')
const from = ref('')
const busy = ref(false)

const stop = onSnapshot(
  doc(db, 'gigs', props.task.target),
  (snap) => {
    gig.value = snap.exists() ? (snap.data() as Gig) : null
    loaded.value = true
  },
  (e) => (failed.value = e.message),
)
onUnmounted(stop)

getDoc(doc(db, 'users', props.task.createdBy))
  .then((snap) => (from.value = snap.exists() ? String(snap.data().name ?? '') : ''))
  .catch(() => {})

const short = (date: string) => day(date, { weekday: 'short', month: 'short', day: 'numeric' })
const ago = computed(() => {
  const at = props.task.createdAt?.toMillis()
  if (!at) return ''
  const hours = Math.floor((Date.now() - at) / 3600000)
  return hours < 1 ? 'just now' : hours < 24 ? `${hours}h ago` : hours < 48 ? 'yesterday' : `${Math.floor(hours / 24)} days ago`
})
const otherDates = computed(() => (gig.value?.dateOptions ?? []).filter((d) => d !== gig.value?.date))
const sameDay = computed(() => {
  const days = new Set([gig.value?.date, ...otherDates.value])
  return props.allGigs.filter((g) => g.id !== props.task.target && g.stage !== 'cancelled' && days.has(g.date))
})
const presenter = computed(() => {
  const c = gig.value?.contact
  return c?.name ? [c.name, c.email, c.phone].filter(Boolean).join(' · ') : ''
})

async function close(message: string) {
  busy.value = true
  await toast.run(message, () => updateDoc(doc(db, 'tasks', props.id), { open: false, doneBy: auth.email, doneAt: serverTimestamp() }))
  busy.value = false
}
</script>

<template>
  <article class="request">
    <p class="eyebrow">Gig request from {{ from || 'the assistant' }}<template v-if="ago"> · {{ ago }}</template></p>

    <template v-if="gig">
      <header class="top">
        <DateBlock :date="gig.date" />
        <h3><RouterLink :to="`/gigs/${task.target}`">{{ gig.name }}</RouterLink></h3>
      </header>

      <GigFacts :gig="gig" />

      <dl class="more">
        <div v-if="otherDates.length">
          <dt>Also</dt>
          <dd>{{ otherDates.map(short).join(', ') }}</dd>
        </div>
        <div v-if="presenter">
          <dt>Contact</dt>
          <dd>{{ presenter }}</dd>
        </div>
        <div v-if="gig.money?.fee">
          <dt>Fee</dt>
          <dd>{{ money(gig.money.fee) }}</dd>
        </div>
        <div>
          <dt>Poll</dt>
          <dd>{{ gig.call ? `Asked ${gig.call.asked.length} ${gig.call.asked.length === 1 ? 'singer' : 'singers'}` : 'Not asked yet' }}</dd>
        </div>
        <div v-if="sameDay.length" class="clash">
          <dt>Heads up</dt>
          <dd>
            Already booked:
            <template v-for="(g, i) in sameDay" :key="g.id">{{ i ? ', ' : '' }}<strong>{{ g.name }}</strong> ({{ short(g.date) }})</template>
          </dd>
        </div>
      </dl>

      <div class="actions">
        <RouterLink :to="`/gigs/${task.target}`" class="btn">Open gig</RouterLink>
        <button type="button" class="btn btn--ghost" :disabled="busy" @click="close('Checked.')">Mark checked</button>
      </div>
    </template>

    <p v-else-if="failed" class="error" role="alert">✕ Couldn't load this gig: {{ failed }}</p>

    <template v-else-if="loaded">
      <p class="gone muted">This gig was deleted.</p>
      <div class="actions">
        <button type="button" class="btn btn--ghost" :disabled="busy" @click="close('Dismissed.')">Dismiss</button>
      </div>
    </template>
  </article>
</template>

<style scoped>
.request {
  display: grid;
  gap: 14px;
  padding: 18px;
  border: 1px solid var(--color-accent);
  border-radius: var(--radius);
  background: var(--color-surface);
}

.top {
  display: flex;
  gap: 14px;
  align-items: center;
}

.top h3 {
  margin: 0;
  font-size: 1.25rem;
  min-width: 0;
}

.top a {
  color: var(--color-text);
  text-decoration: none;
}

.more {
  display: grid;
  gap: 8px;
  margin: 0;
}

.more > div {
  display: grid;
  grid-template-columns: 76px 1fr;
  gap: 12px;
  align-items: baseline;
}

dt {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

dd {
  margin: 0;
  min-width: 0;
  overflow-wrap: anywhere;
}

.clash dt,
.clash dd {
  color: var(--color-warning);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.actions .btn {
  flex: 1 1 140px;
}

.gone {
  margin: 0;
}
</style>
