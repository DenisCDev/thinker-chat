'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase/client'
import { useChatStore } from '@/stores/chatStore'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { Moon, Sun, SignOut } from '@phosphor-icons/react'

interface HeaderProps {
  user: {
    id: string
    email: string
  } | null
}

const DEFAULT_SIDEBAR_WIDTH = 256

export function Header({ user }: HeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const selectedAssistant = useChatStore((s) => s.selectedAssistant)
  const assistants = useChatStore((s) => s.assistants)
  const setSelectedAssistant = useChatStore((s) => s.setSelectedAssistant)
  const sidebarWidth = useChatStore((s) => s.sidebarWidth)
  const isSidebarOpen = useChatStore((s) => s.isSidebarOpen)

  const isChatPage = pathname?.startsWith('/chat')
  const sidebarExtraWidth = isSidebarOpen && isChatPage ? Math.max(0, sidebarWidth - DEFAULT_SIDEBAR_WIDTH) : 0
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const showAssistantSelector = pathname.startsWith('/chat')

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success('Logout realizado com sucesso')
    router.push('/login')
    router.refresh()
  }

  return (
    <header
      className="h-14 bg-transparent flex items-center justify-between px-4 transition-[padding] duration-200"
      style={{ paddingLeft: `${16 + sidebarExtraWidth}px` }}
    >
      {/* Left side */}
      <div className="flex items-center gap-4">
        {mounted && showAssistantSelector && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2" data-tour="assistant-selector">
                <span className="hidden sm:inline">Assistente:</span>
                <span className="font-medium">
                  {selectedAssistant?.name || 'Selecione'}
                </span>
                <ChevronDownIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              {assistants.length === 0 ? (
                <DropdownMenuItem disabled>
                  Carregando assistentes...
                </DropdownMenuItem>
              ) : (
                assistants.map((assistant) => (
                  <DropdownMenuItem
                    key={assistant.id}
                    onClick={() => setSelectedAssistant(assistant)}
                    className="flex flex-col items-start py-2"
                  >
                    <span className="font-medium">{assistant.name}</span>
                    {assistant.description && (
                      <span className="text-xs text-muted-foreground line-clamp-1">
                        {assistant.description}
                      </span>
                    )}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {mounted ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full" data-tour="user-menu">
                <div className="w-8 h-8 bg-lime text-lime-foreground rounded-full flex items-center justify-center overflow-hidden">
                  <span className="text-sm font-medium">
                    {user?.email?.[0]?.toUpperCase() || 'U'}
                  </span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{user?.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={toggleTheme}>
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 mr-2" />
                ) : (
                  <Moon className="w-4 h-4 mr-2" />
                )}
                {theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <SignOut className="w-4 h-4 mr-2" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="w-8 h-8 bg-lime text-lime-foreground rounded-full flex items-center justify-center overflow-hidden">
            <span className="text-sm font-medium">
              {user?.email?.[0]?.toUpperCase() || 'U'}
            </span>
          </div>
        )}
      </div>
    </header>
  )
}

function ChevronDownIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}
