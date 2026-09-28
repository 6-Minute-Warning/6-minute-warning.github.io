<script setup lang="ts">
import { computed } from 'vue'
import { money, today } from '@/lib/db'
import { daysLeft, shortDate, spanText, weekdays, type Tour } from '@/lib/tour'

const props = defineProps<{ tour: Tour; hideNotes?: boolean }>()

const dates = computed(() => props.tour.days.map((d) => d.date))
const shows = computed(() => props.tour.days.filter((d) => d.kind === 'show').length)
const travel = computed(() => props.tour.days.filter((d) => d.kind === 'travel').length)
const off = computed(() => weekdays(dates.value))
const left = computed(() => daysLeft(props.tour.commitBy, today()))
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`
</script>

<template>
  <dl class="facts">
    <div>
      <dt>When</dt>
      <dd>
        <strong>{{ spanText(tour.start, tour.end) }}</strong>
        <span class="muted"> · {{ plural(dates.length, 'day') }}{{ travel ? `, ${travel} travel` : '' }}</span>
        <span v-if="tour.rough" class="rough">Rough dates, may move</span>
      </dd>
    </div>
    <div>
      <dt>Where</dt>
      <dd>{{ tour.places || 'Not set yet' }}<span class="muted"> · {{ shows ? plural(shows, 'show day') : 'shows not set yet' }}</span></dd>
    </div>
    <div>
      <dt>Time off</dt>
      <dd><strong>{{ plural(off, 'weekday') }}</strong><span class="muted"> away from work for the whole tour</span></dd>
    </div>
    <div>
      <dt>Covered</dt>
      <dd>{{ tour.covered || 'Not set yet' }}</dd>
    </div>
    <div>
      <dt>You pay</dt>
      <dd>{{ tour.notCovered || 'Not set yet' }}</dd>
    </div>
    <div>
      <dt>Your pay</dt>
      <dd><strong>{{ tour.perSinger ? money(tour.perSinger) : 'Not set yet' }}</strong></dd>
    </div>
    <div v-if="tour.commitBy" :class="{ soon: left !== null && left <= 14 }">
      <dt>Commit by</dt>
      <dd>
        <strong>{{ shortDate(tour.commitBy) }}</strong>
        <span class="muted"> · {{ left === null ? '' : left < 0 ? 'passed' : left === 0 ? 'today' : `${plural(left, 'day')} left` }}</span>
        <span class="muted small">Flights get booked once the lineup is set.</span>
      </dd>
    </div>
    <div v-if="!hideNotes && tour.notes?.trim()">
      <dt>Notes</dt>
      <dd class="notes">{{ tour.notes }}</dd>
    </div>
  </dl>
</template>

<style scoped>
.facts {
  display: grid;
  gap: 8px;
  margin: 0;
}

.facts > div {
  display: grid;
  grid-template-columns: 84px 1fr;
  gap: 12px;
  align-items: baseline;
}

dt {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

dd {
  margin: 0;
  min-width: 0;
}

.rough {
  display: block;
  font-size: 0.85rem;
  color: var(--color-warning);
}

.soon dt,
.soon dd strong {
  color: var(--color-warning);
}

.small {
  display: block;
  font-size: 0.85rem;
}

.notes {
  white-space: pre-line;
}
</style>
