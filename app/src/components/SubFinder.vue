<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PersonRecord } from '@/lib/people'
import type { Answer } from '@/lib/call'

type Person = PersonRecord & { id: string }

const props = defineProps<{ out: Person | undefined; candidates: Person[]; message: string; busy: boolean }>()
const emit = defineEmits<{ answer: [personId: string, value: Answer] }>()

const skipped = ref<string[]>([])
const queue = computed(() => props.candidates.filter((c) => !skipped.value.includes(c.id)))
const current = computed(() => queue.value[0])
const after = computed(() => queue.value.slice(1))
const phone = (p: Person) => p.phone.replace(/[^0-9+]/g, '')
const bodyJoin = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) ? '&' : '?'
</script>

<template>
  <div class="finder">
    <p class="head">
      Finding a sub for <strong>{{ out?.name ?? 'someone' }}</strong><span v-if="out?.part" class="muted"> · {{ out.part }}</span>
    </p>
    <div v-if="current" class="next">
      <p class="who">
        <span class="label">Ask next</span>
        <strong>{{ current.name }}</strong>
        <span class="muted">{{ current.part || 'Sub' }}{{ current.phone ? ` · ${current.phone}` : '' }}</span>
      </p>
      <div v-if="current.phone" class="reach">
        <a class="btn btn--ghost" :href="`tel:${phone(current)}`">Call</a>
        <a class="btn btn--ghost" :href="`sms:${phone(current)}${bodyJoin}body=${encodeURIComponent(message)}`">Text</a>
      </div>
      <p v-else class="muted small">No phone number on the roster. Add one under Roster.</p>
      <div class="said">
        <button type="button" class="btn" :disabled="busy" @click="emit('answer', current.id, 'yes')">{{ current.name.split(' ')[0] }} said yes</button>
        <button type="button" class="btn btn--ghost" :disabled="busy" @click="emit('answer', current.id, 'no')">Said no</button>
        <button type="button" class="link" @click="skipped = [...skipped, current.id]">Skip for now</button>
      </div>
      <p v-if="after.length" class="muted small">Then: {{ after.map((p) => p.name.split(' ')[0]).join(', ') }}</p>
    </div>
    <p v-else class="muted">
      No subs left to ask.
      <button v-if="skipped.length" type="button" class="link" @click="skipped = []">Start over with the ones you skipped</button>
    </p>
  </div>
</template>

<style scoped>
.finder {
  display: grid;
  gap: 12px;
}

.head,
.who {
  margin: 0;
}

.who {
  display: grid;
  gap: 2px;
  font-size: 1.1rem;
}

.label {
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.next {
  display: grid;
  gap: 12px;
  padding: 14px;
  border-radius: var(--radius);
  background: var(--color-surface-raised);
}

.reach,
.said {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.reach .btn {
  flex: 1;
  text-align: center;
  text-decoration: none;
}

.small {
  font-size: 0.85rem;
  margin: 0;
}
</style>
