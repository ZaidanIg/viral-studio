# Arsitektur Viral Studio (Zeo Studio Parity)

## Visi & Fokus
Proyek ini bertransisi penuh menjadi **Aplikasi Desktop Electron (Native macOS)** dengan antarmuka UI berbasis Next.js App Router. Pendekatan ekstensi Chrome telah dibuang.
Fokus produk adalah paritas fitur dengan Zeo Studio pada 3 pilar:
1. **Character**: Pembuatan karakter yang konsisten (Wajah, Baju, Pose).
2. **Product**: Penempatan produk pada scene yang realistis (Product Photography).
3. **Marketing**: Pembuatan storyboard/kampanye secara batch dan niche intelligence.

## Struktur Direktori Standar

### 1. Root / Frontend (Next.js)
UI dibangun di atas Next.js. **Dilarang** memindahkan folder `app/`, `components/`, atau `lib/` ke dalam folder lain (seperti `src/`) agar tidak merusak konfigurasi Tailwind/TypeScript yang sudah stabil.

### 2. Backend / Desktop (Electron)
Semua kode yang berhubungan dengan komunikasi desktop, interaksi OS, dan otomatisasi (DOM scraping ke Google Labs) wajib diletakkan secara modular di dalam direktori `electron/`:

```text
/electron
  ├── main.js                  # Entry point Electron. Hanya untuk inisialisasi App dan WindowManager.
  ├── preload.js               # Context Bridge (window.electron) untuk API yang aman.
  ├── /core
  │   └── WindowManager.js     # Pengelola siklus hidup jendela utama (Next.js) dan tersembunyi (Google Labs).
  ├── /ipc
  │   ├── index.js             # Pendaftar (registrar) semua IPC handler.
  │   ├── characterIpc.js      # Handler untuk fitur Character.
  │   ├── productIpc.js        # Handler untuk fitur Product.
  │   └── marketingIpc.js      # Handler untuk fitur Marketing.
  └── /services
      ├── authService.js       # Logika pengambilan token, cookies, dan intercept session Google.
      ├── labsClient.js        # Fungsi utilitas internal fetch ke API Google Labs.
      ├── characterService.js  # Layanan otomatisasi untuk memproses karakter.
      ├── productService.js    # Layanan otomatisasi untuk memproses produk.
      └── marketingService.js  # Layanan otomatisasi untuk memproses storyboard (batch generation).
```

## Aturan (Rules) Modul Electron
1. **Pemisahan Concerns**: `main.js` tidak boleh berisi logika bisnis (seperti fungsi fetch API atau DOM scraping). Semua logika bisnis harus berada di `/services`.
2. **Komunikasi UI ke Desktop**: Komponen React (Next.js) harus menggunakan pemanggilan IPC (melalui `window.electron.namaFitur`) alih-alih API internal Next.js (seperti `/api/storyboard`), untuk hal-hal yang berhubungan dengan pengolahan resource eksternal atau file system.
3. **Automasi Google Labs**:
   - Sistem tidak menggunakan Selenium/Puppeteer.
   - Sistem memanfaatkan `BrowserWindow` tersembunyi (`WindowManager.js`).
   - `authService.js` bertanggung jawab untuk menyuntikkan script *interceptor* ke dalam jendela tersembunyi tersebut demi mendapatkan `Bearer` token dan kunci lainnya dari sesi *user* asli.
   - Setelah token didapat, layanan-layanan (seperti `characterService.js`) akan menjalankan perintah `fetch` dari dalam konteks jendela tersembunyi (`webContents.executeJavaScript`).

---
*Dokumen ini merupakan sumber kebenaran (Source of Truth) untuk arsitektur proyek. Agen/AI apa pun yang memodifikasi proyek ini wajib mematuhi panduan modular ini.*
