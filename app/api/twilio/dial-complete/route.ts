import { type NextRequest, NextResponse } from "next/server"

// This endpoint handles the completion of dialed calls
// Twilio calls this when the <Dial> completes (either party hangs up)
export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || ""
  let data: Record<string, string> = {}

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await req.formData()
    data = Object.fromEntries(formData.entries()) as Record<string, string>
  } else {
    try {
      data = await req.json()
    } catch {
      // Ignore parse errors
    }
  }

  console.log("[Dial-Complete] Call ended:", {
    callSid: data.CallSid,
    dialCallStatus: data.DialCallStatus,
    dialCallDuration: data.DialCallDuration,
  })

  // Return empty TwiML to properly end the call
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?>
<Response>
</Response>`,
    {
      headers: { "Content-Type": "application/xml" },
    },
  )
}
