// Store for incoming calls
interface IncomingCallData {
  callSid: string
  from: string
  to: string
  timestamp: number
}

const pendingIncomingCalls: Map<string, IncomingCallData> = new Map()

export function addIncomingCall(callSid: string, fromNumber: string, toNumber: string): void {
  console.log("[IncomingCallStore] Adding pending call:", callSid, "from:", fromNumber)
  pendingIncomingCalls.set(callSid, {
    callSid: callSid,
    from: fromNumber,
    to: toNumber,
    timestamp: Date.now(),
  })
  console.log("[IncomingCallStore] Total pending calls:", pendingIncomingCalls.size)
}

export function removeIncomingCall(callSid: string): void {
  console.log("[IncomingCallStore] Removing pending call:", callSid)
  pendingIncomingCalls.delete(callSid)
}

export function getIncomingCalls(): IncomingCallData[] {
  const now = Date.now()
  const keysToDelete: string[] = []

  pendingIncomingCalls.forEach((call, key) => {
    if (now - call.timestamp > 60000) {
      keysToDelete.push(key)
    }
  })

  keysToDelete.forEach((key) => {
    pendingIncomingCalls.delete(key)
  })

  const calls = Array.from(pendingIncomingCalls.values())
  console.log("[IncomingCallStore] Getting calls, count:", calls.length)
  return calls
}

export function hasIncomingCall(callSid: string): boolean {
  return pendingIncomingCalls.has(callSid)
}
