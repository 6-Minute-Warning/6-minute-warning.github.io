<script setup lang="ts">
import { computed } from 'vue'
import { useCollection } from '@/lib/db'
import { roleLabels, type AccessRecord } from '@/lib/access'
import type { PersonRecord } from '@/lib/people'
import { viewOfPerson, viewRoles } from '@/lib/viewAs'
import { useAuth } from '@/stores/auth'

const emit = defineEmits<{ picked: [] }>()
const auth = useAuth()
const { rows: people } = useCollection<PersonRecord>('people')
const { rows: users } = useCollection<AccessRecord>('users')

const roster = computed(() => people.value.filter((p) => p.status !== 'alumni').sort((a, b) => a.name.localeCompare(b.name)))
const current = computed(() => {
  const v = auth.viewing
  if (!v) return ''
  return v.person ? `person:${v.person}` : `role:${v.role}`
})

function pick(value: string) {
  const [kind, id] = value.split(':')
  const person = roster.value.find((p) => p.id === id)
  if (kind === 'role') auth.viewAs({ role: viewRoles.find((r) => r === id) ?? 'member' })
  else if (kind === 'person' && person) auth.viewAs(viewOfPerson(person, users.value.map((u) => ({ ...u, email: u.id }))))
  else auth.viewAs(null)
  emit('picked')
}
</script>

<template>
  <label class="view-as">
    View as
    <select :value="current" @change="pick(($event.target as HTMLSelectElement).value)">
      <option value="">Myself</option>
      <optgroup label="Role">
        <option v-for="r in viewRoles" :key="r" :value="`role:${r}`">{{ roleLabels[r] }}</option>
      </optgroup>
      <optgroup label="Person">
        <option v-for="p in roster" :key="p.id" :value="`person:${p.id}`">{{ p.name }}</option>
      </optgroup>
    </select>
  </label>
</template>

<style scoped>
.view-as {
  display: grid;
  gap: 4px;
  margin-top: 8px;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}
</style>
