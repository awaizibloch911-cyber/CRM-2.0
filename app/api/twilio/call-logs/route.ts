import { type NextRequest, NextResponse } from "next/server"

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  for (let i = 0; i < maxRetries; i++) {
    const res = await fetch(url, options)
    if (res.status === 429) {
      const retryAfter = res.headers.get("Retry-After")
      const waitTime = retryAfter ? Number.parseInt(retryAfter) * 1000 : (i + 1) * 2000
      await delay(waitTime)
      continue
    }
    return res
  }
  return fetch(url, options)
}

export async function POST(req: NextRequest) {
  try {
    const { config, page = 1, pageSize = 10, skipRecordings = false } = await req.json()

    if (!config?.accountSid || !config?.authToken || !config?.phoneNumber) {
      return NextResponse.json({ error: "Twilio not configured" }, { status: 400 })
    }

    const authHeader = `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`
    const twilioPhoneNormalized = config.phoneNumber.replace(/\D/g, "")

    // Calculate pagination parameters
    const offset = (page - 1) * pageSize
    const pageLimit = pageSize * 3 // Fetch more to account for filtered results

    // Fetch calls with pagination - get all statuses (completed, failed, no-answer, busy, canceled)
    const callsRes = await fetchWithRetry(
      `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Calls.json?PageSize=${pageLimit}&Page=${page - 1}`,
      {
        headers: { Authorization: authHeader },
      },
    )

    if (!callsRes.ok) {
      return NextResponse.json({ error: "Failed to fetch calls from Twilio" }, { status: callsRes.status })
    }

    const callsData = await callsRes.json()
    const calls = callsData.calls || []

    // Filter out client: devices and self-calls, only show calls for the registered phone number
    const filteredCalls = calls.filter((call: any) => {
      const isOutgoing = call.direction === "outbound-api" || call.direction === "outbound"
      const callFromNumber = call.from.replace(/\D/g, "")
      const callToNumber = call.to.replace(/\D/g, "")
      const otherParty = isOutgoing ? call.to : call.from

      // Skip client device calls
      if (otherParty.startsWith("client:")) return false

      // Only include calls where the registered phone number is one of the parties
      const isCallForThisNumber =
        callFromNumber === twilioPhoneNormalized || callToNumber === twilioPhoneNormalized

      if (!isCallForThisNumber) return false

      // Skip self-calls (same number calling itself)
      const otherPartyNormalized = otherParty.replace(/\D/g, "")
      if (otherPartyNormalized === twilioPhoneNormalized) return false

      return true
    })

    // Apply pagination to filtered results
    const paginatedCalls = filteredCalls.slice(offset, offset + pageSize)

    // Fetch recording details only if not skipped
    const callsWithDetails = await Promise.all(
      paginatedCalls.map(async (call: any) => {
        let recordings: any[] = []

        if (!skipRecordings && call.subresource_uris?.recordings) {
          try {
            await delay(50)
            const recordingsRes = await fetchWithRetry(
              `https://api.twilio.com${call.subresource_uris.recordings}`,
              {
                headers: { Authorization: authHeader },
              },
              2,
            )

            if (recordingsRes.ok) {
              const recordingsData = await recordingsRes.json()
              recordings = (recordingsData.recordings || []).slice(0, 1) // Only first recording
            }
          } catch (e) {
            // Silent fail for recordings
          }
        }

        const isOutgoing = call.direction === "outbound-api" || call.direction === "outbound"
        const otherParty = isOutgoing ? call.to : call.from

        let callType: "incoming" | "outgoing" | "missed"
        
        // Determine call type based on direction and status
        if (isOutgoing) {
          // For outgoing calls, check if they were answered
          if (call.status === "no-answer" || call.status === "busy" || call.status === "canceled" || call.status === "failed") {
            callType = "missed"
          } else {
            callType = "outgoing"
          }
        } else {
          // For incoming calls, check if they were answered
          if (call.status === "no-answer" || call.status === "busy" || call.status === "canceled" || call.status === "failed") {
            callType = "missed"
          } else {
            callType = "incoming"
          }
        }

        const durationSecs = Number.parseInt(call.duration) || 0
        const duration = `${Math.floor(durationSecs / 60)}:${(durationSecs % 60).toString().padStart(2, "0")}`

        return {
          sid: call.sid,
          phone: otherParty,
          direction: call.direction,
          type: callType,
          duration: duration,
          durationSeconds: durationSecs,
          status: call.status,
          dateCreated: call.date_created,
          dateUpdated: call.date_updated,
          price: call.price || 0,
          priceUnit: call.price_unit || "USD",
          recordings: recordings.map((rec: any) => ({
            sid: rec.sid,
            url: `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Recordings/${rec.sid}.mp3`,
            duration: rec.duration,
            dateCreated: rec.date_created,
          })),
        }
      }),
    )

    // Sort by date, newest first
    callsWithDetails.sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime())

    // Debug logging
    console.log("[CallLogs] Debug info:", {
      registeredPhone: config.phoneNumber,
      totalCallsFromAPI: calls.length,
      filteredCalls: filteredCalls.length,
      paginatedCalls: paginatedCalls.length,
      page,
      pageSize,
      offset,
    })

    if (page === 1 && callsWithDetails.length > 0) {
      const duplicateCheck = new Map<string, number>()
      callsWithDetails.forEach((call) => {
        const key = `${call.phone}_${call.dateCreated}`
        duplicateCheck.set(key, (duplicateCheck.get(key) || 0) + 1)
      })
      const duplicates = Array.from(duplicateCheck.entries()).filter(([_, count]) => count > 1)
      if (duplicates.length > 0) {
        console.log("[CallLogs] Found duplicates:", duplicates)
      }
    }

    return NextResponse.json({
      success: true,
      calls: callsWithDetails,
      page: page,
      pageSize: pageSize,
      hasMore: filteredCalls.length > offset + pageSize,
      total: filteredCalls.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[CallLogs] Error fetching call logs:", error)
    return NextResponse.json({ error: "Failed to fetch call logs" }, { status: 500 })
  }
}
