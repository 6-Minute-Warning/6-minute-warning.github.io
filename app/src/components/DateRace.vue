<script setup lang="ts">
import { computed, ref } from 'vue'
import LineupDial from '@/components/LineupDial.vue'
import { day, today } from '@/lib/db'
import { LINEUP_SIZE, type Answer } from '@/lib/call'
import type { Standing } from '@/lib/options'

const props = defineProps<{
  standings: Standing[]
  leading: string
  busy: boolean
  me?: string
  mine?: Record<string, Answer>
  until?: string
  canAnswer?: boolean
  canLock?: boolean
  clashes?: Record<string, { name: string; date: string }[]>
  nameOf?: (id: string) => string
}>()
const emit = defineEmits<{ answer: [date: string, value: Answer, until?: string]; lock: [date: string] }>()

const picking = ref('')
const pickedUntil = ref('')
const locking = ref('')
const label = (date: string) => day(date, { weekday: 'short', month: 'short', day: 'numeric' })
const anyLater = computed(() => Object.values(props.mine ?? {}).includes('later'))
const first = (id: string) => (id === props.me ? 'you' : (props.nameOf?.(id) ?? id).split(' ')[0])
const names = (ids: string[]) => ids.map(first).join(', ')

function send(date: string, value: Answer) {
  if (value !== 'later') return emit('answer', date, value)
  if (props.until && props.until <= date) return emit('answer', date, 'later', props.until)
  pickedUntil.value = ''
  picking.value = date
}

function saveUntil() {
  if (!pickedUntil.value) return
  emit('answer', picking.value, 'later', pickedUntil.value)
  picking.value = ''
}

function lock(date: string) {
  locking.value = ''
  emit('lock', date)
}
</script>

<template>
  <div class="race">
    <p v-if="canAnswer" class="q">Which dates can you do?</p>
    <ol>
      <li v-for="s in standings" :key="s.date" class="date" :class="{ lead: s.date === leading, full: s.summary.lineup.length >= LINEUP_SIZE }">
        <div class="head">
          <LineupDial :filled="s.summary.lineup.length" :size="44" />
          <div class="when">
            <strong class="display">{{ label(s.date) }}</strong>
            <span class="muted">{{ s.summary.lineup.length }} of {{ LINEUP_SIZE }} in<template v-if="s.summary.no.length"> · {{ s.summary.no.length }} can't</template></span>
          </div>
          <span v-if="s.date === leading" class="chip" :class="s.filledAt ? 'chip--ok' : 'chip--warn'">{{ s.filledAt ? 'Filled first' : 'Most in' }}</span>
        </div>

        <p v-if="nameOf" class="who muted">
          <template v-if="s.summary.lineup.length">In: {{ names(s.summary.lineup) }}. </template>
          <template v-if="s.summary.no.length">Can't: {{ names(s.summary.no) }}. </template>
          <template v-if="s.summary.waiting.length">Waiting on: {{ names(s.summary.waiting) }}.</template>
        </p>

        <p v-if="clashes?.[s.date]?.length" class="clash">
          Heads up: you're already on
          <template v-for="(c, i) in clashes[s.date]" :key="c.name">{{ i ? ', ' : '' }}<strong>{{ c.name }}</strong> ({{ label(c.date) }})</template>
        </p>

        <div v-if="canAnswer" class="pick" role="group" :aria-label="`Can you make ${label(s.date)}?`">
          <button type="button" class="opt yes" :aria-pressed="mine?.[s.date] === 'yes'" :disabled="busy" @click="send(s.date, 'yes')">I'm in</button>
          <button type="button" class="opt no" :aria-pressed="mine?.[s.date] === 'no'" :disabled="busy" @click="send(s.date, 'no')">Can't</button>
          <button type="button" class="opt later" :aria-pressed="mine?.[s.date] === 'later'" :disabled="busy" @click="send(s.date, 'later')">Not sure</button>
        </div>
        <form v-if="picking === s.date" class="until" @submit.prevent="saveUntil">
          <label>I'll know by
            <input v-model="pickedUntil" type="date" required :min="today()" :max="s.date" @click="($event.target as HTMLInputElement).showPicker?.()" />
          </label>
          <button type="submit" class="btn" :disabled="busy || !pickedUntil">Save</button>
          <button type="button" class="btn btn--ghost" @click="picking = ''">Cancel</button>
        </form>

        <div v-if="canLock" class="lock">
          <template v-if="locking === s.date">
            <span>Lock {{ label(s.date) }}? The other dates are removed, and the answers for this date carry over.</span>
            <button type="button" class="btn" :disabled="busy" @click="lock(s.date)">Lock {{ label(s.date) }}</button>
            <button type="button" class="btn btn--ghost" @click="locking = ''">Cancel</button>
          </template>
          <button v-else-if="s.date === leading" type="button" class="btn" :disabled="busy" @click="locking = s.date">Lock {{ label(s.date) }}</button>
          <button v-else type="button" class="link" :disabled="busy" @click="locking = s.date">Lock {{ label(s.date) }}</button>
        </div>
      </li>
    </ol>
    <p v-if="canAnswer && anyLater && until" class="muted small">You'll know by {{ label(until) }} on the dates marked Not sure.</p>
  </div>
</template>

<style scoped>
.race {
  display: grid;
  gap: 12px;
}

.q {
  margin: 0;
  font-family: var(--font-display);
  font-stretch: var(--display-stretch);
  font-size: 1.05rem;
  font-weight: 800;
  text-transform: uppercase;
}

ol {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.date {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-bg);
}

.date.lead {
  border-color: var(--color-accent);
}

.date.lead.full {
  border-color: var(--color-success);
}

.head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.when {
  display: grid;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.when .display {
  font-size: 1rem;
}

.when .muted {
  font-size: 0.9rem;
}

.who,
.clash,
.small {
  margin: 0;
  font-size: 0.85rem;
}

.clash {
  color: var(--color-warning);
}

.pick {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.opt {
  min-height: 44px;
  padding: 6px 4px;
  border: 2px solid var(--color-border);
  border-radius: var(--radius);
  background: transparent;
  color: var(--color-text);
  font: inherit;
  font-size: 0.85rem;
  font-weight: 800;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.opt:hover {
  border-color: var(--color-text-muted);
}

.opt:disabled {
  opacity: 0.6;
  cursor: wait;
}

.yes[aria-pressed='true'] {
  border-color: var(--color-accent);
  background: var(--color-accent);
  color: var(--color-accent-ink);
}

.no[aria-pressed='true'] {
  border-color: var(--color-text);
  background: var(--color-text);
  color: var(--color-bg);
}

.later[aria-pressed='true'] {
  border-color: var(--color-warning);
  color: var(--color-warning);
}

.until,
.lock {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 8px;
}

.lock {
  align-items: center;
}

.lock span {
  flex-basis: 100%;
  font-weight: 700;
}

.until label {
  display: grid;
  gap: 4px;
  font-weight: 600;
  font-size: 0.9rem;
}
</style>
