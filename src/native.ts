// Native-only touches for the iOS app. On the web every function is a no-op or falls back.
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Share } from '@capacitor/share'
import { Directory, Filesystem } from '@capacitor/filesystem'

export const isNative = Capacitor.isNativePlatform()

export function tick() {
  if (isNative) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
}

/** Returns true if shared natively; false means the caller should use the web fallback. */
export async function nativeShare(title: string, text: string): Promise<boolean> {
  if (!isNative) return false
  await Share.share({ title, text }).catch(() => {})
  return true
}

// Daily reminder: the next 14 days are scheduled, each carrying that day's first card in full,
// so it can be read on the lock screen. Re-scheduled each time the app opens.
const FIRST_ID = 100
const DAYS = 14
const ids = () => Array.from({ length: DAYS }, (_, i) => ({ id: FIRST_ID + i }))

export interface ReminderCard {
  title: string
  body: string
}

export async function dailyReminderOn(): Promise<boolean> {
  if (!isNative) return false
  const { notifications } = await LocalNotifications.getPending()
  return notifications.some((n) => n.id >= FIRST_ID && n.id < FIRST_ID + DAYS)
}

/** Opt-in 8am "card of the day", scheduled on the phone only. cardFor(date) supplies each day's card. */
export async function setDailyReminder(on: boolean, cardFor: (d: Date) => ReminderCard): Promise<boolean> {
  if (!isNative) return false
  await LocalNotifications.cancel({ notifications: ids() }).catch(() => {})
  if (!on) return false
  const perm = await LocalNotifications.requestPermissions()
  if (perm.display !== 'granted') return false
  const now = new Date()
  const notifications = []
  for (let i = 0; i < DAYS; i++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, 8, 0, 0)
    if (at <= now) continue
    const c = cardFor(at)
    notifications.push({ id: FIRST_ID + i, title: c.title, body: c.body, schedule: { at, allowWhileIdle: true } })
  }
  await LocalNotifications.schedule({ notifications })
  return true
}

/** Share a PNG via the native sheet. Returns false on the web. */
export async function nativeShareImage(blob: Blob, name: string, text: string): Promise<boolean> {
  if (!isNative) return false
  const data = await new Promise<string>((resolve) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1])
    r.readAsDataURL(blob)
  })
  const { uri } = await Filesystem.writeFile({ path: name, data, directory: Directory.Cache })
  await Share.share({ text, files: [uri] }).catch(() => {})
  return true
}
