// This can be replaced with better-sqlite3 or sql.js when running locally

// In-memory storage (simulates SQLite for v0 preview)
interface User {
  id: number
  email: string
  password_hash: string
  name: string
  role: string
  created_at: string
  updated_at: string
}

interface Session {
  id: string
  user_id: number
  expires_at: string
  created_at: string
}

// Global in-memory store
const store = {
  users: new Map<number, User>(),
  sessions: new Map<string, Session>(),
  userIdCounter: 1,
  initialized: false,
}

// Pre-computed hash for "admin" password using SHA-256 with salt "crm_salt_key"
const ADMIN_PASSWORD_HASH = "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918"

function initializeDefaultUser() {
  if (store.initialized) return

  const now = new Date().toISOString()
  const adminUser: User = {
    id: store.userIdCounter++,
    email: "admin",
    password_hash: ADMIN_PASSWORD_HASH,
    name: "Administrator",
    role: "admin",
    created_at: now,
    updated_at: now,
  }
  store.users.set(adminUser.id, adminUser)
  store.initialized = true
}

// Initialize on module load
initializeDefaultUser()

// User type definition
export interface DbUser {
  id: number
  email: string
  password_hash: string
  name: string
  role: string
  created_at: string
  updated_at: string
}

export interface DbSession {
  id: string
  user_id: number
  expires_at: string
  created_at: string
}

// User CRUD operations
export function createUser(email: string, passwordHash: string, name: string): DbUser | null {
  try {
    // Check if email already exists
    for (const user of store.users.values()) {
      if (user.email === email) {
        return null
      }
    }

    const now = new Date().toISOString()
    const user: User = {
      id: store.userIdCounter++,
      email,
      password_hash: passwordHash,
      name,
      role: "user",
      created_at: now,
      updated_at: now,
    }
    store.users.set(user.id, user)
    return user
  } catch (error) {
    console.error("Error creating user:", error)
    return null
  }
}

export function getUserById(id: number): DbUser | null {
  return store.users.get(id) || null
}

export function getUserByEmail(email: string): DbUser | null {
  for (const user of store.users.values()) {
    if (user.email === email) {
      return user
    }
  }
  return null
}

// Session operations
export function createSession(userId: number, expiresAt: Date): DbSession | null {
  const sessionId = generateSessionId()
  try {
    const session: Session = {
      id: sessionId,
      user_id: userId,
      expires_at: expiresAt.toISOString(),
      created_at: new Date().toISOString(),
    }
    store.sessions.set(sessionId, session)
    return session
  } catch (error) {
    console.error("Error creating session:", error)
    return null
  }
}

export function getSession(sessionId: string): DbSession | null {
  return store.sessions.get(sessionId) || null
}

export function getSessionWithUser(sessionId: string): (DbSession & { user: Omit<DbUser, "password_hash"> }) | null {
  const session = store.sessions.get(sessionId)
  if (!session) return null

  // Check if session is expired
  if (new Date(session.expires_at) < new Date()) {
    store.sessions.delete(sessionId)
    return null
  }

  const user = store.users.get(session.user_id)
  if (!user) return null

  return {
    ...session,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      created_at: user.created_at,
      updated_at: user.updated_at,
    },
  }
}

export function deleteSession(sessionId: string): boolean {
  return store.sessions.delete(sessionId)
}

export function deleteExpiredSessions(): number {
  let count = 0
  const now = new Date()
  for (const [id, session] of store.sessions.entries()) {
    if (new Date(session.expires_at) < now) {
      store.sessions.delete(id)
      count++
    }
  }
  return count
}

export function deleteUserSessions(userId: number): number {
  let count = 0
  for (const [id, session] of store.sessions.entries()) {
    if (session.user_id === userId) {
      store.sessions.delete(id)
      count++
    }
  }
  return count
}

// Utility function to generate a secure session ID
function generateSessionId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let result = ""
  const randomValues = new Uint8Array(32)
  crypto.getRandomValues(randomValues)
  for (let i = 0; i < 32; i++) {
    result += chars[randomValues[i] % chars.length]
  }
  return result
}
