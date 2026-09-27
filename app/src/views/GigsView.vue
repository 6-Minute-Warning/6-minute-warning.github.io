<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { doc, orderBy, runTransaction, serverTimestamp, writeBatch } from 'firebase/firestore'
import AppHeader from '@/components/AppHeader.vue'
import SearchSelect from '@/components/SearchSelect.vue'
import { db } from '@/lib/firebase'
import { day, logEvent, money, today, useCollection } from '@/lib/db'
import { blankPresenter, mergeNames, presenterTask, slug, usualPartner, venueTask, type Presenter, type Venue } from '@/lib/directory'
import { DEFAULT_TIME, balance, gigId, importWrite, newGig, presentersOf, timeOptions, venuesOf, isUpcoming, planGigImport, stageLabels, contractLabels, type Gig, type Stage } from '@/lib/gigs'
import { useAuth } from '@/stores/auth'

const auth = useAuth()
const router = useRouter()
const { rows: gigs, error } = useCollection<Gig>('gigs', orderBy('date'))
const filter = ref<'upcoming' | 'all'>('upcoming')
const now = today()

const shown = computed(() => {
  const list = filter.value === 'upcoming' ? gigs.value.filter((g) => isUpcoming(g, now)) : [...gigs.value].reverse()
  return list
})

const upcoming = computed(() => gigs.value.filter((g) => isUpcoming(g, now)))
const booked = computed(() => upcoming.value.filter((g) => g.stage === 'confirmed'))
const owed = computed(() => gigs.value.filter((g) => g.stage !== 'cancelled').reduce((sum, g) => sum + balance(g), 0))
const needsContract = computed(() => upcoming.value.filter((g) => g.contract !== 'signed' && g.stage !== 'tentative'))

const stageTone = (stage: Stage) => (stage === 'confirmed' || stage === 'done' ? 'ok' : stage === 'cancelled' ? 'bad' : 'warn')

const draft = ref({ name: '', date: '', time: DEFAULT_TIME, venue: '', presenter: '', email: '', phone: '' })
const none = <T,>() => ({ rows: computed(() => [] as (T & { id: string })[]) })
const { rows: venueRows } = auth.isManager ? useCollection<Venue>('venues') : none<Venue>()
const { rows: presenterRows } = auth.isManager ? useCollection<Presenter>('presenters') : none<Presenter>()
const venues = computed(() => mergeNames(venuesOf(gigs.value), venueRows.value.map((v) => v.name)))
const presenters = computed(() => {
  const known = new Map(presentersOf(gigs.value).map((c) => [c.name.toLowerCase(), c]))
  for (const p of presenterRows.value) known.set(p.name.toLowerCase(), { name: p.name, email: p.email, phone: p.phone })
  return [...known.values()].sort((a, b) => a.name.localeCompare(b.name))
})
const presenterNames = computed(() => presenters.value.map((p) => p.name))
const known = (list: string[], value: string) => list.find((o) => slug(o) === slug(value))
const venueIsNew = computed(() => !!draft.value.venue.trim() && !known(venues.value, draft.value.venue))
const presenterIsNew = computed(() => !!draft.value.presenter.trim() && !known(presenterNames.value, draft.value.presenter))

watch(
  () => known(venues.value, draft.value.venue),
  (venue) => {
    if (venue && !draft.value.presenter.trim()) draft.value.presenter = usualPartner(gigs.value, 'venue', venue)
  },
)
watch(
  () => known(presenterNames.value, draft.value.presenter),
  (presenter) => {
    if (presenter && !draft.value.venue.trim()) draft.value.venue = usualPartner(gigs.value, 'presenter', presenter)
  },
)

const times = timeOptions()
const addError = ref('')
const adding = ref(false)

