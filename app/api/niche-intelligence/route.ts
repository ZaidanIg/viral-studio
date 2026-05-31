import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { detectNiche } from '@/lib/ai/gemini'
import prisma from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    // DEV BYPASS: Matikan login
    const DEV_BYPASS_LOGIN = true

    if (!user && !DEV_BYPASS_LOGIN) {
      return NextResponse.json({ data: null, message: 'Unauthorized' }, { status: 401 })
    }

    let usageRow = null
    // Use date-only (no time component) to match @db.Date constraint
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Check daily rate limit (10/day) ONLY IF USER EXISTS
    if (user) {
      // Ensure Profile exists before any FK-dependent operations
      await prisma.profile.upsert({
        where: { id: user.id },
        update: {},
        create: {
          id: user.id,
          email: user.email ?? '',
          full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
          username: null,
        },
      })

      usageRow = await prisma.dailyUsage.findFirst({
        where: { user_id: user.id, date: today }
      })

      if (usageRow && usageRow.count && usageRow.count >= 10) {
        return NextResponse.json(
          { data: null, message: 'Daily limit reached. Limit 10 generations per day.' },
          { status: 429 }
        )
      }
    }

    const body = await request.json()
    const { productName, productDescription, imageBase64 } = body

    if (!productName) {
      return NextResponse.json({ data: null, message: 'Product name is required' }, { status: 400 })
    }

    const result = await detectNiche(productName, productDescription || '', imageBase64)

    // Increment usage counter if user exists
    if (user) {
      const currentCount = usageRow?.count || 0
      
      if (usageRow) {
        await prisma.dailyUsage.update({
          where: { id: usageRow.id },
          data: { count: currentCount + 1 }
        })
      } else {
        await prisma.dailyUsage.create({
          data: {
            user_id: user.id,
            date: today,
            count: 1
          }
        })
      }
    }

    return NextResponse.json({ data: result, message: 'Berhasil menganalisis niche intelligence' })
  } catch (error: any) {
    console.error('Niche intelligence error:', error)
    
    const isRateLimit = error?.status === 429 || error?.message?.toLowerCase().includes('quota') || error?.message?.includes('429')
    
    if (isRateLimit) {
      return NextResponse.json({ data: null, message: 'Limit penggunaan AI gratis tercapai. Harap tunggu sekitar 1 menit.' }, { status: 429 })
    }

    return NextResponse.json(
      { data: null, message: 'Failed to analyze niche. Please try again.' },
      { status: 500 }
    )
  }
}
