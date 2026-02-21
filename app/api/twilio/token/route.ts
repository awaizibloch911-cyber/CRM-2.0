import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { config, identity } = await req.json()

    if (!config?.accountSid || !config?.authToken || !config?.phoneNumber) {
      return NextResponse.json({ error: "Twilio not configured" }, { status: 400 })
    }

    const baseUrl = req.headers.get("origin") || req.nextUrl.origin
    console.log("[v0] Token request - baseUrl:", baseUrl)

    let apiKeySid: string | null = null
    let apiKeySecret: string | null = null

    const apiKeyResponse = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Keys.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        FriendlyName: `CRM-Key-${Date.now()}`,
      }),
    })

    if (apiKeyResponse.ok) {
      const keyData = await apiKeyResponse.json()
      apiKeySid = keyData.sid
      apiKeySecret = keyData.secret
      console.log("[v0] Created API Key:", apiKeySid)
    } else {
      const errorText = await apiKeyResponse.text()
      console.error("[v0] Failed to create API key:", errorText)
      return NextResponse.json({ error: "Failed to create API key for voice access" }, { status: 500 })
    }

    let twimlAppSid: string | null = null

    // Try to find existing app first
    const listResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Applications.json?PageSize=50`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`,
        },
      },
    )

    if (listResponse.ok) {
      const listData = await listResponse.json()
      const existingApp = listData.applications?.find(
        (app: { friendly_name: string }) => app.friendly_name === "CRM Voice App",
      )

      if (existingApp) {
        twimlAppSid = existingApp.sid

        // Update the voice URL to current baseUrl
        await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Applications/${twimlAppSid}.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              VoiceUrl: `${baseUrl}/api/twilio/voice`,
              VoiceMethod: "POST",
            }),
          },
        )
        console.log("[v0] Updated existing TwiML App:", twimlAppSid)
      }
    }

    // Create new TwiML app if none exists
    if (!twimlAppSid) {
      const appResponse = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Applications.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            FriendlyName: "CRM Voice App",
            VoiceUrl: `${baseUrl}/api/twilio/voice`,
            VoiceMethod: "POST",
          }),
        },
      )

      if (appResponse.ok) {
        const appData = await appResponse.json()
        twimlAppSid = appData.sid
        console.log("[v0] Created TwiML App:", twimlAppSid)
      } else {
        const errorText = await appResponse.text()
        console.error("[v0] Failed to create TwiML App:", errorText)
        return NextResponse.json({ error: "Failed to create TwiML App" }, { status: 500 })
      }
    }

    const now = Math.floor(Date.now() / 1000)
    const expiry = now + 3600

    const header = {
      typ: "JWT",
      alg: "HS256",
      cty: "twilio-fpa;v=1",
    }

    const payload = {
      jti: `${apiKeySid}-${now}`,
      iss: apiKeySid,
      sub: config.accountSid,
      nbf: now,
      exp: expiry,
      grants: {
        identity: identity || "crm-user",
        voice: {
          incoming: {
            allow: true,
          },
          outgoing: {
            application_sid: twimlAppSid,
          },
        },
      },
    }

    const base64UrlEncode = (obj: object) => {
      const str = JSON.stringify(obj)
      const base64 = Buffer.from(str).toString("base64")
      return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
    }

    const headerEncoded = base64UrlEncode(header)
    const payloadEncoded = base64UrlEncode(payload)

    const encoder = new TextEncoder()
    const data = encoder.encode(`${headerEncoded}.${payloadEncoded}`)
    const keyData = encoder.encode(apiKeySecret!)

    const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])

    const signature = await crypto.subtle.sign("HMAC", cryptoKey, data)
    const signatureEncoded = Buffer.from(signature)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "")

    const token = `${headerEncoded}.${payloadEncoded}.${signatureEncoded}`

    console.log("[v0] Generated access token for identity:", identity || "crm-user")

    return NextResponse.json({
      token,
      identity: identity || "crm-user",
      twimlAppSid,
    })
  } catch (error) {
    console.error("[v0] Token generation error:", error)
    return NextResponse.json({ error: "Failed to generate token" }, { status: 500 })
  }
}
