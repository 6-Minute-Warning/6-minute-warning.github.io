<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { addDoc, collection, deleteField, doc, getDocs, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore'
import SearchSelect from '@/components/SearchSelect.vue'
import { db } from '@/lib/firebase'
import { day, today } from '@/lib/db'
import { calendarToken, removeEvent, saveEvent, startTime } from '@/lib/calendar'
import type { GigRow } from '@/lib/gigs'
import type { PersonRecord } from '@/lib/people'
import { expectedAt, placesOf, rehearsalEventBody, rehearsalTimes, suggestNext, type Rehearsal, type RehearsalRow } from '@/lib/schedule'
import { useAuth } from '@/stores/auth'
import { useToast } from '@/stores/toast'

const props = defineProps<{ rehearsals: RehearsalRow[]; gigs: GigRow[]; people: (PersonRecord & { id: string })[]; editing?: RehearsalRow; forGig?: string }>()
const emit = defineEmits<{ done: [] }>()

const auth = useAuth()
const toast = useToast()
const now = today()
const suggested = suggestNext(props.rehearsals, now, props.gigs.find((g) => g.id === props.forGig)?.date)
const start = props.editing ?? { ...suggested, gigs: props.forGig ? [props.forGig] : [], notes: '' }
const draft = ref({ date: start.date, start: start.start, end: start.end, place: start.place, address: start.address, gigs: [...start.gigs], notes: start.notes })
const onCalendar = ref(!!props.editing?.calendarEventId)
const busy = ref(false)
const error = ref('')

const times = computed(() => [...new Set([...rehearsalTimes(), draft.value.start, draft.value.end].filter(Boolean))])
const places = computed(() => placesOf(props.rehearsals))
const placeNames = computed(() => places.value.map((p) => p.name))
watch(
  () => places.value.find((p) => p.name.toLowerCase() === draft.value.place.trim().toLowerCase()),
  (known) => {
    if (known && !draft.value.address.trim()) draft.value.address = known.address
  },
)

const choices = computed(() =>
  props.gigs
    .filter((g) => g.stage !== 'cancelled' && (!draft.value.date || g.date >= draft.value.date || draft.value.gigs.includes(g.id)))
    .slice(0, 8),
)

function toggle(id: string) {
  draft.value.gigs = draft.value.gigs.includes(id) ? draft.value.gigs.filter((g) => g !== id) : [...draft.value.gigs, id]
}

function record(): Rehearsal {
  const d = draft.value
  return { date: d.date, start: d.start, end: d.end, place: d.place.trim(), address: d.address.trim(), gigs: d.gigs, notes: d.notes.trim() }
}

async function syncCalendar(token: string, id: string, r: Rehearsal, eventId: string) {
  const invite = expectedAt(r, props.gigs, props.people)
    .map((pid) => props.people.find((p) => p.id === pid))
    .filter((p): p is PersonRecord & { id: string } => !!p)
  const names = r.gigs.map((gid) => props.gigs.find((g) => g.id === gid)?.name ?? '').filter(Boolean)
  const link = `${location.origin}/rehearsals#rehearsal-${id}`
  const event = await saveEvent(token, eventId, rehearsalEventBody(r, link, names, invite))
  if (event.id !== eventId) await updateDoc(doc(db, 'rehearsals', id), { calendarEventId: event.id })
}

async function save() {
  error.value = ''
  busy.value = true
  try {
    const r = record()
    if ((startTime(r.end) ?? '') <= (startTime(r.start) ?? '')) throw new Error('The end time has to be after the start.')
    const eventId = props.editing?.calendarEventId ?? ''
    const token = onCalendar.value || eventId ? await calendarToken() : ''
    let id = props.editing?.id ?? ''
    if (id) await updateDoc(doc(db, 'rehearsals', id), { ...r })
    else id = (await addDoc(collection(db, 'rehearsals'), { ...r, createdBy: auth.email, createdAt: serverTimestamp() })).id
    if (token) {
      try {
        if (onCalendar.value) await syncCalendar(token, id, r, eventId)
        else {
          await removeEvent(token, eventId)
          await updateDoc(doc(db, 'rehearsals', id), { calendarEventId: deleteField() })
        }
      } catch (e) {
        toast.show(`Saved, but the band calendar wasn't updated: ${e instanceof Error ? e.message : String(e)}`, 'error')
        emit('done')
        return
      }
    }
    toast.show(props.editing ? 'Rehearsal updated.' : `Booked for ${day(r.date, { weekday: 'short', month: 'short', day: 'numeric' })}.`)
    emit('done')
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

async function cancelRehearsal() {
  const r = props.editing
  if (!r || !window.confirm(`Cancel the rehearsal on ${day(r.date)}? Replies are deleted.${r.calendarEventId ? ' It comes off the band calendar too.' : ''}`)) return
  error.value = ''
  busy.value = true
  try {
    const token = r.calendarEventId ? await calendarToken().catch(() => '') : ''
    const batch = writeBatch(db)
    ;(await getDocs(collection(db, 'rehearsals', r.id, 'replies'))).forEach((d) => batch.delete(d.ref))
    batch.delete(doc(db, 'rehearsals', r.id))
    await batch.commit()
    if (r.calendarEventId) {
      const removed = token ? await removeEvent(token, r.calendarEventId).then(() => true, () => false) : false
      if (!removed) {
        toast.show('Cancelled, but the band calendar event is still there. Delete it in Google Calendar.', 'error')
        emit('done')
        return
      }
    }
    toast.show('Rehearsal cancelled.')
    emit('done')
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <form class="form" @submit.prevent="save">
    <div class="trio">
      <label class="date">Date<input v-model="draft.date" type="date" required :min="editing ? undefined : now" @click="($event.target as HTMLInputElement).showPicker?.()" /></label>
      <label>Start
        <select v-model="draft.start">
          <option v-for="t in times" :key="t" :value="t">{{ t }}</option>
        </select>
      </label>
      <label>End
        <select v-model="draft.end">
          <option v-for="t in times" :key="t" :value="t">{{ t }}</option>
        </select>
      </label>
    </div>

    <SearchSelect v-model="draft.place" label="Where" :options="placeNames" new-label="New place" />
    <label>Address<input v-model="draft.address" maxlength="240" placeholder="For the map link" /></label>

    <div class="for">
      <span class="caption">What it's for</span>
      <div class="chips">
        <button type="button" class="mini" :aria-pressed="!draft.gigs.length" @click="draft.gigs = []">Whole band</button>
        <button v-for="g in choices" :key="g.id" type="button" class="mini" :aria-pressed="draft.gigs.includes(g.id)" @click="toggle(g.id)">
          {{ g.name }} · {{ day(g.date, { month: 'short', day: 'numeric' }) }}
        </button>
      </div>
      <p v-if="draft.gigs.length" class="muted hint">Expected: the singers booked on {{ draft.gigs.length === 1 ? 'that gig' : 'those gigs' }}, or everyone while there's no lineup yet.</p>
    </div>

    <label>Notes<textarea v-model="draft.notes" rows="2" maxlength="2000" placeholder="Setup at 3:30pm. Bring the new charts." /></label>

    <label class="check">
      <input v-model="onCalendar" type="checkbox" />
      {{ editing?.calendarEventId ? 'Keep it on the band calendar' : 'Put it on the band calendar and invite the singers' }}
    </label>

    <p v-if="error" class="error" role="alert">✕ {{ error }}</p>
    <div class="buttons">
      <button type="submit" class="btn" :disabled="busy">{{ editing ? 'Save changes' : 'Book it' }}</button>
      <button type="button" class="btn btn--ghost" :disabled="busy" @click="emit('done')">Never mind</button>
      <button v-if="editing" type="button" class="link danger" :disabled="busy" @click="cancelRehearsal">Cancel this rehearsal</button>
    </div>
  </form>
</template>

<style scoped>
.form {
  display: grid;
  gap: 14px;
}

label,
.caption {
  display: grid;
  gap: 4px;
  font-weight: 600;
  font-size: 0.9rem;
}

.trio {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr;
  gap: 10px;
}

.trio input,
.trio select {
  min-width: 0;
  width: 100%;
}

textarea {
  font: inherit;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text);
  resize: vertical;
}

.for {
  display: grid;
  gap: 8px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.hint {
  margin: 0;
  font-size: 0.85rem;
}

.check {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 1rem;
  font-weight: 500;
}

.check input {
  width: 20px;
  height: 20px;
  margin-top: 2px;
}

.buttons {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 12px;
}

.danger {
  margin-left: auto;
  color: var(--color-danger);
}

@media (max-width: 480px) {
  .trio {
    grid-template-columns: 1fr 1fr;
  }

  .date {
    grid-column: 1 / -1;
  }
}
</style>
