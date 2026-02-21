"use client"

import { Mail, Phone, MapPin, Building, Tag, Clock, FileText, ChevronDown, MessageSquare, Save, X } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Textarea } from "@/components/ui/textarea"
import { AddContactDialog } from "./add-contact-dialog"
import type { Contact } from "@/lib/types"
import { useState, useEffect } from "react"
import { useCall } from "@/lib/call-context"
import { useCRM } from "@/lib/crm-context"
import { formatConversationTime } from "@/lib/timezone"

interface ContactDetailsProps {
  contact: Contact
  isUnknownContact?: boolean
}

export function ContactDetails({ contact, isUnknownContact = false }: ContactDetailsProps) {
  const { initiateCall, activeCallInfo } = useCall()
  const { contacts, updateContact, selectedConversation } = useCRM()
  const [notesOpen, setNotesOpen] = useState(true)
  const [activityOpen, setActivityOpen] = useState(true)
  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [editedNotes, setEditedNotes] = useState(contact.notes || "")
  const [contactData, setContactData] = useState(contact)

  // Check if this contact is already saved
  const isContactSaved = contacts.some((c) => c.phone.replace(/\D/g, "") === contact.phone.replace(/\D/g, ""))

  // Update contact data when contact prop changes (but preserve edited notes if still editing)
  useEffect(() => {
    setContactData(contact)
    if (!isEditingNotes) {
      setEditedNotes(contact.notes || "")
    }
  }, [contact, isEditingNotes])

  // Update recent activity when conversation updates
  useEffect(() => {
    if (selectedConversation && selectedConversation.messages.length > 0) {
      const lastMessage = selectedConversation.messages[selectedConversation.messages.length - 1]
      const activityAction =
        lastMessage.sender === "user"
          ? `Sent a ${lastMessage.type === "text" ? "message" : lastMessage.type.replace(/_/g, " ")}`
          : `Received a ${lastMessage.type === "text" ? "message" : lastMessage.type.replace(/_/g, " ")}`

      const newActivity = {
        action: activityAction,
        date: formatConversationTime(lastMessage.timestamp),
      }

      // Only update if the activity is different from the most recent one
      if (
        contactData.recentActivity.length === 0 ||
        contactData.recentActivity[contactData.recentActivity.length - 1].action !== newActivity.action
      ) {
        const updatedContact = {
          ...contactData,
          recentActivity: [newActivity, ...contactData.recentActivity.slice(0, 4)], // Keep last 5 activities
        }
        setContactData(updatedContact)
        updateContact(contactData.id, updatedContact)
      }
    }
  }, [selectedConversation])

  // Update recent activity when call is made
  useEffect(() => {
    if (activeCallInfo && activeCallInfo.contact.id === contactData.id) {
      const newActivity = {
        action: "Initiated a call",
        date: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      }

      const updatedContact = {
        ...contactData,
        recentActivity: [newActivity, ...contactData.recentActivity.slice(0, 4)],
      }
      setContactData(updatedContact)
      updateContact(contactData.id, updatedContact)
    }
  }, [activeCallInfo])

  const handleSaveNotes = () => {
    const updatedContact = {
      ...contactData,
      notes: editedNotes,
    }
    setContactData(updatedContact)
    updateContact(contactData.id, { notes: editedNotes })
    setIsEditingNotes(false)
  }

  const handleCancelEdit = () => {
    setEditedNotes(contactData.notes || "")
    setIsEditingNotes(false)
  }

  return (
    <div className="w-80 border-l border-border bg-card overflow-y-auto">
      {/* Profile Header */}
      <div className="p-6 text-center border-b border-border">
        <Avatar className="h-20 w-20 mx-auto mb-4">
          <AvatarImage src={contactData.avatar || "/placeholder.svg"} />
          <AvatarFallback className="text-xl bg-muted">
            {contactData.name
              .split(" ")
              .map((n) => n[0])
              .join("")}
          </AvatarFallback>
        </Avatar>
        <h3 className="text-lg font-semibold text-foreground">{contactData.name}</h3>
        <p className="text-sm text-muted-foreground">{contactData.role}</p>
        <div className="flex items-center justify-center gap-2 mt-2">
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            {contactData.status}
          </Badge>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-4 border-b border-border flex gap-2 flex-wrap">
        <Button variant="outline" size="sm" className="flex-1 bg-transparent">
          <MessageSquare className="h-4 w-4 mr-1" />
          Message
        </Button>
        <Button variant="outline" size="sm" className="flex-1 bg-transparent" onClick={() => initiateCall(contact)}>
          <Phone className="h-4 w-4 mr-1" />
          Call
        </Button>
        {!isContactSaved && (
          <AddContactDialog initialPhone={contact.phone} triggerButtonVariant="outline" />
        )}
      </div>

      {/* Contact Info */}
      <div className="p-6 border-b border-border space-y-4">
        <div className="flex items-center gap-3 text-sm">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span className="text-foreground">{contactData.email || "No email"}</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Phone className="h-4 w-4 text-muted-foreground" />
          <span className="text-foreground">{contactData.phone}</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Building className="h-4 w-4 text-muted-foreground" />
          <span className="text-foreground">{contactData.company || "No company"}</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="text-foreground">{contactData.location || "No location"}</span>
        </div>
      </div>

      {/* Tags */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <Tag className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Tags</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {contactData.tags.length > 0 ? (
            contactData.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">No tags</span>
          )}
        </div>
      </div>

      {/* Notes */}
      <Collapsible open={notesOpen} onOpenChange={setNotesOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-6 h-auto hover:bg-secondary/50">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Notes</span>
            </div>
            <ChevronDown className={`h-4 w-4 transition-transform ${notesOpen ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="px-6 pb-6 space-y-3">
          {isEditingNotes ? (
            <>
              <Textarea
                value={editedNotes}
                onChange={(e) => setEditedNotes(e.target.value)}
                placeholder="Add notes about this contact..."
                className="min-h-24 text-sm resize-none"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveNotes} className="flex-1 gap-1">
                  <Save className="h-4 w-4" />
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancelEdit} className="flex-1 gap-1 bg-transparent">
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{contactData.notes || "No notes added yet."}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditingNotes(true)}
                className="w-full bg-transparent"
              >
                Edit Notes
              </Button>
            </>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Recent Activity */}
      <Collapsible open={activityOpen} onOpenChange={setActivityOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-6 h-auto hover:bg-secondary/50">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Recent Activity</span>
            </div>
            <ChevronDown className={`h-4 w-4 transition-transform ${activityOpen ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="px-6 pb-6">
          <div className="space-y-3">
            {contactData.recentActivity.length > 0 ? (
              contactData.recentActivity.map((activity, index) => (
                <div key={index} className="flex items-start gap-3 text-sm">
                  <div className="h-2 w-2 mt-2 rounded-full bg-primary" />
                  <div>
                    <p className="text-foreground">{activity.action}</p>
                    <p className="text-xs text-muted-foreground">{activity.date}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No recent activity</p>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
