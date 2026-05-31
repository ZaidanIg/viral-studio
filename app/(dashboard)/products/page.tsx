import prisma from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Package } from 'lucide-react'

export default async function ProductsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const products = await prisma.product.findMany({
    where: { user_id: user.id },
    orderBy: { created_at: 'desc' }
  })

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Package size={26} style={{ color: 'var(--color-brand-400)' }} />
            <span>Library Produk</span>
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>
            {products?.length ?? 0} produk tersimpan
          </p>
        </div>
      </div>

      {!products || products.length === 0 ? (
        <div
          className="card"
          style={{ padding: 64, textAlign: 'center', border: '2px dashed var(--border-subtle)', background: 'transparent' }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <Package size={56} style={{ color: 'var(--color-brand-400)' }} />
          </div>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 20, fontSize: 16 }}>
            Belum ada produk yang disimpan.
          </p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
            Upload produk kamu di halaman Generate untuk mulai membuat konten.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
          {(products as Array<{
            id: string
            image_urls: string[] | null
            product_name: string | null
            category: string | null
            benefits: string[] | null
            created_at: Date | null
          }>).map((prod) => {
            const imageUrls = prod.image_urls ?? []
            return (
              <div key={prod.id} className="card" style={{ overflow: 'hidden' }}>
                <div style={{ display: 'flex', height: 160, background: 'var(--color-surface-3)' }}>
                  {imageUrls.length > 0 ? (
                    <div style={{ width: '100%', position: 'relative' }}>
                      <Image src={imageUrls[0]} alt={prod.product_name ?? 'Produk'} fill style={{ objectFit: 'cover' }} />
                    </div>
                  ) : (
                    <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Package size={32} style={{ color: 'var(--color-text-muted)' }} />
                    </div>
                  )}
                </div>

                <div style={{ padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      {prod.product_name ?? 'Produk Tanpa Nama'}
                    </h3>
                    {prod.category && (
                      <span className="badge badge-brand" style={{ fontSize: 10 }}>{prod.category}</span>
                    )}
                  </div>
                  
                  {prod.benefits && (
                    <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {prod.benefits.join(', ')}
                    </p>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                      {prod.created_at ? new Date(prod.created_at).toLocaleDateString('id-ID') : 'Baru saja'}
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
