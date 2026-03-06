'use client'

import { useContext } from 'react'
import { OnboardingContext } from '@/components/onboarding/OnboardingProvider'

export function useOnboarding() {
  const context = useContext(OnboardingContext)

  // Return a no-op if provider is not available
  if (!context) {
    return {
      startOnboarding: () => {},
      hasCompletedOnboarding: true
    }
  }

  return context
}
