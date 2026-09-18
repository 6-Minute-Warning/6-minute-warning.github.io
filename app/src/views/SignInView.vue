<script setup lang="ts">
import { useAuth } from '@/stores/auth'

const auth = useAuth()
</script>

<template>
  <main class="center">
    <h1>6MW Backstage</h1>
    <p class="muted">Gigs, contracts and payments for 6 Minute Warning.</p>
    <button type="button" class="btn" @click="auth.signIn()">Sign in with Google</button>
    <p v-if="auth.error" class="error" role="alert">✕ {{ auth.error }}</p>
  </main>
</template>
