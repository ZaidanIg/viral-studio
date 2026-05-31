import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      custom_field1: userId
    } = body

    const serverKey = process.env.MIDTRANS_SERVER_KEY!
    
    // Verify signature
    const hash = crypto.createHash('sha512')
      .update(`${order_id}${status_code}${gross_amount}${serverKey}`)
      .digest('hex')

    if (hash !== signature_key) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID not found in payload' }, { status: 400 })
    }

    // Success if capture or settlement
    if (transaction_status === 'capture' || transaction_status === 'settlement') {
      await prisma.profile.update({
        where: { id: userId },
        data: {
          is_subscribed: true,
          subscribed_at: new Date()
        }
      })
      console.log(`[Midtrans] Successfully activated subscription for user: ${userId}`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Midtrans Webhook Error]:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
