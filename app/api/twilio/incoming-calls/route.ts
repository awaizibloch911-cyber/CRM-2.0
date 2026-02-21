import { type NextRequest, NextResponse } from "next/server"
import { addIncomingCall, removeIncomingCall, getIncomingCalls } from "@/lib/incoming-call-store"

export async function GET(): Promise<NextResponse> {
  const calls = getIncomingCalls()
  console.log("[IncomingCalls API] GET - returning calls:", calls.length)
  return NextResponse.json({ calls: calls })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json()
    const callSid = body.callSid as string
    const action = body.action as string
    const fromNumber = body.from as string
    const toNumber = body.to as string

    console.log("[IncomingCalls API] POST - action:", action, "callSid:", callSid)

    if (action === "clear" && callSid) {
      removeIncomingCall(callSid)
      return NextResponse.json({ success: true })
    }

    if (action === "add" && callSid && fromNumber) {
      addIncomingCall(callSid, fromNumber, toNumber || "")
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[IncomingCalls API] Error:", error)
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
