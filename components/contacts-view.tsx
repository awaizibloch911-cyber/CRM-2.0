"use client"

import { useState } from "react"
import { Search, MessageSquare, Phone, MoreVertical, Mail, Building, MapPin } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useCRM } from "@/lib/crm-context"
import { AddContactDialog } from "./add-contact-dialog"
import type { Contact, Conversation } from "@/lib/types"

export function ContactsView() {
  const { contacts, deleteContact, conversations, addConversation, selectConversation, startCall, setCurrentView } =
    useCRM()
  const [searchQuery, setSearchQuery] = useState("")

  const filteredContacts = contacts.filter(
    (contact) =>
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.phone.includes(searchQuery) ||
      contact.company.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleMessage = (contact: Contact) => {
    // Find existing conversation or create new one
    let conv = conversations.find((c) => c.phone.replace(/\D/g, "") === contact.phone.replace(/\D/g, ""))

    if (!conv) {
      const newConv: Conversation = {
        id: Date.now().toString(),
        name: contact.name,
        phone: contact.phone,
        avatar: contact.avatar,
        lastMessage: "",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        unread: false,
        online: contact.online,
        type: "message",
        contactId: contact.id,
        messages: [],
      }
      addConversation(newConv)
      conv = newConv
    }

    selectConversation(conv)
    setCurrentView("conversations")
  }

  const handleCall = (contact: Contact) => {
    // Find existing conversation or create new one
    let conv = conversations.find((c) => c.phone.replace(/\D/g, "") === contact.phone.replace(/\D/g, ""))

    if (!conv) {
      const newConv: Conversation = {
        id: Date.now().toString(),
        name: contact.name,
        phone: contact.phone,
        avatar: contact.avatar,
        lastMessage: "Calling...",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        unread: false,
        online: contact.online,
        type: "call",
        callStatus: "outgoing",
        contactId: contact.id,
        messages: [],
      }
      addConversation(newConv)
      conv = newConv
    }

    selectConversation(conv)
    startCall(contact)
    setCurrentView("conversations")
  }

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Contacts</h1>
            <p className="text-muted-foreground">Manage your contacts</p>
          </div>
          <AddContactDialog />
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Contacts Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <p className="text-sm">No contacts found</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredContacts.map((contact) => (
              <div
                key={contact.id}
                className="border border-border rounded-lg p-4 bg-card hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={contact.avatar || "/placeholder.svg"} />
                        <AvatarFallback className="bg-muted">
                          {contact.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      {contact.online && (
                        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-green-500" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{contact.name}</h3>
                      <p className="text-sm text-muted-foreground">{contact.role}</p>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>Edit</DropdownMenuItem>
                      <DropdownMenuItem>Add Tags</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => deleteContact(contact.id)}>
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-2 mb-4 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span className="truncate">{contact.email || "No email"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>{contact.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Building className="h-4 w-4" />
                    <span>{contact.company || "No company"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{contact.location || "No location"}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    {contact.status}
                  </Badge>
                  {contact.tags.slice(0, 2).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 bg-transparent"
                    onClick={() => handleMessage(contact)}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Message
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 bg-transparent"
                    onClick={() => handleCall(contact)}
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Call
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
