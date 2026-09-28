<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { arrayUnion, deleteField, doc, onSnapshot, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore'
import AppHeader from '@/components/AppHeader.vue'
import DateBlock from '@/components/DateBlock.vue'
import LineupDial from '@/components/LineupDial.vue'
import SubFinder from '@/components/SubFinder.vue'
import TourAnswerCard from '@/components/TourAnswerCard.vue'
import TourFacts from '@/components/TourFacts.vue'
import TourForm from '@/components/TourForm.vue'
import TourStrip from '@/components/TourStrip.vue'
import { db } from '@/lib/firebase'
import { useCollection } from '@/lib/db'
import { LINEUP_SIZE, whatsappLink, type Answer } from '@/lib/call'
import { gigId, newGig } from '@/lib/gigs'
import type { PersonRecord } from '@/lib/people'
import { myPersonId } from '@/lib/poll'
import {
  answerText,
  blankDraft,
  coverage,
  datesChanged,
  datesText,
  dayKindLabels,
  daysFor,
  fromDraft,
  gaps,
  isCurrent,
  openTourCall,
  pickLineup,
  planDays,
  shortDate,
  toDraft,
  tourMessage,
  tourState,
  tourStateLabels,
  tourSubMessage,
  type Tour,
  type TourAnswerValue,
  type TourDayKind,
} from '@/lib/tour'
import { logTourEvent, useTourAnswers, type AnswerExtra } from '@/lib/tourPoll'
import { useAuth } from '@/stores/auth'
import { useToast } from '@/stores/toast'

const auth = useAuth()
const toast = useToast()
const route = useRoute()
const router = useRouter()
const id = route.params.id as string
const tour = ref<Tour | null>(null)
const loadError = ref('')
const busy = ref(false)
const confirmOff = ref(false)
const editing = ref(false)
const draft = ref(blankDraft())

const stop = onSnapshot(
  doc(db, 'tours', id),
  (snap) => (tour.value = snap.exists() ? (snap.data() as Tour) : null),
  (e) => (loadError.value = e.message),
)
onUnmounted(stop)

const { rows: people } = useCollection<PersonRecord>('people')
const byId = computed(() => new Map(people.value.map((p) => [p.id, p])))
const nameOf = (pid: string) => byId.value.get(pid)?.name ?? pid
const firstName = (pid: string) => (pid === me.value ? 'You' : (nameOf(pid).split(' ')[0] ?? pid))
const inline = (pid: string) => (pid === me.value ? 'you' : firstName(pid))
const me = computed(() => myPersonId(auth.access?.person, auth.email, people.value))
const members = computed(() => people.value.filter((p) => p.status === 'active'))
const isSub = (pid: string) => byId.value.get(pid)?.status === 'sub'

const { answers, answer: saveAnswer } = useTourAnswers(id, tour, () => auth.email, nameOf)

const cover = computed(() => (tour.value ? coverage(tour.value, answers.value) : []))
const shows = computed(() => cover.value.filter((d) => d.kind === 'show'))
const covered = computed(() => shows.value.filter((d) => !d.short))
const state = computed(() => (tour.value ? tourState(tour.value, answers.value) : 'waiting'))
const lineup = computed(() => (tour.value ? pickLineup(tour.value, answers.value, isSub) : {}))
const holes = computed(() => (tour.value && tour.value.stage === 'planning' ? gaps(tour.value, answers.value) : []))
const asked = computed(() => !!tour.value?.call?.asked.includes(me.value))
const link = computed(() => `${location.origin}/tours/${id}`)
const share = computed(() => (tour.value ? whatsappLink(tourMessage(tour.value, link.value)) : ''))
const showShare = computed(() => route.query.share === '1')
const minDial = computed(() => (shows.value.length ? Math.min(...shows.value.map((d) => d.in.length)) : 0))
const waitingText = computed(() => {
  const t = tour.value
  if (!t?.call) return ''
  const open = t.call.asked.filter((pid) => !isCurrent(answers.value[pid], t) || answers.value[pid]?.answer === 'later')
  const later = open.filter((pid) => isCurrent(answers.value[pid], t) && answers.value[pid]?.answer === 'later')
  const silent = open.filter((pid) => !later.includes(pid))
  return [
    silent.length ? `waiting on ${silent.map(inline).join(', ')}` : '',
    later.length ? `will know: ${later.map((p) => `${inline(p)} by ${shortDate(answers.value[p]?.until ?? '')}`).join(', ')}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
})
const everyone = computed(() => {
  const ids = new Set([...(tour.value?.call?.asked ?? []), ...Object.keys(answers.value)])
  return [...ids].map((pid) => ({ id: pid, name: nameOf(pid), sub: isSub(pid), answer: answers.value[pid] }))
})
const subbingFor = computed(() => holes.value.filter((g) => tour.value?.call?.subbing.includes(g.person)))
const undecided = computed(() => holes.value.filter((g) => !tour.value?.call?.subbing.includes(g.person)))

function candidates(dates: string[]) {
  const t = tour.value
  if (!t) return []
  return (people.value.filter((p) => p.status === 'sub') as (PersonRecord & { id: string })[])
    .filter((p) => {
      const can = daysFor(answers.value[p.id], t)
      return !(isCurrent(answers.value[p.id], t) && answers.value[p.id]?.answer === 'no') && !dates.every((d) => can?.includes(d))
    })
}

function subsFor(out: string, dates: string[]) {
  const part = byId.value.get(out)?.part.trim().toLowerCase()
  const fits = (p: PersonRecord) => Number(!!part && p.part.trim().toLowerCase() === part)
  return candidates(dates).sort((a, b) => fits(b) - fits(a) || a.name.localeCompare(b.name))
}

async function act(done: string, work: () => Promise<unknown>) {
  busy.value = true
  await toast.run(done, work)
  busy.value = false
}

const tourRef = () => doc(db, 'tours', id)

function answer(personId: string, value: TourAnswerValue | null, extra: AnswerExtra = {}) {
  const done =
    personId !== me.value
      ? `${firstName(personId)}'s answer is saved.`
      : value === 'all'
        ? "You're in for the tour."
        : value === 'some'
          ? 'Your days are saved.'
          : value === 'no'
            ? 'Got it. The band will look for a sub.'
            : 'Saved.'
  return act(done, () => saveAnswer(personId, value, extra))
}

function subSaid(personId: string, value: Answer, dates: string[]) {
  const t = tour.value
  if (!t) return
  if (value !== 'yes') return answer(personId, 'no')
  const had = daysFor(answers.value[personId], t) ?? []
  const days = [...new Set([...had, ...dates])]
  return days.length >= t.days.length ? answer(personId, 'all') : answer(personId, 'some', { days })
}

function askBand() {
  return act('The band has been asked.', async () => {
    await updateDoc(tourRef(), { call: openTourCall(members.value.map((p) => p.id), auth.email, Date.now()) })
    await logTourEvent(id, 'call', 'asked the band', auth.email)
    await router.replace({ query: { share: '1' } })
  })
}

function findSub(personId: string) {
  return act('', async () => {
    await updateDoc(tourRef(), { 'call.subbing': arrayUnion(personId) })
    await logTourEvent(id, 'call', `finding a sub for ${nameOf(personId)}`, auth.email)
  })
}

function commit() {
  const picked = lineup.value
  return act('Committed. Time to book flights.', async () => {
    await updateDoc(tourRef(), { stage: 'committed', lineup: picked })
    for (const d of tour.value?.days ?? []) {
      if (d.gig && picked[d.date]) await updateDoc(doc(db, 'gigs', d.gig), { performers: picked[d.date] })
    }
    await logTourEvent(id, 'call', 'committed the lineup', auth.email)
  })
}

function setStage(stage: Tour['stage'], done: string, what: string) {
  confirmOff.value = false
  return act(done, async () => {
    await updateDoc(tourRef(), stage === 'planning' ? { stage, lineup: deleteField() } : { stage })
    await logTourEvent(id, 'call', what, auth.email)
  })
}

function saveDay(date: string, patch: { kind?: TourDayKind; place?: string; gig?: string }) {
  const days = (tour.value?.days ?? []).map((d) => (d.date === date ? { ...d, ...patch } : d))
  return act('', async () => {
    await updateDoc(tourRef(), { days })
  })
}

function makeGig(date: string) {
  const t = tour.value
  const d = t?.days.find((x) => x.date === date)
  if (!t || !d) return
  const name = d.place ? `${t.name}: ${d.place}` : t.name
  const gid = gigId(name, date)
  return act('The gig is made. Fill in venue and times on its page.', async () => {
    await runTransaction(db, async (tx) => {
      const ref = doc(db, 'gigs', gid)
      if ((await tx.get(ref)).exists()) throw new Error('A gig with this name and date already exists.')
      const gig = newGig({ name, date, time: '', venue: '' })
      tx.set(ref, { ...gig, performers: t.lineup?.[date] ?? [], tour: id, createdAt: serverTimestamp(), createdBy: auth.email })
      tx.update(tourRef(), { days: t.days.map((x) => (x.date === date ? { ...x, gig: gid } : x)) })
    })
    await logTourEvent(id, 'edit', `made a gig for ${shortDate(date)}`, auth.email)
  })
}

function saveEdit() {
  const t = tour.value
  if (!t) return
  const fields = fromDraft(draft.value)
  const moved = datesChanged(t, fields)
  const reopen = moved && t.stage === 'committed' ? { stage: 'planning', lineup: deleteField() } : {}
  const patch = moved ? { ...fields, days: planDays(fields.start, fields.end, t.days), version: t.version + 1, ...reopen } : fields
  return act(moved ? 'Saved. The dates moved, so everyone is asked to check their answer.' : 'Saved.', async () => {
    await updateDoc(tourRef(), patch)
    await logTourEvent(id, 'edit', moved ? 'moved the dates' : 'edited the tour', auth.email)
    editing.value = false
  })
}

async function copyLink() {
  await toast.run('Link copied.', () => navigator.clipboard.writeText(link.value))
}
</script>

<template>
  <AppHeader />
  <main class="page tour">
    <p v-if="loadError" class="error" role="alert">✕ {{ loadError }}</p>
    <p v-else-if="!tour" class="muted">Loading…</p>
    <template v-else>
      <RouterLink to="/gigs" class="back">← Gigs</RouterLink>

      <header class="hero">
        <p class="chips">
          <span class="chip">Tour</span>
          <span class="chip" :class="state === 'committed' || state === 'holds' ? 'chip--ok' : state === 'cancelled' ? 'chip--bad' : 'chip--warn'">{{ tourStateLabels[state] }}</span>
        </p>
        <div class="title">
          <DateBlock :date="tour.start" />
          <h1>{{ tour.name }}</h1>
        </div>
        <TourFacts :tour="tour" />
      </header>

      <section v-if="showShare && tour.call" class="card share">
        <h2>The band has been asked. Tell them.</h2>
        <p class="muted">Post it in the band's WhatsApp group so everyone sees it now.</p>
        <div class="row">
          <a class="btn" :href="share" target="_blank" rel="noopener">Send to WhatsApp</a>
          <button type="button" class="btn btn--ghost" @click="copyLink">Copy link</button>
          <RouterLink class="link" :to="{ query: {} }">Done</RouterLink>
        </div>
      </section>

      <section v-if="!tour.call" class="card">
        <h2>Who's coming?</h2>
        <template v-if="auth.isManager">
          <p class="muted">Ask the {{ members.length }} members. Each show day needs {{ LINEUP_SIZE }}.</p>
          <button type="button" class="btn" :disabled="busy || !members.length" @click="askBand">Ask the band</button>
        </template>
        <p v-else class="muted">A manager asks the band once the plan is ready.</p>
      </section>

      <section v-else class="card coverage">
        <div class="dialrow">
          <LineupDial :filled="Math.min(minDial, LINEUP_SIZE)" :size="64" />
          <div class="count">
            <strong class="display">{{ shows.length ? `${covered.length} of ${shows.length} show days have ${LINEUP_SIZE}` : 'No show days marked yet' }}</strong>
            <span v-if="waitingText && state !== 'committed'" class="muted">{{ waitingText }}</span>
          </div>
        </div>
        <TourStrip :cover="cover" :name-of="nameOf" :me="me" />
        <p class="muted small">Tap a day to see who's there. Show days need {{ LINEUP_SIZE }}; the dial on each day fills as people say yes.</p>

        <TourAnswerCard
          v-if="asked && tour.stage === 'planning'"
          :mine="answers[me]"
          :tour="tour"
          :busy="busy"
          @answer="(value, extra) => answer(me, value, extra)"
        />
        <p v-else-if="asked && tour.stage === 'committed'" class="mine">
          <span class="label">You</span> {{ answerText(answers[me], tour) }}
        </p>

        <div v-for="g in undecided" :key="g.person" class="decide" role="group" :aria-label="`${nameOf(g.person)} is away on show days`">
          <p>
            <strong>{{ g.person === me ? "You're away" : `${firstName(g.person)} is away` }} on {{ datesText(g.dates) }}</strong>, and those shows are short.
          </p>
          <div class="row">
            <button type="button" class="btn" :disabled="busy" @click="findSub(g.person)">Find a sub for {{ g.dates.length === shows.length ? 'the tour' : 'those days' }}</button>
          </div>
        </div>

        <SubFinder
          v-for="g in subbingFor"
          :key="`sub-${g.person}`"
          :out="byId.get(g.person) ? { ...byId.get(g.person)!, id: g.person } : undefined"
          :candidates="subsFor(g.person, g.dates)"
          :message="tourSubMessage(tour, byId.get(g.person)?.part ?? '', g.dates)"
          :busy="busy"
          @answer="(pid, value) => subSaid(pid, value, g.dates)"
        />
      </section>

      <section v-if="tour.call && auth.isManager && tour.stage === 'planning'" class="card commit">
        <h2>Commit the lineup</h2>
        <template v-if="state === 'holds'">
          <p>Every show day has {{ LINEUP_SIZE }}. Committing sets who sings each day, so flights can be booked.</p>
          <ul class="days">
            <li v-for="(ids, date) in lineup" :key="date"><span class="label">{{ shortDate(String(date)) }}</span> {{ ids.map(firstName).join(', ') }}</li>
          </ul>
          <button type="button" class="btn" :disabled="busy" @click="commit">Commit the lineup</button>
        </template>
        <p v-else-if="!shows.length" class="muted">Mark the show days below first.</p>
        <p v-else class="muted">
          Short on {{ datesText(shows.filter((d) => d.short).map((d) => d.date)) }}.
          <template v-if="tour.commitBy">The band commits by {{ shortDate(tour.commitBy) }}.</template>
        </p>
      </section>

      <section v-if="tour.stage === 'committed'" class="card commit">
        <h2>The lineup is set</h2>
        <ul class="days">
          <li v-for="d in shows" :key="d.date"><span class="label">{{ shortDate(d.date) }}</span> {{ (tour.lineup?.[d.date] ?? []).map(firstName).join(', ') }}</li>
        </ul>
        <div v-if="auth.isManager" class="row">
          <button type="button" class="btn btn--ghost" :disabled="busy" @click="setStage('planning', 'The tour is open again.', 'reopened the tour')">Reopen</button>
        </div>
      </section>

      <details v-if="tour.call" class="card everyone">
        <summary>Everyone's answers</summary>
        <p class="muted small">Record an answer someone gave in WhatsApp or by phone.</p>
        <ul class="answers">
          <li v-for="p in everyone" :key="p.id">
            <span class="who">{{ p.name }}<span v-if="p.sub" class="muted"> · sub</span></span>
            <span class="chip" :class="!isCurrent(p.answer, tour) ? '' : p.answer?.answer === 'no' ? 'chip--bad' : p.answer?.answer === 'later' ? 'chip--warn' : 'chip--ok'">{{ answerText(p.answer, tour) }}</span>
            <span class="record">
              <button type="button" class="mini" :aria-label="`${p.name} is in for all of it`" :aria-pressed="isCurrent(p.answer, tour) && p.answer?.answer === 'all'" :disabled="busy" @click="answer(p.id, 'all')">All</button>
              <button type="button" class="mini" :aria-label="`${p.name} can't go`" :aria-pressed="isCurrent(p.answer, tour) && p.answer?.answer === 'no'" :disabled="busy" @click="answer(p.id, 'no')">Can't</button>
              <button v-if="p.answer" type="button" class="link" :disabled="busy" @click="answer(p.id, null)">Clear</button>
            </span>
            <span v-if="p.answer?.note" class="note muted">“{{ p.answer.note }}”</span>
          </li>
        </ul>
      </details>

      <section v-if="auth.isManager" class="manage">
        <h2 class="section">Manage</h2>
        <div class="card plan">
          <h3>Plan the days</h3>
          <p class="muted small">Mark which days are shows and where the band is. Make a show day into a gig once there's a venue.</p>
          <ul class="plan-days">
            <li v-for="d in tour.days" :key="d.date">
              <span class="when">{{ shortDate(d.date) }}</span>
              <select :value="d.kind" :aria-label="`${shortDate(d.date)} is a`" @change="saveDay(d.date, { kind: ($event.target as HTMLSelectElement).value as TourDayKind })">
                <option v-for="(label, k) in dayKindLabels" :key="k" :value="k">{{ label }}</option>
              </select>
              <input :value="d.place" maxlength="80" placeholder="City" :aria-label="`Where on ${shortDate(d.date)}`" @change="saveDay(d.date, { place: ($event.target as HTMLInputElement).value.trim() })" />
              <RouterLink v-if="d.gig" :to="`/gigs/${d.gig}`" class="gig">Gig</RouterLink>
              <button v-else-if="d.kind === 'show'" type="button" class="link gig" :disabled="busy" @click="makeGig(d.date)">Make a gig</button>
            </li>
          </ul>
        </div>

        <div class="card">
          <h3>The tour</h3>
          <button v-if="!editing" type="button" class="btn btn--ghost" @click="(draft = toDraft(tour)), (editing = true)">Edit dates, money and notes</button>
          <form v-else class="edit" @submit.prevent="saveEdit">
            <TourForm v-model="draft" />
            <p class="muted small">Moving the dates asks everyone to check their answer again{{ tour.stage === 'committed' ? ' and reopens the lineup' : '' }}.</p>
            <div class="row">
              <button type="submit" class="btn" :disabled="busy">Save</button>
              <button type="button" class="btn btn--ghost" @click="editing = false">Cancel</button>
            </div>
          </form>
          <div v-if="tour.stage !== 'cancelled'" class="row">
            <button v-if="!confirmOff" type="button" class="link" @click="confirmOff = true">Call off the tour</button>
            <template v-else>
              <span>Call off {{ tour.name }} for everyone?</span>
              <button type="button" class="btn btn--danger" :disabled="busy" @click="setStage('cancelled', 'The tour is called off.', 'called off the tour')">Call it off</button>
              <button type="button" class="btn btn--ghost" @click="confirmOff = false">Keep it</button>
            </template>
          </div>
          <button v-else type="button" class="btn btn--ghost" :disabled="busy" @click="setStage('planning', 'The tour is back on.', 'put the tour back on')">Put it back on</button>
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.tour {
  display: grid;
  gap: 16px;
  max-width: 760px;
  min-width: 0;
}

.back {
  justify-self: start;
  font-weight: 600;
  text-decoration: none;
}

.hero {
  display: grid;
  gap: 16px;
}

.title {
  display: flex;
  align-items: center;
  gap: 16px;
}

.hero h1 {
  margin: 0;
  font-size: clamp(1.6rem, 6vw, 2.6rem);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
}

.card {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.card h2,
.card h3 {
  margin: 0;
  font-size: 1.05rem;
}

.share {
  border-color: var(--color-accent);
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.row .btn {
  text-decoration: none;
}

.dialrow {
  display: flex;
  align-items: center;
  gap: 16px;
}

.count {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.count .display {
  font-size: 1.15rem;
}

.small {
  margin: 0;
  font-size: 0.85rem;
}

.label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  margin-right: 8px;
}

.mine {
  margin: 0;
  font-weight: 700;
}

.decide {
  display: grid;
  gap: 10px;
  padding: 14px;
  border-radius: var(--radius);
  border: 1px solid var(--color-warning);
}

.decide p,
.commit p {
  margin: 0;
}

.days {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.everyone summary {
  cursor: pointer;
  font-weight: 700;
  font-size: 1.05rem;
  min-height: 32px;
}

.answers {
  list-style: none;
  margin: 0;
  padding: 0;
}

.answers li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 10px 0;
  border-bottom: 1px solid var(--color-border);
}

.answers .who {
  flex: 1 1 140px;
  font-weight: 600;
}

.record {
  display: flex;
  align-items: center;
  gap: 6px;
}

.note {
  flex-basis: 100%;
  font-size: 0.9rem;
}

.section {
  margin: 16px 0 8px;
  font-size: 0.8rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.manage {
  display: grid;
  gap: 16px;
}

.plan-days {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.plan-days li {
  display: grid;
  grid-template-columns: 64px 96px minmax(0, 1fr) 84px;
  align-items: center;
  gap: 8px;
}

.plan-days input,
.plan-days select {
  min-width: 0;
}

.when {
  font-weight: 700;
  font-size: 0.9rem;
}

.gig {
  justify-self: start;
  font-size: 0.85rem;
}

.edit {
  display: grid;
  gap: 16px;
}
</style>
