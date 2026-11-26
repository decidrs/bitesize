import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import deck from './data/cards.json'
import { buildOrder, nextCycle } from './feed'
import { completeDay, currentStreak, dayKey, pickToday, type Streak } from './daily'
import { makeQuiz, type Quiz } from './quiz'
import { cardImage, SITE } from './shareImage'
import { loadSaved, loadSeen, loadStreak, saveSaved, saveSeen, saveStreak } from './storage'
import { TOPICS, type Card, type Topic } from './types'
import { appReady, dailyReminderOn, haptic, isNative, nativeShare, nativeShareImage, setDailyReminder } from './native'

const CARDS = deck as Card[]
const BY_ID = new Map(CARDS.map((c) => [c.id, c]))
const FEEDBACK = (import.meta.env.VITE_FEEDBACK_EMAIL as string | undefined) || 'hello@strateriq.com'
const QUIZ_EVERY = 5

const LABEL: Record<Topic, string> = {
  history: 'History',
  science: 'Science',
  business: 'Business',
  nature: 'Nature',
  space: 'Space',
  language: 'Words',
}

type View = { kind: 'today' } | { kind: 'feed'; topic: Topic | null } | { kind: 'saved' }
type Item = { kind: 'card'; card: Card } | { kind: 'quiz'; quiz: Quiz } | { kind: 'done' }

const today = () => dayKey(new Date())
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/** Interleave a recall quiz after every QUIZ_EVERY cards, using cards already seen. */
function withQuizzes(cards: Card[], seen: Set<string>, startIdx: number): Item[] {
  const out: Item[] = []
  cards.forEach((card, i) => {
    out.push({ kind: 'card', card })
    if ((startIdx + i + 1) % QUIZ_EVERY === 0) {
      const pool = [...seen].map((id) => BY_ID.get(id)).filter((c): c is Card => !!c)
      if (pool.length >= 3) {
        const quiz = makeQuiz(pool, CARDS)
        if (quiz) out.push({ kind: 'quiz', quiz })
      }
    }
  })
  return out
}

