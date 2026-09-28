<script setup lang="ts">
import { computed } from 'vue'
import { LINEUP_SIZE } from '@/lib/call'

const props = defineProps<{ filled: number; size?: number }>()
const px = computed(() => props.size ?? 56)
const GAP = 14
const segments = computed(() =>
  Array.from({ length: LINEUP_SIZE }, (_, i) => {
    const step = 360 / LINEUP_SIZE
    const start = ((i * step + GAP / 2 - 90) * Math.PI) / 180
    const end = (((i + 1) * step - GAP / 2 - 90) * Math.PI) / 180
    const r = 20
    const p = (a: number) => `${24 + r * Math.cos(a)} ${24 + r * Math.sin(a)}`
    return { d: `M ${p(start)} A ${r} ${r} 0 0 1 ${p(end)}`, on: i < props.filled }
  }),
)
const hand = computed(() => {
  const a = ((Math.min(props.filled, LINEUP_SIZE) * (360 / LINEUP_SIZE) - 90) * Math.PI) / 180
  return { x: 24 + 11 * Math.cos(a), y: 24 + 11 * Math.sin(a) }
})
</script>

<template>
  <svg class="dial" :class="{ full: filled >= LINEUP_SIZE }" :width="px" :height="px" viewBox="0 0 48 48" role="img" :aria-label="`${filled} of ${LINEUP_SIZE} in`">
    <path v-for="(s, i) in segments" :key="i" :d="s.d" class="seg" :class="{ on: s.on }" />
    <line x1="24" y1="24" :x2="hand.x" :y2="hand.y" class="hand" />
    <circle cx="24" cy="24" r="2.5" class="hub" />
  </svg>
</template>

<style scoped>
.dial {
  flex: none;
}

.seg {
  fill: none;
  stroke: var(--color-border);
  stroke-width: 5;
  stroke-linecap: round;
}

.seg.on {
  stroke: var(--color-accent);
}

.full .seg.on {
  stroke: var(--color-success);
}

.hand {
  stroke: var(--color-accent-strong);
  stroke-width: 3;
  stroke-linecap: round;
}

.hub {
  fill: var(--color-text);
}
</style>
