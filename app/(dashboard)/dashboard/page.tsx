import { createClient } from '@/lib/supabase/server'
import prisma from '@/lib/prisma'
import Link from 'next/link'
import { Clapperboard, TrendingUp, User, Package, Zap, Sparkles, Video } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile = null
  let storyboards: any[] = []
  let charactersCount = 0
  let productsCount = 0
  let trendingNiches: any[] = []

  if (user) {
    const [profileData, charCount, prodCount, storyboardData, trendingData] = await Promise.all([
      prisma.profile.findUnique({ where: { id: user.id } }),
      prisma.character.count({ where: { user_id: user.id } }),
      prisma.product.count({ where: { user_id: user.id } }),
      prisma.storyboard.findMany({ 
        where: { user_id: user.id },
        orderBy: { created_at: 'desc' },
        take: 6,
        select: { id: true, selected_niche: true, selected_angle: true, status: true, created_at: true }
      }),
      prisma.trendingNiche.findMany({ orderBy: { updated_at: 'desc' }, take: 1 })
    ])
    
    profile = profileData
    charactersCount = charCount
    productsCount = prodCount
    storyboards = storyboardData
    if (trendingData.length > 0 && trendingData[0].niches) {
      trendingNiches = trendingData[0].niches as any[]
    }
  }

  type ProfileData = { full_name?: string | null; avatar_url?: string | null; is_subscribed?: boolean }
  const profileData = profile as ProfileData | null

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 800,
            marginBottom: 6,
            letterSpacing: '-0.02em',
          }}
        >
          Halo, {profileData?.full_name?.split(' ')[0] ?? 'Creator'}
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 15 }}>
          Apa yang mau kamu generate hari ini?
        </p>
      </div>

      {/* Trending Niches */}
      {trendingNiches.length > 0 && (
        <section className="card" style={{ padding: 24, marginBottom: 28 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 16,
            }}
          >
            <TrendingUp size={20} style={{ color: 'var(--color-brand-400)' }} />
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Trending Minggu Ini</h2>
            <span className="badge badge-viral" style={{ marginLeft: 'auto' }}>
              Live
            </span>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {trendingNiches.map((n) => (
              <Link
                href={`/generate?niche=${encodeURIComponent(n.name)}`}
                key={n.name}
                className="pill"
                style={{ textDecoration: 'none' }}
              >
                {n.emoji} {n.name}
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 11,
                    color: '#4ade80',
                    fontWeight: 700,
                  }}
                >
                  +{n.growth_pct}%
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Stats Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
          marginBottom: 28,
        }}
      >
        {[
          {
            icon: <Clapperboard size={28} style={{ color: 'var(--color-brand-400)' }} />,
            label: 'Storyboard',
            value: storyboards?.length ?? 0,
            sub: 'total dibuat',
            href: '/library',
          },
          {
            icon: <User size={28} style={{ color: 'var(--color-brand-400)' }} />,
            label: 'Karakter',
            value: charactersCount,
            sub: 'tersimpan',
            href: '/characters',
          },
          {
            icon: <Package size={28} style={{ color: 'var(--color-brand-400)' }} />,
            label: 'Produk',
            value: productsCount,
            sub: 'di library',
            href: '/products',
          },
        ].map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="card card-interactive"
            style={{ padding: 24, textDecoration: 'none' }}
          >
            <div style={{ marginBottom: 12 }}>{stat.icon}</div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 800,
                marginBottom: 4,
                letterSpacing: '-0.02em',
              }}
              className="gradient-text-brand"
            >
              {stat.value}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {stat.label}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
              {stat.sub}
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Generate CTA */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(168,45,227,0.15) 0%, rgba(99,102,241,0.1) 100%)',
          border: '1px solid var(--border-brand)',
          borderRadius: 'var(--radius-xl)',
          padding: '32px 36px',
          marginBottom: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
        }}
      >
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Siap generate storyboard baru?</span>
            <Zap size={20} style={{ color: '#facc15' }} />
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 15 }}>
            Upload foto produk → AI analisis niche → Generate storyboard 5 scene
          </p>
        </div>
        <Link href="/generate" className="btn btn-viral" style={{ flexShrink: 0, padding: '14px 28px', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={16} />
          <span>Generate Sekarang</span>
        </Link>
      </div>

      {/* Recent Storyboards */}
      <section>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Storyboard Terbaru</h2>
          <Link
            href="/library"
            style={{
              fontSize: 13,
              color: 'var(--color-brand-300)',
              textDecoration: 'none',
            }}
          >
            Lihat Semua →
          </Link>
        </div>

        {!storyboards || storyboards.length === 0 ? (
          <div
            className="card"
            style={{
              padding: 48,
              textAlign: 'center',
              border: '2px dashed var(--border-subtle)',
              background: 'transparent',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <Video size={48} style={{ color: 'var(--color-brand-400)' }} />
            </div>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 20 }}>
              Belum ada storyboard. Yuk buat yang pertama!
            </p>
            <Link href="/generate" className="btn btn-primary">
              Generate Pertama
            </Link>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 16,
            }}
          >
            {(storyboards as Array<{
              id: string
              selected_niche: string | null
              selected_angle: unknown
              status: string
              created_at: Date
            }>).map((sb) => {
              const angle = sb.selected_angle as { name?: string } | null
              return (
                <Link
                  key={sb.id}
                  href={`/library/${sb.id}`}
                  className="card card-interactive"
                  style={{ padding: 20, textDecoration: 'none' }}
                >
                  <div
                    style={{
                      height: 120,
                      background: 'var(--gradient-surface)',
                      borderRadius: 'var(--radius-md)',
                      marginBottom: 16,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Video size={36} style={{ color: 'var(--color-brand-400)' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                    {sb.selected_niche && (
                      <span className="badge badge-brand">{sb.selected_niche}</span>
                    )}
                    {angle?.name && (
                      <span className="badge badge-viral">{angle.name}</span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    {sb.created_at ? new Date(sb.created_at).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    }) : 'Baru saja'}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
