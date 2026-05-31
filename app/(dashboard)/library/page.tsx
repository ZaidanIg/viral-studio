import prisma from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import LibraryList from '@/components/library/LibraryList'

export default async function LibraryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const storyboards = await prisma.storyboard.findMany({
    where: { user_id: user.id },
    orderBy: { created_at: 'desc' }
  })

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>📚 Library</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>
            {storyboards?.length ?? 0} storyboard tersimpan
          </p>
        </div>
        <Link href="/generate" className="btn btn-primary">
          + Generate Baru
        </Link>
      </div>

      <LibraryList initialStoryboards={storyboards as any} />
    </div>
  )
}
