export const TOPICS = ['history', 'science', 'business', 'nature', 'space', 'language'] as const
export type Topic = (typeof TOPICS)[number]

export interface Card {
  id: string
  topic: Topic
  title: string
  body: string
  hook: string
}
