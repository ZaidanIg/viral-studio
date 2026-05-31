import prisma from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Image from 'next/image'
import { User, Lock } from 'lucide-react'

export default async function CharactersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const characters = await prisma.character.findMany({
    where: { user_id: user.id },
    orderBy: { created_at: 'desc' }
  })

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            <User size={26} style={{ color: 'var(--color-brand-400)' }} />
            <span>Library Karakter</span>
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>
            {characters?.length ?? 0} karakter tersimpan
          </p>
        </div>
      </div>

      {!characters || characters.length === 0 ? (
        <div
          className="card"
          style={{ padding: 64, textAlign: 'center', border: '2px dashed var(--border-subtle)', background: 'transparent' }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <User size={56} style={{ color: 'var(--color-brand-400)' }} />
          </div>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 20, fontSize: 16 }}>
            Belum ada karakter yang disimpan.
          </p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
            Karakter otomatis tersimpan saat kamu membuat storyboard di halaman Generate.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
          {(characters as Array<{
            id: string
            image_urls: string[] | null
            label_name: string | null
            anchor_phrase: string
            anchor_hash: string
            created_at: Date | null
          }>).map((char) => {
            const imageUrls = char.image_urls ?? []
            return (
              <div key={char.id} className="card" style={{ overflow: 'hidden' }}>
                {/* Thumbnails */}
                <div style={{ display: 'flex', height: 120, background: 'var(--color-surface-3)' }}>
                  {imageUrls.length > 0 ? (
                    imageUrls.slice(0, 3).map((url, i) => (
                      <div key={i} style={{ flex: 1, position: 'relative', borderRight: i < 2 ? '1px solid var(--border-subtle)' : 'none' }}>
                        <Image src={url} alt="Karakter" fill style={{ objectFit: 'cover' }} />
                      </div>
                    ))
                  ) : (
                    <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <User size={32} style={{ color: 'var(--color-text-muted)' }} />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div style={{ padding: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: 'var(--color-text-primary)' }}>
                    {char.label_name || 'Karakter Tanpa Nama'}
                  </h3>
                  <div
                    style={{
                      padding: '10px 12px',
                      background: 'rgba(168,45,227,0.08)',
                      borderRadius: 'var(--radius-md)',
                      marginBottom: 12,
                      borderLeft: '2px solid var(--color-brand-500)',
                    }}
                  >
                    <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Lock size={10} />
                      <span>Anchor Phrase (Locked)</span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'monospace', lineHeight: 1.5 }}>
                      {char.anchor_phrase}
                    </p>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                      ID: {char.anchor_hash}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                      {char.created_at ? new Date(char.created_at).toLocaleDateString('id-ID') : 'Baru saja'}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
