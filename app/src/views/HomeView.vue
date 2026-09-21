<script setup lang="ts">
import { RouterLink } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import { useAuth } from '@/stores/auth'

const auth = useAuth()
</script>

<template>
  <AppHeader />
  <main class="page">
    <h1>Hi {{ auth.access?.name?.split(' ')[0] }}</h1>
    <p class="muted">
      <RouterLink to="/gigs">Gigs</RouterLink> holds the bookings, money and contract state.
      <RouterLink to="/roster">Roster</RouterLink> holds members, subs and crew. Contracts and payments come next.
    </p>
  </main>
</template>
