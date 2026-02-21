"use client"

import { createContext, useContext, useState, useCallback, type ReactNode, useMemo, useRef } from "react"
import type { Conversation, Contact, Message, TwilioConfig, ViewType, ConversationFilter } from "./types"
import { mockConversations, mockContacts } from "./mock-data"
import { useAuth } from "./auth-context"
import { parseTimestampToMs } from "./timezone"

interface ActiveCallInfo {
  contact: Contact
  callSid?: string
  startTime: Date
}

interface CRMContextType {
  // View state
  currentView: ViewType
  setCurrentView: (view: ViewType) => void

  // Conversations
  conversations: Conversation[]
  selectedConversation: Conversation | null
  selectConversation: (conv: Conversation | null) => void
  addConversation: (conv: Conversation) => void
  updateConversation: (id: string, updates: Partial<Conversation>) => void
  addMessageToConversation: (conversationId: string, message: Message) => void
  setConversations: (convs: Conversation[] | ((prev: Conversation[]) => Conversation[])) => void
  markConversationRead: (id: string) => void

  // Filters
  customFilters: ConversationFilter[]
  addFilter: (filter: ConversationFilter) => void
  deleteFilter: (filterId: string) => void
  activeFilter: ConversationFilter | null
  setActiveFilter: (filter: ConversationFilter | null) => void

  // Contacts
  contacts: Contact[]
  addContact: (contact: Contact) => void
  updateContact: (id: string, updates: Partial<Contact>) => void
  deleteContact: (id: string) => void
  getContactByPhone: (phone: string) => Contact | undefined

  // Calls
  isCallActive: boolean
  showCallPanel: boolean
  activeCallInfo: ActiveCallInfo | null
  startCall: (contact: Contact) => void
  makeCall: (contact: Contact, callSid?: string) => Promise<void>
  endCall: () => void

  // Twilio
  twilioConfig: TwilioConfig | null
  setTwilioConfig: (config: TwilioConfig | null) => void
  isTwilioConfigured: boolean

  // Sync
  isSyncing: boolean
  syncHistory: () => Promise<void>

  isRealtimeConnected: boolean
  setRealtimeConnected: (connected: boolean) => void
}

const CRMContext = createContext<CRMContextType | null>(null)

function deduplicateMessages(messages: Message[]): Message[] {
  const seen = new Map<string, Message>()

  for (const msg of messages) {
    const contentKey = `${msg.sender}|${msg.content}|${msg.type}`

    if (seen.has(msg.id)) {
      continue
    }

    let isDuplicate = false
    for (const [, existingMsg] of seen) {
      const existingContentKey = `${existingMsg.sender}|${existingMsg.content}|${existingMsg.type}`
      if (contentKey === existingContentKey) {
        const existingTime = parseTimestampToMs(existingMsg.timestamp)
        const newTime = parseTimestampToMs(msg.timestamp)
        const timeDiff = Math.abs(existingTime - newTime)

        if (timeDiff < 120000) {
          isDuplicate = true
          break
        }
      }
    }

    if (!isDuplicate) {
      seen.set(msg.id, msg)
    }
  }

  return Array.from(seen.values()).sort((a, b) => parseTimestampToMs(a.timestamp) - parseTimestampToMs(b.timestamp))
}

