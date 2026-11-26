// Native-only touches for the iOS app. On the web every function is a no-op or falls back.
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Share } from '@capacitor/share'

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

const DAILY_ID = 1

export async function dailyReminderOn(): Promise<boolean> {
  if (!isNative) return false
  const { notifications } = await LocalNotifications.getPending()
  return notifications.some((n) => n.id === DAILY_ID)
}

/** Opt-in "card of the day" reminder at 8am, scheduled on the phone only. */
export async function setDailyReminder(on: boolean): Promise<boolean> {
  if (!isNative) return false
  if (!on) {
    await LocalNotifications.cancel({ notifications: [{ id: DAILY_ID }] })
    return false
  }
  const perm = await LocalNotifications.requestPermissions()
  if (perm.display !== 'granted') return false
  await LocalNotifications.schedule({
    notifications: [
      {
        id: DAILY_ID,
        title: 'Your morsel for today',
        body: 'One screen, one thing worth knowing.',
        schedule: { on: { hour: 8, minute: 0 }, allowWhileIdle: true },
      },
    ],
  })
  return true
}
