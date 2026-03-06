import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Assistant } from '@/types/database'

export interface LocalMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  assistantName?: string
  assistantIconUrl?: string | null
  createdAt: string
}

export interface LocalConversation {
  id: string
  title: string | null
  messages: LocalMessage[]
  assistantId: string | null
  createdAt: string
  updatedAt: string
}

interface ChatState {
  // User (minimal - just for display)
  user: { id: string; email: string } | null
  setUser: (user: { id: string; email: string } | null) => void

  // Conversations (persisted to localStorage)
  conversations: LocalConversation[]
  activeConversation: LocalConversation | null
  setActiveConversation: (conversation: LocalConversation | null) => void
  addConversation: (conversation: LocalConversation) => void
  updateConversation: (id: string, updates: Partial<LocalConversation>) => void
  removeConversation: (id: string) => void
  addMessageToConversation: (conversationId: string, message: LocalMessage) => void
  getConversationMessages: (conversationId: string) => LocalMessage[]

  // Messages (for active conversation display - not persisted separately)
  messages: LocalMessage[]
  setMessages: (messages: LocalMessage[]) => void
  addMessage: (message: LocalMessage) => void

  // Assistants (fetched from API, not persisted)
  assistants: Assistant[]
  selectedAssistant: Assistant | null
  setAssistants: (assistants: Assistant[]) => void
  setSelectedAssistant: (assistant: Assistant | null) => void
  refreshAssistants: () => Promise<void>

  // UI State
  isSidebarOpen: boolean
  isLoading: boolean
  sidebarWidth: number
  toggleSidebar: () => void
  setIsLoading: (loading: boolean) => void
  setSidebarWidth: (width: number) => void

  // Title Generation
  generatingTitleForId: string | null
  streamingTitle: string
  setGeneratingTitleForId: (id: string | null) => void
  setStreamingTitle: (title: string) => void
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      // User
      user: null,
      setUser: (user) => set({ user }),

      // Conversations
      conversations: [],
      activeConversation: null,
      setActiveConversation: (conversation) => set({ activeConversation: conversation }),
      addConversation: (conversation) =>
        set((state) => ({ conversations: [conversation, ...state.conversations] })),
      updateConversation: (id, updates) =>
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
          activeConversation:
            state.activeConversation?.id === id
              ? { ...state.activeConversation, ...updates }
              : state.activeConversation,
        })),
      removeConversation: (id) =>
        set((state) => ({
          conversations: state.conversations.filter((c) => c.id !== id),
          activeConversation:
            state.activeConversation?.id === id ? null : state.activeConversation,
        })),
      addMessageToConversation: (conversationId, message) =>
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId
              ? { ...c, messages: [...c.messages, message], updatedAt: new Date().toISOString() }
              : c
          ),
          activeConversation:
            state.activeConversation?.id === conversationId
              ? { ...state.activeConversation, messages: [...state.activeConversation.messages, message], updatedAt: new Date().toISOString() }
              : state.activeConversation,
        })),
      getConversationMessages: (conversationId) => {
        const conversation = get().conversations.find((c) => c.id === conversationId)
        return conversation?.messages ?? []
      },

      // Messages (for active conversation display)
      messages: [],
      setMessages: (messages) => set({ messages }),
      addMessage: (message) =>
        set((state) => ({ messages: [...state.messages, message] })),

      // Assistants
      assistants: [],
      selectedAssistant: null,
      setAssistants: (assistants) => set({ assistants }),
      setSelectedAssistant: (assistant) => set({ selectedAssistant: assistant }),
      refreshAssistants: async () => {
        try {
          const response = await fetch('/api/assistants', { cache: 'no-store' })
          if (!response.ok) throw new Error('Failed to fetch assistants')
          const assistants = await response.json()
          set((state) => {
            const updatedSelectedAssistant = state.selectedAssistant
              ? assistants.find((a: Assistant) => a.id === state.selectedAssistant?.id) || assistants[0] || null
              : assistants[0] || null
            return { assistants, selectedAssistant: updatedSelectedAssistant }
          })
        } catch (error) {
          console.error('Error refreshing assistants:', error)
        }
      },

      // UI State
      isSidebarOpen: true,
      isLoading: false,
      sidebarWidth: 256,
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      setIsLoading: (loading) => set({ isLoading: loading }),
      setSidebarWidth: (width) => set({ sidebarWidth: width }),

      // Title Generation
      generatingTitleForId: null,
      streamingTitle: '',
      setGeneratingTitleForId: (id) => set({ generatingTitleForId: id }),
      setStreamingTitle: (title) => set({ streamingTitle: title }),
    }),
    {
      name: 'thinker-chat-storage',
      partialize: (state) => ({
        conversations: state.conversations,
        sidebarWidth: state.sidebarWidth,
        isSidebarOpen: state.isSidebarOpen,
      }),
      onRehydrateStorage: () => {
        return (state) => {
          if (state) {
            const THREE_HOURS = 3 * 60 * 60 * 1000
            const now = Date.now()
            state.conversations = state.conversations.filter(
              (c) => now - new Date(c.createdAt).getTime() < THREE_HOURS
            )
          }
        }
      },
    }
  )
)
