<script setup lang="ts">
import { computed, ref } from 'vue'
import { day, today } from '@/lib/db'
import type { Answer, AnswerRecord } from '@/lib/call'

const props = defineProps<{ mine: AnswerRecord | undefined; gigDate: string; busy: boolean }>()
const emit = defineEmits<{ answer: [value: Answer, until?: string] }>()

const changing = ref(false)
const picking = ref(false)
const until = ref('')
const asking = computed(() => !props.mine || changing.value)
const latest = computed(() => props.gigDate)

function send(value: Answer) {
  if (value === 'later') {
    if (!until.value) return
    emit('answer', 'later', until.value)
  } else emit('answer', value)
  changing.value = false
  picking.value = false
}
</script>

<template>
  <div class="answer">
    <template v-if="asking">
      <p class="q">Can you make it?</p>
      <div class="two">
        <button type="button" class="big yes" :disabled="busy" @click="send('yes')">I'm in</button>
        <button type="button" class="big no" :disabled="busy" @click="send('no')">Can't make it</button>
      </div>
      <button v-if="!picking" type="button" class="link later" @click="picking = true">Not sure yet · I'll know by…</button>
      <form v-else class="pick" @submit.prevent="send('later')">
        <label>I'll know by
          <input v-model="until" type="date" required :min="today()" :max="latest || undefined" @click="($event.target as HTMLInputElement).showPicker?.()" />
        </label>
        <button type="submit" class="btn" :disabled="busy || !until">Save</button>
        <button type="button" class="btn btn--ghost" @click="picking = false">Cancel</button>
      </form>
      <button v-if="changing" type="button" class="link" @click="changing = false">Keep my answer</button>
    </template>
    <div v-else class="given">
      <span v-if="mine?.answer === 'yes'" class="state state--yes">You're in</span>
      <span v-else-if="mine?.answer === 'no'" class="state state--no">You can't make it</span>
      <span v-else class="state state--later">You'll know by {{ day(mine?.until ?? '', { weekday: 'short', month: 'short', day: 'numeric' }) }}</span>
      <button type="button" class="link" @click="changing = true">Change</button>
    </div>
  </div>
</template>

<style scoped>
.answer {
  display: grid;
  gap: 12px;
}

.q {
  margin: 0;
  font-family: var(--font-display);
  font-stretch: var(--display-stretch);
  font-size: 1.05rem;
  font-weight: 800;
  text-transform: uppercase;
}

.two {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.big {
  min-height: 56px;
  border-radius: var(--radius);
  font: inherit;
  font-size: 0.95rem;
  font-weight: 800;
  font-stretch: 100%;
  letter-spacing: 0.03em;
  white-space: nowrap;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s, transform 0.15s;
}

.yes {
  border: 2px solid var(--color-accent);
  background: var(--color-accent);
  color: var(--color-accent-ink);
}

.yes:hover {
  background: var(--color-accent-strong);
  box-shadow: 0 0 32px var(--color-glow);
  transform: translateY(-1px);
}

.no {
  border: 2px solid var(--color-text);
  background: transparent;
  color: var(--color-text);
}

.no:hover {
  background: var(--color-text);
  color: var(--color-bg);
}

.big:disabled {
  opacity: 0.6;
  cursor: wait;
}

.later {
  justify-self: start;
  font-size: 0.95rem;
  padding: 6px 0;
}

.pick {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 10px;
}

.pick label {
  display: grid;
  gap: 4px;
  font-weight: 600;
  font-size: 0.9rem;
}

.given {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.state {
  font-size: 1.1rem;
  font-weight: 800;
}

.state--yes {
  color: var(--color-success);
}

.state--no {
  color: var(--color-danger);
}

.state--later {
  color: var(--color-warning);
}
</style>
