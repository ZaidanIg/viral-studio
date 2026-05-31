import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { data } = await supabase.auth.exchangeCodeForSession(code)

    // Upsert profile for OAuth users (e.g. Google Sign-In)
    // Without this, FK constraints on DailyUsage, Storyboard etc. will fail.
    if (data.user) {
      try {
        await prisma.profile.upsert({
          where: { id: data.user.id },
          update: {},
          create: {
            id: data.user.id,
            email: data.user.email ?? '',
            full_name:
              data.user.user_metadata?.full_name ??
              data.user.user_metadata?.name ??
              null,
            avatar_url: data.user.user_metadata?.avatar_url ?? null,
            username: null,
          },
        })
      } catch (e) {
        console.error('[auth/callback] Profile upsert failed:', e)
      }
    }
  }

  return NextResponse.redirect(`${origin}/dashboard`)
}
