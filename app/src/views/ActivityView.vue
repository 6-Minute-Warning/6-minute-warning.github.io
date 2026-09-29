<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { collection, doc, getDoc, limit, orderBy, serverTimestamp, writeBatch } from 'firebase/firestore'
import AppHeader from '@/components/AppHeader.vue'
import { db } from '@/lib/firebase'
import { useCollection } from '@/lib/db'
import { canUndo, describePath, diffFields, formatValue, kindOf, titleOf, type AuditEntry, type Data } from '@/lib/audit'
import { useAuth } from '@/stores/auth'
import { useToast } from '@/stores/toast'

const auth = useAuth()
const toast = useToast()
const { rows, error, ready } = useCollection<Omit<AuditEntry, 'id'>>('audit', orderBy('at', 'desc'), limit(200))
const undone = computed(() => new Set(rows.value.map((r) => r.undoOf).filter(Boolean)))
const entries = computed(() =>
  rows.value.map((e) => ({ ...e, kind: kindOf(e), where: describePath(e.path), title: titleOf(e), changes: diffFields(e.before, e.after), when: e.at ? formatValue(e.at) : 'Just now' })),
)
const busy = ref('')

async function undo(entry: AuditEntry) {
  busy.value = entry.id
  await toast.run('Undone', async () => {
    const target = doc(db, entry.path)
    const snap = await getDoc(target)
    const current = snap.exists() ? (snap.data() as Data) : null
    const check = canUndo(entry, current, undone.value.has(entry.id))
    if (!check.ok) throw new Error(check.why)
    const batch = writeBatch(db)
    if (entry.before) batch.set(target, entry.before)
    else batch.delete(target)
    batch.set(doc(collection(db, 'audit')), { path: entry.path, before: current, after: entry.before, by: auth.realEmail, at: serverTimestamp(), reason: `Undo: ${entry.reason}`.slice(0, 500), undoOf: entry.id })
    await batch.commit()
  })
  busy.value = ''
}
</script>

<template>
  <AppHeader />
  <main class="page activity">
    <div class="head">
      <h1>Assistant activity</h1>
      <p class="muted">Every change the assistant makes, newest first. Undo puts a record back as it was.</p>
    </div>
    <p v-if="!auth.isManager" class="empty">Only managers see the assistant's activity.</p>
    <template v-else>
      <p v-if="error" class="error" role="alert">✕ {{ error }}</p>
      <p v-if="!ready" class="muted">Loading…</p>
      <p v-else-if="!entries.length" class="empty">The assistant hasn't changed anything yet.</p>

      <article v-for="e in entries" :key="e.id" class="card entry" :class="{ undo: e.undoOf }">
        <header class="top">
          <span class="eyebrow">{{ e.where.label }} {{ e.undoOf ? 'undo' : e.kind }}</span>
          <span class="muted when">{{ e.when }}</span>
        </header>
        <h2>
          <RouterLink v-if="e.where.link" :to="e.where.link">{{ e.title }}</RouterLink>
          <template v-else>{{ e.title }}</template>
          <span v-if="e.where.parent" class="muted"> · {{ e.where.parent }}</span>
        </h2>
        <p class="reason">“{{ e.reason }}”</p>
        <p class="muted by">{{ e.by }} · <code>{{ e.path }}</code></p>
        <details v-if="e.kind !== 'changed'" class="fields">
          <summary>{{ e.changes.length }} {{ e.changes.length === 1 ? 'field' : 'fields' }} {{ e.kind === 'created' ? 'added' : 'removed' }}</summary>
          <ul class="diff">
            <li v-for="c in e.changes" :key="c.field">
              <span class="field">{{ c.field }}</span>
              <span :class="e.kind === 'created' ? 'to' : 'from'">{{ e.kind === 'created' ? c.to : c.from }}</span>
            </li>
          </ul>
        </details>
        <ul v-else-if="e.changes.length" class="diff">
          <li v-for="c in e.changes" :key="c.field">
            <span class="field">{{ c.field }}</span>
            <span><span class="from">{{ c.from }}</span> <span class="arrow" aria-label="became">→</span> <span class="to">{{ c.to }}</span></span>
          </li>
        </ul>
        <p v-else class="muted">No field changed.</p>
        <div v-if="!e.undoOf" class="actions">
          <span v-if="undone.has(e.id)" class="muted">Undone</span>
          <button v-else-if="!auth.viewing" type="button" class="btn btn--ghost" :disabled="busy === e.id" @click="undo(e)">
            {{ busy === e.id ? 'Undoing…' : e.kind === 'created' ? 'Undo · delete it' : e.kind === 'deleted' ? 'Undo · bring it back' : 'Undo' }}
          </button>
        </div>
      </article>
    </template>
  </main>
</template>

<style scoped>
.activity {
  max-width: 760px;
  display: grid;
  gap: 16px;
}

.head h1 {
  margin: 0 0 4px;
}

.head p {
  margin: 0;
}

.entry {
  display: grid;
  gap: 8px;
}

.entry.undo {
  border-style: dashed;
}

.top {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 4px 12px;
}

.top .eyebrow {
  margin: 0;
}

.when {
  font-size: 0.85rem;
}

h2 {
  margin: 0;
  font-size: 1.15rem;
  overflow-wrap: anywhere;
}

h2 a {
  color: inherit;
}

.reason {
  margin: 0;
}

.by {
  margin: 0;
  font-size: 0.85rem;
  overflow-wrap: anywhere;
}

.diff {
  list-style: none;
  margin: 0;
  padding: 10px 12px;
  display: grid;
  gap: 8px;
  background: var(--color-surface-raised);
  border-radius: var(--radius);
}

.diff li {
  display: grid;
  gap: 2px;
  font-size: 0.9rem;
  overflow-wrap: anywhere;
}

.fields summary {
  cursor: pointer;
  color: var(--color-text-muted);
  font-size: 0.9rem;
  margin-bottom: 8px;
}

.field {
  color: var(--color-text-muted);
  font-size: 0.8rem;
  font-weight: 600;
}

.from {
  color: var(--color-danger);
  text-decoration: line-through;
  text-decoration-color: color-mix(in srgb, var(--color-danger) 60%, transparent);
}

.to {
  color: var(--color-success);
}

.arrow {
  color: var(--color-text-muted);
}

.actions {
  display: flex;
  justify-content: flex-end;
}

.empty {
  margin: 0;
  padding: 18px;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius);
  color: var(--color-text-muted);
}
</style>
