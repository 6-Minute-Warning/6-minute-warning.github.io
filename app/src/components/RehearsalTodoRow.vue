<script setup lang="ts">
import { ref } from 'vue'
import RehearsalBookForm from '@/components/RehearsalBookForm.vue'
import type { GigRow } from '@/lib/gigs'
import type { PersonRecord } from '@/lib/people'
import type { RehearsalRow, RehearsalTodo } from '@/lib/schedule'

defineProps<{ todo: RehearsalTodo; rehearsals: RehearsalRow[]; gigs: GigRow[]; people: (PersonRecord & { id: string })[] }>()

const open = ref(false)
</script>

<template>
  <li class="row">
    <span class="what">
      <strong>{{ todo.title }}</strong>
      <span class="muted">{{ todo.detail }}</span>
    </span>
    <button v-if="!open" type="button" class="mini" @click="open = true">Book</button>
    <RehearsalBookForm v-else class="book" :rehearsals="rehearsals" :gigs="gigs" :people="people" :for-gig="todo.gig" @done="open = false" />
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
  gap: 2px;
  min-width: 0;
}

.what .muted {
  font-size: 0.9rem;
}

.book {
  flex-basis: 100%;
}
</style>
