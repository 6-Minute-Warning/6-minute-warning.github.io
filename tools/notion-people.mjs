import { mkdirSync, writeFileSync } from 'node:fs'

const PEOPLE_DB = '2265595a-f75a-80cf-8537-ce76bb9f3fc0'
const token = process.env.SING_NOTION_TOKEN
if (!token) {
  console.error('Set SING_NOTION_TOKEN to a Notion integration token that can read the 6MW People database.')
  process.exit(1)
}

const text = (prop) => (prop?.title ?? prop?.rich_text ?? []).map((t) => t.plain_text).join('').trim()

const res = await fetch(`https://api.notion.com/v1/databases/${PEOPLE_DB}/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
  body: '{}',
})
if (!res.ok) {
  console.error(`Notion returned ${res.status}: ${await res.text()}`)
  process.exit(1)
}

const people = (await res.json()).results.map((page) => ({
  name: text(page.properties.Name),
  status: page.properties['Member Status']?.select?.name ?? '',
  part: text(page.properties.Role),
  email: page.properties.Email?.email ?? '',
  phone: page.properties.phone?.phone_number ?? '',
}))

mkdirSync('.local', { recursive: true })
writeFileSync('.local/people-import.json', JSON.stringify({ source: 'notion', exportedAt: new Date().toISOString(), people }, null, 2))
console.log(`Wrote ${people.length} people to .local/people-import.json (not tracked by git).`)
