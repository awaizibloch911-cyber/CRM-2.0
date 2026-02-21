export interface Conversation {
  id: string
  name: string
  phone: string
  avatar?: string
  lastMessage: string
  time: string
  unread: boolean
  unreadCount?: number
  online: boolean
  type: "message" | "call"
  callStatus?: "incoming" | "outgoing" | "missed"
  callDuration?: string
  contactId: string
  messages: Message[]
}

export interface Contact {
  id: string
  name: string
  avatar?: string
  email: string
  phone: string
  company: string
  role: string
  location: string
  status: string
  online: boolean
  lastSeen?: string
  tags: string[]
  notes?: string
  recentActivity: {
    action: string
    date: string
  }[]
}

export interface Message {
  id: string
  content: string
  sender: "user" | "contact"
  timestamp: string
  type: "text" | "call_recording" | "call_log"
  recordingUrl?: string
  duration?: string
  callType?: "incoming" | "outgoing" | "missed"
  isRead?: boolean
}

export interface TwilioConfig {
  accountSid: string
  authToken: string
  phoneNumber: string
}

export type ViewType =
  | "conversations"
  | "calls"
  | "contacts"
  | "calendar"
  | "campaigns"
  | "reports"
  | "automations"
  | "settings"

export interface ConversationFilter {
  id: string
  name: string
  type: "unread" | "calls" | "messages" | "custom"
  conditions?: {
    hasUnread?: boolean
    messageType?: "call" | "message"
    searchTerm?: string
    contactName?: string
  }
  createdAt: string
}

export interface MessageTemplate {
  id: string
  name: string
  content: string
  createdAt: string
  updatedAt: string
}
