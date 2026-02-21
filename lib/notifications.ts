"use client"

export interface NotificationOptions {
  title: string
  body: string
  icon?: string
  tag?: string
  data?: Record<string, unknown>
  requireInteraction?: boolean
  onClick?: () => void
}

export type NotificationSoundType = "message" | "call" | "missed-call" | "sent"

class NotificationService {
  private static instance: NotificationService
  private permission: NotificationPermission = "default"
  private clickHandlers: Map<string, () => void> = new Map()
  private audioCache: Map<string, HTMLAudioElement> = new Map()
  private soundEnabled = true
  private inAppCallbacks: Set<(notification: InAppNotification) => void> = new Set()

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService()
    }
    return NotificationService.instance
  }

  private getAudio(type: NotificationSoundType): HTMLAudioElement | null {
    if (typeof window === "undefined") return null

    if (this.audioCache.has(type)) {
      return this.audioCache.get(type)!
    }

    // Create audio elements with different tones using Web Audio API generated sounds
    const audio = new Audio()

    // Use data URIs for simple notification sounds (base64 encoded short tones)
    const sounds: Record<NotificationSoundType, string> = {
      // Short pleasant chime for messages
      message:
        "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleUZ7",
      // Longer ring tone for calls
      call: "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH+XrYxkOjhforPYsGEeEUCW1+avfkR3",
      // Softer tone for missed calls
      "missed-call":
        "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH+XrYxkOjhforPYsGEeEUCW1+av",
      // Quick whoosh for sent messages
      sent: "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH+XrYxkOjhf",
    }

    audio.src = sounds[type]
    audio.volume = type === "call" ? 0.6 : 0.4
    this.audioCache.set(type, audio)

    return audio
  }

  async playSound(type: NotificationSoundType): Promise<void> {
    if (!this.soundEnabled || typeof window === "undefined") return

    try {
      // Use Web Audio API for more reliable playback
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      // Different frequencies for different notification types
      const frequencies: Record<NotificationSoundType, number[]> = {
        message: [880, 1100], // Pleasant two-tone chime
        call: [440, 550, 440, 550], // Ring pattern
        "missed-call": [330, 260], // Descending tone
        sent: [1000, 1200], // Quick ascending whoosh
      }

      const durations: Record<NotificationSoundType, number> = {
        message: 0.15,
        call: 0.2,
        "missed-call": 0.2,
        sent: 0.08,
      }

      const freqs = frequencies[type]
      const duration = durations[type]

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration * freqs.length)

      oscillator.type = type === "call" ? "sine" : "triangle"

      let time = audioContext.currentTime
      freqs.forEach((freq, i) => {
        oscillator.frequency.setValueAtTime(freq, time)
        time += duration
      })

      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + duration * freqs.length)
    } catch (error) {
      console.warn("[Notifications] Could not play sound:", error)
    }
  }

  setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled
    if (typeof window !== "undefined") {
      localStorage.setItem("notification-sound-enabled", String(enabled))
    }
  }

  getSoundEnabled(): boolean {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("notification-sound-enabled")
      if (stored !== null) {
        this.soundEnabled = stored === "true"
      }
    }
    return this.soundEnabled
  }

  subscribeToInApp(callback: (notification: InAppNotification) => void): () => void {
    this.inAppCallbacks.add(callback)
    return () => this.inAppCallbacks.delete(callback)
  }

  private emitInAppNotification(notification: InAppNotification): void {
    this.inAppCallbacks.forEach((callback) => callback(notification))
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!("Notification" in window)) {
      console.warn("[Notifications] Not supported in this browser")
      return "denied"
    }

    if (Notification.permission === "granted") {
      this.permission = "granted"
      return "granted"
    }

    if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission()
      this.permission = permission
      return permission
    }

    return Notification.permission
  }

  getPermission(): NotificationPermission {
    if (!("Notification" in window)) return "denied"
    return Notification.permission
  }

  isSupported(): boolean {
    return "Notification" in window
  }

  async show(options: NotificationOptions): Promise<Notification | null> {
    if (!("Notification" in window)) {
      console.warn("[Notifications] Not supported")
      return null
    }

    if (Notification.permission !== "granted") {
      const permission = await this.requestPermission()
      if (permission !== "granted") {
        console.warn("[Notifications] Permission not granted")
        return null
      }
    }

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || "/favicon.ico",
        tag: options.tag,
        data: options.data,
        requireInteraction: options.requireInteraction,
      })

      if (options.onClick) {
        notification.onclick = () => {
          window.focus()
          options.onClick?.()
          notification.close()
        }
      }

      // Auto-close after 5 seconds if not requiring interaction
      if (!options.requireInteraction) {
        setTimeout(() => notification.close(), 5000)
      }

      return notification
    } catch (error) {
      console.error("[Notifications] Error showing notification:", error)
      return null
    }
  }

  async showIncomingMessage(from: string, body: string, onClick?: () => void): Promise<Notification | null> {
    // Play sound
    this.playSound("message")

    // Show in-app notification
    this.emitInAppNotification({
      id: Date.now().toString(),
      type: "message",
      title: `New message from ${from}`,
      body: body.slice(0, 100) + (body.length > 100 ? "..." : ""),
      timestamp: Date.now(),
      onClick,
    })

    // Show browser notification (for background tabs)
    return this.show({
      title: `New message from ${from}`,
      body: body.slice(0, 100) + (body.length > 100 ? "..." : ""),
      tag: `message-${from}`,
      onClick,
    })
  }

  async showIncomingCall(from: string, onClick?: () => void): Promise<Notification | null> {
    // Play call sound
    this.playSound("call")

    // Show in-app notification
    this.emitInAppNotification({
      id: Date.now().toString(),
      type: "call",
      title: "Incoming call",
      body: `Call from ${from}`,
      timestamp: Date.now(),
      onClick,
    })

    return this.show({
      title: `Incoming call`,
      body: `Call from ${from}`,
      tag: `call-${from}`,
      requireInteraction: true,
      onClick,
    })
  }

  async showMissedCall(from: string, onClick?: () => void): Promise<Notification | null> {
    // Play missed call sound
    this.playSound("missed-call")

    // Show in-app notification
    this.emitInAppNotification({
      id: Date.now().toString(),
      type: "missed-call",
      title: "Missed call",
      body: `You missed a call from ${from}`,
      timestamp: Date.now(),
      onClick,
    })

    return this.show({
      title: `Missed call`,
      body: `You missed a call from ${from}`,
      tag: `missed-${from}`,
      onClick,
    })
  }

  playSentSound(): void {
    this.playSound("sent")
  }
}

export interface InAppNotification {
  id: string
  type: "message" | "call" | "missed-call"
  title: string
  body: string
  timestamp: number
  onClick?: () => void
}

export const notificationService = NotificationService.getInstance()

// Hook for managing notification permissions in React components
export function useNotifications() {
  const requestPermission = async () => {
    return notificationService.requestPermission()
  }

  const getPermission = () => {
    return notificationService.getPermission()
  }

  const isSupported = () => {
    return notificationService.isSupported()
  }

  const showNotification = (options: NotificationOptions) => {
    return notificationService.show(options)
  }

  return {
    requestPermission,
    getPermission,
    isSupported,
    showNotification,
    showIncomingMessage: notificationService.showIncomingMessage.bind(notificationService),
    showIncomingCall: notificationService.showIncomingCall.bind(notificationService),
    showMissedCall: notificationService.showMissedCall.bind(notificationService),
    playSentSound: notificationService.playSentSound.bind(notificationService),
    setSoundEnabled: notificationService.setSoundEnabled.bind(notificationService),
    getSoundEnabled: notificationService.getSoundEnabled.bind(notificationService),
    subscribeToInApp: notificationService.subscribeToInApp.bind(notificationService),
  }
}
