import { describe, expect, it } from 'vitest'
import deck from './data/cards.json'
import { TOPICS, type Card } from './types'

const cards = deck as Card[]

describe('starter deck', () => {
  it('has at least 20 cards per topic', () => {
    for (const t of TOPICS) expect(cards.filter((c) => c.topic === t).length).toBeGreaterThanOrEqual(20)
  })
  it('has unique ids', () => {
    expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length)
  })
  it('keeps every card short enough for one phone screen', () => {
    for (const c of cards) {
      expect(c.title.length, c.id).toBeLessThanOrEqual(70)
      expect(c.body.length, c.id).toBeLessThanOrEqual(260)
      expect(c.hook.length, c.id).toBeLessThanOrEqual(90)
    }
  })
})
