<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { addDoc, collection, deleteField, doc, orderBy, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import FollowUpRow from '@/components/FollowUpRow.vue'
import SearchSelect from '@/components/SearchSelect.vue'
import { db } from '@/lib/firebase'
import { day, today, useCollection } from '@/lib/db'
import { slug, type Presenter } from '@/lib/directory'
import { addDays, directory, dueLabel, gigFollowUps, replyTask, seasonFollowUps, seasonRun, sortOut, storedFollowUps, type FollowUpTask } from '@/lib/followups'
import type { Gig } from '@/lib/gigs'
import { useAuth } from '@/stores/auth'
import { useToast } from '@/stores/toast'

const auth = useAuth()
const toast = useToast()
const now = today()
const run = seasonRun(now)
const { rows: gigs, error, ready: gigsReady } = useCollection<Gig>('gigs', orderBy('date'))
const { rows: presenters } = useCollection<Presenter>('presenters')
const { rows: tasks, ready } = useCollection<FollowUpTask>('tasks', where('kind', '==', 'followup'))

const people = computed(() => directory(gigs.value, presenters.value))
const owed = computed(() => sortOut([...gigFollowUps(gigs.value, people.value, now), ...storedFollowUps(tasks.value, people.value, gigs.value)], tasks.value, now))
const seasonal = computed(() => sortOut(seasonFollowUps(run, gigs.value, people.value, now), tasks.value, now))
const snoozed = computed(() => [...owed.value.snoozed, ...seasonal.value.snoozed])
const count = computed(() => owed.value.now.length + seasonal.value.now.length)
const late = computed(() => [...owed.value.now, ...seasonal.value.now].some((f) => f.due < now))
const seasonDue = computed(() => (run ? dueLabel(run.dueBy, now) : null))
const seasonNames = computed(() => {
  const names = seasonal.value.now.map((f) => f.name)
  return names.length <= 3 ? names.join(', ') : `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`
})

const adding = ref(false)
const saving = ref(false)
const reply = ref({ name: '', email: '', about: '', due: addDays(now, 2) })
const names = computed(() => [...people.value.values()].map((p) => p.name).sort((a, b) => a.localeCompare(b)))

watch(
  () => people.value.get(slug(reply.value.name)),
  (who) => {
    if (who?.email && !reply.value.email) reply.value.email = who.email
  },
)

async function addReply() {
  saving.value = true
  const saved = await toast.run(`${reply.value.name} is on your list.`, () =>
    addDoc(collection(db, 'tasks'), { ...replyTask(reply.value, auth.email), createdAt: serverTimestamp() }),
  )
  saving.value = false
  if (!saved) return
  reply.value = { name: '', email: '', about: '', due: addDays(now, 2) }
  adding.value = false
}

function wake(id: string, name: string) {
  return toast.run(`${name} is back on your list.`, () => updateDoc(doc(db, 'tasks', id), { snoozedUntil: deleteField() }))
}
</script>

<template>
  <section class="block">
    <div class="top">
      <h2 class="eyebrow" :class="{ hot: late }">Get back to{{ count ? ` · ${count}` : '' }}</h2>
      <button v-if="!adding" type="button" class="link" @click="adding = true">Add a reply you owe</button>
    </div>
    <p v-if="error" class="error" role="alert">✕ {{ error }}</p>

    <form v-if="adding" class="card add" @submit.prevent="addReply">
      <SearchSelect v-model="reply.name" label="Who" :options="names" new-label="Not in the list yet" />
      <label>Their email<input v-model.trim="reply.email" type="email" maxlength="160" /></label>
      <label class="wide">What they asked<input v-model="reply.about" required maxlength="200" placeholder="Wants a quote for a Dec 12 staff party" /></label>
      <label>Reply by<input v-model="reply.due" type="date" required /></label>
      <span class="buttons">
        <button type="submit" class="btn" :disabled="saving || !reply.name.trim()">Add to my list</button>
        <button type="button" class="btn btn--ghost" @click="adding = false">Cancel</button>
      </span>
    </form>

    <p v-if="!ready || !gigsReady" class="muted">Loading…</p>
    <template v-else>
      <ul v-if="owed.now.length" class="card list">
        <FollowUpRow v-for="f in owed.now" :key="f.id" :item="f" :today="now" />
      </ul>

      <details v-if="run && seasonal.now.length" class="card season" :open="seasonal.now.length <= 3">
        <summary>
          <span class="head">
            <strong>{{ run.season.label }}: check in with {{ seasonal.now.length }}</strong>
            <span v-if="seasonDue" class="due" :class="{ late: seasonDue.late }">{{ seasonDue.text }}</span>
          </span>
          <span class="muted">{{ seasonNames }}</span>
        </summary>
        <p class="muted note">They booked us for {{ run.season.months }} in the last three years and have nothing booked with us this time.</p>
        <ul class="list">
          <FollowUpRow v-for="f in seasonal.now" :key="f.id" :item="f" :today="now" :season="run.season" />
        </ul>
      </details>

      <p v-if="!count" class="clear">Nobody is waiting to hear from us.</p>

      <details v-if="snoozed.length" class="snoozed">
        <summary class="muted">{{ snoozed.length }} snoozed</summary>
        <ul class="list">
          <li v-for="f in snoozed" :key="f.id" class="sleeper">
            <span><strong>{{ f.name }}</strong> <span class="muted">until {{ day(f.stored?.snoozedUntil ?? '', { month: 'short', day: 'numeric' }) }}</span></span>
            <button type="button" class="mini" @click="wake(f.id, f.name)">Bring back</button>
          </li>
        </ul>
      </details>
    </template>
  </section>
</template>

<style scoped>
.block {
  display: grid;
  gap: 12px;
}

.top {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.eyebrow.hot {
  color: var(--color-warning);
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
}

ul.card {
  padding: 4px 18px;
}

.add {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.add label {
  display: grid;
  gap: 4px;
  font-weight: 600;
  font-size: 0.9rem;
}

.wide,
.buttons {
  grid-column: 1 / -1;
}

.buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.season {
  padding: 14px 18px;
}

.season summary {
  display: grid;
  gap: 2px;
  cursor: pointer;
  list-style: none;
}

.season summary::-webkit-details-marker {
  display: none;
}

.season summary::after {
  content: 'Show who';
  justify-self: start;
  margin-top: 6px;
  font-size: 0.85rem;
  color: var(--color-accent-strong);
  text-decoration: underline;
}

.season[open] summary::after {
  content: 'Hide';
}

.head {
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

.note {
  margin: 10px 0 0;
  font-size: 0.9rem;
}

.clear {
  margin: 0;
  padding: 18px;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius);
  color: var(--color-text-muted);
}

.snoozed summary {
  cursor: pointer;
  font-size: 0.9rem;
}

.sleeper {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border);
}
</style>
