import { type NextRequest, NextResponse } from "next/server"
import twilio from "twilio"

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const callSid = url.searchParams.get("callSid")
  const configStr = url.searchParams.get("config")

  if (!callSid || !configStr) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 })
  }

  try {
    const config = JSON.parse(configStr)
    const client = twilio(config.accountSid, config.authToken)

    const call = await client.calls(callSid).fetch()

    return NextResponse.json({
      status: call.status,
      duration: call.duration,
      direction: call.direction,
    })
  } catch (error) {
    console.error("[Call-Status] Error fetching status:", error)
    return NextResponse.json({ error: "Failed to fetch status" }, { status: 500 })
  }
}
