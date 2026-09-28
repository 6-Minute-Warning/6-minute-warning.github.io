<script setup lang="ts">
import wordmark from '@/assets/wordmark.png'
import { useAuth } from '@/stores/auth'

const auth = useAuth()
</script>

<template>
  <main class="signin">
    <div class="panel">
      <img :src="wordmark" alt="6 Minute Warning" width="245" height="60" />
      <p class="eyebrow">Backstage</p>
      <h1>Gigs, lineups and who's singing.</h1>
      <p class="muted">For the band and crew. Sign in with the Google account the band has on file.</p>
      <button type="button" class="btn" @click="auth.signIn()">Sign in with Google</button>
      <p v-if="auth.error" class="error" role="alert">✕ {{ auth.error }}</p>
    </div>
  </main>
</template>

<style scoped>
.signin {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 24px 16px;
  background: radial-gradient(circle at 70% 20%, var(--color-glow), transparent 55%), var(--color-bg);
}

.panel {
  width: min(460px, 100%);
  display: grid;
  gap: 14px;
  justify-items: start;
}

.panel img {
  height: 60px;
  width: auto;
  margin-bottom: 12px;
}

.panel h1 {
  margin: 0;
  font-size: clamp(1.8rem, 7vw, 2.6rem);
}

.panel p {
  margin: 0;
}

.panel .btn {
  margin-top: 8px;
}
</style>
