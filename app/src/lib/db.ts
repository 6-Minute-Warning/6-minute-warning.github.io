import { onUnmounted, ref, type Ref } from 'vue'
import { addDoc, collection, onSnapshot, query, serverTimestamp, type QueryConstraint } from 'firebase/firestore'
import { db } from './firebase'

export function useCollection<T>(name: string, ...constraints: QueryConstraint[]): { rows: Ref<(T & { id: string })[]>; error: Ref<string> } {
  const rows = ref([]) as Ref<(T & { id: string })[]>
  const error = ref('')
  const stop = onSnapshot(
    query(collection(db, name), ...constraints),
    (snap) => (rows.value = snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) }))),
    (e) => (error.value = e.message),
  )
  onUnmounted(stop)
  return { rows, error }
}

export function logEvent(gig: string, kind: string, detail: string, by: string) {
  return addDoc(collection(db, 'events'), { gig, kind, detail, by, at: serverTimestamp() })
}

export function money(amount: number) {
  const digits = Number.isInteger(amount) ? 0 : 2
  return (amount ?? 0).toLocaleString('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export function day(date: string, options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!date) return 'No date'
  return new Date(`${date}T12:00:00-06:00`).toLocaleDateString('en-CA', { ...options, timeZone: 'America/Edmonton' })
}

export function today() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Edmonton' })
}
