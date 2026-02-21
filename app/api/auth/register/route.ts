import { type NextRequest, NextResponse } from "next/server"
import { registerUser, loginUser } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, name } = body

    // Register the user
    const result = await registerUser(email, password, name)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    // Auto-login after registration
    const loginResult = await loginUser(email, password)

    if (!loginResult.success) {
      return NextResponse.json({ error: "Registration successful but login failed" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      user: loginResult.user,
    })
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
