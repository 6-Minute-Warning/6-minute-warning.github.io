<script setup lang="ts">
import { computed } from 'vue'
import DateBlock from '@/components/DateBlock.vue'
import RehearsalForm from '@/components/RehearsalForm.vue'
import { LINEUP_SIZE } from '@/lib/call'
import type { GigRow } from '@/lib/gigs'
import type { PersonRecord } from '@/lib/people'
import { lineupChange, timeUntil } from '@/lib/rehearsals'

const props = defineProps<{ gig: GigRow; people: (PersonRecord & { id: string })[]; today: string }>()

const byId = computed(() => new Map(props.people.map((p) => [p.id, p])))
const first = (id: string) => (byId.value.get(id)?.name ?? id).split(' ')[0]
const singers = computed(() =>
  (props.gig.performers ?? []).map((id) => {
    const p = byId.value.get(id)
    return { id, name: p?.name ?? id, sub: p?.status === 'sub', part: p?.voice ?? '' }
  }),
)
const change = computed(() => (props.gig.rehearsals ? lineupChange(props.gig.rehearsals, props.gig.performers) : null))
const short = computed(() => LINEUP_SIZE - (props.gig.performers?.length ?? 0))
</script>

<template>
  <article class="ask">
    <header class="top">
      <DateBlock :date="gig.date" />
      <div class="title">
        <p class="eyebrow">Gig {{ timeUntil(gig.date, today) }}</p>
        <h3><RouterLink :to="`/gigs/${gig.id}`">{{ gig.name }}</RouterLink></h3>
      </div>
    </header>

    <p class="q">How many rehearsals before this one?</p>

    <dl class="facts">
      <div>
        <dt>Set</dt>
        <dd>{{ gig.sets || 'Not set' }}</dd>
      </div>
      <div>
        <dt>Singing</dt>
        <dd>
          <ul class="singers">
            <li v-for="s in singers" :key="s.id" :class="{ sub: s.sub }">
              {{ s.name }}<span v-if="s.sub" class="tag">sub{{ s.part ? ` · ${s.part}` : '' }}</span>
            </li>
          </ul>
          <p v-if="short > 0" class="warn">{{ short }} short of a full lineup</p>
        </dd>
      </div>
      <div v-if="gig.rehearsals">
        <dt>Last time</dt>
        <dd>
          You said <strong>{{ gig.rehearsals.needed }}</strong><span v-if="gig.rehearsals.note"> · {{ gig.rehearsals.note }}</span>
          <span v-if="change && (change.joined.length || change.left.length)" class="changed">
            Since then:
            <template v-if="change.joined.length">{{ change.joined.map(first).join(', ') }} in</template><template v-if="change.joined.length && change.left.length">; </template>
            <template v-if="change.left.length">{{ change.left.map(first).join(', ') }} out</template>
          </span>
        </dd>
      </div>
    </dl>

    <RehearsalForm :gig-id="gig.id" :gig="gig" />
  </article>
</template>

<style scoped>
.ask {
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

.q {
  margin: 0;
  font-family: var(--font-display);
  font-stretch: var(--display-stretch);
  font-size: 1.05rem;
  font-weight: 800;
  text-transform: uppercase;
}

.facts {
  display: grid;
  gap: 10px;
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

.singers {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.singers li {
  padding: 4px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-weight: 600;
}

.singers li.sub {
  border-color: var(--color-warning);
}

.tag {
  margin-left: 6px;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-warning);
}

.warn,
.changed {
  display: block;
  margin: 6px 0 0;
  color: var(--color-warning);
  font-weight: 600;
}
</style>
