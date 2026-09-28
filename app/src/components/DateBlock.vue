<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ date: string }>()
const parts = computed(() => {
  if (!props.date) return null
  const d = new Date(`${props.date}T12:00:00-06:00`)
  const f = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString('en-CA', { ...o, timeZone: 'America/Edmonton' })
  return { month: f({ month: 'short' }).replace('.', ''), day: f({ day: 'numeric' }), weekday: f({ weekday: 'short' }).replace('.', '') }
})
</script>

<template>
  <span class="date" :aria-label="date">
    <template v-if="parts">
      <span class="month">{{ parts.month }}</span>
      <span class="day">{{ parts.day }}</span>
      <span class="weekday">{{ parts.weekday }}</span>
    </template>
    <span v-else class="month">TBD</span>
  </span>
</template>

<style scoped>
.date {
  display: grid;
  justify-items: center;
  align-content: center;
  width: 64px;
  min-height: 72px;
  padding: 6px 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-bg);
  text-transform: uppercase;
}

.month,
.weekday {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--color-accent-strong);
}

.weekday {
  color: var(--color-text-muted);
}

.day {
  font-family: var(--font-display);
  font-stretch: var(--display-stretch);
  font-weight: 800;
  font-size: 1.7rem;
  line-height: 1;
}
</style>
