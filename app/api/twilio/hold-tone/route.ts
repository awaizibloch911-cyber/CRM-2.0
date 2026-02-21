import { NextResponse } from "next/server"

// Generate a simple hold tone as audio data
export async function GET() {
  // Return a simple audio file URL or generate tone
  // Using a public domain hold music URL
  return NextResponse.redirect("https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3")
}
