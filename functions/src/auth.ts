import { createHash, timingSafeEqual } from 'node:crypto'

const digest = (s: string) => createHash('sha256').update(s).digest()

export function keyMatches(header: string | undefined, key: string): boolean {
  const given = /^Bearer (.+)$/.exec(header ?? '')?.[1]
  return !!given && !!key && timingSafeEqual(digest(given), digest(key))
}
