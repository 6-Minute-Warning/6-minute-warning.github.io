<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { doc, onSnapshot, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { blankPresenter, type Presenter, type Task, type Venue } from '@/lib/directory'
import { useAuth } from '@/stores/auth'

const props = defineProps<{ id: string; task: Task }>()

const auth = useAuth()
const open = ref(false)
const busy = ref(false)
const error = ref('')
const venue = ref<Venue>({ name: '', address: '' })
const presenter = ref<Presenter>(blankPresenter())
const collectionName = props.task.kind === 'venue' ? 'venues' : 'presenters'

const stop = onSnapshot(doc(db, collectionName, props.task.target), (snap) => {
  if (!snap.exists()) return
  if (props.task.kind === 'venue') venue.value = { ...venue.value, ...(snap.data() as Venue) }
  else presenter.value = blankPresenter(snap.data() as Partial<Presenter>)
})
onUnmounted(stop)

async function save() {
  error.value = ''
  busy.value = true
  try {
    const batch = writeBatch(db)
    batch.set(doc(db, collectionName, props.task.target), props.task.kind === 'venue' ? venue.value : presenter.value)
    batch.update(doc(db, 'tasks', props.id), { open: false, doneBy: auth.email, doneAt: serverTimestamp() })
    await batch.commit()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <li class="row">
    <span class="what">{{ task.title }}</span>
    <button v-if="!open" type="button" class="mini" @click="open = true">Fill in</button>
    <form v-else class="fields" @submit.prevent="save">
      <template v-if="task.kind === 'venue'">
        <label>Venue<input v-model.trim="venue.name" required maxlength="160" /></label>
        <label class="wide">Address<input v-model.trim="venue.address" required maxlength="240" /></label>
      </template>
      <template v-else>
        <label>Presenter<input v-model.trim="presenter.name" required maxlength="120" /></label>
        <label>Email<input v-model.trim="presenter.email" type="email" maxlength="160" /></label>
        <label>Phone<input v-model.trim="presenter.phone" type="tel" maxlength="40" /></label>
        <label>Tech contact<input v-model.trim="presenter.techName" maxlength="120" /></label>
        <label>Tech email<input v-model.trim="presenter.techEmail" type="email" maxlength="160" /></label>
        <label>Tech phone<input v-model.trim="presenter.techPhone" type="tel" maxlength="40" /></label>
      </template>
      <span class="buttons">
        <button type="submit" class="btn" :disabled="busy">Save and close</button>
        <button type="button" class="btn btn--ghost" @click="open = false">Later</button>
      </span>
      <p v-if="error" class="error" role="alert">✕ {{ error }}</p>
    </form>
  </li>
</template>

<style scoped>
.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--color-border);
}

.what {
  font-weight: 700;
}

.fields {
  flex-basis: 100%;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.fields label {
  display: grid;
  gap: 4px;
  font-weight: 600;
  font-size: 0.9rem;
}

.wide {
  grid-column: 1 / -1;
}

.buttons {
  display: flex;
  gap: 8px;
  grid-column: 1 / -1;
}

.fields .error {
  grid-column: 1 / -1;
  margin: 0;
}
</style>
