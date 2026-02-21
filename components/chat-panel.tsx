"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import {
  Phone,
  Video,
  MoreVertical,
  Paperclip,
  Smile,
  Send,
  ImageIcon,
  Play,
  Pause,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  ChevronDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useCRM } from "@/lib/crm-context"
import { useCall } from "@/lib/call-context"
import { useMessageTemplates } from "@/lib/use-message-templates"
import { TemplateManager } from "./template-manager"
import type { Message, Contact, MessageTemplate } from "@/lib/types"
import { getCurrentTimestampPKT, parseAndFormatPKT, parseTimestampToMs } from "@/lib/timezone"

interface ChatPanelProps {
  contact: Contact
}

export function ChatPanel({ contact }: ChatPanelProps) {
  const { selectedConversation, addMessageToConversation, twilioConfig } = useCRM()
  const { initiateCall } = useCall()
  const { templates, addTemplate, deleteTemplate, updateTemplate } = useMessageTemplates()
  const [message, setMessage] = useState("")
  const [playingAudio, setPlayingAudio] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const prevMessageCountRef = useRef(0)

  const messages = selectedConversation?.messages || []

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => {
      return parseTimestampToMs(a.timestamp) - parseTimestampToMs(b.timestamp)
    })
  }, [messages])

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return
    const { scrollTop, scrollHeight, clientHeight } = container
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
    setShowScrollButton(!isNearBottom)
  }, [])

  useEffect(() => {
    const currentCount = sortedMessages.length
    const hadNewMessages = currentCount > prevMessageCountRef.current

    if (hadNewMessages) {
      const lastMessage = sortedMessages[sortedMessages.length - 1]
      const isOwnMessage = lastMessage?.sender === "user"
      const container = scrollContainerRef.current

      if (container) {
        const { scrollTop, scrollHeight, clientHeight } = container
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 150

        if (isNearBottom || isOwnMessage) {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
        } else {
          setShowScrollButton(true)
        }
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
      }
    }

    prevMessageCountRef.current = currentCount
  }, [sortedMessages])

  useEffect(() => {
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" })
    }, 50)
    prevMessageCountRef.current = sortedMessages.length
    setShowScrollButton(false)
    return () => clearTimeout(timer)
  }, [selectedConversation?.id])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    setShowScrollButton(false)
  }, [])

  const handleSend = async () => {
    if (!message.trim() || !selectedConversation || isSending) return

    const messageContent = message
    setMessage("")
    setIsSending(true)

    const newMessage: Message = {
      id: Date.now().toString(),
      content: messageContent,
      sender: "user",
      timestamp: getCurrentTimestampPKT(),
      type: "text",
      isRead: true,
    }

    addMessageToConversation(selectedConversation.id, newMessage)

    if (twilioConfig) {
      try {
        await fetch("/api/twilio/send-sms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: selectedConversation.phone,
            message: messageContent,
            config: twilioConfig,
            baseUrl: window.location.origin,
          }),
        })
      } catch (error) {
        console.error("Failed to send SMS:", error)
      }
    }

    setIsSending(false)
  }

  const handleCall = () => {
    initiateCall(contact)
  }

  const handleSelectTemplate = (template: MessageTemplate) => {
    setMessage(template.content)
  }

  const handlePlayRecording = (messageId: string, url?: string) => {
    if (playingAudio === messageId) {
      audioRef.current?.pause()
      setPlayingAudio(null)
    } else {
      if (audioRef.current) {
        audioRef.current.pause()
      }
      audioRef.current = new Audio(url || "/placeholder-audio.mp3")
      audioRef.current.play()
      audioRef.current.onended = () => setPlayingAudio(null)
      setPlayingAudio(messageId)
    }
  }

  const renderMessage = (msg: Message) => {
    const formattedTime = parseAndFormatPKT(msg.timestamp)

    if (msg.type === "call_log") {
      return (
        <div className="flex items-center justify-center my-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-full text-sm text-muted-foreground">
            {msg.callType === "incoming" && <PhoneIncoming className="h-4 w-4" />}
            {msg.callType === "outgoing" && <PhoneOutgoing className="h-4 w-4" />}
            {msg.callType === "missed" && <PhoneMissed className="h-4 w-4 text-destructive" />}
            <span>{msg.callType === "missed" ? "Missed call" : `Call - ${msg.duration || "0:00"}`}</span>
            <span className="text-xs opacity-70">{formattedTime}</span>
          </div>
        </div>
      )
    }

    if (msg.type === "call_recording") {
      return (
        <div className="flex justify-center my-4">
          <div className="flex items-center gap-3 px-4 py-3 bg-secondary rounded-lg max-w-sm">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full bg-primary text-primary-foreground"
              onClick={() => handlePlayRecording(msg.id, msg.recordingUrl)}
            >
              {playingAudio === msg.id ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
            </Button>
            <div className="flex-1">
              <p className="text-sm font-medium">Call Recording</p>
              <p className="text-xs text-muted-foreground">
                {msg.duration || "0:00"} - {formattedTime}
              </p>
            </div>
          </div>
        </div>
      )
    }

    const isUnread = msg.sender === "contact" && !msg.isRead

    return (
      <div className={cn("flex", msg.sender === "user" ? "justify-end" : "justify-start")}>
        <div
          className={cn(
            "max-w-[70%] rounded-2xl px-4 py-2 relative",
            msg.sender === "user"
              ? "bg-primary text-primary-foreground"
              : isUnread
                ? "bg-blue-100 dark:bg-blue-900/40 text-foreground ring-2 ring-primary/30"
                : "bg-secondary text-secondary-foreground",
          )}
        >
          {isUnread && <span className="absolute -left-1 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary" />}
          <p className="text-sm">{msg.content}</p>
          <p
            className={cn(
              "text-xs mt-1",
              msg.sender === "user" ? "text-primary-foreground/70" : "text-muted-foreground",
            )}
          >
            {formattedTime}
          </p>
        </div>
      </div>
    )
  }

  if (!selectedConversation) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        Select a conversation to start
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col bg-background relative h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={selectedConversation.avatar || "/placeholder.svg"} />
            <AvatarFallback className="bg-muted">
              {selectedConversation.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-foreground">{selectedConversation.name}</h3>
            <p className="text-sm text-muted-foreground">{selectedConversation.phone}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={handleCall} title="Start a call">
            <Phone className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <Video className="h-5 w-5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>View Profile</DropdownMenuItem>
              <DropdownMenuItem>Search Messages</DropdownMenuItem>
              <DropdownMenuItem>Mute Notifications</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">Block Contact</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto min-h-0">
        <div className="p-6 space-y-4">
          {sortedMessages.map((msg) => (
            <div key={msg.id}>{renderMessage(msg)}</div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Scroll Button */}
      {showScrollButton && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10">
          <Button variant="secondary" size="sm" className="rounded-full shadow-lg gap-1" onClick={scrollToBottom}>
            <ChevronDown className="h-4 w-4" />
            New messages
          </Button>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border p-4 shrink-0 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="icon">
            <Paperclip className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <ImageIcon className="h-5 w-5" />
          </Button>
          <TemplateManager
            templates={templates}
            onAddTemplate={addTemplate}
            onDeleteTemplate={deleteTemplate}
            onUpdateTemplate={updateTemplate}
            onSelectTemplate={handleSelectTemplate}
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              placeholder="Type a message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              className="pr-12 bg-secondary border-0"
              disabled={isSending}
            />
            <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8">
              <Smile className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={handleSend} disabled={!message.trim() || isSending}>
            <Send className={cn("h-4 w-4", isSending && "animate-pulse")} />
          </Button>
        </div>
      </div>
    </div>
  )
}
