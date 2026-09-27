<script setup lang="ts">
import { computed, ref, toRef } from 'vue'
import { arrayUnion, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { day, logEvent } from '@/lib/db'
import { LINEUP_SIZE, callMessage, callStateLabels, openCall, subCandidates, whatsappLink, type Answer } from '@/lib/call'
import { myPersonId, usePoll } from '@/lib/poll'
import { answersFromAttendees, calendarToken, eventBody, readEvent, saveEvent } from '@/lib/calendar'
import type { Gig } from '@/lib/gigs'
import type { PersonRecord } from '@/lib/people'
import { useAuth } from '@/stores/auth'

const props = defineProps<{ id: string; gig: Gig; people: (PersonRecord & { id: string })[] }>()

const auth = useAuth()
const error = ref('')
const done = ref('')
const busy = ref(false)
const confirmAbandon = ref(false)
const showSubsFor = ref('')

const byId = computed(() => new Map(props.people.map((p) => [p.id, p])))
const nameOf = (id: string) => byId.value.get(id)?.name ?? id
const members = computed(() => props.people.filter((p) => p.status === 'active'))
const me = computed(() => myPersonId(auth.access?.person, auth.email, props.people))
const { answers, summary, answer: saveAnswer, syncLineup } = usePoll(props.id, toRef(props, 'gig'), () => auth.email, nameOf, (m) => (error.value = m))
const everyone = computed(() => {
  const ids = new Set([...(props.gig.call?.asked ?? []), ...Object.keys(answers.value)])
  return [...ids].map((id) => ({ id, name: nameOf(id), sub: byId.value.get(id)?.status === 'sub' }))
})
const link = computed(() => `${location.origin}/gigs/${props.id}`)
const share = computed(() => whatsappLink(callMessage({ name: props.gig.name, when: day(props.gig.date), venue: props.gig.venue }, link.value)))
const yesSoFar = computed(() => summary.value?.lineup.length ?? 0)

async function run(what: string, work: () => Promise<unknown>) {
  error.value = ''
  done.value = ''
  busy.value = true
  try {
    await work()
    done.value = what
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

const gigRef = () => doc(db, 'gigs', props.id)

function start() {
  return run('Poll opened. Share it to WhatsApp so people see it.', async () => {
    await updateDoc(gigRef(), { call: openCall(members.value.map((p) => p.id), auth.email, Date.now()) })
    await logEvent(props.id, 'call', 'opened the poll', auth.email)
  })
}

function answer(personId: string, value: Answer | null) {
  const who = personId === me.value ? 'your answer' : `${nameOf(personId)}'s answer`
  return run(`Saved ${who}.`, () => saveAnswer(personId, value))
}

function findSub(personId: string) {
  showSubsFor.value = personId
  return run(`Looking for a sub for ${nameOf(personId)}.`, async () => {
    await updateDoc(gigRef(), { 'call.subbing': arrayUnion(personId) })
    await logEvent(props.id, 'call', `finding a sub for ${nameOf(personId)}`, auth.email)
  })
}

function abandon(on: boolean) {
  confirmAbandon.value = false
  return run(on ? 'Gig abandoned and marked cancelled.' : 'Poll reopened. The stage stays Cancelled until the manager changes it.', async () => {
    await updateDoc(gigRef(), on ? { 'call.abandoned': true, stage: 'cancelled' } : { 'call.abandoned': false })
    await logEvent(props.id, 'call', on ? 'abandoned the gig' : 'reopened the poll', auth.email)
  })
}

function person(id: string) {
  const p = byId.value.get(id)
  return p ? { name: p.name, emails: p.emails } : null
}

function bookCalendar() {
  const call = props.gig.call
  const s = summary.value
  if (!call || !s) return
  return run(call.calendarEventId ? 'Calendar event updated. Invites sent.' : 'Hold added to the band calendar. Invites sent.', async () => {
    const full = s.state === 'full'
    const soundTech = props.gig.soundTech ? person(props.gig.soundTech) : null
    const pool = full ? s.lineup : [...call.asked.filter((id) => !s.no.includes(id)), ...s.lineup]
    const invite = [...new Set(pool)].map(person).filter((p) => p !== null)
    const body = eventBody({
      gig: props.gig,
      link: link.value,
      full,
      singers: s.lineup.map(person).filter((p) => p !== null),
      soundTech,
      invite: soundTech ? [...invite, soundTech] : invite,
    })
    const token = await calendarToken()
    const saved = await saveEvent(token, call.calendarEventId, body)
    if (saved.id !== call.calendarEventId) await updateDoc(gigRef(), { 'call.calendarEventId': saved.id })
    await logEvent(props.id, 'calendar', full ? 'confirmed the calendar event' : 'put a hold on the calendar', auth.email)
  })
}

function pullReplies() {
  const call = props.gig.call
  if (!call?.calendarEventId) return
  return run('Calendar replies pulled in.', async () => {
    const token = await calendarToken()
    const event = await readEvent(token, call.calendarEventId)
    const found = answersFromAttendees(event.attendees ?? [], props.people)
    const next = { ...answers.value }
    for (const [personId, value] of Object.entries(found)) {
      if (answers.value[personId]?.answer === value) continue
      await setDoc(doc(db, 'gigs', props.id, 'answers', personId), { answer: value, by: auth.email, at: serverTimestamp() })
      next[personId] = { answer: value, by: auth.email, at: Date.now() }
    }
    await logEvent(props.id, 'calendar', 'pulled replies from the calendar', auth.email)
    await syncLineup(next)
  })
}
</script>

<template>
  <section class="card wide call">
    <h2>Band poll</h2>
    <p v-if="error" class="error" role="alert">✕ {{ error }}</p>
    <p v-if="done" class="ok" role="status">✓ {{ done }}</p>

    <template v-if="!gig.call || !summary">
      <p class="muted">Ask the {{ members.length }} active members whether they can play. {{ LINEUP_SIZE }} yes answers fill the lineup.</p>
      <button type="button" class="btn" :disabled="busy || !members.length" @click="start">Open the poll</button>
    </template>

    <template v-else>
      <p class="status">
        <span class="chip" :class="summary.state === 'full' ? 'chip--ok' : summary.state === 'abandoned' ? 'chip--bad' : 'chip--warn'">{{ callStateLabels[summary.state] }}</span>
        <strong>{{ yesSoFar }} of {{ LINEUP_SIZE }}</strong> <span class="muted">said yes</span>
      </p>

      <div v-if="me && gig.call.asked.includes(me) && summary.state !== 'abandoned'" class="mine">
        <span>Can you make it?</span>
        <button type="button" class="mini" :aria-pressed="answers[me]?.answer === 'yes'" :disabled="busy" @click="answer(me, 'yes')">Yes</button>
        <button type="button" class="mini" :aria-pressed="answers[me]?.answer === 'no'" :disabled="busy" @click="answer(me, 'no')">No</button>
      </div>

      <div v-for="out in summary.undecided" :key="out" class="decide" role="group" :aria-label="`${nameOf(out)} said no`">
        <p><strong>{{ nameOf(out) }}</strong> can't make it. Anyone can act:</p>
        <button type="button" class="btn" :disabled="busy" @click="findSub(out)">Find a sub</button>
        <button v-if="!confirmAbandon" type="button" class="btn btn--ghost" :disabled="busy" @click="confirmAbandon = true">Abandon the gig</button>
        <span v-else class="confirm">
          Cancel the gig for everyone?
          <button type="button" class="btn btn--danger" :disabled="busy" @click="abandon(true)">Yes, abandon</button>
          <button type="button" class="btn btn--ghost" @click="confirmAbandon = false">Keep it</button>
        </span>
      </div>

      <div v-for="out in gig.call.subbing.filter((id) => summary!.no.includes(id))" v-show="summary.state !== 'full' && summary.state !== 'abandoned'" :key="`sub-${out}`" class="subs">
        <p>
          <strong>Sub for {{ nameOf(out) }}</strong>
          <span class="muted">{{ byId.get(out)?.part }}</span>
          <button type="button" class="link" @click="showSubsFor = showSubsFor === out ? '' : out">{{ showSubsFor === out ? 'Hide' : 'Show' }} subs</button>
        </p>
        <ul v-if="showSubsFor === out" class="people">
          <li v-for="s in subCandidates(people, out, answers)" :key="s.id">
            <span>{{ s.name }} <span class="muted">{{ s.part }}</span></span>
            <a v-if="s.phone" :href="`tel:${s.phone.replace(/[^0-9+]/g, '')}`">{{ s.phone }}</a>
            <button type="button" class="mini" :aria-pressed="answers[s.id]?.answer === 'yes'" :disabled="busy" @click="answer(s.id, 'yes')">Said yes</button>
            <button type="button" class="mini" :disabled="busy" @click="answer(s.id, 'no')">Said no</button>
          </li>
          <li v-if="!subCandidates(people, out, answers).length" class="muted">No subs left to ask. Add subs under Roster.</li>
        </ul>
      </div>

      <p v-if="summary.state === 'abandoned'">
        <button type="button" class="btn btn--ghost" :disabled="busy" @click="abandon(false)">Reopen the poll</button>
      </p>

      <table class="table answers">
        <thead>
          <tr><th>Who</th><th>Answer</th><th><span class="sr-only">Record an answer</span></th></tr>
        </thead>
        <tbody>
          <tr v-for="p in everyone" :key="p.id">
            <td>{{ p.name }} <span v-if="p.sub" class="muted">sub</span></td>
            <td>
              <span v-if="summary.lineup.includes(p.id)" class="chip chip--ok">In</span>
              <span v-else-if="summary.spare.includes(p.id)" class="chip">Yes, spare</span>
              <span v-else-if="answers[p.id]?.answer === 'no'" class="chip chip--bad">No</span>
              <span v-else class="muted">Waiting</span>
            </td>
            <td class="record">
              <button type="button" class="mini" :aria-label="`${p.name} said yes`" :aria-pressed="answers[p.id]?.answer === 'yes'" :disabled="busy" @click="answer(p.id, 'yes')">Yes</button>
              <button type="button" class="mini" :aria-label="`${p.name} said no`" :aria-pressed="answers[p.id]?.answer === 'no'" :disabled="busy" @click="answer(p.id, 'no')">No</button>
              <button v-if="answers[p.id]" type="button" class="link" :disabled="busy" @click="answer(p.id, null)">Clear</button>
            </td>
          </tr>
        </tbody>
      </table>
      <p class="muted small">Record answers people gave in WhatsApp or by phone with the buttons on their row.</p>

      <div class="actions">
        <a class="btn btn--ghost" :href="share" target="_blank" rel="noopener">Share to WhatsApp</a>
        <template v-if="summary.state !== 'abandoned'">
          <button type="button" class="btn btn--ghost" :disabled="busy" @click="bookCalendar">
            {{ summary.state === 'full' ? 'Confirm on calendar' : gig.call.calendarEventId ? 'Update calendar hold' : 'Put a hold on the calendar' }}
          </button>
          <button v-if="gig.call.calendarEventId" type="button" class="btn btn--ghost" :disabled="busy" @click="pullReplies">Pull calendar replies</button>
        </template>
      </div>
      <p class="muted small">Calendar invites go to every address each person has on the roster. Google asks for calendar access each time.</p>
    </template>
  </section>
</template>

<style scoped>
.call h2 {
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  margin: 0 0 8px;
}

.status,
.mine,
.actions,
.record,
.confirm {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.mine {
  margin: 12px 0;
  font-weight: 700;
}

.decide,
.subs {
  margin: 12px 0;
  padding: 12px;
  border: 1px solid var(--color-warning);
  border-radius: 6px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.decide p,
.subs p {
  flex-basis: 100%;
  margin: 0;
}

.subs p {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
}

.people {
  list-style: none;
  margin: 0;
  padding: 0;
  flex-basis: 100%;
}

.people li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.answers {
  margin: 12px 0 4px;
}

.actions {
  margin-top: 12px;
}

.actions a.btn {
  text-decoration: none;
}

.small {
  font-size: 0.85rem;
}
</style>
