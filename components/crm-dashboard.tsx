"use client"

import { useEffect } from "react"
import { Sidebar } from "./sidebar"
import { ConversationList } from "./conversation-list"
import { ChatPanel } from "./chat-panel"
import { ContactDetails } from "./contact-details"
import { CallsView } from "./calls-view"
import { ContactsView } from "./contacts-view"
import { useCRM } from "@/lib/crm-context"
import { useCall } from "@/lib/call-context"
import type { AuthUser } from "@/lib/auth-context"

interface CRMDashboardProps {
  user: AuthUser
}

export function CRMDashboard({ user }: CRMDashboardProps) {
  const { currentView, selectedConversation, contacts, twilioConfig } = useCRM()
  const { setTwilioConfig } = useCall()

  // Sync Twilio config from CRM context to Call context
  useEffect(() => {
    setTwilioConfig(twilioConfig)
  }, [twilioConfig, setTwilioConfig])

  const selectedContact = selectedConversation
    ? contacts.find((c) => c.id === selectedConversation.contactId) ||
      contacts.find((c) => c.phone.replace(/\D/g, "") === selectedConversation.phone.replace(/\D/g, ""))
    : undefined

  const displayContact =
    selectedContact ||
    (selectedConversation
      ? {
          id: selectedConversation.id,
          name: selectedConversation.name,
          phone: selectedConversation.phone,
          email: "",
          company: "",
          role: "",
          location: "",
          status: "Unknown",
          online: selectedConversation.online,
          avatar: selectedConversation.avatar,
          tags: [],
          recentActivity: [],
        }
      : undefined)

  const renderMainContent = () => {
    switch (currentView) {
      case "contacts":
        return <ContactsView />

      case "calls":
        return <CallsView />

      case "conversations":
      default:
        return (
          <div className="flex flex-1 overflow-hidden">
            <ConversationList />
            <div className="flex flex-1 flex-col">
              {selectedConversation && displayContact ? (
                <ChatPanel contact={displayContact} />
              ) : (
                <div className="flex flex-1 items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <p className="text-lg mb-2">Select a conversation to start</p>
                    <p className="text-sm">Or compose a new message using the button above</p>
                  </div>
                </div>
              )}
            </div>
            {displayContact && <ContactDetails contact={displayContact} />}
          </div>
        )

      case "calendar":
        return (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p className="text-lg mb-2">Calendar</p>
              <p className="text-sm">Coming soon...</p>
            </div>
          </div>
        )

      case "campaigns":
        return (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p className="text-lg mb-2">Campaigns</p>
              <p className="text-sm">Coming soon...</p>
            </div>
          </div>
        )

      case "reports":
        return (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p className="text-lg mb-2">Reports</p>
              <p className="text-sm">Coming soon...</p>
            </div>
          </div>
        )

      case "automations":
        return (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p className="text-lg mb-2">Automations</p>
              <p className="text-sm">Coming soon...</p>
            </div>
          </div>
        )

      case "settings":
        return (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p className="text-lg mb-2">Settings</p>
              <p className="text-sm">Configure your CRM settings</p>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar user={user} />
      {renderMainContent()}
    </div>
  )
}
