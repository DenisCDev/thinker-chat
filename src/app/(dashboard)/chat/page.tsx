'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useChatStore, type LocalConversation, type LocalMessage } from '@/stores/chatStore'
import { ChatMessage, ChatInput, EmptyState } from '@/components/chat'
import { toast } from 'sonner'
import type { Assistant } from '@/types/database'

interface ChatMessageType {
  id: string
  role: 'user' | 'assistant'
  content: string
  assistantName?: string
  assistantIconUrl?: string | null
}

export default function ChatPage() {
  const selectedAssistant = useChatStore((s) => s.selectedAssistant)
  const setSelectedAssistant = useChatStore((s) => s.setSelectedAssistant)
  const assistants = useChatStore((s) => s.assistants)
  const activeConversation = useChatStore((s) => s.activeConversation)
  const setActiveConversation = useChatStore((s) => s.setActiveConversation)
  const addConversation = useChatStore((s) => s.addConversation)
  const updateConversation = useChatStore((s) => s.updateConversation)
  const addMessageToConversation = useChatStore((s) => s.addMessageToConversation)

  const [messages, setMessages] = useState<ChatMessageType[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const [currentStreamingAssistant, setCurrentStreamingAssistant] = useState<Assistant | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingContent])

  const streamAssistantResponse = useCallback(async (
    conversationId: string,
    assistant: Assistant,
    chatMessages: Array<{ role: string; content: string }>,
    userContent: string
  ): Promise<string> => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [...chatMessages, { role: 'user', content: userContent }],
        conversationId,
        assistantId: assistant.id,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to get response')
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    let fullContent = ''
    let sseBuffer = ''

    while (reader) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      sseBuffer += chunk
      const lines = sseBuffer.split('\n')

      if (!sseBuffer.endsWith('\n')) {
        sseBuffer = lines.pop() || ''
      } else {
        sseBuffer = ''
      }

      for (const line of lines) {
        const trimmedLine = line.trim()
        if (!trimmedLine) continue

        if (trimmedLine.startsWith('data: ')) {
          const data = trimmedLine.slice(6)
          if (data === '[DONE]') continue

          try {
            const json = JSON.parse(data)
            if (json.content) {
              fullContent += json.content
              setStreamingContent(fullContent)
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }

    return fullContent
  }, [])

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return

    if (!selectedAssistant) {
      toast.error('Selecione um assistente para continuar')
      return
    }

    const userContent = input.trim()

    const userMessage: ChatMessageType = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userContent,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    // Create conversation locally if it doesn't exist
    let conversationId = activeConversation?.id
    let isNewConversation = false

    if (!conversationId) {
      const newConversation: LocalConversation = {
        id: crypto.randomUUID(),
        title: userContent.slice(0, 100),
        messages: [],
        assistantId: selectedAssistant.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      conversationId = newConversation.id
      addConversation(newConversation)
      setActiveConversation(newConversation)
      isNewConversation = true
    }

    // Save user message to store
    const userLocalMessage: LocalMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userContent,
      createdAt: new Date().toISOString(),
    }
    addMessageToConversation(conversationId, userLocalMessage)

    // Create assistant message placeholder
    const assistantMessageId = `assistant-${Date.now()}`
    const assistantMessage: ChatMessageType = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      assistantName: selectedAssistant.name,
      assistantIconUrl: selectedAssistant.icon_url,
    }

    setStreamingMessageId(assistantMessageId)
    setStreamingContent('')
    setCurrentStreamingAssistant(selectedAssistant)
    setMessages((prev) => [...prev, assistantMessage])

    try {
      const chatMessages = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const responseContent = await streamAssistantResponse(
        conversationId!,
        selectedAssistant,
        chatMessages,
        userContent
      )

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId
            ? { ...m, content: responseContent }
            : m
        )
      )

      // Save assistant message to store
      const assistantLocalMessage: LocalMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: responseContent,
        assistantName: selectedAssistant.name,
        assistantIconUrl: selectedAssistant.icon_url,
        createdAt: new Date().toISOString(),
      }
      addMessageToConversation(conversationId!, assistantLocalMessage)

      setStreamingMessageId(null)
      setStreamingContent('')
      setCurrentStreamingAssistant(null)

      // Generate title from first user message
      if (messages.length === 0 && conversationId) {
        const title = userContent.slice(0, 50)
        updateConversation(conversationId, { title })
      }

      if (isNewConversation && conversationId) {
        window.history.replaceState(null, '', `/chat/${conversationId}`)
      }
    } catch (error) {
      console.error('Chat error:', error)
      toast.error('Erro ao enviar mensagem. Tente novamente.')
      setMessages((prev) => prev.filter((m) => m.id !== assistantMessageId))
      setStreamingMessageId(null)
      setStreamingContent('')
      setCurrentStreamingAssistant(null)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {messages.length === 0 ? (
        <EmptyState onSuggestionClick={setInput} />
      ) : (
        <div className="flex-1 overflow-y-auto min-h-0 scrollbar-hidden">
          <div className="max-w-4xl mx-auto">
            {messages.map((message) => {
              const isCurrentlyStreaming = message.id === streamingMessageId && isLoading
              return (
                <ChatMessage
                  key={message.id}
                  role={message.role}
                  content={isCurrentlyStreaming ? streamingContent : message.content}
                  assistantName={isCurrentlyStreaming ? currentStreamingAssistant?.name : (message.assistantName || selectedAssistant?.name)}
                  assistantIconUrl={isCurrentlyStreaming ? currentStreamingAssistant?.icon_url : (message.assistantIconUrl || selectedAssistant?.icon_url)}
                  isStreaming={isCurrentlyStreaming}
                />
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      <ChatInput
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        assistants={assistants}
        onSelectAssistant={setSelectedAssistant}
        placeholder={
          selectedAssistant
            ? `Pergunte ao ${selectedAssistant.name}...`
            : 'Selecione um assistente...'
        }
      />
    </div>
  )
}
