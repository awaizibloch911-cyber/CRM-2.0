"use client"

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react"
import type { Contact } from "./types"
import { notificationService } from "./notifications"
import type { Device as TwilioDevice, Call as TwilioCall } from "@twilio/voice-sdk"

export type CallStatus =
  | "idle"
  | "initiating"
  | "ringing"
  | "connecting"
  | "in-progress"
  | "on-hold"
  | "ended"
  | "failed"
  | "busy"
  | "no-answer"

export type CallDirection = "outgoing" | "incoming"

export interface CallError {
  code: string
  message: string
  timestamp: Date
}

export interface ActiveCall {
  id: string
  callSid?: string
  contact: Contact
  direction: CallDirection
  status: CallStatus
  startTime: Date
  connectedTime?: Date
  endTime?: Date
  duration: number
  isMuted: boolean
  isSpeakerOn: boolean
  isRecording: boolean
  isOnHold: boolean
  error?: CallError
}

export interface IncomingCallData {
  callSid: string
  from: string
  to: string
  callerName?: string
  contact?: Contact
  fromDevice?: boolean
}

interface CallContextType {
  activeCall: ActiveCall | null
  incomingCall: IncomingCallData | null
  initiateCall: (contact: Contact) => Promise<void>
  answerCall: () => Promise<void>
  declineCall: () => void
  endCall: () => Promise<void>
  toggleMute: () => Promise<void>
  toggleSpeaker: () => void
  toggleHold: () => Promise<void>
  toggleRecording: () => Promise<void>
  sendDTMF: (digit: string) => Promise<void>
  handleIncomingCall: (data: IncomingCallData) => void
  dismissIncomingCall: () => void
  updateCallStatus: (callSid: string, status: string) => void
  isCallActive: boolean
  hasIncomingCall: boolean
  callDuration: number
  twilioConfig: { accountSid: string; authToken: string; phoneNumber: string } | null
  setTwilioConfig: (config: { accountSid: string; authToken: string; phoneNumber: string } | null) => void
  deviceReady: boolean
}

const CallContext = createContext<CallContextType | null>(null)