async function addGig() {
  addError.value = ''
  adding.value = true
  const d = draft.value
  const presenterName = known(presenterNames.value, d.presenter)
  const picked = presenters.value.find((p) => p.name === presenterName)
  const contact = presenterIsNew.value ? { name: d.presenter.trim(), email: d.email.trim(), phone: d.phone.trim() } : picked
  const fields = { name: d.name, date: d.date, time: d.time, venue: known(venues.value, d.venue) ?? d.venue.trim(), contact }
  const id = gigId(d.name, d.date)
  const gigRef = doc(db, 'gigs', id)
  const venueId = venueIsNew.value ? slug(fields.venue) : ''
  const presenterId = presenterIsNew.value && contact ? slug(contact.name) : ''
  const venueRef = venueId ? doc(db, 'venues', venueId) : null
  const presenterRef = presenterId ? doc(db, 'presenters', presenterId) : null
  try {
    await runTransaction(db, async (tx) => {
      if ((await tx.get(gigRef)).exists()) throw new Error('A gig with this name and date already exists.')
      const venueExists = venueRef ? (await tx.get(venueRef)).exists() : true
      const presenterExists = presenterRef ? (await tx.get(presenterRef)).exists() : true
      tx.set(gigRef, { ...newGig(fields), createdAt: serverTimestamp(), createdBy: auth.email })
      if (venueRef && !venueExists) {
        tx.set(venueRef, { name: fields.venue, address: '' })
        tx.set(doc(db, 'tasks', `venue-${venueId}`), { ...venueTask(venueId, fields.venue, auth.email), createdAt: serverTimestamp() })
      }
      if (presenterRef && contact && !presenterExists) {
        tx.set(presenterRef, blankPresenter(contact))
        tx.set(doc(db, 'tasks', `presenter-${presenterId}`), { ...presenterTask(presenterId, contact.name, auth.email), createdAt: serverTimestamp() })
      }
    })
    await logEvent(id, 'created', draft.value.name, auth.email)
    await router.push(`/gigs/${id}`)
  } catch (e) {
    addError.value = e instanceof Error ? e.message : String(e)
  } finally {
    adding.value = false
  }
}

const plan = ref<ReturnType<typeof planGigImport> | null>(null)
const importError = ref('')
const importDone = ref('')

async function readImport(event: Event) {
  importError.value = ''
  importDone.value = ''
  plan.value = null
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const data = JSON.parse(await file.text()) as { gigs?: unknown[] }
    if (!Array.isArray(data.gigs)) throw new Error('This file has no "gigs" list. Use the file made by tools/notion-gigs.mjs.')
    plan.value = planGigImport(data.gigs)
  } catch (e) {
    importError.value = e instanceof Error ? e.message : String(e)
  }
}

