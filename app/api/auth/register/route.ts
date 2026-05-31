import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import prisma from '@/lib/prisma'

const GENERIC_PASSWORDS = ['123456', '12345678', '123456789', 'password', 'qwerty', 'admin123', 'rahasia']

export async function POST(request: NextRequest) {
  try {
    const { fullName, username, phone, email, password } = await request.json()

    // 1. Validasi Input
    if (!fullName || !username || !phone || !email || !password) {
      return NextResponse.json({ data: null, message: 'Semua field wajib diisi' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ data: null, message: 'Password minimal 8 karakter' }, { status: 400 })
    }

    if (GENERIC_PASSWORDS.includes(password.toLowerCase())) {
      return NextResponse.json({ data: null, message: 'Password terlalu umum/mudah ditebak' }, { status: 400 })
    }
    
    if (password.toLowerCase() === username.toLowerCase() || password.toLowerCase() === email.toLowerCase()) {
      return NextResponse.json({ data: null, message: 'Password tidak boleh sama dengan username atau email' }, { status: 400 })
    }

    if (!phone.startsWith('+62')) {
      return NextResponse.json({ data: null, message: 'Nomor HP harus diawali dengan +62' }, { status: 400 })
    }

    // 2. Cek Username Unik di Prisma
    const existingUser = await prisma.profile.findUnique({
      where: { username }
    })
    
    if (existingUser) {
      return NextResponse.json({ data: null, message: 'Username sudah digunakan' }, { status: 400 })
    }

    // 3. Register ke Supabase
    const supabase = await createClient()
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          username: username,
          phone: phone,
        }
      }
    })

    if (authError) {
      return NextResponse.json({ data: null, message: authError.message }, { status: 400 })
    }

    if (!authData.user) {
      return NextResponse.json({ data: null, message: 'Gagal membuat akun' }, { status: 500 })
    }

    // 4. Update / Insert Profile di Prisma
    try {
      await prisma.profile.upsert({
        where: { id: authData.user.id },
        update: {
          full_name: fullName,
          username: username,
          phone: phone,
        },
        create: {
          id: authData.user.id,
          email: email,
          full_name: fullName,
          username: username,
          phone: phone,
        }
      })
    } catch (e) {
      console.error('Error upserting profile:', e)
      // We don't fail the request completely if profile upsert fails, as Supabase user is created
      // But we log it. In a real app, you'd use a trigger to avoid this.
    }

    return NextResponse.json({ 
      data: { user: authData.user }, 
      message: 'Pendaftaran berhasil! Silakan cek email Anda untuk verifikasi (jika diaktifkan).' 
    }, { status: 200 })

  } catch (error: any) {
    console.error('Register API error:', error)
    return NextResponse.json({ data: null, message: 'Terjadi kesalahan sistem' }, { status: 500 })
  }
}
