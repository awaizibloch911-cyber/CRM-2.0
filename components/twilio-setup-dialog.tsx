"use client"

import { useState, useEffect, type ReactNode } from "react"
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
import { Label } from "@/components/ui/label"
import { useCRM } from "@/lib/crm-context"
import { CheckCircle, XCircle, Loader2, Plus, Trash2, Shield } from "lucide-react"

export function TwilioSetupDialog({ children }: { children: ReactNode }) {
  const { twilioConfig, setTwilioConfig, isTwilioConfigured, syncHistory, isSyncing } = useCRM()
  const [open, setOpen] = useState(false)
  const [accountSid, setAccountSid] = useState("")
  const [authToken, setAuthToken] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null)
  const [showSavedIndicator, setShowSavedIndicator] = useState(false)

  useEffect(() => {
    if (open && twilioConfig) {
      setAccountSid(twilioConfig.accountSid)
      setAuthToken(twilioConfig.authToken)
      setPhoneNumber(twilioConfig.phoneNumber)
    }
  }, [open, twilioConfig])

  const handleAdd = () => {
    if (accountSid && authToken && phoneNumber) {
      setTwilioConfig({ accountSid, authToken, phoneNumber })
      setShowSavedIndicator(true)
      setTimeout(() => setShowSavedIndicator(false), 3000)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch("/api/twilio/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountSid, authToken }),
      })
      setTestResult(res.ok ? "success" : "error")
    } catch {
      setTestResult("error")
    }
    setTesting(false)
  }

  const handleRemove = () => {
    setTwilioConfig(null)
    setAccountSid("")
    setAuthToken("")
    setPhoneNumber("")
    setTestResult(null)
    setShowSavedIndicator(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Twilio Configuration</DialogTitle>
          <DialogDescription>Connect your Twilio account to send/receive SMS and make calls.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isTwilioConfigured && (
            <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-500">
              <Shield className="h-5 w-5" />
              <div className="flex-1">
                <span className="text-sm font-medium">Twilio Connected</span>
                <p className="text-xs text-green-500/70">Credentials securely saved to your account</p>
              </div>
            </div>
          )}

          {showSavedIndicator && (
            <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-500 animate-pulse">
              <CheckCircle className="h-5 w-5" />
              <span className="text-sm font-medium">Credentials saved successfully!</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="accountSid">Account SID</Label>
            <Input
              id="accountSid"
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={accountSid}
              onChange={(e) => setAccountSid(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="authToken">Auth Token</Label>
            <Input
              id="authToken"
              type="password"
              placeholder="Your auth token"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Twilio Phone Number</Label>
            <Input
              id="phoneNumber"
              placeholder="+1234567890"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
          </div>

          {testResult && (
            <div
              className={`flex items-center gap-2 p-3 rounded-lg border ${
                testResult === "success"
                  ? "bg-green-500/10 border-green-500/20 text-green-500"
                  : "bg-red-500/10 border-red-500/20 text-red-500"
              }`}
            >
              {testResult === "success" ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
              <span className="text-sm font-medium">
                {testResult === "success" ? "Connection successful!" : "Connection failed"}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleTest} disabled={testing || !accountSid || !authToken}>
            {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Test Connection
          </Button>

          <Button onClick={handleAdd} disabled={!accountSid || !authToken || !phoneNumber} className="gap-2">
            <Plus className="h-4 w-4" />
            Add
          </Button>

          {isTwilioConfigured && (
            <>
              <Button variant="outline" onClick={syncHistory} disabled={isSyncing}>
                {isSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Sync History
              </Button>

              <Button variant="destructive" onClick={handleRemove} className="gap-2">
                <Trash2 className="h-4 w-4" />
                Remove
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