async function applyImport() {
  if (!plan.value) return
  const planned = plan.value
  try {
    const batch = writeBatch(db)
    planned.gigs.forEach(({ id, gig }) => batch.set(doc(db, 'gigs', id), { ...importWrite(gig), importedAt: serverTimestamp(), importedBy: auth.email }, { merge: true }))
    await batch.commit()
    importDone.value = `Imported ${planned.gigs.length} gigs.`
    plan.value = null
  } catch (e) {
    importError.value = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <AppHeader />
  <main class="page">
    <h1>Gigs</h1>
    <p v-if="error" class="error" role="alert">✕ {{ error }}</p>

    <div class="stats">
      <div class="stat"><span class="muted">Upcoming</span><strong>{{ upcoming.length }}</strong></div>
      <div class="stat"><span class="muted">Confirmed ahead</span><strong>{{ booked.length }}</strong></div>
      <div v-if="auth.isManager" class="stat"><span class="muted">Still owed</span><strong>{{ money(owed) }}</strong></div>
      <div class="stat"><span class="muted">Contract to chase</span><strong>{{ needsContract.length }}</strong></div>
    </div>

    <div class="tabs" role="group" aria-label="Which gigs">
      <button type="button" class="mini" :aria-pressed="filter === 'upcoming'" @click="filter = 'upcoming'">Upcoming</button>
      <button type="button" class="mini" :aria-pressed="filter === 'all'" @click="filter = 'all'">All, newest first</button>
    </div>

    <table class="table">
      <thead>
        <tr>
          <th>Date</th><th>Gig</th><th>Venue</th><th>Stage</th><th>Contract</th>
          <th v-if="auth.isManager">Fee</th><th v-if="auth.isManager">Owed</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="g in shown" :key="g.id">
          <td class="nowrap">{{ day(g.date, { month: 'short', day: 'numeric', year: 'numeric' }) }}</td>
          <td><RouterLink :to="`/gigs/${g.id}`">{{ g.name }}</RouterLink></td>
          <td>{{ g.venue || '—' }}</td>
          <td><span class="chip" :class="`chip--${stageTone(g.stage)}`">{{ stageLabels[g.stage] }}</span></td>
          <td>{{ contractLabels[g.contract] }}</td>
          <td v-if="auth.isManager">{{ money(g.money?.fee ?? 0) }}</td>
          <td v-if="auth.isManager">{{ balance(g) ? money(balance(g)) : '—' }}</td>
        </tr>
        <tr v-if="!shown.length">
          <td colspan="7" class="muted">No gigs yet.</td>
        </tr>
      </tbody>
    </table>

    <section v-if="auth.isManager" class="card import">
      <h2>New gig</h2>
      <form class="new" @submit.prevent="addGig">
        <label>Name<input v-model.trim="draft.name" required maxlength="120" /></label>
        <label>Date<input v-model="draft.date" type="date" required @click="($event.target as HTMLInputElement).showPicker?.()" /></label>
        <label>Time
          <select v-model="draft.time" aria-label="Time">
            <option v-for="t in times" :key="t" :value="t">{{ t }}</option>
            <option value="">Not set</option>
          </select>
        </label>
        <SearchSelect v-model="draft.venue" label="Venue" :options="venues" new-label="New venue: its address becomes a to-do" />
        <SearchSelect v-model="draft.presenter" label="Presenter" :options="presenterNames" new-label="New presenter: their details become a to-do" />
        <template v-if="presenterIsNew">
          <label>Presenter email<input v-model="draft.email" type="email" maxlength="160" /></label>
          <label>Presenter phone<input v-model="draft.phone" type="tel" maxlength="40" /></label>
        </template>
        <button type="submit" class="btn" :disabled="adding">Add gig</button>
      </form>
      <p v-if="addError" class="error" role="alert">✕ {{ addError }}</p>
    </section>

    <section v-if="auth.isManager" class="card import">
      <h2>Import from Notion</h2>
      <p class="muted">Run <code>node tools/notion-gigs.mjs</code> in the repo, then choose <code>.local/gigs-import.json</code>. Importing again updates the same gigs and keeps anything added here.</p>
      <input type="file" accept="application/json" aria-label="Gig import file" @change="readImport" />
      <p v-if="importError" class="error" role="alert">✕ {{ importError }}</p>
      <p v-if="importDone" class="ok" role="status">✓ {{ importDone }}</p>
      <template v-if="plan">
        <p>{{ plan.gigs.length }} gigs ready to import.</p>
        <ul v-if="plan.skipped.length" class="warn">
          <li v-for="s in plan.skipped" :key="s">! {{ s }}</li>
        </ul>
        <button type="button" class="btn" @click="applyImport">Import {{ plan.gigs.length }} gigs</button>
      </template>
    </section>
  </main>
</template>

<style scoped>
.stats {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  margin: 16px 0 24px;
}

.stat {
  display: grid;
}

.stat strong {
  font-size: 1.6rem;
}

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.nowrap {
  white-space: nowrap;
}

.import {
  margin-top: 32px;
}

.import h2 {
  margin-top: 0;
  font-size: 1.05rem;
}

.new {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 12px;
}

.new label {
  display: grid;
  gap: 4px;
  font-weight: 600;
  font-size: 0.9rem;
}

.warn {
  color: var(--color-warning);
  list-style: none;
  padding: 0;
}

</style>
