<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { orderBy, where } from 'firebase/firestore'
import AppHeader from '@/components/AppHeader.vue'
import RehearsalCard from '@/components/RehearsalCard.vue'
import RehearsalBookForm from '@/components/RehearsalBookForm.vue'
import { today, useCollection } from '@/lib/db'
import type { Gig } from '@/lib/gigs'
import type { PersonRecord } from '@/lib/people'
import { myPersonId } from '@/lib/poll'
import { expectedAt, upcomingRehearsals, type Rehearsal } from '@/lib/schedule'
import { useAuth } from '@/stores/auth'

const auth = useAuth()
const now = today()
const { rows: rehearsals, error, ready } = useCollection<Rehearsal>('rehearsals', orderBy('date'))
const { rows: gigs } = useCollection<Gig>('gigs', where('date', '>=', now), orderBy('date'))
const { rows: people } = useCollection<PersonRecord>('people')
const me = computed(() => myPersonId(auth.access?.person, auth.email, people.value))
const nameOf = (id: string) => people.value.find((p) => p.id === id)?.name ?? id
const upcoming = computed(() => upcomingRehearsals(rehearsals.value, now))
const booking = ref(false)
const editing = ref('')

const route = useRoute()
watch(ready, async (loaded) => {
  if (!loaded || !route.hash) return
  await nextTick()
  document.querySelector(route.hash)?.scrollIntoView({ block: 'start' })
})
</script>

<template>
  <AppHeader />
  <main class="page rehearsals">
    <div class="head">
      <h1>Rehearsals</h1>
      <button v-if="auth.canBook && ready && !booking" type="button" class="btn" @click="booking = true">Book a rehearsal</button>
    </div>
    <p v-if="error" class="error" role="alert">✕ {{ error }}</p>

    <section v-if="booking" class="card">
      <h2 class="eyebrow">New rehearsal</h2>
      <RehearsalBookForm :rehearsals="rehearsals" :gigs="gigs" :people="people" @done="booking = false" />
    </section>

    <p v-if="!ready" class="muted">Loading…</p>
    <p v-else-if="!upcoming.length" class="empty">No rehearsals coming up.</p>

    <template v-for="r in upcoming" :key="r.id">
      <section v-if="editing === r.id" class="card">
        <h2 class="eyebrow">Change the rehearsal</h2>
        <RehearsalBookForm :rehearsals="rehearsals" :gigs="gigs" :people="people" :editing="r" @done="editing = ''" />
      </section>
      <RehearsalCard
        v-else
        :rehearsal="r"
        :gigs="gigs"
        :expected="expectedAt(r, gigs, people)"
        :me="me"
        :name-of="nameOf"
        :can-edit="auth.canBook"
        @edit="editing = r.id"
      />
    </template>
  </main>
</template>

<style scoped>
.rehearsals {
  max-width: 760px;
  display: grid;
  gap: 20px;
}

.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.head h1 {
  margin: 0;
}

.card {
  display: grid;
  gap: 14px;
}

.empty {
  margin: 0;
  padding: 18px;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius);
  color: var(--color-text-muted);
}
</style>
