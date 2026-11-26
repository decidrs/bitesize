// Turns content/*.tsv (title \t body \t hook) into src/data/cards.json. Run: npm run content
import { readFileSync, writeFileSync } from 'node:fs'
const TOPICS = ['history', 'science', 'business', 'nature', 'space', 'language']
const cards = []
for (const topic of TOPICS) {
  const rows = readFileSync(new URL(`./${topic}.tsv`, import.meta.url), 'utf8').split('\n').filter(Boolean)
  rows.forEach((row, i) => {
    const [title, body, hook, extra] = row.split('\t')
    if (!title || !body || !hook || extra !== undefined) throw new Error(`${topic}.tsv line ${i + 1}: need exactly 3 tab-separated fields`)
    cards.push({ id: `${topic.slice(0, 3)}-${String(i + 1).padStart(3, '0')}`, topic, title, body, hook })
  })
}
writeFileSync(new URL('../src/data/cards.json', import.meta.url), JSON.stringify(cards, null, 1) + '\n')
console.log(`${cards.length} cards`)
