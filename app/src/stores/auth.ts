import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut as fbSignOut, type User } from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { OWNER_EMAIL, normalizeEmail, type AccessRecord } from '@/lib/access'
import { forgetDevice } from '@/lib/push'
import { parseView, viewedAccess, type ViewAs } from '@/lib/viewAs'

const VIEW_KEY = 'backstage.viewAs'

function storedView() {
  try {
    return parseView(sessionStorage.getItem(VIEW_KEY))
  } catch {
    return null
  }
}

export type AuthStatus = 'loading' | 'signed-out' | 'no-access' | 'member' | 'error'

export const useAuth = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const realAccess = ref<AccessRecord | null>(null)
  const view = ref<ViewAs | null>(storedView())
  const status = ref<AuthStatus>('loading')
  const error = ref('')
  const jobs = ref<string[]>([])

  const realEmail = computed(() => (user.value?.email ? normalizeEmail(user.value.email) : ''))
  const canViewAs = computed(() => realAccess.value?.role === 'admin')
  const viewing = computed(() => (canViewAs.value && view.value) || null)
  // Derive every role check from access, never realAccess, so View as reaches it.
  const access = computed(() => viewedAccess(realAccess.value, view.value))
  const email = computed(() => (viewing.value ? '' : realEmail.value))
  const isAdmin = computed(() => access.value?.role === 'admin')
  const isManager = computed(() => access.value?.role === 'admin' || access.value?.role === 'manager')
  const isDirector = computed(() => access.value?.role === 'director')
  const isScheduler = computed(() => jobs.value.includes('scheduler') || !!access.value?.duties?.includes('scheduler'))
  const canBook = computed(() => isManager.value || isScheduler.value)

  watch(
    () => access.value?.person ?? '',
    async (person) => {
      const snap = person ? await getDoc(doc(db, 'people', person)).catch(() => null) : null
      const found = snap?.exists() ? snap.data().jobs : null
      if ((access.value?.person ?? '') === person) jobs.value = Array.isArray(found) ? found : []
    },
    { immediate: true },
  )

  let ready: Promise<void> | undefined

  async function loadAccess(u: User) {
    const key = normalizeEmail(u.email ?? '')
    const ref = doc(db, 'users', key)
    let snap = await getDoc(ref)
    if (!snap.exists() && key === OWNER_EMAIL) {
      await setDoc(ref, { name: u.displayName ?? 'Owner', role: 'admin', addedAt: serverTimestamp(), addedBy: key })
      snap = await getDoc(ref)
    }
    realAccess.value = snap.exists() ? (snap.data() as AccessRecord) : null
    status.value = realAccess.value ? 'member' : 'no-access'
  }

  function init() {
    ready ??= new Promise((resolve) => {
      onAuthStateChanged(auth, async (u) => {
        user.value = u
        realAccess.value = null
        error.value = ''
        try {
          if (!u) status.value = 'signed-out'
          else if (!u.emailVerified) status.value = 'no-access'
          else await loadAccess(u)
        } catch (e) {
          status.value = 'error'
          error.value = e instanceof Error ? e.message : String(e)
        }
        resolve()
      })
    })
    return ready
  }

  async function signIn() {
    error.value = ''
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  async function signOut() {
    await forgetDevice()
    viewAs(null)
    await fbSignOut(auth)
  }

  function viewAs(next: ViewAs | null) {
    view.value = next
    try {
      if (next) sessionStorage.setItem(VIEW_KEY, JSON.stringify(next))
      else sessionStorage.removeItem(VIEW_KEY)
    } catch {
      /* storage blocked: the view lasts until reload */
    }
  }

  return { user, realAccess, access, status, error, realEmail, email, canViewAs, viewing, isAdmin, isManager, isDirector, isScheduler, canBook, init, signIn, signOut, viewAs }
})
