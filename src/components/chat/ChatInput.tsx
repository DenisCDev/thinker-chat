'use client'

import { useRef, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { AssistantIcon } from '@/components/shared/AssistantIcon'
import { cn } from '@/lib/utils'
import { ArrowCircleUp, CircleNotch } from '@phosphor-icons/react'
import type { Assistant } from '@/types/database'

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  isLoading: boolean
  placeholder?: string
  assistants?: Assistant[]
  onSelectAssistant?: (assistant: Assistant) => void
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  isLoading,
  placeholder = 'Digite sua mensagem...',
  assistants = [],
  onSelectAssistant,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // @mention state (assistants)
  const [showMentionDropdown, setShowMentionDropdown] = useState(false)
  const [mentionFilter, setMentionFilter] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const filteredAssistants = assistants.filter((a) =>
    a.name.toLowerCase().includes(mentionFilter.toLowerCase())
  )

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }, [value])

  useEffect(() => {
    setSelectedIndex(0)
  }, [filteredAssistants.length])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        textareaRef.current &&
        !textareaRef.current.contains(target)
      ) {
        setShowMentionDropdown(false)
      }
    }

    if (showMentionDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMentionDropdown])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    const cursorPos = e.target.selectionStart || 0
    const textBeforeCursor = newValue.slice(0, cursorPos)

    const lastAtIndex = textBeforeCursor.lastIndexOf('@')
    if (lastAtIndex !== -1) {
      const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' '
      if (charBeforeAt === ' ' || charBeforeAt === '\n' || lastAtIndex === 0) {
        const filter = textBeforeCursor.slice(lastAtIndex + 1)
        if (!filter.includes(' ')) {
          setShowMentionDropdown(true)
          setMentionFilter(filter)
          onChange(newValue)
          return
        }
      }
    }
    setShowMentionDropdown(false)

    onChange(newValue)
  }

  const handleSelectMention = (assistant: Assistant) => {
    onSelectAssistant?.(assistant)

    const cursorPos = textareaRef.current?.selectionStart || 0
    const textBeforeCursor = value.slice(0, cursorPos)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')

    if (lastAtIndex !== -1) {
      const before = value.slice(0, lastAtIndex)
      const after = value.slice(cursorPos)
      const mentionText = `@${assistant.name} `
      const newValue = before + mentionText + after
      onChange(newValue)

      setTimeout(() => {
        const newCursorPos = before.length + mentionText.length
        textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos)
      }, 0)
    }

    setShowMentionDropdown(false)
    setMentionFilter('')

    setTimeout(() => {
      textareaRef.current?.focus()
    }, 0)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentionDropdown && filteredAssistants.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % filteredAssistants.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + filteredAssistants.length) % filteredAssistants.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        handleSelectMention(filteredAssistants[selectedIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowMentionDropdown(false)
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!isLoading && value.trim()) {
        onSubmit()
      }
    }
  }

  const canSubmit = !isLoading && value.trim()

  return (
    <div className="px-4 pb-4 pt-2">
      <div className="max-w-4xl mx-auto">
        {/* Helper Text */}
        <p className="text-[11px] text-muted-foreground/60 mb-2 text-center">
          <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">Enter</kbd> enviar
          <span className="mx-2">•</span>
          <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">Shift+Enter</kbd> nova linha
          <span className="mx-2">•</span>
          <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">@</kbd> trocar assistente
        </p>

        <div className="relative">
          <div
            className={cn(
              'flex items-center gap-2 rounded-2xl border bg-background/80 backdrop-blur-sm',
              'shadow-sm transition-all duration-200',
              'hover:shadow-md hover:border-primary/20',
              'focus-within:shadow-md focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/10',
              'p-2'
            )}
          >
            {/* Textarea with @mention dropdown */}
            <div className="flex-1 min-w-0 relative flex items-center">
              <textarea
                ref={textareaRef}
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={isLoading}
                rows={1}
                className={cn(
                  'w-full resize-none bg-transparent border-0 outline-none',
                  'text-sm leading-relaxed placeholder:text-muted-foreground/60',
                  'py-3 px-2',
                  'min-h-[44px]',
                  'max-h-[200px] overflow-y-auto',
                  'scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              />

              {/* @mention Dropdown */}
              {showMentionDropdown && filteredAssistants.length > 0 && (
                <div
                  ref={dropdownRef}
                  className="absolute bottom-full left-0 mb-2 w-72 bg-popover border border-border rounded-xl shadow-lg max-h-52 overflow-y-auto z-50"
                >
                  <div className="p-1">
                    {filteredAssistants.map((assistant, index) => (
                      <button
                        key={assistant.id}
                        onClick={() => handleSelectMention(assistant)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors',
                          index === selectedIndex
                            ? 'bg-accent'
                            : 'hover:bg-accent/50'
                        )}
                      >
                        <AssistantIcon iconUrl={assistant.icon_url} size="sm" />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium truncate block">
                            {assistant.name}
                          </span>
                          {assistant.description && (
                            <span className="text-xs text-muted-foreground truncate block">
                              {assistant.description}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Send Button */}
            <div className="shrink-0">
              <Button
                onClick={onSubmit}
                disabled={!canSubmit}
                variant="ghost"
                size="icon-xl"
                className={cn(
                  'rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {isLoading ? (
                  <CircleNotch className="h-5 w-5 animate-spin" />
                ) : (
                  <ArrowCircleUp className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>

          {/* AI Disclaimer */}
          <p className="text-[11px] text-muted-foreground/60 mt-2 text-center">
            Thinker e uma IA e pode cometer erros. Por favor, confira as respostas.
          </p>
        </div>
      </div>
    </div>
  )
}
