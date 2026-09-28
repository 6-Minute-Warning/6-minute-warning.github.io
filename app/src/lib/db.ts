import { computed, onUnmounted, ref, type Ref } from 'vue'
import { addDoc, collection, onSnapshot, query, serverTimestamp, type QueryConstraint } from 'firebase/firestore'
import { db } from './firebase'
import { normalizePerson, seatLookup, type PersonRecord } from './people'

export function useCollection<T>(name: string, ...constraints: QueryConstraint[]): { rows: Ref<(T & { id: string })[]>; error: Ref<string>; ready: Ref<boolean> } {
  const rows = ref([]) as Ref<(T & { id: string })[]>
  const error = ref('')
  const ready = ref(false)
  const stop = onSnapshot(
    query(collection(db, name), ...constraints),
    (snap) => {
      rows.value = snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) }))
      ready.value = true
    },
    (e) => (error.value = e.message),
  )
  onUnmounted(stop)
  return { rows, error, ready }
}

export function usePeople() {
  const { rows, error, ready } = useCollection<PersonRecord>('people')
  const people = computed(() => rows.value.map(normalizePerson))
  const byId = computed(() => new Map(people.value.map((p) => [p.id, p])))
  const seat = computed(() => seatLookup(people.value))
  return { people, byId, seat, error, ready }
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
