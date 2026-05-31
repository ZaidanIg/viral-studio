---
name: flow-ugc-ads
description: Hasilkan paket produksi iklan video UGC multi-shot untuk Google Flow. Cukup berikan gambar produk dan angle iklan, skill ini menghasilkan semua yang dibutuhkan untuk menjalankan sesi produksi penuh di Agent mode Flow — prompt gambar kreator realistis, prompt shot yang sudah di-tag aset, skrip dialogue lengkap, satu instruksi briefing Agent, dan skrip voiceover ElevenLabs. Gunakan kapanpun user ingin membuat iklan UGC di Google Flow, generate iklan video gaya kreator, atau mengubah foto produk menjadi iklan vertikal multi-shot tanpa menggunakan API. Juga aktifkan pada frasa seperti "Flow UGC ad," "iklan Google Flow," "Flow production package," atau ketika user mengunggah gambar produk dan menyebut Flow atau Gemini Omni.
---

# Google Flow UGC Ad Generator

Menghasilkan paket produksi lengkap untuk iklan video UGC multi-shot di Google Flow. Satu gambar produk ditambah satu angle iklan menghasilkan semua yang dibutuhkan user untuk menjalankan sesi penuh di Agent mode Flow — prompt kreator, shot list, prompt bertag, instruksi Agent, dan skrip voiceover.

## Apa yang dilakukan skill ini

1. Mengambil path gambar produk dan angle iklan dari user
2. Opsional membaca `brand/brand-dna.md`, `brand/brand-voice.md`, `brand/icp-cards.md` jika ada — dilewati diam-diam jika tidak ada
3. Menghasilkan prompt gambar kreator AI realistis yang dioptimalkan untuk ChatGPT Images 2.0 atau Nano Banana Pro
4. Menulis skrip direct response 5 shot dengan dialogue untuk setiap scene
5. Menghasilkan lima prompt Flow yang sudah di-tag aset, siap langsung ditempel ke Flow
6. Menulis satu instruksi briefing Agent mode yang mencakup seluruh sesi produksi
7. Menghasilkan skrip voiceover siap ElevenLabs untuk audio post-production

Skill ini TIDAK memanggil API apapun. Skill ini menghasilkan paket produksi. User menjalankan generate aktual di UI browser Flow.

## Sebelum memulai

User membutuhkan:
- Langganan Google AI Pro ($19.99/bulan) di labs.google.com/flow
- Gambar produk yang tersimpan di lokal (JPG atau PNG)
- Opsional: gambar kreator yang sudah ada, atau generate menggunakan prompt karakter yang dihasilkan skill ini

Tidak perlu API key. Tidak perlu kode. Tidak perlu terminal. Ini adalah alat berbasis UI.

## Alur Kerja

### Langkah 1 — Pengumpulan Data

Kumpulkan dari user:

1. **Gambar produk** — path file atau deskripsi (wajib)
2. **Nama produk + deskripsi satu baris** — jika tidak diberikan, tanya
3. **Angle iklan** — pilih satu atau tanya:
   - `testimonial` — kreator berbicara ke kamera tentang hasil (default)
   - `car/on-the-go` — kreator di dalam mobil atau dalam perjalanan, angle kepraktisan
   - `unboxing` — kreator membuka dan bereaksi terhadap produk
   - `lifestyle-demo` — kreator menggunakan produk di lingkungan alami
   - `problem-solution` — kondisi sebelum, perkenalan produk, kondisi sesudah
4. **Deskripsi kreator** — deskripsi singkat (usia, jenis kelamin, vibe). Jika tidak diberikan, gunakan default: "perempuan 27 tahun, berkaitan dengan fitness, tidak terlihat seperti model"
5. **Kategori brand/produk** — suplemen, kecantikan, pakaian, makanan/minuman, peralatan rumah, dll. Menentukan angle dan arketipe kreator yang paling sesuai.

Jangan tanya semuanya sekaligus. Gambar produk + angle sudah cukup untuk mulai. Tanya detail yang kurang secara natural.

### Langkah 2 — Cek Konteks Brand

Cari:
- `brand/brand-dna.md`
- `brand/brand-voice.md`
- `brand/icp-cards.md`

Jika ada, baca diam-diam. Gunakan untuk mempertajam suara dialogue dan penargetan ICP. Jangan sebut ini ke user. Jika tidak ada, lanjutkan — skill ini bekerja hanya dengan gambar produk.

### Langkah 3 — Generate Prompt Gambar Kreator

Hasilkan prompt gambar karakter yang bisa ditempel user ke ChatGPT Images 2.0 atau Nano Banana Pro.

Ikuti formula ini persis:

```
Foto iPhone candid seorang [gender] berusia [usia] tahun, [detail fisik spesifik — warna/tekstur rambut dengan flyaways alami, bintik-bintik atau tidak, dll.], makeup [minimal/natural/tanpa], mengenakan [outfit kasual spesifik — pakaian nyata, bukan "stylish"], [detail lingkungan — duduk di mobil / berdiri di dapur / dll.]. Diambil dari [sudut sedikit — sudut rendah sedikit off-center / sedikit di atas level mata]. [Pencahayaan spesifik — cahaya hari mendung lembut melalui jendela / cahaya dapur pagi yang hangat / lampu fluoresen overhead di gym]. Eksposur sedikit tidak sempurna. Tekstur kulit nyata, tidak diretuh. Flyaways rambut alami. Tanpa pencahayaan studio. Realisme gaya editorial.
```

