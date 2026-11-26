import type { Card } from './types'
import { shuffle, type Rng } from './feed'

export interface Quiz {
  card: Card // the card being recalled
  options: Card[] // three explanations, one of them card's own
}

/** "You saw this: which is it?" Title of a seen card, three bodies, one correct, decoys from other topics. */
export function makeQuiz(seenCards: readonly Card[], all: readonly Card[], rng: Rng = Math.random): Quiz | null {
  if (seenCards.length === 0) return null
  const card = seenCards[Math.floor(rng() * seenCards.length)]
  const decoys = shuffle(all.filter((c) => c.topic !== card.topic), rng).slice(0, 2)
  if (decoys.length < 2) return null
  return { card, options: shuffle([card, ...decoys], rng) }
}
