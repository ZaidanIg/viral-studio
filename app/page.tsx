import Link from 'next/link'
import { Clapperboard, TrendingUp, Sparkles, Brain, BarChart3, User, Video, ShieldCheck, Target, Film } from 'lucide-react'

export default function LandingPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--color-dark-950)',
        overflowX: 'hidden',
      }}
    >
      {/* NAV */}
      <nav
        className="glass"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          padding: '16px 40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'var(--gradient-brand)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
            }}
          >
            <Clapperboard size={18} style={{ color: '#fff' }} />
          </div>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 20,
              letterSpacing: '-0.02em',
            }}
            className="gradient-text-brand"
          >
            Viral Studio
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/login" className="btn btn-ghost btn-sm">
            Masuk
          </Link>
          <Link href="/login" className="btn btn-primary btn-sm">
            Coba Gratis 7 Hari
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section
        style={{
          paddingTop: 160,
          paddingBottom: 100,
          paddingLeft: 40,
          paddingRight: 40,
          textAlign: 'center',
          maxWidth: 900,
          margin: '0 auto',
          position: 'relative',
        }}
      >
        {/* Glow orbs */}
        <div
          style={{
            position: 'absolute',
            top: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 600,
            height: 600,
            background:
              'radial-gradient(circle, rgba(168,45,227,0.12) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <div className="badge badge-viral" style={{ marginBottom: 24, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <TrendingUp size={14} style={{ color: '#facc15' }} />
          <span>AI untuk Affiliate Marketer Indonesia</span>
        </div>

        <h1
          style={{
            fontSize: 'clamp(36px, 6vw, 72px)',
            fontWeight: 900,
            lineHeight: 1.05,
            marginBottom: 24,
            letterSpacing: '-0.03em',
          }}
        >
          AI yang tahu{' '}
          <span className="gradient-text">konten apa</span>
          <br />
          yang harus kamu buat
        </h1>

        <p
          style={{
            fontSize: 18,
            color: 'var(--color-text-secondary)',
            maxWidth: 600,
            margin: '0 auto 40px',
            lineHeight: 1.7,
          }}
        >
          Dari <strong style={{ color: 'var(--color-text-primary)' }}>Niche Intelligence</strong> hingga{' '}
          <strong style={{ color: 'var(--color-text-primary)' }}>Storyboard 5 Scene</strong> — semua
          dalam satu workflow. Stop kehabisan ide, mulai viral.
        </p>

        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/login" className="btn btn-viral btn-lg" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} />
            <span>Mulai Gratis — 7 Hari Pro Trial</span>
          </Link>
          <a href="#features" className="btn btn-secondary btn-lg">
            Lihat Cara Kerja
          </a>
        </div>

        <p
          style={{
            marginTop: 16,
            fontSize: 13,
            color: 'var(--color-text-muted)',
          }}
        >
          Tanpa kartu kredit · Trial 7 hari · Rp 150.000/bulan setelahnya
        </p>
      </section>

      {/* PROBLEM vs SOLUTION */}
      <section id="features" style={{ padding: '80px 40px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 60 }}>
          <h2
            style={{ fontSize: 36, fontWeight: 800, marginBottom: 12 }}
          >
            Masalah <span className="gradient-text">yang Viral Studio Pecahkan</span>
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 16 }}>
            Bukan sekadar tool — ini adalah strategi konten yang terinteligensi
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 24,
          }}
        >
          {[
            {
              Icon: Target,
              problem: 'Hari ini bikin konten apa?',
              solution: 'Niche Intelligence Engine',
              desc: 'AI deteksi niche & angle terbaik dari foto produk kamu',
            },
            {
              Icon: BarChart3,
              problem: 'Angle mana yang paling mungkin viral?',
              solution: 'Content Opportunity Score',
              desc: 'Skor 0-100 untuk setiap angle dengan estimasi CTR',
            },
            {
              Icon: User,
              problem: 'Siapa persona yang tepat?',
              solution: 'Creator Persona Recommendation',
              desc: 'AI rekomendasikan karakter & tone yang cocok untuk produkmu',
            },
            {
              Icon: Film,
              problem: 'Bagaimana hasilnya kelihatan?',
              solution: 'Full Storyboard + Gambar',
              desc: '5 scene storyboard lengkap dengan gambar AI-generated',
            },
          ].map((item, idx) => (
            <div key={idx} className="card" style={{ padding: 28 }}>
              <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center' }}>
                <item.Icon size={36} style={{ color: 'var(--color-brand-400)' }} />
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--color-text-muted)',
                  marginBottom: 6,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                Problem
              </div>
              <p
                style={{
                  fontSize: 15,
                  color: 'var(--color-text-secondary)',
                  marginBottom: 16,
                  fontStyle: 'italic',
                }}
              >
                &ldquo;{item.problem}&rdquo;
              </p>
              <div
                className="badge badge-brand"
                style={{ marginBottom: 10, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <ShieldCheck size={14} />
                <span>{item.solution}</span>
              </div>
              <p style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ padding: '80px 40px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 60 }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, marginBottom: 12 }}>
            Cara Kerja <span className="gradient-text-brand">Viral Studio</span>
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {[
            { step: '01', title: 'Upload Karakter & Produk', desc: 'Foto karakter + foto produk. Gemini Vision auto-analisis dan buat anchor phrase.' },
            { step: '02', title: 'AI Niche Intelligence', desc: 'Gemini deteksi niche, angle, persona, platform score, dan content matrix otomatis.' },
            { step: '03', title: 'Pilih Angle Terbaik', desc: 'Pilih dari 5-7 angle yang direkomendasikan dengan estimasi CTR masing-masing.' },
            { step: '04', title: 'Generate Full Storyboard', desc: '5 scene storyboard dengan gambar AI-generated siap upload ke TikTok/Reels/Shorts.' },
          ].map((item, i) => (
            <div
              key={item.step}
              style={{
                display: 'flex',
                gap: 24,
                alignItems: 'flex-start',
                padding: '28px 0',
                borderBottom: i < 3 ? '1px solid var(--border-subtle)' : 'none',
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  background: 'rgba(168, 45, 227, 0.15)',
                  border: '1px solid var(--border-brand)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  fontWeight: 800,
                  color: 'var(--color-brand-300)',
                  flexShrink: 0,
                  fontFamily: 'var(--font-display)',
                }}
              >
                {item.step}
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
                  {item.title}
                </h3>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 15, lineHeight: 1.6 }}>
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section style={{ padding: '80px 40px', maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
        <div className="badge badge-brand" style={{ marginBottom: 20, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={12} style={{ color: '#facc15' }} />
          <span>Harga Sederhana</span>
        </div>
        <h2 style={{ fontSize: 36, fontWeight: 800, marginBottom: 12 }}>
          Satu Harga, <span className="gradient-text">Semua Fitur</span>
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 40 }}>
          Harga segelas kopi. Hemat 10+ jam brainstorming setiap bulan.
        </p>

        <div
          className="card"
          style={{
            padding: 40,
            border: '1px solid var(--border-brand)',
            boxShadow: 'var(--glow-brand)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              background: 'var(--gradient-brand)',
            }}
          />
          <div
            className="badge badge-viral"
            style={{ marginBottom: 20, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Sparkles size={12} />
            <span>7 Hari Trial Gratis</span>
          </div>
          <div style={{ fontSize: 56, fontWeight: 900, marginBottom: 4 }} className="gradient-text-brand">
            Rp 150k
          </div>
          <div style={{ color: 'var(--color-text-muted)', marginBottom: 32 }}>
            per bulan · QRIS / GoPay / OVO / BCA VA
          </div>

          <ul
            style={{
              listStyle: 'none',
              textAlign: 'left',
              marginBottom: 36,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {[
              'Niche Intelligence Engine (full)',
              'Smart Content Matrix (15-30 kombinasi)',
              '5-Scene Storyboard Generation',
              'AI Image Generation per scene',
              'Karakter + Product Library',
              '10 generations per hari',
              'Semua tab: Detailing, Instant, Template',
              'Trending Niche weekly update',
            ].map((f) => (
              <li key={f} style={{ color: 'var(--color-text-secondary)', fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={16} style={{ color: '#4ade80', flexShrink: 0 }} />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          <Link href="/login" className="btn btn-viral btn-lg" style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Sparkles size={18} />
            <span>Mulai Trial 7 Hari Gratis</span>
          </Link>
          <p style={{ marginTop: 12, fontSize: 12, color: 'var(--color-text-muted)' }}>
            Tanpa kartu kredit. Batal kapan saja.
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer
        style={{
          borderTop: '1px solid var(--border-subtle)',
          padding: '32px 40px',
          textAlign: 'center',
          color: 'var(--color-text-muted)',
          fontSize: 13,
        }}
      >
        <p>© 2026 Viral Studio · Dibuat untuk affiliate marketer Indonesia</p>
      </footer>
    </main>
  )
}
