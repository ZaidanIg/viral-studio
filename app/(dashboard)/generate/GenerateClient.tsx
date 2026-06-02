'use client'

import { useState } from 'react'
import { UploadButton } from '@uploadthing/react'
import type { OurFileRouter } from '@/lib/uploadthing/core'
import type { NicheDetectionResult, StoryboardScene } from '@/types/database'
import NicheIntelligence from '@/components/generate/NicheIntelligence'
import StoryboardViewer, { StreamingProgress } from '@/components/generate/StoryboardViewer'
import Toast from '@/components/ui/toast'
import { Zap, Sparkles, User, Package, AlertCircle, ShieldCheck, Brain, Lock } from 'lucide-react'

// =====================================================
// Step definitions
// =====================================================
const STEPS = [
  { id: 1, label: 'Karakter' },
  { id: 2, label: 'Produk' },
  { id: 3, label: 'Niche AI' },
  { id: 4, label: 'Storyboard' },
]

// =====================================================
// Main Generate Page
// =====================================================
export default function GeneratePage() {
  const [activeTab, setActiveTab] = useState<'detailing' | 'instant'>('detailing')
  const [step, setStep] = useState(1)

  // Character state
  const [characterImages, setCharacterImages] = useState<string[]>([])
  const [anchorPhrase, setAnchorPhrase] = useState('')
  const [anchorLocked, setAnchorLocked] = useState(false)
  const [characterAnalyzing, setCharacterAnalyzing] = useState(false)

  // Product state
  const [productImages, setProductImages] = useState<string[]>([])
  const [productName, setProductName] = useState('')
  const [productDesc, setProductDesc] = useState('')
  const [productBenefits, setProductBenefits] = useState('')

  // Niche state
  const [nicheData, setNicheData] = useState<NicheDetectionResult | null>(null)
  const [nicheLoading, setNicheLoading] = useState(false)
  const [nicheError, setNicheError] = useState('')
  const [lighting, setLighting] = useState('Handheld, candid, sedikit goyangan kamera, framing tidak sempurna')
  const [cameraStyle, setCameraStyle] = useState('Cahaya ruangan natural, sedikit tidak sempurna')

  // Storyboard state
  const [selectedAngle, setSelectedAngle] = useState('')
  const [selectedPersona, setSelectedPersona] = useState('')
  const [selectedNiche, setSelectedNiche] = useState('')
  const [storyboardScenes, setStoryboardScenes] = useState<
    (StoryboardScene & { image_base64?: string | null })[]
  >([])
  const [streamProgress, setStreamProgress] = useState(0)
  const [streamMessage, setStreamMessage] = useState('')
  const [generating, setGenerating] = useState(false)
  const [storyboardId, setStoryboardId] = useState<string | undefined>()

  // UI state
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error'>('success')

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToastMessage(message)
    setToastType(type)
  }

  // =====================================================
  // Handlers
  // =====================================================

  async function analyzeCharacter(imageUrl: string) {
    setCharacterAnalyzing(true)
    try {
      // Fetch image as base64
      const res = await fetch(imageUrl)
      const blob = await res.blob()
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve((reader.result as string).split(',')[1])
        reader.readAsDataURL(blob)
      })

      const response = await fetch('/api/character-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64 }),
      })
      const data = await response.json()
      
      showToast(data.message || (response.ok ? 'Berhasil upload karakter' : 'Gagal upload karakter'), response.ok ? 'success' : 'error')

      if (response.ok && data.data) {
        setAnchorPhrase(data.data.anchorPhrase)
      }
    } catch (e) {
      console.error(e)
      showToast('Terjadi kesalahan jaringan', 'error')
    } finally {
      setCharacterAnalyzing(false)
    }
  }

  async function detectNiche() {
    setNicheLoading(true)
    setNicheError('')
    try {
      const response = await fetch('/api/niche-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName,
          productDescription: productDesc,
        }),
      })
      const data = await response.json()
      
      showToast(data.message || (response.ok ? 'Berhasil analisis niche' : 'Gagal analisis niche'), response.ok ? 'success' : 'error')

      if (response.ok && data.data) {
        setNicheData(data.data)
        setStep(3)
      } else {
        setNicheError(data.message || 'Gagal analisis niche')
      }
    } catch {
      setNicheError('Terjadi kesalahan. Coba lagi.')
      showToast('Terjadi kesalahan jaringan', 'error')
    } finally {
      setNicheLoading(false)
    }
  }

  async function generateStoryboard(angle: string, persona: string, niche: string) {
    setSelectedAngle(angle)
    setSelectedPersona(persona)
    setSelectedNiche(niche)
    setGenerating(true)
    setStoryboardScenes([])
    setStreamProgress(0)
    setStep(4)

    try {
      const response = await fetch('/api/storyboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anchorPhrase,
          characterImages,
          productName,
          visualDesc: productDesc,
          benefits: productBenefits.split('\n').filter(Boolean),
          selectedNiche: niche,
          selectedAngle: angle,
          selectedPersona: persona,
          lighting,
          cameraStyle,
        }),
      })

      if (!response.body) throw new Error('No stream')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value)
        const lines = text.split('\n').filter((l) => l.startsWith('data: '))

        for (const line of lines) {
          const data = JSON.parse(line.slice(6))

          if (data.error) {
            setNicheError(data.error)
            showToast(data.error, 'error')
            setGenerating(false)
            return
          }

          if (data.progress) setStreamProgress(data.progress)
          if (data.message) setStreamMessage(data.message)

          if (data.step === 'scenes_ready' && data.scenes) {
            setStoryboardScenes(data.scenes)
          }

          if (data.step === 'scene_image_ready') {
            setStoryboardScenes((prev) => {
              const updated = [...prev]
              if (updated[data.sceneIndex]) {
                updated[data.sceneIndex] = {
                  ...updated[data.sceneIndex],
                  image_base64: data.imageBase64,
                }
              }
              return updated
            })
          }

          if (data.step === 'complete') {
            setStoryboardId(data.storyboardId)
            showToast(data.message || 'Berhasil generate storyboard', 'success')
            setGenerating(false)
          }
        }
      }
    } catch {
      setNicheError('Gagal generate storyboard. Coba lagi.')
      setGenerating(false)
    }
  }

  // =====================================================
  // Render
  // =====================================================
  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={26} style={{ color: '#facc15' }} />
          <span>Generate Storyboard</span>
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>
          Upload karakter & produk → AI analisis niche → Generate storyboard 5 scene
        </p>
      </div>

      {/* Tab Navigation */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: 4,
          background: 'var(--color-surface-1)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          marginBottom: 28,
          width: 'fit-content',
        }}
      >
        {(['detailing', 'instant'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              transition: 'all 0.2s',
              background: activeTab === tab ? 'var(--gradient-brand)' : 'transparent',
              color: activeTab === tab ? 'white' : 'var(--color-text-secondary)',
            }}
          >
            {tab === 'detailing' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Brain size={14} />
                <span>Detailing</span>
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Zap size={14} />
                <span>Instant</span>
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Step Progress */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: 32,
          overflow: 'auto',
          padding: '4px 0',
        }}
      >
        {STEPS.map((s, i) => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
            <button
              onClick={() => step > s.id && setStep(s.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                cursor: step > s.id ? 'pointer' : 'default',
                background: 'none',
                border: 'none',
              }}
            >
              <div
                className={`step-dot ${
                  step > s.id ? 'complete' : step === s.id ? 'active' : 'pending'
                }`}
              >
                {step > s.id ? '✓' : s.id}
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color:
                    step === s.id
                      ? 'var(--color-brand-200)'
                      : step > s.id
                      ? '#4ade80'
                      : 'var(--color-text-muted)',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  margin: '0 8px',
                  marginBottom: 18,
                  background:
                    step > s.id ? 'var(--color-brand-500)' : 'var(--color-dark-700)',
                  transition: 'background 0.3s',
                  borderRadius: 99,
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* ========================
          STEP 1: Character
      ======================== */}
      {step === 1 && (
        <div className="card fade-in" style={{ padding: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <User size={20} style={{ color: 'var(--color-brand-400)' }} />
            <span>Step 1: Upload Foto Karakter</span>
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginBottom: 24 }}>
            Foto referensi karakter yang akan muncul di storyboard. Gemini AI akan otomatis buat anchor phrase.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* Upload */}
            <div>
              <div className="dropzone" style={{ marginBottom: 16 }}>
                <UploadButton<OurFileRouter, 'characterImage'>
                  endpoint="characterImage"
                  onClientUploadComplete={(files) => {
                    const urls = files.map((f) => f.ufsUrl)
                    setCharacterImages(urls)
                    if (urls[0]) analyzeCharacter(urls[0])
                  }}
                  appearance={{
                    button: {
                      background: 'var(--gradient-brand)',
                      borderRadius: '8px',
                      padding: '10px 20px',
                      fontSize: '14px',
                      fontWeight: '600',
                    },
                    container: { flexDirection: 'column', gap: '8px' },
                    allowedContent: { color: 'var(--color-text-muted)', fontSize: '12px' },
                  }}
                />
              </div>
              {characterImages.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {characterImages.map((url) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={url}
                      src={url}
                      alt="character"
                      style={{
                        width: 64,
                        height: 64,
                        objectFit: 'cover',
                        borderRadius: 8,
                        border: '1px solid var(--border-brand)',
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Anchor phrase */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 8 }}>
                Anchor Phrase (AI-generated, terkunci setelah disimpan)
              </label>
              <textarea
                value={characterAnalyzing ? 'Gemini sedang analisis foto...' : anchorPhrase}
                onChange={(e) => !anchorLocked && setAnchorPhrase(e.target.value)}
                readOnly={anchorLocked || characterAnalyzing}
                className="input"
                rows={5}
                placeholder="Gemini akan auto-generate setelah upload foto..."
                style={{
                  resize: 'vertical',
                  opacity: characterAnalyzing ? 0.6 : 1,
                  fontFamily: 'monospace',
                  fontSize: 12,
                }}
              />
              {anchorPhrase && !anchorLocked && (
                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertCircle size={12} style={{ color: 'var(--color-warning)' }} />
                  <span>Anchor phrase akan terkunci setelah kamu klik &quot;Simpan Karakter&quot;</span>
                </p>
              )}
              {anchorLocked && (
                <p style={{ fontSize: 11, color: '#4ade80', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Lock size={12} />
                  <span>Anchor phrase terkunci untuk konsistensi karakter</span>
                </p>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24, gap: 12 }}>
            <button
              onClick={() => { setAnchorLocked(true); setStep(2) }}
              disabled={!anchorPhrase || characterAnalyzing}
              className="btn btn-primary"
            >
              Simpan & Lanjut → Step 2
            </button>
          </div>
        </div>
      )}

      {/* ========================
          STEP 2: Product
      ======================== */}
      {step === 2 && (
        <div className="card fade-in" style={{ padding: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Package size={20} style={{ color: 'var(--color-brand-400)' }} />
            <span>Step 2: Upload Produk</span>
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginBottom: 24 }}>
            Foto & brief produk. AI akan otomatis deteksi niche setelah kamu klik Analisis.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* Upload */}
            <div>
              <div className="dropzone" style={{ marginBottom: 16 }}>
                <UploadButton<OurFileRouter, 'productImage'>
                  endpoint="productImage"
                  onClientUploadComplete={(files) => {
                    setProductImages(files.map((f) => f.ufsUrl))
                  }}
                  appearance={{
                    button: {
                      background: 'linear-gradient(135deg, #ff6b35, #e91e8c)',
                      borderRadius: '8px',
                      padding: '10px 20px',
                      fontSize: '14px',
                      fontWeight: '600',
                    },
                    container: { flexDirection: 'column', gap: '8px' },
                    allowedContent: { color: 'var(--color-text-muted)', fontSize: '12px' },
                  }}
                />
              </div>
              {productImages.length > 0 && (
                <div style={{ display: 'flex', gap: 8 }}>
                  {productImages.map((url) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={url}
                      src={url}
                      alt="product"
                      style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border-brand)' }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Product Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>
                  Nama Produk *
                </label>
                <input
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g. Helm Full Face Premium SNI"
                  className="input"
                />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>
                  Deskripsi Singkat
                </label>
                <input
                  value={productDesc}
                  onChange={(e) => setProductDesc(e.target.value)}
                  placeholder="e.g. Helm motor full face bersertifikasi SNI..."
                  className="input"
                />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>
                  Keunggulan Produk (satu per baris)
                </label>
                <textarea
                  value={productBenefits}
                  onChange={(e) => setProductBenefits(e.target.value)}
                  placeholder={'Sertifikasi SNI\nBusa D30 anti-benturan\nVisor anti-UV\nHarga terjangkau'}
                  className="input"
                  rows={4}
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>
          </div>

          {nicheError && (
            <div
              style={{
                marginTop: 16,
                padding: '12px 16px',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 'var(--radius-md)',
                color: '#f87171',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <AlertCircle size={14} />
              <span>{nicheError}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
            <button onClick={() => setStep(1)} className="btn btn-ghost">
              ← Kembali
            </button>
            <button
              onClick={detectNiche}
              disabled={!productName || nicheLoading}
              className="btn btn-primary"
            >
              {nicheLoading ? (
                <>
                  <span style={{
                    width: 14,
                    height: 14,
                    border: '2px solid white',
                    borderTop: '2px solid transparent',
                    borderRadius: '50%',
                    display: 'inline-block',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                  Analisis AI...
                </>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Brain size={14} />
                  <span>Analisis Niche → Step 3</span>
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ========================
          STEP 3: Niche Intelligence
      ======================== */}
      {step === 3 && nicheData && (
        <div className="fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Brain size={20} style={{ color: 'var(--color-brand-400)' }} />
              <span>Niche Intelligence Report</span>
            </h2>
            <button onClick={() => setStep(2)} className="btn btn-ghost btn-sm">← Edit Produk</button>
          </div>

          <div className="card" style={{ padding: 20, marginBottom: 24, display: 'flex', gap: 20, background: 'var(--color-surface-2)' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 8, textTransform: 'uppercase' }}>
                Gaya Kamera (Visual Style)
              </label>
              <select className="input" value={cameraStyle} onChange={e => setCameraStyle(e.target.value)} style={{ width: '100%', fontSize: 13, background: 'var(--color-surface-1)' }}>
                <option value="Handheld, candid, sedikit goyangan kamera, framing tidak sempurna">UGC Handheld (Paling Realistis)</option>
                <option value="Static tripod, framing rapi, stabil">Professional Static</option>
                <option value="Gerakan dinamis mengikuti subjek">Dynamic Tracking</option>
                <option value="Point of View (POV) dari sudut pandang pengguna">POV Style</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 8, textTransform: 'uppercase' }}>
                Pencahayaan (Lighting)
              </label>
              <select className="input" value={lighting} onChange={e => setLighting(e.target.value)} style={{ width: '100%', fontSize: 13, background: 'var(--color-surface-1)' }}>
                <option value="Cahaya ruangan natural, sedikit tidak sempurna">Natural Room Light</option>
                <option value="Cahaya jendela pagi yang lembut">Soft Morning Window Light</option>
                <option value="Lampu studio yang lembut dan hangat">Warm Studio Light</option>
                <option value="Pencahayaan dramatis, kontras tinggi">Cinematic Contrast</option>
              </select>
            </div>
          </div>

          <NicheIntelligence
            data={nicheData}
            onAngleSelect={(angle, persona, niche) => generateStoryboard(angle, persona, niche)}
            onMatrixRowSelect={(row) => generateStoryboard(row.angle, '', row.niche)}
          />
        </div>
      )}

      {/* ========================
          STEP 4: Storyboard
      ======================== */}
      {step === 4 && (
        <div className="fade-in">
          {generating ? (
            <div className="card" style={{ padding: 48 }}>
              <StreamingProgress
                progress={streamProgress}
                message={streamMessage || 'Memulai generate storyboard...'}
              />
              {storyboardScenes.length > 0 && (
                <div style={{ marginTop: 32 }}>
                  <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 16, textAlign: 'center' }}>
                    Scene yang sudah selesai:
                  </p>
                  <StoryboardViewer scenes={storyboardScenes} anchorPhrase={anchorPhrase} />
                </div>
              )}
            </div>
          ) : storyboardScenes.length > 0 ? (
            <StoryboardViewer scenes={storyboardScenes} storyboardId={storyboardId} anchorPhrase={anchorPhrase} />
          ) : null}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Global Toast Notification */}
      <Toast
        message={toastMessage}
        type={toastType}
        onClose={() => setToastMessage('')}
      />
    </div>
  )
}
