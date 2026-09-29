import { ref } from 'vue'

interface InstallEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export const installEvent = ref<InstallEvent | null>(null)

export function captureInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    installEvent.value = e as InstallEvent
  })
  window.addEventListener('appinstalled', () => (installEvent.value = null))
}

export function isInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function platform(ua: string): 'iphone' | 'android' | 'desktop' {
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && /Mobile/.test(ua))) return 'iphone'
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
}

export async function install() {
  const e = installEvent.value
  if (!e) return false
  await e.prompt()
  const { outcome } = await e.userChoice
  installEvent.value = null
  return outcome === 'accepted'
}