export default function App() {
  const [seen] = useState(loadSeen)
  const [saved, setSaved] = useState(loadSaved)
  const [streak, setStreak] = useState<Streak>(loadStreak)
  const [view, setView] = useState<View>(() => (loadStreak().last === today() ? { kind: 'feed', topic: null } : { kind: 'today' }))
  const [toast, setToast] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [reminder, setReminder] = useState(false)
  const feedRef = useRef<HTMLDivElement>(null)
  const chipsRef = useRef<HTMLElement>(null)
  const cardCount = useRef(0)
  const lastIdx = useRef(-1)
  const [active, setActive] = useState(0)
  const [shown, setShown] = useState<Set<number>>(() => new Set())
  const [firstRun] = useState(() => seen.size < 3)

  useEffect(() => {
    requestAnimationFrame(() => appReady())
  }, [])

  // Keep the selected tab in view, as a native segmented bar does.
  useEffect(() => {
    const on = chipsRef.current?.querySelector('button.on') as HTMLElement | null
    on?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' })
  }, [view])

  const go = (v: View) => {
    haptic.select()
    setView(v)
  }

  // Each day's reminder carries the first card of that day's Today's 5, so the lock screen previews it (it can differ if cards are seen meanwhile).
  const cardFor = useCallback((d: Date) => pickToday(CARDS, seen, dayKey(d))[0], [seen])

  useEffect(() => {
    dailyReminderOn().then((on) => {
      setReminder(on)
      if (on) setDailyReminder(true, cardFor) // top up the next 14 days
    })
  }, [cardFor])

  const pool = useMemo(() => {
    if (view.kind === 'saved') return CARDS.filter((c) => saved.has(c.id))
    if (view.kind === 'feed' && view.topic) return CARDS.filter((c) => c.topic === view.topic)
    return CARDS
    // saved list is snapshotted when the view opens, so un-saving doesn't yank cards away
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  useEffect(() => {
    setAnswers({})
    lastIdx.current = -1
    setActive(0)
    setShown(new Set())
    if (view.kind === 'today') {
      const five = pickToday(CARDS, seen, today())
      setItems([...five.map((card): Item => ({ kind: 'card', card })), { kind: 'done' }])
    } else if (view.kind === 'saved') {
      setItems(pool.map((card): Item => ({ kind: 'card', card })))
    } else {
      const order = buildOrder(CARDS, seen, view.topic)
      cardCount.current = order.length
      setItems(withQuizzes(order, seen, 0))
    }
    feedRef.current?.scrollTo({ top: 0 })
  }, [view, pool, seen])

  const finishDay = useCallback(() => {
    setStreak((s) => {
      const next = completeDay(s, today())
      saveStreak(next)
      return next
    })
  }, [])

  // Mark cards seen as they come into view, extend the endless feed, record the day's finish.
  useEffect(() => {
    const root = feedRef.current
    if (!root) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          const el = e.target as HTMLElement
          const idx = Number(el.dataset.idx)
          // One light tap each time a new card settles; none for the first card on screen.
          if (lastIdx.current !== -1 && idx !== lastIdx.current) {
            if (el.dataset.kind === 'done') haptic.success()
            else haptic.card()
          }
          lastIdx.current = idx
          setActive(idx)
          setShown((s) => (s.has(idx) ? s : new Set(s).add(idx)))
          if (el.dataset.kind === 'done') finishDay()
          const id = el.dataset.id
          if (id && !seen.has(id)) {
            seen.add(id)
            saveSeen(seen)
          }
          if (view.kind === 'feed') {
            setItems((f) => {
              if (idx < f.length - 3) return f
              const last = [...f].reverse().find((x) => x.kind === 'card')
              const more = nextCycle(pool, last?.kind === 'card' ? last.card.id : undefined)
              const start = cardCount.current
              cardCount.current += more.length
              return [...f, ...withQuizzes(more, seen, start)]
            })
          }
        }
      },
      { root, threshold: 0.6 },
    )
    root.querySelectorAll('[data-idx]').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [items, pool, seen, view.kind, finishDay])

  const flash = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(''), 1800)
  }

  const toggleSave = (id: string) => {
    const next = new Set(saved)
    if (next.has(id)) next.delete(id)
    else {
      next.add(id)
      haptic.save()
    }
    setSaved(next)
    saveSaved(next)
  }

  const share = async (c: Card) => {
    const text = `${c.title}: ${SITE}`
    try {
      const blob = await cardImage(c, LABEL[c.topic])
      if (await nativeShareImage(blob, `morsel-${c.id}.png`, text)) return
      const file = new File([blob], `morsel-${c.id}.png`, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text })
        return
      }
      if (await nativeShare(c.title, text)) return
      if (navigator.share) {
        await navigator.share({ title: c.title, text: `${c.title}\n\n${c.body}`, url: SITE })
        return
      }
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = file.name
      a.click()
      flash('Image saved')
    } catch {
      /* user cancelled */
    }
  }

  const streakNow = currentStreak(streak, today())
  // The flame chip gives a little bump whenever the streak grows.
  const prevStreak = useRef(streakNow)
  const [bump, setBump] = useState(false)
  useEffect(() => {
    if (streakNow > prevStreak.current) {
      setBump(true)
      const t = window.setTimeout(() => setBump(false), 700)
      prevStreak.current = streakNow
      return () => window.clearTimeout(t)
    }
    prevStreak.current = streakNow
  }, [streakNow])
  const fx = (i: number) => (shown.has(i) ? 'in' : '')
  const doneToday = streak.last === today()
  const isOn = (v: View) => JSON.stringify(v) === JSON.stringify(view)

  return (
    <div className="app">
      <nav className="chips" aria-label="Topics" ref={chipsRef}>
        <button className={`today ${isOn({ kind: 'today' }) ? 'on' : ''}`} onClick={() => go({ kind: 'today' })}>
          {doneToday ? '✓ Today' : "Today's 5"}
          {streakNow > 0 && <span className={`flame ${bump ? 'bump' : ''}`}> 🔥{streakNow}</span>}
        </button>
        <button className={isOn({ kind: 'feed', topic: null }) ? 'on' : ''} onClick={() => go({ kind: 'feed', topic: null })}>
          All
        </button>
        {TOPICS.map((t) => (
          <button key={t} className={isOn({ kind: 'feed', topic: t }) ? 'on' : ''} onClick={() => go({ kind: 'feed', topic: t })}>
            {LABEL[t]}
          </button>
        ))}
        <button className={view.kind === 'saved' ? 'on' : ''} onClick={() => go({ kind: 'saved' })}>
          ★ Saved
        </button>
        {isNative && (
          <button
            className={reminder ? 'on' : ''}
            onClick={async () => {
              haptic.select()
              const on = await setDailyReminder(!reminder, cardFor)
              setReminder(on)
              flash(on ? 'Daily reminder at 8am' : 'Reminder off')
            }}
          >
            ⏰ Daily
          </button>
        )}
      </nav>

      {view.kind === 'today' && (
        <div className="progress" aria-label={`Card ${Math.min(active + 1, 5)} of 5`}>
          {[0, 1, 2, 3, 4].map((n) => (
            <span key={n} className={n <= active ? 'on' : ''} />
          ))}
        </div>
      )}
      <main className="feed" ref={feedRef} key={JSON.stringify(view)}>
        {items.length === 0 && (
          <section className="card empty">
            <div className="inner">
              <h2>Nothing saved yet</h2>
              <p>Tap ☆ on any card to keep it here.</p>
            </div>
          </section>
        )}
        {items.map((it, i) => {
          if (it.kind === 'done')
            return (
              <section key="done" className={`card done ${fx(i)}`} data-idx={i} data-kind="done">
                <div className="inner">
                  <span className="tag">Done for today</span>
                  <div className="burst" aria-hidden="true">
                    🔥
                  </div>
                  <h2>{streakNow > 1 ? `${streakNow} days in a row` : 'That’s your five'}</h2>
                  <p className="body">Five new things you didn’t know this morning. Five more tomorrow.</p>
                  <p className="hook">Miss a day? One free pass a week keeps your streak alive.</p>
                  <button className="cta" onClick={() => go({ kind: 'feed', topic: null })}>
                    Keep exploring
                  </button>
                </div>
              </section>
            )
          if (it.kind === 'quiz') {
            const { quiz } = it
            const picked = answers[i]
            return (
              <section key={`q-${i}`} className={`card quiz t-${quiz.card.topic} ${fx(i)}`} data-idx={i} data-kind="quiz">
                <div className="inner">
                  <span className="tag">Quick recall</span>
                  <h2>{quiz.card.title}</h2>
                  <p className="ask">Which one is it?</p>
                  {quiz.options.map((o) => {
                    const state = picked ? (o.id === quiz.card.id ? 'right' : o.id === picked ? 'wrong' : 'dim') : ''
                    return (
                      <button
                        key={o.id}
                        className={`opt ${state}`}
                        disabled={!!picked}
                        onClick={() => {
                          setAnswers((a) => ({ ...a, [i]: o.id }))
                          if (o.id === quiz.card.id) haptic.success()
                          else haptic.miss()
                        }}
                      >
                        {o.body.split(/(?<=[.!?])\s/)[0]}
                      </button>
                    )
                  })}
                  {picked && <p className="hook">{picked === quiz.card.id ? 'Nailed it.' : 'Now you’ll remember it.'}</p>}
                </div>
              </section>
            )
          }
          const c = it.card
          return (
            <section key={`${c.id}-${i}`} className={`card t-${c.topic} ${fx(i)}`} data-id={c.id} data-idx={i} data-kind="card">
              <div className="inner">
                <span className="tag">
                  {LABEL[c.topic]}
                  {view.kind === 'today' && <span className="count"> · {i + 1} of 5</span>}
                </span>
                <h2>{c.title}</h2>
                <p className="body">{c.body}</p>
                <p className="hook">{c.hook}</p>
              </div>
              <div className="actions">
                <button
                  className={saved.has(c.id) ? 'saved' : ''}
                  aria-label={saved.has(c.id) ? 'Remove from saved' : 'Save'}
                  aria-pressed={saved.has(c.id)}
                  onClick={() => toggleSave(c.id)}
                >
                  {saved.has(c.id) ? '★' : '☆'}
                </button>
                <button aria-label="Share" onClick={() => share(c)}>
                  ↗
                </button>
                {FEEDBACK && (
                  <a
                    aria-label="Report a mistake"
                    href={`mailto:${FEEDBACK}?subject=${encodeURIComponent(`Morsel card ${c.id}`)}&body=${encodeURIComponent(
                      `Card: ${c.title}\nWhat's wrong:\n`,
                    )}`}
                  >
                    ⚑
                  </a>
                )}
              </div>
              {i === 0 && firstRun && <p className="hint">Swipe up for the next one</p>}
            </section>
          )
        })}
      </main>
      <footer className="note">
        Cards are AI-assisted and may contain mistakes. <a href={`${SITE}/support.html`} target="_blank" rel="noopener">
          Support
        </a>{' '}
        ·{' '}
        <a href={`${SITE}/privacy.html`} target="_blank" rel="noopener">
          Privacy
        </a>
      </footer>
      <div className={`toast ${toast ? 'show' : ''}`} role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  )
}
