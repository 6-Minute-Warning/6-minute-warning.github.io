<script setup lang="ts">
import { computed, ref } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import { BROADCAST_LIMITS, broadcastReport, sendBroadcast } from '@/lib/broadcast'
import { useAuth } from '@/stores/auth'
import { useToast } from '@/stores/toast'

const auth = useAuth()
const toast = useToast()
const title = ref('')
const body = ref('')
const busy = ref(false)
const left = computed(() => BROADCAST_LIMITS.body - body.value.length)

async function send() {
  busy.value = true
  const result = await toast.run('', () => sendBroadcast(title.value, body.value))
  busy.value = false
  if (!result) return
  toast.show(broadcastReport(result))
  title.value = ''
  body.value = ''
}
</script>

<template>
  <AppHeader />
  <main class="page broadcast">
    <h1>Send a broadcast</h1>
    <p class="muted">Sends a notification to every phone that turned them on. Nothing is saved, so it can't be recalled.</p>
    <p v-if="!auth.isManager" class="muted">Only managers can send a broadcast.</p>
    <form v-else class="card" @submit.prevent="send">
      <label>Title <span class="muted">(optional)</span><input v-model="title" :maxlength="BROADCAST_LIMITS.title" placeholder="6MW Backstage" /></label>
      <label>
        Message
        <textarea v-model="body" rows="5" :maxlength="BROADCAST_LIMITS.body" required placeholder="Load-in moved to 4pm. Bring black shirts."></textarea>
      </label>
      <p class="muted count">{{ left }} left</p>
      <button type="submit" class="btn" :disabled="busy || !!auth.viewing || !body.trim()">{{ busy ? 'Sending…' : 'Send to everyone' }}</button>
    </form>
  </main>
</template>

<style scoped>
.broadcast {
  max-width: 560px;
  display: grid;
  gap: 16px;
}

.broadcast h1,
.broadcast p {
  margin: 0;
}

form {
  display: grid;
  gap: 12px;
}

label {
  display: grid;
  gap: 4px;
}

.count {
  font-size: 0.85rem;
  text-align: right;
}
</style>
