<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { day, money } from '@/lib/db'
import { slug, type Venue } from '@/lib/directory'
import type { Gig } from '@/lib/gigs'

const props = defineProps<{ gig: Gig; clashNames?: { name: string; date: string }[]; hideNotes?: boolean }>()

const address = ref('')
let stop: Unsubscribe = () => {}
watch(
  () => props.gig.venue,
  (venue) => {
    stop()
    address.value = ''
    if (!venue) return
    stop = onSnapshot(
      doc(db, 'venues', slug(venue)),
      (snap) => (address.value = snap.exists() ? ((snap.data() as Venue).address ?? '') : ''),
      () => (address.value = ''),
    )
  },
  { immediate: true },
)
onUnmounted(() => stop())

const map = computed(() => `https://www.google.com/maps/search/${encodeURIComponent(address.value || props.gig.venue)}`)
const pay = computed(() => props.gig.money?.perSinger ?? 0)
</script>

<template>
  <dl class="facts">
    <div>
      <dt>Time</dt>
      <dd>
        <strong>{{ gig.time || 'Not set yet' }}</strong>
        <span v-if="gig.callTime" class="muted"> · call {{ gig.callTime }}</span>
        <span v-if="gig.sets" class="muted"> · {{ gig.sets }}</span>
      </dd>
    </div>
    <div v-if="gig.venue">
      <dt>Where</dt>
      <dd>
        <a :href="map" target="_blank" rel="noopener">{{ gig.venue }}</a>
        <span v-if="address" class="muted address">{{ address }}</span>
      </dd>
    </div>
    <div>
      <dt>Your pay</dt>
      <dd><strong>{{ pay ? money(pay) : 'Not set yet' }}</strong></dd>
    </div>
    <div v-if="clashNames?.length" class="clash">
      <dt>Heads up</dt>
      <dd>
        You're already on
        <template v-for="(c, i) in clashNames" :key="c.name">{{ i ? ', ' : '' }}<strong>{{ c.name }}</strong> ({{ day(c.date, { weekday: 'short', month: 'short', day: 'numeric' }) }})</template>
      </dd>
    </div>
    <div v-if="!hideNotes && gig.notes?.trim()">
      <dt>Notes</dt>
      <dd class="notes">{{ gig.notes }}</dd>
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
  grid-template-columns: 76px 1fr;
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

.address {
  display: block;
  font-size: 0.9rem;
}

.clash dt,
.clash dd {
  color: var(--color-warning);
}

.notes {
  white-space: pre-line;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
