<script setup lang="ts">
import { useToast } from '@/stores/toast'

const toast = useToast()
</script>

<template>
  <div class="toasts" aria-live="polite">
    <p v-for="t in toast.items" :key="t.id" class="toast" :class="`toast--${t.tone}`" :role="t.tone === 'error' ? 'alert' : 'status'">
      <span>{{ t.tone === 'error' ? '✕' : '✓' }} {{ t.text }}</span>
      <button type="button" class="close" aria-label="Dismiss" @click="toast.dismiss(t.id)">×</button>
    </p>
  </div>
</template>

<style scoped>
.toasts {
  position: fixed;
  left: 50%;
  bottom: max(16px, env(safe-area-inset-bottom));
  transform: translateX(-50%);
  width: min(520px, calc(100vw - 32px));
  display: grid;
  gap: 8px;
  z-index: 50;
}

.toast {
  margin: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  font-weight: 600;
  box-shadow: 0 8px 24px var(--color-scrim);
}

.toast--ok {
  border-color: var(--color-success);
}

.toast--error {
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.close {
  background: none;
  border: 0;
  color: inherit;
  font: inherit;
  font-size: 1.3rem;
  line-height: 1;
  cursor: pointer;
  min-width: 32px;
  min-height: 32px;
}
</style>
