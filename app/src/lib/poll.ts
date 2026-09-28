import { computed, onUnmounted, ref, watch, type Ref } from 'vue'
import { deleteDoc, deleteField, doc, onSnapshot, serverTimestamp, setDoc, updateDoc, writeBatch, type Timestamp, type Unsubscribe } from 'firebase/firestore'
import { db } from './firebase'
import { logEvent, useCollection } from './db'
import { summarize, type Answer, type AnswerRecord } from './call'
import type { Gig } from './gigs'
import { answersOn, hasOptions, leader, lockPlan, race, withAnswer, type StoredAnswer } from './options'

export type RawAnswer = Omit<StoredAnswer, 'at' | 'times'> & { id: string; at: Timestamp | null; times?: Record<string, Timestamp> }

export const fromRaw = ({ id: _id, at, times, ...a }: RawAnswer): StoredAnswer => ({
  ...a,
  at: at?.toMillis() ?? Date.now(),
  ...(times ? { times: Object.fromEntries(Object.entries(times).map(([d, t]) => [d, t?.toMillis?.() ?? Date.now()])) } : {}),
})
import type { PersonRecord } from './people'

export function myPersonId(person: string | undefined, email: string, people: (PersonRecord & { id: string })[]) {
  return person || people.find((p) => p.emails.some((e) => e.toLowerCase() === email))?.id || ''
}

export function useMyAnswers(gigIds: () => string[], me: () => string) {
  const mine = ref<Record<string, Pick<StoredAnswer, 'answer' | 'dates'> | null>>({})
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
            mine.value = { ...mine.value, [id]: snap.exists() ? { answer: snap.data().answer, dates: snap.data().dates } : null }
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
  const { rows, ready } = useCollection<RawAnswer>(`gigs/${gigId}/answers`)
  const stored = computed<Record<string, StoredAnswer>>(() => Object.fromEntries(rows.value.map((r) => [r.id, fromRaw(r)])))
  const answers = computed<Record<string, AnswerRecord>>(() =>
    Object.fromEntries(Object.entries(stored.value).flatMap(([id, a]) => (a.answer ? [[id, { ...a, answer: a.answer }]] : []))),
  )
  const options = computed(() => (hasOptions(gig.value) ? gig.value!.dateOptions! : []))
  const standings = computed(() => (options.value.length ? race(gig.value?.call, stored.value, options.value) : []))
  const leading = computed(() => leader(standings.value))
  const summary = computed(() => {
    if (!gig.value?.call) return null
    if (options.value.length) return (standings.value.find((s) => s.date === leading.value) ?? standings.value[0])!.summary
    return summarize(gig.value.call, answers.value)
  })

  async function syncLineup(next: Record<string, AnswerRecord>, log = false) {
    const g = gig.value
    if (!g?.call || hasOptions(g)) return
    const s = summarize(g.call, next)
    const current = g.performers ?? []
    const performers = s.state === 'full' ? s.lineup : current.filter((id) => next[id]?.answer !== 'no' && next[id]?.answer !== 'later')
    if (performers.join() === current.join()) return
    await updateDoc(doc(db, 'gigs', gigId), { performers })
    if (log && s.state === 'full') await logEvent(gigId, 'call', `lineup full: ${s.lineup.map(nameOf).join(', ')}`, by())
  }

  watch(
    () => !options.value.length && summary.value?.state === 'full' && summary.value.lineup.join() !== (gig.value?.performers ?? []).join(),
    (behind) => {
      if (behind) syncLineup(answers.value).catch((e) => onError(e instanceof Error ? e.message : String(e)))
    },
    { immediate: true },
  )

  async function answer(personId: string, value: Answer | null, until?: string) {
    if (answers.value[personId]?.answer === value && answers.value[personId]?.until === until) return
    const answerRef = doc(db, 'gigs', gigId, 'answers', personId)
    const next = { ...answers.value }
    if (value) {
      const extra = value === 'later' && until ? { until } : {}
      await setDoc(answerRef, { answer: value, by: by(), at: serverTimestamp(), ...extra })
      next[personId] = { answer: value, by: by(), at: Date.now(), ...extra }
    } else {
      await deleteDoc(answerRef)
      delete next[personId]
    }
    await logEvent(gigId, 'answer', `${nameOf(personId)}: ${value === 'later' ? `will know by ${until}` : (value ?? 'cleared')}`, by())
    await syncLineup(next, true)
  }

  async function answerOn(personId: string, date: string, value: Answer | null, until?: string) {
    const next = withAnswer(stored.value[personId], date, value, until)
    const answerRef = doc(db, 'gigs', gigId, 'answers', personId)
    const raw = rows.value.find((r) => r.id === personId)
    const times = next && Object.fromEntries(Object.keys(next.dates).map((d) => [d, (d !== date && (raw?.times?.[d] ?? raw?.at)) || serverTimestamp()]))
    if (next) await setDoc(answerRef, { ...next, times, by: by(), at: serverTimestamp() })
    else await deleteDoc(answerRef)
    const said = value === 'later' ? `will know by ${next?.until}` : (value ?? 'cleared')
    await logEvent(gigId, 'answer', `${nameOf(personId)} for ${date}: ${said}`, by())
  }

  async function lockDate(date: string) {
    if (rows.value.some((r) => !r.at || Object.values(r.times ?? {}).some((t) => !t))) throw new Error('An answer is still saving. Try again in a moment.')
    const { carry, clear } = lockPlan(rows.value, date)
    const kept = Object.fromEntries(carry.map(({ row }) => [row.id, fromRaw(row)]))
    const s = gig.value?.call ? summarize(gig.value.call, answersOn(kept, date)) : null
    const batch = writeBatch(db)
    batch.update(doc(db, 'gigs', gigId), { date, dateOptions: deleteField(), ...(s?.state === 'full' ? { performers: s.lineup } : {}) })
    for (const { row, answer, until } of carry) {
      batch.set(doc(db, 'gigs', gigId, 'answers', row.id), { answer, by: row.by, at: row.times?.[date] ?? row.at, ...(until ? { until } : {}) })
    }
    for (const id of clear) batch.delete(doc(db, 'gigs', gigId, 'answers', id))
    try {
      await batch.commit()
    } catch (e) {
      if ((e as { code?: string }).code === 'permission-denied') throw new Error('Someone answered while you were locking. Try again.')
      throw e
    }
    await logEvent(gigId, 'edit', `locked the date: ${date}`, by())
  }

  return { answers, stored, summary, standings, leading, answer, answerOn, lockDate, syncLineup, ready }
}
