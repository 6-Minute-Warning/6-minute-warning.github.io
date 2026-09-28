<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { arrayUnion, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import AppHeader from '@/components/AppHeader.vue'
import AnswerCard from '@/components/AnswerCard.vue'
import DateBlock from '@/components/DateBlock.vue'
import DateRace from '@/components/DateRace.vue'
import GigFacts from '@/components/GigFacts.vue'
import LineupDial from '@/components/LineupDial.vue'
import PayoutCard from '@/components/PayoutCard.vue'
import RehearsalsCard from '@/components/RehearsalsCard.vue'
import SubFinder from '@/components/SubFinder.vue'
import { db } from '@/lib/firebase'
import { day, logEvent, useCollection, usePeople } from '@/lib/db'
import { LINEUP_SIZE, callMessage, callStateLabels, openCall, subCandidates, subMessage, whatsappLink, type Answer } from '@/lib/call'
import { answersFromAttendees, calendarToken, eventBody, readEvent, saveEvent } from '@/lib/calendar'
import { DEFAULT_OUTFIT, clashes, contractLabels, contractStates, outfitLabel, outfits, stageLabels, type ContractState, type Gig, type Stage } from '@/lib/gigs'
import { dateSaid, hasOptions, optionClashes, optionsText } from '@/lib/options'
import { askLine, pollAsked } from '@/lib/people'
import { myPersonId, usePoll } from '@/lib/poll'
import { useAuth } from '@/stores/auth'
import { useToast } from '@/stores/toast'

const auth = useAuth()
const toast = useToast()
const route = useRoute()
const router = useRouter()
const id = route.params.id as string
const gig = ref<Gig | null>(null)
const loadError = ref('')
const busy = ref(false)
const confirmDrop = ref('')

const stop = onSnapshot(
  doc(db, 'gigs', id),
  (snap) => (gig.value = snap.exists() ? (snap.data() as Gig) : null),
  (e) => (loadError.value = e.message),
)
onUnmounted(stop)

const { people, byId, seat } = usePeople()
const { rows: sameWeek } = useCollection<Gig>('gigs')
const nameOf = (pid: string) => byId.value.get(pid)?.name ?? pid
const firstName = (pid: string) => nameOf(pid).split(' ')[0]
const me = computed(() => myPersonId(auth.access?.person, auth.email, people.value))
const toAsk = computed(() => pollAsked(people.value).ids)
const singers = computed(() => people.value.filter((p) => (p.status === 'active' || p.status === 'sub') && seat.value(p.id) === 'singer'))
const soundPeople = computed(() => people.value.filter((p) => seat.value(p.id) === 'sound'))
const isSound = (pid: string) => seat.value(pid) === 'sound'

const { answers, stored, summary, standings, leading, answer: saveAnswer, answerOn, lockDate, syncLineup } = usePoll(id, gig, () => auth.email, nameOf, () => seat.value, (m) => toast.show(m, 'error'))

const options = computed(() => hasOptions(gig.value))
const when = computed(() => (!gig.value ? '' : options.value ? optionsText(gig.value.dateOptions!) : day(gig.value.date)))
const link = computed(() => `${location.origin}/gigs/${id}`)
const share = computed(() => (gig.value ? whatsappLink(callMessage({ name: gig.value.name, when: when.value, venue: gig.value.venue }, link.value)) : ''))
const dateClashes = computed(() => (gig.value && options.value ? optionClashes(sameWeek.value, { ...gig.value, id }, me.value) : {}))
const clashNames = computed(() => (gig.value && !options.value ? clashes(sameWeek.value, { id, date: gig.value.date }, me.value).map((g) => ({ name: g.name, date: g.date })) : []))
const showShare = computed(() => route.query.share === '1')
const asked = computed(() => !!gig.value?.call?.asked.includes(me.value))
const lineupNames = computed(() => summary.value?.lineup.map(nameOf) ?? [])
const waitingText = computed(() => {
  const s = summary.value
  if (!s) return ''
  const waiting = s.waiting.filter((pid) => !(pid in s.later)).map((pid) => (pid === me.value ? 'you' : firstName(pid)))
  const later = Object.entries(s.later).map(([pid, until]) => `${pid === me.value ? 'you' : firstName(pid)} by ${day(until, { month: 'short', day: 'numeric' })}`)
  return [waiting.length ? `waiting on ${waiting.join(', ')}` : '', later.length ? `will know: ${later.join(', ')}` : ''].filter(Boolean).join(' · ')
})
const everyone = computed(() => {
  const ids = new Set([...(gig.value?.call?.asked ?? []), ...Object.keys(stored.value)])
  return [...ids].map((pid) => ({ id: pid, name: nameOf(pid), sub: byId.value.get(pid)?.status === 'sub', sound: isSound(pid), answer: answers.value[pid] }))
})
const subbingFor = computed(() => {
  const s = summary.value
  return !s || s.state === 'abandoned' ? [] : s.seeking
})

async function act(done: string, work: () => Promise<unknown>) {
  busy.value = true
  await toast.run(done, work)
  busy.value = false
}

const gigRef = () => doc(db, 'gigs', id)

function save(patch: Partial<Gig>, what: string) {
  return act(`Saved ${what}.`, async () => {
    await updateDoc(gigRef(), patch)
    await logEvent(id, 'edit', what, auth.email)
  })
}

function askBand() {
  return act('The band has been asked.', async () => {
    await updateDoc(gigRef(), { call: openCall(toAsk.value, auth.email, Date.now()) })
    await logEvent(id, 'call', 'asked the band', auth.email)
    await router.replace({ query: { share: '1' } })
  })
}

function answer(personId: string, value: Answer | null, until?: string) {
  const done =
    personId !== me.value ? `${firstName(personId)}'s answer is saved.` : value === 'yes' ? "You're in." : value === 'no' ? 'Got it. The band will sort a sub.' : 'Saved.'
  return act(done, () => saveAnswer(personId, value, until))
}

function answerDate(personId: string, date: string, value: Answer | null, until?: string) {
  return act(personId === me.value && value ? dateSaid(date, value) : `${firstName(personId)}'s answer is saved.`, () => answerOn(personId, date, value, until))
}

function lock(date: string) {
  return act(`Locked ${day(date)}.`, () => lockDate(date))
}

const onDate = (pid: string, date: string) => {
  const value = stored.value[pid]?.dates?.[date]
  return value ? { answer: value, until: stored.value[pid]?.until } : undefined
}

const nextAnswer = (a: Answer | undefined): Answer | null => (!a ? 'yes' : a === 'yes' ? 'no' : null)

function findSub(personId: string) {
  return act('', async () => {
    await updateDoc(gigRef(), { 'call.subbing': arrayUnion(personId) })
    await logEvent(id, 'call', `finding a sub for ${nameOf(personId)}`, auth.email)
  })
}

function drop(on: boolean) {
  confirmDrop.value = ''
  return act(on ? 'Gig dropped and marked cancelled.' : 'The poll is open again. A manager sets the stage back.', async () => {
    await updateDoc(gigRef(), on ? { 'call.abandoned': true, stage: 'cancelled' } : { 'call.abandoned': false })
    await logEvent(id, 'call', on ? 'dropped the gig' : 'reopened the poll', auth.email)
  })
}

async function copyLink() {
  await toast.run('Link copied.', () => navigator.clipboard.writeText(link.value))
}

function person(pid: string) {
  const p = byId.value.get(pid)
  return p ? { name: p.name, emails: p.emails } : null
}

function bookCalendar() {
  const g = gig.value
  const s = summary.value
  if (!g?.call || !s) return
  const call = g.call
  return act(call.calendarEventId ? 'Calendar event updated.' : 'Gig is on the band calendar.', async () => {
    const full = s.state === 'full'
    const tech = g.soundTech || s.sound
    const soundTech = tech ? person(tech) : null
    const pool = full ? s.lineup : [...call.asked.filter((pid) => !s.no.includes(pid)), ...s.lineup]
    const invite = [...new Set(pool)].map(person).filter((p) => p !== null)
    const body = eventBody({
      gig: g,
      link: link.value,
      full,
      singers: s.lineup.map(person).filter((p) => p !== null),
      soundTech,
      invite: soundTech ? [...invite, soundTech] : invite,
    })
    const token = await calendarToken()
    const saved = await saveEvent(token, call.calendarEventId, body)
    if (saved.id !== call.calendarEventId) await updateDoc(gigRef(), { 'call.calendarEventId': saved.id })
    await logEvent(id, 'calendar', full ? 'confirmed the calendar event' : 'put a hold on the calendar', auth.email)
  })
}

function pullReplies() {
  const eventId = gig.value?.call?.calendarEventId
  if (!eventId) return
  return act('Calendar replies are in.', async () => {
    const token = await calendarToken()
    const event = await readEvent(token, eventId)
    const found = answersFromAttendees(event.attendees ?? [], people.value)
    const next = { ...answers.value }
    for (const [personId, value] of Object.entries(found)) {
      if (answers.value[personId]?.answer === value) continue
      await setDoc(doc(db, 'gigs', id, 'answers', personId), { answer: value, by: auth.email, at: serverTimestamp() })
      next[personId] = { answer: value, by: auth.email, at: Date.now() }
    }
    await logEvent(id, 'calendar', 'pulled replies from the calendar', auth.email)
    await syncLineup(next, true)
  })
}

function togglePerformer(personId: string, on: boolean) {
  const next = new Set(gig.value?.performers ?? [])
  if (on) next.add(personId)
  else next.delete(personId)
  return save({ performers: [...next] }, 'the lineup')
}

const pipeline: Stage[] = ['tentative', 'contracting', 'confirmed', 'done']
const stepIndex = computed(() => pipeline.indexOf(gig.value?.stage ?? 'tentative'))

const answerLabel = (a: { answer: Answer; until?: string } | undefined) =>
  !a ? 'Waiting' : a.answer === 'yes' ? 'In' : a.answer === 'no' ? "Can't" : `By ${day(a.until ?? '', { month: 'short', day: 'numeric' })}`
</script>

<template>
  <AppHeader />
  <main class="page gig">
    <p v-if="loadError" class="error" role="alert">✕ {{ loadError }}</p>
    <p v-else-if="!gig" class="muted">Loading…</p>
    <template v-else>
      <RouterLink to="/gigs" class="back">← Gigs</RouterLink>

      <header class="hero">
        <p class="chips">
          <span class="chip" :class="gig.stage === 'confirmed' || gig.stage === 'done' ? 'chip--ok' : gig.stage === 'cancelled' ? 'chip--bad' : 'chip--warn'">{{ stageLabels[gig.stage] }}</span>
          <span v-if="summary" class="chip" :class="options ? 'chip--warn' : summary.state === 'full' ? 'chip--ok' : summary.state === 'abandoned' ? 'chip--bad' : 'chip--warn'">{{ options ? 'Picking a date' : callStateLabels[summary.state] }}</span>
          <span v-if="gig.via === 'assistant'" class="chip">From the assistant</span>
        </p>
        <div class="title">
          <DateBlock :date="gig.date" :dates="gig.dateOptions" />
          <h1>{{ gig.name }}</h1>
        </div>
        <GigFacts :gig="gig" :clash-names="clashNames" :me="me" hide-notes />
        <RouterLink v-if="gig.tour" :to="`/tours/${gig.tour}`" class="back">Part of a tour. The lineup is set there →</RouterLink>
      </header>

      <section v-if="showShare && gig.call" class="card share">
        <h2>The band has been asked. Tell them.</h2>
        <p class="muted">Post it in the band's WhatsApp group so everyone sees it now.</p>
        <div class="row">
          <a class="btn" :href="share" target="_blank" rel="noopener">Send to WhatsApp</a>
          <button type="button" class="btn btn--ghost" @click="copyLink">Copy link</button>
          <RouterLink class="link" :to="{ query: {} }">Done</RouterLink>
        </div>
      </section>

      <section v-if="!gig.call && !gig.tour" class="card ask">
        <h2>Who can play?</h2>
        <p class="muted">{{ askLine(people) }}</p>
        <button type="button" class="btn" :disabled="busy || !toAsk.length" @click="askBand">Ask the band</button>
      </section>

      <section v-if="options" class="card lineup">
        <h2 v-if="!gig.call || !asked">Possible dates</h2>
        <p v-if="!gig.call" class="muted small">Ask the band. Lock the date that fills first.</p>
        <DateRace
          :standings="standings"
          :leading="leading"
          :busy="busy"
          :me="me"
          :mine="stored[me]?.dates"
          :until="stored[me]?.until"
          :clashes="dateClashes"
          :name-of="gig.call ? nameOf : undefined"
          :can-answer="asked && summary?.state !== 'abandoned'"
          :can-lock="auth.isManager"
          @answer="(date, value, until) => answerDate(me, date, value, until)"
          @lock="lock"
        />
      </section>

      <section v-else-if="summary" class="card lineup">
        <div class="dialrow">
          <LineupDial :filled="summary.lineup.length" :sound="!!summary.sound" :size="64" />
          <div class="count">
            <strong class="display">{{ summary.lineup.length }} of {{ LINEUP_SIZE }} in</strong>
            <span v-if="lineupNames.length">{{ lineupNames.map((n) => (n === nameOf(me) ? 'You' : n.split(' ')[0])).join(', ') }}</span>
            <span :class="{ gap: !summary.sound }">{{ summary.sound ? `Sound: ${summary.sound === me ? 'you' : firstName(summary.sound)}` : 'Sound: nobody yet' }}</span>
            <span v-if="waitingText && summary.state !== 'full'" class="muted">{{ waitingText }}</span>
          </div>
        </div>

        <AnswerCard
          v-if="asked && summary.state !== 'abandoned'"
          :mine="answers[me]"
          :gig-date="gig.date"
          :busy="busy"
          @answer="(value, until) => answer(me, value, until)"
        />

        <div v-for="out in summary.undecided" :key="out" class="decide" role="group" :aria-label="`${nameOf(out)} can't make it`">
          <p>
            <strong>{{ out === me ? "You can't make it." : `${firstName(out)} can't make it.` }}</strong>
            <template v-if="isSound(out)">The gig needs someone on sound.</template>
            Anyone can decide what happens next.
          </p>
          <div class="row">
            <button type="button" class="btn" :disabled="busy" @click="findSub(out)">Find a sub</button>
            <button v-if="confirmDrop !== out" type="button" class="btn btn--ghost" :disabled="busy" @click="confirmDrop = out">Drop the gig</button>
          </div>
          <div v-if="confirmDrop === out" class="row confirm">
            <span>Cancel this gig for everyone?</span>
            <button type="button" class="btn btn--danger" :disabled="busy" @click="drop(true)">Drop it</button>
            <button type="button" class="btn btn--ghost" @click="confirmDrop = ''">Keep it</button>
          </div>
        </div>

        <SubFinder
          v-for="out in subbingFor"
          :key="`sub-${out}`"
          :out="byId.get(out)"
          :candidates="subCandidates(people, out, answers)"
          :for-sound="isSound(out)"
          :message="subMessage({ name: gig.name, when, venue: gig.venue }, isSound(out) ? 'sound tech' : (byId.get(out)?.voice ?? ''))"
          :busy="busy"
          @answer="answer"
        />

        <div v-if="summary.state === 'abandoned'" class="row">
          <span class="muted">This gig was dropped.</span>
          <button type="button" class="btn btn--ghost" :disabled="busy" @click="drop(false)">Reopen the poll</button>
        </div>
      </section>

      <RehearsalsCard v-if="gig.stage !== 'cancelled'" :gig-id="id" :gig="gig" :people="people" :can-edit="auth.isDirector || auth.isManager" />

      <section class="card details">
        <h2 class="eyebrow">On the night</h2>
        <dl class="kv">
          <dt>Outfit</dt>
          <dd>
            <select v-if="auth.isManager" class="outfit" :value="gig.outfit || DEFAULT_OUTFIT" aria-label="Outfit" :disabled="busy" @change="save({ outfit: ($event.target as HTMLSelectElement).value }, 'the outfit')">
              <option v-for="(label, key) in outfits" :key="key" :value="key">{{ label }}</option>
              <option v-if="gig.outfit && !(gig.outfit in outfits)" :value="gig.outfit">{{ gig.outfit }}</option>
            </select>
            <template v-else>{{ outfitLabel(gig.outfit) }}</template>
          </dd>
          <dt>Sound</dt>
          <dd :class="{ gap: !gig.soundTech }">{{ gig.soundTech ? nameOf(gig.soundTech) : 'Nobody yet' }}</dd>
        </dl>
        <label class="notes">Band notes
          <textarea :value="gig.notes" rows="3" @change="save({ notes: ($event.target as HTMLTextAreaElement).value }, 'the notes')"></textarea>
        </label>
      </section>

      <details v-if="gig.call && options" class="card everyone">
        <summary>Everyone's answers</summary>
        <p class="muted small">Record answers given by WhatsApp or phone. Tap a date to cycle through In, Can't and no answer.</p>
        <ul class="answers">
          <li v-for="p in everyone" :key="p.id">
            <span class="who">{{ p.name }}<span v-if="p.sound" class="muted"> · sound</span><span v-else-if="p.sub" class="muted"> · sub</span></span>
            <span class="record">
              <button
                v-for="d in gig.dateOptions"
                :key="d"
                type="button"
                class="mini"
                :class="`is-${stored[p.id]?.dates?.[d] ?? 'none'}`"
                :aria-label="`${p.name}, ${day(d, { weekday: 'long', month: 'long', day: 'numeric' })}: ${answerLabel(onDate(p.id, d))}`"
                :disabled="busy"
                @click="answerDate(p.id, d, nextAnswer(stored[p.id]?.dates?.[d]))"
              >
                {{ day(d, { month: 'short', day: 'numeric' }) }} · {{ answerLabel(onDate(p.id, d)) }}
              </button>
            </span>
          </li>
        </ul>
      </details>

      <details v-else-if="gig.call" class="card everyone">
        <summary>Everyone's answers</summary>
        <p class="muted small">Record an answer someone gave in WhatsApp or by phone.</p>
        <ul class="answers">
          <li v-for="p in everyone" :key="p.id">
            <span class="who">{{ p.name }}<span v-if="p.sound" class="muted"> · sound</span><span v-else-if="p.sub" class="muted"> · sub</span></span>
            <span class="chip" :class="p.answer?.answer === 'yes' ? 'chip--ok' : p.answer?.answer === 'no' ? 'chip--bad' : ''">{{ answerLabel(p.answer) }}</span>
            <span class="record">
              <button type="button" class="mini" :aria-label="`${p.name} is in`" :aria-pressed="p.answer?.answer === 'yes'" :disabled="busy" @click="answer(p.id, 'yes')">In</button>
              <button type="button" class="mini" :aria-label="`${p.name} can't`" :aria-pressed="p.answer?.answer === 'no'" :disabled="busy" @click="answer(p.id, 'no')">Can't</button>
              <button v-if="p.answer" type="button" class="link" :disabled="busy" @click="answer(p.id, null)">Clear</button>
            </span>
          </li>
        </ul>
      </details>

      <section v-if="gig.call && !options" class="card calendar">
        <h2>Band calendar</h2>
        <p class="muted small">
          {{ gig.call.calendarEventId ? 'On the 6 Minute Warning calendar.' : 'Not on the calendar yet.' }}
          Google asks for calendar access, then invites everyone still in.
        </p>
        <div class="row">
          <button type="button" class="btn btn--ghost" :disabled="busy || summary?.state === 'abandoned'" @click="bookCalendar">
            {{ summary?.state === 'full' ? 'Confirm on the calendar' : gig.call.calendarEventId ? 'Update the hold' : 'Hold the date' }}
          </button>
          <button v-if="gig.call.calendarEventId" type="button" class="btn btn--ghost" :disabled="busy" @click="pullReplies">Bring in calendar replies</button>
          <a class="btn btn--ghost" :href="share" target="_blank" rel="noopener">Send to WhatsApp</a>
        </div>
      </section>

      <section v-if="auth.isManager" class="manage" aria-labelledby="manage-title">
        <h2 id="manage-title" class="eyebrow">Manage</h2>

        <div class="card status">
          <div class="steps" role="group" aria-label="Stage">
            <button
              v-for="(s, i) in pipeline"
              :key="s"
              type="button"
              class="step"
              :class="{ done: stepIndex > i, current: gig.stage === s }"
              :aria-pressed="gig.stage === s"
              :disabled="busy"
              @click="save({ stage: s }, 'the stage')"
            >
              <span class="num" aria-hidden="true">{{ stepIndex > i ? '✓' : i + 1 }}</span>{{ stageLabels[s] }}
            </button>
          </div>
          <div class="contract">
            <span class="eyebrow">Contract</span>
            <div class="pills" role="group" aria-label="Contract">
              <button
                v-for="c in contractStates"
                :key="c"
                type="button"
                class="pill"
                :aria-pressed="gig.contract === c"
                :disabled="busy"
                @click="save({ contract: c as ContractState }, 'the contract state')"
              >
                {{ contractLabels[c] }}
              </button>
            </div>
            <button v-if="gig.stage !== 'cancelled'" type="button" class="link cancel" :disabled="busy" @click="save({ stage: 'cancelled' }, 'the stage')">Cancel gig</button>
            <span v-else class="chip chip--bad">Cancelled</span>
          </div>
        </div>

        <div class="manage-grid">
          <div class="col">
            <div class="card">
              <h3>The show</h3>
              <div class="fields">
                <label>Sets<input :value="gig.sets ?? ''" maxlength="60" placeholder="2 × 45 min" @change="save({ sets: ($event.target as HTMLInputElement).value.trim() }, 'the sets')" /></label>
                <label>Call time<input :value="gig.callTime ?? ''" maxlength="40" placeholder="5:30pm" @change="save({ callTime: ($event.target as HTMLInputElement).value.trim() }, 'the call time')" /></label>
                <label>Sound tech
                  <select :value="gig.soundTech ?? ''" @change="save({ soundTech: ($event.target as HTMLSelectElement).value }, 'the sound tech')">
                    <option value="">Nobody yet</option>
                    <option v-for="c in soundPeople" :key="c.id" :value="c.id">{{ c.name }}{{ c.status === 'sub' ? ' (sub)' : '' }}</option>
                  </select>
                </label>
              </div>
            </div>

            <div class="card presenter">
              <h3>Presenter</h3>
              <template v-if="gig.contact?.name || gig.contact?.email || gig.contact?.phone">
                <p class="who"><strong>{{ gig.contact.name || 'No name' }}</strong></p>
                <div class="row">
                  <a v-if="gig.contact.email" class="btn btn--ghost" :href="`mailto:${gig.contact.email}?subject=${encodeURIComponent(`6 Minute Warning: ${gig.name}`)}`">Email</a>
                  <a v-if="gig.contact.phone" class="btn btn--ghost" :href="`tel:${gig.contact.phone.replace(/[^0-9+]/g, '')}`">Call</a>
                </div>
                <p class="muted small">{{ [gig.contact.email, gig.contact.phone].filter(Boolean).join(' · ') }}</p>
              </template>
              <p v-else class="muted small">No presenter on this gig.</p>
            </div>

            <details class="card by-hand">
              <summary>Adjust the lineup by hand</summary>
              <p class="muted small">The poll fills this. Change it only when someone was booked outside the poll.</p>
              <ul class="people">
                <li v-for="p in singers" :key="p.id">
                  <label class="check">
                    <input type="checkbox" :checked="gig.performers?.includes(p.id)" @change="togglePerformer(p.id, ($event.target as HTMLInputElement).checked)" />
                    {{ p.name }} <span class="muted">{{ [p.voice, p.status === 'sub' ? 'sub' : ''].filter(Boolean).join(' · ') }}</span>
                  </label>
                </li>
              </ul>
            </details>
          </div>

          <PayoutCard :id="id" :gig="gig" :name-of="nameOf" />
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.manage {
  display: grid;
  gap: 16px;
  margin-top: 16px;
}

.status {
  display: grid;
  gap: 16px;
}

.steps {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.step {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 6px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-bg);
  color: var(--color-text-muted);
  font: inherit;
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
}

.step .num {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid currentColor;
  font-size: 0.75rem;
}

.step.done {
  color: var(--color-text);
}

.step.current {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-accent-ink);
}

