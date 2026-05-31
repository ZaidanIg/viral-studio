import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Call Midtrans Snap API directly using fetch
    const serverKey = process.env.MIDTRANS_SERVER_KEY!
    const authString = Buffer.from(serverKey + ':').toString('base64')

    const payload = {
      transaction_details: {
        order_id: `VIRAL_STUDIO_${user.id}_${Date.now()}`,
        gross_amount: 150000,
      },
      customer_details: {
        first_name: user.user_metadata?.full_name || 'User',
        email: user.email,
      },
      custom_field1: user.id, // Store user ID to identify them in webhook
    }

    const response = await fetch('https://app.sandbox.midtrans.com/snap/v1/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Basic ${authString}`,
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Midtrans API error:', data)
      throw new Error(data.error_messages?.[0] || 'Gagal membuat transaksi')
    }

    return NextResponse.json({ token: data.token })
  } catch (error) {
    console.error('Payment Token Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
