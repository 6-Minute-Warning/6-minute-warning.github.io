<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import DateBlock from '@/components/DateBlock.vue'
import { db } from '@/lib/firebase'
import { day } from '@/lib/db'
import { ago, declineDraft, firstName, mailto, replyDraft, type Inquiry, type InquiryStatus } from '@/lib/inquiries'
import { useAuth } from '@/stores/auth'
import { useToast } from '@/stores/toast'

const props = defineProps<{ id: string; inquiry: Inquiry }>()

const auth = useAuth()
const toast = useToast()
const el = ref<HTMLElement>()
const declining = ref(false)
const expanded = ref(false)
const me = computed(() => firstName(auth.access?.name ?? ''))
const who = computed(() => firstName(props.inquiry.name))
const received = computed(() => ago(props.inquiry.receivedAt?.toMillis() ?? 0))
const long = computed(() => props.inquiry.message.length > 280)
const replyLink = computed(() => mailto(props.inquiry.email, replyDraft(props.inquiry, me.value)))
const declineLink = computed(() => mailto(props.inquiry.email, declineDraft(props.inquiry, me.value)))
const replied = computed(() => props.inquiry.status === 'replied')

function move(status: InquiryStatus, done: string) {
  return toast.run(done, () => updateDoc(doc(db, 'inquiries', props.id), { status, handledBy: auth.email, handledAt: serverTimestamp() }))
}

function reveal() {
  if (location.hash !== `#inquiry-${props.id}`) return
  el.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  history.replaceState(history.state, '', location.pathname + location.search)
}

onMounted(() => {
  reveal()
  window.addEventListener('hashchange', reveal)
})
onUnmounted(() => window.removeEventListener('hashchange', reveal))
</script>

<template>
  <article :id="`inquiry-${id}`" ref="el" class="inquiry" :class="{ replied }">
    <header class="top">
      <DateBlock :date="inquiry.date" />
      <div class="title">
        <p class="eyebrow">{{ replied ? 'Inquired' : 'Booking inquiry' }}{{ received ? (replied ? ' ' : ' · ') + received : '' }}</p>
        <h3>{{ inquiry.name }}</h3>
        <p class="kind">{{ inquiry.eventType || 'Event' }}</p>
      </div>
    </header>

    <dl class="facts">
      <div>
        <dt>When</dt>
        <dd>{{ inquiry.date ? day(inquiry.date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'No date yet' }}</dd>
      </div>
      <div v-if="inquiry.location">
        <dt>Where</dt>
        <dd>{{ inquiry.location }}</dd>
      </div>
      <div>
        <dt>Budget</dt>
        <dd :class="{ muted: !inquiry.budget }">{{ inquiry.budget || 'Not given' }}</dd>
      </div>
      <div>
        <dt>Contact</dt>
        <dd class="contact">
          <a :href="`mailto:${inquiry.email}`">{{ inquiry.email }}</a>
          <a v-if="inquiry.phone" :href="`tel:${inquiry.phone.replace(/[^0-9+]/g, '')}`">{{ inquiry.phone }}</a>
        </dd>
      </div>
    </dl>

    <blockquote v-if="!replied || expanded" class="message" :class="{ clamp: long && !expanded }">{{ inquiry.message }}</blockquote>
    <button v-if="replied ? !expanded : long && !expanded" type="button" class="link" @click="expanded = true">
      {{ replied ? 'Show message' : 'Show all' }}
    </button>

    <div v-if="!declining" class="actions">
      <a v-if="!replied" class="btn" :href="replyLink" @click="move('replied', `${who} moved to Leads.`)">Reply</a>
      <RouterLink class="btn" :class="{ 'btn--ghost': !replied }" :to="{ path: '/gigs/new', query: { inquiry: id } }">Turn into a gig</RouterLink>
      <span class="minor">
        <button type="button" class="link" @click="declining = true">Not a fit</button>
        <a v-if="replied" class="link" :href="replyLink">Email again</a>
        <button v-else type="button" class="link" @click="move('spam', 'Marked as spam.')">Spam</button>
      </span>
    </div>
    <div v-else class="actions">
      <a class="btn btn--ghost" :href="declineLink" @click="move('declined', `${who} marked not a fit.`)">Send a polite no</a>
      <button type="button" class="btn btn--ghost" @click="move('declined', `${who} marked not a fit.`)">Close without replying</button>
      <button type="button" class="link" @click="declining = false">Back</button>
    </div>
  </article>
</template>

<style scoped>
.inquiry {
  display: grid;
  gap: 14px;
  padding: 18px;
  border: 1px solid var(--color-warning);
  border-radius: var(--radius);
  background: var(--color-surface);
  scroll-margin-top: 80px;
}

.inquiry.replied {
  border-color: var(--color-border);
}

.top {
  display: flex;
  gap: 14px;
  align-items: center;
}

.title {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.title h3 {
  margin: 0;
  font-size: 1.25rem;
  overflow-wrap: anywhere;
}

.kind {
  margin: 0;
  font-weight: 600;
}

.facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px 16px;
  margin: 0;
}

dt {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

dd {
  margin: 2px 0 0;
  overflow-wrap: anywhere;
}

.contact {
  display: grid;
  gap: 2px;
}

.message {
  margin: 0;
  padding: 10px 14px;
  border-left: 3px solid var(--color-accent);
  background: var(--color-bg);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.message.clamp {
  display: -webkit-box;
  -webkit-line-clamp: 6;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.inquiry > .link {
  justify-self: start;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 12px;
}

.minor {
  display: flex;
  gap: 16px;
  margin-left: auto;
}

@media (max-width: 480px) {
  .actions .btn {
    flex: 1 1 100%;
  }

  .minor {
    margin: 0 auto;
  }
}
</style>
