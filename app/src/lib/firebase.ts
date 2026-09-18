import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

const app = initializeApp({
  apiKey: 'AIzaSyDit_axJ1UnfGOkZmrZuNddBfRXPwuqIgY',
  authDomain: 'six-minute-warning.firebaseapp.com',
  projectId: 'six-minute-warning',
  storageBucket: 'six-minute-warning.firebasestorage.app',
  messagingSenderId: '56775590825',
  appId: '1:56775590825:web:8b4b16dbf0a010e2693ab8',
})

export const auth = getAuth(app)
export const db = getFirestore(app)

if (import.meta.env.VITE_EMULATORS === '1') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}
