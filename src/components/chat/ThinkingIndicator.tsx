'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface ThinkingIndicatorProps {
  className?: string
}

const THINKING_MESSAGES = [
  'Analisando sua pergunta',
  'Consultando base de conhecimento',
  'Processando informações',
  'Preparando resposta',
]

export function ThinkingIndicator({ className }: ThinkingIndicatorProps) {
  const [messageIndex, setMessageIndex] = useState(0)
  const [dots, setDots] = useState('')

  useEffect(() => {
    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % THINKING_MESSAGES.length)
    }, 2500)

    return () => clearInterval(messageInterval)
  }, [])

  useEffect(() => {
    const dotsInterval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'))
    }, 400)

    return () => clearInterval(dotsInterval)
  }, [])

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="flex items-center gap-[3px]">
        <div className="w-[5px] h-[5px] rounded-full bg-primary/60 animate-bounce [animation-delay:-0.3s]" />
        <div className="w-[5px] h-[5px] rounded-full bg-primary/60 animate-bounce [animation-delay:-0.15s]" />
        <div className="w-[5px] h-[5px] rounded-full bg-primary/60 animate-bounce" />
      </div>

      <p className="text-sm text-muted-foreground animate-pulse">
        {THINKING_MESSAGES[messageIndex]}{dots}
      </p>
    </div>
  )
}
