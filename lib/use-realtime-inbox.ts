"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import type { InboxEvent } from "./realtime-events"

interface UseRealtimeInboxOptions {
  onMessage?: (event: InboxEvent) => void
  onCall?: (event: InboxEvent) => void
  onRecording?: (event: InboxEvent) => void
  onConnected?: () => void
  onDisconnected?: () => void
  enabled?: boolean
  pollingInterval?: number // Fallback polling interval in ms
}

export function useRealtimeInbox({
  onMessage,
  onCall,
  onRecording,
  onConnected,
  onDisconnected,
  enabled = true,
  pollingInterval = 30000, // Default 30 second fallback polling
}: UseRealtimeInboxOptions) {
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [connectionMode, setConnectionMode] = useState<"sse" | "polling" | "disconnected">("disconnected")
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttempts = 5

  const handleEvent = useCallback(
    (event: InboxEvent) => {
      switch (event.type) {
        case "message":
          onMessage?.(event)
          break
        case "call":
          onCall?.(event)
          break
        case "recording":
          onRecording?.(event)
          break
      }
    },
    [onMessage, onCall, onRecording],
  )

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
  }, [])

  const connect = useCallback(() => {
    if (!enabled) return

    cleanup()

    try {
      const eventSource = new EventSource("/api/realtime/stream")
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        console.log("[Realtime] SSE connected")
        setIsConnected(true)
        setConnectionMode("sse")
        reconnectAttemptsRef.current = 0
        onConnected?.()
      }

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as InboxEvent & { type: string }

          if (data.type === "connected" || data.type === "heartbeat") {
            return // Ignore connection/heartbeat messages
          }

          handleEvent(data as InboxEvent)
        } catch (error) {
          console.error("[Realtime] Error parsing event:", error)
        }
      }

      eventSource.onerror = () => {
        console.log("[Realtime] SSE connection error, will reconnect...")
        setIsConnected(false)
        setConnectionMode("disconnected")
        onDisconnected?.()

        eventSource.close()

        // Exponential backoff reconnection
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000)
          reconnectAttemptsRef.current++

          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`[Realtime] Reconnecting (attempt ${reconnectAttemptsRef.current})...`)
            connect()
          }, delay)
        } else {
          console.log("[Realtime] Max reconnection attempts reached, falling back to polling")
          setConnectionMode("polling")
        }
      }
    } catch (error) {
      console.error("[Realtime] Failed to create EventSource:", error)
      setConnectionMode("polling")
    }
  }, [enabled, cleanup, handleEvent, onConnected, onDisconnected])

  // Manual trigger for sync (useful for UI refresh button)
  const triggerSync = useCallback(async () => {
    // This can be called to trigger a manual sync
    // The actual sync logic is handled by the parent component
  }, [])

  useEffect(() => {
    if (enabled) {
      connect()
    }

    return cleanup
  }, [enabled, connect, cleanup])

  return {
    isConnected,
    connectionMode,
    triggerSync,
    reconnect: connect,
  }
}
