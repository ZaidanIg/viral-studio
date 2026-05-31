import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import prisma from '@/lib/prisma'

/**
 * PATCH /api/storyboard/[id]
 * Updates storyboard properties like 'title' (rename) or 'scenes' (edit content).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, scenes } = body

    const updated = await prisma.storyboard.update({
      where: { id, user_id: user.id },
      data: {
        ...(title !== undefined && { title }),
        ...(scenes !== undefined && { scenes: scenes as any }),
      },
    })

    return NextResponse.json({ success: true, storyboard: updated })
  } catch (err: any) {
    console.error('[PATCH storyboard] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}

/**
 * DELETE /api/storyboard/[id]
 * Deletes a storyboard from the library.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.storyboard.delete({
      where: { id, user_id: user.id },
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[DELETE storyboard] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
