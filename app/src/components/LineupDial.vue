<script setup lang="ts">
import { computed } from 'vue'
import { LINEUP_SIZE } from '@/lib/call'

const props = defineProps<{ filled: number; sound?: boolean; size?: number }>()
const px = computed(() => props.size ?? 56)
const GAP = 10
const CX = 25
const CY = 30
const R = 14
const segments = computed(() =>
  Array.from({ length: LINEUP_SIZE }, (_, i) => {
    const step = 360 / LINEUP_SIZE
    const start = ((i * step + GAP / 2 - 90) * Math.PI) / 180
    const end = (((i + 1) * step - GAP / 2 - 90) * Math.PI) / 180
    const r = R
    const p = (a: number) => `${CX + r * Math.cos(a)} ${CY + r * Math.sin(a)}`
    return { d: `M ${p(start)} A ${r} ${r} 0 0 1 ${p(end)}`, on: i < props.filled }
  }),
)
const hand = computed(() => {
  const a = ((Math.min(props.filled, LINEUP_SIZE) * (360 / LINEUP_SIZE) - 90) * Math.PI) / 180
  return { x: CX + 11 * Math.cos(a), y: CY + 11 * Math.sin(a) }
})
const full = computed(() => props.filled >= LINEUP_SIZE && props.sound !== false)
const label = computed(() => `${props.filled} of ${LINEUP_SIZE} singers in${props.sound === undefined ? '' : `, sound ${props.sound ? 'in' : 'open'}`}`)
</script>

<template>
  <svg class="dial" :class="{ full }" :width="px" :height="px" viewBox="0 0 48 48" role="img" :aria-label="label">
    <path v-for="(s, i) in segments" :key="i" :d="s.d" class="seg" :class="{ on: s.on }" />
    <path d="M 11 30 C 11 16, 20 5, 35 4" class="tail" />
    <line :x1="CX" :y1="CY" :x2="hand.x" :y2="hand.y" class="hand" />
    <circle v-if="sound !== undefined" :cx="CX" :cy="CY" r="4.5" class="hub" :class="{ on: sound }" />
  </svg>
</template>

<style scoped>
.dial {
  flex: none;
}

.seg,
.tail {
  fill: none;
  stroke-width: 4;
  stroke-linecap: round;
}

.seg {
  stroke: var(--color-border);
}

.seg.on,
.tail {
  stroke: var(--color-text);
}

.hand {
  stroke: var(--color-accent);
  stroke-width: 4;
  stroke-linecap: round;
}

.hub {
  fill: var(--color-bg);
  stroke: var(--color-warning);
  stroke-width: 2;
}

.hub.on {
  fill: var(--color-accent);
  stroke: var(--color-accent);
}

.full .hub.on {
  fill: var(--color-success);
  stroke: var(--color-success);
}
</style>
