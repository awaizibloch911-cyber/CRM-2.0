import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { CRMProvider } from "@/lib/crm-context"
import { AuthProvider } from "@/lib/auth-context"
import { CallProvider } from "@/lib/call-context"
import { RealtimeInboxProvider } from "@/components/realtime-inbox-provider"
import { InAppNotificationToast } from "@/components/in-app-notification-toast"
import { IncomingCallScreen } from "@/components/incoming-call-screen"
import { ActiveCallOverlay } from "@/components/active-call-overlay"
import { CallNotificationHandler } from "@/components/call-notification-handler"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "FlowCRM - Unified Communications",
  description: "All-in-one CRM with messaging, calls, and contact management",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        <AuthProvider>
          <CRMProvider>
            <CallProvider>
              <RealtimeInboxProvider>
                {children}
                <InAppNotificationToast />
                <IncomingCallScreen />
                <ActiveCallOverlay />
                <CallNotificationHandler />
              </RealtimeInboxProvider>
            </CallProvider>
          </CRMProvider>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
