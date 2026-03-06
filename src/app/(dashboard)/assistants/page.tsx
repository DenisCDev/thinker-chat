'use client'

import { useRouter } from 'next/navigation'
import { useChatStore } from '@/stores/chatStore'
import { Button } from '@/components/ui/button'
import { AssistantIcon } from '@/components/shared/AssistantIcon'
import { Assistant } from '@/types/database'
import { Brain } from '@phosphor-icons/react'

// Colors for icon containers - rotating through sage/lime tones
const iconColors = [
  'bg-emerald-600/80 dark:bg-emerald-500/20',
  'bg-emerald-500/80 dark:bg-emerald-400/20',
  'bg-teal-600/80 dark:bg-teal-500/20',
  'bg-green-600/80 dark:bg-green-500/20',
  'bg-emerald-700/80 dark:bg-emerald-600/20',
  'bg-teal-500/80 dark:bg-teal-400/20',
  'bg-green-500/80 dark:bg-green-400/20',
]

export default function AssistantsPage() {
  const router = useRouter()
  const assistants = useChatStore((s) => s.assistants)
  const setSelectedAssistant = useChatStore((s) => s.setSelectedAssistant)
  const setActiveConversation = useChatStore((s) => s.setActiveConversation)

  const handleSelectAssistant = (assistant: Assistant) => {
    setSelectedAssistant(assistant)
    setActiveConversation(null)
    router.push('/chat')
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-6 py-12">
      {/* Header Section */}
      <div className="text-center mb-12 max-w-2xl">
        {/* Logo Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-10 h-10 text-lime flex items-center justify-center">
            <Brain className="w-8 h-8" />
          </div>
        </div>

        {/* Title with serif font */}
        <h1 className="font-display text-4xl md:text-5xl mb-4">
          Bem-vindo ao Thinker
        </h1>

        {/* Subtitle */}
        <p className="text-muted-foreground text-lg">
          Escolha um assistente especializado para comecar
        </p>
      </div>

      {/* Cards Grid */}
      <div className="flex flex-wrap justify-center gap-4 max-w-7xl w-full mb-12 px-2">
        {assistants.map((assistant, index) => (
          <div
            key={assistant.id}
            onClick={() => handleSelectAssistant(assistant)}
            className="group bg-card rounded-2xl p-5 cursor-pointer card-hover border border-border/50 hover:border-border w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.67rem)] xl:w-[calc(20%-0.8rem)] min-w-[170px]"
          >
            {/* Number Badge */}
            <div className="flex justify-center mb-4">
              <div className="number-badge">
                {index + 1}
              </div>
            </div>

            {/* Title with serif */}
            <h3 className="font-display text-lg text-center mb-5">
              {assistant.name}
            </h3>

            {/* Icon Container */}
            <div className="flex justify-center mb-5">
              <div className={`icon-container ${iconColors[index % iconColors.length]}`}>
                <AssistantIcon
                  iconUrl={assistant.icon_url}
                  size="lg"
                  className="text-white drop-shadow-sm"
                />
              </div>
            </div>

            {/* Description */}
            <p className="text-sm text-muted-foreground text-center line-clamp-3">
              {assistant.description}
            </p>
          </div>
        ))}
      </div>

      {/* CTA Button */}
      {assistants.length > 0 && (
        <Button
          onClick={() => handleSelectAssistant(assistants[0])}
          variant="lime"
          size="lg"
          className="lime-glow"
        >
          Comecar agora
        </Button>
      )}

      {/* Empty State */}
      {assistants.length === 0 && (
        <div className="text-center py-12 bg-card rounded-2xl px-8 border border-border/50">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
            <Brain className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">
            Nenhum assistente disponivel no momento.
          </p>
        </div>
      )}
    </div>
  )
}
