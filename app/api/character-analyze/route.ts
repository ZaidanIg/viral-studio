import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyzeCharacter } from '@/lib/ai/gemini'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    // DEV BYPASS: Matikan login
    const DEV_BYPASS_LOGIN = true

    if (!user && !DEV_BYPASS_LOGIN) return NextResponse.json({ data: null, message: 'Unauthorized' }, { status: 401 })

    const { imageBase64 } = await request.json()
    if (!imageBase64) return NextResponse.json({ data: null, message: 'Image required' }, { status: 400 })

    const result = await analyzeCharacter(imageBase64)

    // Generate immutable hash for anchor phrase
    const anchorHash = crypto
      .createHash('sha256')
      .update(result.anchorPhrase)
      .digest('hex')
      .slice(0, 16)

    return NextResponse.json({ data: { ...result, anchorHash }, message: 'Berhasil menganalisis karakter' })
  } catch (error: any) {
    console.error('Character analyze error:', error)
    
    // Check if it's a Gemini API rate limit error
    const isRateLimit = error?.status === 429 || error?.message?.toLowerCase().includes('quota') || error?.message?.includes('429')
    
    if (isRateLimit) {
      return NextResponse.json({ data: null, message: 'Limit penggunaan AI gratis tercapai. Harap tunggu sekitar 1 menit.' }, { status: 429 })
    }
    
    return NextResponse.json({ data: null, message: 'Failed to analyze character' }, { status: 500 })
  }
}
