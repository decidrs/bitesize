import { describe, expect, it } from 'vitest'
import { buildOrder, nextCycle, shuffle } from './feed'
import type { Card } from './types'

const mk = (id: string, topic: Card['topic'] = 'history'): Card => ({ id, topic, title: id, body: '', hook: '' })
const cards = [mk('a'), mk('b'), mk('c', 'space'), mk('d', 'space'), mk('e')]

describe('feed', () => {
  it('shuffle keeps every item', () => {
    expect(shuffle(cards).map((c) => c.id).sort()).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
  it('puts unseen cards before seen ones', () => {
    const order = buildOrder(cards, new Set(['a', 'b']), null)
    expect(order.slice(0, 3).map((c) => c.id).sort()).toEqual(['c', 'd', 'e'])
    expect(order.slice(3).map((c) => c.id).sort()).toEqual(['a', 'b'])
  })
  it('filters by topic', () => {
    expect(buildOrder(cards, new Set(), 'space').map((c) => c.id).sort()).toEqual(['c', 'd'])
  })
  it('never repeats a card across the join of two cycles', () => {
    for (let i = 0; i < 50; i++) {
      const next = nextCycle(cards, 'a')
      expect(next[0].id).not.toBe('a')
      expect(next).toHaveLength(5)
    }
  })
})
