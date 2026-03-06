'use client'

import { driver, DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'
import type { Assistant } from '@/types/database'

// Build dynamic tour steps based on assistants
function buildTourSteps(assistants: Assistant[]): DriveStep[] {
  // Build dynamic assistant list
  const assistantNames = assistants.map(a => a.name).join(', ')
  const assistantCount = assistants.length

  return [
    {
      element: '[data-tour="new-chat"]',
      popover: {
        title: 'Novo Chat',
        description: 'Clique aqui para iniciar uma nova conversa com um dos nossos assistentes especializados.',
        side: 'right',
        align: 'start'
      }
    },
    {
      element: '[data-tour="assistants"]',
      popover: {
        title: 'Galeria de Assistentes',
        description: `Explore ${assistantCount > 0 ? `todos os nossos ${assistantCount} assistentes: ${assistantNames}` : 'nossos assistentes especializados'}.`,
        side: 'right',
        align: 'start'
      }
    },
    {
      element: '[data-tour="search"]',
      popover: {
        title: 'Pesquisa',
        description: 'Busque rapidamente em todas as suas conversas anteriores.',
        side: 'right',
        align: 'start'
      }
    },
    {
      element: '[data-tour="folders"]',
      popover: {
        title: 'Pastas e Conversas',
        description: 'Crie pastas para organizar suas conversas por tema ou projeto.',
        side: 'right',
        align: 'start'
      }
    },
    {
      element: '[data-tour="assistant-selector"]',
      popover: {
        title: 'Trocar Assistente',
        description: 'Durante uma conversa, troque de assistente a qualquer momento. O contexto sera mantido! Voce tambem pode digitar @ no campo de mensagem para trocar rapidamente.',
        side: 'bottom',
        align: 'start'
      }
    },
    {
      element: '[data-tour="chat-tools"]',
      popover: {
        title: 'Ferramentas do Chat',
        description: 'Anexe arquivos (PDF, documentos ou imagens), grave mensagens de audio ou ative a pesquisa em sites oficiais de legislacao para respostas mais precisas.',
        side: 'top',
        align: 'start'
      }
    },
    {
      element: '[data-tour="user-menu"]',
      popover: {
        title: 'Seu Perfil',
        description: 'Acesse seu perfil, configuracoes e retorne a este tutorial quando precisar clicando em "Ver tutorial".',
        side: 'bottom',
        align: 'end'
      }
    }
  ]
}

export function createTourDriver(onComplete?: () => void, assistants: Assistant[] = []) {
  const tourSteps = buildTourSteps(assistants)

  const driverObj = driver({
    showProgress: true,
    progressText: '{{current}} de {{total}}',
    nextBtnText: 'Proximo',
    prevBtnText: 'Anterior',
    doneBtnText: 'Concluir',
    popoverClass: 'thinker-tour-popover',
    overlayColor: 'rgba(0, 0, 0, 0.75)',
    steps: tourSteps,
    onDestroyStarted: () => {
      if (driverObj.hasNextStep()) {
        // User clicked outside or pressed escape
        driverObj.destroy()
      } else {
        // Tour completed
        onComplete?.()
        driverObj.destroy()
      }
    }
  })

  return driverObj
}

export async function startTour(onComplete?: () => void) {
  // Fetch assistants for dynamic content
  let assistants: Assistant[] = []
  try {
    const response = await fetch('/api/assistants')
    if (response.ok) {
      assistants = await response.json()
    }
  } catch (error) {
    console.error('Failed to fetch assistants for tour:', error)
  }

  // Navigate to /chat to ensure all tour elements are visible
  if (window.location.pathname !== '/chat') {
    window.location.href = '/chat'
    // Store in sessionStorage to start tour after navigation
    sessionStorage.setItem('startTourAfterNav', 'true')
    return
  }

  const driverObj = createTourDriver(onComplete, assistants)
  driverObj.drive()
  return driverObj
}

// Check if we should start tour after navigation
export function checkAndStartTour(onComplete?: () => void) {
  if (sessionStorage.getItem('startTourAfterNav') === 'true') {
    sessionStorage.removeItem('startTourAfterNav')
    // Small delay to ensure DOM is ready
    setTimeout(() => {
      startTour(onComplete)
    }, 500)
  }
}
