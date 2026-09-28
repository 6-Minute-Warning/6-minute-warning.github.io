<script setup lang="ts">
import { computed, ref } from 'vue'
import { doc, orderBy, serverTimestamp, writeBatch } from 'firebase/firestore'
import AppHeader from '@/components/AppHeader.vue'
import DateDials from '@/components/DateDials.vue'
import { db } from '@/lib/firebase'
import { day, money, today, useCollection } from '@/lib/db'
import { balance, importWrite, isUpcoming, planGigImport, stageLabels, contractLabels, type Gig, type Stage } from '@/lib/gigs'
import { hasOptions } from '@/lib/options'
import { useAuth } from '@/stores/auth'

const auth = useAuth()
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
    <div class="top">
      <h1>Gigs</h1>
      <RouterLink v-if="auth.isManager" to="/gigs/new" class="btn">New gig</RouterLink>
    </div>
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
          <td v-if="hasOptions(g)" class="date" data-label="Date">
            <span class="stack">
              <span class="md">{{ g.dateOptions!.length }} dates</span>
              <DateDials :gig="g" />
            </span>
          </td>
          <td v-else class="nowrap date" data-label="Date">
            <span class="stack">
              <span class="md">{{ day(g.date, { month: 'short', day: 'numeric' }) }}</span>
              <span class="yr">{{ g.date.slice(0, 4) }}</span>
            </span>
          </td>
          <td class="name"><RouterLink :to="`/gigs/${g.id}`">{{ g.name }}</RouterLink></td>
          <td data-label="Venue">{{ g.venue || '—' }}</td>
          <td data-label="Stage"><span class="chip" :class="`chip--${stageTone(g.stage)}`">{{ stageLabels[g.stage] }}</span></td>
          <td data-label="Contract">{{ contractLabels[g.contract] }}</td>
          <td v-if="auth.isManager" data-label="Fee">{{ money(g.money?.fee ?? 0) }}</td>
          <td v-if="auth.isManager" data-label="Owed">{{ balance(g) ? money(balance(g)) : '—' }}</td>
        </tr>
        <tr v-if="!shown.length">
          <td colspan="7" class="muted">No gigs yet.</td>
        </tr>
      </tbody>
    </table>

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
.date {
  display: grid;
}

.md {
  font-family: var(--font-display);
  font-stretch: var(--display-stretch);
  font-weight: 800;
  text-transform: uppercase;
  color: var(--color-accent-strong);
}

.stack {
  display: grid;
  gap: 4px;
}

.yr {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.top .btn {
  text-decoration: none;
}

@media (max-width: 640px) {
  .table thead {
    display: none;
  }

  .table tr {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 2px 12px;
    padding: 12px 0;
    border-bottom: 1px solid var(--color-border);
  }

  .table td {
    display: contents;
  }

  .table td::before {
    content: attr(data-label);
    color: var(--color-text-muted);
    font-size: 0.85rem;
  }

  .table td.name {
    display: block;
    grid-column: 1 / -1;
    order: -1;
    padding: 0 0 4px;
    border: 0;
    font-size: 1.1rem;
    font-weight: 700;
  }

  .table td.name::before {
    content: none;
  }
}

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

.warn {
  color: var(--color-warning);
  list-style: none;
  padding: 0;
}

</style>
