<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { doc, orderBy, runTransaction, serverTimestamp } from 'firebase/firestore'
import AppHeader from '@/components/AppHeader.vue'
import SearchSelect from '@/components/SearchSelect.vue'
import { db } from '@/lib/firebase'
import { logEvent, useCollection } from '@/lib/db'
import { LINEUP_SIZE, openCall } from '@/lib/call'
import { blankPresenter, mergeNames, presenterTask, slug, usualPartner, venueTask, type Presenter, type Venue } from '@/lib/directory'
import { DEFAULT_TIME, gigId, newGig, presentersOf, timeOptions, venuesOf, type Gig } from '@/lib/gigs'
import type { PersonRecord } from '@/lib/people'
import { useAuth } from '@/stores/auth'

const auth = useAuth()
const router = useRouter()
if (!auth.isManager) router.replace('/gigs')
const { rows: gigs } = useCollection<Gig>('gigs', orderBy('date'))
const { rows: people } = useCollection<PersonRecord>('people')
const members = computed(() => people.value.filter((p) => p.status === 'active'))

const draft = ref({ name: '', date: '', time: DEFAULT_TIME, venue: '', presenter: '', email: '', phone: '', fee: '', perSinger: '', sets: '', ask: true })
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
  const fee = Math.max(0, Math.round(Number(d.fee) || 0))
  const perSinger = Math.max(0, Math.round(Number(d.perSinger) || 0))
  const call = d.ask ? { call: openCall(members.value.map((p) => p.id), auth.email, Date.now()) } : {}
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
      const gig = newGig(fields)
      tx.set(gigRef, { ...gig, sets: d.sets.trim(), money: { ...gig.money, fee, perSinger }, ...call, createdAt: serverTimestamp(), createdBy: auth.email })
      if (venueRef && !venueExists) {
        tx.set(venueRef, { name: fields.venue, address: '' })
        tx.set(doc(db, 'tasks', `venue-${venueId}`), { ...venueTask(venueId, fields.venue, auth.email), createdAt: serverTimestamp() })
      }
      if (presenterRef && contact && !presenterExists) {
        tx.set(presenterRef, blankPresenter(contact))
        tx.set(doc(db, 'tasks', `presenter-${presenterId}`), { ...presenterTask(presenterId, contact.name, auth.email), createdAt: serverTimestamp() })
      }
    })
    await logEvent(id, 'created', d.name, auth.email)
    if (d.ask) await logEvent(id, 'call', 'asked the band', auth.email)
    await router.push(d.ask ? { path: `/gigs/${id}`, query: { share: '1' } } : `/gigs/${id}`)
  } catch (e) {
    addError.value = e instanceof Error ? e.message : String(e)
  } finally {
    adding.value = false
  }
}

</script>

<template>
  <AppHeader />
  <main class="page new">
    <RouterLink to="/gigs" class="back">← Gigs</RouterLink>
    <h1>New gig</h1>
    <form class="form" @submit.prevent="addGig">
      <fieldset>
        <legend>What and when</legend>
        <label>Name<input v-model.trim="draft.name" required maxlength="120" placeholder="Festival of Trees Gala" /></label>
        <div class="pair">
          <label>Date<input v-model="draft.date" type="date" required @click="($event.target as HTMLInputElement).showPicker?.()" /></label>
          <label>Show time
            <select v-model="draft.time">
              <option v-for="t in times" :key="t" :value="t">{{ t }}</option>
              <option value="">Not set</option>
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Where and who</legend>
        <SearchSelect v-model="draft.venue" label="Venue" :options="venues" new-label="New venue: its address becomes a to-do" />
        <SearchSelect v-model="draft.presenter" label="Presenter" :options="presenterNames" new-label="New presenter: their details become a to-do" />
        <div v-if="presenterIsNew" class="pair">
          <label>Presenter email<input v-model="draft.email" type="email" maxlength="160" /></label>
          <label>Presenter phone<input v-model="draft.phone" type="tel" maxlength="40" /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Pay and sets</legend>
        <div class="pair">
          <label>Sets<input v-model="draft.sets" maxlength="60" placeholder="2 × 45 min" /></label>
          <label>Pay per singer<input v-model="draft.perSinger" type="number" min="0" step="25" inputmode="numeric" placeholder="300" /></label>
        </div>
        <label class="fee">Total fee<input v-model="draft.fee" type="number" min="0" step="50" inputmode="numeric" placeholder="3100" /></label>
        <p class="muted hint">Singers see their pay, the sets and the time when they're asked. Only managers see the total fee.</p>
      </fieldset>

      <fieldset>
        <legend>The band</legend>
        <label class="check">
          <input v-model="draft.ask" type="checkbox" />
          Ask the {{ members.length }} members now. {{ LINEUP_SIZE }} yeses fill the lineup.
        </label>
      </fieldset>

      <p v-if="addError" class="error" role="alert">✕ {{ addError }}</p>
      <button type="submit" class="btn submit" :disabled="adding">{{ draft.ask ? 'Create and ask the band' : 'Create gig' }}</button>
    </form>
  </main>
</template>

<style scoped>
.new {
  max-width: 560px;
}

.back {
  font-weight: 600;
  text-decoration: none;
}

.new h1 {
  margin: 8px 0 16px;
}

.form {
  display: grid;
  gap: 20px;
}

fieldset {
  display: grid;
  gap: 14px;
  margin: 0;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
}

legend {
  padding: 0 6px;
  font-weight: 800;
}

label {
  display: grid;
  gap: 4px;
  font-weight: 600;
  font-size: 0.9rem;
}

.pair {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
}

.fee {
  max-width: 200px;
}

.hint {
  margin: 0;
  font-size: 0.85rem;
}

legend {
  font-family: var(--font-display);
  font-stretch: var(--display-stretch);
  text-transform: uppercase;
  font-size: 0.85rem;
}

.check {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 1rem;
  font-weight: 500;
}

.check input {
  width: 20px;
  height: 20px;
  margin-top: 2px;
}

.submit {
  min-height: 52px;
  font-size: 1.05rem;
}
</style>
