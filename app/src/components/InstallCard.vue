<script setup lang="ts">
import { ref } from 'vue'
import InstallSteps from '@/components/InstallSteps.vue'
import { isInstalled, platform } from '@/lib/install'

const KEY = 'backstage.install-dismissed'
const read = () => {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}
const hidden = ref(isInstalled() || platform(navigator.userAgent) === 'desktop' || read())

function dismiss() {
  hidden.value = true
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    return
  }
}
</script>

<template>
  <section v-if="!hidden" class="card install" aria-labelledby="install-title">
    <div class="head">
      <h2 id="install-title">Put Backstage on your home screen</h2>
      <button type="button" class="link" @click="dismiss">Not now</button>
    </div>
    <p class="muted">It opens like an app and works with no signal, backstage at the venue.</p>
    <InstallSteps />
  </section>
</template>

<style scoped>
.install {
  display: grid;
  gap: 12px;
  border-color: var(--color-accent);
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
}

.head h2 {
  margin: 0;
  font-size: 1.05rem;
}

.install p {
  margin: 0;
}
</style>
