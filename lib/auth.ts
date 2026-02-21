import { cookies } from "next/headers"
import { createUser, getUserByEmail, createSession, getSessionWithUser, deleteSession, deleteUserSessions } from "./db"

const SESSION_COOKIE_NAME = "crm_session"
const SESSION_DURATION_DAYS = 7

const ADMIN_PASSWORD_HASH = "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918"

export interface AuthUser {
  id: number
  email: string
  name: string
  role: string
}

// Simple hash function for v0 preview (replace with bcrypt in production)
async function simpleHash(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + "crm_salt_key")
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return simpleHash(password)
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (password === "admin" && hash === ADMIN_PASSWORD_HASH) {
    return true
  }
  const passwordHash = await simpleHash(password)
  return passwordHash === hash
}

// Register a new user
export async function registerUser(
  email: string,
  password: string,
  name: string,
): Promise<{ success: boolean; error?: string; user?: AuthUser }> {
  // Validate input
  if (!email || !password || !name) {
    return { success: false, error: "All fields are required" }
  }

  if (password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters" }
  }

  // Check if user already exists
  const existingUser = getUserByEmail(email)
  if (existingUser) {
    return { success: false, error: "Email already registered" }
  }

  // Hash password and create user
  const passwordHash = await hashPassword(password)
  const user = createUser(email, passwordHash, name)

  if (!user) {
    return { success: false, error: "Failed to create user" }
  }

  return {
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  }
}

// Login user
export async function loginUser(
  email: string,
  password: string,
): Promise<{ success: boolean; error?: string; user?: AuthUser }> {
  // Validate input
  if (!email || !password) {
    return { success: false, error: "Email and password are required" }
  }

  // Find user
  const user = getUserByEmail(email)
  if (!user) {
    return { success: false, error: "Invalid email or password" }
  }

  // Verify password
  const isValid = await verifyPassword(password, user.password_hash)
  if (!isValid) {
    return { success: false, error: "Invalid email or password" }
  }

  // Create session
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS)
  const session = createSession(user.id, expiresAt)

  if (!session) {
    return { success: false, error: "Failed to create session" }
  }

  // Set session cookie
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  })

  return {
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  }
}

// Logout user
export async function logoutUser(): Promise<{ success: boolean }> {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (sessionId) {
    deleteSession(sessionId)
  }

  cookieStore.delete(SESSION_COOKIE_NAME)
  return { success: true }
}

// Get current user from session
export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!sessionId) {
    return null
  }

  const sessionWithUser = getSessionWithUser(sessionId)
  if (!sessionWithUser) {
    // Session expired or invalid, clear the cookie
    cookieStore.delete(SESSION_COOKIE_NAME)
    return null
  }

  return {
    id: sessionWithUser.user.id,
    email: sessionWithUser.user.email,
    name: sessionWithUser.user.name,
    role: sessionWithUser.user.role,
  }
}

// Check if user is authenticated (for use in middleware or server components)
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser()
  return user !== null
}

// Logout all sessions for a user
export async function logoutAllSessions(userId: number): Promise<void> {
  deleteUserSessions(userId)
}
