<script setup lang="ts">
import { computed, ref, toRef } from 'vue'
import AnswerCard from '@/components/AnswerCard.vue'
import DateBlock from '@/components/DateBlock.vue'
import GigFacts from '@/components/GigFacts.vue'
import LineupDial from '@/components/LineupDial.vue'
import { LINEUP_SIZE, type Answer } from '@/lib/call'
import { clashes, type GigRow } from '@/lib/gigs'
import { usePoll } from '@/lib/poll'
import { useAuth } from '@/stores/auth'
import { useToast } from '@/stores/toast'

const props = defineProps<{ gig: GigRow; allGigs: GigRow[]; me: string; nameOf: (id: string) => string; askedBy: string; ago: string }>()

const auth = useAuth()
const toast = useToast()
const busy = ref(false)
const { answers, summary, answer } = usePoll(props.gig.id, toRef(props, 'gig'), () => auth.email, props.nameOf, (m) => toast.show(m, 'error'))
const first = (id: string) => (id === props.me ? 'You' : props.nameOf(id).split(' ')[0])
const inNames = computed(() => summary.value?.lineup.map(first) ?? [])
const clashNames = computed(() => clashes(props.allGigs, props.gig, props.me).map((g) => ({ name: g.name, date: g.date })))

async function reply(value: Answer, until?: string) {
  busy.value = true
  await toast.run(value === 'yes' ? "You're in." : value === 'no' ? 'Got it. The band will sort a sub.' : 'Saved.', () => answer(props.me, value, until))
  busy.value = false
}
</script>

<template>
  <article class="poll">
    <header class="top">
      <DateBlock :date="gig.date" />
      <div class="title">
        <p class="eyebrow">Asked by {{ askedBy }} {{ ago }}</p>
        <h3><RouterLink :to="`/gigs/${gig.id}`">{{ gig.name }}</RouterLink></h3>
      </div>
    </header>

    <GigFacts :gig="gig" :clash-names="clashNames" />

    <div v-if="summary" class="who">
      <LineupDial :filled="summary.lineup.length" />
      <p>
        <strong>{{ summary.lineup.length }} of {{ LINEUP_SIZE }} in</strong>
        <span v-if="inNames.length" class="muted"> · {{ inNames.join(', ') }}</span>
      </p>
    </div>

    <AnswerCard :mine="answers[me]" :gig-date="gig.date" :busy="busy" @answer="reply" />
  </article>
</template>

<style scoped>
.poll {
  display: grid;
  gap: 16px;
  padding: 18px;
  border: 1px solid var(--color-warning);
  border-radius: var(--radius);
  background: var(--color-surface);
}

.top {
  display: flex;
  gap: 14px;
  align-items: center;
}

.title {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.title h3 {
  margin: 0;
  font-size: 1.25rem;
}

.title a {
  color: var(--color-text);
  text-decoration: none;
}

.who {
  display: flex;
  align-items: center;
  gap: 12px;
}

.who p {
  margin: 0;
}
</style>
