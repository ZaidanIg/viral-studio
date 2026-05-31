'use client'

import { useState } from 'react'
import type { NicheDetectionResult } from '@/types/database'

// =====================================================
// Sub-components
// =====================================================

function SubNichePills({
  subNiches,
  selected,
  onToggle,
}: {
  subNiches: Array<{ name: string; description: string }>
  selected: string[]
  onToggle: (name: string) => void
}) {
  return (
    <div>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
        Sub-Niche (pilih 1-2)
      </h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {subNiches.map((n) => (
          <button
            key={n.name}
            onClick={() => onToggle(n.name)}
            className={`pill ${selected.includes(n.name) ? 'active' : ''}`}
            title={n.description}
          >
            {n.name}
          </button>
        ))}
      </div>
    </div>
  )
}

function OpportunityTable({
  scores,
}: {
  scores: Array<{ niche: string; score: number; reason: string; difficulty: string }>
}) {
  return (
    <div>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
        Content Opportunity Score
      </h3>
      <div
        className="card"
        style={{ overflow: 'hidden', padding: 0 }}
      >
        <table className="data-table">
          <thead>
            <tr>
              <th>Niche</th>
              <th>Score</th>
              <th>Alasan Utama</th>
              <th>Tingkat</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((s) => (
              <tr key={s.niche}>
                <td style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  {s.niche}
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        width: 60,
                        height: 6,
                        background: 'var(--color-dark-700)',
                        borderRadius: 99,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        className="score-bar"
                        style={{ width: `${s.score}%` }}
                      />
                    </div>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: s.score >= 90 ? '#4ade80' : s.score >= 75 ? '#fbbf24' : 'var(--color-text-secondary)',
                      }}
                    >
                      {s.score}
                    </span>
                  </div>
                </td>
                <td style={{ maxWidth: 200, fontSize: 13 }}>{s.reason}</td>
                <td>
                  <span
                    className="badge"
                    style={{
                      background:
                        s.difficulty === 'Mudah'
                          ? 'rgba(34,197,94,0.1)'
                          : s.difficulty === 'Sulit'
                          ? 'rgba(239,68,68,0.1)'
                          : 'rgba(245,158,11,0.1)',
                      color:
                        s.difficulty === 'Mudah'
                          ? '#4ade80'
                          : s.difficulty === 'Sulit'
                          ? '#f87171'
                          : '#fbbf24',
                      border: 'none',
                    }}
                  >
                    {s.difficulty}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8 }}>
        ⚠️ Score adalah estimasi berdasarkan pattern konten, bukan data analytics real-time.
      </p>
    </div>
  )
}

