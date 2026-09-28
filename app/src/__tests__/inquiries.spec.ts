import { describe, expect, it } from 'vitest'
import { ago, byNewest, declineDraft, gigDraft, gigName, mailto, owed, replyDraft, type Inquiry } from '@/lib/inquiries'
import { deviceName, pushState, tokenId } from '@/lib/push'

const at = (ms: number) => ({ toMillis: () => ms })
const inquiry: Inquiry = {
  name: 'Jane Doe',
  email: 'jane+gala@example.com',
  phone: '780-555-0100',
  eventType: 'Awards gala',
  date: '2026-11-14',
  location: 'Winspear Centre',
  budget: '$2,000 to $3,000',
  message: 'Our awards night & dinner',
  status: 'new',
  source: 'website',
  receivedAt: at(1000),
}

describe('booking inquiries', () => {
  it('drafts a reply addressed by first name, naming the event and date', () => {
    const { subject, body } = replyDraft(inquiry, 'Brett')
    expect(subject).toBe('Your inquiry to 6 Minute Warning')
    expect(body).toMatch(/^Hi Jane,\n\nThanks for getting in touch about your awards gala on Saturday, November 14\./)
    expect(body.endsWith('Brett\n6 Minute Warning')).toBe(true)
  })

  it('says event when the type is Other or missing, and leaves the date out when there is none', () => {
    expect(replyDraft({ ...inquiry, eventType: 'Other', date: '' }, 'Brett').body).toContain('about your event.')
    expect(declineDraft({ ...inquiry, eventType: '' }, 'Brett').body).toContain('for your event on Saturday, November 14.')
  })

  it('builds a mailto that keeps the address readable and encodes the rest', () => {
    const link = mailto(inquiry.email, { subject: 'Hi & bye', body: 'Line 1\nLine 2' })
    expect(link).toBe('mailto:jane%2Bgala@example.com?subject=Hi%20%26%20bye&body=Line%201%0ALine%202')
  })

  it('prefills a gig from the inquiry', () => {
    expect(gigDraft(inquiry)).toEqual({
      name: 'Awards gala for Jane Doe',
      date: '2026-11-14',
      venue: 'Winspear Centre',
      presenter: 'Jane Doe',
      email: 'jane+gala@example.com',
      phone: '780-555-0100',
    })
    expect(gigName({ name: 'Pat', eventType: 'Other' })).toBe('Gig for Pat')
    expect(gigName({ name: 'Pat', eventType: 'Concert series or presenter' })).toBe('Gig for Pat')
  })

  it('counts a new inquiry as a reply owed, and nothing else', () => {
    expect(owed('i1', inquiry)).toEqual({ kind: 'reply', target: 'inquiries/i1', title: 'Reply to Jane Doe', since: 1000 })
    expect(owed('i1', { ...inquiry, status: 'replied' })).toBeNull()
  })

  it('says how long ago it came in', () => {
    const now = 10 * 86400000
    expect(ago(now - 30000, now)).toBe('just now')
    expect(ago(now - 5 * 60000, now)).toBe('5 minutes ago')
    expect(ago(now - 3 * 3600000, now)).toBe('3 hours ago')
    expect(ago(now - 86400000, now)).toBe('yesterday')
    expect(ago(now - 4 * 86400000, now)).toBe('4 days ago')
    expect(ago(0, now)).toBe('')
  })

  it('sorts newest first, with unsaved timestamps last', () => {
    const rows = [{ receivedAt: at(1) }, { receivedAt: null }, { receivedAt: at(5) }]
    expect(byNewest(rows).map((r) => r.receivedAt?.toMillis() ?? null)).toEqual([5, 1, null])
  })
})

describe('push notifications', () => {
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1'
  const android = 'Mozilla/5.0 (Linux; Android 15; Pixel 7 Pro) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36'

  it('asks an iPhone in Safari to add Backstage to the home screen first', () => {
    expect(pushState({ ua: iphone, standalone: false, hasPush: false })).toBe('install-first')
    expect(pushState({ ua: iphone, standalone: true, hasPush: true, permission: 'default' })).toBe('default')
    expect(pushState({ ua: android, standalone: false, hasPush: false })).toBe('unsupported')
    expect(pushState({ ua: android, standalone: false, hasPush: true, permission: 'denied' })).toBe('denied')
  })

  it('names the device', () => {
    expect(deviceName(android)).toBe('Chrome on Android')
    expect(deviceName(iphone)).toBe('Safari on iPhone')
  })

  it('keys a token by its hash so the id never holds the token', async () => {
    const id = await tokenId('abc')
    expect(id).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})
