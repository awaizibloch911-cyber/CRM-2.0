import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  console.log("[v0] AnswerIncoming POST - connecting caller to CRM client")

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
<Say voice="alice">Connecting you now.</Say>
<Dial>
<Client>crm-user</Client>
</Dial>
</Response>`

  return new NextResponse(twiml, {
    headers: {
      "Content-Type": "application/xml",
    },
  })
}

export async function GET(req: NextRequest) {
  console.log("[v0] AnswerIncoming GET - connecting caller to CRM client")

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
<Say voice="alice">Connecting you now.</Say>
<Dial>
<Client>crm-user</Client>
</Dial>
</Response>`

  return new NextResponse(twiml, {
    headers: {
      "Content-Type": "application/xml",
    },
  })
}
