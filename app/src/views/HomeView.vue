<script setup lang="ts">
import AppHeader from '@/components/AppHeader.vue'
import { useAuth } from '@/stores/auth'

const auth = useAuth()
</script>

<template>
  <AppHeader />
  <main class="page">
    <h1>Hi {{ auth.access?.name?.split(' ')[0] }}</h1>
    <p class="muted">Gigs, contracts and payments land here next. Admins manage who can sign in under Access.</p>
  </main>
</template>
