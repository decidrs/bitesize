import type { Card, Topic } from './types'

export type Rng = () => number

export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const a = items.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Filter by topic (null = all), then put unseen cards first, each group shuffled. */
export function buildOrder(
  cards: readonly Card[],
  seen: ReadonlySet<string>,
  topic: Topic | null,
  rng: Rng = Math.random,
): Card[] {
  const pool = topic ? cards.filter((c) => c.topic === topic) : cards
  const unseen = pool.filter((c) => !seen.has(c.id))
  const done = pool.filter((c) => seen.has(c.id))
  return [...shuffle(unseen, rng), ...shuffle(done, rng)]
}

/** Another full cycle for an endless feed, avoiding an immediate repeat at the join. */
export function nextCycle(pool: readonly Card[], lastId: string | undefined, rng: Rng = Math.random): Card[] {
  const next = shuffle(pool, rng)
  if (next.length > 1 && next[0].id === lastId) {
    ;[next[0], next[1]] = [next[1], next[0]]
  }
  return next
}
