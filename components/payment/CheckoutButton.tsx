'use client'

import { useState } from 'react'

// Deklarasi properti snap di window object
declare global {
  interface Window {
    snap: any
  }
}

export default function CheckoutButton() {
  const [loading, setLoading] = useState(false)

  async function handleCheckout() {
    setLoading(true)
    try {
      const res = await fetch('/api/payment/token', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Failed to get token')

      window.snap.pay(data.token, {
        onSuccess: function (result: any) {
          // Akan dihandle oleh webhook di backend, refresh halaman saja
          window.location.reload()
        },
        onPending: function (result: any) {
          console.log('pending', result)
        },
        onError: function (result: any) {
          console.error('error', result)
          alert('Pembayaran gagal')
        },
        onClose: function () {
          console.log('customer closed the popup without finishing the payment')
        }
      })
    } catch (error) {
      console.error(error)
      alert('Terjadi kesalahan saat checkout.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleCheckout}
      disabled={loading}
      className="btn btn-primary"
      style={{ width: '100%', fontSize: 16, padding: 16 }}
    >
      {loading ? 'Memproses...' : 'Beli Akses (Rp 150.000)'}
    </button>
  )
}
