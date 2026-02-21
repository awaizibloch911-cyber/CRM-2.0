"use client"

import type React from "react"
import { useState, useCallback } from "react"
import { Plus, X, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import type { ConversationFilter, Conversation } from "@/lib/types"

interface FilterManagerProps {
  filters: ConversationFilter[]
  onCreateFilter: (filter: ConversationFilter) => void
  onDeleteFilter: (filterId: string) => void
  onApplyFilter: (filter: ConversationFilter | null) => void
  activeFilterId: string | null
  conversations: Conversation[]
}

export function FilterManager({
  filters,
  onCreateFilter,
  onDeleteFilter,
  onApplyFilter,
  activeFilterId,
  conversations,
}: FilterManagerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [filterName, setFilterName] = useState("")
  const [selectedConditions, setSelectedConditions] = useState({
    hasUnread: false,
    callsOnly: false,
    messagesOnly: false,
  })

  const handleCreateFilter = useCallback(() => {
    if (!filterName.trim()) return

    const conditions: ConversationFilter["conditions"] = {}
    if (selectedConditions.hasUnread) conditions.hasUnread = true
    if (selectedConditions.callsOnly) conditions.messageType = "call"
    if (selectedConditions.messagesOnly) conditions.messageType = "message"

    const newFilter: ConversationFilter = {
      id: `filter_${Date.now()}`,
      name: filterName,
      type: "custom",
      conditions,
      createdAt: new Date().toISOString(),
    }

    onCreateFilter(newFilter)
    setFilterName("")
    setSelectedConditions({ hasUnread: false, callsOnly: false, messagesOnly: false })
    setIsOpen(false)
  }, [filterName, selectedConditions, onCreateFilter])

  const applyPresetFilter = useCallback(
    (type: "unread" | "calls" | "messages") => {
      const presetFilters: Record<string, ConversationFilter> = {
        unread: {
          id: "preset_unread",
          name: "Unread",
          type: "unread",
          conditions: { hasUnread: true },
          createdAt: new Date().toISOString(),
        },
        calls: {
          id: "preset_calls",
          name: "Calls",
          type: "calls",
          conditions: { messageType: "call" },
          createdAt: new Date().toISOString(),
        },
        messages: {
          id: "preset_messages",
          name: "Messages",
          type: "messages",
          conditions: { messageType: "message" },
          createdAt: new Date().toISOString(),
        },
      }
      onApplyFilter(presetFilters[type])
    },
    [onApplyFilter],
  )

  return (
    <div className="flex items-center gap-2">
      {/* Preset Filters Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Settings2 className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => applyPresetFilter("unread")}>Unread</DropdownMenuItem>
          <DropdownMenuItem onClick={() => applyPresetFilter("calls")}>Calls</DropdownMenuItem>
          <DropdownMenuItem onClick={() => applyPresetFilter("messages")}>Messages</DropdownMenuItem>
          {filters.length > 0 && <div className="my-2 border-t" />}
          {filters.map((filter) => (
            <div key={filter.id} className="flex items-center justify-between px-2 py-1.5">
              <button
                onClick={() => onApplyFilter(filter)}
                className="flex-1 text-left text-sm hover:bg-secondary px-2 py-1 rounded transition-colors"
              >
                {filter.name}
              </button>
              <button
                onClick={() => onDeleteFilter(filter.id)}
                className="ml-2 p-1 hover:bg-destructive/10 rounded transition-colors"
              >
                <X className="h-3 w-3 text-destructive" />
              </button>
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create Filter Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 gap-1">
            <Plus className="h-3.5 w-3.5" />
            Add Filter
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Custom Filter</DialogTitle>
            <DialogDescription>Name your filter and choose what conversations to include</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Filter Name */}
            <div className="space-y-2">
              <Label htmlFor="filter-name">Filter Name</Label>
              <Input
                id="filter-name"
                placeholder="e.g., VIP Clients, Q4 Leads"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCreateFilter()
                  }
                }}
              />
            </div>

            {/* Filter Conditions */}
            <div className="space-y-3">
              <Label>Conditions</Label>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="unread"
                  checked={selectedConditions.hasUnread}
                  onCheckedChange={(checked) =>
                    setSelectedConditions((prev) => ({
                      ...prev,
                      hasUnread: checked as boolean,
                    }))
                  }
                />
                <Label htmlFor="unread" className="font-normal cursor-pointer">
                  Unread only
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="calls"
                  checked={selectedConditions.callsOnly}
                  disabled={selectedConditions.messagesOnly}
                  onCheckedChange={(checked) =>
                    setSelectedConditions((prev) => ({
                      ...prev,
                      callsOnly: checked as boolean,
                    }))
                  }
                />
                <Label htmlFor="calls" className="font-normal cursor-pointer">
                  Calls only
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="messages"
                  checked={selectedConditions.messagesOnly}
                  disabled={selectedConditions.callsOnly}
                  onCheckedChange={(checked) =>
                    setSelectedConditions((prev) => ({
                      ...prev,
                      messagesOnly: checked as boolean,
                    }))
                  }
                />
                <Label htmlFor="messages" className="font-normal cursor-pointer">
                  Messages only
                </Label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateFilter} disabled={!filterName.trim()}>
                Create Filter
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
