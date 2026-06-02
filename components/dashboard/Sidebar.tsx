'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import { 
  Home, 
  Zap, 
  Library, 
  User, 
  Package, 
  LogOut, 
  CheckCircle2, 
  Clapperboard 
} from 'lucide-react'

interface SidebarProps {
  user: {
    email: string
    fullName: string
    avatarUrl: string | null
    isSubscribed: boolean
  }
  dailyCount: number
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', Icon: Home },
  { href: '/generate', label: 'Generate (Story)', Icon: Zap },
  { href: '/generate-character', label: 'Generate Karakter', Icon: User },
  { href: '/library', label: 'Library', Icon: Library },
  { href: '/characters', label: 'Data Karakter', Icon: User },
  { href: '/products', label: 'Data Produk', Icon: Package },
]

export default function Sidebar({ user, dailyCount }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const remaining = Math.max(0, 10 - dailyCount)
  const usagePercent = (dailyCount / 10) * 100

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div
        style={{
          padding: '20px 16px 16px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <Link
          href="/dashboard"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            textDecoration: 'none',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              background: 'var(--gradient-brand)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Clapperboard size={16} style={{ color: '#fff' }} />
          </div>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 16,
              letterSpacing: '-0.02em',
            }}
            className="gradient-text-brand"
          >
            Viral Studio
          </span>
        </Link>
      </div>

      {/* Nav Items */}
      <nav style={{ padding: '12px 0', flex: 1 }}>
        {navItems.map((item) => {
          const isActive =
            item.href === '/dashboard' || item.href === '/generate'
              ? pathname === item.href
              : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: 12 }}
            >
              <item.Icon size={16} style={{ flexShrink: 0 }} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Daily Usage */}
      <div
        style={{
          margin: '0 8px 8px',
          padding: '14px',
          background: 'var(--color-surface-2)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 8,
            fontSize: 12,
          }}
        >
          <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>
            Generasi Hari Ini
          </span>
          <span
            style={{
              color:
                remaining === 0 ? 'var(--color-error)' : 'var(--color-text-primary)',
              fontWeight: 700,
            }}
          >
            {dailyCount} / 10
          </span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{
              width: `${usagePercent}%`,
              background:
                remaining === 0
                  ? 'var(--color-error)'
                  : remaining <= 3
                  ? 'var(--color-warning)'
                  : 'var(--gradient-brand)',
            }}
          />
        </div>
        <p
          style={{
            fontSize: 11,
            color: 'var(--color-text-muted)',
            marginTop: 6,
          }}
        >
          {remaining === 0
            ? 'Limit hari ini tercapai. Reset besok.'
            : `${remaining} generasi tersisa hari ini`}
        </p>
      </div>

      {/* User Profile */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        {user.avatarUrl ? (
          <Image
            src={user.avatarUrl}
            alt={user.fullName}
            width={32}
            height={32}
            style={{ borderRadius: '50%', flexShrink: 0 }}
          />
        ) : (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'var(--gradient-brand)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {user.fullName.charAt(0).toUpperCase()}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {user.fullName}
          </p>
          <div
            style={{
              fontSize: 11,
              marginTop: 2,
            }}
          >
            {user.isSubscribed ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#4ade80' }}>
                <CheckCircle2 size={11} />
                <span>Aktif</span>
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-muted)' }}>
                <Zap size={11} style={{ color: '#facc15' }} />
                <span>Trial</span>
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleSignOut}
          title="Keluar"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-text-muted)',
            padding: 4,
            borderRadius: 6,
            transition: 'color 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.color = 'var(--color-error)')
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-muted)')
          }
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  )
}
