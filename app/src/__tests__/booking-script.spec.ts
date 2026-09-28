// @vitest-environment node
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { beforeEach, describe, expect, it } from 'vitest'

interface Call {
  method: string
  url: string
  body: Record<string, unknown> | undefined
  headers: Record<string, string>
}

const source = readFileSync(new URL('../../../site/apps-script/Code.gs', import.meta.url), 'utf8')
const FS = 'https://firestore.googleapis.com/v1/projects/six-minute-warning/databases/(default)/documents'

let calls: Call[]
let mail: { subject: string; replyTo: string }[]
let rows: unknown[][]
let replies: (call: Call) => { code: number; body?: unknown }
let cache: Record<string, string>
let mailFails: boolean

function reply(code: number, body?: unknown) {
  return { getResponseCode: () => code, getContentText: () => JSON.stringify(body ?? {}) }
}

function load() {
  const context: Record<string, unknown> = {
    console: { log: () => undefined, error: () => undefined },
    MailApp: {
      sendEmail: (m: { subject: string; replyTo: string }) => {
        if (mailFails) throw new Error('quota')
        mail.push(m)
      },
    },
    CacheService: { getScriptCache: () => ({ get: (k: string) => cache[k] ?? null, put: (k: string, v: string) => (cache[k] = v) }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'sheet-1' }) },
    SpreadsheetApp: { openById: () => ({ getSheets: () => [{ appendRow: (r: unknown[]) => rows.push(r) }] }) },
    ScriptApp: { getOAuthToken: () => 'oauth-token' },
    ContentService: { createTextOutput: (text: string) => ({ setMimeType: () => text }), MimeType: { JSON: 'json' } },
    UrlFetchApp: {
      fetch: (url: string, o: { method: string; payload?: string; headers: Record<string, string> }) => {
        const call = { method: o.method, url, body: o.payload ? JSON.parse(o.payload) : undefined, headers: o.headers }
        calls.push(call)
        const r = replies(call)
        return reply(r.code, r.body)
      },
    },
  }
  runInNewContext(`${source}\nthis.doPost = doPost; this.judge = judge; this.clean = clean;`, context)
  return context as { doPost: (e: { parameter: Record<string, string> }) => string; judge: (raw: Record<string, string>, p: Record<string, string>) => string; clean: (p: Record<string, string>) => Record<string, string> }
}

const form = { name: 'Jane Doe', email: 'jane@example.com', phone: '', eventType: 'Wedding', date: '2026-11-14', location: 'Edmonton', budget: '$2,500', message: 'We would love a cappella at our wedding.', website: '', fillMs: '9000' }

function token(id: string, email: string) {
  return { document: { name: `${FS}/pushTokens/${id}`, fields: { email: { stringValue: email }, token: { stringValue: `fcm-${id}` } } } }
}

beforeEach(() => {
  calls = []
  mail = []
  rows = []
  cache = {}
  mailFails = false
  replies = (call) => {
    if (call.url === `${FS}/inquiries`) return { code: 200, body: { name: `${FS}/inquiries/abc123` } }
    if (call.url === `${FS}:runQuery`) return { code: 200, body: [token('t1', 'manager@example.com'), token('t2', 'member@example.com'), token('t3', 'manager@example.com')] }
    if (call.url.endsWith('/users/manager%40example.com')) return { code: 200, body: { fields: { role: { stringValue: 'manager' } } } }
    if (call.url.endsWith('/users/member%40example.com')) return { code: 200, body: { fields: { role: { stringValue: 'member' } } } }
    if (call.url.includes('fcm.googleapis.com')) return { code: (call.body as { message: { token: string } }).message.token === 'fcm-t3' ? 404 : 200 }
    return { code: 200 }
  }
})

