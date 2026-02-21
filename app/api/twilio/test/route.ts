import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { accountSid, authToken } = await req.json()

    if (!accountSid || !authToken) {
      return NextResponse.json({ error: "Missing credentials" }, { status: 400 })
    }

    // Test Twilio connection by fetching account info
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      },
    })

    if (response.ok) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }
  } catch (error) {
    console.error("Twilio test error:", error)
    return NextResponse.json({ error: "Connection failed" }, { status: 500 })
  }
}
