<script setup lang="ts">
import { computed, ref } from 'vue'
import { deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore'
import AppHeader from '@/components/AppHeader.vue'
import RosterPerson from '@/components/RosterPerson.vue'
import { db } from '@/lib/firebase'
import { usePeople } from '@/lib/db'
import { personId, rosterGroups, voiceParts, type Person, type PersonStatus, type VoicePart } from '@/lib/people'
import { useAuth } from '@/stores/auth'
import { useToast } from '@/stores/toast'

const auth = useAuth()
const toast = useToast()
const { people, byId, error, ready } = usePeople()
const groups = computed(() => rosterGroups(people.value))
const coverable = computed(() => [...groups.value.band, ...groups.value.sound].map((r) => r.person))
const nameOf = (id: string) => byId.value.get(id)?.name ?? id
const editing = ref('')
const busy = ref(false)

async function save(person: Person, patch: Partial<Person>) {
  busy.value = true
  const ok = await toast.run(`Saved ${patch.name ?? person.name}.`, async () => {
    await updateDoc(doc(db, 'people', person.id), patch)
    return true
  })
  busy.value = false
  if (ok) editing.value = ''
}

async function remove(person: Person) {
  if (!window.confirm(`Remove ${person.name} from the roster? Their sign-in access is managed under Access.`)) return
  busy.value = true
  const ok = await toast.run(`${person.name} is off the roster.`, async () => {
    await deleteDoc(doc(db, 'people', person.id))
    return true
  })
  busy.value = false
  if (ok) editing.value = ''
}

const statuses: { value: PersonStatus; label: string }[] = [
  { value: 'active', label: 'Member' },
  { value: 'sub', label: 'Sub' },
  { value: 'crew', label: 'Crew' },
]
const adding = ref(false)
const form = ref({ name: '', status: 'sub' as PersonStatus, voice: '' as VoicePart | '', phone: '' })
const formError = ref('')

async function add() {
  const name = form.value.name.trim()
  formError.value = ''
  if (!name) return (formError.value = 'Enter a name.')
  const id = personId(name)
  if (byId.value.has(id)) return (formError.value = `${name} is already on the roster.`)
  busy.value = true
  const ok = await toast.run(`${name} is on the roster.`, async () => {
    const f = form.value
    await setDoc(doc(db, 'people', id), { name, status: f.status, part: '', voice: f.voice, jobs: [], covers: [], phone: f.phone.trim(), emails: [] })
    return true
  })
  busy.value = false
  if (ok) {
    form.value = { name: '', status: 'sub', voice: '', phone: '' }
    adding.value = false
    editing.value = id
  }
}

const rowProps = (p: Person, under?: string, sound = false) => ({
  person: p,
  under,
  sound,
  nameOf,
  canEdit: auth.isManager,
  editing: editing.value === p.id,
  coverable: coverable.value,
  busy: busy.value,
})
</script>

<template>
  <AppHeader />
  <main class="page roster">
    <header class="top">
      <h1>Roster</h1>
      <p class="muted">Who sings which part, who does what, and who can step in. Sign-in access is separate, under Access.</p>
    </header>
    <p v-if="error" class="error" role="alert">✕ {{ error }}</p>
    <p v-else-if="!ready" class="muted">Loading…</p>

    <template v-else>
      <section class="group">
        <h2 class="eyebrow">The band · {{ groups.band.length }}</h2>
        <ul class="list">
          <li v-for="r in groups.band" :key="r.person.id">
            <RosterPerson
              v-bind="rowProps(r.person)"
              @edit="editing = r.person.id"
              @cancel="editing = ''"
              @save="(patch) => save(r.person, patch)"
              @remove="remove(r.person)"
            />
            <ul v-if="r.subs.length" class="subs" :aria-label="`Subs for ${r.person.name}`">
              <li v-for="s in r.subs" :key="s.id">
                <RosterPerson
                  v-bind="rowProps(s, r.person.id)"
                  @edit="editing = s.id"
                  @cancel="editing = ''"
                  @save="(patch) => save(s, patch)"
                  @remove="remove(s)"
                />
              </li>
            </ul>
            <p v-else-if="auth.isManager" class="subs none">No sub linked yet</p>
          </li>
          <li v-if="!groups.band.length" class="muted empty">No singers yet.</li>
        </ul>
      </section>

      <section class="group">
        <h2 class="eyebrow">Sound</h2>
        <ul class="list">
          <li v-for="r in groups.sound" :key="r.person.id">
            <RosterPerson
              v-bind="rowProps(r.person)"
              @edit="editing = r.person.id"
              @cancel="editing = ''"
              @save="(patch) => save(r.person, patch)"
              @remove="remove(r.person)"
            />
            <ul v-if="r.subs.length" class="subs" :aria-label="`Subs for ${r.person.name}`">
              <li v-for="s in r.subs" :key="s.id">
                <RosterPerson
                  v-bind="rowProps(s, r.person.id, true)"
                  @edit="editing = s.id"
                  @cancel="editing = ''"
                  @save="(patch) => save(s, patch)"
                  @remove="remove(s)"
                />
              </li>
            </ul>
            <p v-else-if="auth.isManager" class="subs none">No sound sub linked yet</p>
          </li>
          <li v-if="!groups.sound.length" class="empty gap">
            Nobody has the sound tech job, so polls can't fill the sound seat. Give it to your sound tech with Edit.
          </li>
        </ul>
      </section>

      <section v-if="groups.unlinked.length" class="group">
        <h2 class="eyebrow hot">Subs to link · {{ groups.unlinked.length }}</h2>
        <p v-if="auth.isManager" class="muted small">Edit each one and pick who they cover, so Find a sub offers them first.</p>
        <ul class="list">
          <li v-for="s in groups.unlinked" :key="s.id">
            <RosterPerson
              v-bind="rowProps(s)"
              @edit="editing = s.id"
              @cancel="editing = ''"
              @save="(patch) => save(s, patch)"
              @remove="remove(s)"
            />
          </li>
        </ul>
      </section>

      <section v-if="groups.others.length" class="group">
        <h2 class="eyebrow">Others</h2>
        <p class="muted small">Not asked about gigs.</p>
        <ul class="list">
          <li v-for="p in groups.others" :key="p.id">
            <RosterPerson
              v-bind="rowProps(p)"
              @edit="editing = p.id"
              @cancel="editing = ''"
              @save="(patch) => save(p, patch)"
              @remove="remove(p)"
            />
          </li>
        </ul>
      </section>

      <section v-if="auth.isManager" class="group">
        <button v-if="!adding" type="button" class="btn btn--ghost" @click="adding = true">Add someone</button>
        <form v-else class="card add" @submit.prevent="add">
          <h2 class="eyebrow">Add someone</h2>
          <label>Name<input v-model="form.name" autocomplete="off" maxlength="120" required /></label>
          <label>
            Status
            <select v-model="form.status">
              <option v-for="s in statuses" :key="s.value" :value="s.value">{{ s.label }}</option>
            </select>
          </label>
          <label>
            Voice part
            <select v-model="form.voice">
              <option value="">None</option>
              <option v-for="v in voiceParts" :key="v" :value="v">{{ v }}</option>
            </select>
          </label>
          <label>Phone<input v-model="form.phone" type="tel" autocomplete="off" maxlength="40" /></label>
          <p v-if="formError" class="error" role="alert">✕ {{ formError }}</p>
          <div class="actions">
            <button type="submit" class="btn" :disabled="busy">Add</button>
            <button type="button" class="btn btn--ghost" @click="adding = false">Cancel</button>
          </div>
          <p class="muted small">Jobs and who they cover come next.</p>
        </form>
      </section>

      <details v-if="groups.alumni.length" class="group alumni">
        <summary class="eyebrow">Alumni · {{ groups.alumni.length }}</summary>
        <ul class="list">
          <li v-for="p in groups.alumni" :key="p.id">
            <RosterPerson
              v-bind="rowProps(p)"
              @edit="editing = p.id"
              @cancel="editing = ''"
              @save="(patch) => save(p, patch)"
              @remove="remove(p)"
            />
          </li>
        </ul>
      </details>
    </template>
  </main>
</template>

<style scoped>
.roster {
  max-width: 760px;
  display: grid;
  gap: 28px;
}

.top p {
  margin: 0;
}

.group {
  display: grid;
  gap: 8px;
}

.eyebrow.hot {
  color: var(--color-warning);
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  border-top: 1px solid var(--color-border);
}

.list > li {
  padding: 4px 0 8px;
  border-bottom: 1px solid var(--color-border);
}

.subs {
  list-style: none;
  margin: 0 0 4px 27px;
  padding: 0 0 0 16px;
  border-left: 2px solid var(--color-border);
}

.subs.none {
  margin-top: 0;
  padding-block: 2px;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.empty {
  padding: 14px 0;
}

.gap {
  color: var(--color-warning);
}

.small {
  font-size: 0.9rem;
  margin: 0;
}

.alumni summary {
  cursor: pointer;
  padding: 6px 0;
}

.alumni .list {
  margin-top: 8px;
}

.add {
  display: grid;
  gap: 12px;
}

.add label {
  display: grid;
  gap: 4px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.add input,
.add select {
  font-size: 1rem;
  letter-spacing: normal;
  text-transform: none;
  color: var(--color-text);
}

.add .error {
  margin: 0;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
