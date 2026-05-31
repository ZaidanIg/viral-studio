import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { identifier } = await request.json()

    if (!identifier) {
      return NextResponse.json({ data: null, message: 'Username atau Email diperlukan' }, { status: 400 })
    }

    // Jika identifier sudah mengandung '@', asumsikan itu adalah email
    if (identifier.includes('@')) {
      return NextResponse.json({ data: { email: identifier }, message: 'Identifier is email' }, { status: 200 })
    }

    // Cari email berdasarkan username
    const user = await prisma.profile.findUnique({
      where: { username: identifier }
    })

    if (!user || !user.email) {
      return NextResponse.json({ data: null, message: 'Username tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json({ data: { email: user.email }, message: 'Email ditemukan' }, { status: 200 })

  } catch (error: any) {
    console.error('Resolve username error:', error)
    return NextResponse.json({ data: null, message: 'Terjadi kesalahan sistem' }, { status: 500 })
  }
}
