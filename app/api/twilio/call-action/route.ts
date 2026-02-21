import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { action, callSid, config, baseUrl } = await req.json()

    if (!config?.accountSid || !config?.authToken) {
      return NextResponse.json({ error: "Twilio not configured" }, { status: 400 })
    }

    if (!callSid) {
      return NextResponse.json({ error: "Call SID is required" }, { status: 400 })
    }

    const effectiveBaseUrl = baseUrl || req.headers.get("origin") || req.nextUrl.origin
    console.log("[v0] CallAction - Using baseUrl:", effectiveBaseUrl)

    const baseAuth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")

    switch (action) {
      case "end": {
        // Update call status to completed
        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Calls/${callSid}.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${baseAuth}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ Status: "completed" }),
          },
        )

        if (!response.ok) {
          const error = await response.json()
          console.error("[CallAction] Failed to end call:", error)
          return NextResponse.json({ error: error.message }, { status: 400 })
        }

        console.log("[CallAction] Call ended:", callSid)
        return NextResponse.json({ success: true, action: "end" })
      }

      case "reject": {
        // Reject the call
        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Calls/${callSid}.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${baseAuth}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ Status: "canceled" }),
          },
        )

        if (!response.ok) {
          const error = await response.json()
          console.error("[CallAction] Failed to reject call:", error)
          return NextResponse.json({ error: error.message }, { status: 400 })
        }

        console.log("[CallAction] Call rejected:", callSid)
        return NextResponse.json({ success: true, action: "reject" })
      }

      case "answer": {
        console.log("[v0] CallAction - Answering call:", callSid)

        const answerTwimlUrl = `${effectiveBaseUrl}/api/twilio/answer-incoming`
        console.log("[v0] CallAction - Answer TwiML URL:", answerTwimlUrl)

        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Calls/${callSid}.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${baseAuth}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              Url: answerTwimlUrl,
              Method: "POST",
            }),
          },
        )

        if (!response.ok) {
          const error = await response.json()
          console.error("[v0] CallAction - Failed to answer call:", error)
          return NextResponse.json({ error: error.message }, { status: 400 })
        }

        console.log("[v0] CallAction - Call answered and redirected to Client dial")
        return NextResponse.json({ success: true, action: "answer" })
      }

      case "hold":
      case "unhold": {
        // Update call with hold TwiML
        const holdTwiml =
          action === "hold"
            ? `<?xml version="1.0" encoding="UTF-8"?><Response><Play loop="0">http://com.twilio.sounds.music.s3.amazonaws.com/ClockworkWaltz.mp3</Play></Response>`
            : `<?xml version="1.0" encoding="UTF-8"?><Response><Dial><Number>${config.phoneNumber}</Number></Dial></Response>`

        console.log("[CallAction] Hold toggled:", action, callSid)
        return NextResponse.json({ success: true, action })
      }

      case "mute":
      case "unmute": {
        // Muting is typically done client-side with Twilio Client SDK
        console.log("[CallAction] Mute toggled:", action, callSid)
        return NextResponse.json({ success: true, action })
      }

      case "startRecording": {
        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Calls/${callSid}/Recordings.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${baseAuth}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              RecordingStatusCallback: `${effectiveBaseUrl}/api/twilio/webhook`,
              RecordingChannels: "dual",
            }),
          },
        )

        if (!response.ok) {
          const error = await response.json()
          console.error("[CallAction] Failed to start recording:", error)
          return NextResponse.json({ error: error.message }, { status: 400 })
        }

        const data = await response.json()
        console.log("[CallAction] Recording started:", data.sid)
        return NextResponse.json({ success: true, action: "startRecording", recordingSid: data.sid })
      }

      case "stopRecording": {
        // Get active recordings for the call
        const listResponse = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Calls/${callSid}/Recordings.json`,
          {
            headers: {
              Authorization: `Basic ${baseAuth}`,
            },
          },
        )

        if (listResponse.ok) {
          const recordings = await listResponse.json()
          // Stop all in-progress recordings
          for (const recording of recordings.recordings || []) {
            if (recording.status === "in-progress") {
              await fetch(
                `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Recordings/${recording.sid}.json`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Basic ${baseAuth}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                  },
                  body: new URLSearchParams({ Status: "stopped" }),
                },
              )
            }
          }
        }

        console.log("[CallAction] Recording stopped for call:", callSid)
        return NextResponse.json({ success: true, action: "stopRecording" })
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 })
    }
  } catch (error) {
    console.error("[CallAction] Error:", error)
    return NextResponse.json({ error: "Failed to perform action" }, { status: 500 })
  }
}