export function CRMProvider({ children }: { children: ReactNode }) {
  const { twilioConfig: userTwilioConfig, saveTwilioConfig, removeTwilioConfig } = useAuth()

  // View state
  const [currentView, setCurrentView] = useState<ViewType>("conversations")

  // Conversations
  const [conversations, setConversationsState] = useState<Conversation[]>(mockConversations)
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)

  const selectedConversationRef = useRef<Conversation | null>(null)

  // Filters
  const [customFilters, setCustomFilters] = useState<ConversationFilter[]>([])
  const [activeFilter, setActiveFilter] = useState<ConversationFilter | null>(null)

  // Contacts
  const [contacts, setContacts] = useState<Contact[]>(mockContacts)

  // Calls
  const [isCallActive, setIsCallActive] = useState(false)
  const [showCallPanel, setShowCallPanel] = useState(false)
  const [activeCallInfo, setActiveCallInfo] = useState<ActiveCallInfo | null>(null)

  // Sync
  const [isSyncing, setIsSyncing] = useState(false)

  const [isRealtimeConnected, setRealtimeConnected] = useState(false)

  const twilioConfig = userTwilioConfig

  const setTwilioConfig = useCallback(
    (config: TwilioConfig | null) => {
      if (config) {
        saveTwilioConfig(config)
      } else {
        removeTwilioConfig()
      }
    },
    [saveTwilioConfig, removeTwilioConfig],
  )

  const markConversationRead = useCallback((id: string) => {
    setConversationsState((prev) =>
      prev.map((c) =>
        c.id === id && c.unread
          ? {
              ...c,
              unread: false,
              unreadCount: 0,
              messages: c.messages.map((m) => (m.isRead ? m : { ...m, isRead: true })),
            }
          : c,
      ),
    )
  }, [])

  const selectConversation = useCallback(
    (conv: Conversation | null) => {
      if (conv) {
        markConversationRead(conv.id)
        const selected = {
          ...conv,
          unread: false,
          unreadCount: 0,
          messages: deduplicateMessages(conv.messages).map((m) => ({ ...m, isRead: true })),
        }
        setSelectedConversation(selected)
        selectedConversationRef.current = selected
      } else {
        setSelectedConversation(null)
        selectedConversationRef.current = null
      }
      setShowCallPanel(false)
    },
    [markConversationRead],
  )

  const addConversation = useCallback((conv: Conversation) => {
    setConversationsState((prev) => {
      const exists = prev.some((c) => c.id === conv.id || c.phone.replace(/\D/g, "") === conv.phone.replace(/\D/g, ""))
      if (exists) return prev
      return [conv, ...prev]
    })
  }, [])

  const updateConversation = useCallback((id: string, updates: Partial<Conversation>) => {
    setConversationsState((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)))
    if (selectedConversationRef.current?.id === id) {
      setSelectedConversation((prev) => (prev ? { ...prev, ...updates } : null))
    }
  }, [])

  const setConversations = useCallback((convs: Conversation[] | ((prev: Conversation[]) => Conversation[])) => {
    setConversationsState((prev) => {
      const newConvs = typeof convs === "function" ? convs(prev) : convs

      const deduplicatedConvs = newConvs.map((conv) => ({
        ...conv,
        messages: deduplicateMessages(conv.messages),
      }))

      const currentSelected = selectedConversationRef.current
      if (currentSelected) {
        const normalizedPhone = currentSelected.phone.replace(/\D/g, "")
        const updatedConv = deduplicatedConvs.find((c) => c.phone.replace(/\D/g, "") === normalizedPhone)
        if (updatedConv) {
          const currentMsgIds = new Set(currentSelected.messages.map((m) => m.id))
          const hasNewMessages = updatedConv.messages.some((m) => !currentMsgIds.has(m.id))

          if (hasNewMessages) {
            const newSelected = {
              ...updatedConv,
              unread: false,
              unreadCount: 0,
              messages: deduplicateMessages(updatedConv.messages).map((m) => ({ ...m, isRead: true })),
            }
            setSelectedConversation(newSelected)
            selectedConversationRef.current = newSelected
          }
        }
      }

      return deduplicatedConvs
    })
  }, [])

  const addMessageToConversation = useCallback((conversationId: string, message: Message) => {
    setConversationsState((prev) => {
      return prev.map((c) => {
        if (c.id === conversationId) {
          if (c.messages.some((m) => m.id === message.id)) {
            return c
          }
          const newMessages = deduplicateMessages([...c.messages, message])
          return {
            ...c,
            messages: newMessages,
            lastMessage:
              message.type === "text" ? message.content : message.type === "call_recording" ? "Call Recording" : "Call",
            time: message.timestamp,
          }
        }
        return c
      })
    })

    const currentSelected = selectedConversationRef.current
    if (currentSelected?.id === conversationId) {
      setSelectedConversation((prev) => {
        if (!prev) return null
        if (prev.messages.some((m) => m.id === message.id)) {
          return prev
        }
        const newMessages = deduplicateMessages([...prev.messages, message])
        const newSelected = {
          ...prev,
          messages: newMessages,
          lastMessage:
            message.type === "text" ? message.content : message.type === "call_recording" ? "Call Recording" : "Call",
          time: message.timestamp,
        }
        selectedConversationRef.current = newSelected
        return newSelected
      })
    }
  }, [])

  const addContact = useCallback((contact: Contact) => {
    setContacts((prev) => [contact, ...prev])
  }, [])

  const updateContact = useCallback((id: string, updates: Partial<Contact>) => {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)))
  }, [])

  const deleteContact = useCallback((id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const getContactByPhone = useCallback(
    (phone: string) => {
      const normalized = phone.replace(/\D/g, "")
      return contacts.find((c) => c.phone.replace(/\D/g, "") === normalized)
    },
    [contacts],
  )

  const startCall = useCallback((contact: Contact) => {
    setActiveCallInfo({ contact, startTime: new Date() })
    setIsCallActive(true)
    setShowCallPanel(true)
  }, [])

  const makeCall = useCallback(
    async (contact: Contact, existingCallSid?: string) => {
      setActiveCallInfo({
        contact,
        callSid: existingCallSid,
        startTime: new Date(),
      })
      setIsCallActive(true)
      setShowCallPanel(true)

      if (twilioConfig && !existingCallSid) {
        try {
          const response = await fetch("/api/twilio/make-call", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: contact.phone,
              config: twilioConfig,
              baseUrl: window.location.origin,
            }),
          })

          if (response.ok) {
            const data = await response.json()
            setActiveCallInfo((prev) => (prev ? { ...prev, callSid: data.callSid } : null))
          }
        } catch (error) {
          console.error("Failed to make call:", error)
        }
      }
    },
    [twilioConfig],
  )

  const endCall = useCallback(() => {
    setIsCallActive(false)
    setShowCallPanel(false)
    setActiveCallInfo(null)
  }, [])

  const addFilter = useCallback((filter: ConversationFilter) => {
    setCustomFilters((prev) => [filter, ...prev])
  }, [])

  const deleteFilter = useCallback((filterId: string) => {
    setCustomFilters((prev) => prev.filter((f) => f.id !== filterId))
    if (activeFilter?.id === filterId) {
      setActiveFilter(null)
    }
  }, [activeFilter])

  const syncHistory = useCallback(async () => {
    if (!twilioConfig) return

    setIsSyncing(true)
    try {
      const response = await fetch("/api/twilio/sync-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: twilioConfig }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.conversations && data.conversations.length > 0) {
          setConversationsState((prev) => {
            const phoneMap = new Map(prev.map((c) => [c.phone.replace(/\D/g, ""), c]))

            for (const newConv of data.conversations as Conversation[]) {
              const normalizedPhone = newConv.phone.replace(/\D/g, "")
              const existing = phoneMap.get(normalizedPhone)

              if (existing) {
                const existingIds = new Set(existing.messages.map((m) => m.id))
                const newMessages = newConv.messages.filter((m) => !existingIds.has(m.id))

                const contact = contacts.find((c) => c.phone.replace(/\D/g, "") === normalizedPhone)

                phoneMap.set(normalizedPhone, {
                  ...existing,
                  ...newConv,
                  name: contact?.name || existing.name || newConv.name,
                  messages: deduplicateMessages([...existing.messages, ...newMessages]),
                })
              } else {
                const contact = contacts.find((c) => c.phone.replace(/\D/g, "") === normalizedPhone)
                phoneMap.set(normalizedPhone, {
                  ...newConv,
                  name: contact?.name || newConv.name,
                  messages: deduplicateMessages(newConv.messages),
                })
              }
            }

            return Array.from(phoneMap.values())
          })
        }
      }
    } catch (error) {
      console.error("Failed to sync history:", error)
    } finally {
      setIsSyncing(false)
    }
  }, [twilioConfig, contacts])

  const contextValue = useMemo(
    () => ({
      currentView,
      setCurrentView,
      conversations,
      selectedConversation,
      selectConversation,
      addConversation,
      updateConversation,
      addMessageToConversation,
      setConversations,
      markConversationRead,
      customFilters,
      addFilter,
      deleteFilter,
      activeFilter,
      setActiveFilter,
      contacts,
      addContact,
      updateContact,
      deleteContact,
      getContactByPhone,
      isCallActive,
      showCallPanel,
      activeCallInfo,
      startCall,
      makeCall,
      endCall,
      twilioConfig,
      setTwilioConfig,
      isTwilioConfigured: !!twilioConfig,
      isSyncing,
      syncHistory,
      isRealtimeConnected,
      setRealtimeConnected,
    }),
    [
      currentView,
      conversations,
      selectedConversation,
      selectConversation,
      addConversation,
      updateConversation,
      addMessageToConversation,
      setConversations,
      markConversationRead,
      customFilters,
      addFilter,
      deleteFilter,
      activeFilter,
      setActiveFilter,
      contacts,
      addContact,
      updateContact,
      deleteContact,
      getContactByPhone,
      isCallActive,
      showCallPanel,
      activeCallInfo,
      startCall,
      makeCall,
      endCall,
      twilioConfig,
      setTwilioConfig,
      isSyncing,
      syncHistory,
      isRealtimeConnected,
      setRealtimeConnected,
    ],
  )

  return <CRMContext.Provider value={contextValue}>{children}</CRMContext.Provider>
}

export function useCRM() {
  const context = useContext(CRMContext)
  if (!context) {
    throw new Error("useCRM must be used within a CRMProvider")
  }
  return context
}
