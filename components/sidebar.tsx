"use client"

import { MessageSquare, Phone, Users, BarChart3, Settings, Calendar, Mail, Zap, PhoneIncoming } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCRM } from "@/lib/crm-context"
import type { ViewType } from "@/lib/types"
import type { AuthUser } from "@/lib/auth-context"
import { TwilioSetupDialog } from "./twilio-setup-dialog"
import { UserMenu } from "./user-menu"

const navItems: { icon: typeof MessageSquare; label: string; view: ViewType }[] = [
  { icon: MessageSquare, label: "Conversations", view: "conversations" },
  { icon: Phone, label: "Calls", view: "calls" },
  { icon: Users, label: "Contacts", view: "contacts" },
  { icon: Calendar, label: "Calendar", view: "calendar" },
  { icon: Mail, label: "Campaigns", view: "campaigns" },
  { icon: BarChart3, label: "Reports", view: "reports" },
]

const bottomItems: { icon: typeof Settings; label: string; view: ViewType }[] = [
  { icon: Zap, label: "Automations", view: "automations" },
]

interface SidebarProps {
  user: AuthUser
}

export function Sidebar({ user }: SidebarProps) {
  const { currentView, setCurrentView, isTwilioConfigured } = useCRM()

  const triggerTestIncomingCall = () => {
    console.log("[v0] Sidebar - Triggering test incoming call")
    const testCallSid = `TEST_${Date.now()}`
    const testFrom = "+1 (555) 123-4567"
    const testTo = "+1 (555) 000-0000"

    const event = new CustomEvent("crm-incoming-call", {
      detail: {
        callSid: testCallSid,
        from: testFrom,
        to: testTo,
      },
    })
    window.dispatchEvent(event)
  }

  return (
    <div className="flex w-16 flex-col items-center border-r border-border bg-sidebar py-4">
      {/* Logo */}
      <div className="mb-8 flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
        <span className="text-lg font-bold text-primary-foreground">F</span>
      </div>

      {/* Main Nav */}
      <nav className="flex flex-1 flex-col items-center gap-2">
        {navItems.map((item) => (
          <button
            key={item.label}
            onClick={() => setCurrentView(item.view)}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
              currentView === item.view
                ? "bg-sidebar-accent text-primary"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
            )}
            title={item.label}
          >
            <item.icon className="h-5 w-5" />
          </button>
        ))}

        <button
          onClick={triggerTestIncomingCall}
          className="flex h-10 w-10 items-center justify-center rounded-lg transition-colors text-green-500 hover:bg-green-500/10 hover:text-green-400"
          title="Test Incoming Call"
        >
          <PhoneIncoming className="h-5 w-5" />
        </button>
      </nav>

      {/* Bottom Nav */}
      <div className="flex flex-col items-center gap-2">
        {bottomItems.map((item) => (
          <button
            key={item.label}
            onClick={() => setCurrentView(item.view)}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
              currentView === item.view
                ? "bg-sidebar-accent text-primary"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
            )}
            title={item.label}
          >
            <item.icon className="h-5 w-5" />
          </button>
        ))}

        {/* Settings with Twilio indicator */}
        <TwilioSetupDialog>
          <button
            className={cn(
              "relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
              currentView === "settings"
                ? "bg-sidebar-accent text-primary"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
            )}
            title="Settings"
          >
            <Settings className="h-5 w-5" />
            {isTwilioConfigured && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-green-500" />}
          </button>
        </TwilioSetupDialog>

        <div className="mt-2 pt-2 border-t border-border">
          <UserMenu user={user} />
        </div>
      </div>
    </div>
  )
}
