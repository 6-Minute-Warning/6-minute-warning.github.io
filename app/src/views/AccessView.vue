<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import AppHeader from '@/components/AppHeader.vue'
import { db } from '@/lib/firebase'
import { isValidEmail, normalizeEmail, roleLabels, roles, type AccessRecord, type Role } from '@/lib/access'
import { useAuth } from '@/stores/auth'

const auth = useAuth()
const people = ref<(AccessRecord & { email: string })[]>([])
const loadError = ref('')
const form = ref({ email: '', name: '', role: 'member' as Role })
const formError = ref('')
const saving = ref(false)

const stop = onSnapshot(
  query(collection(db, 'users'), orderBy('name')),
  (snap) => {
    people.value = snap.docs.map((d) => ({ email: d.id, ...(d.data() as AccessRecord) }))
  },
  (e) => (loadError.value = e.message),
)
onUnmounted(stop)

async function add() {
  const email = normalizeEmail(form.value.email)
  const name = form.value.name.trim()
  formError.value = ''
  if (!isValidEmail(email)) return (formError.value = 'Enter a full email address.')
  if (!name) return (formError.value = 'Enter a name.')
  if (people.value.some((p) => p.email === email)) return (formError.value = `${email} already has access.`)
  saving.value = true
  try {
    await setDoc(doc(db, 'users', email), { name, role: form.value.role, addedAt: serverTimestamp(), addedBy: auth.email })
    form.value = { email: '', name: '', role: 'member' }
  } catch (e) {
    formError.value = e instanceof Error ? e.message : String(e)
  } finally {
    saving.value = false
  }
}

async function changeRole(email: string, role: Role) {
  await updateDoc(doc(db, 'users', email), { role })
}

async function remove(email: string, name: string) {
  if (!window.confirm(`Remove Backstage access for ${name} (${email})?`)) return
  await deleteDoc(doc(db, 'users', email))
}
</script>

<template>
  <AppHeader />
  <main class="page">
    <h1>Access</h1>
    <p class="muted">Only people on this list can sign in. Use the Google account address they sign in with.</p>

    <form class="card add" @submit.prevent="add">
      <label>
        Email
        <input v-model="form.email" type="email" autocomplete="off" required />
      </label>
      <label>
        Name
        <input v-model="form.name" autocomplete="off" required />
      </label>
      <label>
        Role
        <select v-model="form.role">
          <option v-for="r in roles" :key="r" :value="r">{{ roleLabels[r] }}</option>
        </select>
      </label>
      <button type="submit" class="btn" :disabled="saving">Add</button>
      <p v-if="formError" class="error" role="alert">✕ {{ formError }}</p>
    </form>

    <p v-if="loadError" class="error" role="alert">✕ {{ loadError }}</p>
    <table class="table">
      <thead>
        <tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr>
      </thead>
      <tbody>
        <tr v-for="p in people" :key="p.email">
          <td>{{ p.name }}</td>
          <td>{{ p.email }}</td>
          <td>
            <select
              :value="p.role"
              :aria-label="`Role for ${p.name}`"
              :disabled="p.email === auth.email"
              @change="changeRole(p.email, ($event.target as HTMLSelectElement).value as Role)"
            >
              <option v-for="r in roles" :key="r" :value="r">{{ roleLabels[r] }}</option>
            </select>
          </td>
          <td>
            <button v-if="p.email !== auth.email" type="button" class="link" @click="remove(p.email, p.name)">Remove</button>
            <span v-else class="muted">You</span>
          </td>
        </tr>
      </tbody>
    </table>
  </main>
</template>

<style scoped>
.add {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  align-items: end;
  margin-bottom: 24px;
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
  color: var(--color-accent-strong);
  cursor: pointer;
  text-decoration: underline;
}
</style>
