'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Toast from '@/components/ui/toast'
import { 
  Library, 
  Rocket, 
  Film, 
  Pencil, 
  Trash2, 
  Check, 
  Clock, 
  AlertCircle 
} from 'lucide-react'

interface StoryboardListItem {
  id: string
  user_id: string
  title: string | null
  selected_niche: string | null
  selected_angle: any
  scenes: any
  status: string | null
  created_at: Date | string | null
}

interface LibraryListProps {
  initialStoryboards: StoryboardListItem[]
}

export default function LibraryList({ initialStoryboards }: LibraryListProps) {
  const router = useRouter()
  const [storyboards, setStoryboards] = useState<StoryboardListItem[]>(initialStoryboards)
  
  // Toast notifications
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error'>('success')

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToastMessage(message)
    setToastType(type)
  }

  // Rename handler
  async function handleRename(sb: StoryboardListItem) {
    const angle = sb.selected_angle as { name?: string } | null
    const defaultTitle = sb.title || `${sb.selected_niche} - ${angle?.name || 'Storyboard'}`
    const newTitle = prompt('Ubah Nama Storyboard:', defaultTitle)
    if (newTitle === null) return // User cancelled
    
    const trimmed = newTitle.trim()
    if (!trimmed) {
      showToast('Nama tidak boleh kosong', 'error')
      return
    }

    try {
      const res = await fetch(`/api/storyboard/${sb.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      })

      if (!res.ok) throw new Error('Gagal mengubah nama')

      // Update state locally
      setStoryboards((prev) =>
        prev.map((item) => (item.id === sb.id ? { ...item, title: trimmed } : item))
      )
      showToast('Nama storyboard berhasil diubah!', 'success')
      router.refresh() // Sync Server Component data in background
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan', 'error')
    }
  }

  // Delete handler
  async function handleDelete(id: string) {
    if (!confirm('Apakah Anda yakin ingin menghapus storyboard ini secara permanen dari library?')) return

    try {
      const res = await fetch(`/api/storyboard/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Gagal menghapus storyboard')

      // Update state locally
      setStoryboards((prev) => prev.filter((item) => item.id !== id))
      showToast('Storyboard berhasil dihapus!', 'success')
      router.refresh() // Sync Server Component data in background
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan', 'error')
    }
  }

  if (storyboards.length === 0) {
    return (
      <div
        className="card"
        style={{ padding: 64, textAlign: 'center', border: '2px dashed var(--border-subtle)', background: 'transparent' }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <Library size={56} style={{ color: 'var(--color-brand-400)' }} />
        </div>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 20, fontSize: 16 }}>
          Library kosong. Mulai generate storyboard pertama!
        </p>
        <Link href="/generate" className="btn btn-viral" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Rocket size={16} />
          <span>Generate Pertama</span>
        </Link>
      </div>
    )
  }

  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 24,
          paddingBottom: 40,
        }}
      >
        {storyboards.map((sb) => {
          const scenes = (sb.scenes ?? []) as any[]
          const thumbnail = scenes.find((s) => s.image_base64)?.image_base64
          const angle = sb.selected_angle as { name?: string } | null
          const displayTitle = sb.title || `${sb.selected_niche} - ${angle?.name || 'Storyboard'}`

          return (
            <Link
              key={sb.id}
              href={`/library/${sb.id}`}
              className="card-interactive"
              style={{
                textDecoration: 'none',
                position: 'relative',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                border: '1px solid var(--border-subtle)',
                aspectRatio: '9/16',
                background: 'linear-gradient(135deg, rgba(168,45,227,0.12) 0%, rgba(99,102,241,0.12) 100%)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-6px)'
                e.currentTarget.style.borderColor = 'rgba(168,45,227,0.5)'
                e.currentTarget.style.boxShadow = 'var(--glow-brand)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.borderColor = 'var(--border-subtle)'
                e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.4)'
              }}
            >
              {thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`data:image/jpeg;base64,${thumbnail}`}
                  alt={displayTitle}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'center',
                    zIndex: 0,
                  }}
                />
              )}

              {/* Empty placeholder icon */}
              {!thumbnail && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', gap: 10, zIndex: 1 }}>
                  <Film size={44} style={{ color: 'rgba(255,255,255,0.3)' }} />
                  <div style={{ fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Belum ada gambar</div>
                </div>
              )}

              {/* Floating Quick Action Buttons */}
              <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 6, zIndex: 20 }}>
                {/* Rename */}
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleRename(sb)
                  }}
                  title="Ubah Nama"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: 'rgba(0,0,0,0.65)',
                    backdropFilter: 'blur(6px)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(168,45,227,0.85)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.65)')}
                >
                  <Pencil size={13} />
                </button>
                {/* Delete */}
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleDelete(sb.id)
                  }}
                  title="Hapus Storyboard"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: 'rgba(239,68,68,0.12)',
                    backdropFilter: 'blur(6px)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    color: '#ef4444',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(239,68,68,0.85)'
                    e.currentTarget.style.color = '#fff'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(239,68,68,0.12)'
                    e.currentTarget.style.color = '#ef4444'
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>

              {/* Status Badge overlay (top-left) */}
              <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 10 }}>
                {sb.status === 'complete' ? (
                  <span
                    className="badge"
                    style={{
                      fontSize: 10,
                      margin: 0,
                      background: 'rgba(34,197,94,0.85)',
                      backdropFilter: 'blur(4px)',
                      color: '#fff',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <Check size={11} />
                    <span>Ready</span>
                  </span>
                ) : (
                  <span
                    className="badge"
                    style={{
                      fontSize: 10,
                      margin: 0,
                      background: 'rgba(245,158,11,0.85)',
                      backdropFilter: 'blur(4px)',
                      color: '#fff',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <Clock size={11} />
                    <span>Draft</span>
                  </span>
                )}
              </div>

              {/* Frosted Glass Info Bottom Overlay */}
              <div
                style={{
                  width: '100%',
                  padding: '18px 16px',
                  background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 65%, rgba(0,0,0,0) 100%)',
                  backdropFilter: 'blur(8px)',
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  zIndex: 10,
                }}
              >
                <h3
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: '#fff',
                    margin: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                  }}
                >
                  {displayTitle}
                </h3>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span
                    className="badge badge-brand"
                    style={{
                      fontSize: 9,
                      padding: '2px 8px',
                      background: 'rgba(168,45,227,0.7)',
                      backdropFilter: 'blur(4px)',
                      color: '#fff',
                      margin: 0,
                    }}
                  >
                    {sb.selected_niche}
                  </span>
                  
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Film size={12} />
                    <span>{scenes.length} Scenes</span>
                  </span>
                </div>

                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{angle?.name || 'Standard Angle'}</span>
                  <span>
                    {sb.created_at
                      ? new Date(sb.created_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                        })
                      : 'Baru'}
                  </span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Global Toast */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => setToastMessage('')}
        />
      )}
    </>
  )
}
