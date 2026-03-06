'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useChatStore, type LocalConversation } from '@/stores/chatStore'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import Grainient from '@/components/Grainient'
import { toast } from 'sonner'
import {
  SidebarSimple,
  Plus,
  UsersThree,
  DotsThree,
  PencilSimple,
  Trash,
} from '@phosphor-icons/react'

interface SidebarProps {
  user: {
    id: string
    email: string
  } | null
}

const MIN_SIDEBAR_WIDTH = 200
const MAX_SIDEBAR_WIDTH = 480
const DEFAULT_SIDEBAR_WIDTH = 256

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const isChatPage = pathname?.startsWith('/chat')
  const router = useRouter()
  const conversations = useChatStore((s) => s.conversations)
  const activeConversation = useChatStore((s) => s.activeConversation)
  const setActiveConversation = useChatStore((s) => s.setActiveConversation)
  const updateConversation = useChatStore((s) => s.updateConversation)
  const removeConversation = useChatStore((s) => s.removeConversation)
  const isSidebarOpen = useChatStore((s) => s.isSidebarOpen)
  const toggleSidebar = useChatStore((s) => s.toggleSidebar)
  const generatingTitleForId = useChatStore((s) => s.generatingTitleForId)
  const streamingTitle = useChatStore((s) => s.streamingTitle)

  // Rename dialog state
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [renameTitle, setRenameTitle] = useState('')
  const [renamingConversationId, setRenamingConversationId] = useState<string | null>(null)

  // Resize state
  const sidebarWidth = useChatStore((s) => s.sidebarWidth)
  const setSidebarWidth = useChatStore((s) => s.setSidebarWidth)
  const [isResizing, setIsResizing] = useState(false)
  const sidebarRef = useRef<HTMLElement>(null)

  // Load saved sidebar width from localStorage on mount
  useEffect(() => {
    const savedWidth = localStorage.getItem('sidebarWidth')
    if (savedWidth) {
      const width = parseInt(savedWidth, 10)
      if (width >= MIN_SIDEBAR_WIDTH && width <= MAX_SIDEBAR_WIDTH) {
        setSidebarWidth(width)
      }
    }
  }, [setSidebarWidth])

  // Resize handlers
  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  const stopResizing = useCallback(() => {
    setIsResizing(false)
  }, [])

  const resize = useCallback((e: MouseEvent) => {
    if (!isResizing) return
    const newWidth = e.clientX
    if (newWidth >= MIN_SIDEBAR_WIDTH && newWidth <= MAX_SIDEBAR_WIDTH) {
      setSidebarWidth(newWidth)
      localStorage.setItem('sidebarWidth', newWidth.toString())
    }
  }, [isResizing, setSidebarWidth])

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize)
      window.addEventListener('mouseup', stopResizing)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }
    return () => {
      window.removeEventListener('mousemove', resize)
      window.removeEventListener('mouseup', stopResizing)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing, resize, stopResizing])

  // Prefetch recent conversations
  useEffect(() => {
    if (conversations.length > 0) {
      conversations.slice(0, 10).forEach((conv) => {
        router.prefetch(`/chat/${conv.id}`)
      })
    }
  }, [conversations, router])

  const handleNewChat = () => {
    setActiveConversation(null)
    router.push('/chat')
  }

  const handleSelectConversation = (conversation: LocalConversation) => {
    setActiveConversation(conversation)
    router.push(`/chat/${conversation.id}`)
  }

  const handleDeleteConversation = (id: string) => {
    removeConversation(id)
    if (activeConversation?.id === id) {
      router.push('/chat')
    }
    toast.success('Conversa excluida!')
  }

  const openRenameDialog = (conversation: LocalConversation) => {
    setRenamingConversationId(conversation.id)
    setRenameTitle(conversation.title || '')
    setRenameDialogOpen(true)
  }

  const handleRename = () => {
    if (renamingConversationId && renameTitle.trim()) {
      updateConversation(renamingConversationId, { title: renameTitle.trim() })
      toast.success('Conversa renomeada!')
    }
    setRenameDialogOpen(false)
    setRenamingConversationId(null)
  }

  const renderConversationItem = (conversation: LocalConversation) => {
    const isGeneratingTitle = generatingTitleForId === conversation.id
    const displayTitle = isGeneratingTitle ? streamingTitle : conversation.title

    return (
      <div
        key={conversation.id}
        onClick={() => handleSelectConversation(conversation)}
        className={cn(
          'group relative flex items-center justify-between px-4 py-2.5 text-sm cursor-pointer overflow-hidden',
          activeConversation?.id === conversation.id
            ? 'glass-conversation glass-conversation-active text-lime'
            : 'glass-conversation text-white/90'
        )}
      >
        <div className="flex-1 min-w-0 overflow-hidden">
          <span className="block truncate">
            {displayTitle || 'Nova conversa'}
          </span>
        </div>
        {isGeneratingTitle && (
          <span className="inline-block w-1.5 h-4 bg-current animate-pulse rounded-sm shrink-0 mr-1" />
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded"
            >
              <DotsThree className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                openRenameDialog(conversation)
              }}
            >
              <PencilSimple className="w-4 h-4 mr-2" />
              Renomear
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                handleDeleteConversation(conversation.id)
              }}
              className="text-destructive"
            >
              <Trash className="w-4 h-4 mr-2" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={0}>
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={cn(
          'fixed inset-y-0 left-0 z-50 bg-sidebar border-r border-white/[0.04] flex flex-col',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          !isResizing && 'transition-all duration-200'
        )}
        style={{
          width: isSidebarOpen ? (isChatPage ? sidebarWidth : DEFAULT_SIDEBAR_WIDTH) : 56,
        }}
      >
        {/* Animated background */}
        <div className="absolute inset-0 opacity-50 pointer-events-none">
          <Grainient
            color1="#22c55e"
            color2="#030305"
            color3="#0a0a0b"
            timeSpeed={0.12}
            warpStrength={0.6}
            warpFrequency={3}
            warpSpeed={0.8}
            warpAmplitude={80}
            rotationAmount={400}
            noiseScale={2.5}
            grainAmount={0.18}
            grainScale={3}
            contrast={1.8}
            saturation={1.3}
            gamma={0.8}
            zoom={1.0}
          />
        </div>

        {/* Header */}
        <div className={cn(
          'relative z-10 flex items-center',
          isSidebarOpen ? 'p-4 justify-between' : 'p-2 justify-center'
        )}>
          {isSidebarOpen ? (
            <>
              <Link href="/assistants" className="flex items-center">
                <span className="font-semibold text-xl text-white">Thinker</span>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="h-8 w-8 hidden lg:flex"
                title="Recolher menu"
              >
                <SidebarSimple className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleSidebar}
                  className="h-10 w-10 hidden lg:flex"
                >
                  <SidebarSimple className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Expandir menu</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Expanded View */}
        {isSidebarOpen ? (
          <>
            {/* Action Buttons - Glass Cards */}
            <div className="relative z-10 px-3 py-2 space-y-2">
              <button
                onClick={handleNewChat}
                className="glass-card w-full flex items-center gap-3 px-4 py-3 text-sm text-white/90 cursor-pointer"
                data-tour="new-chat"
              >
                <Plus className="w-4 h-4 shrink-0 text-lime" />
                <span>Novo chat</span>
              </button>
              <Link href="/assistants" className="block">
                <div
                  className={cn(
                    'glass-card w-full flex items-center gap-3 px-4 py-3 text-sm cursor-pointer',
                    pathname.startsWith('/assistants')
                      ? 'glass-card-active text-lime'
                      : 'text-white/90'
                  )}
                  data-tour="assistants"
                >
                  <UsersThree className="w-4 h-4 shrink-0" />
                  <span>Assistentes</span>
                </div>
              </Link>
            </div>

            {/* Conversations - Scrollable */}
            <div className="relative z-10 flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-hidden">
              <div className="px-4 py-2 text-xs font-medium text-white/40 uppercase tracking-widest">
                Conversas
              </div>
              <div className="space-y-1.5 px-3 pb-3">
                {conversations.length > 0 ? (
                  conversations.map(renderConversationItem)
                ) : (
                  <div className="glass-conversation px-4 py-3 text-sm text-white/50 text-center">
                    Nenhuma conversa
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          /* Collapsed View - Icon Rail */
          <div className="relative z-10 flex-1 flex flex-col items-center py-2 space-y-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={handleNewChat} className="glass-card p-2.5 cursor-pointer">
                  <Plus className="w-5 h-5 text-lime" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Novo chat</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/assistants">
                  <div className={cn(
                    'glass-card p-2.5 cursor-pointer',
                    pathname.startsWith('/assistants') && 'glass-card-active'
                  )}>
                    <UsersThree className="w-5 h-5" />
                  </div>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">Assistentes</TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Resize handle */}
        {isSidebarOpen && isChatPage && (
          <div
            onMouseDown={startResizing}
            className={cn(
              'absolute top-0 -right-1 w-3 h-full cursor-col-resize hidden lg:flex items-center justify-center z-50 group',
              isResizing && 'bg-lime/20'
            )}
          >
            <div className={cn(
              'w-0.5 h-full transition-colors duration-300 delay-300',
              'bg-transparent group-hover:bg-lime/60 group-hover:delay-300',
              isResizing && 'bg-lime delay-0'
            )} />
          </div>
        )}
      </aside>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear conversa</DialogTitle>
          </DialogHeader>
          <Input
            value={renameTitle}
            onChange={(e) => setRenameTitle(e.target.value)}
            placeholder="Nome da conversa"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename()
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleRename}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
