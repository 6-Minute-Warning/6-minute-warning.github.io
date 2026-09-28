<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Timestamp } from 'firebase/firestore'
import RehearsalForm from '@/components/RehearsalForm.vue'
import type { Gig } from '@/lib/gigs'
import type { PersonRecord } from '@/lib/people'
import { isCurrent, rehearsalCount } from '@/lib/rehearsals'

const props = defineProps<{ gigId: string; gig: Gig; people: (PersonRecord & { id: string })[]; canEdit: boolean }>()

const editing = ref(false)
const r = computed(() => props.gig.rehearsals)
const who = computed(() => {
  const email = r.value?.by.toLowerCase() ?? ''
  return props.people.find((p) => p.emails.some((e) => e.toLowerCase() === email))?.name.split(' ')[0] ?? email.split('@')[0]
})
const when = computed(() => {
  const at = r.value?.at as Timestamp | null | undefined
  return at?.toDate ? at.toDate().toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'America/Edmonton' }) : ''
})
const stale = computed(() => !!r.value && !isCurrent(props.gig))
</script>

<template>
  <section class="card rehearsals">
    <div class="head">
      <h2 class="eyebrow">Rehearsals</h2>
      <button v-if="canEdit && !editing" type="button" class="link" @click="editing = true">{{ r ? 'Change' : 'Set' }}</button>
    </div>
    <RehearsalForm v-if="editing" :gig-id="gigId" :gig="gig" cancel @done="editing = false" />
    <template v-else-if="r">
      <p class="count display">{{ rehearsalCount(r.needed) }}</p>
      <p v-if="r.note" class="note">{{ r.note }}</p>
      <p class="muted small">
        {{ who }}{{ when ? `, ${when}` : '' }}
        <span v-if="stale" class="chip chip--warn">Lineup changed since this was set</span>
      </p>
    </template>
    <p v-else class="muted">The music director hasn't said how many yet.</p>
  </section>
</template>

<style scoped>
.rehearsals {
  display: grid;
  gap: 8px;
  border-radius: var(--radius);
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.head h2 {
  margin: 0;
}

.count {
  margin: 0;
  font-size: 1.3rem;
}

.note {
  margin: 0;
  white-space: pre-line;
}

.small {
  margin: 0;
  font-size: 0.85rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
</style>
