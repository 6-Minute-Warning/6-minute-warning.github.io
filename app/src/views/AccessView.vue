<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore'
import AppHeader from '@/components/AppHeader.vue'
import { db } from '@/lib/firebase'
import { isValidEmail, normalizeEmail, roleLabels, roles, type AccessRecord, type Role } from '@/lib/access'
import { personId, planImport, type ImportPlan, type ImportedPerson } from '@/lib/people'
import { useAuth } from '@/stores/auth'

type UserRow = AccessRecord & { email: string; person?: string }

const auth = useAuth()
const users = ref<UserRow[]>([])
const loadError = ref('')
const actionError = ref('')

const stop = onSnapshot(
  query(collection(db, 'users'), orderBy('name')),
  (snap) => (users.value = snap.docs.map((d) => ({ email: d.id, ...(d.data() as AccessRecord & { person?: string }) }))),
  (e) => (loadError.value = e.message),
)
onUnmounted(stop)

const groups = computed(() => {
  const byKey = new Map<string, { key: string; name: string; role: Role; emails: string[] }>()
  for (const u of users.value) {
    const key = u.person ?? `email:${u.email}`
    const group = byKey.get(key) ?? { key, name: u.name, role: u.role, emails: [] }
    group.emails.push(u.email)
    byKey.set(key, group)
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name))
})

const isMe = (emails: string[]) => emails.includes(auth.email)

async function run(action: () => Promise<unknown>) {
  actionError.value = ''
  try {
    await action()
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : String(e)
  }
}

function setRole(emails: string[], role: Role) {
  return run(async () => {
    const batch = writeBatch(db)
    emails.forEach((email) => batch.update(doc(db, 'users', email), { role }))
    await batch.commit()
  })
}

function removeEmail(email: string) {
  if (!window.confirm(`Stop ${email} from signing in?`)) return
  return run(() => deleteDoc(doc(db, 'users', email)))
}

const newEmail = ref<Record<string, string>>({})

function addEmail(group: { key: string; name: string; role: Role }) {
  const email = normalizeEmail(newEmail.value[group.key] ?? '')
  if (!isValidEmail(email)) return (actionError.value = 'Enter a full email address.')
  if (users.value.some((u) => u.email === email)) return (actionError.value = `${email} already has access.`)
  const person = group.key.startsWith('email:') ? personId(group.name) : group.key
  return run(async () => {
    await setDoc(doc(db, 'users', email), { name: group.name, role: group.role, person, addedAt: serverTimestamp(), addedBy: auth.email })
    newEmail.value[group.key] = ''
  })
}

const form = ref({ email: '', name: '', role: 'member' as Role })
const formError = ref('')

async function addPerson() {
  const email = normalizeEmail(form.value.email)
  const name = form.value.name.trim()
  formError.value = ''
  if (!isValidEmail(email)) return (formError.value = 'Enter a full email address.')
  if (!name) return (formError.value = 'Enter a name.')
  if (users.value.some((u) => u.email === email)) return (formError.value = `${email} already has access.`)
  try {
    await setDoc(doc(db, 'users', email), { name, role: form.value.role, person: personId(name), addedAt: serverTimestamp(), addedBy: auth.email })
    form.value = { email: '', name: '', role: 'member' }
  } catch (e) {
    formError.value = e instanceof Error ? e.message : String(e)
  }
}

const plan = ref<ImportPlan | null>(null)
const importError = ref('')
const importDone = ref('')

async function readImport(event: Event) {
  importError.value = ''
  importDone.value = ''
  plan.value = null
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const data = JSON.parse(await file.text()) as { people?: ImportedPerson[] }
    if (!Array.isArray(data.people)) throw new Error('This file has no "people" list. Use the file made by tools/notion-people.mjs.')
    const existing = Object.fromEntries(users.value.map((u) => [u.email, u.role])) as Record<string, Role>
    plan.value = planImport(data.people, existing)
  } catch (e) {
    importError.value = e instanceof Error ? e.message : String(e)
  }
}

async function applyImport() {
  if (!plan.value) return
  const p = plan.value
  await run(async () => {
    const batch = writeBatch(db)
    p.people.forEach(({ id, record }) => batch.set(doc(db, 'people', id), record, { merge: true }))
    p.access.forEach((a) => {
      const data = a.isNew
        ? { name: a.name, role: a.role, person: a.person, addedAt: serverTimestamp(), addedBy: auth.email }
        : { name: a.name, role: a.role, person: a.person }
      batch.set(doc(db, 'users', a.email), data, { merge: true })
    })
    await batch.commit()
    importDone.value = `Imported ${p.people.length} people and ${p.access.filter((a) => a.isNew).length} new sign-in addresses.`
    plan.value = null
  })
}
</script>

