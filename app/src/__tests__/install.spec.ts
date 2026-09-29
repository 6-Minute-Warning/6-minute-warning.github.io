import { describe, expect, it } from 'vitest'
import { platform } from '@/lib/install'

describe('install platform', () => {
  it('tells iPhone, Android and desktop apart', () => {
    expect(platform('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1')).toBe('iphone')
    expect(platform('Mozilla/5.0 (Linux; Android 15; Pixel 10) Chrome/140 Mobile Safari/537.36')).toBe('android')
    expect(platform('Mozilla/5.0 (X11; Linux x86_64) Chrome/140 Safari/537.36')).toBe('desktop')
  })
})
