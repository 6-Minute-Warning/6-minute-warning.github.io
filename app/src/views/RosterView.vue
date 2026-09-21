<script setup lang="ts">
import { ref } from 'vue'
import { deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore'
import AppHeader from '@/components/AppHeader.vue'
import { db } from '@/lib/firebase'
import { useCollection } from '@/lib/db'
import { personId, type PersonRecord, type PersonStatus } from '@/lib/people'
import { useAuth } from '@/stores/auth'

const statuses: { value: PersonStatus; label: string }[] = [
  { value: 'active', label: 'Active member' },
  { value: 'sub', label: 'Sub' },
  { value: 'crew', label: 'Crew' },
  { value: 'alumni', label: 'Alumni' },
]

const auth = useAuth()
const { rows: people, error } = useCollection<PersonRecord>('people')
const form = ref({ name: '', status: 'active' as PersonStatus, part: '', phone: '' })
const formError = ref('')
const actionError = ref('')

async function add() {
  const name = form.value.name.trim()
  formError.value = ''
  if (!name) return (formError.value = 'Enter a name.')
  const id = personId(name)
  if (people.value.some((p) => p.id === id)) return (formError.value = `${name} is already on the roster.`)
  try {
    await setDoc(doc(db, 'people', id), { name, status: form.value.status, part: form.value.part.trim(), phone: form.value.phone.trim(), emails: [] })
    form.value = { name: '', status: 'active', part: '', phone: '' }
  } catch (e) {
    formError.value = e instanceof Error ? e.message : String(e)
  }
}

async function setStatus(person: PersonRecord & { id: string }, status: PersonStatus) {
  actionError.value = ''
  try {
    await updateDoc(doc(db, 'people', person.id), { status })
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : String(e)
  }
}

async function remove(person: PersonRecord & { id: string }) {
  if (!window.confirm(`Remove ${person.name} from the roster? Their sign-in access is managed under Access.`)) return
  actionError.value = ''
  try {
    await deleteDoc(doc(db, 'people', person.id))
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <AppHeader />
  <main class="page">
    <h1>Roster</h1>
    <p class="muted">Everyone who can be on a gig: members, subs and crew. Sign-in access is separate, under Access.</p>
    <p v-if="error" class="error" role="alert">✕ {{ error }}</p>
    <p v-if="actionError" class="error" role="alert">✕ {{ actionError }}</p>

    <table class="table">
      <thead>
        <tr><th>Name</th><th>Status</th><th>Part or job</th><th>Phone</th><th v-if="auth.isManager"></th></tr>
      </thead>
      <tbody>
        <tr v-for="p in people" :key="p.id">
          <td>{{ p.name }}</td>
          <td>
            <select
              :value="p.status"
              :aria-label="`Status for ${p.name}`"
              :disabled="!auth.isManager"
              @change="setStatus(p, ($event.target as HTMLSelectElement).value as PersonStatus)"
            >
              <option v-for="s in statuses" :key="s.value" :value="s.value">{{ s.label }}</option>
            </select>
          </td>
          <td>{{ p.part || '—' }}</td>
          <td>
            <a v-if="p.phone" :href="`tel:${p.phone.replace(/[^0-9+]/g, '')}`">{{ p.phone }}</a>
            <span v-else class="muted">—</span>
          </td>
          <td v-if="auth.isManager"><button type="button" class="link" @click="remove(p)">Remove</button></td>
        </tr>
        <tr v-if="!people.length"><td colspan="5" class="muted">Nobody yet.</td></tr>
      </tbody>
    </table>

    <template v-if="auth.isManager">
      <h2>Add someone</h2>
      <form class="card add" @submit.prevent="add">
        <label>
          Name
          <input v-model="form.name" autocomplete="off" required />
        </label>
        <label>
          Status
          <select v-model="form.status">
            <option v-for="s in statuses" :key="s.value" :value="s.value">{{ s.label }}</option>
          </select>
        </label>
        <label>
          Part or job
          <input v-model="form.part" autocomplete="off" placeholder="Bass, sound tech" />
        </label>
        <label>
          Phone
          <input v-model="form.phone" type="tel" autocomplete="off" />
        </label>
        <button type="submit" class="btn">Add</button>
        <p v-if="formError" class="error" role="alert">✕ {{ formError }}</p>
      </form>
    </template>
  </main>
</template>

<style scoped>
h2 {
  margin: 32px 0 12px;
  font-size: 1.1rem;
}

.add {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  align-items: end;
}

.add .error {
  grid-column: 1 / -1;
  margin: 0;
}

label {
  display: grid;
  gap: 4px;
  font-weight: 600;
  font-size: 0.9rem;
}

.link {
  background: none;
  border: 0;
  padding: 0;
  font: inherit;
  font-size: 0.85rem;
  color: var(--color-accent-strong);
  cursor: pointer;
  text-decoration: underline;
}
</style>
