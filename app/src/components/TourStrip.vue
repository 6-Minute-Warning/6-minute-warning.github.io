<script setup lang="ts">
import { computed, ref } from 'vue'
import LineupDial from '@/components/LineupDial.vue'
import { LINEUP_SIZE } from '@/lib/call'
import { dayKindLabels, shortDate, type DayCover } from '@/lib/tour'

const props = defineProps<{ cover: DayCover[]; nameOf: (id: string) => string; me?: string }>()

const open = ref('')
const picked = computed(() => props.cover.find((d) => d.date === open.value))
const first = (id: string) => (id === props.me ? 'You' : props.nameOf(id).split(' ')[0])
const dow = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-CA', { weekday: 'short', timeZone: 'UTC' }).replace('.', '')
const month = (date: string, i: number) =>
  i === 0 || date.endsWith('-01') ? new Date(`${date}T12:00:00Z`).toLocaleDateString('en-CA', { month: 'short', timeZone: 'UTC' }).replace('.', '') : ''
const mineOn = (d: DayCover) => (!props.me ? '' : d.in.includes(props.me) ? 'in' : d.out.includes(props.me) ? 'out' : '')
</script>

<template>
  <div class="strip-wrap">
    <ol class="strip" aria-label="Who's there, day by day">
      <li v-for="(d, i) in cover" :key="d.date">
        <button
          type="button"
          class="day"
          :class="[d.kind, { short: d.short, full: d.kind === 'show' && !d.short, open: open === d.date }]"
          :aria-expanded="open === d.date"
          :aria-label="`${shortDate(d.date)}, ${dayKindLabels[d.kind]}${d.place ? ` in ${d.place}` : ''}: ${d.in.length} there, ${d.unknown.length} not answered`"
          @click="open = open === d.date ? '' : d.date"
        >
          <span class="month">{{ month(d.date, i) }}</span>
          <span class="dow">{{ dow(d.date) }}</span>
          <strong class="num">{{ Number(d.date.slice(8)) }}</strong>
          <LineupDial :filled="Math.min(d.in.length, LINEUP_SIZE)" :size="34" />
          <span class="kind">{{ dayKindLabels[d.kind] }}</span>
          <span class="place">{{ d.place || '·' }}</span>
          <span v-if="mineOn(d)" class="me" :class="mineOn(d)" :title="mineOn(d) === 'in' ? 'You are there' : 'You are away'"></span>
        </button>
      </li>
    </ol>
    <div v-if="picked" class="detail" role="region" :aria-label="`Who's there on ${shortDate(picked.date)}`">
      <p class="head">
        <strong>{{ shortDate(picked.date) }} · {{ dayKindLabels[picked.kind] }}<template v-if="picked.place"> · {{ picked.place }}</template></strong>
        <span v-if="picked.kind === 'show'" :class="picked.short ? 'warn' : 'ok'">{{ picked.in.length }} of {{ LINEUP_SIZE }}</span>
      </p>
      <p><span class="label">There</span> {{ picked.in.map(first).join(', ') || 'Nobody yet' }}</p>
      <p v-if="picked.unknown.length"><span class="label">No answer</span> {{ picked.unknown.map(first).join(', ') }}</p>
      <p v-if="picked.out.length"><span class="label">Away</span> {{ picked.out.map(first).join(', ') }}</p>
      <RouterLink v-if="picked.gig" :to="`/gigs/${picked.gig}`">Open the gig</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.strip-wrap {
  display: grid;
  gap: 10px;
  min-width: 0;
}

.strip {
  display: flex;
  gap: 6px;
  margin: 0;
  padding: 0 0 6px;
  list-style: none;
  overflow-x: auto;
  scroll-snap-type: x proximity;
}

.strip li {
  scroll-snap-align: start;
}

.day {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 2px;
  width: 64px;
  padding: 6px 2px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-bg);
  color: var(--color-text);
  font: inherit;
  cursor: pointer;
}

.day.show {
  background: var(--color-surface-raised);
}

.day.short {
  border-color: var(--color-warning);
}

.day.full {
  border-color: var(--color-success);
}

.day.open {
  outline: 2px solid var(--color-accent-strong);
  outline-offset: 1px;
}

.month {
  min-height: 1em;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-accent-strong);
}

.dow,
.kind {
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.show .kind {
  color: var(--color-accent-strong);
}

.num {
  font-family: var(--font-display);
  font-stretch: var(--display-stretch);
  font-size: 1.3rem;
  line-height: 1;
}

.place {
  max-width: 58px;
  overflow: hidden;
  font-size: 0.7rem;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-text-muted);
}

.me {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.me.in {
  background: var(--color-success);
}

.me.out {
  background: var(--color-danger);
}

.detail {
  display: grid;
  gap: 4px;
  padding: 12px 14px;
  border-radius: var(--radius);
  background: var(--color-surface-raised);
}

.detail p {
  margin: 0;
}

.head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.warn {
  color: var(--color-warning);
  font-weight: 700;
}

.ok {
  color: var(--color-success);
  font-weight: 700;
}

.label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  margin-right: 6px;
}
</style>
