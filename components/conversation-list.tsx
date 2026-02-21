"use client"

import type React from "react"

import { useState, useMemo, useCallback, memo } from "react"
import {
  Search,
  MessageSquare,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  RefreshCw,
  Wifi,
  WifiOff,
  ArrowUpDown,
  Loader2,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useCRM } from "@/lib/crm-context"
import { ComposeMessageDialog } from "./compose-message-dialog"
import { DialPad } from "./dial-pad"
import { FilterManager } from "./filter-manager"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { NotificationStatus } from "./notification-permission-banner"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { Conversation } from "@/lib/types"
import { formatConversationTime, parseTimestampToMs } from "@/lib/timezone"

const CHATS_PER_PAGE = 50

const ConversationItem = memo(function ConversationItem({
  conversation,
  isSelected,
  onSelect,
}: {
  conversation: Conversation
  isSelected: boolean
  onSelect: (conv: Conversation) => void
}) {
  const getTypeIcon = () => {
    if (conversation.type === "message") return <MessageSquare className="h-3.5 w-3.5" />
    if (conversation.callStatus === "incoming") return <PhoneIncoming className="h-3.5 w-3.5" />
    if (conversation.callStatus === "missed") return <PhoneMissed className="h-3.5 w-3.5 text-destructive" />
    return <Phone className="h-3.5 w-3.5" />
  }

  const handleClick = useCallback(() => {
    onSelect(conversation)
  }, [conversation, onSelect])

  const displayTime = formatConversationTime(conversation.time)

  return (
    <button
      onClick={handleClick}
      className={cn(
        "flex w-full items-start gap-3 border-b border-border p-4 text-left transition-colors",
        isSelected ? "bg-secondary" : "hover:bg-secondary/50",
        conversation.unread && !isSelected && "bg-primary/10 border-l-2 border-l-primary",
      )}
    >
      <div className="relative flex-shrink-0">
        <Avatar className="h-10 w-10">
          <AvatarImage src={conversation.avatar || "/placeholder.svg"} />
          <AvatarFallback className="bg-muted text-muted-foreground">
            {conversation.name
              .split(" ")
              .map((n) => n[0])
              .join("")}
          </AvatarFallback>
        </Avatar>
        {conversation.online && (
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-green-500" />
        )}
        {conversation.unread && (
          <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-primary border-2 border-card" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className={cn("font-medium text-foreground truncate", conversation.unread && "font-bold")}>
            {conversation.name}
          </span>
          <span
            className={cn(
              "text-xs flex-shrink-0 ml-2",
              conversation.unread ? "text-primary font-medium" : "text-muted-foreground",
            )}
          >
            {displayTime}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground flex-shrink-0">{getTypeIcon()}</span>
          <p
            className={cn(
              "text-sm truncate flex-1",
              conversation.unread ? "text-foreground font-semibold" : "text-muted-foreground",
            )}
          >
            {conversation.lastMessage}
          </p>
        </div>
      </div>

      {conversation.unread && (
        <Badge className="bg-primary text-primary-foreground h-5 min-w-5 px-1.5 flex items-center justify-center rounded-full text-xs flex-shrink-0">
          {conversation.unreadCount || 1}
        </Badge>
      )}
    </button>
  )
})

export function ConversationList() {
  const {
    conversations,
    selectedConversation,
    selectConversation,
    syncHistory,
    isSyncing,
    isTwilioConfigured,
    isRealtimeConnected,
    customFilters,
    addFilter,
    deleteFilter,
    activeFilter,
    setActiveFilter,
  } = useCRM()
  const [filter, setFilter] = useState<"all" | "unread" | "calls" | "messages">("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest")
  const [displayCount, setDisplayCount] = useState(CHATS_PER_PAGE)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const filteredConversations = useMemo(() => {
    let filtered = conversations
      // Filter out client: prefixed conversations (Twilio device identifiers)
      .filter((conv) => !conv.phone.startsWith("client:") && !conv.name.startsWith("client:"))

    // Apply active custom filter if set
    if (activeFilter) {
      filtered = filtered.filter((conv) => {
        const conditions = activeFilter.conditions
        if (!conditions) return true

        if (conditions.hasUnread && !conv.unread) return false
        if (conditions.messageType === "call" && conv.type !== "call") return false
        if (conditions.messageType === "message" && conv.type !== "message") return false

        return true
      })
    } else if (filter !== "all") {
      // Apply preset filters if no custom filter is active
      filtered = filtered.filter((conv) => {
        if (filter === "unread") return conv.unread
        if (filter === "calls") return conv.type === "call"
        if (filter === "messages") return conv.type === "message"
        return true
      })
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((conv) => conv.name.toLowerCase().includes(query) || conv.phone.includes(searchQuery))
    }

    return [...filtered].sort((a, b) => {
      const timeA = parseTimestampToMs(a.time)
      const timeB = parseTimestampToMs(b.time)
      return sortOrder === "newest" ? timeB - timeA : timeA - timeB
    })
  }, [conversations, filter, searchQuery, sortOrder, activeFilter])

  const paginatedConversations = useMemo(() => {
    return filteredConversations.slice(0, displayCount)
  }, [filteredConversations, displayCount])

  const hasMore = filteredConversations.length > displayCount
  const remainingCount = filteredConversations.length - displayCount

  const totalUnread = useMemo(
    () => conversations.reduce((sum, conv) => sum + (conv.unreadCount || (conv.unread ? 1 : 0)), 0),
    [conversations],
  )

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    setDisplayCount(CHATS_PER_PAGE)
  }, [])

  const handleFilterChange = useCallback((newFilter: "all" | "unread" | "calls" | "messages") => {
    setFilter(newFilter)
    setDisplayCount(CHATS_PER_PAGE)
  }, [])

  const handleLoadMore = useCallback(() => {
    setIsLoadingMore(true)
    setTimeout(() => {
      setDisplayCount((prev) => prev + CHATS_PER_PAGE)
      setIsLoadingMore(false)
    }, 150)
  }, [])

  return (
    <div className="flex w-80 flex-col border-r border-border bg-card">
      {/* Header */}
      <div className="border-b border-border p-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">Inbox</h2>
            {totalUnread > 0 && (
              <Badge
                variant="destructive"
                className="h-5 min-w-5 px-1.5 flex items-center justify-center rounded-full text-xs"
              >
                {totalUnread > 99 ? "99+" : totalUnread}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {isTwilioConfigured && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "flex items-center justify-center h-8 w-8 rounded-md transition-colors",
                        isRealtimeConnected ? "text-green-500" : "text-muted-foreground",
                      )}
                    >
                      {isRealtimeConnected ? (
                        <div className="relative">
                          <Wifi className="h-4 w-4" />
                          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                        </div>
                      ) : (
                        <WifiOff className="h-4 w-4" />
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isRealtimeConnected ? "Live updates active (polling every 5s)" : "Connecting to live updates..."}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <NotificationStatus />
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              {filteredConversations.length}
            </Badge>
            {isTwilioConfigured && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={syncHistory} disabled={isSyncing}>
                      <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Force sync from Twilio</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mb-3">
          <ComposeMessageDialog />
          <DialPad />
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            className="pl-9 bg-secondary border-0"
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={filter === "all" && !activeFilter ? "default" : "ghost"}
            size="sm"
            onClick={() => {
              handleFilterChange("all")
              setActiveFilter(null)
            }}
            className="h-8"
          >
            All
          </Button>
          <Button
            variant={filter === "unread" && !activeFilter ? "default" : "ghost"}
            size="sm"
            onClick={() => {
              handleFilterChange("unread")
              setActiveFilter(null)
            }}
            className="h-8"
          >
            Unread
            {totalUnread > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 min-w-4 px-1 text-[10px]">
                {totalUnread > 99 ? "99+" : totalUnread}
              </Badge>
            )}
          </Button>
          <Button
            variant={filter === "messages" && !activeFilter ? "default" : "ghost"}
            size="sm"
            onClick={() => {
              handleFilterChange("messages")
              setActiveFilter(null)
            }}
            className="h-8"
          >
            <MessageSquare className="h-3.5 w-3.5 mr-1" />
            Chats
          </Button>
          <Button
            variant={filter === "calls" && !activeFilter ? "default" : "ghost"}
            size="sm"
            onClick={() => {
              handleFilterChange("calls")
              setActiveFilter(null)
            }}
            className="h-8"
          >
            <Phone className="h-3.5 w-3.5 mr-1" />
            Calls
          </Button>
          <FilterManager
            filters={customFilters}
            onCreateFilter={addFilter}
            onDeleteFilter={deleteFilter}
            onApplyFilter={(newFilter) => {
              if (newFilter) {
                setActiveFilter(newFilter)
              } else {
                setActiveFilter(null)
              }
            }}
            activeFilterId={activeFilter?.id ?? null}
            conversations={conversations}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setSortOrder("newest")
                  setDisplayCount(CHATS_PER_PAGE)
                }}
              >
                {sortOrder === "newest" && "✓ "}Newest First
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setSortOrder("oldest")
                  setDisplayCount(CHATS_PER_PAGE)
                }}
              >
                {sortOrder === "oldest" && "✓ "}Oldest First
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {paginatedConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">No conversations found</p>
          </div>
        ) : (
          <>
            {paginatedConversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isSelected={selectedConversation?.id === conversation.id}
                onSelect={selectConversation}
              />
            ))}

            {hasMore && (
              <div className="p-4 border-t border-border">
                <Button
                  variant="outline"
                  className="w-full bg-transparent"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>Load more chats ({remainingCount > 50 ? "50+" : remainingCount} remaining)</>
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
