<script setup lang="ts">
import { computed } from 'vue'
import LineupDial from '@/components/LineupDial.vue'
import { day, useCollection } from '@/lib/db'
import type { SeatOf } from '@/lib/call'
import type { GigRow } from '@/lib/gigs'
import { leader, race } from '@/lib/options'
import { fromRaw, type RawAnswer } from '@/lib/poll'

const props = defineProps<{ gig: GigRow; seat: SeatOf }>()
const { rows } = useCollection<Omit<RawAnswer, 'id'>>(`gigs/${props.gig.id}/answers`)
const standings = computed(() => race(props.gig.call, Object.fromEntries(rows.value.map((r) => [r.id, fromRaw(r)])), props.gig.dateOptions ?? [], props.seat))
const leading = computed(() => leader(standings.value))
</script>

<template>
  <span class="dials">
    <span v-for="s in standings" :key="s.date" class="one" :class="{ lead: s.date === leading }">
      <LineupDial :filled="s.summary.lineup.length" :size="28" />
      <span class="d">{{ day(s.date, { month: 'short', day: 'numeric' }) }}</span>
      <span v-if="s.date === leading" class="sr-only">, leading</span>
    </span>
  </span>
</template>

<style scoped>
.dials {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
}

.one {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.one.lead .d {
  color: var(--color-accent-strong);
  font-weight: 800;
}
</style>
