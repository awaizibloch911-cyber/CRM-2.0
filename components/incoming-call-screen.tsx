"use client"

import { useEffect, useState, useCallback } from "react"
import { Phone, PhoneOff, User, MessageSquare, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useCall } from "@/lib/call-context"
import { cn } from "@/lib/utils"
import { createPortal } from "react-dom"

export function IncomingCallScreen() {
  const { incomingCall, answerCall, declineCall } = useCall()
  const [isVisible, setIsVisible] = useState(false)
  const [ringCount, setRingCount] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    console.log("[v0] IncomingCallScreen - incomingCall state changed:", incomingCall)

    if (incomingCall) {
      console.log("[v0] IncomingCallScreen - DISPLAYING MODAL for call:", incomingCall.callSid)
      // Small delay for animation
      const timeout = setTimeout(() => setIsVisible(true), 50)
      return () => clearTimeout(timeout)
    } else {
      setIsVisible(false)
      setRingCount(0)
    }
  }, [incomingCall])

  useEffect(() => {
    if (incomingCall) {
      const interval = setInterval(() => {
        setRingCount((prev) => prev + 1)
      }, 2000)
      return () => clearInterval(interval)
    }
  }, [incomingCall])

  useEffect(() => {
    if (!incomingCall) return

    let audioContext: AudioContext | null = null
    let intervalId: NodeJS.Timeout | null = null

    const playRingtone = () => {
      try {
        audioContext = new (
          window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        )()

        const playTone = () => {
          if (!audioContext || audioContext.state === "closed") return

          const oscillator1 = audioContext.createOscillator()
          const oscillator2 = audioContext.createOscillator()
          const gainNode = audioContext.createGain()

          oscillator1.connect(gainNode)
          oscillator2.connect(gainNode)
          gainNode.connect(audioContext.destination)

          // Classic phone ring frequencies
          oscillator1.frequency.setValueAtTime(440, audioContext.currentTime)
          oscillator2.frequency.setValueAtTime(480, audioContext.currentTime)

          gainNode.gain.setValueAtTime(0.15, audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8)

          oscillator1.start(audioContext.currentTime)
          oscillator2.start(audioContext.currentTime)
          oscillator1.stop(audioContext.currentTime + 0.8)
          oscillator2.stop(audioContext.currentTime + 0.8)
        }

        playTone()
        intervalId = setInterval(playTone, 2000)
      } catch (e) {
        console.log("[v0] IncomingCallScreen - Audio not available:", e)
      }
    }

    playRingtone()

    return () => {
      if (intervalId) clearInterval(intervalId)
      if (audioContext && audioContext.state !== "closed") {
        audioContext.close()
      }
    }
  }, [incomingCall])

  const handleAnswer = useCallback(async () => {
    if (incomingCall?.callSid) {
      console.log("[v0] IncomingCallScreen - Answering call:", incomingCall.callSid)
      // Clear from polling API
      fetch("/api/twilio/incoming-calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callSid: incomingCall.callSid, action: "clear" }),
      }).catch(() => {})
    }
    answerCall()
  }, [incomingCall, answerCall])

  const handleDecline = useCallback(async () => {
    if (incomingCall?.callSid) {
      console.log("[v0] IncomingCallScreen - Declining call:", incomingCall.callSid)
      // Clear from polling API
      fetch("/api/twilio/incoming-calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callSid: incomingCall.callSid, action: "clear" }),
      }).catch(() => {})
    }
    declineCall()
  }, [incomingCall, declineCall])

  if (!incomingCall || !mounted) {
    return null
  }

  const callerName = incomingCall.callerName || incomingCall.from
  const callerInitials = callerName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const modalContent = (
    <div
      className={cn(
        "fixed inset-0 flex items-center justify-center",
        "bg-gradient-to-b from-background via-background to-background/95",
        "transition-all duration-300",
        isVisible ? "opacity-100" : "opacity-0",
      )}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        pointerEvents: "auto",
      }}
    >
      {/* Background animated rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <div
          className="absolute w-[500px] h-[500px] rounded-full border border-primary/10 animate-ping"
          style={{ animationDuration: "3s" }}
        />
        <div
          className="absolute w-[400px] h-[400px] rounded-full border border-primary/20 animate-ping"
          style={{ animationDuration: "2.5s", animationDelay: "0.5s" }}
        />
        <div
          className="absolute w-[300px] h-[300px] rounded-full border border-primary/30 animate-ping"
          style={{ animationDuration: "2s", animationDelay: "1s" }}
        />
      </div>

      <div
        className={cn(
          "relative flex flex-col items-center gap-8 p-8 max-w-sm w-full mx-4",
          "transform transition-all duration-500",
          isVisible ? "translate-y-0 scale-100" : "translate-y-8 scale-95",
        )}
      >
        {/* Caller Info */}
        <div className="text-center space-y-4">
          <p className="text-sm font-medium text-primary uppercase tracking-wider animate-pulse">Incoming Call</p>

          {/* Avatar with pulsing ring */}
          <div className="relative mx-auto">
            <div className="absolute -inset-4 rounded-full bg-primary/20 animate-pulse" />
            <div
              className="absolute -inset-2 rounded-full bg-primary/30 animate-pulse"
              style={{ animationDelay: "0.5s" }}
            />
            <Avatar className="h-32 w-32 relative border-4 border-primary shadow-2xl shadow-primary/20">
              <AvatarImage src={incomingCall.contact?.avatar || "/placeholder.svg"} />
              <AvatarFallback className="text-3xl font-bold bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
                {callerInitials || <User className="h-12 w-12" />}
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-foreground">{callerName}</h2>
            <p className="text-muted-foreground">{incomingCall.from}</p>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-2">
              <Phone className="h-3 w-3 animate-bounce" />
              Ringing... ({ringCount})
            </p>
          </div>
        </div>

        {/* Call Actions */}
        <div className="flex items-center justify-center gap-8 mt-8">
          {/* Decline Button */}
          <div className="flex flex-col items-center gap-2">
            <Button
              variant="destructive"
              size="lg"
              className={cn(
                "h-20 w-20 rounded-full shadow-lg",
                "bg-gradient-to-br from-red-500 to-red-600",
                "hover:from-red-600 hover:to-red-700",
                "transition-all duration-200 hover:scale-110 active:scale-95",
              )}
              onClick={handleDecline}
            >
              <PhoneOff className="h-8 w-8" />
            </Button>
            <span className="text-sm text-muted-foreground">Decline</span>
          </div>

          {/* Answer Button */}
          <div className="flex flex-col items-center gap-2">
            <Button
              size="lg"
              className={cn(
                "h-20 w-20 rounded-full shadow-lg",
                "bg-gradient-to-br from-green-500 to-green-600",
                "hover:from-green-600 hover:to-green-700",
                "text-white",
                "transition-all duration-200 hover:scale-110 active:scale-95",
              )}
              onClick={handleAnswer}
            >
              <Phone className="h-8 w-8" />
            </Button>
            <span className="text-sm text-muted-foreground">Answer</span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-4 mt-4">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 bg-transparent border-muted-foreground/30"
            onClick={handleDecline}
          >
            <Clock className="h-4 w-4" />
            Remind Me
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 bg-transparent border-muted-foreground/30"
            onClick={handleDecline}
          >
            <MessageSquare className="h-4 w-4" />
            Reply with Message
          </Button>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
