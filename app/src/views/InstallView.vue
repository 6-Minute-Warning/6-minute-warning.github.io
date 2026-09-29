<script setup lang="ts">
import wordmark from '@/assets/wordmark.png'
import InstallSteps from '@/components/InstallSteps.vue'
import { isInstalled } from '@/lib/install'

const installed = isInstalled()
</script>

<template>
  <main class="install">
    <div class="panel">
      <img :src="wordmark" alt="6 Minute Warning" width="196" height="48" />
      <p class="eyebrow">Backstage</p>
      <h1>Put Backstage on your phone.</h1>
      <p v-if="installed" class="muted">It's already installed. You're all set.</p>
      <template v-else>
        <p class="muted">It sits on your home screen like any app, opens without the browser, and keeps working when there's no signal.</p>
        <InstallSteps />
      </template>
      <RouterLink to="/" class="btn btn--ghost">Open Backstage</RouterLink>
    </div>
  </main>
</template>

<style scoped>
.install {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 24px 16px;
}

.panel {
  width: min(480px, 100%);
  display: grid;
  gap: 16px;
  justify-items: start;
}

.panel img {
  height: 48px;
  width: auto;
}

.panel h1,
.panel p {
  margin: 0;
}

.panel :deep(.steps) {
  width: 100%;
  padding: 18px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
}
</style>
