<script setup lang="ts">
import { computed } from 'vue'
import { orderBy, where } from 'firebase/firestore'
import DateBlock from '@/components/DateBlock.vue'
import { today, useCollection } from '@/lib/db'
import { spanText, type Tour } from '@/lib/tour'

const { rows, error } = useCollection<Tour>('tours', where('end', '>=', today()), orderBy('end'))
const tours = computed(() => [...rows.value].sort((a, b) => a.start.localeCompare(b.start)))
const stageText = { planning: 'Planning', committed: 'Committed', cancelled: 'Called off' } as const
</script>

<template>
  <section v-if="tours.length || error" class="tours">
    <h2 class="eyebrow">Tours</h2>
    <p v-if="error" class="error" role="alert">✕ {{ error }}</p>
    <ul class="list">
      <li v-for="t in tours" :key="t.id">
        <RouterLink :to="`/tours/${t.id}`" class="row">
          <DateBlock :date="t.start" />
          <span class="what">
            <strong>{{ t.name }}</strong>
            <span class="muted">{{ [spanText(t.start, t.end) + (t.rough ? ' (rough)' : ''), t.places].filter(Boolean).join(' · ') }}</span>
          </span>
          <span class="chip" :class="t.stage === 'committed' ? 'chip--ok' : t.stage === 'cancelled' ? 'chip--bad' : 'chip--warn'">{{ stageText[t.stage] }}</span>
        </RouterLink>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.tours {
  display: grid;
  gap: 8px;
  margin: 16px 0 8px;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  border-top: 1px solid var(--color-border);
}

.row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 0;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
  text-decoration: none;
}

.row:hover strong {
  color: var(--color-accent-strong);
}

.what {
  display: grid;
  flex: 1;
  gap: 2px;
  min-width: 0;
}
</style>
