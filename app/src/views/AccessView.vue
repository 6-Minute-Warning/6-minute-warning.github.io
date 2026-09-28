<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore'
import AppHeader from '@/components/AppHeader.vue'
import { db } from '@/lib/firebase'
import { isValidEmail, normalizeEmail, roleLabels, roles, type AccessRecord, type Role } from '@/lib/access'
import { importWrites, jobLabels, personId, planImport, type ImportPlan, type ImportedPerson, type PersonRecord, type PlannedPerson } from '@/lib/people'
import { useCollection } from '@/lib/db'
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
  const byKey = new Map<string, { key: string; name: string; role: Role; duties: string[]; emails: string[] }>()
  for (const u of users.value) {
    const key = u.person ?? `email:${u.email}`
    const group = byKey.get(key) ?? { key, name: u.name, role: u.role, duties: [], emails: [] }
    group.duties = [...new Set([...group.duties, ...(u.duties ?? [])])]
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

function addEmail(group: { key: string; name: string; role: Role; duties: string[] }) {
  const email = normalizeEmail(newEmail.value[group.key] ?? '')
  if (!isValidEmail(email)) return (actionError.value = 'Enter a full email address.')
  if (users.value.some((u) => u.email === email)) return (actionError.value = `${email} already has access.`)
  const person = group.key.startsWith('email:') ? personId(group.name) : group.key
  return run(async () => {
    await setDoc(doc(db, 'users', email), { name: group.name, role: group.role, person, duties: group.duties, addedAt: serverTimestamp(), addedBy: auth.email })
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

const { rows: roster, ready: rosterReady } = useCollection<PersonRecord>('people')
const plan = ref<ImportPlan | null>(null)
const replace = ref<string[]>([])
const fieldLabels = { voice: 'voice part', jobs: 'jobs', covers: 'who they cover' }

function nameOf(id: string) {
  return plan.value?.people.find((p) => p.id === id)?.record.name ?? roster.value.find((p) => p.id === id)?.name ?? id
}

function proposed(p: PlannedPerson) {
  const r = p.record
  return [r.voice, ...r.jobs.map((j) => jobLabels[j]), r.covers.length ? `covers ${r.covers.map(nameOf).join(', ')}` : ''].filter(Boolean).join(' · ')
}

function keptText(p: PlannedPerson) {
  const c = p.current ?? {}
  const shown = { voice: c.voice || '', jobs: (c.jobs ?? []).map((j) => jobLabels[j]).join(', '), covers: (c.covers ?? []).map(nameOf).join(', ') }
  return p.kept.map((f) => `${fieldLabels[f]} ${shown[f]}`).join('; ')
}
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
    const current = Object.fromEntries(roster.value.map(({ id, ...p }) => [id, p]))
    replace.value = []
    plan.value = planImport(data.people, existing, current)
  } catch (e) {
    importError.value = e instanceof Error ? e.message : String(e)
  }
}

async function applyImport() {
  if (!plan.value) return
  const p = plan.value
  await run(async () => {
    const batch = writeBatch(db)
    importWrites(p, new Set(replace.value)).forEach(({ id, data }) => batch.set(doc(db, 'people', id), data, { merge: true }))
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
        Run <code>node tools/notion-people.mjs</code> in the repo, then choose <code>.local/people-import.json</code>. Members and
        crew get their Notion address and firstname@6minutewarning.com; subs join the roster without sign-in access. Existing roles
        are kept. Notion keeps voice parts, jobs and subs in one Role note, so check what the import read from it before you apply.
        After this, Roster is where they change.
      </p>
      <input type="file" accept="application/json" aria-label="People import file" :disabled="!rosterReady" @change="readImport" />
      <p v-if="importError" class="error" role="alert">✕ {{ importError }}</p>
      <p v-if="importDone" class="ok" role="status">✓ {{ importDone }}</p>
      <template v-if="plan">
        <ul class="review">
          <li v-for="p in plan.people" :key="p.id" :class="{ flagged: p.review.length || p.kept.length }">
            <p class="who">
              <strong>{{ p.record.name }}</strong>
              <span class="chip">{{ p.record.status }}</span>
            </p>
            <p class="small">{{ proposed(p) || 'No voice part or jobs read' }}</p>
            <p class="small muted">
              {{ p.record.emails.join(', ') || 'No address' }} ·
              {{
                plan.access.filter((a) => a.person === p.id).length
                  ? `signs in as ${roleLabels[plan.access.find((a) => a.person === p.id)!.role]}${plan.access.some((a) => a.person === p.id && a.isNew) ? ' (new)' : ''}`
                  : 'no sign-in'
              }}
            </p>
            <ul v-if="p.review.length" class="notes">
              <li v-for="r in p.review" :key="r">{{ r }}</li>
            </ul>
            <label v-if="p.kept.length" class="keep">
              <input v-model="replace" type="checkbox" :value="p.id" />
              <span>Backstage already has {{ keptText(p) }}. Tick to replace it with what Notion says.</span>
            </label>
          </li>
        </ul>
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

.review {
  list-style: none;
  margin: 16px 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.review > li {
  display: grid;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.review > li.flagged {
  border-color: var(--color-warning);
}

.review p {
  margin: 0;
}

.review .who {
  display: flex;
  align-items: center;
  gap: 8px;
}

.small {
  font-size: 0.9rem;
}

.notes {
  margin: 4px 0 0;
  padding-left: 18px;
  font-size: 0.9rem;
  color: var(--color-warning);
}

.keep {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-weight: 500;
  margin-top: 4px;
}

.keep input {
  margin-top: 4px;
}

.warn {
  color: var(--color-warning);
  padding-left: 0;
  list-style: none;
}

</style>
