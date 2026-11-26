// Everything stays on the device. No server, no cookies.
function read(key: string): string[] {
  try {
    const raw = localStorage.getItem(key)
    const v = raw ? JSON.parse(raw) : []
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}
function write(key: string, ids: Iterable<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...ids]))
  } catch {
    /* private mode or storage blocked: carry on without saving */
  }
}
export const loadSeen = () => new Set(read('bitesize.seen'))
export const saveSeen = (s: Set<string>) => write('bitesize.seen', s)
export const loadSaved = () => new Set(read('bitesize.saved'))
export const saveSaved = (s: Set<string>) => write('bitesize.saved', s)
