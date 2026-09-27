<script setup lang="ts">
import { computed, ref, toRef } from 'vue'
import { day } from '@/lib/db'
import type { GigRow } from '@/lib/gigs'
import type { Answer } from '@/lib/call'
import { usePoll } from '@/lib/poll'
import { useAuth } from '@/stores/auth'

const props = defineProps<{ gig: GigRow; me: string; needsMe: boolean; nameOf: (id: string) => string }>()

const auth = useAuth()
const error = ref('')
const busy = ref(false)
const { answers, answer } = usePoll(props.gig.id, toRef(props, 'gig'), () => auth.email, props.nameOf, (m) => (error.value = m))
const mine = computed(() => answers.value[props.me]?.answer ?? null)

async function reply(value: Answer) {
  error.value = ''
  busy.value = true
  try {
    await answer(props.me, value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

</script>

<template>
  <li class="row">
    <span class="what">
      <RouterLink :to="`/gigs/${gig.id}`">{{ gig.name }}</RouterLink>
      <span class="muted">{{ day(gig.date) }}{{ gig.venue ? ` · ${gig.venue}` : '' }}</span>
    </span>
    <span v-if="needsMe" class="reply">
      <span>Can you make it?</span>
      <button type="button" class="mini" :disabled="busy" @click="reply('yes')">Yes</button>
      <button type="button" class="mini" :disabled="busy" @click="reply('no')">No</button>
    </span>
    <span v-else-if="mine" class="chip" :class="mine === 'yes' ? 'chip--ok' : 'chip--bad'">You said {{ mine }}</span>
    <p v-if="error" class="error" role="alert">✕ {{ error }}</p>
  </li>
</template>

<style scoped>
.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--color-border);
}

.what {
  display: grid;
  font-weight: 700;
}

.what .muted {
  font-weight: 400;
}

.reply {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
}

.row .error {
  flex-basis: 100%;
  margin: 0;
}
</style>
