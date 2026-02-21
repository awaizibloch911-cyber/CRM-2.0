import { type NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  console.log("[HoldMusic] Playing hold music")

  const baseUrl = req.nextUrl.origin
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Please hold while we assist other customers.</Say>
  <Play loop="20">${baseUrl}/hold-music.mp3</Play>
</Response>`

  return new NextResponse(twiml, {
    headers: {
      "Content-Type": "application/xml",
    },
  })
}
