import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: 'FLOW_MEDIA_CONFIG' }
    })

    if (!config) {
      return NextResponse.json({ error: 'Config not found' }, { status: 404 })
    }

    return NextResponse.json({ data: config.value })
  } catch (error) {
    console.error('System config fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 })
  }
}
