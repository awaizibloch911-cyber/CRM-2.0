import { type NextRequest, NextResponse } from "next/server"

// It should connect them to the customer, not dial again
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

// This generates TwiML for the outbound call leg
// When the call is answered, this tells Twilio what to do
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const toNumber = url.searchParams.get("To") || ""
  const callerId = process.env.TWILIO_PHONE_NUMBER || ""

  console.log("[TwiML GET] To:", toNumber, "CallerId:", callerId ? "set" : "NOT SET")

  // Validate phone number
  if (!toNumber || !isValidPhoneNumber(toNumber)) {
    console.error("[TwiML] Invalid phone number:", toNumber)
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">The phone number provided is invalid.</Say>
</Response>`,
      { headers: { "Content-Type": "application/xml" } },
    )
  }

  if (!callerId) {
    console.error("[TwiML] Missing TWILIO_PHONE_NUMBER")
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Call configuration error.</Say>
</Response>`,
      { headers: { "Content-Type": "application/xml" } },
    )
  }

  const formattedNumber = formatToE164(toNumber)

  // This is correct - when CRM initiates call, Twilio calls the CRM user first,
  // then this TwiML connects them to the customer
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${callerId}" timeout="30">
    <Number>${formattedNumber}</Number>
  </Dial>
</Response>`

  console.log("[TwiML] Generated:", twiml)

  return new NextResponse(twiml, {
    headers: { "Content-Type": "application/xml" },
  })
}

export async function POST(req: NextRequest) {
  // Handle POST the same way as GET for Twilio compatibility
  const contentType = req.headers.get("content-type") || ""
  let toNumber = ""

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await req.formData()
    toNumber = (formData.get("To") as string) || ""
  } else {
    try {
      const body = await req.json()
      toNumber = body.To || ""
    } catch {
      // Try URL params
      const url = new URL(req.url)
      toNumber = url.searchParams.get("To") || ""
    }
  }

  const callerId = process.env.TWILIO_PHONE_NUMBER || ""

  console.log("[TwiML POST] To:", toNumber, "CallerId:", callerId ? "set" : "NOT SET")

  if (!toNumber || !isValidPhoneNumber(toNumber)) {
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">The phone number provided is invalid.</Say>
</Response>`,
      { headers: { "Content-Type": "application/xml" } },
    )
  }

  if (!callerId) {
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Call configuration error.</Say>
</Response>`,
      { headers: { "Content-Type": "application/xml" } },
    )
  }

  const formattedNumber = formatToE164(toNumber)

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${callerId}" timeout="30">
    <Number>${formattedNumber}</Number>
  </Dial>
</Response>`

  return new NextResponse(twiml, {
    headers: { "Content-Type": "application/xml" },
  })
}
