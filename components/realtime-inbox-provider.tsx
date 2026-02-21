"use client"

import type React from "react"
import { useEffect, useRef, useMemo } from "react"
import { useCRM } from "@/lib/crm-context"
import { useInboxSync } from "@/lib/use-inbox-sync"
import type { Conversation, Message } from "@/lib/types"
import { parseTimestampToMs } from "@/lib/timezone"

interface RealtimeInboxProviderProps {
  children: React.ReactNode
}

function messageExists(existingMessages: Message[], newMsg: Message): boolean {
  const newContentKey = `${newMsg.sender}|${newMsg.content}|${newMsg.type}`
  const newTime = parseTimestampToMs(newMsg.timestamp)

  for (const existing of existingMessages) {
    if (existing.id === newMsg.id) return true

    const existingContentKey = `${existing.sender}|${existing.content}|${existing.type}`
    if (newContentKey === existingContentKey) {
      const existingTime = parseTimestampToMs(existing.timestamp)
      const timeDiff = Math.abs(existingTime - newTime)
      if (timeDiff < 120000) {
        return true
      }
    }
  }

  return false
}

function deduplicateMessages(messages: Message[]): Message[] {
  const result: Message[] = []

  for (const msg of messages) {
    if (!messageExists(result, msg)) {
      result.push(msg)
    }
  }

  return result.sort((a, b) => parseTimestampToMs(a.timestamp) - parseTimestampToMs(b.timestamp))
}

export function RealtimeInboxProvider({ children }: RealtimeInboxProviderProps) {
  const { setConversations, selectedConversation, isTwilioConfigured, twilioConfig, setRealtimeConnected, contacts } =
    useCRM()

  const selectedConversationRef = useRef(selectedConversation)
  selectedConversationRef.current = selectedConversation

  const contactsMap = useMemo(() => {
    const map = new Map<string, string>()
    contacts.forEach((c) => {
      map.set(c.phone.replace(/\D/g, ""), c.name)
    })
    return map
  }, [contacts])

  const contactsMapRef = useRef(contactsMap)
  contactsMapRef.current = contactsMap

  const { conversations: syncedConversations, isConnected } = useInboxSync({
    twilioConfig,
    enabled: isTwilioConfigured,
    pollingInterval: 5000,
  })

  const prevConnected = useRef(isConnected)
  useEffect(() => {
    if (prevConnected.current !== isConnected) {
      prevConnected.current = isConnected
      setRealtimeConnected(isConnected)
    }
  }, [isConnected, setRealtimeConnected])

  const lastSyncHash = useRef("")

  useEffect(() => {
    if (!syncedConversations || syncedConversations.length === 0) return

    const newHash = syncedConversations.map((c) => `${c.phone}-${c.messages.length}`).join("|")
    if (newHash === lastSyncHash.current) return
    lastSyncHash.current = newHash

    const contactsMapCurrent = contactsMapRef.current

    setConversations((prev: Conversation[]) => {
      const phoneMap = new Map<string, Conversation>()

      prev.forEach((conv) => {
        phoneMap.set(conv.phone.replace(/\D/g, ""), conv)
      })

      let hasChanges = false

      syncedConversations.forEach((syncedConv: Conversation) => {
        const normalizedPhone = syncedConv.phone.replace(/\D/g, "")
        const existing = phoneMap.get(normalizedPhone)
        const displayName = contactsMapCurrent.get(normalizedPhone) || syncedConv.name

        if (existing) {
          const newMessages = syncedConv.messages.filter((m) => !messageExists(existing.messages, m))

          if (newMessages.length > 0) {
            hasChanges = true
            const hasNewInbound = newMessages.some((m) => m.sender === "contact")
            const isCurrentlySelected = selectedConversationRef.current?.id === existing.id

            const allMessages = deduplicateMessages([...existing.messages, ...newMessages])

            phoneMap.set(normalizedPhone, {
              ...existing,
              name: displayName,
              messages: allMessages,
              lastMessage: syncedConv.lastMessage || existing.lastMessage,
              time: syncedConv.time || existing.time,
              type: syncedConv.type,
              callStatus: syncedConv.callStatus,
              callDuration: syncedConv.callDuration,
              unread: isCurrentlySelected ? false : hasNewInbound || existing.unread,
              unreadCount: isCurrentlySelected
                ? 0
                : (existing.unreadCount || 0) +
                  (hasNewInbound ? newMessages.filter((m) => m.sender === "contact").length : 0),
            })
          }
        } else {
          hasChanges = true
          phoneMap.set(normalizedPhone, {
            ...syncedConv,
            name: displayName,
            messages: deduplicateMessages(syncedConv.messages),
            unread: syncedConv.messages.some((m) => m.sender === "contact"),
            unreadCount: syncedConv.messages.filter((m: Message) => m.sender === "contact").length,
          })
        }
      })

      if (!hasChanges) return prev

      return Array.from(phoneMap.values())
    })
  }, [syncedConversations, setConversations])

  return <>{children}</>
}
