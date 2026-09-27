<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { where } from 'firebase/firestore'
import AppHeader from '@/components/AppHeader.vue'
import PollRow from '@/components/PollRow.vue'
import TaskRow from '@/components/TaskRow.vue'
import type { Task } from '@/lib/directory'
import { today, useCollection } from '@/lib/db'
import type { Gig } from '@/lib/gigs'
import type { PersonRecord } from '@/lib/people'
import { myPersonId, useMyAnswers } from '@/lib/poll'
import { useAuth } from '@/stores/auth'

const auth = useAuth()
const { rows, error } = useCollection<Gig>('gigs', where('call.abandoned', '==', false))
const now = today()
const polls = computed(() => rows.value.filter((g) => g.date >= now).sort((a, b) => a.date.localeCompare(b.date)))
const { rows: people, ready: peopleReady } = useCollection<PersonRecord>('people')
const me = computed(() => myPersonId(auth.access?.person, auth.email, people.value))
const nameOf = (id: string) => people.value.find((p) => p.id === id)?.name ?? id
const mine = useMyAnswers(() => polls.value.map((g) => g.id), () => me.value)
const loading = computed(() => !peopleReady.value || polls.value.some((g) => me.value && !(g.id in mine.value)))
const needsMe = (g: Gig & { id: string }) => !!me.value && !!g.call?.asked.includes(me.value) && mine.value[g.id] === null
const todo = computed(() => polls.value.filter(needsMe))
const answered = computed(() => polls.value.filter((g) => !needsMe(g)))
const myTasks = auth.isManager ? useCollection<Task>('tasks', where('open', '==', true)).rows : computed(() => [] as (Task & { id: string })[])
</script>

<template>
  <AppHeader />
  <main class="page">
    <h1>Hi {{ auth.access?.name?.split(' ')[0] }}</h1>

    <section class="card todo">
      <h2>To do</h2>
      <p v-if="error" class="error" role="alert">✕ {{ error }}</p>
      <p v-if="loading" class="muted">Loading…</p>
      <ul v-else-if="todo.length || myTasks.length">
        <PollRow v-for="g in todo" :key="g.id" :gig="g" :me="me" :needs-me="needsMe(g)" :name-of="nameOf" />
        <TaskRow v-for="t in myTasks" :id="t.id" :key="t.id" :task="t" />
      </ul>
      <p v-else class="muted">Nothing needs you right now.</p>
    </section>

    <section v-if="!loading && answered.length" class="polls">
      <h2>Open polls</h2>
      <ul>
        <PollRow v-for="g in answered" :key="g.id" :gig="g" :me="me" :needs-me="needsMe(g)" :name-of="nameOf" />
      </ul>
    </section>
    <p v-else-if="!loading && !todo.length && !myTasks.length" class="muted">
      No open polls.
      <template v-if="auth.isManager">Add the gig under <RouterLink to="/gigs">Gigs</RouterLink>, then open its poll.</template>
      <template v-else>Open a poll from any gig's page under <RouterLink to="/gigs">Gigs</RouterLink>.</template>
    </p>

    <p class="muted">
      <RouterLink to="/gigs">Gigs</RouterLink> holds the bookings, money and contract state.
      <RouterLink to="/roster">Roster</RouterLink> holds members, subs and crew. Contracts and payments come next.
    </p>
  </main>
</template>

<style scoped>
.todo,
.polls {
  margin: 16px 0 24px;
}

.todo h2,
.polls h2 {
  margin: 0 0 4px;
  font-size: 1.05rem;
}

.todo ul,
.polls ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
</style>
