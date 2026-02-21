"use client"

import { useState, useEffect } from "react"
import {
  Search,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Play,
  Pause,
  MoreVertical,
  RefreshCw,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useCRM } from "@/lib/crm-context"
import { useCall } from "@/lib/call-context"
import { useCallLogs } from "@/lib/use-call-logs"
import { DialPad } from "./dial-pad"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export function CallsView() {
  const { conversations, contacts, selectConversation, setCurrentView, syncHistory, isSyncing, getContactByPhone } =
    useCRM()
  const { initiateCall } = useCall()
  const { callLogs, isLoading: isLoadingCallLogs, fetchCallLogs, loadMore, hasMore } = useCallLogs()
  const [searchQuery, setSearchQuery] = useState("")
  const [filter, setFilter] = useState<"all" | "incoming" | "outgoing" | "missed">("all")
  const [playingRecording, setPlayingRecording] = useState<string | null>(null)
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null)

  // Load call logs on component mount
  useEffect(() => {
    fetchCallLogs(1)
  }, [fetchCallLogs])

  // Use Twilio call logs data, fallback to conversations if not available
  const callHistory = callLogs.length > 0
    ? callLogs
        .filter((call) => {
          if (filter === "all") return true
          return call.type === filter
        })
        .filter(
          (call) =>
            call.phone.toLowerCase().includes(searchQuery.toLowerCase()) || call.phone.includes(searchQuery),
        )
    : conversations
        .filter((conv) => !conv.phone.startsWith("client:") && !conv.name.startsWith("client:"))
        .filter((conv) => conv.messages.some((m) => m.type === "call_log" || m.type === "call_recording"))
        .map((conv) => {
          const callLogs = conv.messages.filter((m) => m.type === "call_log")
          const lastCall = callLogs[callLogs.length - 1]
          return {
            ...conv,
            callStatus: lastCall?.callType || conv.callStatus,
            callDuration: lastCall?.duration || conv.callDuration,
          }
        })
        .filter((conv) => {
          if (filter === "all") return true
          return conv.callStatus === filter
        })
        .filter((conv) => conv.name.toLowerCase().includes(searchQuery.toLowerCase()) || conv.phone.includes(searchQuery))

  const getCallIcon = (status: string | undefined) => {
    switch (status) {
      case "incoming":
        return <PhoneIncoming className="h-4 w-4 text-green-500" />
      case "outgoing":
        return <PhoneOutgoing className="h-4 w-4 text-blue-500" />
      case "missed":
        return <PhoneMissed className="h-4 w-4 text-destructive" />
      default:
        return <Phone className="h-4 w-4" />
    }
  }

  const handleCallBack = (conv: (typeof conversations)[0]) => {
    const contact = getContactByPhone(conv.phone)

    const contactToCall = contact || {
      id: conv.id,
      name: conv.name,
      phone: conv.phone,
      email: "",
      company: "",
      role: "",
      location: "",
      status: "Unknown",
      online: false,
      tags: [],
      recentActivity: [],
    }

    initiateCall(contactToCall)
  }

  const toggleRecording = (recordingId: string, recordingUrl?: string) => {
    if (playingRecording === recordingId) {
      audioRef?.pause()
      setPlayingRecording(null)
      setAudioRef(null)
    } else {
      if (audioRef) {
        audioRef.pause()
      }
      if (recordingUrl) {
        const audio = new Audio(recordingUrl)
        audio.play()
        audio.onended = () => {
          setPlayingRecording(null)
          setAudioRef(null)
        }
        setAudioRef(audio)
      }
      setPlayingRecording(recordingId)
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Call History</h1>
            <p className="text-sm text-muted-foreground">View and manage your calls</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                fetchCallLogs(1)
                syncHistory()
              }}
              disabled={isSyncing || isLoadingCallLogs}
              className="gap-2 bg-transparent"
            >
              <RefreshCw className={cn("h-4 w-4", (isSyncing || isLoadingCallLogs) && "animate-spin")} />
              {isSyncing || isLoadingCallLogs ? "Syncing..." : "Sync Calls"}
            </Button>
            <DialPad />
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search calls..."
              className="pl-9 bg-secondary border-0"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>
              All
            </Button>
            <Button
              variant={filter === "incoming" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("incoming")}
              className="gap-1"
            >
              <PhoneIncoming className="h-3.5 w-3.5" />
              Incoming
            </Button>
            <Button
              variant={filter === "outgoing" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("outgoing")}
              className="gap-1"
            >
              <PhoneOutgoing className="h-3.5 w-3.5" />
              Outgoing
            </Button>
            <Button
              variant={filter === "missed" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("missed")}
              className="gap-1"
            >
              <PhoneMissed className="h-3.5 w-3.5" />
              Missed
            </Button>
          </div>
        </div>
      </div>

      {/* Call List */}
      <div className="flex-1 overflow-y-auto p-6">
        {callHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Phone className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg mb-2">No calls found</p>
            <p className="text-sm mb-4">Sync call history from Twilio or use the dial pad to make calls</p>
            <Button
              onClick={() => {
                fetchCallLogs(1)
                syncHistory()
              }}
              disabled={isSyncing || isLoadingCallLogs}
              className="gap-2"
            >
              <RefreshCw className={cn("h-4 w-4", (isSyncing || isLoadingCallLogs) && "animate-spin")} />
              Sync from Twilio
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              {callHistory.map((call: any) => {
                const recording = call.recordings?.[0] || call.messages?.find((m: any) => m.type === "call_recording")

                return (
                  <div
                    key={call.id || call.sid}
                    className="flex items-center gap-4 p-4 rounded-lg bg-card border border-border hover:bg-secondary/50 transition-colors"
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={call.avatar || "/placeholder.svg"} />
                      <AvatarFallback className="bg-muted text-muted-foreground">
                        {(call.name || call.phone)
                          .split(" ")
                          .map((n: string) => n[0])
                          .join("")
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-foreground">{call.name || call.phone}</span>
                        {getCallIcon(call.callStatus || call.type)}
                        {(call.callStatus === "missed" || call.type === "missed") && (
                          <Badge variant="destructive" className="text-xs">
                            Missed
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{call.phone}</span>
                        <span>•</span>
                        <span>{call.time || new Date(call.dateCreated).toLocaleString()}</span>
                        {(call.callDuration || call.duration) && (
                          <>
                            <span>•</span>
                            <span>{call.callDuration || call.duration}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {recording && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => toggleRecording(call.sid || call.id, recording.url || recording.recordingUrl)}
                        >
                          {playingRecording === (call.sid || call.id) ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                        <div className="w-24 h-1 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full bg-primary transition-all",
                              playingRecording === (call.sid || call.id) ? "animate-pulse w-1/2" : "w-0",
                            )}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{recording.duration}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 bg-transparent"
                        onClick={() => {
                          const contact = getContactByPhone(call.phone)
                          const contactToCall = contact || {
                            id: call.sid || call.id,
                            name: call.name || call.phone,
                            phone: call.phone,
                            email: "",
                            company: "",
                            role: "",
                            location: "",
                            status: "Unknown",
                            online: false,
                            tags: [],
                            recentActivity: [],
                          }
                          initiateCall(contactToCall)
                        }}
                      >
                        <Phone className="h-4 w-4" />
                        Call Back
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {call.name && (
                            <DropdownMenuItem
                              onClick={() => {
                                selectConversation(call)
                                setCurrentView("conversations")
                              }}
                            >
                              View Conversation
                            </DropdownMenuItem>
                          )}
                          {recording && (
                            <DropdownMenuItem
                              onClick={() => {
                                const url = recording.url || recording.recordingUrl
                                if (url) {
                                  window.open(url, "_blank")
                                }
                              }}
                            >
                              Download Recording
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                )
              })}
            </div>

            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button variant="outline" onClick={loadMore} disabled={isLoadingCallLogs} className="gap-2 bg-transparent">
                  {isLoadingCallLogs ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Loading more...
                    </>
                  ) : (
                    "Load More Calls"
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
