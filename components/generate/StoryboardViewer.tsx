'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { StoryboardScene } from '@/types/database'
import Toast from '@/components/ui/toast'
import Link from 'next/link'
import { 
  Film, 
  Download, 
  Trash2, 
  RotateCw, 
  Loader2, 
  Camera, 
  Mic, 
  Check, 
  Clipboard, 
  AlertCircle,
  XCircle,
  Save,
  Pencil,
  Bot,
  Sparkles,
  ArrowRight,
  Clapperboard,
  Zap
} from 'lucide-react'

interface SceneWithImage extends StoryboardScene {
  image_base64?: string | null
}

interface StoryboardViewerProps {
  scenes: SceneWithImage[]
  storyboardId?: string
  agent_instruction?: string
  initialTitle?: string | null
  selectedNiche?: string | null
  selectedAngle?: string | null
  createdAt?: string | Date | null
  showDetailHeader?: boolean
  anchorPhrase?: string
}

// ── SceneCard ────────────────────────────────────────────────────────────────
function SceneCard({
  scene,
  index,
  isActive,
  onDownload,
  onDeleteImage,
  onRegenerateImage,
  isRegenerating,
}: {
  scene: SceneWithImage
  index: number
  isActive: boolean
  onDownload: (scene: SceneWithImage, index: number) => void
  onDeleteImage?: (index: number) => void
  onRegenerateImage?: (index: number) => void
  isRegenerating?: boolean
}) {
  const [copied, setCopied] = useState(false)

  async function copyPrompt() {
    await navigator.clipboard.writeText(scene.flow_prompt || scene.video_prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const hasImage = !!scene.image_base64

  return (
    <div
      className="scene-card fade-in"
      style={{
        border: isActive ? '1px solid var(--color-brand-400)' : undefined,
        boxShadow: isActive ? 'var(--glow-brand)' : undefined,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Scene Thumbnail */}
      <div
        style={{
          aspectRatio: '9/16',
          width: '100%',
          background: 'linear-gradient(135deg, rgba(168,45,227,0.15) 0%, rgba(99,102,241,0.15) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        {hasImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`data:image/jpeg;base64,${scene.image_base64}`}
            alt={scene.scene_label}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center',
              zIndex: 1,
            }}
          />
        )}

        {!hasImage && !isRegenerating && (
          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2 }}>
            <Film size={32} style={{ marginBottom: 6 }} />
            <div style={{ fontSize: 11 }}>Belum ada gambar</div>
          </div>
        )}

        {/* Loading Overlay */}
        {isRegenerating && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.75)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-brand-300)',
              gap: 8,
              zIndex: 15,
            }}
            className="glow-pulse"
          >
            <Loader2 size={24} style={{ animation: 'spin 1.5s linear infinite' }} />
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Menggambar...</div>
          </div>
        )}

        {/* Scene badge overlay */}
        <span
          className="badge badge-brand"
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            fontSize: 11,
            backdropFilter: 'blur(6px)',
            background: 'rgba(168,45,227,0.85)',
            zIndex: 10,
          }}
        >
          Scene {index + 1}
        </span>

        {/* Download button overlay (only if has image) */}
        {hasImage && (
          <button
            onClick={(e) => { e.stopPropagation(); onDownload(scene, index) }}
            title="Download gambar scene ini"
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(6px)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
              zIndex: 10,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(168,45,227,0.7)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.55)')}
          >
            <Download size={15} />
          </button>
        )}

        {/* Delete image button overlay (only if has image and onDeleteImage is provided) */}
        {hasImage && onDeleteImage && (
          <button
            onClick={(e) => { e.stopPropagation(); onDeleteImage(index) }}
            title="Hapus gambar scene ini"
            style={{
              position: 'absolute',
              top: 8,
              right: 46, // offset to the left of download button (right: 8)
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'rgba(239,68,68,0.75)',
              backdropFilter: 'blur(6px)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
              zIndex: 10,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.95)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.75)')}
          >
            <Trash2 size={13} />
          </button>
        )}

        {/* Generate / Regenerate button overlay (only if onRegenerateImage is provided) */}
        {onRegenerateImage && !isRegenerating && (
          <button
            onClick={(e) => { e.stopPropagation(); onRegenerateImage(index) }}
            title={hasImage ? "Generate ulang gambar scene ini" : "Generate gambar scene ini"}
            style={{
              position: 'absolute',
              top: 8,
              right: hasImage ? 84 : 8, // Shifted to left of delete button if has image, else rightmost
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(6px)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
              zIndex: 10,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(168,45,227,0.7)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.55)')}
          >
            <RotateCw size={13} />
          </button>
        )}
      </div>

      {/* Scene Header */}
      <div style={{ padding: '12px 14px 10px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {scene.scene_label}
          </h4>
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Camera size={11} />
            <span>{scene.camera_suggestion}</span>
          </span>
        </div>
      </div>

      {/* Scene Info */}
      <div style={{ padding: 14, flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Narasi */}
        <div
          style={{
            padding: '8px 12px',
            background: 'rgba(168,45,227,0.08)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 12,
            borderLeft: '2px solid var(--color-brand-500)',
          }}
        >
          <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Mic size={11} />
            <span>Dialogue UGC</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: 0 }}>
            {scene.narasi_script}
          </p>
        </div>

        {/* Description */}
        <p style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.5, flex: 1 }}>
          {scene.scene_description}
        </p>
      </div>

      {/* Action footer */}
      <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border-subtle)', background: 'var(--color-surface-2)' }}>
        <button onClick={copyPrompt} className="btn btn-secondary btn-sm" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          {copied ? (
            <>
              <Check size={14} style={{ color: 'var(--color-brand-300)' }} />
              <span>Prompt Copied!</span>
            </>
          ) : (
            <>
              <Clipboard size={14} />
              <span>Copy Flow Prompt</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// ── Helper: download a single scene image ────────────────────────────────────
function downloadSceneImage(scene: SceneWithImage, index: number) {
  if (!scene.image_base64) return
  const link = document.createElement('a')
  link.href = `data:image/jpeg;base64,${scene.image_base64}`
  link.download = `scene-${index + 1}-${scene.scene_type ?? 'scene'}.jpg`
  link.click()
}

// ── Helper: download all scene images as individual files ────────────────────
async function downloadAllImages(scenes: SceneWithImage[]) {
  const withImages = scenes.filter((s) => s.image_base64)
  if (withImages.length === 0) return

  // Trigger download for each file with a slight delay to prevent browser blocking
  for (let i = 0; i < withImages.length; i++) {
    const scene = withImages[i]
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        const link = document.createElement('a')
        link.href = `data:image/jpeg;base64,${scene.image_base64}`
        link.download = `scene-${scenes.indexOf(scene) + 1}-${scene.scene_type ?? 'scene'}.jpg`
        link.click()
        resolve()
      }, i * 400)
    })
  }
}

