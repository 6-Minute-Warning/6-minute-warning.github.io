<script setup lang="ts">
import { computed } from 'vue'
import { install, installEvent, platform } from '@/lib/install'
import { useToast } from '@/stores/toast'

const props = defineProps<{ only?: 'iphone' | 'android' }>()
const toast = useToast()
const mine = platform(navigator.userAgent)
const show = computed(() => (props.only ? [props.only] : mine === 'desktop' ? ['iphone', 'android'] : [mine]))

async function installNow() {
  if (await install()) toast.show('Backstage is on your home screen.')
}
</script>

<template>
  <div class="steps">
    <section v-if="show.includes('iphone')" class="how">
      <h3>iPhone</h3>
      <ol>
        <li>Open this page in <strong>Safari</strong>.</li>
        <li>
          Tap Share
          <svg class="icon" viewBox="0 0 24 24" aria-label="the Share icon" role="img"><path d="M12 3v12M7 8l5-5 5 5M5 12v8h14v-8" /></svg>
          at the bottom of the screen.
        </li>
        <li>Scroll down and tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li>
        <li>Open Backstage from the 6 on your home screen.</li>
      </ol>
    </section>
    <section v-if="show.includes('android')" class="how">
      <h3>Android</h3>
      <button v-if="installEvent" type="button" class="btn" @click="installNow">Install Backstage</button>
      <ol v-else>
        <li>Open this page in <strong>Chrome</strong>.</li>
        <li>Tap the <strong>⋮</strong> menu at the top right.</li>
        <li>Tap <strong>Install app</strong> (or Add to Home screen), then <strong>Install</strong>.</li>
      </ol>
    </section>
  </div>
</template>

<style scoped>
.steps {
  display: grid;
  gap: 16px;
}

.how h3 {
  margin: 0 0 8px;
  font-size: 1rem;
}

ol {
  margin: 0;
  padding-left: 1.3em;
  display: grid;
  gap: 6px;
}

.icon {
  width: 18px;
  height: 18px;
  vertical-align: -3px;
  fill: none;
  stroke: var(--color-accent-strong);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
