"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

export interface AuthUser {
  id: number
  email: string
  name: string
  role: string
}

export interface UserTwilioConfig {
  accountSid: string
  authToken: string
  phoneNumber: string
}

interface AuthContextType {
  user: AuthUser | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  twilioConfig: UserTwilioConfig | null
  saveTwilioConfig: (config: UserTwilioConfig) => void
  removeTwilioConfig: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const STORAGE_KEY = "crm_auth_user"
const TWILIO_STORAGE_PREFIX = "crm_twilio_config_"

// Default admin user credentials
const ADMIN_USER: AuthUser = {
  id: 1,
  email: "admin",
  name: "Administrator",
  role: "admin",
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [twilioConfig, setTwilioConfig] = useState<UserTwilioConfig | null>(null)

  // Load user from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsedUser = JSON.parse(stored)
        setUser(parsedUser)
        // Load user's Twilio config
        const twilioStored = localStorage.getItem(`${TWILIO_STORAGE_PREFIX}${parsedUser.id}`)
        if (twilioStored) {
          setTwilioConfig(JSON.parse(twilioStored))
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
    setIsLoading(false)
  }, [])

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    // Validate admin credentials
    if (email === "admin" && password === "admin") {
      setUser(ADMIN_USER)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ADMIN_USER))
      // Load admin's Twilio config if exists
      const twilioStored = localStorage.getItem(`${TWILIO_STORAGE_PREFIX}${ADMIN_USER.id}`)
      if (twilioStored) {
        setTwilioConfig(JSON.parse(twilioStored))
      } else {
        setTwilioConfig(null)
      }
      return { success: true }
    }

    // Check for registered users in localStorage
    const registeredUsers = JSON.parse(localStorage.getItem("crm_registered_users") || "[]")
    const foundUser = registeredUsers.find((u: any) => u.email === email && u.password === password)

    if (foundUser) {
      const authUser: AuthUser = {
        id: foundUser.id,
        email: foundUser.email,
        name: foundUser.name,
        role: "user",
      }
      setUser(authUser)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser))
      // Load user's Twilio config if exists
      const twilioStored = localStorage.getItem(`${TWILIO_STORAGE_PREFIX}${authUser.id}`)
      if (twilioStored) {
        setTwilioConfig(JSON.parse(twilioStored))
      } else {
        setTwilioConfig(null)
      }
      return { success: true }
    }

    return { success: false, error: "Invalid username or password" }
  }

  const logout = () => {
    setUser(null)
    setTwilioConfig(null)
    localStorage.removeItem(STORAGE_KEY)
  }

  const saveTwilioConfig = (config: UserTwilioConfig) => {
    if (!user) return
    setTwilioConfig(config)
    localStorage.setItem(`${TWILIO_STORAGE_PREFIX}${user.id}`, JSON.stringify(config))
  }

  const removeTwilioConfig = () => {
    if (!user) return
    setTwilioConfig(null)
    localStorage.removeItem(`${TWILIO_STORAGE_PREFIX}${user.id}`)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        twilioConfig,
        saveTwilioConfig,
        removeTwilioConfig,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

// Helper to register new users (stored in localStorage)
export function registerUser(email: string, password: string, name: string): { success: boolean; error?: string } {
  if (email === "admin") {
    return { success: false, error: "This username is reserved" }
  }

  const registeredUsers = JSON.parse(localStorage.getItem("crm_registered_users") || "[]")

  if (registeredUsers.some((u: any) => u.email === email)) {
    return { success: false, error: "Username already exists" }
  }

  const newUser = {
    id: Date.now(),
    email,
    password,
    name,
  }

  registeredUsers.push(newUser)
  localStorage.setItem("crm_registered_users", JSON.stringify(registeredUsers))

  return { success: true }
}
