---
name: flow-ugc-ads-prompting
description: Referensi cara menulis prompt yang menghasilkan output bergaya UGC di Google Flow. Berisi modifier gaya wajib, sintaks tag aset, pacing dialogue, pola dialogue UGC, struktur briefing Agent mode, dan kategori shot yang rawan halusinasi.
---

# Referensi Prompting Flow

Cara menulis prompt yang menghasilkan output bergaya UGC di Google Flow, bukan output bergaya iklan komersial.

---

## Masalah Utama

Tanpa modifier gaya yang spesifik, Gemini Omni Flash secara default menghasilkan output yang terlihat komersial: pencahayaan sempurna, framing terpusat, kulit mulus, komposisi berkualitas studio. Itu kebalikan dari yang mengkonversi di Meta dan TikTok. UGC mengkonversi karena terlihat nyata. Prompt kamu harus sengaja menghadirkan ketidaksempurnaan.

---

## Modifier Gaya Wajib (Setiap Shot)

Tambahkan semua ini ke setiap prompt:

| Modifier | Fungsinya |
|----------|-----------|
| `nuansa handheld, sedikit goyangan kamera` | Menghilangkan tampilan tripod yang terkunci |
| `candid` | Salah satu sinyal realisme terkuat — memberitahu model bahwa ini bukan set yang disiapkan |
| `tekstur kulit natural` | Mencegah ciri khas AI "kulit plastik" |
| `framing tidak sempurna` | Gemini memusatkan segalanya tanpa ini — UGC nyata tidak pernah terkomposisi sempurna |
| `[pencahayaan sesuai lingkungan]` | Menggantikan inferensi cahaya studio default |

**Pilihan pencahayaan per lingkungan:**
- Dapur: `cahaya jendela pagi yang lembut` / `cahaya overhead dapur yang hangat`
- Mobil: `cahaya hari mendung lembut melalui kaca depan` / `cahaya samping sore yang hangat`
- Kamar mandi: `cahaya vanity natural` / `overhead kamar mandi yang hangat`
- Gym: `lampu fluoresen overhead, sedikit keras` / `cahaya natural dari jendela`
- Luar ruangan: `cahaya natural mendung` / `sinar matahari sore langsung, sedikit menyipit`
- Kamar tidur: `cahaya pagi lembut melalui tirai` / `lampu samping tempat tidur, hangat`

---

## Sintaks Tag Aset

Referensikan aset yang diunggah menggunakan nama file persis di dalam prompt. Flow mengidentifikasi aset dan menggunakannya sebagai referensi visual.

**Format:** langsung nama file di dalam kalimat — tanpa tanda kurung, tanpa sintaks khusus.

```
creator.png berdiri di dapur cerah memegang goli-bottle.jpg...
```

**Aturan:**
- Nama file harus persis sama dengan yang kamu unggah (case-sensitive)
- Tag kreator DAN produk di setiap shot, bahkan jika produk bukan fokus utama
- Untuk shot hanya lingkungan (produk tidak dalam frame), tetap tag kreator

**Apa yang merusaknya:**
- Lupa tag gambar kreator = tampilan karakter berubah antar shot
- Lupa tag produk = model menghalusikan produk generik
- Menggunakan nama file yang tidak jelas seperti `image1.jpg` — gunakan nama yang deskriptif

---

## Pacing Dialogue

Perkirakan sekitar 3 kata per detik waktu tayang.

| Durasi shot | Maksimal dialogue |
|-------------|-------------------|
| 6 detik | ~18 kata |
| 7 detik | ~21 kata |
| 8 detik | ~24 kata |
| 9 detik | ~27 kata |

Dialogue yang terlalu banyak terkesan terburu-buru dan terdengar seperti skrip. Terlalu sedikit menyisakan keheningan. Tetap dalam batas anggaran.

---

## Pola Dialogue UGC

Tulis dialogue seperti orang nyata berkirim pesan — bukan seperti brand menulis copy.

**Hijau (boleh digunakan):**
- "Oke aku harus cerita tentang ini."
- "Bro, ini akhirnya dateng."
- "Aku udah nunggu-nunggu buat posting ini."
- "Ini jadi favorit baruku."
- "Dengerin dulu."
- "Awalnya aku skeptis tapi..."
- "Minggu kedua dan aku udah mulai ngerasain bedanya."

