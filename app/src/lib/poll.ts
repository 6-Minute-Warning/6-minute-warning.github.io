import { computed, onUnmounted, ref, watch, type Ref } from 'vue'
import { deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc, type Timestamp, type Unsubscribe } from 'firebase/firestore'
import { db } from './firebase'
import { logEvent, useCollection } from './db'
import { summarize, type Answer, type AnswerRecord } from './call'
import type { Gig } from './gigs'
import type { PersonRecord } from './people'

export function myPersonId(person: string | undefined, email: string, people: (PersonRecord & { id: string })[]) {
  return person || people.find((p) => p.emails.some((e) => e.toLowerCase() === email))?.id || ''
}

export function useMyAnswers(gigIds: () => string[], me: () => string) {
  const mine = ref<Record<string, Answer | null>>({})
  const stops = new Map<string, Unsubscribe>()
  function stopAll() {
    stops.forEach((stop) => stop())
    stops.clear()
  }
  watch(
    () => [me(), ...gigIds()].join('|'),
    () => {
      const person = me()
      stopAll()
      mine.value = {}
      if (!person) return
      for (const id of gigIds()) {
        stops.set(
          id,
          onSnapshot(doc(db, 'gigs', id, 'answers', person), (snap) => {
            mine.value = { ...mine.value, [id]: snap.exists() ? (snap.data().answer as Answer) : null }
          }),
        )
      }
    },
    { immediate: true },
  )
  onUnmounted(stopAll)
  return mine
}

export function usePoll(gigId: string, gig: Readonly<Ref<Gig | null>>, by: () => string, nameOf: (id: string) => string, onError: (message: string) => void) {
  const { rows, ready } = useCollection<Omit<AnswerRecord, 'at'> & { at: Timestamp | null }>(`gigs/${gigId}/answers`)
  const answers = computed<Record<string, AnswerRecord>>(() =>
    Object.fromEntries(rows.value.map(({ id, at, ...a }) => [id, { ...a, at: at?.toMillis() ?? Date.now() }])),
  )
  const summary = computed(() => (gig.value?.call ? summarize(gig.value.call, answers.value) : null))

  async function syncLineup(next: Record<string, AnswerRecord>, log = false) {
    const g = gig.value
    if (!g?.call) return
    const s = summarize(g.call, next)
    const current = g.performers ?? []
    const performers = s.state === 'full' ? s.lineup : current.filter((id) => next[id]?.answer !== 'no')
    if (performers.join() === current.join()) return
    await updateDoc(doc(db, 'gigs', gigId), { performers })
    if (log && s.state === 'full') await logEvent(gigId, 'call', `lineup full: ${s.lineup.map(nameOf).join(', ')}`, by())
  }

  watch(
    () => summary.value?.state === 'full' && summary.value.lineup.join() !== (gig.value?.performers ?? []).join(),
    (behind) => {
      if (behind) syncLineup(answers.value).catch((e) => onError(e instanceof Error ? e.message : String(e)))
    },
    { immediate: true },
  )

  async function answer(personId: string, value: Answer | null) {
    if (answers.value[personId]?.answer === value) return
    const answerRef = doc(db, 'gigs', gigId, 'answers', personId)
    const next = { ...answers.value }
    if (value) {
      await setDoc(answerRef, { answer: value, by: by(), at: serverTimestamp() })
      next[personId] = { answer: value, by: by(), at: Date.now() }
    } else {
      await deleteDoc(answerRef)
      delete next[personId]
    }
    await logEvent(gigId, 'answer', `${nameOf(personId)}: ${value ?? 'cleared'}`, by())
    await syncLineup(next, true)
  }

  return { answers, summary, answer, syncLineup, ready }
}
