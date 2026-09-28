<script setup lang="ts">
import { computed, ref } from 'vue'
import { today } from '@/lib/db'
import { answerText, dayKindLabels, daysFor, isCurrent, shortDate, type Tour, type TourAnswer, type TourAnswerValue } from '@/lib/tour'
import type { AnswerExtra } from '@/lib/tourPoll'

const props = defineProps<{ mine: TourAnswer | undefined; tour: Tour; busy: boolean }>()
const emit = defineEmits<{ answer: [value: TourAnswerValue, extra: AnswerExtra] }>()

const changing = ref(false)
const mode = ref<'' | 'some' | 'later'>('')
const until = ref('')
const note = ref('')
const picked = ref<string[]>([])
const stale = computed(() => !!props.mine && !isCurrent(props.mine, props.tour))
const asking = computed(() => !props.mine || stale.value || props.mine.answer === 'later' || changing.value)
const latest = computed(() => props.tour.commitBy || props.tour.start)
const all = computed(() => props.tour.days.map((d) => d.date))

function pickDays() {
  const had = daysFor(props.mine, props.tour)
  picked.value = had?.length ? had : [...all.value]
  note.value = props.mine?.note ?? ''
  mode.value = 'some'
}

function toggle(date: string) {
  picked.value = picked.value.includes(date) ? picked.value.filter((d) => d !== date) : [...picked.value, date]
}

function send(value: TourAnswerValue) {
  if (value === 'later' && !until.value) return
  if (value === 'some' && !picked.value.length) return
  if (value === 'some' && picked.value.length === all.value.length) emit('answer', 'all', { note: note.value })
  else if (value === 'some') emit('answer', 'some', { days: picked.value, note: note.value })
  else if (value === 'later') emit('answer', 'later', { until: until.value })
  else emit('answer', value, {})
  changing.value = false
  mode.value = ''
}
</script>

<template>
  <div class="answer">
    <template v-if="asking">
      <p v-if="stale" class="stale">The plan changed since you answered. Check it still works.</p>
      <p v-else-if="mine?.answer === 'later'" class="stale">You said you'd know by {{ shortDate(mine.until ?? '') }}.</p>
      <p class="q">Can you come on the tour?</p>

      <template v-if="mode === ''">
        <div class="two">
          <button type="button" class="big yes" :disabled="busy" @click="send('all')">All of it</button>
          <button type="button" class="big no" :disabled="busy" @click="send('no')">Can't go</button>
        </div>
        <div class="more">
          <button type="button" class="link" @click="pickDays">Part of it · pick my days</button>
          <button type="button" class="link" @click="mode = 'later'">Not sure yet · I'll know by…</button>
        </div>
      </template>

      <form v-else-if="mode === 'some'" class="some" @submit.prevent="send('some')">
        <p class="hint">Tap the days you can't be there.</p>
        <ul class="days">
          <li v-for="d in tour.days" :key="d.date">
            <button
              type="button"
              class="day"
              :class="d.kind"
              :aria-pressed="picked.includes(d.date)"
              :aria-label="`${shortDate(d.date)}, ${dayKindLabels[d.kind]}${d.place ? `, ${d.place}` : ''}: ${picked.includes(d.date) ? 'there' : 'away'}`"
              @click="toggle(d.date)"
            >
              <span class="dow">{{ new Date(`${d.date}T12:00:00Z`).toLocaleDateString('en-CA', { weekday: 'short', timeZone: 'UTC' }).replace('.', '') }}</span>
              <strong>{{ Number(d.date.slice(8)) }}</strong>
              <span class="kind">{{ dayKindLabels[d.kind] }}</span>
            </button>
          </li>
        </ul>
        <p class="count">
          <strong>{{ picked.length }} of {{ all.length }} days</strong>
          <span v-if="picked.length === all.length" class="muted"> · that's all of it</span>
        </p>
        <label>Anything the band should know?
          <input v-model="note" maxlength="200" placeholder="I can fly out on the 14th" />
        </label>
        <div class="row">
          <button type="submit" class="btn" :disabled="busy || !picked.length">Save my days</button>
          <button type="button" class="btn btn--ghost" @click="mode = ''">Back</button>
        </div>
      </form>

      <form v-else class="pick" @submit.prevent="send('later')">
        <label>I'll know by
          <input v-model="until" type="date" required :min="today()" :max="latest || undefined" @click="($event.target as HTMLInputElement).showPicker?.()" />
        </label>
        <button type="submit" class="btn" :disabled="busy || !until">Save</button>
        <button type="button" class="btn btn--ghost" @click="mode = ''">Back</button>
        <p v-if="tour.commitBy" class="muted small">The band commits by {{ shortDate(tour.commitBy) }}.</p>
      </form>

      <button v-if="changing" type="button" class="link" @click="(changing = false), (mode = '')">Keep my answer</button>
    </template>
    <div v-else class="given">
      <span class="state" :class="mine?.answer === 'no' ? 'state--no' : 'state--yes'">
        {{ mine?.answer === 'all' ? "You're in for all of it" : mine?.answer === 'no' ? "You can't go" : `You're in for ${answerText(mine, tour)}` }}
      </span>
      <button type="button" class="link" @click="changing = true">Change</button>
    </div>
  </div>
</template>

<style scoped>
.answer {
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

.stale {
  margin: 0;
  color: var(--color-warning);
  font-weight: 700;
}

.two {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.big {
  min-height: 56px;
  border-radius: var(--radius);
  font: inherit;
  font-size: 0.95rem;
  font-weight: 800;
  letter-spacing: 0.03em;
  white-space: nowrap;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s, transform 0.15s;
}

.yes {
  border: 2px solid var(--color-accent);
  background: var(--color-accent);
  color: var(--color-accent-ink);
}

.yes:hover {
  background: var(--color-accent-strong);
  box-shadow: 0 0 32px var(--color-glow);
  transform: translateY(-1px);
}

.no {
  border: 2px solid var(--color-text);
  background: transparent;
  color: var(--color-text);
}

.no:hover {
  background: var(--color-text);
  color: var(--color-bg);
}

.big:disabled {
  opacity: 0.6;
  cursor: wait;
}

.more {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 20px;
}

.more .link {
  font-size: 0.95rem;
  padding: 6px 0;
}

.some {
  display: grid;
  gap: 12px;
}

.hint,
.count {
  margin: 0;
}

.days {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
  gap: 6px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.day {
  display: grid;
  justify-items: center;
  width: 100%;
  min-height: 64px;
  padding: 6px 2px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-bg);
  color: var(--color-text-muted);
  font: inherit;
  cursor: pointer;
  text-decoration: line-through;
}

.day strong {
  font-family: var(--font-display);
  font-stretch: var(--display-stretch);
  font-size: 1.25rem;
  line-height: 1.1;
}

.dow,
.kind {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.day[aria-pressed='true'] {
  border-color: var(--color-accent);
  background: var(--color-surface-raised);
  color: var(--color-text);
  text-decoration: none;
}

.day.show[aria-pressed='true'] .kind {
  color: var(--color-accent-strong);
}

.some label,
.pick label {
  display: grid;
  gap: 4px;
  font-weight: 600;
  font-size: 0.9rem;
}

.row,
.pick {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 10px;
}

.small {
  flex-basis: 100%;
  margin: 0;
  font-size: 0.85rem;
}

.given {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.state {
  font-size: 1.1rem;
  font-weight: 800;
}

.state--yes {
  color: var(--color-success);
}

.state--no {
  color: var(--color-danger);
}
</style>
