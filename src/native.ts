// Native-only touches for the iOS app. On the web every function is a no-op or falls back.
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Share } from '@capacitor/share'
import { Directory, Filesystem } from '@capacitor/filesystem'

export const isNative = Capacitor.isNativePlatform()

export function tick() {
  if (isNative) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
}

/** Haptics matched to the moment, as iOS apps use them. No-op on the web. */
export const haptic = {
  /** A new card settles into place. */
  card: () => tick(),
  /** Switching tab or topic. */
  select: () => isNative && Haptics.selectionChanged().catch(() => {}),
  /** Saving a card. */
  save: () => isNative && Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {}),
  /** Right answer, day completed. */
  success: () => isNative && Haptics.notification({ type: NotificationType.Success }).catch(() => {}),
  /** Wrong answer: a gentle nudge, not an error buzz. */
  miss: () => isNative && Haptics.notification({ type: NotificationType.Warning }).catch(() => {}),
}

/** Called once the first screen has painted: light status bar text, then fade the launch screen. */
export function appReady() {
  if (!isNative) return
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
  SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {})
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
