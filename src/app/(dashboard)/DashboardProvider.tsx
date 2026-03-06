'use client'

import { useEffect, useRef } from 'react'
import { useChatStore } from '@/stores/chatStore'
import { Assistant } from '@/types/database'

interface UserData {
  id: string
  email: string
}

interface DashboardProviderProps {
  children: React.ReactNode
  assistants: Assistant[]
  user: UserData
}

export function DashboardProvider({ children, assistants, user }: DashboardProviderProps) {
  const setAssistants = useChatStore((s) => s.setAssistants)
  const setSelectedAssistant = useChatStore((s) => s.setSelectedAssistant)
  const selectedAssistant = useChatStore((s) => s.selectedAssistant)
  const setUser = useChatStore((s) => s.setUser)
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      setAssistants(assistants)
      setUser(user)
      if (!selectedAssistant && assistants.length > 0) {
        setSelectedAssistant(assistants[0])
      }
    }
  }, [assistants, setAssistants, setSelectedAssistant, selectedAssistant, user, setUser])

  return <>{children}</>
}