Aturan:
- Jangan pernah gunakan "cantik," "indah," "memukau," atau deskriptor model
- Selalu sertakan lingkungan spesifik, bahkan di shot referensi karakter
- Selalu sertakan setidaknya satu ketidaksempurnaan yang disengaja (flyaways, bintik-bintik, pencahayaan tidak merata)
- Selalu sertakan "Foto iPhone candid" — salah satu sinyal realisme terkuat
- Sesuaikan arketipe kreator dengan kategori produk (lihat `references/characters.md`)

Beritahu user: simpan gambar yang dihasilkan sebagai `creator.png` dan unggah ke proyek Flow mereka bersama gambar produk. Kedua nama file harus deskriptif: `creator.png` dan `[nama-produk].jpg`.

### Langkah 4 — Tulis Skrip DR 5 Shot

Untuk angle yang dipilih, tulis shot list lengkap. Setiap shot mendapat:

```
Shot N/5 — [Nama Shot]
Lingkungan: [di mana kreator berada — ruangan/setting/konteks spesifik]
Aksi: [tepat apa yang terjadi — satu aksi saja per shot]
Produk dalam frame: [ya/tidak — dan jika ya, bagaimana]
Dialogue: [apa yang dikatakan kreator — ~3 kata per detik, suara UGC]
```

**Struktur direct response (default — angle testimonial):**

| Shot | Fungsi | Lingkungan | Produk |
|------|--------|------------|--------|
| 1 — Hook | Hentikan scroll dengan satu klaim | Dapur / kamar mandi / netral | Ya — dipegang ke arah kamera |
| 2 — Problem | Buat penonton merasakan masalahnya | Kamar tidur / meja / mobil | Tidak |
| 3 — Discovery | Perkenalkan produk secara natural | Dapur / kamar mandi | Ya — membuka/berinteraksi |
| 4 — Transformation | Tunjukkan hasilnya. Spesifik, tidak samar | Gym / luar ruangan / kerja | Tidak |
| 5 — CTA | Satu aksi, hilangkan hambatan | Kembali ke lingkungan Shot 1 | Ya — dipegang ke arah kamera |

**Aturan dialogue:**
- Suara UGC: "Oke aku harus cerita tentang ini" bukan "Memperkenalkan produk baru kami"
- ~3 kata per detik waktu tayang. Shot 7 detik = ~21 kata maksimal
- Baris pertama adalah hook — harus berfungsi tanpa suara (caption yang membawanya saat autoplay)
- Nama produk muncul di Shot 3 atau setelahnya, tidak pernah Shot 1
- CTA harus singkat dan kuat: "linknya ada di bawah" / "kamu literally nggak rugi apa-apa" — jangan pernah "beli sekarang" atau "shop now"
- Jika `brand/brand-voice.md` sudah dimuat, tirukan pola kalimatnya

Lihat `references/angles.md` untuk breakdown per shot dari kelima angle preset.

### Langkah 5 — Tulis Prompt Flow Bertag Aset

Untuk setiap shot, hasilkan prompt siap tempel ke Flow. Setiap prompt men-tag gambar kreator dan gambar produk berdasarkan nama file.

**Struktur prompt:**

```
Video UGC vertikal, [creator.png] [detail lingkungan + outfit], [aksi]. [product.jpg jika dalam frame — bagaimana mereka memegang/berinteraksi dengannya]. Berbicara langsung ke lensa: "[dialogue]." [Modifier gaya]. Vertikal 9:16, 8 detik.
```

**Modifier gaya wajib untuk setiap shot:**
- `nuansa handheld, sedikit goyangan kamera`
- `candid`
- `tekstur kulit natural`
- `[pencahayaan sesuai lingkungan — cahaya jendela lembut / cahaya natural mendung / cahaya dapur hangat]`
- `framing tidak sempurna`

**Shot yang menampilkan produk tambahan:**
- `label produk terlihat jelas`
- `botol [warna produk]` atau deskriptor yang sesuai — perkuat referensi visual

**Contoh (Shot 1 — Hook, angle testimonial, produk suplemen):**

```
Video UGC vertikal, creator.png berdiri di dapur cerah, rambut auburn diikat ekor kuda longgar, atasan olahraga lavender muda, memegang goli-bottle.jpg ke arah kamera dengan kedua tangan. Label produk terlihat jelas, botol merah. Berbicara langsung ke lensa: "Aku udah minum ini tiap pagi selama 30 hari dan energiku beneran beda." Nuansa handheld, sedikit goyangan kamera, candid, tekstur kulit natural, cahaya jendela lembut, framing tidak sempurna. Vertikal 9:16, 8 detik.
```

