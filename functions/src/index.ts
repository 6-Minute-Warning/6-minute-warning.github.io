import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { defineSecret } from 'firebase-functions/params'
import { onRequest } from 'firebase-functions/v2/https'
import { ApiError, handle } from './assistant'
import { keyMatches } from './auth'
import { API_KEY_SECRET, REGION } from './constants'

initializeApp()
const apiKey = defineSecret(API_KEY_SECRET)

export const assistant = onRequest({ region: REGION, secrets: [apiKey], cors: false, memory: '256MiB', maxInstances: 5 }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Send a POST with a JSON body.' })
    return
  }
  if (!keyMatches(req.get('authorization'), apiKey.value())) {
    res.status(401).json({ error: 'Missing or wrong API key.' })
    return
  }
  try {
    res.json({ ok: true, ...(await handle(getFirestore(), req.body)) as object })
  } catch (e) {
    if (e instanceof ApiError) res.status(e.status).json({ error: e.message })
    else {
      console.error(e)
      res.status(500).json({ error: 'The server could not finish that. Try again.' })
    }
  }
})
