"use client"

import { useState, useEffect } from "react"
import { Mic, MicOff, PhoneOff, Volume2, VolumeX, Users, Circle, Pause, Play, UserPlus, Hash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import type { Contact } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useCRM } from "@/lib/crm-context"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface CallPanelProps {
  contact: Contact
}

const dialPadButtons = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"]

export function CallPanel({ contact }: CallPanelProps) {
  const { endCall, addMessageToConversation, selectedConversation, twilioConfig } = useCRM()
  const [isMuted, setIsMuted] = useState(false)
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isOnHold, setIsOnHold] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [showTransferDialog, setShowTransferDialog] = useState(false)
  const [showDialPad, setShowDialPad] = useState(false)
  const [dtmfInput, setDtmfInput] = useState("")
  const [transferParticipants, setTransferParticipants] = useState<string[]>([])

  useEffect(() => {
    if (!isOnHold) {
      const interval = setInterval(() => {
        setCallDuration((prev) => prev + 1)
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [isOnHold])

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const handleAddParticipant = (name: string) => {
    if (name && !transferParticipants.includes(name)) {
      setTransferParticipants([...transferParticipants, name])
    }
  }

  const handleDtmf = async (digit: string) => {
    setDtmfInput((prev) => prev + digit)
    if (twilioConfig) {
      try {
        await fetch("/api/twilio/dtmf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ digit, config: twilioConfig, baseUrl: window.location.origin }),
        })
      } catch (error) {
        console.error("Failed to send DTMF:", error)
      }
    }
  }

  const handleEndCall = () => {
    // Add call log to conversation
    if (selectedConversation) {
      addMessageToConversation(selectedConversation.id, {
        id: Date.now().toString(),
        content: `Call ended`,
        sender: "user",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        type: "call_log",
        duration: formatDuration(callDuration),
        callType: "outgoing",
      })

      // If recording was on, add recording message
      if (isRecording) {
        addMessageToConversation(selectedConversation.id, {
          id: (Date.now() + 1).toString(),
          content: "Call Recording",
          sender: "user",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          type: "call_recording",
          recordingUrl: "/placeholder-recording.mp3",
          duration: formatDuration(callDuration),
        })
      }
    }

    endCall()
  }

  const handleMute = async () => {
    setIsMuted(!isMuted)
    if (twilioConfig) {
      try {
        await fetch("/api/twilio/call-action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: isMuted ? "unmute" : "mute",
            config: twilioConfig,
            baseUrl: window.location.origin,
          }),
        })
      } catch (error) {
        console.error("Failed to toggle mute:", error)
      }
    }
  }

  const handleHold = async () => {
    setIsOnHold(!isOnHold)
    if (twilioConfig) {
      try {
        await fetch("/api/twilio/call-action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: isOnHold ? "unhold" : "hold",
            config: twilioConfig,
            baseUrl: window.location.origin,
          }),
        })
      } catch (error) {
        console.error("Failed to toggle hold:", error)
      }
    }
  }

  const handleRecord = async () => {
    setIsRecording(!isRecording)
    if (twilioConfig) {
      try {
        await fetch("/api/twilio/call-action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: isRecording ? "stopRecording" : "startRecording",
            config: twilioConfig,
            baseUrl: window.location.origin,
          }),
        })
      } catch (error) {
        console.error("Failed to toggle recording:", error)
      }
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background p-8">
      {/* Call Status */}
      <div className="text-center mb-8">
        <div className="relative inline-block mb-6">
          <Avatar className="h-32 w-32">
            <AvatarImage src={contact.avatar || "/placeholder.svg"} />
            <AvatarFallback className="text-3xl bg-muted">
              {contact.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </AvatarFallback>
          </Avatar>
          {isRecording && (
            <span className="absolute top-0 right-0 flex h-6 w-6 items-center justify-center">
              <span className="animate-ping absolute h-full w-full rounded-full bg-destructive/75" />
              <Circle className="h-4 w-4 fill-destructive text-destructive" />
            </span>
          )}
        </div>

        <h2 className="text-2xl font-semibold text-foreground mb-2">{contact.name}</h2>
        <p className="text-muted-foreground mb-2">{contact.phone}</p>

        <div className="flex items-center justify-center gap-2 text-lg">
          {isOnHold ? (
            <span className="text-yellow-500">On Hold</span>
          ) : (
            <>
              <span className="text-green-500">{formatDuration(callDuration)}</span>
              {isRecording && (
                <span className="text-destructive text-sm flex items-center gap-1">
                  <Circle className="h-2 w-2 fill-current animate-pulse" />
                  Recording
                </span>
              )}
            </>
          )}
        </div>

        {/* 3-Way Call Participants */}
        {transferParticipants.length > 0 && (
          <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Conference with:</span>
            {transferParticipants.map((name, index) => (
              <span key={index} className="text-sm text-primary bg-primary/10 px-2 py-1 rounded">
                {name}
              </span>
            ))}
          </div>
        )}

        {/* DTMF Input Display */}
        {showDialPad && dtmfInput && <div className="mt-4 text-2xl font-mono text-primary">{dtmfInput}</div>}
      </div>

      {/* In-Call Dial Pad */}
      {showDialPad && (
        <div className="grid grid-cols-3 gap-2 mb-8 max-w-xs">
          {dialPadButtons.map((digit) => (
            <Button
              key={digit}
              variant="outline"
              className="h-14 text-xl font-semibold bg-transparent"
              onClick={() => handleDtmf(digit)}
            >
              {digit}
            </Button>
          ))}
        </div>
      )}

      {/* Call Controls */}
      <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
        {/* Mute */}
        <Button
          variant={isMuted ? "destructive" : "secondary"}
          size="lg"
          className="h-16 w-16 rounded-full"
          onClick={handleMute}
        >
          {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </Button>

        {/* Speaker */}
        <Button
          variant={isSpeakerMuted ? "destructive" : "secondary"}
          size="lg"
          className="h-16 w-16 rounded-full"
          onClick={() => setIsSpeakerMuted(!isSpeakerMuted)}
        >
          {isSpeakerMuted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
        </Button>

        {/* Hold */}
        <Button
          variant={isOnHold ? "default" : "secondary"}
          size="lg"
          className="h-16 w-16 rounded-full"
          onClick={handleHold}
        >
          {isOnHold ? <Play className="h-6 w-6" /> : <Pause className="h-6 w-6" />}
        </Button>

        {/* Record */}
        <Button
          variant={isRecording ? "destructive" : "secondary"}
          size="lg"
          className="h-16 w-16 rounded-full"
          onClick={handleRecord}
        >
          <Circle className={cn("h-6 w-6", isRecording && "fill-current")} />
        </Button>

        {/* Dial Pad Toggle */}
        <Button
          variant={showDialPad ? "default" : "secondary"}
          size="lg"
          className="h-16 w-16 rounded-full"
          onClick={() => setShowDialPad(!showDialPad)}
        >
          <Hash className="h-6 w-6" />
        </Button>

        {/* 3-Way Transfer */}
        <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
          <DialogTrigger asChild>
            <Button variant="secondary" size="lg" className="h-16 w-16 rounded-full">
              <Users className="h-6 w-6" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>3-Way Call / Transfer</DialogTitle>
              <DialogDescription>Add another participant to this call or transfer to someone else.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter name or number..."
                  id="transfer-input"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleAddParticipant((e.target as HTMLInputElement).value)
                      ;(e.target as HTMLInputElement).value = ""
                    }
                  }}
                />
                <Button
                  onClick={() => {
                    const input = document.getElementById("transfer-input") as HTMLInputElement
                    handleAddParticipant(input.value)
                    input.value = ""
                  }}
                >
                  <UserPlus className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Quick Transfer:</p>
                {["Support Team", "Sales Team", "Manager"].map((name) => (
                  <Button
                    key={name}
                    variant="outline"
                    className="w-full justify-start bg-transparent"
                    onClick={() => {
                      handleAddParticipant(name)
                      setShowTransferDialog(false)
                    }}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    {name}
                  </Button>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* End Call */}
        <Button variant="destructive" size="lg" className="h-16 w-16 rounded-full" onClick={handleEndCall}>
          <PhoneOff className="h-6 w-6" />
        </Button>
      </div>

      {/* Control Labels */}
      <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
        <span>{isMuted ? "Unmute" : "Mute"}</span>
        <span>{isSpeakerMuted ? "Speaker On" : "Speaker Off"}</span>
        <span>{isOnHold ? "Resume" : "Hold"}</span>
        <span>{isRecording ? "Stop Rec" : "Record"}</span>
        <span>Keypad</span>
        <span>Transfer</span>
        <span>End Call</span>
      </div>
    </div>
  )
}