export function CallProvider({ children }: { children: ReactNode }) {
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null)
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null)
  const [twilioConfig, setTwilioConfigState] = useState<{
    accountSid: string
    authToken: string
    phoneNumber: string
  } | null>(null)
  const [deviceReady, setDeviceReady] = useState(false)

  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const callbackUrlRef = useRef<string>("")
  const deviceRef = useRef<TwilioDevice | null>(null)
  const currentCallRef = useRef<TwilioCall | null>(null)

  useEffect(() => {
    if (typeof window !== "undefined") {
      callbackUrlRef.current = window.location.origin
      console.log("[v0] CallContext - Set callbackUrlRef to:", callbackUrlRef.current)
    }
  }, [])

  const setTwilioConfig = useCallback(
    async (config: { accountSid: string; authToken: string; phoneNumber: string } | null) => {
      setTwilioConfigState(config)

      if (deviceRef.current) {
        try {
          deviceRef.current.destroy()
        } catch (e) {
          console.warn("Error destroying device:", e)
        }
        deviceRef.current = null
        setDeviceReady(false)
      }

      if (!config) return

      try {
        console.log("[v0] Fetching access token...")
        const response = await fetch("/api/twilio/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config, identity: "crm-user" }),
        })

        if (!response.ok) {
          const error = await response.json()
          console.error("[v0] Failed to get token:", error)
          return
        }

        const { token } = await response.json()
        console.log("[v0] Got access token, initializing device...")

        if (typeof window === "undefined" || !window.AudioContext) {
          console.log("[v0] Browser audio APIs not fully available, skipping Device initialization")
          console.log("[v0] Will rely on polling for incoming call detection")
          return
        }

        try {
          const voiceSdk = await import("@twilio/voice-sdk")

          if (!voiceSdk || !voiceSdk.Device) {
            console.log("[v0] Twilio Voice SDK Device not available")
            console.log("[v0] Will rely on polling for incoming call detection")
            return
          }

          const Device = voiceSdk.Device

          if (typeof Device !== "function") {
            console.log("[v0] Twilio Device is not a constructor")
            console.log("[v0] Will rely on polling for incoming call detection")
            return
          }

          let device: TwilioDevice
          try {
            device = new Device(token, {
              logLevel: 1,
              edge: "ashburn",
            })
          } catch (constructorError) {
            console.log("[v0] Failed to construct Twilio Device:", constructorError)
            console.log("[v0] Will rely on polling for incoming call detection")
            return
          }

          device.on("registered", () => {
            console.log("[v0] Twilio Device registered and ready")
            setDeviceReady(true)
          })

          device.on("unregistered", () => {
            console.log("[v0] Twilio Device unregistered")
            setDeviceReady(false)
          })

          device.on("error", (error: { message?: string; code?: string }) => {
            console.error("[v0] Twilio Device error:", error.message || error)
          })

          device.on("incoming", (call: TwilioCall) => {
            console.log("[v0] Incoming call via Device from:", call.parameters.From)
            console.log("[v0] Device incoming CallSid:", call.parameters.CallSid)
            currentCallRef.current = call
            setIncomingCall({
              callSid: call.parameters.CallSid || "",
              from: call.parameters.From || "Unknown",
              to: call.parameters.To || "",
              fromDevice: true,
            })
          })

          await device.register()
          deviceRef.current = device
          console.log("[v0] Device registered successfully")
        } catch (sdkError) {
          console.log("[v0] Twilio Voice SDK not compatible with this environment:", sdkError)
          console.log("[v0] Will rely on polling for incoming call detection")
        }
      } catch (error) {
        console.error("[v0] Failed to initialize Twilio Device:", error)
        console.log("[v0] Will rely on polling for incoming call detection")
      }
    },
    [],
  )

  const initiateCall = useCallback(
    async (contact: Contact) => {
      const callId = `call_${Date.now()}`

      const newCall: ActiveCall = {
        id: callId,
        contact,
        direction: "outgoing",
        status: "initiating",
        startTime: new Date(),
        duration: 0,
        isMuted: false,
        isSpeakerOn: true,
        isRecording: false,
        isOnHold: false,
      }

      setActiveCall(newCall)

      if (deviceRef.current && deviceReady) {
        try {
          console.log("[v0] Making call via Twilio Device to:", contact.phone)

          const call = await deviceRef.current.connect({
            params: {
              To: contact.phone,
              CallerId: twilioConfig?.phoneNumber || "",
            },
          })

          currentCallRef.current = call

          call.on("ringing", () => {
            console.log("[v0] Ringing...")
            setActiveCall((prev) => (prev?.id === callId ? { ...prev, status: "ringing" } : prev))
          })

          call.on("accept", () => {
            console.log("[v0] Call accepted/connected")
            setActiveCall((prev) =>
              prev?.id === callId
                ? {
                    ...prev,
                    status: "in-progress",
                    connectedTime: new Date(),
                    callSid: call.parameters.CallSid,
                  }
                : prev,
            )
          })

          call.on("disconnect", () => {
            console.log("[v0] Call disconnected")
            currentCallRef.current = null
            setActiveCall((prev) => (prev?.id === callId ? { ...prev, status: "ended", endTime: new Date() } : prev))
            setTimeout(() => setActiveCall(null), 1500)
          })

          call.on("error", (error: { message?: string }) => {
            console.error("[v0] Call error:", error)
            setActiveCall((prev) =>
              prev?.id === callId
                ? {
                    ...prev,
                    status: "failed",
                    error: {
                      code: "CALL_ERROR",
                      message: error.message || String(error),
                      timestamp: new Date(),
                    },
                  }
                : prev,
            )
          })

          call.on("reject", () => {
            console.log("[v0] Call rejected")
            setActiveCall((prev) => (prev?.id === callId ? { ...prev, status: "busy" } : prev))
          })

          call.on("cancel", () => {
            console.log("[v0] Call cancelled")
            setActiveCall((prev) => (prev?.id === callId ? { ...prev, status: "ended", endTime: new Date() } : prev))
          })
        } catch (error) {
          console.error("[v0] Error initiating call:", error)
          setActiveCall((prev) =>
            prev?.id === callId
              ? {
                  ...prev,
                  status: "failed",
                  error: {
                    code: "DEVICE_ERROR",
                    message: "Failed to connect call. Please check your microphone permissions.",
                    timestamp: new Date(),
                  },
                }
              : prev,
          )
        }
        return
      }

      // Demo mode fallback if device not ready
      console.log("[v0] Device not ready, using demo mode")
      setTimeout(() => {
        setActiveCall((prev) => (prev?.id === callId ? { ...prev, status: "ringing" } : prev))
      }, 500)

      setTimeout(() => {
        setActiveCall((prev) =>
          prev?.id === callId ? { ...prev, status: "in-progress", connectedTime: new Date() } : prev,
        )
      }, 3000)
    },
    [twilioConfig, deviceReady],
  )

  const handleIncomingCall = useCallback((data: IncomingCallData) => {
    console.log("[v0] CallContext - handleIncomingCall called with:", data)
    console.log("[v0] CallContext - Setting incomingCall state NOW")

    setIncomingCall(data)

    console.log("[v0] CallContext - incomingCall state should now be set")

    notificationService.showIncomingCall(data.callerName || data.from, () => {
      window.focus()
    })
  }, [])

  const answerCall = useCallback(async () => {
    if (!incomingCall) return

    console.log("[v0] Answering call:", incomingCall.callSid)
    console.log("[v0] Call fromDevice:", incomingCall.fromDevice)
    console.log("[v0] currentCallRef.current exists:", !!currentCallRef.current)

    const callId = `call_${Date.now()}`
    const contact: Contact = incomingCall.contact || {
      id: callId,
      name: incomingCall.callerName || incomingCall.from,
      phone: incomingCall.from,
      email: "",
      company: "",
      role: "",
      location: "",
      status: "Unknown",
      online: true,
      tags: [],
      recentActivity: [],
    }

    const newCall: ActiveCall = {
      id: callId,
      callSid: incomingCall.callSid,
      contact,
      direction: "incoming",
      status: "connecting",
      startTime: new Date(),
      duration: 0,
      isMuted: false,
      isSpeakerOn: true,
      isRecording: false,
      isOnHold: false,
    }

    setActiveCall(newCall)
    const savedCallSid = incomingCall.callSid
    const wasFromDevice = incomingCall.fromDevice
    setIncomingCall(null)

    if (currentCallRef.current && wasFromDevice) {
      try {
        console.log("[v0] Answering via Twilio Device (fromDevice=true)")
        currentCallRef.current.accept()

        currentCallRef.current.on("accept", () => {
          console.log("[v0] Device call accepted")
          setActiveCall((prev) =>
            prev?.id === callId ? { ...prev, status: "in-progress", connectedTime: new Date() } : prev,
          )
        })

        currentCallRef.current.on("disconnect", () => {
          console.log("[v0] Device call disconnected")
          currentCallRef.current = null
          setActiveCall((prev) => (prev?.id === callId ? { ...prev, status: "ended", endTime: new Date() } : prev))
          setTimeout(() => setActiveCall(null), 1500)
        })

        return // Don't fall through to API answer
      } catch (error) {
        console.error("[v0] Failed to answer via device:", error)
      }
    }

    if (twilioConfig && savedCallSid && !wasFromDevice) {
      try {
        console.log("[v0] Answering via API (fromDevice=false)")
        const response = await fetch("/api/twilio/call-action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "answer",
            callSid: savedCallSid,
            config: twilioConfig,
            baseUrl: callbackUrlRef.current,
          }),
        })

        if (response.ok) {
          console.log("[v0] Call answered via API successfully")
        }
      } catch (error) {
        console.error("[v0] Failed to answer via API:", error)
      }
    }

    setTimeout(() => {
      setActiveCall((prev) =>
        prev?.id === callId ? { ...prev, status: "in-progress", connectedTime: new Date() } : prev,
      )
    }, 500)
  }, [incomingCall, twilioConfig])

  const declineCall = useCallback(() => {
    if (!incomingCall) return

    console.log("[v0] Declining call:", incomingCall.callSid)

    if (currentCallRef.current) {
      currentCallRef.current.reject()
      currentCallRef.current = null
    } else if (incomingCall.callSid && twilioConfig) {
      fetch("/api/twilio/call-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject",
          callSid: incomingCall.callSid,
          config: twilioConfig,
          baseUrl: callbackUrlRef.current,
        }),
      }).catch(console.error)
    }

    setIncomingCall(null)
  }, [incomingCall, twilioConfig])

  const dismissIncomingCall = useCallback(() => {
    setIncomingCall(null)
  }, [])

  const endCall = useCallback(async () => {
    if (!activeCall) return

    console.log("[v0] Ending call:", activeCall.callSid)

    if (currentCallRef.current) {
      currentCallRef.current.disconnect()
      currentCallRef.current = null
    } else if (activeCall.callSid && twilioConfig) {
      try {
        await fetch("/api/twilio/call-action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "end",
            callSid: activeCall.callSid,
            config: twilioConfig,
            baseUrl: callbackUrlRef.current,
          }),
        })
      } catch (error) {
        console.error("[v0] Failed to end call:", error)
      }
    }

    setActiveCall((prev) => (prev ? { ...prev, status: "ended", endTime: new Date() } : null))

    setTimeout(() => {
      setActiveCall(null)
    }, 1500)
  }, [activeCall, twilioConfig])

  const toggleMute = useCallback(async () => {
    if (!activeCall) return

    const newMuted = !activeCall.isMuted
    setActiveCall((prev) => (prev ? { ...prev, isMuted: newMuted } : null))

    if (currentCallRef.current) {
      currentCallRef.current.mute(newMuted)
    } else if (activeCall.callSid && twilioConfig) {
      try {
        await fetch("/api/twilio/call-action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: newMuted ? "mute" : "unmute",
            callSid: activeCall.callSid,
            config: twilioConfig,
            baseUrl: callbackUrlRef.current,
          }),
        })
      } catch (error) {
        console.error("[v0] Failed to toggle mute:", error)
      }
    }
  }, [activeCall, twilioConfig])

  const toggleSpeaker = useCallback(() => {
    setActiveCall((prev) => (prev ? { ...prev, isSpeakerOn: !prev.isSpeakerOn } : null))
  }, [])

  const toggleHold = useCallback(async () => {
    if (!activeCall) return

    const newHold = !activeCall.isOnHold
    setActiveCall((prev) =>
      prev
        ? {
            ...prev,
            isOnHold: newHold,
            status: newHold ? "on-hold" : "in-progress",
          }
        : null,
    )

    if (activeCall.callSid && twilioConfig) {
      try {
        await fetch("/api/twilio/call-action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: newHold ? "hold" : "unhold",
            callSid: activeCall.callSid,
            config: twilioConfig,
            baseUrl: callbackUrlRef.current,
          }),
        })
      } catch (error) {
        console.error("[v0] Failed to toggle hold:", error)
      }
    }
  }, [activeCall, twilioConfig])

  const toggleRecording = useCallback(async () => {
    if (!activeCall) return

    const newRecording = !activeCall.isRecording
    setActiveCall((prev) => (prev ? { ...prev, isRecording: newRecording } : null))

    if (activeCall.callSid && twilioConfig) {
      try {
        await fetch("/api/twilio/call-action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: newRecording ? "startRecording" : "stopRecording",
            callSid: activeCall.callSid,
            config: twilioConfig,
            baseUrl: callbackUrlRef.current,
          }),
        })
      } catch (error) {
        console.error("[v0] Failed to toggle recording:", error)
      }
    }
  }, [activeCall, twilioConfig])

  const sendDTMF = useCallback(
    async (digit: string) => {
      if (currentCallRef.current) {
        currentCallRef.current.sendDigits(digit)
      } else if (activeCall?.callSid && twilioConfig) {
        try {
          await fetch("/api/twilio/dtmf", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              digit,
              callSid: activeCall.callSid,
              config: twilioConfig,
            }),
          })
        } catch (error) {
          console.error("[v0] Failed to send DTMF:", error)
        }
      }

      // Play local DTMF tone
      try {
        const audioContext = new (
          window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        )()
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)

        const dtmfFreqs: Record<string, [number, number]> = {
          "1": [697, 1209],
          "2": [697, 1336],
          "3": [697, 1477],
          "4": [770, 1209],
          "5": [770, 1336],
          "6": [770, 1477],
          "7": [852, 1209],
          "8": [852, 1336],
          "9": [852, 1477],
          "*": [941, 1209],
          "0": [941, 1336],
          "#": [941, 1477],
        }

        const [low] = dtmfFreqs[digit] || [440, 480]
        oscillator.frequency.setValueAtTime(low, audioContext.currentTime)

        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15)

        oscillator.start(audioContext.currentTime)
        oscillator.stop(audioContext.currentTime + 0.15)
      } catch {
        // Ignore audio errors
      }
    },
    [activeCall, twilioConfig],
  )

  useEffect(() => {
    if (activeCall?.status === "in-progress" && !activeCall.isOnHold) {
      durationIntervalRef.current = setInterval(() => {
        setActiveCall((prev) => {
          if (!prev) return null
          return { ...prev, duration: prev.duration + 1 }
        })
      }, 1000)
    } else {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
        durationIntervalRef.current = null
      }
    }

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
      }
    }
  }, [activeCall?.status, activeCall?.isOnHold])

  useEffect(() => {
    if (incomingCall) {
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

            oscillator1.frequency.setValueAtTime(440, audioContext.currentTime)
            oscillator2.frequency.setValueAtTime(480, audioContext.currentTime)

            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)

            oscillator1.start(audioContext.currentTime)
            oscillator2.start(audioContext.currentTime)
            oscillator1.stop(audioContext.currentTime + 0.5)
            oscillator2.stop(audioContext.currentTime + 0.5)
          }

          playTone()
          intervalId = setInterval(playTone, 2000)
        } catch {
          // Ignore audio errors
        }
      }

      playRingtone()

      return () => {
        if (intervalId) clearInterval(intervalId)
        if (audioContext && audioContext.state !== "closed") {
          audioContext.close()
        }
      }
    }
  }, [incomingCall])

  const updateCallStatus = useCallback((callSid: string, status: string) => {
    console.log("[v0] Updating call status:", callSid, status)

    const statusMap: Record<string, CallStatus> = {
      queued: "initiating",
      ringing: "ringing",
      "in-progress": "in-progress",
      completed: "ended",
      busy: "busy",
      failed: "failed",
      "no-answer": "no-answer",
      canceled: "ended",
    }

    const newStatus = statusMap[status] || "idle"

    setActiveCall((prev) => {
      if (!prev || prev.callSid !== callSid) return prev

      const updates: Partial<ActiveCall> = { status: newStatus }

      if (newStatus === "in-progress" && !prev.connectedTime) {
        updates.connectedTime = new Date()
      }

      if (["ended", "busy", "failed", "no-answer"].includes(newStatus)) {
        updates.endTime = new Date()
        setTimeout(() => setActiveCall(null), 2000)
      }

      return { ...prev, ...updates }
    })
  }, [])

  const isCallActive = activeCall !== null && !["ended", "failed"].includes(activeCall.status)
  const hasIncomingCall = incomingCall !== null
  const callDuration = activeCall?.duration || 0

  return (
    <CallContext.Provider
      value={{
        activeCall,
        incomingCall,
        initiateCall,
        answerCall,
        declineCall,
        endCall,
        toggleMute,
        toggleSpeaker,
        toggleHold,
        toggleRecording,
        sendDTMF,
        handleIncomingCall,
        dismissIncomingCall,
        updateCallStatus,
        isCallActive,
        hasIncomingCall,
        callDuration,
        twilioConfig,
        setTwilioConfig,
        deviceReady,
      }}
    >
      {children}
    </CallContext.Provider>
  )
}

export function useCall() {
  const context = useContext(CallContext)
  if (!context) {
    throw new Error("useCall must be used within a CallProvider")
  }
  return context
}
