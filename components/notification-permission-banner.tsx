"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Bell, BellOff, X, Volume2, VolumeX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { notificationService } from "@/lib/notifications"
import { cn } from "@/lib/utils"

export function NotificationPermissionBanner() {
  const [permission, setPermission] = useState<NotificationPermission>("default")
  const [dismissed, setDismissed] = useState(false)
  const [isSupported, setIsSupported] = useState(true)

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsSupported(notificationService.isSupported())
      setPermission(notificationService.getPermission())

      // Check if user has previously dismissed
      const wasDismissed = localStorage.getItem("notification-banner-dismissed")
      if (wasDismissed) {
        setDismissed(true)
      }
    }
  }, [])

  const handleRequestPermission = async () => {
    const result = await notificationService.requestPermission()
    setPermission(result)

    if (result === "granted") {
      // Show a test notification
      notificationService.show({
        title: "Notifications enabled",
        body: "You'll now receive alerts for new messages and calls",
      })
    }
  }

  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem("notification-banner-dismissed", "true")
  }

  // Don't show if not supported, already granted, denied, or dismissed
  if (!isSupported || permission !== "default" || dismissed) {
    return null
  }

  return (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-2">
      <div className="flex items-center justify-between gap-4 max-w-screen-xl mx-auto">
        <div className="flex items-center gap-3">
          <Bell className="h-4 w-4 text-primary" />
          <p className="text-sm text-foreground">
            Enable notifications to get alerts when new messages or calls arrive
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="default" onClick={handleRequestPermission} className="h-7">
            Enable
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDismiss} className="h-7 w-7 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export function NotificationStatus() {
  const [permission, setPermission] = useState<NotificationPermission>("default")
  const [soundEnabled, setSoundEnabled] = useState(true)

  useEffect(() => {
    if (typeof window !== "undefined") {
      setPermission(notificationService.getPermission())
      setSoundEnabled(notificationService.getSoundEnabled())
    }
  }, [])

  const handleClick = async () => {
    if (permission === "default") {
      const result = await notificationService.requestPermission()
      setPermission(result)
    }
  }

  const toggleSound = (e: React.MouseEvent) => {
    e.stopPropagation()
    const newValue = !soundEnabled
    setSoundEnabled(newValue)
    notificationService.setSoundEnabled(newValue)
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-8 w-8",
          permission === "granted" && "text-primary",
          permission === "denied" && "text-muted-foreground",
        )}
        onClick={handleClick}
        title={
          permission === "granted"
            ? "Notifications enabled"
            : permission === "denied"
              ? "Notifications blocked"
              : "Enable notifications"
        }
      >
        {permission === "granted" ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
      </Button>
      {permission === "granted" && (
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8", soundEnabled ? "text-primary" : "text-muted-foreground")}
          onClick={toggleSound}
          title={soundEnabled ? "Sound enabled" : "Sound muted"}
        >
          {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </Button>
      )}
    </div>
  )
}
