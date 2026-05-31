import prisma from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'
import StoryboardViewer from '@/components/generate/StoryboardViewer'
import type { StoryboardScene } from '@/types/database'
import { createClient } from '@/lib/supabase/server'

export default async function StoryboardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const storyboard = await prisma.storyboard.findUnique({
    where: { 
      id: id,
      user_id: user.id
    }
  })

  if (!storyboard) notFound()

  const scenes = ((storyboard.scenes ?? []) as unknown[]) as (StoryboardScene & { image_base64?: string | null })[]
  const angle = storyboard.selected_angle as { name?: string } | null

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <StoryboardViewer 
        scenes={scenes} 
        storyboardId={storyboard.id} 
        agent_instruction={storyboard.framework ?? undefined}
        initialTitle={storyboard.title}
        selectedNiche={storyboard.selected_niche}
        selectedAngle={angle?.name}
        createdAt={storyboard.created_at}
        showDetailHeader={true}
      />
    </div>
  )
}
