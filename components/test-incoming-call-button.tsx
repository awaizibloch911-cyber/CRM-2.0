"use client"

import { Phone } from "lucide-react"
import { Button } from "@/components/ui/button"

export function TestIncomingCallButton() {
  const triggerTestCall = () => {
    console.log("[v0] TestIncomingCallButton - Triggering test incoming call")

    // Generate a test call ID
    const testCallSid = `TEST_${Date.now()}`
    const testFrom = "+1 (555) 123-4567"
    const testTo = process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER || "+1 (555) 000-0000"

    // Dispatch custom event that CallNotificationHandler listens to
    const event = new CustomEvent("crm-incoming-call", {
      detail: {
        callSid: testCallSid,
        from: testFrom,
        to: testTo,
      },
    })

    console.log("[v0] TestIncomingCallButton - Dispatching event:", event.detail)
    window.dispatchEvent(event)

    // Also try BroadcastChannel for cross-tab
    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel("crm-incoming-calls")
      channel.postMessage({
        type: "incoming-call",
        callSid: testCallSid,
        from: testFrom,
        to: testTo,
      })
      channel.close()
    }
  }

  return (
    <Button
      onClick={triggerTestCall}
      variant="outline"
      size="sm"
      className="gap-2 bg-green-500/10 border-green-500/30 text-green-600 hover:bg-green-500/20"
    >
      <Phone className="h-4 w-4" />
      Test Incoming Call
    </Button>
  )
}
