<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { orderBy, where } from 'firebase/firestore'
import AppHeader from '@/components/AppHeader.vue'
import DateBlock from '@/components/DateBlock.vue'
import GigFacts from '@/components/GigFacts.vue'
import PollCard from '@/components/PollCard.vue'
import RehearsalAsk from '@/components/RehearsalAsk.vue'
import RequestCard from '@/components/RequestCard.vue'
import TaskRow from '@/components/TaskRow.vue'
import type { Task } from '@/lib/directory'
import { today, useCollection } from '@/lib/db'
import type { Gig, GigRow } from '@/lib/gigs'
import type { PersonRecord } from '@/lib/people'
import { myPersonId, useMyAnswers } from '@/lib/poll'
import { needsRehearsalAnswer } from '@/lib/rehearsals'
import { useAuth } from '@/stores/auth'

const auth = useAuth()
const now = today()
const { rows: gigs, error } = useCollection<Gig>('gigs', where('date', '>=', now), orderBy('date'))
const { rows: people, ready: peopleReady } = useCollection<PersonRecord>('people')
const me = computed(() => myPersonId(auth.access?.person, auth.email, people.value))
const nameOf = (id: string) => people.value.find((p) => p.id === id)?.name ?? id
const live = computed(() => gigs.value.filter((g) => g.stage !== 'cancelled'))
const polls = computed(() => live.value.filter((g) => g.call && !g.call.abandoned && g.call.asked.includes(me.value)))
const mine = useMyAnswers(() => polls.value.map((g) => g.id), () => me.value)
const loading = computed(() => !peopleReady.value || polls.value.some((g) => !(g.id in mine.value)))
const needsMe = computed(() => polls.value.filter((g) => !mine.value[g.id] || mine.value[g.id] === 'later'))
const booked = computed(() => live.value.filter((g) => g.performers?.includes(me.value)))
const next = computed(() => booked.value[0] as GigRow | undefined)
const later = computed(() => booked.value.slice(1, 6))
const tasks = auth.isManager ? useCollection<Task>('tasks', where('open', '==', true)).rows : computed(() => [] as (Task & { id: string })[])
const rehearsalAsks = computed(() => (auth.isDirector ? live.value.filter((g) => needsRehearsalAnswer(g, now)) : []))
const count = computed(() => needsMe.value.length + tasks.value.length + rehearsalAsks.value.length)
const requests = computed(() => tasks.value.filter((t) => t.kind === 'request'))
const chores = computed(() => tasks.value.filter((t) => t.kind !== 'request'))

function askedBy(g: GigRow) {
  const email = g.call?.openedBy?.toLowerCase() ?? ''
  return people.value.find((p) => p.emails.some((e) => e.toLowerCase() === email))?.name.split(' ')[0] ?? 'the manager'
}

function ago(g: GigRow) {
  const at = g.call?.openedAt ?? 0
  const days = Math.floor((Date.now() - at) / 86400000)
  return !at ? '' : days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`
}
</script>

<template>
  <AppHeader />
  <main class="page home">
    <h1>Hi {{ auth.access?.name?.split(' ')[0] }}</h1>
    <p v-if="error" class="error" role="alert">✕ {{ error }}</p>

    <section class="block">
      <h2 class="eyebrow" :class="{ hot: count }">Needs you{{ count ? ` · ${count}` : '' }}</h2>
      <p v-if="loading" class="muted">Loading…</p>
      <template v-else>
        <PollCard v-for="g in needsMe" :key="g.id" :gig="g" :all-gigs="gigs" :me="me" :name-of="nameOf" :asked-by="askedBy(g)" :ago="ago(g)" />
        <RehearsalAsk v-for="g in rehearsalAsks" :key="`rehearsals-${g.id}`" :gig="g" :people="people" :today="now" />
        <RequestCard v-for="t in requests" :id="t.id" :key="t.id" :task="t" :all-gigs="gigs" />
        <ul v-if="chores.length" class="tasks card">
          <TaskRow v-for="t in chores" :id="t.id" :key="t.id" :task="t" />
        </ul>
        <p v-if="!count" class="clear">You're all caught up.</p>
      </template>
    </section>

    <section v-if="next" class="block">
      <h2 class="eyebrow">Next up</h2>
      <RouterLink :to="`/gigs/${next.id}`" class="next">
        <div class="head">
          <DateBlock :date="next.date" />
          <h3>{{ next.name }}</h3>
        </div>
        <div class="body">
          <GigFacts :gig="next" />
          <p v-if="next.outfit" class="outfit"><span class="label">Outfit</span> {{ next.outfit }}</p>
          <p class="lineup muted">With {{ next.performers.filter((p) => p !== me).map((p) => nameOf(p).split(' ')[0]).join(', ') || 'nobody yet' }}</p>
        </div>
      </RouterLink>
    </section>

    <section v-if="later.length" class="block">
      <h2 class="eyebrow">Coming up</h2>
      <ul class="list">
        <li v-for="g in later" :key="g.id">
          <RouterLink :to="`/gigs/${g.id}`" class="row">
            <DateBlock :date="g.date" />
            <span class="what">
              <strong>{{ g.name }}</strong>
              <span class="muted">{{ [g.time, g.venue].filter(Boolean).join(' · ') }}</span>
            </span>
          </RouterLink>
        </li>
      </ul>
    </section>

    <p v-if="!loading && !next && !needsMe.length" class="muted">
      No gigs on your calendar yet. See every booking under <RouterLink to="/gigs">Gigs</RouterLink>.
    </p>
  </main>
</template>

<style scoped>
.home {
  max-width: 760px;
  display: grid;
  gap: 28px;
}

.home h1 {
  margin: 0;
}

.block {
  display: grid;
  gap: 12px;
}

.eyebrow.hot {
  color: var(--color-warning);
}

.clear {
  margin: 0;
  padding: 18px;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius);
  color: var(--color-text-muted);
}

.tasks {
  list-style: none;
  margin: 0;
  padding: 4px 18px;
}

.next {
  display: grid;
  gap: 16px;
  padding: 18px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-text);
  text-decoration: none;
  transition: border-color 0.15s;
}

.next:hover {
  border-color: var(--color-accent);
  color: var(--color-text);
}

.head {
  display: flex;
  align-items: center;
  gap: 14px;
}

.head h3 {
  margin: 0;
  font-size: 1.25rem;
}

.body {
  display: grid;
  gap: 10px;
  min-width: 0;
  flex: 1;
}


.outfit,
.lineup {
  margin: 0;
}

.label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  margin-right: 8px;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  border-top: 1px solid var(--color-border);
}

.row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 0;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
  text-decoration: none;
}

.row:hover strong {
  color: var(--color-accent-strong);
}

.what {
  display: grid;
  gap: 2px;
  min-width: 0;
}
</style>
