<script setup lang="ts">
import { computed } from 'vue'
import { MAX_TOUR_DAYS, spanDates, weekdays, type TourDraft } from '@/lib/tour'

const draft = defineModel<TourDraft>({ required: true })
const dates = computed(() => spanDates(draft.value.start, draft.value.end))
const tooLong = computed(() => !!draft.value.start && !!draft.value.end && dates.value.length >= MAX_TOUR_DAYS)
const picker = (e: Event) => (e.target as HTMLInputElement).showPicker?.()
</script>

<template>
  <fieldset>
    <legend>What and when</legend>
    <label>Name<input v-model.trim="draft.name" required maxlength="120" placeholder="SING! in Japan" /></label>
    <div class="pair">
      <label>Leave<input v-model="draft.start" type="date" required @click="picker" /></label>
      <label>Back home<input v-model="draft.end" type="date" required :min="draft.start || undefined" @click="picker" /></label>
    </div>
    <p v-if="dates.length" class="muted hint">
      {{ dates.length }} days including travel, {{ weekdays(dates) }} of them weekdays.
      <span v-if="tooLong" class="error">Tours stop at {{ MAX_TOUR_DAYS }} days.</span>
    </p>
    <label class="check">
      <input v-model="draft.rough" type="checkbox" />
      These dates are a guess. Singers see that they may move.
    </label>
    <label>Where<input v-model.trim="draft.places" maxlength="160" placeholder="Tokyo, Osaka" /></label>
  </fieldset>

  <fieldset>
    <legend>Money and deadline</legend>
    <label>Covered for singers<input v-model.trim="draft.covered" maxlength="200" placeholder="Flights and hotels" /></label>
    <label>Singers pay for<input v-model.trim="draft.notCovered" maxlength="200" placeholder="Meals and a rail pass" /></label>
    <div class="pair">
      <label>Pay per singer<input v-model="draft.perSinger" type="number" min="0" step="50" inputmode="numeric" placeholder="0" /></label>
      <label>Commit by<input v-model="draft.commitBy" type="date" :max="draft.start || undefined" @click="picker" /></label>
    </div>
    <p class="muted hint">Commit by is when flights need booking. Leave anything blank you don't know yet; it all stays editable.</p>
    <label>Notes<textarea v-model="draft.notes" rows="3" maxlength="2000" placeholder="SING! collaboration and Hinton–Wanouchi cultural exchange"></textarea></label>
  </fieldset>
</template>

<style scoped>
fieldset {
  display: grid;
  gap: 14px;
  margin: 0;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
}

legend {
  padding: 0 6px;
  font-family: var(--font-display);
  font-stretch: var(--display-stretch);
  font-size: 0.85rem;
  font-weight: 800;
  text-transform: uppercase;
}

label {
  display: grid;
  gap: 4px;
  font-weight: 600;
  font-size: 0.9rem;
}

.pair {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 14px;
}

.hint {
  margin: 0;
  font-size: 0.85rem;
}

.check {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 1rem;
  font-weight: 500;
}

.check input {
  width: 20px;
  height: 20px;
  margin-top: 2px;
}

textarea {
  font: inherit;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text);
}
</style>
