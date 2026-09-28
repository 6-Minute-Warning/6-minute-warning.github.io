<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore'
import AppHeader from '@/components/AppHeader.vue'
import TourForm from '@/components/TourForm.vue'
import { db } from '@/lib/firebase'
import { useCollection } from '@/lib/db'
import { gigId } from '@/lib/gigs'
import type { PersonRecord } from '@/lib/people'
import { blankDraft, fromDraft, newTour, openTourCall } from '@/lib/tour'
import { logTourEvent } from '@/lib/tourPoll'
import { useAuth } from '@/stores/auth'

const auth = useAuth()
const router = useRouter()
if (!auth.isManager) router.replace('/gigs')
const { rows: people } = useCollection<PersonRecord>('people')
const members = computed(() => people.value.filter((p) => p.status === 'active'))

const draft = ref(blankDraft())
const ask = ref(true)
const error = ref('')
const adding = ref(false)

async function addTour() {
  error.value = ''
  adding.value = true
  const fields = fromDraft(draft.value)
  const id = gigId(fields.name, fields.start)
  const tourRef = doc(db, 'tours', id)
  const call = ask.value ? { call: openTourCall(members.value.map((p) => p.id), auth.email, Date.now()) } : {}
  try {
    await runTransaction(db, async (tx) => {
      if ((await tx.get(tourRef)).exists()) throw new Error('A tour with this name and start date already exists.')
      tx.set(tourRef, { ...newTour(fields), ...call, createdAt: serverTimestamp(), createdBy: auth.email })
    })
    await logTourEvent(id, 'created', fields.name, auth.email)
    await router.push(ask.value ? { path: `/tours/${id}`, query: { share: '1' } } : `/tours/${id}`)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    adding.value = false
  }
}
</script>

<template>
  <AppHeader />
  <main class="page new">
    <RouterLink to="/gigs" class="back">← Gigs</RouterLink>
    <h1>New tour</h1>
    <p class="muted lede">Rough dates are fine. Mark show days and cities on the tour page.</p>
    <form class="form" @submit.prevent="addTour">
      <TourForm v-model="draft" />

      <fieldset>
        <legend>The band</legend>
        <label class="check">
          <input v-model="ask" type="checkbox" />
          Ask the {{ members.length }} members now. They answer All of it, Part of it, Can't go or Not sure yet.
        </label>
      </fieldset>

      <p v-if="error" class="error" role="alert">✕ {{ error }}</p>
      <button type="submit" class="btn submit" :disabled="adding">{{ ask ? 'Create and ask the band' : 'Create tour' }}</button>
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
  margin: 8px 0 8px;
}

.lede {
  margin: 0 0 16px;
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
  font-family: var(--font-display);
  font-stretch: var(--display-stretch);
  font-size: 0.85rem;
  font-weight: 800;
  text-transform: uppercase;
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