// ── Main StoryboardViewer ────────────────────────────────────────────────────
export default function StoryboardViewer({
  scenes: initialScenes,
  storyboardId,
  agent_instruction,
  initialTitle,
  selectedNiche,
  selectedAngle,
  createdAt,
  showDetailHeader = false,
  anchorPhrase,
}: StoryboardViewerProps) {
  const router = useRouter()
  const [activeIndex, setActiveIndex] = useState(0)
  const [copiedAgent, setCopiedAgent] = useState(false)
  const [scenes, setScenes] = useState<SceneWithImage[]>(initialScenes)
  const [title, setTitle] = useState(initialTitle || (selectedNiche ? `${selectedNiche} - ${selectedAngle || 'Storyboard'}` : 'Storyboard'))

  async function handleRename() {
    const newTitle = prompt('Ubah Nama Storyboard:', title)
    if (newTitle === null) return // cancelled
    const trimmed = newTitle.trim()
    if (!trimmed) {
      showToast('Nama tidak boleh kosong', 'error')
      return
    }
    
    try {
      const res = await fetch(`/api/storyboard/${storyboardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      })
      if (!res.ok) throw new Error('Failed to rename storyboard')
      setTitle(trimmed)
      showToast('Nama storyboard berhasil diubah!', 'success')
    } catch (err: any) {
      showToast(err.message || 'Gagal mengubah nama', 'error')
    }
  }

  async function handleDelete() {
    if (!confirm('Apakah Anda yakin ingin menghapus storyboard ini secara permanen dari library?')) return
    
    try {
      const res = await fetch(`/api/storyboard/${storyboardId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete storyboard')
      showToast('Storyboard berhasil dihapus!', 'success')
      setTimeout(() => {
        router.push('/library')
        router.refresh()
      }, 800)
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus storyboard', 'error')
    }
  }

  // Image generation state
  const [genStatus, setGenStatus] = useState<'idle' | 'generating' | 'done' | 'error'>('idle')
  const [genProgress, setGenProgress] = useState(0)
  const [genMessage, setGenMessage] = useState('')
  const [downloadingAll, setDownloadingAll] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false)
  const [tempScenes, setTempScenes] = useState<SceneWithImage[]>([])
  const [savingEdits, setSavingEdits] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error'>('success')
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null)

  // Regenerate Modal State
  const [regenModalOpen, setRegenModalOpen] = useState(false)
  const [regenModalIndex, setRegenModalIndex] = useState<number | null>(null)
  const [regenModalPrompt, setRegenModalPrompt] = useState('')
  const [regenModalDesc, setRegenModalDesc] = useState('')

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToastMessage(msg)
    setToastType(type)
  }

  function startEditing() {
    setTempScenes(JSON.parse(JSON.stringify(scenes)))
    setIsEditing(true)
  }

  function cancelEditing() {
    setIsEditing(false)
    setTempScenes([])
  }

  async function saveEdits() {
    if (!storyboardId) return
    try {
      setSavingEdits(true)
      const res = await fetch(`/api/storyboard/${storyboardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenes: tempScenes }),
      })
      if (!res.ok) throw new Error('Failed to save storyboard scenes')
      setScenes(tempScenes)
      setIsEditing(false)
      showToast('Perubahan storyboard berhasil disimpan!', 'success')
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan perubahan', 'error')
    } finally {
      setSavingEdits(false)
    }
  }

  function updateTempSceneField(index: number, field: keyof SceneWithImage, value: any) {
    setTempScenes((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    )
  }

  async function handleDeleteImage(index: number) {
    if (!confirm('Apakah Anda yakin ingin menghapus gambar pada scene ini?')) return

    const updatedScenes = scenes.map((s, i) =>
      i === index ? { ...s, image_base64: null } : s
    )
    
    if (isEditing) {
      setTempScenes((prev) =>
        prev.map((s, i) => (i === index ? { ...s, image_base64: null } : s))
      )
    }

    setScenes(updatedScenes)

    if (storyboardId) {
      try {
        const res = await fetch(`/api/storyboard/${storyboardId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scenes: updatedScenes }),
        })
        if (!res.ok) throw new Error('Gagal menghapus gambar di database')
        showToast('Gambar scene berhasil dihapus!', 'success')
      } catch (err: any) {
        showToast(err.message || 'Gagal menghapus gambar dari server', 'error')
      }
    } else {
      showToast('Gambar scene berhasil dihapus dari draf!', 'success')
    }
  }

  function openRegenModal(index: number) {
    const sceneToGen = isEditing ? tempScenes[index] : scenes[index]
    if (!sceneToGen) return
    setRegenModalIndex(index)
    setRegenModalDesc(sceneToGen.scene_description || '')
    setRegenModalPrompt(sceneToGen.video_prompt || '')
    setRegenModalOpen(true)
  }

  async function handleRegenerateImage(index: number, customDesc: string, customPrompt: string) {
    if (regeneratingIndex !== null) return

    setRegeneratingIndex(index)
    setRegenModalOpen(false)
    showToast(`Memulai generate gambar untuk Scene ${index + 1}...`, 'success')

    try {
      const res = await fetch('/api/storyboard/generate-single-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyboardId: storyboardId || undefined,
          sceneIndex: index,
          sceneDescription: customDesc,
          videoPrompt: customPrompt,
          sceneLabel: scenes[index]?.scene_label,
          anchorPhrase: anchorPhrase || undefined
        })
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Gagal generate gambar scene')
      }

      const data = await res.json()
      if (!data.image_base64) {
        throw new Error('Server tidak mengembalikan gambar')
      }

      const updatedScenes = scenes.map((s, i) =>
        i === index ? { ...s, image_base64: data.image_base64, scene_description: customDesc, video_prompt: customPrompt } : s
      )
      
      if (isEditing) {
        setTempScenes((prev) =>
          prev.map((s, i) => (i === index ? { ...s, image_base64: data.image_base64, scene_description: customDesc, video_prompt: customPrompt } : s))
        )
      }

      setScenes(updatedScenes)
      showToast(`Gambar Scene ${index + 1} berhasil digenerate!`, 'success')
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan saat generate gambar', 'error')
    } finally {
      setRegeneratingIndex(null)
    }
  }

  const hasAnyImage = scenes.some((s) => s.image_base64)
  const allImagesReady = scenes.every((s) => s.image_base64)

  async function copyAgentInstruction() {
    if (agent_instruction) {
      await navigator.clipboard.writeText(agent_instruction)
      setCopiedAgent(true)
      setTimeout(() => setCopiedAgent(false), 2000)
    }
  }

  // ── Polling for Background Image Generation ───────────────────────────────
  useEffect(() => {
    let intervalId: NodeJS.Timeout

    async function checkStatus() {
      if (!storyboardId) return
      try {
        const res = await fetch(`/api/storyboard/${storyboardId}`)
        if (!res.ok) return
        const data = await res.json()
        const fetchedStoryboard = data.storyboard
        
        if (fetchedStoryboard && fetchedStoryboard.scenes) {
          setScenes(fetchedStoryboard.scenes)
          
          // Hitung progress
          const generatedCount = fetchedStoryboard.scenes.filter((s: any) => !!s.image_base64).length
          const total = fetchedStoryboard.scenes.length
          setGenProgress(Math.round((generatedCount / total) * 100))
          setGenMessage(`Memproses gambar... (${generatedCount}/${total} selesai)`)

          if (fetchedStoryboard.status === 'complete' || generatedCount === total) {
            setGenStatus('done')
            setGenMessage('Semua gambar scene berhasil dibuat!')
          }
        }
      } catch (err) {
        console.error('Polling error:', err)
      }
    }

    if (genStatus === 'generating') {
      // Poll every 4 seconds
      intervalId = setInterval(checkStatus, 4000)
    }

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [genStatus, storyboardId])

  async function startGenerateImages() {
    if (!storyboardId || genStatus === 'generating') return

    setGenStatus('generating')
    setGenProgress(0)
    setGenMessage('Memulai background worker via QStash...')

    try {
      const res = await fetch('/api/storyboard/generate-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyboardId }),
      })

      if (!res.ok) throw new Error('Gagal memicu background task')
    } catch (err: any) {
      setGenStatus('error')
      setGenMessage(err.message ?? 'Gagal generate gambar')
    }
  }

  async function handleDownloadAll() {
    setDownloadingAll(true)
    await downloadAllImages(scenes)
    setDownloadingAll(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Detail Page Header (Breadcrumbs, Title rename/delete, Badges) */}
      {showDetailHeader && (
        <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 24, marginBottom: 12 }}>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, fontSize: 13, color: 'var(--color-text-muted)' }}>
            <Link href="/library" style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>
              Library
            </Link>
            <span>›</span>
            <span style={{ color: 'var(--color-text-secondary)' }}>
              {selectedNiche} · {selectedAngle}
            </span>
          </div>

          {/* Interactive Title with Rename/Delete controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', margin: 0 }}>
                {title}
              </h1>
              
              {/* Quick Actions (Rename / Delete) */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleRename}
                  title="Ubah Nama Storyboard"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'var(--color-text-secondary)',
                    borderRadius: 8,
                    width: 32,
                    height: 32,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(168,45,227,0.2)'; e.currentTarget.style.borderColor = 'rgba(168,45,227,0.4)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={handleDelete}
                  title="Hapus Storyboard"
                  style={{
                    background: 'rgba(239,68,68,0.06)',
                    border: '1px solid rgba(239,68,68,0.15)',
                    color: '#ef4444',
                    borderRadius: 8,
                    width: 32,
                    height: 32,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.15)'; }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            
            {/* Meta Tags */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {selectedNiche && <span className="badge badge-brand">{selectedNiche}</span>}
              {selectedAngle && <span className="badge badge-viral">{selectedAngle}</span>}
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                {createdAt ? new Date(createdAt).toLocaleDateString('id-ID', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                }) : 'Baru'}
              </span>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Film size={22} style={{ color: 'var(--color-brand-400)' }} />
            <span>Paket Produksi Google Flow</span>
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>
            {scenes.length} scene · Siap di-paste ke Google Agent Mode Flow
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {isEditing ? (
            <>
              <button
                onClick={cancelEditing}
                disabled={savingEdits}
                className="btn btn-secondary btn-sm"
              >
                Batal
              </button>
              <button
                onClick={saveEdits}
                disabled={savingEdits}
                className="btn btn-viral btn-sm"
                style={{ background: 'rgba(168,45,227,0.85)', border: '1px solid var(--color-brand-400)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                {savingEdits ? (
                  <>
                    <Loader2 size={13} style={{ animation: 'spin 1.5s linear infinite' }} />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Save size={13} />
                    <span>Simpan Perubahan</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              {/* Edit Storyboard button */}
              {storyboardId && (
                <button
                  onClick={startEditing}
                  className="btn btn-secondary btn-sm"
                  style={{ borderColor: 'rgba(168,45,227,0.5)', color: 'var(--color-brand-300)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Pencil size={13} />
                  <span>Edit Storyboard</span>
                </button>
              )}

              {/* Download All button */}
              {hasAnyImage && (
                <button
                  onClick={handleDownloadAll}
                  disabled={downloadingAll}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  {downloadingAll ? (
                    <>
                      <Loader2 size={13} style={{ animation: 'spin 1.5s linear infinite' }} />
                      <span>Downloading...</span>
                    </>
                  ) : (
                    <>
                      <Download size={13} />
                      <span>Download All ({scenes.filter(s => s.image_base64).length})</span>
                    </>
                  )}
                </button>
              )}
              {/* Generate Images button */}
              {storyboardId && (
                <button
                  onClick={startGenerateImages}
                  disabled={genStatus === 'generating'}
                  className="btn btn-viral btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  {genStatus === 'generating' ? (
                    <>
                      <Loader2 size={13} style={{ animation: 'spin 1.5s linear infinite' }} />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <RotateCw size={13} />
                      <span>
                        {allImagesReady ? 'Regenerate Gambar' : 'Generate Gambar Scene'}
                      </span>
                    </>
                  )}
                </button>
              )}
              {storyboardId && (
                <a href={`/library/${storyboardId}`} className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span>Simpan ke Library</span>
                  <ArrowRight size={13} />
                </a>
              )}
            </>
          )}
        </div>
      </div>

      {/* Image Generation Progress Bar */}
      {genStatus === 'generating' && (
        <div
          className="card"
          style={{
            padding: '18px 22px',
            background: 'linear-gradient(135deg, rgba(168,45,227,0.1), rgba(99,102,241,0.08))',
            border: '1px solid var(--color-brand-500)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 13 }}>
            <span style={{ color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={14} style={{ color: 'var(--color-brand-300)' }} />
              <span>{genMessage}</span>
            </span>
            <span style={{ color: 'var(--color-brand-300)', fontWeight: 700 }}>{genProgress}%</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${genProgress}%`, transition: 'width 0.5s ease' }}
            />
          </div>
          <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Zap size={11} style={{ color: '#facc15' }} />
            <span>Imagen 3 menghasilkan gambar ~5-10 detik per scene</span>
          </p>
        </div>
      )}

      {genStatus === 'error' && (
        <div
          className="card"
          style={{ padding: '14px 18px', borderLeft: '3px solid #f87171', background: 'rgba(248,113,113,0.08)' }}
        >
          <span style={{ color: '#f87171', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <XCircle size={14} />
            <span>{genMessage}</span>
          </span>
        </div>
      )}

      {genStatus === 'done' && (
        <div
          className="card"
          style={{ padding: '14px 18px', borderLeft: '3px solid #4ade80', background: 'rgba(74,222,128,0.08)' }}
        >
          <span style={{ color: '#4ade80', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Check size={14} />
            <span>{genMessage} — Klik unduh di tiap scene untuk download, atau tombol "Download All".</span>
          </span>
        </div>
      )}

      {/* Agent Instruction (Global) */}
      {agent_instruction && (
        <div className="card" style={{ padding: 24, borderLeft: '4px solid var(--color-brand-500)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bot size={18} style={{ color: 'var(--color-brand-400)' }} />
                <span>Agent Mode Instruction</span>
              </h3>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>
                Copy instruksi ini ke Google Flow "Agent Mode" untuk memproses semua scene secara berurutan.
              </p>
            </div>
            <button onClick={copyAgentInstruction} className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {copiedAgent ? (
                <>
                  <Check size={13} />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Clipboard size={13} />
                  <span>Copy Agent Briefing</span>
                </>
              )}
            </button>
          </div>
          <div
            style={{
              background: 'var(--color-dark-800)',
              padding: 16,
              borderRadius: 'var(--radius-md)',
              fontFamily: 'monospace',
              fontSize: 12,
              color: 'var(--color-text-secondary)',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              maxHeight: 200,
              overflowY: 'auto',
            }}
          >
            {agent_instruction}
          </div>
        </div>
      )}

      {/* Scene Grid */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>Flow Prompts per Scene</h3>
          {!storyboardId && (
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Save size={11} />
              <span>Simpan ke Library untuk generate gambar referensi</span>
            </span>
          )}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {(isEditing ? tempScenes : scenes).map((scene, i) => (
            <div key={i} onClick={() => setActiveIndex(i)} style={{ cursor: 'pointer' }}>
              <SceneCard
                scene={scene}
                index={i}
                isActive={activeIndex === i}
                onDownload={downloadSceneImage}
                onDeleteImage={handleDeleteImage}
                onRegenerateImage={openRegenModal}
                isRegenerating={regeneratingIndex === i}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Active Scene Prompt Details & Interactive Editor */}
      {(isEditing ? tempScenes[activeIndex] : scenes[activeIndex]) && (
        <>
          {isEditing ? (
            <div className="card fade-in" style={{ padding: 24, border: '1px solid rgba(168,45,227,0.3)', boxShadow: 'var(--glow-brand)' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 18, color: 'var(--color-brand-300)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Pencil size={16} />
                <span>Edit Scene {activeIndex + 1}:</span>
                <span style={{ fontWeight: 500, fontSize: 14, color: 'var(--color-text-secondary)' }}>{tempScenes[activeIndex]?.scene_label}</span>
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                {/* Scene Label */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6, textTransform: 'uppercase', fontWeight: 600 }}>Nama Scene</label>
                  <input
                    type="text"
                    value={tempScenes[activeIndex]?.scene_label || ''}
                    onChange={(e) => updateTempSceneField(activeIndex, 'scene_label', e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--color-dark-800)',
                      border: '1px solid var(--border-subtle)',
                      color: '#fff',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 13
                    }}
                  />
                </div>
                
                {/* Camera Suggestion */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6, textTransform: 'uppercase', fontWeight: 600 }}>Camera Suggestion</label>
                  <input
                    type="text"
                    value={tempScenes[activeIndex]?.camera_suggestion || ''}
                    onChange={(e) => updateTempSceneField(activeIndex, 'camera_suggestion', e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--color-dark-800)',
                      border: '1px solid var(--border-subtle)',
                      color: '#fff',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 13
                    }}
                  />
                </div>
              </div>

              {/* Dialogue Script */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6, textTransform: 'uppercase', fontWeight: 600 }}>
                  <Mic size={12} />
                  <span>Dialogue UGC (Naskah Suara)</span>
                </label>
                <textarea
                  rows={3}
                  value={tempScenes[activeIndex]?.narasi_script || ''}
                  onChange={(e) => updateTempSceneField(activeIndex, 'narasi_script', e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--color-dark-800)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 13,
                    lineHeight: 1.5,
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Scene Description */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6, textTransform: 'uppercase', fontWeight: 600 }}>
                  <Film size={12} />
                  <span>Deskripsi Visual (Aksi/Scene)</span>
                </label>
                <textarea
                  rows={3}
                  value={tempScenes[activeIndex]?.scene_description || ''}
                  onChange={(e) => updateTempSceneField(activeIndex, 'scene_description', e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--color-dark-800)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 13,
                    lineHeight: 1.5,
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* AI Image Prompt */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6, textTransform: 'uppercase', fontWeight: 600 }}>
                  <Sparkles size={12} />
                  <span>AI Image Generation Prompt</span>
                </label>
                <textarea
                  rows={3}
                  value={tempScenes[activeIndex]?.video_prompt || tempScenes[activeIndex]?.flow_prompt || ''}
                  onChange={(e) => {
                    updateTempSceneField(activeIndex, 'video_prompt', e.target.value)
                    updateTempSceneField(activeIndex, 'flow_prompt', e.target.value)
                  }}
                  style={{
                    width: '100%',
                    background: 'var(--color-dark-800)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 13,
                    lineHeight: 1.5,
                    fontFamily: 'monospace',
                    resize: 'vertical'
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Film size={16} />
                <span>Detail Prompt Gambar: {scenes[activeIndex]?.scene_label}</span>
              </h3>
              <div
                style={{
                  padding: '14px 16px',
                  background: 'var(--color-dark-800)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  color: 'var(--color-text-secondary)',
                  lineHeight: 1.7,
                  fontFamily: 'monospace',
                }}
              >
                {scenes[activeIndex]?.flow_prompt || scenes[activeIndex]?.video_prompt}
              </div>
            </div>
          )}
        </>
      )}

      {/* Regenerate Image Modal */}
      {regenModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)'
        }}>
          <div className="card fade-in" style={{ width: '90%', maxWidth: 500, padding: 24, border: '1px solid var(--border-subtle)', position: 'relative' }}>
            <button
              onClick={() => setRegenModalOpen(false)}
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}
            >
              <XCircle size={20} />
            </button>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: '#fff' }}>Regenerate Gambar Scene {regenModalIndex !== null ? regenModalIndex + 1 : ''}</h3>
            
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Film size={14} /> Deskripsi Visual Scene
              </label>
              <textarea
                className="input"
                rows={3}
                value={regenModalDesc}
                onChange={(e) => setRegenModalDesc(e.target.value)}
                placeholder="Deskripsi adegan secara visual..."
              />
            </div>

            <div className="form-group" style={{ marginTop: 16 }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Camera size={14} /> Camera & Mood Prompt
              </label>
              <textarea
                className="input"
                rows={4}
                value={regenModalPrompt}
                onChange={(e) => setRegenModalPrompt(e.target.value)}
                placeholder="Prompt untuk AI image generator..."
              />
              <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8 }}>
                Prompt ini akan dikirimkan ke AI (Imagen 3). Anda dapat memodifikasinya sebelum melakukan regenerasi untuk mengubah hasil gambar.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setRegenModalOpen(false)}>
                Batal
              </button>
              <button
                className="btn btn-viral"
                onClick={() => regenModalIndex !== null && handleRegenerateImage(regenModalIndex, regenModalDesc, regenModalPrompt)}
              >
                <RotateCw size={16} /> Generate Ulang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Toast Notification */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => setToastMessage('')}
        />
      )}
    </div>
  )
}

// =====================================================
// Streaming Progress Component
// =====================================================
interface StreamingProgressProps {
  progress: number
  message: string
  currentScene?: number
  totalScenes?: number
}

export function StreamingProgress({ progress, message, currentScene, totalScenes }: StreamingProgressProps) {
  return (
    <div
      style={{
        padding: 32,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: 'var(--gradient-brand)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'pulse-glow 2s ease-in-out infinite',
        }}
        className="glow-pulse"
      >
        <Clapperboard size={32} style={{ color: '#fff' }} />
      </div>

      <div style={{ width: '100%', maxWidth: 400 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 8,
            fontSize: 13,
          }}
        >
          <span style={{ color: 'var(--color-text-secondary)' }}>{message}</span>
          <span style={{ color: 'var(--color-brand-300)', fontWeight: 700 }}>
            {Math.round(progress)}%
          </span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        {currentScene !== undefined && totalScenes && (
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 8 }}>
            Scene {currentScene} / {totalScenes}
          </p>
        )}
      </div>

      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
        <Zap size={14} style={{ color: '#facc15' }} />
        <span>Proses ini membutuhkan ~30-60 detik</span>
      </p>
    </div>
  )
}
