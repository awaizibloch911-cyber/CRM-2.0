"use client"

import useSWR from "swr"
import { useCallback, useEffect, useRef } from "react"
import type { Conversation } from "./types"
import { notificationService } from "./notifications"

interface SyncResponse {
  conversations: Conversation[]
  lastSync: string
}

interface UseInboxSyncOptions {
  twilioConfig: {
    accountSid: string
    authToken: string
    phoneNumber: string
  } | null
  enabled: boolean
  pollingInterval?: number
  onNewMessage?: (conversation: Conversation, message: string) => void
  onNewCall?: (conversation: Conversation, callType: string) => void
}

async function fetchInbox(url: string, config: UseInboxSyncOptions["twilioConfig"]): Promise<SyncResponse | null> {
  if (!config) return null

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ config }),
  })

  if (!response.ok) {
    throw new Error("Failed to sync")
  }

  return response.json()
}

export function useInboxSync({
  twilioConfig,
  enabled,
  pollingInterval = 5000,
  onNewMessage,
  onNewCall,
}: UseInboxSyncOptions) {
  const previousConversationsRef = useRef<Map<string, Conversation>>(new Map())
  const isFirstLoadRef = useRef(true)

  const swrKey = enabled && twilioConfig ? "/api/twilio/sync-history" : null

  const { data, error, isLoading, mutate } = useSWR<SyncResponse | null>(
    swrKey,
    () => fetchInbox("/api/twilio/sync-history", twilioConfig),
    {
      refreshInterval: enabled ? pollingInterval : 0,
      revalidateOnFocus: false, // Disable to reduce unnecessary refetches
      revalidateOnReconnect: true,
      dedupingInterval: 3000, // Increased deduping interval
      errorRetryCount: 3,
      errorRetryInterval: 5000,
      keepPreviousData: true, // Keep showing previous data while revalidating
    },
  )

  useEffect(() => {
    if (!data?.conversations) return

    if (isFirstLoadRef.current) {
      const map = new Map<string, Conversation>()
      data.conversations.forEach((conv) => {
        map.set(conv.phone.replace(/\D/g, ""), conv)
      })
      previousConversationsRef.current = map
      isFirstLoadRef.current = false
      return
    }

    const prevMap = previousConversationsRef.current
    const newMap = new Map<string, Conversation>()

    data.conversations.forEach((conv) => {
      const normalizedPhone = conv.phone.replace(/\D/g, "")
      newMap.set(normalizedPhone, conv)

      const prevConv = prevMap.get(normalizedPhone)

      if (!prevConv) {
        // New conversation
        if (conv.type === "message" && conv.messages.length > 0) {
          const lastMsg = conv.messages[conv.messages.length - 1]
          if (lastMsg.sender === "contact") {
            onNewMessage?.(conv, lastMsg.content)
            notificationService.showIncomingMessage(conv.name, lastMsg.content)
          }
        } else if (conv.type === "call") {
          onNewCall?.(conv, conv.callStatus || "incoming")
          if (conv.callStatus === "missed") {
            notificationService.showMissedCall(conv.name)
          }
        }
      } else if (conv.messages.length > prevConv.messages.length) {
        // Existing conversation with new messages
        const newMessages = conv.messages.slice(prevConv.messages.length)
        newMessages.forEach((msg) => {
          if (msg.sender === "contact" && msg.type === "text") {
            onNewMessage?.(conv, msg.content)
            notificationService.showIncomingMessage(conv.name, msg.content)
          } else if (msg.type === "call_log" && msg.callType === "missed") {
            onNewCall?.(conv, "missed")
            notificationService.showMissedCall(conv.name)
          }
        })
      }
    })

    previousConversationsRef.current = newMap
  }, [data, onNewMessage, onNewCall])

  const forceSync = useCallback(() => {
    return mutate()
  }, [mutate])

  return {
    conversations: data?.conversations || [],
    lastSync: data?.lastSync,
    isLoading,
    isError: !!error,
    error,
    forceSync,
    isConnected: enabled && !error,
  }
}
