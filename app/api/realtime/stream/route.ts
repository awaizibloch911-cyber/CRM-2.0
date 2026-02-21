import type { NextRequest } from "next/server"
import { eventEmitter, type InboxEvent } from "@/lib/realtime-events"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder()
  let unsubscribe: (() => void) | null = null
  let heartbeatInterval: NodeJS.Timeout | null = null

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "connected", timestamp: new Date().toISOString() })}\n\n`),
      )

      // Subscribe to inbox updates
      unsubscribe = eventEmitter.on("inbox-update", (event: InboxEvent) => {
        try {
          const data = JSON.stringify(event)
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        } catch (error) {
          console.error("[SSE] Error sending event:", error)
        }
      })

      // Send heartbeat every 30 seconds to keep connection alive
      heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "heartbeat", timestamp: new Date().toISOString() })}\n\n`),
          )
        } catch {
          // Connection likely closed
          if (heartbeatInterval) clearInterval(heartbeatInterval)
        }
      }, 30000)
    },
    cancel() {
      if (unsubscribe) unsubscribe()
      if (heartbeatInterval) clearInterval(heartbeatInterval)
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
