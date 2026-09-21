import { mkdirSync, writeFileSync } from 'node:fs'

const GIGS_DB = '19d5595a-f75a-80fb-ab87-e721dd1fcd2a'
const token = process.env.SING_NOTION_TOKEN
if (!token) {
  console.error('Set SING_NOTION_TOKEN to a Notion integration token that can read the 6MW Gigs database.')
  process.exit(1)
}

const headers = { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' }
const text = (prop) => (prop?.title ?? prop?.rich_text ?? []).map((t) => t.plain_text).join('').trim()
const pick = (props, ...names) => names.map((n) => props[n]).find((p) => p !== undefined)

async function notion(path, init) {
  const res = await fetch(`https://api.notion.com/v1/${path}`, { headers, ...init })
  if (!res.ok) throw new Error(`Notion ${path} returned ${res.status}: ${await res.text()}`)
  return res.json()
}

const titles = new Map()
async function titleOf(id) {
  if (!titles.has(id)) {
    try {
      const page = await notion(`pages/${id}`)
      const prop = Object.values(page.properties).find((p) => p.type === 'title')
      titles.set(id, text(prop))
    } catch {
      titles.set(id, '')
    }
  }
  return titles.get(id)
}

const rows = []
let cursor
do {
  const page = await notion(`databases/${GIGS_DB}/query`, {
    method: 'POST',
    body: JSON.stringify(cursor ? { start_cursor: cursor } : {}),
  })
  rows.push(...page.results)
  cursor = page.has_more ? page.next_cursor : undefined
} while (cursor)

const gigs = []
for (const row of rows) {
  const p = row.properties
  const venueIds = p.Venue?.relation?.map((r) => r.id) ?? []
  gigs.push({
    name: text(pick(p, 'Gig Name', 'Name')),
    date: p.Date?.date?.start ?? '',
    time: text(p.Time),
    stage: p['Gig Stage']?.select?.name ?? '',
    status: p.Status?.status?.name ?? p.Status?.select?.name ?? '',
    action: p['Action Needed']?.select?.name ?? '',
    paymentStatus: p['Payment Status']?.select?.name ?? '',
    contractStatus: p['Contract Status']?.rollup?.array?.[0]?.select?.name ?? '',
    fee: p['Contract Fee']?.number ?? 0,
    deposit: p['Deposit (as per contract)']?.number ?? 0,
    paid: p['Total Amount Paid']?.number ?? 0,
    merch: p['Merch Proceeds (Total)']?.number ?? 0,
    contactName: text(p['Contact Person']),
    contactEmail: p.Email?.email ?? '',
    contactPhone: p['Contact Phone']?.phone_number ?? '',
    venue: (await Promise.all(venueIds.map(titleOf))).filter(Boolean).join(', '),
    notes: text(p.Notes),
    thankYou: p['Thank You Email']?.status?.name ?? '',
  })
}

mkdirSync('.local', { recursive: true })
writeFileSync('.local/gigs-import.json', JSON.stringify({ source: 'notion', exportedAt: new Date().toISOString(), gigs }, null, 2))
console.log(`Wrote ${gigs.length} gigs to .local/gigs-import.json (not tracked by git).`)
