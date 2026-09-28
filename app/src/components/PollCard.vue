<script setup lang="ts">
import { computed, ref, toRef } from 'vue'
import AnswerCard from '@/components/AnswerCard.vue'
import DateBlock from '@/components/DateBlock.vue'
import DateRace from '@/components/DateRace.vue'
import GigFacts from '@/components/GigFacts.vue'
import LineupDial from '@/components/LineupDial.vue'
import { LINEUP_SIZE, type Answer } from '@/lib/call'
import { clashes, type GigRow } from '@/lib/gigs'
import { dateSaid, hasOptions, optionClashes, optionsText } from '@/lib/options'
import { usePoll } from '@/lib/poll'
import { useAuth } from '@/stores/auth'
import { useToast } from '@/stores/toast'

const props = defineProps<{ gig: GigRow; allGigs: GigRow[]; me: string; nameOf: (id: string) => string; askedBy: string; ago: string }>()

const auth = useAuth()
const toast = useToast()
const busy = ref(false)
const { answers, stored, summary, standings, leading, answer, answerOn } = usePoll(props.gig.id, toRef(props, 'gig'), () => auth.email, props.nameOf, (m) => toast.show(m, 'error'))
const first = (id: string) => (id === props.me ? 'You' : props.nameOf(id).split(' ')[0])
const inNames = computed(() => summary.value?.lineup.map(first) ?? [])
const clashNames = computed(() => clashes(props.allGigs, props.gig, props.me).map((g) => ({ name: g.name, date: g.date })))
const options = computed(() => hasOptions(props.gig))
const dateClashes = computed(() => optionClashes(props.allGigs, props.gig, props.me))
const leaderFull = computed(() => standings.value.find((s) => s.date === leading.value)?.filledAt)

async function reply(value: Answer, until?: string) {
  busy.value = true
  await toast.run(value === 'yes' ? "You're in." : value === 'no' ? 'Got it. The band will sort a sub.' : 'Saved.', () => answer(props.me, value, until))
  busy.value = false
}

async function replyOn(date: string, value: Answer, until?: string) {
  busy.value = true
  await toast.run(dateSaid(date, value), () => answerOn(props.me, date, value, until))
  busy.value = false
}
</script>

<template>
  <article class="poll">
    <header class="top">
      <DateBlock :date="gig.date" :dates="gig.dateOptions" />
      <div class="title">
        <p class="eyebrow">Asked by {{ askedBy }} {{ ago }}</p>
        <h3><RouterLink :to="`/gigs/${gig.id}`">{{ gig.name }}</RouterLink></h3>
      </div>
    </header>

    <GigFacts :gig="gig" :clash-names="options ? [] : clashNames" />

    <template v-if="options">
      <DateRace
        :standings="standings"
        :leading="leading"
        :busy="busy"
        :me="me"
        :mine="stored[me]?.dates"
        :until="stored[me]?.until"
        :clashes="dateClashes"
        can-answer
        @answer="replyOn"
      />
      <RouterLink v-if="auth.isManager && leaderFull" :to="`/gigs/${gig.id}`" class="lockhint">Six are in for {{ optionsText([leading]) }}. Lock it on the gig page.</RouterLink>
    </template>

    <div v-else-if="summary" class="who">
      <LineupDial :filled="summary.lineup.length" />
      <p>
        <strong>{{ summary.lineup.length }} of {{ LINEUP_SIZE }} in</strong>
        <span v-if="inNames.length" class="muted"> · {{ inNames.join(', ') }}</span>
      </p>
    </div>

    <AnswerCard v-if="!options" :mine="answers[me]" :gig-date="gig.date" :busy="busy" @answer="reply" />
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

.lockhint {
  font-weight: 700;
}
</style>
