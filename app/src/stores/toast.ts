import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Toast {
  id: number
  text: string
  tone: 'ok' | 'error'
}

export const useToast = defineStore('toast', () => {
  const items = ref<Toast[]>([])
  let next = 1

  function show(text: string, tone: Toast['tone'] = 'ok') {
    const id = next++
    items.value = [...items.value, { id, text, tone }]
    setTimeout(() => dismiss(id), tone === 'error' ? 8000 : 3000)
  }

  function dismiss(id: number) {
    items.value = items.value.filter((t) => t.id !== id)
  }

  async function run<T>(done: string, work: () => Promise<T>): Promise<T | undefined> {
    try {
      const result = await work()
      if (done) show(done)
      return result
    } catch (e) {
      show(e instanceof Error ? e.message : String(e), 'error')
      return undefined
    }
  }

  return { items, show, dismiss, run }
})
