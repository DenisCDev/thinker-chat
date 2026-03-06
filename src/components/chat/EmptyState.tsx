'use client'

import { useChatStore } from '@/stores/chatStore'
import { AssistantIcon } from '@/components/shared/AssistantIcon'
import type { Assistant } from '@/types/database'
import { Brain } from '@phosphor-icons/react'

// Colors for icon containers - rotating through sage/lime tones
const iconColors = [
  'bg-[#a8c5b5]',
  'bg-[#c9d99e]',
  'bg-[#b8c9a0]',
  'bg-[#d4dbb8]',
  'bg-[#9fb8a8]',
]

interface EmptyStateProps {
  onSuggestionClick?: (text: string) => void
}

export function EmptyState({ onSuggestionClick }: EmptyStateProps) {
  const selectedAssistant = useChatStore((s) => s.selectedAssistant)
  const assistants = useChatStore((s) => s.assistants)

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      {/* Logo when no assistant selected */}
      {!selectedAssistant && (
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 text-lime flex items-center justify-center">
            <Brain className="w-10 h-10" />
          </div>
        </div>
      )}

      {/* Icon when assistant is selected */}
      {selectedAssistant && (
        <div className="mb-4">
          <div className="icon-container bg-sage">
            <AssistantIcon iconUrl={selectedAssistant?.icon_url} size="lg" className="text-white drop-shadow-sm" />
          </div>
        </div>
      )}

      <h2 className="font-display text-2xl mb-2">
        {selectedAssistant
          ? `${selectedAssistant.name}`
          : 'Bem-vindo ao Thinker'}
      </h2>
      <p className="text-muted-foreground max-w-md mb-6">
        {selectedAssistant?.description ||
          'Escolha um dos nossos assistentes especializados para comecar.'}
      </p>

      {!selectedAssistant && assistants.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
          {assistants.slice(0, 4).map((assistant, index) => (
            <AssistantSuggestion key={assistant.id} assistant={assistant} colorIndex={index} />
          ))}
        </div>
      )}

      {selectedAssistant && selectedAssistant.sample_questions && selectedAssistant.sample_questions.length > 0 && (
        <div className="text-sm text-muted-foreground">
          <p>Algumas sugestoes para comecar:</p>
          <div className="flex flex-col items-center gap-2 mt-3">
            {/* First row: 3 questions */}
            <div className="flex flex-wrap gap-2 justify-center">
              {selectedAssistant.sample_questions.slice(0, 3).map((question, index) => (
                <SuggestionChip key={index} text={question} onClick={onSuggestionClick} />
              ))}
            </div>
            {/* Second row: 2 questions */}
            {selectedAssistant.sample_questions.length > 3 && (
              <div className="flex flex-wrap gap-2 justify-center">
                {selectedAssistant.sample_questions.slice(3, 5).map((question, index) => (
                  <SuggestionChip key={index + 3} text={question} onClick={onSuggestionClick} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function AssistantSuggestion({ assistant, colorIndex }: { assistant: Assistant; colorIndex: number }) {
  const setSelectedAssistant = useChatStore((s) => s.setSelectedAssistant)

  return (
    <button
      onClick={() => setSelectedAssistant(assistant)}
      className="p-4 bg-card border border-border/50 rounded-xl text-left hover:border-border hover:shadow-lg transition-all card-hover"
    >
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconColors[colorIndex % iconColors.length]}`}>
          <AssistantIcon iconUrl={assistant.icon_url} size="sm" className="text-white drop-shadow-sm" />
        </div>
        <span className="font-medium text-sm">{assistant.name}</span>
      </div>
      {assistant.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">
          {assistant.description}
        </p>
      )}
    </button>
  )
}

function SuggestionChip({ text, onClick }: { text: string; onClick?: (text: string) => void }) {
  return (
    <button
      onClick={() => onClick?.(text)}
      className="px-3 py-1.5 bg-card border border-border/50 rounded-full text-xs hover:border-lime hover:text-lime transition-colors"
    >
      {text}
    </button>
  )
}
