<script setup lang="ts">
import { watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/stores/auth'
import { destination } from '@/lib/destination'
import ToastHost from '@/components/ToastHost.vue'

const auth = useAuth()
const route = useRoute()
const router = useRouter()

watch(
  () => [auth.status, auth.isAdmin],
  () => {
    if (auth.status === 'loading') return
    const name = destination(auth.status, auth.isAdmin, route.meta.access)
    if (name && name !== route.name) router.replace({ name })
  },
)
</script>

<template>
  <div id="chrome" />
  <fieldset :key="JSON.stringify(auth.viewing)" class="frame" :disabled="!!auth.viewing">
    <RouterView />
  </fieldset>
  <ToastHost />
</template>

<style scoped>
.frame {
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
}

.frame:disabled :deep(:disabled) {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}
</style>
