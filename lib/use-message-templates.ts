"use client"

import { useState, useCallback, useEffect } from "react"
import type { MessageTemplate } from "./types"
import { useAuth } from "./auth-context"

const TEMPLATES_STORAGE_KEY = "crm_message_templates_"

export function useMessageTemplates() {
  const { user } = useAuth()
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Load templates from localStorage when user changes
  useEffect(() => {
    setIsLoading(true)
    if (user) {
      try {
        const storageKey = `${TEMPLATES_STORAGE_KEY}${user.id}`
        const stored = localStorage.getItem(storageKey)
        if (stored) {
          setTemplates(JSON.parse(stored))
        } else {
          setTemplates([])
        }
      } catch (error) {
        console.error("Error loading templates:", error)
        setTemplates([])
      }
    } else {
      setTemplates([])
    }
    setIsLoading(false)
  }, [user])

  const saveTemplates = useCallback(
    (newTemplates: MessageTemplate[]) => {
      if (!user) return
      try {
        const storageKey = `${TEMPLATES_STORAGE_KEY}${user.id}`
        localStorage.setItem(storageKey, JSON.stringify(newTemplates))
        setTemplates(newTemplates)
      } catch (error) {
        console.error("Error saving templates:", error)
      }
    },
    [user],
  )

  const addTemplate = useCallback(
    (name: string, content: string) => {
      const newTemplate: MessageTemplate = {
        id: Date.now().toString(),
        name,
        content,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      saveTemplates([...templates, newTemplate])
      return newTemplate
    },
    [templates, saveTemplates],
  )

  const updateTemplate = useCallback(
    (id: string, name: string, content: string) => {
      const updated = templates.map((t) =>
        t.id === id
          ? {
              ...t,
              name,
              content,
              updatedAt: new Date().toISOString(),
            }
          : t,
      )
      saveTemplates(updated)
    },
    [templates, saveTemplates],
  )

  const deleteTemplate = useCallback(
    (id: string) => {
      const filtered = templates.filter((t) => t.id !== id)
      saveTemplates(filtered)
    },
    [templates, saveTemplates],
  )

  return {
    templates,
    isLoading,
    addTemplate,
    updateTemplate,
    deleteTemplate,
  }
}
