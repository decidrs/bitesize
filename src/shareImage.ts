// Renders a card as a 1080x1350 PNG for sharing to chats and stories.
import type { Card } from './types'

export const SITE = (import.meta.env.VITE_SITE_URL as string | undefined) || 'https://bitesize-blond.vercel.app'

const ACCENT: Record<string, string> = {
  history: '#e0a458', science: '#5fb4d9', business: '#7fc97f', nature: '#9ccc65', space: '#b39ddb', language: '#f48fb1',
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
  ctx.fillStyle = '#0d0f14'
  ctx.fillRect(0, 0, W, H)

  ctx.font = '600 52px Georgia, serif'
  const title = wrap(ctx, c.title, MAX)
  ctx.font = '38px system-ui, -apple-system, sans-serif'
  const body = wrap(ctx, c.body, MAX)
  ctx.font = 'italic 34px system-ui, -apple-system, sans-serif'
  const hook = wrap(ctx, c.hook, MAX)
  const blockH = 40 + 30 + title.length * 64 + 36 + body.length * 56 + 30 + hook.length * 48
  let y = Math.max(140, (H - blockH) / 2)

  const top = y
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
  ctx.fillRect(X - 40, top - 10, 6, y - 30 - top)

  ctx.fillStyle = '#a9a59c'
  ctx.font = '30px system-ui, -apple-system, sans-serif'
  ctx.fillText(`Morsel · ${SITE.replace(/^https?:\/\//, '')}`, X, H - 90)

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no image'))), 'image/png'))
}
