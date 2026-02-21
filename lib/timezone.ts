// Pakistan Standard Time (PKT) is UTC+5
const PKT_OFFSET_HOURS = 5

/**
 * Convert a Date to Pakistan Standard Time and format it
 */
export function formatToPKT(date: Date, options?: Intl.DateTimeFormatOptions): string {
  return date.toLocaleString("en-PK", {
    timeZone: "Asia/Karachi",
    ...options,
  })
}

/**
 * Get current time in PKT
 */
export function getCurrentPKTTime(): Date {
  return new Date(
    new Date().toLocaleString("en-US", {
      timeZone: "Asia/Karachi",
    }),
  )
}

/**
 * Format timestamp for display in PKT - time only (e.g., "2:30 PM")
 */
export function formatTimePKT(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  if (isNaN(d.getTime())) {
    return typeof date === "string" ? date : "Invalid time"
  }
  return d.toLocaleTimeString("en-PK", {
    timeZone: "Asia/Karachi",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

/**
 * Format timestamp for display in PKT - full date and time (e.g., "Jan 10, 2:30 pm")
 */
export function formatDateTimePKT(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  if (isNaN(d.getTime())) {
    return typeof date === "string" ? date : "Invalid date"
  }
  return d.toLocaleString("en-PK", {
    timeZone: "Asia/Karachi",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

/**
 * Format timestamp for display in PKT - relative or absolute based on age
 */
export function formatRelativeTimePKT(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  if (isNaN(d.getTime())) {
    return typeof date === "string" ? date : "Unknown"
  }

  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins} min ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return `${diffDays} days ago`

  return formatDateTimePKT(d)
}

/**
 * Get current timestamp as ISO string for new records (used for sorting)
 */
export function getCurrentTimestampPKT(): string {
  return new Date().toISOString()
}

/**
 * Get ISO string adjusted to PKT for storage
 */
export function getISOTimestampPKT(): string {
  return new Date().toISOString()
}

/**
 * Parse various timestamp formats and convert to PKT display
 * Shows time for today, date+time for older messages
 */
export function parseAndFormatPKT(timeStr: string): string {
  if (!timeStr) return "Unknown"

  // Handle relative time strings
  if (timeStr.includes("ago") || timeStr.toLowerCase() === "yesterday" || timeStr.toLowerCase() === "just now") {
    return timeStr
  }

  // Try to parse as ISO date first
  const parsed = new Date(timeStr)
  if (!isNaN(parsed.getTime())) {
    const now = new Date()
    const isToday =
      parsed.getDate() === now.getDate() &&
      parsed.getMonth() === now.getMonth() &&
      parsed.getFullYear() === now.getFullYear()

    // Show time only for today, date+time for older messages
    if (isToday) {
      return formatTimePKT(parsed)
    }
    return formatDateTimePKT(parsed)
  }

  // Handle time-only formats like "2:30 PM" (legacy support)
  const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
  if (timeMatch) {
    return timeStr.toLowerCase()
  }

  return timeStr
}

/**
 * Format for conversation list display - shows relative time or formatted PKT time
 */
export function formatConversationTime(timeStr: string): string {
  if (!timeStr) return "Unknown"

  // If already relative, return as-is
  if (timeStr.includes("ago") || timeStr.toLowerCase() === "yesterday" || timeStr.toLowerCase() === "just now") {
    return timeStr
  }

  // Try parsing as ISO date
  const parsed = new Date(timeStr)
  if (!isNaN(parsed.getTime())) {
    return formatRelativeTimePKT(parsed)
  }

  // Return original if can't parse
  return timeStr
}

/**
 * Parse any timestamp format to milliseconds for sorting
 */
export function parseTimestampToMs(timeStr: string): number {
  if (!timeStr) return 0

  // Try ISO format first
  const parsed = new Date(timeStr)
  if (!isNaN(parsed.getTime())) {
    return parsed.getTime()
  }

  // Handle time-only formats like "2:30 PM" (legacy support)
  const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
  if (timeMatch) {
    const now = new Date()
    let hours = Number.parseInt(timeMatch[1])
    const mins = Number.parseInt(timeMatch[2])
    const period = timeMatch[3]?.toUpperCase()

    if (period === "PM" && hours !== 12) hours += 12
    if (period === "AM" && hours === 12) hours = 0

    now.setHours(hours, mins, 0, 0)
    return now.getTime()
  }

  return 0
}
