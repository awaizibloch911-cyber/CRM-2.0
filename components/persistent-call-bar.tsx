"use client"

import { PhoneOff, Mic, MicOff, Maximize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useCall } from "@/lib/call-context"
import { cn } from "@/lib/utils"

interface PersistentCallBarProps {
  onExpand?: () => void
}

export function PersistentCallBar({ onExpand }: PersistentCallBarProps) {
  const { activeCall, endCall, toggleMute, callDuration } = useCall()

  if (!activeCall || activeCall.status === "ended") return null

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const isConnected = activeCall.status === "in-progress" || activeCall.status === "on-hold"

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-[80]",
        "flex items-center justify-between px-4 py-2",
        "bg-primary text-primary-foreground",
        "shadow-lg",
      )}
    >
      <div className="flex items-center gap-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={activeCall.contact.avatar || "/placeholder.svg"} />
          <AvatarFallback className="bg-primary-foreground/20 text-xs">
            {activeCall.contact.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)}
          </AvatarFallback>
        </Avatar>

        <div className="flex flex-col">
          <span className="text-sm font-medium">{activeCall.contact.name}</span>
          <span className="text-xs opacity-80">
            {isConnected
              ? formatDuration(callDuration)
              : activeCall.status === "ringing"
                ? "Ringing..."
                : activeCall.status === "on-hold"
                  ? "On Hold"
                  : "Connecting..."}
          </span>
        </div>

        {activeCall.isRecording && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-destructive text-destructive-foreground text-xs">
            <span className="h-2 w-2 rounded-full bg-current animate-pulse" />
            REC
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
          onClick={() => toggleMute()}
        >
          {activeCall.isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          onClick={() => endCall()}
        >
          <PhoneOff className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
          onClick={onExpand}
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
