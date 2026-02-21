'use client';

import { useState, useCallback } from "react"
import { useCRM } from "./crm-context"

export interface CallLog {
  sid: string
  phone: string
  direction: "inbound" | "outbound-api" | "outbound"
  type: "incoming" | "outgoing" | "missed"
  duration: string
  durationSeconds: number
  status: string
  dateCreated: string
  dateUpdated: string
  price: number | string
  priceUnit: string
  recordings: Array<{
    sid: string
    url: string
    duration: string
    dateCreated: string
  }>
}

const PAGE_SIZE = 10

export function useCallLogs() {
  const { twilioConfig } = useCRM()
  const [callLogs, setCallLogs] = useState<CallLog[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)

  const fetchCallLogs = useCallback(
    async (page = 1) => {
      if (!twilioConfig) {
        setError("Twilio not configured")
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch("/api/twilio/call-logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            config: twilioConfig,
            page,
            pageSize: PAGE_SIZE,
            skipRecordings: page === 1 ? false : true, // Skip recording fetch for subsequent pages
          }),
        })

        if (!response.ok) {
          throw new Error("Failed to fetch call logs")
        }

        const data = await response.json()
        
        // Deduplicate calls within the response by SID
        const uniqueCallsByPage = Array.from(
          new Map((data.calls || []).map((call: CallLog) => [call.sid, call])).values(),
        )

        if (page === 1) {
          // First page, replace all data
          setCallLogs(uniqueCallsByPage)
        } else {
          // Append to existing data with deduplication
          setCallLogs((prev) => {
            const existingSids = new Set(prev.map((call) => call.sid))
            const newCalls = uniqueCallsByPage.filter((call) => !existingSids.has(call.sid))
            return [...prev, ...newCalls]
          })
        }

        setCurrentPage(page)
        setHasMore(data.hasMore)
        setTotalCount(data.total)
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch call logs"
        setError(message)
        console.error("[useCallLogs]", message)
      } finally {
        setIsLoading(false)
      }
    },
    [twilioConfig],
  )

  const loadMore = useCallback(() => {
    fetchCallLogs(currentPage + 1)
  }, [currentPage, fetchCallLogs])

  return {
    callLogs,
    isLoading,
    error,
    hasMore,
    totalCount,
    currentPage,
    pageSize: PAGE_SIZE,
    fetchCallLogs,
    loadMore,
  }
}
