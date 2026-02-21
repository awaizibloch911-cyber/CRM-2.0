// Simple event emitter for server-side events
type EventCallback = (event: InboxEvent) => void

export interface InboxEvent {
  type: "message" | "call" | "recording"
  id: string
  from?: string
  to?: string
  body?: string
  status?: string
  direction?: "inbound" | "outbound"
  timestamp: string
  displayTime?: string
  duration?: string
  recordingUrl?: string
  callSid?: string
}

class EventEmitterSingleton {
  private listeners: Map<string, Set<EventCallback>> = new Map()
  private static instance: EventEmitterSingleton

  static getInstance(): EventEmitterSingleton {
    if (!EventEmitterSingleton.instance) {
      EventEmitterSingleton.instance = new EventEmitterSingleton()
    }
    return EventEmitterSingleton.instance
  }

  on(event: string, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback)
    }
  }

  emit(event: string, data: InboxEvent): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(data)
        } catch (error) {
          console.error("[EventEmitter] Error in callback:", error)
        }
      })
    }
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event)
    } else {
      this.listeners.clear()
    }
  }
}

export const eventEmitter = EventEmitterSingleton.getInstance()