**Merah (hindari):**
- "Memperkenalkan produk inovatif terbaru kami..."
- "Rasakan perbedaannya dengan..."
- "Terbukti secara klinis..."
- "Beli sekarang dan hemat..."
- Apapun yang terdengar seperti ditulis oleh brand

**Pola CTA yang berhasil:**
- "Linknya ada di bawah."
- "Kamu literally nggak rugi apa-apa."
- "Coba aja dulu 30 hari."
- "Nanti aku link-in."
- "Percaya aku soal ini."

**Pola CTA yang merusak nuansa UGC:**
- "Beli sekarang"
- "Order hari ini"
- "Pakai kode [X] untuk diskon [Y]%" (simpan ini untuk caption, bukan dialogue)
- "Kunjungi website kami"

---

## Struktur Briefing Agent Mode

Saat menggunakan Agent mode, susun instruksimu seperti brief sutradara — bukan prompt shot tunggal.

**Template:**

```
Aku sedang membuat iklan UGC vertikal [N] shot untuk [produk].

Aset yang sudah diunggah:
- creator.png — kreator UGC
- [produk].jpg — produk

Generate shot-shot ini secara berurutan:

Shot 1: [satu kalimat: lingkungan + aksi + dialogue]. [pencahayaan], handheld, candid, framing tidak sempurna. 9:16, 8 detik.

Shot 2: [struktur yang sama]. [pencahayaan], handheld, candid. 9:16, 8 detik.

[lanjutkan untuk setiap shot]

Jaga konsistensi penampilan creator.png di semua shot.
```

**Apa yang membuat Agent mode lebih baik dari prompt biasa:**
- Menyimpan konteks produksi penuh di semua shot
- Mempertahankan referensi aset tanpa harus men-tag ulang setiap kali
- Bisa mengulang shot tanpa harus membriefing ulang dari awal
- Menangani loop produksi — jika sebuah shot terlihat salah, kamu bisa bilang "ulangi Shot 3 dengan pencahayaan lebih hangat" dan ia tahu shot mana dan aset mana

---

## Kategori Sulit — Apa yang Harus Dihindari dan Cara Mengatasinya

Beberapa tipe shot secara konsisten menghasilkan halusinasi di Gemini Omni Flash:

**Makan / minum:**
Masalah: makanan menghilang, warna muncul di permukaan yang salah, gerakan konsumsi terlihat aneh.
Solusi: "memegang [produk] ke arah kamera, tersenyum, tidak makan atau minum." Akhiri dengan pose memegang, bukan konsumsi.

**Aplikasi makeup:**
Masalah: warna berpindah ke bagian tubuh yang salah, bekas makeup yang sudah ada muncul, smudging.
Solusi: "memegang [produk] ke arah kamera, tidak mengaplikasikan. Tampilan jadi — [deskripsikan hasilnya]." Tunjukkan hasilnya tanpa menunjukkan proses aplikasinya.

**Interaksi tangan-objek yang kompleks:**
Masalah: jari ekstra, objek berubah bentuk, produk berubah bentuk di tengah shot.
Solusi: jaga interaksi tetap sederhana — ambil, pegang, putar, letakkan. Satu aksi per shot.

**Teks kecil / tulisan halus pada kemasan:**
Masalah: teks berantakan, terutama dari jarak lengan atau resolusi 480p.
Solusi: jaga produk tetap besar dalam frame (mengisi 30–40% shot), gunakan minimal 720p untuk shot yang menampilkan produk, gunakan Agent mode (bukan generate standar) untuk shot apapun di mana keterbacaan label penting.

---

## Template Prompt Per Shot (Lengkap)

```
Video UGC vertikal, [creator.png] [lingkungan — ruangan/setting spesifik], 
[detail outfit], [aksi — satu aksi saja]. 
[product.jpg jika dalam frame — bagaimana mereka memegang/berinteraksi + perkuat warna/deskriptor]. 
Berbicara langsung ke lensa: "[dialogue — dalam batas kata]." 
Nuansa handheld, sedikit goyangan kamera, candid, tekstur kulit natural, 
[pencahayaan sesuai lingkungan], framing tidak sempurna. 
Vertikal 9:16, [X] detik.
```

Isi setiap kurung. Prompt yang samar = output AI yang generik. Prompt yang spesifik = output UGC.
