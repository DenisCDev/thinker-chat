import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { MainContent } from '@/components/layout/MainContent'
import { DashboardProvider } from './DashboardProvider'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const adminClient = createAdminClient()
  const { data: assistants } = await adminClient
    .from('assistants')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  const userData = {
    id: user.id,
    email: user.email || '',
  }

  return (
    <DashboardProvider assistants={assistants || []} user={userData}>
      <div className="h-screen bg-background">
        <Sidebar user={userData} />
        <MainContent>
          <Header user={userData} />
          <main className="flex-1 h-full overflow-y-auto scrollbar-hidden">{children}</main>
        </MainContent>
      </div>
    </DashboardProvider>
  )
}
