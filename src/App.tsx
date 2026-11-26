import { useEffect, useMemo, useRef, useState } from 'react'
import deck from './data/cards.json'
import { buildOrder, nextCycle } from './feed'
import { loadSaved, loadSeen, saveSaved, saveSeen } from './storage'
import { TOPICS, type Card, type Topic } from './types'
import { dailyReminderOn, isNative, nativeShare, setDailyReminder, tick } from './native'

const CARDS = deck as Card[]
const FEEDBACK = import.meta.env.VITE_FEEDBACK_EMAIL as string | undefined

const LABEL: Record<Topic, string> = {
  history: 'History',
  science: 'Science',
  business: 'Business',
  nature: 'Nature',
  space: 'Space',
  language: 'Words',
}

type View = { kind: 'feed'; topic: Topic | null } | { kind: 'saved' }

export default function App() {
  const [view, setView] = useState<View>({ kind: 'feed', topic: null })
  const [seen] = useState(loadSeen)
  const [saved, setSaved] = useState(loadSaved)
  const [toast, setToast] = useState('')
  const [feed, setFeed] = useState<Card[]>([])
  const feedRef = useRef<HTMLDivElement>(null)
  const [reminder, setReminder] = useState(false)

  useEffect(() => {
    dailyReminderOn().then(setReminder)
  }, [])

  const pool = useMemo(() => {
    if (view.kind === 'saved') return CARDS.filter((c) => saved.has(c.id))
    return view.topic ? CARDS.filter((c) => c.topic === view.topic) : CARDS
    // saved list is snapshotted when the view opens, so un-saving doesn't yank cards away
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  useEffect(() => {
    setFeed(view.kind === 'saved' ? pool : buildOrder(CARDS, seen, view.topic))
    feedRef.current?.scrollTo({ top: 0 })
  }, [view, pool, seen])

  // Mark cards seen as they come into view; extend the feed near the end.
  useEffect(() => {
    const root = feedRef.current
    if (!root) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          const el = e.target as HTMLElement
          const id = el.dataset.id!
          const idx = Number(el.dataset.idx)
          tick()
          if (!seen.has(id)) {
            seen.add(id)
            saveSeen(seen)
          }
          if (view.kind === 'feed') {
            setFeed((f) => (idx >= f.length - 3 ? [...f, ...nextCycle(pool, f[f.length - 1]?.id)] : f))
          }
        }
      },
      { root, threshold: 0.6 },
    )
    root.querySelectorAll('[data-id]').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [feed, pool, seen, view.kind])

  const flash = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(''), 1800)
  }

  const toggleSave = (id: string) => {
    const next = new Set(saved)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSaved(next)
    saveSaved(next)
  }

  const share = async (c: Card) => {
    const text = `${c.title}\n\n${c.body}`
    const url = location.origin
    try {
      if (await nativeShare(c.title, `${text}\n\n${url}`)) return
      if (navigator.share) await navigator.share({ title: c.title, text, url })
      else {
        await navigator.clipboard.writeText(`${text}\n\n${url}`)
        flash('Copied')
      }
    } catch {
      /* user cancelled */
    }
  }

  const activeTopic = view.kind === 'feed' ? view.topic : null

  return (
    <div className="app">
      <nav className="chips" aria-label="Topics">
        <button className={view.kind === 'feed' && !activeTopic ? 'on' : ''} onClick={() => setView({ kind: 'feed', topic: null })}>
          All
        </button>
        {TOPICS.map((t) => (
          <button key={t} className={activeTopic === t ? 'on' : ''} onClick={() => setView({ kind: 'feed', topic: t })}>
            {LABEL[t]}
          </button>
        ))}
        <button className={view.kind === 'saved' ? 'on' : ''} onClick={() => setView({ kind: 'saved' })}>
          ★ Saved
        </button>
        {isNative && (
          <button
            className={reminder ? 'on' : ''}
            onClick={async () => {
              const on = await setDailyReminder(!reminder)
              setReminder(on)
              flash(on ? 'Daily reminder at 8am' : 'Reminder off')
            }}
          >
            ⏰ Daily
          </button>
        )}
      </nav>

      <main className="feed" ref={feedRef}>
        {feed.length === 0 && (
          <section className="card empty">
            <div className="inner">
              <h2>Nothing saved yet</h2>
              <p>Tap ☆ on any card to keep it here.</p>
            </div>
          </section>
        )}
        {feed.map((c, i) => (
          <section key={`${c.id}-${i}`} className={`card t-${c.topic}`} data-id={c.id} data-idx={i}>
            <div className="inner">
              <span className="tag">{LABEL[c.topic]}</span>
              <h2>{c.title}</h2>
              <p className="body">{c.body}</p>
              <p className="hook">{c.hook}</p>
            </div>
            <div className="actions">
              <button aria-label={saved.has(c.id) ? 'Unsave' : 'Save'} onClick={() => toggleSave(c.id)}>
                {saved.has(c.id) ? '★' : '☆'}
              </button>
              <button aria-label="Share" onClick={() => share(c)}>
                ↗
              </button>
              {FEEDBACK && (
                <a
                  aria-label="Report a mistake"
                  href={`mailto:${FEEDBACK}?subject=${encodeURIComponent(`Bitesize card ${c.id}`)}&body=${encodeURIComponent(
                    `Card: ${c.title}\nWhat's wrong:\n`,
                  )}`}
                >
                  ⚑
                </a>
              )}
            </div>
            {i === 0 && <p className="hint">Swipe up ↑</p>}
          </section>
        ))}
      </main>
      <footer className="note">Cards are AI-assisted and may contain mistakes.</footer>
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
