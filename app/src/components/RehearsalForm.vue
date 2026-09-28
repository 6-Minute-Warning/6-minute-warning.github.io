<script setup lang="ts">
import { ref, watch } from 'vue'
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { logEvent } from '@/lib/db'
import type { Gig } from '@/lib/gigs'
import { MAX_REHEARSALS, NOTE_LENGTH, rehearsalAnswer } from '@/lib/rehearsals'
import { useAuth } from '@/stores/auth'
import { useToast } from '@/stores/toast'

const props = defineProps<{ gigId: string; gig: Gig; cancel?: boolean }>()
const emit = defineEmits<{ done: [] }>()

const auth = useAuth()
const toast = useToast()
const needed = ref(props.gig.rehearsals?.needed ?? 2)
const note = ref(props.gig.rehearsals?.note ?? '')
const busy = ref(false)

watch(
  () => props.gig.rehearsals,
  (r) => {
    needed.value = r?.needed ?? 2
    note.value = r?.note ?? ''
  },
)

function step(by: number) {
  needed.value = Math.min(MAX_REHEARSALS, Math.max(0, needed.value + by))
}

async function save() {
  busy.value = true
  const n = needed.value
  await toast.run(`Saved: ${n} rehearsal${n === 1 ? '' : 's'} for ${props.gig.name}.`, async () => {
    const rehearsals = rehearsalAnswer(n, note.value, auth.email, props.gig.performers, serverTimestamp())
    await updateDoc(doc(db, 'gigs', props.gigId), { rehearsals })
    emit('done')
    await logEvent(props.gigId, 'rehearsals', `${n} rehearsal${n === 1 ? '' : 's'} needed${rehearsals.note ? `: ${rehearsals.note}` : ''}`, auth.email)
  })
  busy.value = false
}
</script>

<template>
  <form class="form" @submit.prevent="save">
    <div class="stepper" role="group" aria-label="Rehearsals needed">
      <button type="button" class="step" :disabled="busy || needed <= 0" aria-label="One fewer" @click="step(-1)">−</button>
      <output class="n display" aria-live="polite">{{ needed }}</output>
      <button type="button" class="step" :disabled="busy || needed >= MAX_REHEARSALS" aria-label="One more" @click="step(1)">+</button>
      <span class="unit">{{ needed === 1 ? 'rehearsal' : 'rehearsals' }}</span>
    </div>
    <label class="note"><span>Note for the band <span class="muted">(optional)</span></span>
      <input v-model="note" :maxlength="NOTE_LENGTH" placeholder="e.g. 2 full + 1 sectional" />
    </label>
    <div class="buttons">
      <button type="submit" class="btn" :disabled="busy">Save</button>
      <button v-if="cancel" type="button" class="btn btn--ghost" @click="emit('done')">Cancel</button>
    </div>
  </form>
</template>

<style scoped>
.form {
  display: grid;
  gap: 14px;
}

.stepper {
  display: flex;
  align-items: center;
  gap: 12px;
}

.step {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 2px solid var(--color-accent);
  background: transparent;
  color: var(--color-text);
  font: inherit;
  font-size: 1.5rem;
  font-weight: 800;
  line-height: 1;
  cursor: pointer;
}

.step:hover:not(:disabled) {
  background: var(--color-accent);
  color: var(--color-accent-ink);
}

.step:disabled {
  opacity: 0.4;
  cursor: default;
}

.n {
  min-width: 2ch;
  text-align: center;
  font-size: 2.4rem;
  line-height: 1;
}

.unit {
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.note {
  display: grid;
  gap: 4px;
  font-weight: 600;
  font-size: 0.9rem;
}

.buttons {
  display: flex;
  gap: 8px;
}
</style>
