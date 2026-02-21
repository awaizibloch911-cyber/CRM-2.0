import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { to, message, config, baseUrl } = await req.json()

    if (!config?.accountSid || !config?.authToken || !config?.phoneNumber) {
      return NextResponse.json({ error: "Twilio not configured" }, { status: 400 })
    }

    const formData = new URLSearchParams()
    formData.append("To", to)
    formData.append("From", config.phoneNumber)
    formData.append("Body", message)

    if (baseUrl) {
      formData.append("StatusCallback", `${baseUrl}/api/twilio/webhook`)
    }

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    })

    const data = await response.json()

    if (response.ok) {
      return NextResponse.json({ success: true, sid: data.sid })
    } else {
      return NextResponse.json({ error: data.message }, { status: 400 })
    }
  } catch (error) {
    console.error("Send SMS error:", error)
    return NextResponse.json({ error: "Failed to send SMS" }, { status: 500 })
  }
}
