'use client'

import { useChatStore } from '@/stores/chatStore'
import { cn } from '@/lib/utils'

interface MainContentProps {
  children: React.ReactNode
}

export function MainContent({ children }: MainContentProps) {
  const isSidebarOpen = useChatStore((s) => s.isSidebarOpen)

  return (
    <div
      className={cn(
        'flex flex-col h-full overflow-hidden transition-[margin] duration-200',
        // Fixed margin based on sidebar state (collapsed = 56px, expanded = 256px)
        // Sidebar overlays content when expanded beyond default width
        isSidebarOpen ? 'lg:ml-64' : 'lg:ml-14',
        'ml-0' // Mobile: no margin (sidebar overlays)
      )}
    >
      {children}
    </div>
  )
}
