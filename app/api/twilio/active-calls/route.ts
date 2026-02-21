import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { config } = await req.json()

    if (!config?.accountSid || !config?.authToken || !config?.phoneNumber) {
      return NextResponse.json({ error: "Twilio not configured" }, { status: 400 })
    }

    const authHeader = `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`

    // Fetch calls with status ringing, queued, or in-progress
    const [ringingRes, queuedRes] = await Promise.all([
      fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Calls.json?Status=ringing&PageSize=10`, {
        headers: { Authorization: authHeader },
      }),
      fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Calls.json?Status=queued&PageSize=10`, {
        headers: { Authorization: authHeader },
      }),
    ])

    const [ringingData, queuedData] = await Promise.all([ringingRes.json(), queuedRes.json()])

    const allActiveCalls = [...(ringingData.calls || []), ...(queuedData.calls || [])]

    // Filter for inbound calls only (someone calling the CRM number)
    const incomingCalls = allActiveCalls.filter((call: any) => {
      const isInbound = call.direction === "inbound"
      return isInbound
    })

    // Map to a simpler format
    const activeCalls = incomingCalls.map((call: any) => ({
      callSid: call.sid,
      from: call.from,
      to: call.to,
      status: call.status,
      direction: call.direction,
      dateCreated: call.date_created,
    }))

    return NextResponse.json({
      success: true,
      activeCalls,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[ActiveCalls] Error fetching active calls:", error)
    return NextResponse.json({ error: "Failed to fetch active calls" }, { status: 500 })
  }
}
