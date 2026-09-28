<script setup lang="ts">
import { computed } from 'vue'
import PersonEditor from '@/components/PersonEditor.vue'
import { jobLabels, type Person } from '@/lib/people'

const props = defineProps<{
  person: Person
  under?: string
  sound?: boolean
  nameOf: (id: string) => string
  canEdit: boolean
  editing: boolean
  coverable: Person[]
  busy: boolean
}>()
const emit = defineEmits<{ edit: []; save: [patch: Partial<Person>]; cancel: []; remove: [] }>()

const tel = computed(() => props.person.phone.replace(/[^0-9+]/g, ''))
const covers = computed(() => props.person.covers.filter((id) => id !== props.under).map((id) => props.nameOf(id).split(' ')[0]))
const badge = computed(() => ((props.sound || props.person.jobs.includes('sound')) && !props.person.voice ? 'SND' : props.person.voice || '—'))
</script>

<template>
  <div class="person" :class="{ editing }">
    <div class="line">
      <span class="badge" :class="{ empty: badge === '—' }" :aria-label="person.voice ? `Voice part ${person.voice}` : 'No voice part'">{{ badge }}</span>
      <span class="who">
        <strong>{{ person.name }}</strong>
        <span v-if="person.jobs.length || covers.length" class="tags">
          <span v-for="j in person.jobs" :key="j" class="chip">{{ jobLabels[j] }}</span>
          <span v-if="covers.length" class="muted small">{{ under ? 'Also covers' : 'Covers' }} {{ covers.join(', ') }}</span>
        </span>
        <a v-if="person.phone" class="phone" :href="`tel:${tel}`" :aria-label="`Call ${person.name}`">{{ person.phone }}</a>
      </span>
      <button v-if="canEdit && !editing" type="button" class="mini" :aria-label="`Edit ${person.name}`" @click="emit('edit')">Edit</button>
    </div>
    <PersonEditor
      v-if="editing"
      :person="person"
      :coverable="coverable"
      :busy="busy"
      @save="(patch) => emit('save', patch)"
      @cancel="emit('cancel')"
      @remove="emit('remove')"
    />
  </div>
</template>

<style scoped>
.person {
  padding: 10px 0;
}

.line {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
}

.badge {
  flex: none;
  display: grid;
  place-items: center;
  width: 60px;
  min-height: 40px;
  border: 1px solid var(--color-accent);
  border-radius: var(--radius);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--color-accent-strong);
  background: var(--color-bg);
}

.badge.empty {
  border-style: dashed;
  border-color: var(--color-border);
  color: var(--color-text-muted);
}

.who {
  flex: 1;
  display: grid;
  gap: 4px;
  min-width: 0;
}

.who strong {
  overflow-wrap: anywhere;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
}

.small {
  font-size: 0.85rem;
}

.phone {
  justify-self: start;
  font-size: 0.9rem;
  white-space: nowrap;
}

.mini {
  flex: none;
}
</style>
