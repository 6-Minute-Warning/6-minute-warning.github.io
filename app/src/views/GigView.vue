<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { doc, onSnapshot, updateDoc } from 'firebase/firestore'
import AppHeader from '@/components/AppHeader.vue'
import { db } from '@/lib/firebase'
import { day, logEvent, money, useCollection } from '@/lib/db'
import { balance, contractLabels, contractStates, stageLabels, stages, type ContractState, type Gig, type Stage } from '@/lib/gigs'
import type { PersonRecord } from '@/lib/people'
import { useAuth } from '@/stores/auth'

const auth = useAuth()
const route = useRoute()
const id = route.params.id as string
const gig = ref<Gig | null>(null)
const loadError = ref('')
const saveError = ref('')
const saved = ref('')

const { rows: people } = useCollection<PersonRecord>('people')
const singers = computed(() => people.value.filter((p) => p.status === 'active' || p.status === 'sub'))
const crew = computed(() => people.value.filter((p) => p.status === 'crew'))

const stop = onSnapshot(
  doc(db, 'gigs', id),
  (snap) => (gig.value = snap.exists() ? (snap.data() as Gig) : null),
  (e) => (loadError.value = e.message),
)
watch(() => route.fullPath, stop)

const shares = computed(() => {
  const count = gig.value?.performers?.length ?? 0
  return count ? Math.round((gig.value?.money?.fee ?? 0) / count) : 0
})

async function save(patch: Partial<Gig>, what: string) {
  saveError.value = ''
  saved.value = ''
  try {
    await updateDoc(doc(db, 'gigs', id), patch)
    await logEvent(id, 'edit', what, auth.email)
    saved.value = `Saved ${what}.`
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : String(e)
  }
}

function togglePerformer(personId: string, on: boolean) {
  const next = new Set(gig.value?.performers ?? [])
  if (on) next.add(personId)
  else next.delete(personId)
  return save({ performers: [...next] }, on ? 'the lineup' : 'the lineup')
}
</script>

<template>
  <AppHeader />
  <main class="page">
    <p v-if="loadError" class="error" role="alert">✕ {{ loadError }}</p>
    <p v-else-if="!gig" class="muted">Loading…</p>
    <template v-else>
      <p class="muted"><RouterLink to="/gigs">← Gigs</RouterLink></p>
      <h1>{{ gig.name }}</h1>
      <p class="muted">{{ day(gig.date) }}{{ gig.time ? ` · ${gig.time}` : '' }}{{ gig.venue ? ` · ${gig.venue}` : '' }}</p>
      <p v-if="saveError" class="error" role="alert">✕ {{ saveError }}</p>
      <p v-if="saved" class="ok" role="status">✓ {{ saved }}</p>

      <div class="cards">
        <section class="card">
          <h2>Stage</h2>
          <select
            :value="gig.stage"
            aria-label="Gig stage"
            :disabled="!auth.isManager"
            @change="save({ stage: ($event.target as HTMLSelectElement).value as Stage }, 'the stage')"
          >
            <option v-for="s in stages" :key="s" :value="s">{{ stageLabels[s] }}</option>
          </select>
          <h2>Contract</h2>
          <select
            :value="gig.contract"
            aria-label="Contract state"
            :disabled="!auth.isManager"
            @change="save({ contract: ($event.target as HTMLSelectElement).value as ContractState }, 'the contract state')"
          >
            <option v-for="c in contractStates" :key="c" :value="c">{{ contractLabels[c] }}</option>
          </select>
          <p v-if="!auth.isManager" class="muted small">Only the manager changes these.</p>
        </section>

        <section v-if="auth.isManager" class="card">
          <h2>Money</h2>
          <dl class="facts">
            <dt>Fee</dt>
            <dd>{{ money(gig.money?.fee ?? 0) }}</dd>
            <dt>Deposit</dt>
            <dd>{{ money(gig.money?.deposit ?? 0) }}</dd>
            <dt>Paid</dt>
            <dd>{{ money(gig.money?.paid ?? 0) }}</dd>
            <dt>Owed</dt>
            <dd>
              <strong>{{ money(balance(gig)) }}</strong>
            </dd>
            <dt v-if="shares">Each performer</dt>
            <dd v-if="shares">{{ money(shares) }}</dd>
          </dl>
          <p class="muted small">Editing amounts arrives with payments (P5).</p>
        </section>

        <section v-if="auth.isManager && (gig.contact?.name || gig.contact?.email || gig.contact?.phone)" class="card">
          <h2>Presenter</h2>
          <dl class="facts">
            <dt v-if="gig.contact.name">Name</dt>
            <dd v-if="gig.contact.name">{{ gig.contact.name }}</dd>
            <dt v-if="gig.contact.email">Email</dt>
            <dd v-if="gig.contact.email"><a :href="`mailto:${gig.contact.email}`">{{ gig.contact.email }}</a></dd>
            <dt v-if="gig.contact.phone">Phone</dt>
            <dd v-if="gig.contact.phone"><a :href="`tel:${gig.contact.phone.replace(/[^0-9+]/g, '')}`">{{ gig.contact.phone }}</a></dd>
          </dl>
        </section>

        <section class="card">
          <h2>Who's on it</h2>
          <ul class="people">
            <li v-for="p in singers" :key="p.id">
              <label>
                <input
                  type="checkbox"
                  :checked="gig.performers?.includes(p.id)"
                  @change="togglePerformer(p.id, ($event.target as HTMLInputElement).checked)"
                />
                {{ p.name }} <span class="muted">{{ p.status === 'sub' ? 'sub' : p.part }}</span>
              </label>
            </li>
            <li v-if="!singers.length" class="muted">No one on the roster yet. Add people under Roster.</li>
          </ul>
          <h2>Sound tech</h2>
          <select :value="gig.soundTech ?? ''" aria-label="Sound tech" @change="save({ soundTech: ($event.target as HTMLSelectElement).value }, 'the sound tech')">
            <option value="">Nobody yet</option>
            <option v-for="c in crew" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </section>

        <section class="card wide">
          <h2>Notes</h2>
          <textarea
            :value="gig.notes"
            rows="4"
            aria-label="Gig notes"
            @change="save({ notes: ($event.target as HTMLTextAreaElement).value }, 'the notes')"
          ></textarea>
        </section>
      </div>
    </template>
  </main>
</template>

<style scoped>
.cards {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  margin-top: 20px;
}

.card h2 {
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  margin: 0 0 8px;
}

.card h2 + select,
.card h2 + textarea {
  margin-bottom: 16px;
  width: 100%;
}

.wide {
  grid-column: 1 / -1;
}

.facts {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 4px 16px;
  margin: 0;
}

.facts dt {
  color: var(--color-text-muted);
}

.facts dd {
  margin: 0;
}

.people {
  list-style: none;
  margin: 0 0 16px;
  padding: 0;
}

.people label {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 3px 0;
  font-weight: 500;
}

.small {
  font-size: 0.85rem;
}

.ok {
  color: var(--color-success);
  font-weight: 600;
}

textarea {
  font: inherit;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text);
}
</style>
