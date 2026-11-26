// Design directions under review. ?look=ink|paper|pop picks one and it sticks on this device.
export const LOOKS = ['ink', 'paper', 'pop'] as const
export type Look = (typeof LOOKS)[number]

const KEY = 'bitesize.look'
const THEME: Record<Look, string> = { ink: '#0d0f14', paper: '#f5efe3', pop: '#121212' }

export function applyLook(): Look {
  let look: Look = 'ink'
  try {
    const q = new URLSearchParams(location.search).get('look') as Look | null
    if (q && LOOKS.includes(q)) localStorage.setItem(KEY, q)
    const s = localStorage.getItem(KEY) as Look | null
    if (s && LOOKS.includes(s)) look = s
  } catch {
    /* storage blocked: default look */
  }
  document.documentElement.dataset.look = look
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME[look])
  return look
}
