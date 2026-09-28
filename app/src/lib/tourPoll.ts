import { computed, onUnmounted, ref, watch, type Ref } from 'vue'
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, type Timestamp, type Unsubscribe } from 'firebase/firestore'
import { db } from './firebase'
import { useCollection } from './db'
import type { Tour, TourAnswer, TourAnswerValue } from './tour'

type Stored = Omit<TourAnswer, 'at'> & { at: Timestamp | null }

const toAnswer = ({ at, ...a }: Stored): TourAnswer => ({ ...a, at: at?.toMillis() ?? Date.now() })

export interface AnswerExtra {
  days?: string[]
  until?: string
  note?: string
}

export function logTourEvent(tour: string, kind: string, detail: string, by: string) {
  return addDoc(collection(db, 'events'), { tour, kind, detail, by, at: serverTimestamp() }).then(
    () => undefined,
    () => undefined,
  )
}

export function answerWrite(value: TourAnswerValue, by: string, version: number, extra: AnswerExtra) {
  const note = extra.note?.trim().slice(0, 200)
  return {
    answer: value,
    by,
    version,
    ...(value === 'some' ? { days: [...new Set(extra.days ?? [])].sort() } : {}),
    ...(value === 'later' ? { until: extra.until ?? '' } : {}),
    ...(note ? { note } : {}),
  }
}

export function useTourAnswers(tourId: string, tour: Readonly<Ref<Tour | null>>, by: () => string, nameOf: (id: string) => string) {
  const { rows, ready } = useCollection<Stored>(`tours/${tourId}/answers`)
  const answers = computed<Record<string, TourAnswer>>(() => Object.fromEntries(rows.value.map(({ id, ...a }) => [id, toAnswer(a)])))

  async function answer(personId: string, value: TourAnswerValue | null, extra: AnswerExtra = {}) {
    const t = tour.value
    if (!t) return
    const answerRef = doc(db, 'tours', tourId, 'answers', personId)
    if (value) await setDoc(answerRef, { ...answerWrite(value, by(), t.version, extra), at: serverTimestamp() })
    else await deleteDoc(answerRef)
    const said = value === 'later' ? `will know by ${extra.until}` : value === 'some' ? `in for ${extra.days?.length ?? 0} days` : (value ?? 'cleared')
    await logTourEvent(tourId, 'answer', `${nameOf(personId)}: ${said}`, by())
  }

  return { answers, answer, ready }
}

export function useMyTourAnswers(tourIds: () => string[], me: () => string) {
  const mine = ref<Record<string, TourAnswer | null>>({})
  const stops = new Map<string, Unsubscribe>()
  function stopAll() {
    stops.forEach((stop) => stop())
    stops.clear()
  }
  watch(
    () => [me(), ...tourIds()].join('|'),
    () => {
      const person = me()
      stopAll()
      mine.value = {}
      if (!person) return
      for (const id of tourIds()) {
        stops.set(
          id,
          onSnapshot(
            doc(db, 'tours', id, 'answers', person),
            (snap) => (mine.value = { ...mine.value, [id]: snap.exists() ? toAnswer(snap.data() as Stored) : null }),
            () => (mine.value = { ...mine.value, [id]: null }),
          ),
        )
      }
    },
    { immediate: true },
  )
  onUnmounted(stopAll)
  return mine
}
