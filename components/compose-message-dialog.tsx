"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useCRM } from "@/lib/crm-context"
import { MessageSquarePlus, UserPlus, Search } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { Conversation, Message } from "@/lib/types"

export function ComposeMessageDialog() {
  const { contacts, conversations, addConversation, selectConversation, addContact, twilioConfig } = useCRM()
  const [open, setOpen] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState("")
  const [message, setMessage] = useState("")
  const [search, setSearch] = useState("")
  const [showAddContact, setShowAddContact] = useState(false)
  const [newContactName, setNewContactName] = useState("")
  const [sending, setSending] = useState(false)

  const filteredContacts = contacts.filter(
    (c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search),
  )

  const handleSelectContact = (phone: string) => {
    setPhoneNumber(phone)
    setSearch("")
  }

  const handleSend = async () => {
    if (!phoneNumber.trim() || !message.trim()) return

    setSending(true)

    // Check if conversation exists
    const normalizedPhone = phoneNumber.replace(/\D/g, "")
    let existingConv = conversations.find((c) => c.phone.replace(/\D/g, "") === normalizedPhone)

    const contact = contacts.find((c) => c.phone.replace(/\D/g, "") === normalizedPhone)

    if (!existingConv) {
      // Create new conversation
      const newConv: Conversation = {
        id: Date.now().toString(),
        name: contact?.name || phoneNumber,
        phone: phoneNumber,
        lastMessage: message,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        unread: false,
        online: false,
        type: "message",
        contactId: contact?.id || "",
        messages: [],
      }
      addConversation(newConv)
      existingConv = newConv
    }

    // Send via Twilio if configured
    if (twilioConfig) {
      try {
        await fetch("/api/twilio/send-sms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: phoneNumber,
            message,
            config: twilioConfig,
          }),
        })
      } catch (error) {
        console.error("Failed to send SMS:", error)
      }
    }

    // Add message to conversation
    const newMessage: Message = {
      id: Date.now().toString(),
      content: message,
      sender: "user",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      type: "text",
    }

    existingConv.messages.push(newMessage)
    selectConversation(existingConv)

    setSending(false)
    setOpen(false)
    setPhoneNumber("")
    setMessage("")
  }

  const handleAddContact = () => {
    if (!newContactName.trim() || !phoneNumber.trim()) return

    const newContact = {
      id: Date.now().toString(),
      name: newContactName,
      phone: phoneNumber,
      email: "",
      company: "",
      role: "",
      location: "",
      status: "Lead",
      online: false,
      tags: [],
      recentActivity: [],
    }

    addContact(newContact)
    setShowAddContact(false)
    setNewContactName("")
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <MessageSquarePlus className="h-4 w-4" />
          Compose
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
          <DialogDescription>Send a message to an existing contact or a new number.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Phone Number Input */}
          <div className="space-y-2">
            <Label>To</Label>
            <div className="flex gap-2">
              <Input placeholder="+1234567890" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowAddContact(!showAddContact)}
                title="Save as contact"
              >
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Add Contact Form */}
          {showAddContact && (
            <div className="flex gap-2 p-3 bg-muted rounded-lg">
              <Input
                placeholder="Contact name"
                value={newContactName}
                onChange={(e) => setNewContactName(e.target.value)}
              />
              <Button size="sm" onClick={handleAddContact}>
                Save Contact
              </Button>
            </div>
          )}

          {/* Contact Search */}
          <div className="space-y-2">
            <Label>Or select a contact</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <ScrollArea className="h-32 border rounded-lg">
              {filteredContacts.map((contact) => (
                <button
                  key={contact.id}
                  className="w-full flex items-center gap-3 p-3 hover:bg-muted text-left"
                  onClick={() => handleSelectContact(contact.phone)}
                >
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                    {contact.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{contact.name}</p>
                    <p className="text-xs text-muted-foreground">{contact.phone}</p>
                  </div>
                </button>
              ))}
              {filteredContacts.length === 0 && (
                <p className="p-3 text-sm text-muted-foreground text-center">No contacts found</p>
              )}
            </ScrollArea>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              placeholder="Type your message..."
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={!phoneNumber || !message || sending}>
            {sending ? "Sending..." : "Send Message"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
