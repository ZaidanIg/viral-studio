'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Toast from '@/components/ui/toast'
import { Clapperboard } from 'lucide-react'

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Toast State
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error'>('success')

  // Form State
  const [identifier, setIdentifier] = useState('') // email or username for login
  const [loginPassword, setLoginPassword] = useState('')

  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [phone, setPhone] = useState('+62')
  const [email, setEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [rePassword, setRePassword] = useState('')
  const [agreePrivacy, setAgreePrivacy] = useState(false)

  function showToast(msg: string, type: 'success' | 'error') {
    setToastMessage(msg)
    setToastType(type)
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value
    if (val.length > 0 && !val.startsWith('+62')) {
      if (val.startsWith('0')) val = '+62' + val.substring(1)
      else if (val.startsWith('62')) val = '+' + val
      else val = '+62' + val
    }
    if (val === '') val = '+62'
    setPhone(val)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const resolveRes = await fetch('/api/auth/resolve-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier })
      })
      const resolveData = await resolveRes.json()

      if (!resolveRes.ok) {
        showToast(resolveData.message || 'Akun tidak ditemukan', 'error')
        setLoading(false)
        return
      }

      const resolvedEmail = resolveData.data.email

      const { data, error } = await supabase.auth.signInWithPassword({
        email: resolvedEmail,
        password: loginPassword,
      })

      if (error) {
        showToast(error.message, 'error')
      } else {
        showToast('Berhasil login!', 'success')
        router.push('/dashboard')
      }
    } catch (err) {
      showToast('Terjadi kesalahan jaringan', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()

    if (!agreePrivacy) {
      showToast('Anda harus menyetujui kebijakan privasi', 'error')
      return
    }

    if (registerPassword !== rePassword) {
      showToast('Password dan konfirmasi password tidak cocok', 'error')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName, username, phone, email, password: registerPassword
        })
      })
      
      const data = await res.json()

      if (!res.ok) {
        showToast(data.message || 'Gagal mendaftar', 'error')
      } else {
        showToast('Pendaftaran berhasil! Silakan login.', 'success')
        setActiveTab('login')
        setIdentifier(email)
        setLoginPassword('')
      }
    } catch (err) {
      showToast('Terjadi kesalahan jaringan', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function signInWithGoogle() {
    setLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'var(--color-dark-950)',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 800,
          height: 800,
          background: 'radial-gradient(circle, rgba(168,45,227,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <div
        className="glass-strong"
        style={{
          width: '100%',
          maxWidth: 420,
          padding: '32px 48px',
          borderRadius: 'var(--radius-xl)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: 'var(--gradient-brand)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: 'var(--glow-brand)',
            }}
          >
            <Clapperboard size={28} style={{ color: '#fff' }} />
          </div>
          <h1 className="gradient-text-brand" style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
            Viral Studio
          </h1>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--color-surface-1)', padding: 4, borderRadius: 8, marginBottom: 24 }}>
          <button
            onClick={() => setActiveTab('login')}
            style={{
              flex: 1, padding: '8px', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: activeTab === 'login' ? 'var(--gradient-brand)' : 'transparent',
              color: activeTab === 'login' ? '#fff' : 'var(--color-text-secondary)',
              transition: 'all 0.2s'
            }}
          >
            Masuk
          </button>
          <button
            onClick={() => setActiveTab('register')}
            style={{
              flex: 1, padding: '8px', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: activeTab === 'register' ? 'var(--gradient-brand)' : 'transparent',
              color: activeTab === 'register' ? '#fff' : 'var(--color-text-secondary)',
              transition: 'all 0.2s'
            }}
          >
            Daftar
          </button>
        </div>

        {/* Form Login */}
        {activeTab === 'login' && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Username / Email</label>
              <input
                required
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Masukkan username atau email"
                className="input"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input
                required
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Masukkan password"
                className="input"
                style={{ width: '100%' }}
              />
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary" style={{ marginTop: 8, width: '100%' }}>
              {loading ? 'Memproses...' : 'Masuk'}
            </button>
          </form>
        )}

        {/* Form Register */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Nama Lengkap</label>
              <input required type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Misal: Budi Santoso" className="input" style={{ width: '100%' }} />
            </div>
            <div>
              <label style={labelStyle}>Username</label>
              <input required type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Misal: budisantoso99" className="input" style={{ width: '100%' }} />
            </div>
            <div>
              <label style={labelStyle}>No. HP</label>
              <input required type="text" value={phone} onChange={handlePhoneChange} placeholder="+62..." className="input" style={{ width: '100%' }} />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="budi@example.com" className="input" style={{ width: '100%' }} />
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input required type="password" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} placeholder="Minimal 8 karakter" className="input" style={{ width: '100%' }} />
            </div>
            <div>
              <label style={labelStyle}>Konfirmasi Password</label>
              <input required type="password" value={rePassword} onChange={(e) => setRePassword(e.target.value)} placeholder="Ulangi password" className="input" style={{ width: '100%' }} />
            </div>
            
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 4 }}>
              <input 
                type="checkbox" 
                id="privacy" 
                checked={agreePrivacy}
                onChange={(e) => setAgreePrivacy(e.target.checked)}
                style={{ marginTop: 2 }}
              />
              <label htmlFor="privacy" style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                Saya setuju dengan Syarat & Ketentuan serta Kebijakan Privasi yang berlaku.
              </label>
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary" style={{ marginTop: 8, width: '100%' }}>
              {loading ? 'Memproses...' : 'Daftar Sekarang'}
            </button>
          </form>
        )}

        <div className="divider" style={{ margin: '24px 0' }} />

        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={loading}
          className="btn btn-secondary"
          style={{ width: '100%', padding: '12px', fontSize: 14, display: 'flex', gap: 12, justifyContent: 'center' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Lanjutkan dengan Google
        </button>

      </div>

      <Toast message={toastMessage} type={toastType} onClose={() => setToastMessage('')} />

    </main>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  display: 'block',
  marginBottom: 6,
}
