"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCRM } from "@/lib/crm-context"
import { useCall } from "@/lib/call-context"
import { Phone, Delete, PhoneCall } from "lucide-react"

const dialPadButtons = [
  { digit: "1", letters: "" },
  { digit: "2", letters: "ABC" },
  { digit: "3", letters: "DEF" },
  { digit: "4", letters: "GHI" },
  { digit: "5", letters: "JKL" },
  { digit: "6", letters: "MNO" },
  { digit: "7", letters: "PQRS" },
  { digit: "8", letters: "TUV" },
  { digit: "9", letters: "WXYZ" },
  { digit: "*", letters: "" },
  { digit: "0", letters: "+" },
  { digit: "#", letters: "" },
]

const countryCodes = [
  { code: "+1", country: "USA", flag: "🇺🇸" },
  { code: "+1", country: "Canada", flag: "🇨🇦" },
]

export function DialPad() {
  const { contacts, conversations, addConversation, selectConversation } = useCRM()
  const { initiateCall } = useCall()
  const [open, setOpen] = useState(false)
  const [number, setNumber] = useState("")
  const [countryCode, setCountryCode] = useState("+1")
  const [calling, setCalling] = useState(false)

  const handleDigitPress = (digit: string) => {
    setNumber((prev) => prev + digit)
  }

  const handleDelete = () => {
    setNumber((prev) => prev.slice(0, -1))
  }

  const handleCall = async () => {
    if (!number.trim()) return

    setCalling(true)

    const fullNumber = `${countryCode}${number.replace(/\D/g, "")}`
    const normalizedPhone = fullNumber.replace(/\D/g, "")
    const contact = contacts.find((c) => c.phone.replace(/\D/g, "") === normalizedPhone)

    // Check if conversation exists or create new one
    let existingConv = conversations.find((c) => c.phone.replace(/\D/g, "") === normalizedPhone)

    if (!existingConv) {
      const newConv = {
        id: Date.now().toString(),
        name: contact?.name || fullNumber,
        phone: fullNumber,
        lastMessage: "Calling...",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        unread: false,
        online: false,
        type: "call" as const,
        callStatus: "outgoing" as const,
        contactId: contact?.id || "",
        messages: [],
      }
      addConversation(newConv)
      existingConv = newConv
    }

    selectConversation(existingConv)

    const callContact = contact || {
      id: Date.now().toString(),
      name: fullNumber,
      phone: fullNumber,
      email: "",
      company: "",
      role: "",
      location: "",
      status: "Unknown",
      online: false,
      tags: [],
      recentActivity: [],
    }

    // Close dialog first, then make call
    setOpen(false)
    setNumber("")
    setCalling(false)

    await initiateCall(callContact)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2 bg-transparent">
          <Phone className="h-4 w-4" />
          Dial
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Dial Pad</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Select value={countryCode} onValueChange={setCountryCode}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent>
              {countryCodes.map((country) => (
                <SelectItem key={`${country.country}-${country.code}`} value={country.code}>
                  <div className="flex items-center gap-2">
                    <span>{country.flag}</span>
                    <span>{country.country}</span>
                    <span className="text-muted-foreground">({country.code})</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Number Display */}
          <div className="relative">
            <div className="flex items-center gap-2">
              <span className="text-lg font-mono text-muted-foreground">{countryCode}</span>
              <Input
                value={number}
                onChange={(e) => setNumber(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="Enter number"
                className="text-center text-xl font-mono h-14 pr-10 flex-1"
              />
            </div>
            {number && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                onClick={handleDelete}
              >
                <Delete className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Dial Pad Grid */}
          <div className="grid grid-cols-3 gap-2">
            {dialPadButtons.map(({ digit, letters }) => (
              <Button
                key={digit}
                variant="outline"
                className="h-16 flex-col gap-0 bg-transparent"
                onClick={() => handleDigitPress(digit)}
              >
                <span className="text-xl font-semibold">{digit}</span>
                {letters && <span className="text-[10px] text-muted-foreground">{letters}</span>}
              </Button>
            ))}
          </div>

          {/* Call Button */}
          <Button className="w-full h-14 gap-2" onClick={handleCall} disabled={!number || calling}>
            <PhoneCall className="h-5 w-5" />
            {calling ? "Calling..." : "Call"}
          </Button>

          {/* Note about USA/Canada only */}
          <p className="text-xs text-center text-muted-foreground">Only USA and Canada numbers are supported</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
