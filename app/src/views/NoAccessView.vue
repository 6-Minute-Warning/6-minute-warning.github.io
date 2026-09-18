<script setup lang="ts">
import { useAuth } from '@/stores/auth'

const auth = useAuth()
</script>

<template>
  <main class="center">
    <h1>No access yet</h1>
    <p>
      You're signed in as <strong>{{ auth.email }}</strong>, which isn't on the band's list. Ask a Backstage admin to add
      this address, then sign in again.
    </p>
    <p v-if="auth.user && !auth.user.emailVerified" class="muted">This Google account's email address isn't verified.</p>
    <button type="button" class="btn btn--ghost" @click="auth.signOut()">Sign out</button>
  </main>
</template>
