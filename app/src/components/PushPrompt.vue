<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { currentPushState, subscribe, unsubscribe, type PushState, type PushTopic } from '@/lib/push'
import { useAuth } from '@/stores/auth'
import { useToast } from '@/stores/toast'

const props = defineProps<{ topics: PushTopic[]; what: string }>()

const auth = useAuth()
const toast = useToast()
const state = ref<PushState>(currentPushState())
const busy = ref(false)
const dismissed = ref(stored('push-dismissed'))
const off = ref(stored('push-off'))
const show = computed(() => {
  if (state.value === 'granted') return off.value ? (dismissed.value ? '' : 'ask') : 'on'
  if (state.value === 'default') return dismissed.value ? '' : 'ask'
  if (state.value === 'install-first') return dismissed.value ? '' : 'install'
  if (state.value === 'denied') return dismissed.value ? '' : 'blocked'
  return ''
})

function stored(key: string) {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function store(key: string, on: boolean) {
  try {
    if (on) localStorage.setItem(key, '1')
    else localStorage.removeItem(key)
  } catch {
    /* storage blocked */
  }
}

function later() {
  dismissed.value = true
  store('push-dismissed', true)
}

async function turnOn() {
  busy.value = true
  const on = await toast.run('', () => subscribe(auth.email, props.topics))
  state.value = currentPushState()
  if (on) {
    off.value = false
    store('push-off', false)
    toast.show(`This phone will get a notification for ${props.what}.`)
  }
  busy.value = false
}

async function turnOff() {
  busy.value = true
  const done = await toast.run('Notifications are off on this phone.', async () => (await unsubscribe(), true))
  if (done) {
    off.value = true
    store('push-off', true)
  }
  busy.value = false
}

onMounted(() => {
  if (show.value === 'on') subscribe(auth.email, props.topics).catch(() => undefined)
})
</script>

<template>
  <div v-if="show === 'ask'" class="prompt card">
    <p><strong>Get a notification</strong> on this phone for {{ what }}.</p>
    <span class="buttons">
      <button type="button" class="btn" :disabled="busy" @click="turnOn">Turn on</button>
      <button type="button" class="link" @click="later">Not now</button>
    </span>
  </div>
  <div v-else-if="show === 'install'" class="prompt card">
    <p>To get a notification for {{ what }}, add Backstage to your home screen: tap Share, then Add to Home Screen.</p>
    <button type="button" class="link" @click="later">Got it</button>
  </div>
  <div v-else-if="show === 'blocked'" class="prompt card">
    <p>Notifications are blocked for Backstage on this phone. To get one for {{ what }}, allow notifications in your browser's site settings.</p>
    <button type="button" class="link" @click="later">Got it</button>
  </div>
  <p v-else-if="show === 'on'" class="on muted">
    This phone gets a notification for {{ what }}. <button type="button" class="link" :disabled="busy" @click="turnOff">Turn off</button>
  </p>
</template>

<style scoped>
.prompt {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 16px;
}

.prompt p {
  margin: 0;
}

.buttons {
  display: flex;
  align-items: center;
  gap: 16px;
}

.on {
  margin: 0;
  font-size: 0.85rem;
}
</style>
