import { type NextRequest, NextResponse } from "next/server"
import type { Conversation, Message } from "@/lib/types"

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function formatDateTimePKT(date: Date): string {
  return date.toLocaleString("en-PK", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  for (let i = 0; i < maxRetries; i++) {
    const res = await fetch(url, options)
    if (res.status === 429) {
      // Rate limited - wait and retry
      const retryAfter = res.headers.get("Retry-After")
      const waitTime = retryAfter ? Number.parseInt(retryAfter) * 1000 : (i + 1) * 2000
      await delay(waitTime)
      continue
    }
    return res
  }
  // Return last attempt
  return fetch(url, options)
}

export async function POST(req: NextRequest) {
  try {
    const { config } = await req.json()

    if (!config?.accountSid || !config?.authToken || !config?.phoneNumber) {
      return NextResponse.json({ error: "Twilio not configured" }, { status: 400 })
    }

    const authHeader = `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`
    const twilioPhoneNormalized = config.phoneNumber.replace(/\D/g, "")

    const [sentMessagesRes, receivedMessagesRes, callsRes] = await Promise.all([
      fetchWithRetry(
        `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json?From=${encodeURIComponent(config.phoneNumber)}&PageSize=200`,
        { headers: { Authorization: authHeader } },
      ),
      fetchWithRetry(
        `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json?To=${encodeURIComponent(config.phoneNumber)}&PageSize=200`,
        { headers: { Authorization: authHeader } },
      ),
      fetchWithRetry(`https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Calls.json?PageSize=200`, {
        headers: { Authorization: authHeader },
      }),
    ])

    if (sentMessagesRes.status === 429 || receivedMessagesRes.status === 429 || callsRes.status === 429) {
      return NextResponse.json({ error: "Rate limited by Twilio. Please try again in a few seconds." }, { status: 429 })
    }

    const [sentMessagesData, receivedMessagesData, callsData] = await Promise.all([
      sentMessagesRes.json(),
      receivedMessagesRes.json(),
      callsRes.json(),
    ])

    const allMessages = [
      ...(sentMessagesData.messages || []).map((m: any) => ({ ...m, direction: "outbound" })),
      ...(receivedMessagesData.messages || []).map((m: any) => ({ ...m, direction: "inbound" })),
    ]

    const conversationMap = new Map<
      string,
      {
        messages: Message[]
        lastTime: Date
        name: string
        hasCall: boolean
        callStatus?: "incoming" | "outgoing" | "missed"
        callDuration?: string
      }
    >()

    for (const msg of allMessages) {
      const isOutgoing = msg.direction === "outbound" || msg.direction === "outbound-api"
      const msgFromNumber = msg.from.replace(/\D/g, "")
      const msgToNumber = msg.to.replace(/\D/g, "")
      const otherParty = isOutgoing ? msg.to : msg.from
      const otherPartyNormalized = otherParty.replace(/\D/g, "")

      // Only include messages where the registered phone number is one of the parties
      const isMsgForThisNumber = msgFromNumber === twilioPhoneNormalized || msgToNumber === twilioPhoneNormalized

      if (!isMsgForThisNumber) continue

      // Skip self-messages
      if (otherPartyNormalized === twilioPhoneNormalized) continue

      if (!conversationMap.has(otherParty)) {
        conversationMap.set(otherParty, {
          messages: [],
          lastTime: new Date(0),
          name: otherParty,
          hasCall: false,
        })
      }

      const conv = conversationMap.get(otherParty)!
      const msgDate = new Date(msg.date_created)

      conv.messages.push({
        id: msg.sid,
        content: msg.body || "",
        sender: isOutgoing ? "user" : "contact",
        timestamp: msgDate.toISOString(),
        type: "text",
        isRead: isOutgoing,
      })

      if (msgDate > conv.lastTime) {
        conv.lastTime = msgDate
      }
    }

    const callsWithRecordings: { call: any; conv: any; callDate: Date; duration: string }[] = []

    if (callsData.calls) {
      for (const call of callsData.calls) {
        const isOutgoing = call.direction === "outbound-api" || call.direction === "outbound"
        const callFromNumber = call.from.replace(/\D/g, "")
        const callToNumber = call.to.replace(/\D/g, "")
        const otherParty = isOutgoing ? call.to : call.from
        const otherPartyNormalized = otherParty.replace(/\D/g, "")

        // Skip client device calls
        if (otherParty.startsWith("client:")) continue

        // Only include calls where the registered phone number is one of the parties
        const isCallForThisNumber = callFromNumber === twilioPhoneNormalized || callToNumber === twilioPhoneNormalized

        if (!isCallForThisNumber) continue

        // Skip self-calls
        if (otherPartyNormalized === twilioPhoneNormalized) continue

        if (!conversationMap.has(otherParty)) {
          conversationMap.set(otherParty, {
            messages: [],
            lastTime: new Date(0),
            name: otherParty,
            hasCall: true,
          })
        }

        const conv = conversationMap.get(otherParty)!
        conv.hasCall = true

        const callDate = new Date(call.date_created)
        const durationSecs = Number.parseInt(call.duration) || 0
        const duration = `${Math.floor(durationSecs / 60)}:${(durationSecs % 60).toString().padStart(2, "0")}`

        let callType: "incoming" | "outgoing" | "missed"
        if (call.status === "no-answer" || call.status === "busy" || call.status === "canceled") {
          callType = "missed"
        } else {
          callType = isOutgoing ? "outgoing" : "incoming"
        }

        conv.callStatus = callType
        conv.callDuration = duration

        conv.messages.push({
          id: call.sid,
          content:
            callType === "missed"
              ? "Missed call"
              : `${callType === "outgoing" ? "Outgoing" : "Incoming"} call - ${duration}`,
          sender: isOutgoing ? "user" : "contact",
          timestamp: callDate.toISOString(),
          type: "call_log",
          duration,
          callType,
          isRead: isOutgoing && callType !== "missed",
        })

        if (call.subresource_uris?.recordings) {
          callsWithRecordings.push({ call, conv, callDate, duration })
        }

        if (callDate > conv.lastTime) {
          conv.lastTime = callDate
        }
      }
    }

    for (const { call, conv, callDate, duration } of callsWithRecordings.slice(0, 10)) {
      try {
        await delay(200)
        const recordingsRes = await fetchWithRetry(`https://api.twilio.com${call.subresource_uris.recordings}`, {
          headers: { Authorization: authHeader },
        })

        if (recordingsRes.ok) {
          const recordingsData = await recordingsRes.json()

          if (recordingsData.recordings && recordingsData.recordings.length > 0) {
            for (const recording of recordingsData.recordings) {
              const recordingUrl = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Recordings/${recording.sid}.mp3`

              conv.messages.push({
                id: `${call.sid}-recording-${recording.sid}`,
                content: "Call Recording",
                sender: "user",
                timestamp: callDate.toISOString(),
                type: "call_recording",
                recordingUrl,
                duration,
                isRead: true,
              })
            }
          }
        }
      } catch (e) {
        // Silently skip failed recording fetches
      }
    }

    const conversations: Conversation[] = Array.from(conversationMap.entries()).map(([phone, data]) => {
      const sortedMessages = data.messages.sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      )

      const lastMsg = sortedMessages[sortedMessages.length - 1]

      const hasUnread = sortedMessages.some((m) => !m.isRead)
      const unreadCount = sortedMessages.filter((m) => !m.isRead).length

      return {
        id: phone.replace(/\D/g, ""),
        name: data.name,
        phone,
        lastMessage: lastMsg?.content || "",
        time: data.lastTime.toISOString(),
        unread: hasUnread,
        unreadCount,
        online: false,
        type: data.hasCall ? "call" : "message",
        callStatus: data.callStatus,
        callDuration: data.callDuration,
        contactId: "",
        messages: sortedMessages,
      }
    })

    conversations.sort((a, b) => {
      const aTime = new Date(a.time).getTime()
      const bTime = new Date(b.time).getTime()
      return bTime - aTime
    })

    return NextResponse.json({ success: true, conversations })
  } catch (error) {
    console.error("Sync history error:", error)
    return NextResponse.json({ error: "Failed to sync history" }, { status: 500 })
  }
}