### Langkah 6 — Tulis Instruksi Briefing Agent Mode

Hasilkan satu instruksi yang bisa ditempel user ke Agent mode Flow untuk membriefing seluruh sesi sekaligus.

Format:

```
Aku sedang membuat iklan UGC vertikal 5 shot untuk [nama produk].

Aset yang sudah diunggah:
- creator.png — kreator UGC
- [nama-file-produk].jpg — produk

Generate shot-shot ini secara berurutan:

Shot 1: [lingkungan]. creator.png [aksi + interaksi produk]. Berbicara ke kamera: "[dialogue]." [pencahayaan], handheld, candid, framing tidak sempurna. 9:16, 8 detik.

Shot 2: [lingkungan berbeda]. creator.png [aksi, tanpa produk]. Berbicara ke kamera: "[dialogue]." [pencahayaan], handheld, candid. 9:16, 8 detik.

Shot 3: [lingkungan]. creator.png [aksi + interaksi produk]. Berbicara ke kamera: "[dialogue]." [pencahayaan], handheld, candid. 9:16, 8 detik.

Shot 4: [lingkungan aktif]. creator.png [aksi, tanpa produk]. Berbicara ke kamera: "[dialogue]." [pencahayaan], handheld, candid. 9:16, 8 detik.

Shot 5: [lingkungan bersih]. creator.png memegang [nama-file-produk].jpg ke arah kamera. Berbicara ke kamera: "[dialogue]." [pencahayaan], handheld, candid. 9:16, 8 detik.

Jaga konsistensi penampilan creator.png di semua shot. Generate setiap shot dalam format vertikal 9:16.
```

### Langkah 7 — Tulis Skrip Voiceover ElevenLabs

Hasilkan skrip voiceover lengkap — semua lima shot berurutan, dengan catatan timing.

Format:

```
SKRIP VOICEOVER — [Nama Produk] UGC Ad
Total durasi: ~40 detik

[Shot 1 — 0–8 dtk]
"[dialogue]"

[Shot 2 — 8–16 dtk]
"[dialogue]"

[Shot 3 — 16–24 dtk]
"[dialogue]"

[Shot 4 — 24–33 dtk]
"[dialogue]"

[Shot 5 — 33–42 dtk]
"[dialogue]"

---
Pengaturan ElevenLabs: Stability 0.5, Similarity 0.75, Style 0.3
Gaya suara yang direkomendasikan: conversational, hangat, bukan announcer
```

Beritahu user: generate klip video di Flow terlebih dahulu. Kemudian rekam atau generate voiceover ini di ElevenLabs. Gabungkan keduanya di CapCut — layer video + layer audio + caption.

### Langkah 8 — Pengiriman

Sajikan paket produksi lengkap dalam urutan ini:

1. **Prompt gambar kreator** — tempel ke ChatGPT Images 2.0 atau Nano Banana Pro
2. **Shot list dengan dialogue** — minta persetujuan sebelum generate
3. **Lima prompt Flow bertag aset** — satu per shot, tempel satu per satu
4. **Instruksi briefing Agent mode** — tempel sekali untuk membriefing seluruh sesi
5. **Skrip voiceover ElevenLabs** — gunakan setelah video selesai digenerate

Tanya user apakah mereka ingin mengubah dialogue atau angle sebelum generate. Perubahan dialogue gratis. Regenerasi klip menghabiskan kredit.

## Struktur file yang dihasilkan skill ini

```
[nama-proyek]-production-package/
├── character-prompt.md       # Prompt ChatGPT Images / Nano Banana
├── shot-list.md              # Skrip 5 shot dengan dialogue
├── flow-prompts.md           # 5 prompt bertag aset untuk Flow
├── agent-instruction.md      # Briefing Agent mode tunggal
└── voiceover-script.md       # Skrip siap ElevenLabs dengan timing
```

## Referensi

- `references/prompting.md` — modifier gaya, sintaks tag aset, struktur briefing Agent mode, apa yang merusak konsistensi karakter
- `references/angles.md` — breakdown per shot untuk kelima angle preset
- `references/characters.md` — template prompt gambar karakter untuk 8 arketipe kreator

## Batasan yang jujur

- Skill ini menghasilkan prompt, bukan video. User yang generate video di UI browser Flow.
- Konsistensi suara antar shot tidak mungkin dilakukan di Flow tanpa fitur Avatar (hanya wajah/suara sendiri). Rencanakan untuk post-production di ElevenLabs.
- Teks label produk bisa berantakan ketika produk kecil dalam frame atau lingkungan kompleks. Jaga produk tetap besar dan dekat di shot yang menampilkan produk.
- Konsistensi karakter di Flow membutuhkan tag `creator.png` di setiap prompt shot. Satu tag yang terlewat = kreator berubah tampilan.
- Agent mode Flow masih eksperimental. Jika tidak menjalankan semua shot secara otomatis, tempel prompt individual satu per satu.
- Shot makan/minum menghasilkan halusinasi. Gunakan ending hold-and-show atau hold-and-smile untuk produk yang dikonsumsi.
