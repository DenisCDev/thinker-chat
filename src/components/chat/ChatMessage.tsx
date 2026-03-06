'use client'

import { cn } from '@/lib/utils'
import { AssistantIcon } from '@/components/shared/AssistantIcon'
import { ThinkingIndicator } from './ThinkingIndicator'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { useChatStore } from '@/stores/chatStore'

interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
  assistantName?: string
  assistantIconUrl?: string | null
  isStreaming?: boolean
}

export function ChatMessage({
  role,
  content,
  assistantName,
  assistantIconUrl,
  isStreaming,
}: ChatMessageProps) {
  const isUser = role === 'user'
  const user = useChatStore((state) => state.user)

  const getUserInitial = () => {
    if (user?.email) {
      return user.email[0].toUpperCase()
    }
    return 'U'
  }

  if (isUser) {
    return (
      <div className="flex justify-end items-end gap-2 px-4 py-3">
        <div className="max-w-[85%] md:max-w-[75%] lg:max-w-[65%]">
          <div className="bg-muted rounded-2xl rounded-br-md px-4 py-3">
            <p className="text-lg leading-relaxed whitespace-pre-wrap break-words">
              {content}
            </p>
          </div>
        </div>

        <div className="shrink-0 w-8 h-8 rounded-full overflow-hidden bg-lime text-lime-foreground flex items-center justify-center">
          <span className="text-sm font-medium">{getUserInitial()}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-3">
          <AssistantIcon iconUrl={assistantIconUrl} size="sm" />
          <span className="text-sm font-medium text-foreground">
            {assistantName || 'Assistente'}
          </span>
        </div>

        <div className="pl-10">
          {isStreaming && !content ? (
            <ThinkingIndicator />
          ) : (
            <div className="markdown-content max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
              >
                {content}
              </ReactMarkdown>
              {isStreaming && content && (
                <span className="inline-block w-1.5 h-5 ml-0.5 bg-primary/70 rounded-full animate-pulse" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
