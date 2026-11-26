import type { Card } from './types'
import { shuffle, type Rng } from './feed'

export const TODAY_COUNT = 5

/** Local calendar day as YYYY-MM-DD. */
export function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / 86400000)
}

/** Monday-based week index, so "one free miss a week" resets each Monday. */
function weekOf(key: string): number {
  return Math.floor((dayNumber(key) + 3) / 7)
}

/** Small seeded generator so everyone's "Today's 5" is stable through the day. */
export function seeded(seed: string): Rng {
  let h = 2166136261
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

/** Five cards for the day: unseen first, from as many different topics as possible. */
export function pickToday(cards: readonly Card[], seen: ReadonlySet<string>, day: string): Card[] {
  const rng = seeded(day)
  const unseen = shuffle(cards.filter((c) => !seen.has(c.id)), rng)
  const rest = shuffle(cards.filter((c) => seen.has(c.id)), rng)
  const out: Card[] = []
  const topics = new Set<string>()
  for (const c of unseen) {
    if (out.length < TODAY_COUNT && !topics.has(c.topic)) {
      out.push(c)
      topics.add(c.topic)
    }
  }
  for (const c of [...unseen, ...rest]) {
    if (out.length < TODAY_COUNT && !out.includes(c)) out.push(c)
  }
  return out
}

export interface Streak {
  count: number
  last: string | null // day the last Today's 5 was finished
  freeWeek: number | null // week in which the free miss was used
}

export const NO_STREAK: Streak = { count: 0, last: null, freeWeek: null }

/** Record finishing Today's 5 on `today`. One missed day per week is forgiven. */
export function completeDay(s: Streak, today: string): Streak {
  if (s.last === today) return s
  if (!s.last) return { count: 1, last: today, freeWeek: s.freeWeek }
  const gap = dayNumber(today) - dayNumber(s.last)
  if (gap === 1) return { ...s, count: s.count + 1, last: today }
  if (gap === 2 && s.freeWeek !== weekOf(today)) return { count: s.count + 1, last: today, freeWeek: weekOf(today) }
  return { count: 1, last: today, freeWeek: s.freeWeek }
}

/** The streak as it stands today (0 if it has already lapsed). */
export function currentStreak(s: Streak, today: string): number {
  if (!s.last) return 0
  const gap = dayNumber(today) - dayNumber(s.last)
  if (gap <= 1) return s.count
  if (gap === 2 && s.freeWeek !== weekOf(today)) return s.count
  return 0
}
