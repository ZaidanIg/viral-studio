import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Viral Studio — AI Storyboard & Niche Intelligence untuk Affiliate Indonesia',
  description:
    'Platform AI untuk affiliate marketer Indonesia. Temukan niche, angle viral, dan generate storyboard TikTok 5 scene lengkap dengan gambar — semua dalam satu workflow.',
  keywords: ['viral studio', 'ai storyboard', 'tiktok affiliate', 'niche intelligence', 'konten viral'],
  authors: [{ name: 'Viral Studio' }],
  openGraph: {
    title: 'Viral Studio — AI Storyboard & Niche Intelligence',
    description: 'AI yang tahu konten apa yang harus kamu buat sebelum kamu mulai membuat konten.',
    type: 'website',
  },
}

import Script from 'next/script'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id" data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        {children}
        <Script 
          src="https://app.sandbox.midtrans.com/snap/snap.js" 
          data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY} 
          strategy="beforeInteractive" 
        />
      </body>
    </html>
  )
}
