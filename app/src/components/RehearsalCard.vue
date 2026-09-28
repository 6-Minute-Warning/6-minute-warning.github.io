<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import DateBlock from '@/components/DateBlock.vue'
import { db } from '@/lib/firebase'
import { useCollection } from '@/lib/db'
import type { GigRow } from '@/lib/gigs'
import { cantMake, type RehearsalRow, type Reply } from '@/lib/schedule'
import { useAuth } from '@/stores/auth'
import { useToast } from '@/stores/toast'

const props = defineProps<{ rehearsal: RehearsalRow; gigs: GigRow[]; expected: string[]; me: string; nameOf: (id: string) => string; canEdit?: boolean }>()
const emit = defineEmits<{ edit: [] }>()

const auth = useAuth()
const toast = useToast()
const busy = ref(false)
const { rows } = useCollection<{ answer: Reply }>(`rehearsals/${props.rehearsal.id}/replies`)
const replies = computed<Record<string, Reply>>(() => Object.fromEntries(rows.value.map((r) => [r.id, r.answer])))
const out = computed(() => cantMake(replies.value).filter((id) => props.expected.includes(id)))
const coming = computed(() => props.expected.length - out.value.length)
const expectsMe = computed(() => props.expected.includes(props.me))
const mine = computed(() => replies.value[props.me])
const forGigs = computed(() => props.rehearsal.gigs.map((id) => props.gigs.find((g) => g.id === id)).filter((g): g is GigRow => !!g))
const time = computed(() => [props.rehearsal.start, props.rehearsal.end].filter(Boolean).join(' – ') || 'Not set yet')
const map = computed(() => `https://www.google.com/maps/search/${encodeURIComponent(props.rehearsal.address || props.rehearsal.place)}`)
const others = computed(() => out.value.filter((id) => id !== props.me).map((id) => props.nameOf(id).split(' ')[0]))

async function reply(answer: Reply) {
  busy.value = true
  await toast.run(answer === 'no' ? "Marked as can't make it." : "You're back on the list.", () =>
    setDoc(doc(db, 'rehearsals', props.rehearsal.id, 'replies', props.me), { answer, by: auth.email, at: serverTimestamp() }),
  )
  busy.value = false
}
</script>

<template>
  <article :id="`rehearsal-${rehearsal.id}`" class="rehearsal">
    <header class="top">
      <DateBlock :date="rehearsal.date" />
      <div class="title">
        <p class="eyebrow">{{ forGigs.length ? 'Rehearsal for' : 'Rehearsal' }}</p>
        <h3 v-if="forGigs.length">
          <template v-for="(g, i) in forGigs" :key="g.id">{{ i ? ', ' : '' }}<RouterLink :to="`/gigs/${g.id}`">{{ g.name }}</RouterLink></template>
        </h3>
        <h3 v-else>Whole band</h3>
      </div>
      <button v-if="canEdit" type="button" class="mini edit" @click="emit('edit')">Edit</button>
    </header>

    <dl class="facts">
      <div>
        <dt>Time</dt>
        <dd><strong>{{ time }}</strong></dd>
      </div>
      <div>
        <dt>Where</dt>
        <dd>
          <a v-if="rehearsal.place || rehearsal.address" :href="map" target="_blank" rel="noopener">{{ rehearsal.place || rehearsal.address }}</a>
          <span v-else class="muted">Not set yet</span>
          <span v-if="rehearsal.place && rehearsal.address" class="muted address">{{ rehearsal.address }}</span>
        </dd>
      </div>
      <div v-if="rehearsal.notes?.trim()">
        <dt>Notes</dt>
        <dd class="notes">{{ rehearsal.notes }}</dd>
      </div>
      <div>
        <dt>Coming</dt>
        <dd>
          <strong>{{ out.length ? `${coming} of ${expected.length}` : 'Everyone' }}</strong>
          <span v-if="others.length" class="muted"> · {{ others.join(', ') }} can't make it</span>
        </dd>
      </div>
    </dl>

    <div v-if="expectsMe" class="mine">
      <template v-if="mine === 'no'">
        <span class="state state--no">You can't make it</span>
        <button type="button" class="link" :disabled="busy" @click="reply('yes')">I can come after all</button>
      </template>
      <template v-else>
        <span class="state">You're expected</span>
        <button type="button" class="btn btn--ghost cant" :disabled="busy" @click="reply('no')">Can't make it</button>
      </template>
    </div>
  </article>
</template>

<style scoped>
.rehearsal {
  scroll-margin-top: 96px;
  display: grid;
  gap: 16px;
  padding: 18px;
  border: 1px solid var(--color-border);
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
  flex: 1;
}

.title h3 {
  margin: 0;
  font-size: 1.25rem;
}

.title a {
  color: var(--color-text);
  text-decoration: none;
}

.title a:hover {
  color: var(--color-accent-strong);
}

.edit {
  align-self: flex-start;
}

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

.notes {
  white-space: pre-line;
}

.mine {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 16px;
  padding-top: 14px;
  border-top: 1px solid var(--color-border);
}

.state {
  font-weight: 800;
}

.state--no {
  color: var(--color-danger);
}

.cant {
  min-height: 44px;
}
</style>
