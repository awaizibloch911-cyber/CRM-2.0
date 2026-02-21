"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Mic,
  MicOff,
  PhoneOff,
  Volume2,
  VolumeX,
  Users,
  Circle,
  Pause,
  Play,
  Hash,
  AlertCircle,
  PhoneIncoming,
  PhoneOutgoing,
  X,
  Minimize2,
  Maximize2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useCall, type CallStatus } from "@/lib/call-context"
import { cn } from "@/lib/utils"

const dialPadButtons = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"]

export function ActiveCallOverlay() {
  const { activeCall, endCall, toggleMute, toggleSpeaker, toggleHold, toggleRecording, sendDTMF, callDuration } =
    useCall()

  const [showDialPad, setShowDialPad] = useState(false)
  const [dtmfInput, setDtmfInput] = useState("")
  const [isMinimized, setIsMinimized] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (activeCall) {
      setTimeout(() => setIsVisible(true), 50)
    } else {
      setIsVisible(false)
      setIsMinimized(false)
      setShowDialPad(false)
      setDtmfInput("")
    }
  }, [activeCall])

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const handleDtmf = async (digit: string) => {
    setDtmfInput((prev) => prev + digit)
    await sendDTMF(digit)
  }

  const statusConfig = useMemo(() => {
    const configs: Record<CallStatus, { text: string; color: string; animate: boolean }> = {
      idle: { text: "", color: "text-muted-foreground", animate: false },
      initiating: { text: "Initiating...", color: "text-yellow-500", animate: true },
      ringing: { text: "Ringing...", color: "text-blue-500", animate: true },
      connecting: { text: "Connecting...", color: "text-yellow-500", animate: true },
      "in-progress": { text: formatDuration(callDuration), color: "text-green-500", animate: false },
      "on-hold": { text: "On Hold", color: "text-yellow-500", animate: true },
      ended: { text: "Call Ended", color: "text-muted-foreground", animate: false },
      failed: { text: "Call Failed", color: "text-destructive", animate: false },
      busy: { text: "Line Busy", color: "text-orange-500", animate: false },
      "no-answer": { text: "No Answer", color: "text-orange-500", animate: false },
    }
    return configs[activeCall?.status || "idle"]
  }, [activeCall?.status, callDuration])

  if (!activeCall) return null

  const contact = activeCall.contact
  const isConnected = activeCall.status === "in-progress" || activeCall.status === "on-hold"
  const isEnding =
    activeCall.status === "ended" ||
    activeCall.status === "failed" ||
    activeCall.status === "busy" ||
    activeCall.status === "no-answer"

  // Minimized view (floating call bar)
  if (isMinimized) {
    return (
      <div
        className={cn(
          "fixed bottom-4 right-4 z-[90]",
          "flex items-center gap-3 px-4 py-3 rounded-full",
          "bg-card border border-border shadow-xl",
          "transform transition-all duration-300",
          isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
        )}
      >
        <Avatar className="h-10 w-10">
          <AvatarImage src={contact.avatar || "/placeholder.svg"} />
          <AvatarFallback className="bg-primary/20 text-primary text-sm">
            {contact.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)}
          </AvatarFallback>
        </Avatar>

        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">{contact.name}</span>
          <span className={cn("text-xs", statusConfig.color, statusConfig.animate && "animate-pulse")}>
            {statusConfig.text}
          </span>
        </div>

        {activeCall.isRecording && (
          <div className="flex items-center gap-1 text-destructive">
            <Circle className="h-2 w-2 fill-current animate-pulse" />
            <span className="text-xs">REC</span>
          </div>
        )}

        <div className="flex items-center gap-2 ml-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => toggleMute()}>
            {activeCall.isMuted ? <MicOff className="h-4 w-4 text-destructive" /> : <Mic className="h-4 w-4" />}
          </Button>

          <Button variant="destructive" size="icon" className="h-8 w-8 rounded-full" onClick={() => endCall()}>
            <PhoneOff className="h-4 w-4" />
          </Button>

          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setIsMinimized(false)}>
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  // Full screen call view
  return (
    <div
      className={cn(
        "fixed inset-0 z-[90] flex items-center justify-center",
        "bg-background/98 backdrop-blur-sm",
        "transition-all duration-300",
        isVisible ? "opacity-100" : "opacity-0",
      )}
    >
      {/* Minimize button */}
      <Button variant="ghost" size="icon" className="absolute top-4 right-4" onClick={() => setIsMinimized(true)}>
        <Minimize2 className="h-5 w-5" />
      </Button>

      <div className="w-full max-w-md mx-auto p-8">
        {/* Call Direction Indicator */}
        <div className="flex items-center justify-center gap-2 mb-4">
          {activeCall.direction === "incoming" ? (
            <PhoneIncoming className="h-4 w-4 text-green-500" />
          ) : (
            <PhoneOutgoing className="h-4 w-4 text-blue-500" />
          )}
          <span className="text-xs text-muted-foreground uppercase tracking-wider">{activeCall.direction} Call</span>
        </div>

        {/* Contact Avatar & Info */}
        <div className="text-center mb-8">
          <div className="relative inline-block mb-6">
            {/* Pulsing animation for connecting states */}
            {(activeCall.status === "initiating" ||
              activeCall.status === "ringing" ||
              activeCall.status === "connecting") && (
              <>
                <span
                  className="absolute inset-0 rounded-full bg-primary/20 animate-ping"
                  style={{ animationDuration: "2s" }}
                />
                <span className="absolute inset-0 rounded-full bg-primary/10 animate-pulse" />
              </>
            )}

            <Avatar className="h-32 w-32 relative border-4 border-border shadow-lg">
              <AvatarImage src={contact.avatar || "/placeholder.svg"} />
              <AvatarFallback className="text-3xl font-bold bg-muted">
                {contact.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>

            {/* Recording indicator */}
            {activeCall.isRecording && (
              <span className="absolute top-0 right-0 flex h-6 w-6 items-center justify-center">
                <span className="animate-ping absolute h-full w-full rounded-full bg-destructive/75" />
                <Circle className="h-4 w-4 fill-destructive text-destructive" />
              </span>
            )}
          </div>

          <h2 className="text-2xl font-semibold text-foreground mb-1">{contact.name}</h2>
          <p className="text-muted-foreground mb-4">{contact.phone}</p>

          {/* Call Status */}
          <div className={cn("flex items-center justify-center gap-2 text-lg", statusConfig.color)}>
            {activeCall.status === "failed" && <AlertCircle className="h-5 w-5" />}
            <span className={statusConfig.animate ? "animate-pulse" : ""}>{statusConfig.text}</span>
            {activeCall.isRecording && activeCall.status === "in-progress" && (
              <span className="text-destructive text-sm flex items-center gap-1 ml-2">
                <Circle className="h-2 w-2 fill-current animate-pulse" />
                REC
              </span>
            )}
          </div>

          {/* Error message */}
          {activeCall.error && (
            <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">{activeCall.error.message}</p>
            </div>
          )}

          {/* DTMF Input Display */}
          {showDialPad && dtmfInput && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <span className="text-2xl font-mono text-primary tracking-wider">{dtmfInput}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDtmfInput("")}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* In-Call Dial Pad */}
        {showDialPad && isConnected && (
          <div className="grid grid-cols-3 gap-2 mb-8 max-w-xs mx-auto">
            {dialPadButtons.map((digit) => (
              <Button
                key={digit}
                variant="outline"
                className="h-14 text-xl font-semibold bg-transparent hover:bg-secondary"
                onClick={() => handleDtmf(digit)}
              >
                {digit}
              </Button>
            ))}
          </div>
        )}

        {/* Call Controls */}
        {isConnected && (
          <>
            <div className="flex flex-wrap items-center justify-center gap-4 mb-6">
              {/* Mute */}
              <Button
                variant={activeCall.isMuted ? "destructive" : "secondary"}
                size="lg"
                className="h-16 w-16 rounded-full"
                onClick={() => toggleMute()}
              >
                {activeCall.isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
              </Button>

              {/* Speaker */}
              <Button
                variant={!activeCall.isSpeakerOn ? "destructive" : "secondary"}
                size="lg"
                className="h-16 w-16 rounded-full"
                onClick={() => toggleSpeaker()}
              >
                {activeCall.isSpeakerOn ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6" />}
              </Button>

              {/* Hold */}
              <Button
                variant={activeCall.isOnHold ? "default" : "secondary"}
                size="lg"
                className="h-16 w-16 rounded-full"
                onClick={() => toggleHold()}
              >
                {activeCall.isOnHold ? <Play className="h-6 w-6" /> : <Pause className="h-6 w-6" />}
              </Button>

              {/* Record */}
              <Button
                variant={activeCall.isRecording ? "destructive" : "secondary"}
                size="lg"
                className="h-16 w-16 rounded-full"
                onClick={() => toggleRecording()}
              >
                <Circle className={cn("h-6 w-6", activeCall.isRecording && "fill-current")} />
              </Button>

              {/* Keypad Toggle */}
              <Button
                variant={showDialPad ? "default" : "secondary"}
                size="lg"
                className="h-16 w-16 rounded-full"
                onClick={() => setShowDialPad(!showDialPad)}
              >
                <Hash className="h-6 w-6" />
              </Button>

              {/* Transfer (placeholder) */}
              <Button variant="secondary" size="lg" className="h-16 w-16 rounded-full" onClick={() => {}}>
                <Users className="h-6 w-6" />
              </Button>
            </div>

            {/* Control Labels */}
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground mb-8">
              <span className="w-16 text-center">{activeCall.isMuted ? "Unmute" : "Mute"}</span>
              <span className="w-16 text-center">{activeCall.isSpeakerOn ? "Speaker" : "Speaker Off"}</span>
              <span className="w-16 text-center">{activeCall.isOnHold ? "Resume" : "Hold"}</span>
              <span className="w-16 text-center">{activeCall.isRecording ? "Stop Rec" : "Record"}</span>
              <span className="w-16 text-center">Keypad</span>
              <span className="w-16 text-center">Transfer</span>
            </div>
          </>
        )}

        {/* End Call Button */}
        <div className="flex justify-center">
          <Button
            variant="destructive"
            size="lg"
            className={cn(
              "h-16 w-16 rounded-full shadow-lg",
              "bg-gradient-to-br from-red-500 to-red-600",
              "hover:from-red-600 hover:to-red-700",
              "transition-all duration-200 hover:scale-110 active:scale-95",
            )}
            onClick={() => endCall()}
            disabled={isEnding}
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-2">{isEnding ? "Ending..." : "End Call"}</p>
      </div>
    </div>
  )
}
