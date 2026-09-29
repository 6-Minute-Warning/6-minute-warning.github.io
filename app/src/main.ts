import './styles/base.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

import { captureInstallPrompt } from './lib/install'

captureInstallPrompt()
if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => undefined)

createApp(App).use(createPinia()).use(router).mount('#app')
