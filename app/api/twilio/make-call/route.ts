import { type NextRequest, NextResponse } from "next/server"

function formatToE164(phone: string): string {
  let cleaned = phone.replace(/[^\d+]/g, "")

  if (!cleaned.startsWith("+")) {
    cleaned = cleaned.replace(/^0+/, "")

    if (cleaned.length === 10) {
      cleaned = "+1" + cleaned
    } else if (cleaned.length === 11 && cleaned.startsWith("1")) {
      cleaned = "+" + cleaned
    } else if (cleaned.length > 10) {
      cleaned = "+" + cleaned
    }
  }

  return cleaned
}

function isValidPhoneNumber(phone: string): boolean {
  const formatted = formatToE164(phone)
  return /^\+\d{10,15}$/.test(formatted)
}

export async function POST(req: NextRequest) {
  try {
    const { to, config, baseUrl } = await req.json()

    if (!config?.accountSid || !config?.authToken || !config?.phoneNumber) {
      return NextResponse.json({ error: "Twilio not configured" }, { status: 400 })
    }

    if (!baseUrl) {
      return NextResponse.json({ error: "Base URL is required" }, { status: 400 })
    }

    if (!to || !isValidPhoneNumber(to)) {
      console.error("[MakeCall] Invalid phone number:", to)
      return NextResponse.json(
        { error: "Invalid phone number format. Please use E.164 format (e.g., +15551234567)" },
        { status: 400 },
      )
    }

    const formattedTo = formatToE164(to)
    const statusCallbackUrl = `${baseUrl}/api/twilio/webhook`

    // The TwiML now just says a message and hangs up - no more double dialing
    // The call is made directly TO the customer, FROM the Twilio number
    // When customer answers, they just hear a brief message confirming connection
    const formData = new URLSearchParams()
    formData.append("To", formattedTo)
    formData.append("From", config.phoneNumber)
    // Simple TwiML that doesn't try to dial anyone - just confirms the connection
    formData.append(
      "Twiml",
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">You are now connected.</Say><Pause length="300"/></Response>`,
    )
    formData.append("Timeout", "30")
    formData.append("StatusCallback", statusCallbackUrl)
    formData.append("StatusCallbackEvent", "initiated")
    formData.append("StatusCallbackEvent", "ringing")
    formData.append("StatusCallbackEvent", "answered")
    formData.append("StatusCallbackEvent", "completed")
    formData.append("StatusCallbackMethod", "POST")

    console.log("[MakeCall] Initiating direct call to:", formattedTo, "from:", config.phoneNumber)

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Calls.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    })

    const data = await response.json()

    if (response.ok) {
      console.log("[MakeCall] Call initiated, SID:", data.sid)
      return NextResponse.json({ success: true, callSid: data.sid, status: data.status })
    } else {
      console.error("[MakeCall] Twilio error:", data)
      return NextResponse.json({ error: data.message || "Failed to initiate call" }, { status: 400 })
    }
  } catch (error) {
    console.error("[MakeCall] Error:", error)
    return NextResponse.json({ error: "Failed to make call" }, { status: 500 })
  }
}
