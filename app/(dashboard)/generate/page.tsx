import { createClient } from '@/lib/supabase/server'
import prisma from '@/lib/prisma'
import { redirect } from 'next/navigation'
import GenerateClient from './GenerateClient'
import CheckoutButton from '@/components/payment/CheckoutButton'

export default async function GeneratePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // DEV BYPASS: Matikan login
  const DEV_BYPASS_LOGIN = true

  if (!user && !DEV_BYPASS_LOGIN) {
    redirect('/login')
  }

  let profile = null
  if (user) {
    profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { is_subscribed: true }
    })
  }

  // DEV BYPASS: Matikan paywall selama development
  const DEV_BYPASS_PAYWALL = true

  if (!profile?.is_subscribed && !DEV_BYPASS_PAYWALL) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', padding: 16 }} className="fade-in">
        <div style={{ maxWidth: 480, margin: '0 auto', background: 'var(--color-surface-1)', padding: 40, borderRadius: 24, border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>Akses Terkunci</h1>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
            Untuk mulai men-generate Storyboard dan Google Flow Production Package, kamu perlu membeli akses ke Viral Studio.
          </p>
          
          <div style={{ background: 'var(--color-surface-2)', padding: 20, borderRadius: 12, marginBottom: 24, textAlign: 'left' }}>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>Yang kamu dapatkan:</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <li style={{ display: 'flex', gap: 8, fontSize: 14 }}>
                <span style={{ color: 'var(--color-brand-400)' }}>✓</span> 10x Generate Package per Hari
              </li>
              <li style={{ display: 'flex', gap: 8, fontSize: 14 }}>
                <span style={{ color: 'var(--color-brand-400)' }}>✓</span> AI Niche Intelligence Engine
              </li>
              <li style={{ display: 'flex', gap: 8, fontSize: 14 }}>
                <span style={{ color: 'var(--color-brand-400)' }}>✓</span> Google Flow Prompts Generator
              </li>
              <li style={{ display: 'flex', gap: 8, fontSize: 14 }}>
                <span style={{ color: 'var(--color-brand-400)' }}>✓</span> Smart Content Matrix
              </li>
            </ul>
          </div>

          <CheckoutButton />
        </div>
      </div>
    )
  }

  // If subscribed, render the main generator tool
  return <GenerateClient />
}