describe('booking form script', () => {
  it('emails, saves the inquiry for Backstage, and notifies manager devices only', () => {
    const script = load()
    expect(JSON.parse(script.doPost({ parameter: form }))).toEqual({ ok: true })
    expect(mail).toHaveLength(1)
    expect(mail[0]!.subject).toBe('Booking inquiry: Wedding on 2026-11-14 (Jane Doe)')

    const save = calls.find((c) => c.url === `${FS}/inquiries`)!
    const fields = save.body!.fields as Record<string, { stringValue?: string; timestampValue?: string }>
    expect(fields.status!.stringValue).toBe('new')
    expect(fields.budget!.stringValue).toBe('$2,500')
    expect(fields.receivedAt!.timestampValue).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(save.headers.Authorization).toBe('Bearer oauth-token')

    const pushes = calls.filter((c) => c.url.includes('fcm.googleapis.com'))
    expect(pushes.map((c) => (c.body as { message: { token: string } }).message.token)).toEqual(['fcm-t1', 'fcm-t3'])
    const data = (pushes[0]!.body as { message: { data: Record<string, string> } }).message.data
    expect(data).toEqual({ title: 'Booking inquiry from Jane Doe', body: 'Wedding · 2026-11-14 · Edmonton', link: '/#inquiry-abc123', tag: 'inquiry-abc123' })
    expect(calls.filter((c) => c.url.includes('/users/manager'))).toHaveLength(1)
    expect(calls.some((c) => c.method === 'delete' && c.url === `${FS}/pushTokens/t3`)).toBe(true)
    expect(rows[0]![1]).toBe('sent')
  })

  it('drops honeypot and too-fast submissions without email, Firestore or push', () => {
    const script = load()
    script.doPost({ parameter: { ...form, website: 'http://spam.example' } })
    script.doPost({ parameter: { ...form, fillMs: '800' } })
    expect(mail).toHaveLength(0)
    expect(calls).toHaveLength(0)
    expect(rows.map((r) => r[1])).toEqual(['spam', 'spam'])
  })

  it('emails content that looks like spam with a flag, but keeps it off the dashboard', () => {
    const script = load()
    script.doPost({ parameter: { ...form, message: 'Get your site on the first page of Google with our SEO package' } })
    expect(mail[0]!.subject).toMatch(/^\[Likely spam\] /)
    expect(calls).toHaveLength(0)
    expect(rows[0]![1]).toBe('suspect')
  })

  it('still answers the visitor when Firestore is down', () => {
    replies = () => ({ code: 500, body: { error: 'down' } })
    const script = load()
    expect(JSON.parse(script.doPost({ parameter: form }))).toEqual({ ok: true })
    expect(mail).toHaveLength(1)
    expect(calls.some((c) => c.url.includes('fcm'))).toBe(false)
  })

  it('refuses a real-looking submission missing required fields or with a bad email', () => {
    const script = load()
    expect(JSON.parse(script.doPost({ parameter: { ...form, email: '' } }))).toEqual({ ok: false, error: 'missing fields' })
    expect(JSON.parse(script.doPost({ parameter: { ...form, email: 'a@b.co?bcc=x@y.co' } }))).toEqual({ ok: false, error: 'missing fields' })
  })

  it('still saves the inquiry when the email fails', () => {
    mailFails = true
    const script = load()
    expect(JSON.parse(script.doPost({ parameter: form }))).toEqual({ ok: true })
    expect(calls.some((c) => c.url === `${FS}/inquiries`)).toBe(true)
  })

  it('stops notifying after ten inquiries in an hour, but keeps saving them', () => {
    const script = load()
    for (let i = 0; i < 12; i++) script.doPost({ parameter: form })
    expect(calls.filter((c) => c.url === `${FS}/inquiries`)).toHaveLength(12)
    expect(calls.filter((c) => c.url === `${FS}:runQuery`)).toHaveLength(10)
  })

  it('skips a device when its owner cannot be checked, and still reaches the rest', () => {
    const base = replies
    replies = (call) => (call.url.endsWith('/users/manager%40example.com') ? { code: 500 } : base(call))
    const script = load()
    script.doPost({ parameter: form })
    expect(calls.filter((c) => c.url.includes('fcm.googleapis.com'))).toHaveLength(0)
    expect(calls.filter((c) => c.url.includes('/users/'))).toHaveLength(2)
  })

  it('keeps line breaks out of one-line fields', () => {
    const { clean } = load()
    expect(clean({ ...form, name: 'Jane\r\nBcc: x' }).name).toBe('Jane Bcc: x')
    expect(clean({ ...form, message: 'a\nb' }).message).toBe('a\nb')
  })

  it('judges content conservatively', () => {
    const { judge, clean } = load()
    const check = (over: Record<string, string>) => judge({ ...form, ...over }, clean({ ...form, ...over }))
    expect(check({})).toBe('ok')
    expect(check({ message: 'Our venue is www.example.com, details at https://example.com/event' })).toBe('ok')
    expect(check({ message: 'see http://a.example http://b.example http://c.example' })).toBe('suspect')
    expect(check({ name: 'Buy now https://x.example' })).toBe('suspect')
    expect(check({ message: 'Здравствуйте, предлагаем услуги продвижения сайтов' })).toBe('suspect')
    expect(check({ message: 'Nous organisons un gala à Montréal, êtes-vous disponibles?' })).toBe('ok')
    expect(check({ message: 'Our crypto conference gala needs music' })).toBe('suspect')
  })

  it('drops a malformed date and trims long fields', () => {
    const { clean } = load()
    const p = clean({ ...form, date: 'next week', message: 'x'.repeat(5000) })
    expect(p.date).toBe('')
    expect(p.message).toHaveLength(4000)
  })
})
