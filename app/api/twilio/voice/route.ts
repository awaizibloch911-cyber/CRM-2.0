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

function isPhoneNumber(value: string): boolean {
  const digits = value.replace(/\D/g, "")
  return digits.length >= 7 && digits.length <= 15
}

function isClientIdentifier(value: string): boolean {
  // Twilio Device connections have client: prefix or are simple identifiers
  return value.startsWith("client:") || (!isPhoneNumber(value) && value.length > 0)
}

// This endpoint handles both inbound and outbound calls
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const formData = await req.formData()

    const to = formData.get("To") as string
    const from = formData.get("From") as string
    const callerId = (formData.get("CallerId") as string) || process.env.TWILIO_PHONE_NUMBER
    const direction = formData.get("Direction") as string

    console.log("[Voice] Received voice request - To:", to, "From:", from, "Direction:", direction, "CallerId:", callerId)

    // Check if this is an OUTBOUND call from the browser (To is a phone number, From is client:xxx)
    if (to && isPhoneNumber(to) && from && isClientIdentifier(from)) {
      const formattedTo = formatToE164(to)
      console.log("[Voice] OUTBOUND call - Dialing out to:", formattedTo)

      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${callerId}" answerOnBridge="true" timeout="30">
    <Number>${formattedTo}</Number>
  </Dial>
</Response>`

      return new NextResponse(twiml, {
        headers: { "Content-Type": "application/xml" },
      })
    }

    // Check if this is an INBOUND call (From is a phone number calling To which is your Twilio number)
    if (from && isPhoneNumber(from)) {
      console.log("[Voice] INBOUND call from:", from, "- Dialing to browser client")

      // Dial directly to the browser client - this connects the caller to the CRM user
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial answerOnBridge="true" timeout="30">
    <Client>crm-user</Client>
  </Dial>
  <Say voice="alice">The call was not answered. Goodbye.</Say>
</Response>`

      return new NextResponse(twiml, {
        headers: { "Content-Type": "application/xml" },
      })
    }

    console.log("[Voice] Unable to determine call type")
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Unable to process call. Please try again.</Say>
</Response>`

    return new NextResponse(twiml, {
      headers: { "Content-Type": "application/xml" },
    })
  } catch (error) {
    console.error("[Voice] Error:", error)

    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">An error occurred. Please try again.</Say>
</Response>`

    return new NextResponse(errorTwiml, {
      headers: { "Content-Type": "application/xml" },
    })
  }
}
