import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/dashboard/Sidebar'
import prisma from '@/lib/prisma'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  let profile = null
  let usageRow = null

  if (user) {
    profile = await prisma.profile.findUnique({
      where: { id: user.id }
    })
    const today = new Date()
    usageRow = await prisma.dailyUsage.findFirst({
      where: {
        user_id: user.id,
        date: today
      }
    })
  }

  const dailyCount = usageRow?.count ?? 0
  const profileRow = profile

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-dark-950)' }}>
      <Sidebar
        user={{
          email: user.email ?? '',
          fullName: profileRow?.full_name ?? user.email ?? '',
          avatarUrl: profileRow?.avatar_url ?? null,
          isSubscribed: profileRow?.is_subscribed ?? false,
        }}
        dailyCount={dailyCount}
      />
      <main className="main-content" style={{ flex: 1 }}>
        {children}
      </main>
    </div>
  )
}