<template>
  <AppHeader />
  <main class="page">
    <h1>Access</h1>
    <p class="muted">
      Only people on this list can sign in. A person can have several addresses (Gmail and @6minutewarning.com); any of them
      signs in as that person.
    </p>

    <p v-if="loadError" class="error" role="alert">✕ {{ loadError }}</p>
    <p v-if="actionError" class="error" role="alert">✕ {{ actionError }}</p>

    <table class="table">
      <thead>
        <tr><th>Person</th><th>Role</th><th>Sign-in addresses</th></tr>
      </thead>
      <tbody>
        <tr v-for="g in groups" :key="g.key">
          <td>
            <strong>{{ g.name }}</strong>
            <span v-if="isMe(g.emails)" class="muted"> (you)</span>
          </td>
          <td>
            <select
              :value="g.role"
              :aria-label="`Role for ${g.name}`"
              :disabled="isMe(g.emails)"
              @change="setRole(g.emails, ($event.target as HTMLSelectElement).value as Role)"
            >
              <option v-for="r in roles" :key="r" :value="r">{{ roleLabels[r] }}</option>
            </select>
          </td>
          <td>
            <ul class="emails">
              <li v-for="e in g.emails" :key="e">
                {{ e }}
                <button v-if="e !== auth.email" type="button" class="link" :aria-label="`Remove ${e}`" @click="removeEmail(e)">
                  Remove
                </button>
              </li>
            </ul>
            <form class="inline" @submit.prevent="addEmail(g)">
              <input
                v-model="newEmail[g.key]"
                type="email"
                placeholder="Add another address"
                :aria-label="`Add another address for ${g.name}`"
              />
              <button type="submit" class="btn btn--ghost btn--small">Add</button>
            </form>
          </td>
        </tr>
      </tbody>
    </table>

    <h2>Add a person</h2>
    <form class="card add" @submit.prevent="addPerson">
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
      <button type="submit" class="btn">Add</button>
      <p v-if="formError" class="error" role="alert">✕ {{ formError }}</p>
    </form>

    <h2>Import from Notion</h2>
    <div class="card">
      <p class="muted">
        Run <code>node tools/notion-people.mjs</code> in the repo, then choose <code>.local/people-import.json</code>. Active members
        get their Notion address and firstname@6minutewarning.com; subs join the roster without sign-in access. Existing roles are
        kept.
      </p>
      <input type="file" accept="application/json" aria-label="People import file" @change="readImport" />
      <p v-if="importError" class="error" role="alert">✕ {{ importError }}</p>
      <p v-if="importDone" class="ok" role="status">✓ {{ importDone }}</p>
      <template v-if="plan">
        <table class="table preview">
          <thead>
            <tr><th>Person</th><th>Status</th><th>Addresses</th><th>Sign-in</th></tr>
          </thead>
          <tbody>
            <tr v-for="p in plan.people" :key="p.id">
              <td>{{ p.record.name }}</td>
              <td>{{ p.record.status }}</td>
              <td>{{ p.record.emails.join(', ') || '—' }}</td>
              <td>
                {{
                  plan.access.filter((a) => a.person === p.id).length
                    ? plan.access
                        .filter((a) => a.person === p.id)
                        .map((a) => (a.isNew ? '+ ' : '') + roleLabels[a.role])
                        .join(', ')
                    : 'No'
                }}
              </td>
            </tr>
          </tbody>
        </table>
        <ul v-if="plan.skipped.length" class="warn">
          <li v-for="s in plan.skipped" :key="s">! {{ s }}</li>
        </ul>
        <button type="button" class="btn" @click="applyImport">
          Import {{ plan.people.length }} people, {{ plan.access.filter((a) => a.isNew).length }} new addresses
        </button>
      </template>
    </div>
  </main>
</template>

<style scoped>
h2 {
  margin: 32px 0 12px;
  font-size: 1.1rem;
}

.emails {
  list-style: none;
  margin: 0 0 8px;
  padding: 0;
}

.emails li {
  padding: 2px 0;
}

.inline {
  display: flex;
  gap: 8px;
}

.btn--small {
  padding: 6px 12px;
}

.add {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
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
  margin-left: 8px;
  background: none;
  border: 0;
  padding: 0;
  font: inherit;
  font-size: 0.85rem;
  color: var(--color-accent-strong);
  cursor: pointer;
  text-decoration: underline;
}

.preview {
  margin: 16px 0;
}

.warn {
  color: var(--color-warning);
  padding-left: 0;
  list-style: none;
}

.ok {
  color: var(--color-success);
  font-weight: 600;
}
</style>
