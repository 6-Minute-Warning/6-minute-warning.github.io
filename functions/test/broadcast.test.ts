import { describe, expect, it } from 'vitest'
import { BroadcastError, parseMessage } from '../src/broadcast'
import { BROADCAST_LIMITS, BROADCAST_TITLE } from '../src/constants'

describe('parseMessage', () => {
  it('trims and defaults the title', () => {
    expect(parseMessage({ body: '  Load-in at 5  ' })).toEqual({ title: BROADCAST_TITLE, body: 'Load-in at 5' })
  })

  it('keeps a given title', () => {
    expect(parseMessage({ title: 'Update', body: 'Hi' })).toEqual({ title: 'Update', body: 'Hi' })
  })

  it('rejects an empty body', () => {
    expect(() => parseMessage({ body: '   ' })).toThrow(BroadcastError)
    expect(() => parseMessage(undefined)).toThrow(BroadcastError)
  })

  it('rejects text over the limits', () => {
    expect(() => parseMessage({ body: 'x'.repeat(BROADCAST_LIMITS.body + 1) })).toThrow(BroadcastError)
    expect(() => parseMessage({ title: 'x'.repeat(BROADCAST_LIMITS.title + 1), body: 'hi' })).toThrow(BroadcastError)
  })
})
