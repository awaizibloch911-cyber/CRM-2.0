import { type NextRequest, NextResponse } from "next/server"
import { eventEmitter } from "@/lib/realtime-events"
import type { InboxEvent } from "@/lib/realtime-events"
import { addIncomingCall, removeIncomingCall } from "@/lib/incoming-call-store"

function formatTimePKT(date: Date): string {
  return date.toLocaleTimeString("en-PK", {
    timeZone: "Asia/Karachi",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

function getISOTimestampPKT(): string {
  return new Date().toISOString()
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const contentType = req.headers.get("content-type") || ""
    let data: Record<string, string>

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData()
      data = Object.fromEntries(formData.entries()) as Record<string, string>
    } else {
      data = await req.json()
    }

    console.log("[Webhook] Received Twilio event:", JSON.stringify(data, null, 2))

    // Handle incoming SMS
    if (data.MessageSid && data.Body !== undefined) {
      const now = new Date()
      const event: InboxEvent = {
        type: "message",
        id: data.MessageSid,
        from: data.From,
        to: data.To,
        body: data.Body,
        timestamp: getISOTimestampPKT(),
        displayTime: formatTimePKT(now),
        direction: "inbound",
        status: data.MessageStatus || "received",
      }

      eventEmitter.emit("inbox-update", event)

      return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { "Content-Type": "application/xml" },
      })
    }

    const callSid = data.CallSid
    const callStatus = data.CallStatus || ""
    const direction = data.Direction || ""

    // Incoming call detection
    const isIncomingCall =
      callSid &&
      (direction === "inbound" || direction === "" || direction.includes("inbound")) &&
      (!callStatus || callStatus === "ringing" || callStatus === "queued" || callStatus === "initiated")

    if (isIncomingCall) {
      const fromNumber = data.From || data.Caller || ""
      const toNumber = data.To || data.Called || ""

      console.log("[Webhook] *** INCOMING CALL DETECTED ***")
      console.log("[Webhook] CallSid:", callSid)
      console.log("[Webhook] From:", fromNumber)
      console.log("[Webhook] To:", toNumber)

      addIncomingCall(callSid, fromNumber, toNumber)

      const now = new Date()
      const event: InboxEvent = {
        type: "call",
        id: callSid,
        from: fromNumber,
        to: toNumber,
        status: "ringing",
        direction: "inbound",
        timestamp: getISOTimestampPKT(),
        displayTime: formatTimePKT(now),
      }

      eventEmitter.emit("inbox-update", event)

      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Please hold while we connect you.</Say>
  <Pause length="30"/>
  <Say voice="alice">We are sorry, no one is available to take your call. Please try again later.</Say>
  <Hangup/>
</Response>`,
        { headers: { "Content-Type": "application/xml" } },
      )
    }

    // Handle call status updates
    if (callSid && callStatus) {
      const now = new Date()
      const callDirection = direction.includes("inbound") ? "inbound" : "outbound"

      console.log("[Webhook] Call status update - SID:", callSid, "Status:", callStatus)

      if (["completed", "busy", "no-answer", "canceled", "failed"].includes(callStatus)) {
        removeIncomingCall(callSid)
      }

      const event: InboxEvent = {
        type: "call",
        id: callSid,
        from: data.From || data.Caller,
        to: data.To || data.Called,
        status: callStatus,
        direction: callDirection,
        timestamp: getISOTimestampPKT(),
        displayTime: formatTimePKT(now),
        duration: data.CallDuration,
        recordingUrl: data.RecordingUrl,
      }

      const significantStatuses = [
        "queued",
        "initiated",
        "ringing",
        "in-progress",
        "completed",
        "busy",
        "no-answer",
        "canceled",
        "failed",
      ]
      if (significantStatuses.includes(callStatus)) {
        eventEmitter.emit("inbox-update", event)
      }

      return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { "Content-Type": "application/xml" },
      })
    }

    // Handle recording completion
    if (data.RecordingSid && data.RecordingUrl) {
      const now = new Date()
      const event: InboxEvent = {
        type: "recording",
        id: data.RecordingSid,
        callSid: data.CallSid,
        recordingUrl: data.RecordingUrl,
        duration: data.RecordingDuration,
        timestamp: getISOTimestampPKT(),
        displayTime: formatTimePKT(now),
      }

      eventEmitter.emit("inbox-update", event)

      return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { "Content-Type": "application/xml" },
      })
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("[Webhook] Error processing webhook:", error)
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ status: "Webhook endpoint active" })
}
