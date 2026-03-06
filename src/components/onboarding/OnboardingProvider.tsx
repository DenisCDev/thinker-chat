'use client'

import { createContext, useContext, useCallback, useEffect, useState, useRef, ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { startTour, checkAndStartTour } from './OnboardingTour'

interface OnboardingContextType {
  startOnboarding: () => void
  hasCompletedOnboarding: boolean
}

export const OnboardingContext = createContext<OnboardingContextType | null>(null)

interface OnboardingProviderProps {
  children: ReactNode
  userId: string
}

export function OnboardingProvider({
  children,
  userId,
}: OnboardingProviderProps) {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(`onboarding-${userId}`) === 'true'
  })
  const [hasAutoStarted, setHasAutoStarted] = useState(false)
  const pathname = usePathname()

  const markOnboardingComplete = useCallback(() => {
    localStorage.setItem(`onboarding-${userId}`, 'true')
    setHasCompletedOnboarding(true)
  }, [userId])

  const tourCompleteCallback = useCallback(() => {
    if (!hasCompletedOnboarding) {
      markOnboardingComplete()
    }
  }, [hasCompletedOnboarding, markOnboardingComplete])

  const startOnboardingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const startOnboarding = useCallback(() => {
    if (startOnboardingTimeoutRef.current) {
      clearTimeout(startOnboardingTimeoutRef.current)
    }
    startOnboardingTimeoutRef.current = setTimeout(() => {
      startTour(tourCompleteCallback)
      startOnboardingTimeoutRef.current = null
    }, 300)
  }, [tourCompleteCallback])

  useEffect(() => {
    return () => {
      if (startOnboardingTimeoutRef.current) {
        clearTimeout(startOnboardingTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (pathname === '/chat') {
      checkAndStartTour(tourCompleteCallback)
    }
  }, [pathname, tourCompleteCallback])

  useEffect(() => {
    if (!hasCompletedOnboarding && !hasAutoStarted && userId) {
      setHasAutoStarted(true)
      markOnboardingComplete()
      const timer = setTimeout(() => {
        startOnboarding()
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [hasCompletedOnboarding, hasAutoStarted, userId, startOnboarding, markOnboardingComplete])

  return (
    <OnboardingContext.Provider value={{ startOnboarding, hasCompletedOnboarding }}>
      {children}
    </OnboardingContext.Provider>
  )
}

export function useOnboardingContext() {
  const context = useContext(OnboardingContext)
  if (!context) {
    throw new Error('useOnboardingContext must be used within OnboardingProvider')
  }
  return context
}
