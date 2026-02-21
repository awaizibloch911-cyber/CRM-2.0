"use client"

import { useEffect, useState, useCallback } from "react"
import { Phone, PhoneMissed, MessageSquare, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { notificationService, type InAppNotification } from "@/lib/notifications"

export function InAppNotificationToast() {
  const [notifications, setNotifications] = useState<InAppNotification[]>([])

  useEffect(() => {
    const unsubscribe = notificationService.subscribeToInApp((notification) => {
      setNotifications((prev) => {
        // Limit to 3 notifications at a time
        const updated = [...prev, notification].slice(-3)
        return updated
      })

      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== notification.id))
      }, 5000)
    })

    return unsubscribe
  }, [])

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const handleClick = useCallback(
    (notification: InAppNotification) => {
      notification.onClick?.()
      dismissNotification(notification.id)
    },
    [dismissNotification],
  )

  if (notifications.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {notifications.map((notification, index) => (
        <div
          key={notification.id}
          className={cn(
            "pointer-events-auto",
            "animate-in fade-in-0 slide-in-from-top-2 zoom-in-95",
            "duration-300 ease-out",
          )}
          style={{
            animationDelay: `${index * 50}ms`,
          }}
        >
          <NotificationCard
            notification={notification}
            onDismiss={() => dismissNotification(notification.id)}
            onClick={() => handleClick(notification)}
          />
        </div>
      ))}
    </div>
  )
}

interface NotificationCardProps {
  notification: InAppNotification
  onDismiss: () => void
  onClick: () => void
}

function NotificationCard({ notification, onDismiss, onClick }: NotificationCardProps) {
  const Icon = notification.type === "call" ? Phone : notification.type === "missed-call" ? PhoneMissed : MessageSquare

  const iconColor =
    notification.type === "call"
      ? "text-green-500"
      : notification.type === "missed-call"
        ? "text-red-500"
        : "text-primary"

  const borderColor =
    notification.type === "call"
      ? "border-l-green-500"
      : notification.type === "missed-call"
        ? "border-l-red-500"
        : "border-l-primary"

  return (
    <div
      className={cn(
        "relative flex items-start gap-3 p-4 rounded-lg shadow-lg",
        "bg-card border border-border border-l-4",
        borderColor,
        "min-w-[300px] max-w-[400px]",
        "cursor-pointer transition-all duration-200",
        "hover:shadow-xl hover:scale-[1.02]",
        "backdrop-blur-sm bg-opacity-95",
      )}
      onClick={onClick}
    >
      {/* Animated icon container */}
      <div className={cn("flex-shrink-0 p-2 rounded-full bg-background", "animate-bounce-subtle")}>
        <Icon className={cn("h-5 w-5", iconColor)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-foreground truncate">{notification.title}</p>
        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{notification.body}</p>
      </div>

      {/* Dismiss button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDismiss()
        }}
        className={cn(
          "flex-shrink-0 p-1 rounded-full",
          "text-muted-foreground hover:text-foreground",
          "hover:bg-muted transition-colors",
        )}
      >
        <X className="h-4 w-4" />
      </button>

      {/* Progress bar for auto-dismiss */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-muted overflow-hidden rounded-b-lg">
        <div className="h-full bg-primary animate-shrink-width" style={{ animationDuration: "5s" }} />
      </div>
    </div>
  )
}
