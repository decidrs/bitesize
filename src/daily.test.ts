import { describe, expect, it } from 'vitest'
import { completeDay, currentStreak, dayKey, NO_STREAK, pickToday, TODAY_COUNT } from './daily'
import { makeQuiz } from './quiz'
import deck from './data/cards.json'
import type { Card } from './types'

const cards = deck as Card[]

describe("Today's 5", () => {
  it('is five distinct cards, stable for the day, and topic-diverse', () => {
    const a = pickToday(cards, new Set(), '2026-11-26')
    expect(a).toHaveLength(TODAY_COUNT)
    expect(new Set(a.map((c) => c.id)).size).toBe(TODAY_COUNT)
    expect(new Set(a.map((c) => c.topic)).size).toBe(TODAY_COUNT)
    expect(pickToday(cards, new Set(), '2026-11-26').map((c) => c.id)).toEqual(a.map((c) => c.id))
    expect(pickToday(cards, new Set(), '2026-11-27').map((c) => c.id)).not.toEqual(a.map((c) => c.id))
  })
  it('prefers unseen cards', () => {
    const seen = new Set(cards.slice(0, cards.length - 5).map((c) => c.id))
    const t = pickToday(cards, seen, '2026-11-26')
    expect(t.every((c) => !seen.has(c.id))).toBe(true)
  })
  it('still fills five when everything is seen', () => {
    expect(pickToday(cards, new Set(cards.map((c) => c.id)), '2026-11-26')).toHaveLength(5)
  })
  it('formats local days', () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('streak', () => {
  it('counts consecutive days and ignores a second finish the same day', () => {
    let s = completeDay(NO_STREAK, '2026-11-23')
    s = completeDay(s, '2026-11-24')
    s = completeDay(s, '2026-11-24')
    expect(s.count).toBe(2)
  })
  it('forgives one missed day per week', () => {
    let s = completeDay(NO_STREAK, '2026-11-23') // Mon
    s = completeDay(s, '2026-11-25') // missed Tue: forgiven
    expect(s.count).toBe(2)
    s = completeDay(s, '2026-11-27') // missed Thu, same week: resets
    expect(s.count).toBe(1)
  })
  it('allows a new free miss the following week', () => {
    let s = completeDay(NO_STREAK, '2026-11-23')
    s = completeDay(s, '2026-11-25')
    s = completeDay(s, '2026-11-26')
    s = completeDay(s, '2026-11-27')
    s = completeDay(s, '2026-11-28')
    s = completeDay(s, '2026-11-29')
    s = completeDay(s, '2026-12-01') // missed Mon 30th, new week
    expect(s.count).toBe(7)
  })
  it('shows a lapsed streak as zero', () => {
    const s = completeDay(NO_STREAK, '2026-11-23')
    expect(currentStreak(s, '2026-11-24')).toBe(1)
    expect(currentStreak(s, '2026-11-25')).toBe(1)
    expect(currentStreak(s, '2026-11-26')).toBe(0)
  })
})

describe('quiz', () => {
  it('has three options including the right one, decoys from other topics', () => {
    const q = makeQuiz(cards.slice(0, 3), cards)!
    expect(q.options).toHaveLength(3)
    expect(q.options).toContain(q.card)
    expect(q.options.filter((o) => o !== q.card).every((o) => o.topic !== q.card.topic)).toBe(true)
  })
})
