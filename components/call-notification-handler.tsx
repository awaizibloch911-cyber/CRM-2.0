"use client"

import { useEffect, useRef, useCallback } from "react"
import { useCall } from "@/lib/call-context"
import { useCRM } from "@/lib/crm-context"

export function CallNotificationHandler() {
  const { handleIncomingCall, activeCall, updateCallStatus, hasIncomingCall, deviceReady } = useCall()
  const { contacts, conversations, twilioConfig, isTwilioConfigured } = useCRM()
  const processedCallsRef = useRef<Set<string>>(new Set())
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const activeCallsPollingRef = useRef<NodeJS.Timeout | null>(null)
  const contactsRef = useRef(contacts)
  const conversationsRef = useRef(conversations)
  const activeCallRef = useRef(activeCall)
  const hasIncomingCallRef = useRef(hasIncomingCall)
  const handleIncomingCallRef = useRef(handleIncomingCall)
  const updateCallStatusRef = useRef(updateCallStatus)
  const twilioConfigRef = useRef(twilioConfig)
  const isTwilioConfiguredRef = useRef(isTwilioConfigured)
  const deviceReadyRef = useRef(deviceReady)

  useEffect(() => {
    contactsRef.current = contacts
  }, [contacts])

  useEffect(() => {
    conversationsRef.current = conversations
  }, [conversations])

  useEffect(() => {
    activeCallRef.current = activeCall
  }, [activeCall])

  useEffect(() => {
    hasIncomingCallRef.current = hasIncomingCall
  }, [hasIncomingCall])

  useEffect(() => {
    handleIncomingCallRef.current = handleIncomingCall
  }, [handleIncomingCall])

  useEffect(() => {
    updateCallStatusRef.current = updateCallStatus
  }, [updateCallStatus])

  useEffect(() => {
    twilioConfigRef.current = twilioConfig
  }, [twilioConfig])

  useEffect(() => {
    isTwilioConfiguredRef.current = isTwilioConfigured
  }, [isTwilioConfigured])

  useEffect(() => {
    deviceReadyRef.current = deviceReady
  }, [deviceReady])

  const processIncomingCall = useCallback((callSid: string, callerNumber: string, toNumber: string) => {
    console.log("[v0] CallNotificationHandler - processIncomingCall called")
    console.log("[v0] CallNotificationHandler - callSid:", callSid)
    console.log("[v0] CallNotificationHandler - callerNumber:", callerNumber)
    console.log("[v0] CallNotificationHandler - deviceReady:", deviceReadyRef.current)
    console.log("[v0] CallNotificationHandler - hasIncomingCall:", hasIncomingCallRef.current)
    console.log("[v0] CallNotificationHandler - activeCall:", activeCallRef.current?.callSid)

    if (processedCallsRef.current.has(callSid)) {
      console.log("[v0] CallNotificationHandler - Already processed call:", callSid)
      return
    }

    if (activeCallRef.current) {
      console.log("[v0] CallNotificationHandler - Ignoring, already have active call in progress")
      return
    }

    processedCallsRef.current.add(callSid)

    const normalizedFrom = callerNumber?.replace(/\D/g, "") || ""

    const contact = contactsRef.current.find((c) => c.phone.replace(/\D/g, "") === normalizedFrom)

    let callerName = contact?.name
    if (!callerName) {
      const conv = conversationsRef.current.find((c) => c.phone.replace(/\D/g, "") === normalizedFrom)
      callerName = conv?.name
    }

    console.log("[v0] ========================================")
    console.log("[v0] TRIGGERING INCOMING CALL SCREEN NOW (via polling)")
    console.log("[v0] CallSid:", callSid)
    console.log("[v0] From:", callerNumber)
    console.log("[v0] Caller Name:", callerName || "Unknown")
    console.log("[v0] ========================================")

    handleIncomingCallRef.current({
      callSid: callSid,
      from: callerNumber,
      to: toNumber,
      callerName: callerName || callerNumber,
      contact: contact,
      fromDevice: false,
    })
  }, [])

  useEffect(() => {
    const pollActiveCalls = async () => {
      if (!isTwilioConfiguredRef.current || !twilioConfigRef.current) {
        console.log("[v0] CallNotificationHandler - Skipping poll, Twilio not configured")
        return
      }

      try {
        console.log("[v0] CallNotificationHandler - Polling for active calls...")
        const response = await fetch("/api/twilio/active-calls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config: twilioConfigRef.current }),
        })

        if (response.ok) {
          const data = await response.json()
          console.log("[v0] CallNotificationHandler - Active calls response:", JSON.stringify(data))

          if (data.activeCalls && data.activeCalls.length > 0) {
            for (const call of data.activeCalls) {
              if (!processedCallsRef.current.has(call.callSid)) {
                console.log("[v0] CallNotificationHandler - Found active incoming call from Twilio API:", call)
                processIncomingCall(call.callSid, call.from, call.to)
              }
            }
          }
        } else {
          console.log("[v0] CallNotificationHandler - Active calls response not ok:", response.status)
        }
      } catch (error) {
        console.log("[v0] CallNotificationHandler - Polling error:", error)
      }
    }

    console.log("[v0] CallNotificationHandler - Starting Twilio API polling for active calls...")
    pollActiveCalls()
    activeCallsPollingRef.current = setInterval(pollActiveCalls, 2000)

    return () => {
      if (activeCallsPollingRef.current) {
        clearInterval(activeCallsPollingRef.current)
      }
    }
  }, [processIncomingCall])

  useEffect(() => {
    const pollForCalls = async () => {
      try {
        const response = await fetch("/api/twilio/incoming-calls")
        if (response.ok) {
          const data = await response.json()

          if (data.calls && data.calls.length > 0) {
            const call = data.calls[0]
            console.log("[v0] CallNotificationHandler - Backup polling found pending call:", call)
            processIncomingCall(call.callSid, call.from, call.to)
          }
        }
      } catch (error) {
        // Silently fail polling errors
      }
    }

    pollingIntervalRef.current = setInterval(pollForCalls, 2000)

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [processIncomingCall])

  useEffect(() => {
    const interval = setInterval(() => {
      processedCallsRef.current.clear()
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  return null
}
