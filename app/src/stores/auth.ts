import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut as fbSignOut, type User } from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { OWNER_EMAIL, normalizeEmail, type AccessRecord } from '@/lib/access'

export type AuthStatus = 'loading' | 'signed-out' | 'no-access' | 'member' | 'error'

export const useAuth = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const access = ref<AccessRecord | null>(null)
  const status = ref<AuthStatus>('loading')
  const error = ref('')

  const email = computed(() => (user.value?.email ? normalizeEmail(user.value.email) : ''))
  const isAdmin = computed(() => access.value?.role === 'admin')

  let ready: Promise<void> | undefined

  async function loadAccess(u: User) {
    const key = normalizeEmail(u.email ?? '')
    const ref = doc(db, 'users', key)
    let snap = await getDoc(ref)
    if (!snap.exists() && key === OWNER_EMAIL) {
      await setDoc(ref, { name: u.displayName ?? 'Owner', role: 'admin', addedAt: serverTimestamp(), addedBy: key })
      snap = await getDoc(ref)
    }
    access.value = snap.exists() ? (snap.data() as AccessRecord) : null
    status.value = access.value ? 'member' : 'no-access'
  }

  function init() {
    ready ??= new Promise((resolve) => {
      onAuthStateChanged(auth, async (u) => {
        user.value = u
        access.value = null
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
    await fbSignOut(auth)
  }

  return { user, access, status, error, email, isAdmin, init, signIn, signOut }
})