.contract {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pill {
  min-height: 36px;
  padding: 4px 12px;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-muted);
  font: inherit;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
}

.pill[aria-pressed='true'] {
  border-color: var(--color-text);
  color: var(--color-text);
  background: var(--color-surface-raised);
}

.cancel {
  margin-left: auto;
  color: var(--color-danger);
}

.manage-grid {
  display: grid;
  gap: 16px;
  align-items: start;
}

.col {
  display: grid;
  gap: 16px;
}

.fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.fields input,
.fields select {
  width: 100%;
  min-width: 0;
}

.presenter .who {
  margin: 0;
  font-size: 1.1rem;
}

.by-hand summary {
  cursor: pointer;
  font-weight: 700;
  min-height: 32px;
}

@media (min-width: 900px) {
  .manage-grid {
    grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
  }
}

@media (max-width: 480px) {
  .steps {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .fields {
    grid-template-columns: 1fr;
  }
}

.gig {
  display: grid;
  gap: 16px;
  max-width: 1080px;
}

.gig > :not(.manage) {
  width: 100%;
  max-width: 760px;
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

.dialrow {
  display: flex;
  align-items: center;
  gap: 16px;
}

.dialrow > :last-child {
  flex: 1;
  min-width: 0;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
}


.card h2,
.card h3 {
  margin: 0 0 8px;
  font-size: 1.05rem;
}

.card {
  display: grid;
  gap: 12px;
  border-radius: var(--radius);
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

.count {
  display: grid;
  gap: 2px;
}

.count .display {
  font-size: 1.15rem;
}

.decide {
  display: grid;
  gap: 10px;
  padding: 14px;
  border-radius: var(--radius);
  border: 1px solid var(--color-warning);
}

.decide p {
  margin: 0;
}

.gap {
  color: var(--color-warning);
}

.confirm span {
  font-weight: 700;
}

.kv {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 6px 16px;
  margin: 0;
}

.kv dt {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  align-self: center;
}

.kv dd {
  margin: 0;
  font-weight: 600;
}

label {
  display: grid;
  gap: 4px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

label input,
label select,
label textarea {
  font-size: 1rem;
  letter-spacing: normal;
  text-transform: none;
  color: var(--color-text);
}

.check {
  text-transform: none;
  letter-spacing: normal;
  color: var(--color-text);
}

textarea {
  font: inherit;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text);
}

.everyone summary {
  cursor: pointer;
  font-weight: 700;
  font-size: 1.05rem;
  min-height: 32px;
}

.answers,
.people {
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
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.mini.is-yes {
  border-color: var(--color-success);
  color: var(--color-success);
}

.mini.is-no {
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.mini.is-later {
  border-color: var(--color-warning);
  color: var(--color-warning);
}

.small {
  font-size: 0.85rem;
  margin: 0;
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

.manage .section {
  margin-bottom: 0;
}

.cards {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
}

.check {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-weight: 500;
  font-size: 1rem;
}

.contact {
  display: grid;
  gap: 2px;
  margin: 0;
}
</style>
