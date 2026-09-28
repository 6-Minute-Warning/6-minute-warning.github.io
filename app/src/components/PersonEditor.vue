<script setup lang="ts">
import { computed, ref } from 'vue'
import { jobLabels, jobs, voiceParts, type Job, type Person, type PersonStatus, type VoicePart } from '@/lib/people'

const props = defineProps<{ person: Person; coverable: Person[]; busy: boolean }>()
const emit = defineEmits<{ save: [patch: Pick<Person, 'name' | 'status' | 'voice' | 'jobs' | 'covers' | 'phone'>]; cancel: []; remove: [] }>()

const statuses: { value: PersonStatus; label: string }[] = [
  { value: 'active', label: 'Member' },
  { value: 'sub', label: 'Sub' },
  { value: 'crew', label: 'Crew' },
  { value: 'alumni', label: 'Alumni' },
]

const draft = ref({
  name: props.person.name,
  status: props.person.status,
  voice: props.person.voice,
  jobs: [...props.person.jobs],
  covers: [...props.person.covers],
  phone: props.person.phone,
})
const error = ref('')
const choices = computed(() => props.coverable.filter((p) => p.id !== props.person.id))
const wantCovers = ref(false)
const showCovers = computed(() => wantCovers.value || draft.value.status === 'sub' || draft.value.covers.length > 0)

function toggle<T>(list: T[], value: T) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

function setVoice(v: VoicePart | '') {
  draft.value.voice = draft.value.voice === v ? '' : v
}

function toggleJob(j: Job) {
  draft.value.jobs = toggle(draft.value.jobs, j)
}

function submit() {
  const name = draft.value.name.trim()
  if (!name) return (error.value = 'Enter a name.')
  error.value = ''
  emit('save', { ...draft.value, name, phone: draft.value.phone.trim(), jobs: jobs.filter((j) => draft.value.jobs.includes(j)) })
}
</script>

<template>
  <form class="editor" :aria-label="`Edit ${person.name}`" @submit.prevent="submit">
    <div class="pair">
      <label>Name<input v-model="draft.name" autocomplete="off" maxlength="120" required /></label>
      <label>Phone<input v-model="draft.phone" type="tel" autocomplete="off" maxlength="40" /></label>
    </div>

    <fieldset>
      <legend>Status</legend>
      <div class="opts">
        <button
          v-for="s in statuses"
          :key="s.value"
          type="button"
          class="mini"
          :aria-pressed="draft.status === s.value"
          @click="draft.status = s.value"
        >
          {{ s.label }}
        </button>
      </div>
      <p v-if="draft.status === 'crew'" class="hint">Crew aren't asked to sing. Give them the sound tech job to ask them about every gig.</p>
    </fieldset>

    <fieldset>
      <legend>Voice part</legend>
      <div class="opts">
        <button v-for="v in voiceParts" :key="v" type="button" class="mini" :aria-pressed="draft.voice === v" @click="setVoice(v)">{{ v }}</button>
      </div>
    </fieldset>

    <fieldset>
      <legend>Jobs</legend>
      <div class="opts">
        <button v-for="j in jobs" :key="j" type="button" class="mini" :aria-pressed="draft.jobs.includes(j)" @click="toggleJob(j)">{{ jobLabels[j] }}</button>
      </div>
    </fieldset>

    <fieldset v-if="showCovers">
      <legend>Covers</legend>
      <div class="opts">
        <button
          v-for="c in choices"
          :key="c.id"
          type="button"
          class="mini"
          :aria-pressed="draft.covers.includes(c.id)"
          @click="draft.covers = toggle(draft.covers, c.id)"
        >
          {{ c.name.split(' ')[0] }}<span class="sub">{{ c.jobs.includes('sound') ? 'Sound' : c.voice }}</span>
        </button>
      </div>
    </fieldset>
    <button v-else type="button" class="link" @click="wantCovers = true">Also stands in for someone?</button>

    <p v-if="error" class="error" role="alert">✕ {{ error }}</p>
    <div class="actions">
      <button type="submit" class="btn" :disabled="busy">Save</button>
      <button type="button" class="btn btn--ghost" :disabled="busy" @click="emit('cancel')">Cancel</button>
      <button type="button" class="link danger" :disabled="busy" @click="emit('remove')">Remove from roster</button>
    </div>
  </form>
</template>

<style scoped>
.editor {
  display: grid;
  gap: 14px;
  padding: 14px;
  margin-top: 10px;
  border-radius: var(--radius);
  background: var(--color-surface-raised);
}

.pair {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

label,
legend {
  display: grid;
  gap: 4px;
  padding: 0;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

label input {
  font-size: 1rem;
  letter-spacing: normal;
  text-transform: none;
  color: var(--color-text);
}

fieldset {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
}

legend {
  margin-bottom: 8px;
}

.opts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.mini {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
}

.mini .sub {
  font-weight: 600;
  opacity: 0.75;
}

.hint {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.danger {
  margin-left: auto;
  color: var(--color-danger);
}

.error {
  margin: 0;
}
</style>
