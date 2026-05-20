import { ref } from 'vue'

const STORAGE_KEY = 'legado-reading-reminder'

export interface ReminderConfig {
  enabled: boolean
  hour: number
  minute: number
}

export interface NotificationChannel {
  channelId: string
  name: string
}

const isNotificationSupported = ref(false)
const permissionGranted = ref(false)
const supportsActions = ref(false)

const channels = ref<NotificationChannel[]>([])

function detectNotificationSupport() {
  isNotificationSupported.value =
    typeof Notification !== 'undefined'
  permissionGranted.value =
    isNotificationSupported.value &&
    Notification.permission === 'granted'
}

if (typeof window !== 'undefined') {
  detectNotificationSupport()
}

async function requestPermission(): Promise<boolean> {
  if (!isNotificationSupported.value) {
    return false
  }

  if (Notification.permission === 'granted') {
    permissionGranted.value = true
    return true
  }

  if (Notification.permission === 'denied') {
    return false
  }

  const result = await Notification.requestPermission()
  permissionGranted.value = result === 'granted'
  return permissionGranted.value
}

function createChannel(channelId: string, name: string) {
  const existing = channels.value.find((c) => c.channelId === channelId)
  if (!existing) {
    channels.value.push({ channelId, name })
  }
}

function sendReminder(title: string, body: string): boolean {
  if (!permissionGranted.value) {
    return false
  }

  try {
    const actions: NotificationAction[] = [
      { action: 'open', title: '打开' },
      { action: 'delay', title: '推迟15分钟' },
    ]

    const options: NotificationOptions = {
      body: supportsActions.value
        ? body
        : `${body}\n\n点击通知打开应用，或关闭通知推迟15分钟`,
      requireInteraction: true,
    }

    if (supportsActions.value) {
      options.actions = actions
    }

    const notification = new Notification(title, options)

    notification.addEventListener('click', () => {
      notification.close()
      window.focus()
      dispatchReminderAction('open')
    })

    return true
  } catch {
    return false
  }
}

const reminderActionHandlers = new Map<string, (action: string) => void>()

function onReminderAction(handler: (action: string) => void) {
  const id = Math.random().toString(36).slice(2)
  reminderActionHandlers.set(id, handler)
  return () => {
    reminderActionHandlers.delete(id)
  }
}

function dispatchReminderAction(action: string) {
  for (const handler of reminderActionHandlers.values()) {
    handler(action)
  }
}

function loadReminderConfig(): ReminderConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        enabled: parsed.enabled ?? false,
        hour: parsed.hour ?? 20,
        minute: parsed.minute ?? 0,
      }
    }
  } catch {
    // ignore parse error
  }

  return {
    enabled: false,
    hour: 20,
    minute: 0,
  }
}

function saveReminderConfig(config: ReminderConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

function scheduleReminder(hour: number, minute: number, enabled: boolean) {
  const config: ReminderConfig = { hour, minute, enabled }
  saveReminderConfig(config)
}

function getReminderConfig(): ReminderConfig {
  return loadReminderConfig()
}

export function useNotification() {
  return {
    isNotificationSupported,
    permissionGranted,
    supportsActions,
    requestPermission,
    createChannel,
    channels,
    sendReminder,
    onReminderAction,
    scheduleReminder,
    getReminderConfig,
  }
}