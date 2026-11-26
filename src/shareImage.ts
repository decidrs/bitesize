// Renders a card as a 1080x1350 PNG for sharing to chats and stories.
import type { Card } from './types'

export const SITE = (import.meta.env.VITE_SITE_URL as string | undefined) || 'https://bitesize-blond.vercel.app'

const ACCENT: Record<string, string> = {
  history: '#e0a458', science: '#5fb4d9', business: '#7fc97f', nature: '#9ccc65', space: '#b39ddb', language: '#f48fb1',
}

/** Blend colour a into b by share t (0..1), like CSS color-mix. */
function mix(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const [x, y] = [p(a), p(b)]
  return `rgb(${x.map((v, i) => Math.round(v * t + y[i] * (1 - t))).join(',')})`
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else line = test
  }
  if (line) lines.push(line)
  return lines
}

export async function cardImage(c: Card, label: string): Promise<Blob> {
  const W = 1080, H = 1350, X = 110, MAX = W - 2 * X
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const accent = ACCENT[c.topic] ?? '#f4f1ea'
  ctx.fillStyle = '#111318'
  ctx.fillRect(0, 0, W, H)
  // Soft look: the card is a rounded panel tinted with its topic colour.
  ctx.fillStyle = mix(accent, '#16181e', 0.13)
  ctx.strokeStyle = mix(accent, '#111318', 0.25)
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.roundRect(50, 50, W - 100, H - 200, 64)
  ctx.fill()
  ctx.stroke()

  ctx.font = '600 52px Georgia, serif'
  const title = wrap(ctx, c.title, MAX)
  ctx.font = '38px system-ui, -apple-system, sans-serif'
  const body = wrap(ctx, c.body, MAX)
  ctx.font = 'italic 34px system-ui, -apple-system, sans-serif'
  const hook = wrap(ctx, c.hook, MAX)
  const blockH = 40 + 30 + title.length * 64 + 36 + body.length * 56 + 30 + hook.length * 48
  let y = Math.max(140, (H - 150 - blockH) / 2)


  ctx.fillStyle = accent
  ctx.font = '700 28px system-ui, -apple-system, sans-serif'
  ctx.fillText(label.toUpperCase(), X, y + 28)
  y += 40 + 30 + 52
  ctx.fillStyle = '#f4f1ea'
  ctx.font = '600 52px Georgia, serif'
  for (const l of title) { ctx.fillText(l, X, y); y += 64 }
  y += 36
  ctx.font = '38px system-ui, -apple-system, sans-serif'
  for (const l of body) { ctx.fillText(l, X, y); y += 56 }
  y += 30
  ctx.fillStyle = accent
  ctx.font = 'italic 34px system-ui, -apple-system, sans-serif'
  for (const l of hook) { ctx.fillText(l, X, y); y += 48 }


  ctx.fillStyle = '#a9a59c'
  ctx.font = '30px system-ui, -apple-system, sans-serif'
  ctx.fillText(`Morsel · ${SITE.replace(/^https?:\/\//, '')}`, X, H - 70)

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no image'))), 'image/png'))
}
