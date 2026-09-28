<script setup lang="ts">
import { computed, ref, toRef } from 'vue'
import DateBlock from '@/components/DateBlock.vue'
import TourAnswerCard from '@/components/TourAnswerCard.vue'
import TourFacts from '@/components/TourFacts.vue'
import TourStrip from '@/components/TourStrip.vue'
import { coverage, daysFor, type Tour, type TourAnswerValue } from '@/lib/tour'
import { useTourAnswers, type AnswerExtra } from '@/lib/tourPoll'
import { useAuth } from '@/stores/auth'
import { useToast } from '@/stores/toast'

const props = defineProps<{ tour: Tour & { id: string }; me: string; nameOf: (id: string) => string; askedBy: string; ago: string }>()

const auth = useAuth()
const toast = useToast()
const busy = ref(false)
const { answers, answer } = useTourAnswers(props.tour.id, toRef(props, 'tour'), () => auth.email, props.nameOf)
const cover = computed(() => coverage(props.tour, answers.value))
const first = (id: string) => (id === props.me ? 'You' : props.nameOf(id).split(' ')[0])
const going = computed(() =>
  Object.keys(answers.value)
    .map((id) => ({ id, days: daysFor(answers.value[id], props.tour) }))
    .filter((p) => p.days?.length)
    .map((p) => (p.days!.length === props.tour.days.length ? first(p.id) : `${first(p.id)} (${p.days!.length} days)`)),
)

async function reply(value: TourAnswerValue, extra: AnswerExtra) {
  busy.value = true
  const done = value === 'all' ? "You're in for the tour." : value === 'some' ? 'Your days are saved.' : value === 'no' ? 'Got it. The band will look for a sub.' : 'Saved.'
  await toast.run(done, () => answer(props.me, value, extra))
  busy.value = false
}
</script>

<template>
  <article class="poll">
    <header class="top">
      <DateBlock :date="tour.start" />
      <div class="title">
        <p class="eyebrow">Tour · asked by {{ askedBy }} {{ ago }}</p>
        <h3><RouterLink :to="`/tours/${tour.id}`">{{ tour.name }}</RouterLink></h3>
      </div>
    </header>

    <TourFacts :tour="tour" hide-notes />

    <TourStrip :cover="cover" :name-of="nameOf" :me="me" />
    <p class="who">
      <span class="label">Going</span>
      <span :class="{ muted: !going.length }">{{ going.join(', ') || 'Nobody has said yes yet' }}</span>
    </p>

    <TourAnswerCard :mine="answers[me]" :tour="tour" :busy="busy" @answer="reply" />
  </article>
</template>

<style scoped>
.poll {
  display: grid;
  gap: 16px;
  min-width: 0;
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
  margin: 0;
}

.label {
  margin-right: 8px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}
</style>