function AngleCards({
  angles,
  selected,
  onSelect,
}: {
  angles: NicheDetectionResult['content_angles']
  selected: string | null
  onSelect: (name: string) => void
}) {
  const ctrColor = (ctr: string) => {
    if (ctr === 'Sangat Tinggi') return '#f43f5e'
    if (ctr === 'Tinggi') return '#f97316'
    if (ctr === 'Medium-Tinggi') return '#eab308'
    return 'var(--color-text-secondary)'
  }

  return (
    <div>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
        Viral Angle Recommendation (pilih 1)
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {angles.map((angle) => (
          <button
            key={angle.name}
            onClick={() => onSelect(angle.name)}
            className={`card angle-card ${selected === angle.name ? 'selected' : ''}`}
            style={{
              padding: 18,
              textAlign: 'left',
              border: selected === angle.name ? '1px solid var(--color-brand-400)' : undefined,
              background: selected === angle.name ? 'rgba(168,45,227,0.1)' : undefined,
              width: '100%',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                {angle.name}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: ctrColor(angle.estimated_ctr),
                }}
              >
                {angle.estimated_ctr}
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 10, lineHeight: 1.5 }}>
              {angle.why_effective}
            </p>
            <div
              style={{
                padding: '8px 10px',
                background: 'var(--color-dark-800)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12,
                color: 'var(--color-text-secondary)',
                fontStyle: 'italic',
                lineHeight: 1.5,
              }}
            >
              &ldquo;{angle.hook_example}&rdquo;
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function PersonaCards({
  personas,
  selected,
  onSelect,
}: {
  personas: NicheDetectionResult['creator_personas']
  selected: string | null
  onSelect: (name: string) => void
}) {
  return (
    <div>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
        Creator Persona (pilih 1)
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {personas.map((p) => (
          <button
            key={p.name}
            onClick={() => onSelect(p.name)}
            className="card"
            style={{
              padding: '14px 18px',
              display: 'flex',
              gap: 14,
              alignItems: 'flex-start',
              textAlign: 'left',
              cursor: 'pointer',
              border: selected === p.name ? '1px solid var(--color-brand-400)' : undefined,
              background: selected === p.name ? 'rgba(168,45,227,0.08)' : undefined,
              width: '100%',
              transition: 'all 0.2s',
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: selected === p.name ? 'var(--gradient-brand)' : 'var(--color-surface-3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                flexShrink: 0,
                transition: 'all 0.2s',
              }}
            >
              🎭
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 3 }}>
                {p.name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                {p.description}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                Gaya: {p.content_style}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function ContentMatrix({
  matrix,
  onSelectRow,
}: {
  matrix: NicheDetectionResult['content_matrix']
  onSelectRow: (row: { niche: string; angle: string; hook: string }) => void
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
          Smart Content Matrix ({matrix.length} kombinasi)
        </h3>
        <span className="badge badge-brand">{matrix.length} ide</span>
      </div>
      <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Niche</th>
              <th>Angle</th>
              <th>Hook Siap Pakai</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={i} style={{ cursor: 'pointer' }}>
                <td style={{ fontWeight: 600, fontSize: 13 }}>{row.niche}</td>
                <td>
                  <span className="badge badge-viral" style={{ fontSize: 11 }}>
                    {row.angle}
                  </span>
                </td>
                <td style={{ maxWidth: 280, fontSize: 13, fontStyle: 'italic' }}>
                  &ldquo;{row.hook_ready_to_use}&rdquo;
                </td>
                <td>
                  <button
                    onClick={() => onSelectRow({ niche: row.niche, angle: row.angle, hook: row.hook_ready_to_use })}
                    className="btn btn-secondary btn-sm"
                  >
                    → Generate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PlatformScores({
  scores,
}: {
  scores: NicheDetectionResult['platform_scores']
}) {
  const platforms = [
    { key: 'tiktok', label: 'TikTok', icon: '🎵' },
    { key: 'reels', label: 'Instagram Reels', icon: '📷' },
    { key: 'shorts', label: 'YouTube Shorts', icon: '▶️' },
    { key: 'facebook', label: 'Facebook Reels', icon: '👥' },
  ] as const

  function toStars(score: number) {
    const stars = Math.round((score / 100) * 5)
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={`star ${i < stars ? 'filled' : ''}`}>
        ★
      </span>
    ))
  }

  return (
    <div>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
        Platform Score
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {platforms.map((p) => (
          <div
            key={p.key}
            className="card"
            style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}
          >
            <span style={{ fontSize: 20 }}>{p.icon}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{p.label}</div>
              <div style={{ display: 'flex', gap: 2, fontSize: 14 }}>
                {toStars(scores[p.key])}
              </div>
            </div>
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 13,
                fontWeight: 700,
                color: scores[p.key] >= 85 ? '#4ade80' : 'var(--color-text-secondary)',
              }}
            >
              {scores[p.key]}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// =====================================================
// Main Export
// =====================================================

interface NicheIntelligenceProps {
  data: NicheDetectionResult
  onAngleSelect?: (angle: string, persona: string, niche: string) => void
  onMatrixRowSelect?: (row: { niche: string; angle: string; hook: string }) => void
}

export default function NicheIntelligence({
  data,
  onAngleSelect,
  onMatrixRowSelect,
}: NicheIntelligenceProps) {
  const [selectedSubNiches, setSelectedSubNiches] = useState<string[]>([])
  const [selectedAngle, setSelectedAngle] = useState<string | null>(null)
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null)

  function toggleSubNiche(name: string) {
    setSelectedSubNiches((prev) =>
      prev.includes(name)
        ? prev.filter((n) => n !== name)
        : prev.length < 2
        ? [...prev, name]
        : [prev[1], name]
    )
  }

  function handleAngleSelect(name: string) {
    setSelectedAngle(name)
    if (selectedPersona && onAngleSelect) {
      onAngleSelect(name, selectedPersona, data.primary_niche)
    }
  }

  function handlePersonaSelect(name: string) {
    setSelectedPersona(name)
    if (selectedAngle && onAngleSelect) {
      onAngleSelect(selectedAngle, name, data.primary_niche)
    }
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Primary Niche Display */}
      <div
        style={{
          padding: '20px 24px',
          background: 'linear-gradient(135deg, rgba(168,45,227,0.1) 0%, rgba(99,102,241,0.05) 100%)',
          border: '1px solid var(--border-brand)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Primary Niche
            </div>
            <div style={{ fontSize: 22, fontWeight: 800 }} className="gradient-text-brand">
              {data.primary_niche}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Secondary Niche
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {data.secondary_niche}
            </div>
          </div>
        </div>
      </div>

      <SubNichePills
        subNiches={data.sub_niches}
        selected={selectedSubNiches}
        onToggle={toggleSubNiche}
      />

      <OpportunityTable scores={data.opportunity_scores} />

      <AngleCards
        angles={data.content_angles}
        selected={selectedAngle}
        onSelect={handleAngleSelect}
      />

      <PersonaCards
        personas={data.creator_personas}
        selected={selectedPersona}
        onSelect={handlePersonaSelect}
      />

      <PlatformScores scores={data.platform_scores} />

      <ContentMatrix
        matrix={data.content_matrix}
        onSelectRow={onMatrixRowSelect ?? (() => {})}
      />

      {/* Proceed button */}
      {selectedAngle && selectedPersona && onAngleSelect && (
        <div
          style={{
            padding: '20px 24px',
            background: 'rgba(34,197,94,0.08)',
            border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#4ade80', marginBottom: 4 }}>
              ✅ Angle & Persona dipilih!
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
              {selectedAngle} · {selectedPersona}
            </div>
          </div>
          <button
            onClick={() => onAngleSelect(selectedAngle, selectedPersona, data.primary_niche)}
            className="btn btn-primary"
          >
            Generate Storyboard →
          </button>
        </div>
      )}
    </div>
  )
}
