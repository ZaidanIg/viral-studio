export const getFriendlyErrorHint = (rawError: string): string | null => {
  if (!rawError) return null;

  const lower = rawError.toLowerCase();

  // 1) Token / kredensial (Bearer Token, OAuth, API Key, dsb.)
  if (
    lower.includes('bearer token') ||
    lower.includes(' bearer ') ||
    lower.includes('access token') ||
    lower.includes('token expired') ||
    lower.includes('expired token') ||
    lower.includes('invalid token') ||
    lower.includes('invalid_grant') ||
    lower.includes('invalid credentials') ||
    lower.includes('unauthorized') ||
    lower.includes('oauth') ||
    lower.includes('api key')
  ) {
    if (lower.includes('veo')) {
      return (
        'Penjelasan singkat: kredensial untuk engine VEO (Global Bearer Token) tidak valid atau sudah kedaluwarsa.\n' +
        'Tindakan yang disarankan: buka halaman Pengaturan > Global Bearer Token, ganti token VEO dengan yang baru, simpan, lalu jalankan ulang proses generate.'
      );
    }

    if (lower.includes('nano banana')) {
      return (
        'Penjelasan singkat: kredensial untuk engine Nano Banana (Global Bearer Token) tidak valid atau sudah kedaluwarsa.\n' +
        'Tindakan yang disarankan: buka halaman Pengaturan > Global Bearer Token, ganti Bearer Token Nano Banana, simpan, lalu jalankan ulang proses generate.'
      );
    }

    if (lower.includes('gemini')) {
      return (
        'Penjelasan singkat: API Key Gemini tidak valid, sudah kedaluwarsa, atau project belum diberi izin yang cukup.\n' +
        'Tindakan yang disarankan: buka halaman Pengaturan > AI Configuration, perbarui API Key Gemini dengan yang benar, simpan, lalu jalankan ulang proses generate.'
      );
    }

    return (
      'Penjelasan singkat: kredensial (Bearer Token / API Key / OAuth token) untuk mengakses engine atau layanan AI tidak valid atau sudah kedaluwarsa.\n' +
      'Tindakan yang disarankan: buka halaman Pengaturan, cek kembali Global Bearer Token dan AI Configuration (API Key), simpan ulang, lalu jalankan ulang proses generate.'
    );
  }

  // 2) Masalah API Gemini / AI eksternal (non-kredensial)
  if (lower.includes('gemini')) {
    if (lower.includes('401') || lower.includes('403')) {
      return (
        'Penjelasan singkat: akses ke layanan Gemini ditolak (401/403). Biasanya karena API Key salah atau project belum diberi izin.\n' +
        'Tindakan yang disarankan: cek kembali API Key Gemini di halaman Pengaturan > AI Configuration dan pastikan project masih aktif, lalu coba lagi.'
      );
    }

    if (lower.includes('429')) {
      return (
        'Penjelasan singkat: permintaan ke Gemini terlalu sering atau kuota sudah mendekati batas (429).\n' +
        'Tindakan yang disarankan: tunggu beberapa menit, kurangi jumlah batch / parallel yang digenerate sekaligus, lalu coba ulang.'
      );
    }

    if (
      lower.includes('5xx') ||
      lower.includes('gangguan di sisi server') ||
      lower.includes('server error')
    ) {
      return (
        'Penjelasan singkat: server Gemini sedang bermasalah di sisi mereka (5xx). Ini biasanya gangguan sementara.\n' +
        'Tindakan yang disarankan: tunggu beberapa menit lalu jalankan ulang proses. Jika berulang sepanjang hari, hubungi tim support dengan menyertakan Activity Log.'
      );
    }

    return (
      'Penjelasan singkat: terjadi masalah saat berkomunikasi dengan layanan Gemini (AI Google).\n' +
      'Tindakan yang disarankan: pastikan koneksi internet stabil dan API Key di halaman Pengaturan sudah benar, lalu coba ulang.'
    );
  }

  // 3) Engine / zeoAPI tidak tersedia (biasanya Electron tidak aktif)
  if (
    (lower.includes('zeoapi') && lower.includes('tidak tersedia')) ||
    (lower.includes('engine') && lower.includes('tidak tersedia'))
  ) {
    return (
      'Penjelasan singkat: mesin pemroses di aplikasi desktop belum siap atau tidak dapat diakses.\n' +
      'Tindakan yang disarankan: pastikan Anda menjalankan Viral Studio sebagai aplikasi desktop (Electron) dan tidak menutup jendela utama saat proses berjalan. Jika perlu, tutup aplikasi lalu buka lagi dan ulangi proses.'
    );
  }

  // 4) Folder / file tidak ditemukan atau tidak bisa dibaca
  if (
    (lower.includes('tidak dapat membaca file gambar') ||
      lower.includes('tidak ditemukan file gambar')) ||
    (lower.includes('folder input') || lower.includes('folder output'))
  ) {
    return (
      'Penjelasan singkat: sistem tidak bisa menemukan atau membaca file di folder yang dipilih.\n' +
      'Tindakan yang disarankan: pastikan path Folder Input/Output benar, folder berisi file yang sesuai (misalnya JPG/PNG), dan tidak sedang dipindahkan atau di-rename. Jika path diambil dari konfigurasi global, buka halaman Pengaturan > Global Folder Configuration dan pastikan Folder Input/Output sudah diisi dengan benar. Setelah itu, klik Clear Data lalu jalankan ulang.'
    );
  }

  // 5) Konfigurasi global / Pengaturan belum diisi (fallback khusus konfigurasi)
  if (
    lower.includes('belum dikonfigurasi') ||
    lower.includes('konfigurasi global belum lengkap') ||
    lower.includes('ai configuration belum lengkap') ||
    lower.includes('buka halaman pengaturan')
  ) {
    return (
      'Penjelasan singkat: ada pengaturan global yang belum diisi (misalnya API Key Gemini, Bearer Token, atau Folder Input/Output).\n' +
      'Tindakan yang disarankan: buka halaman Pengaturan, lengkapi bagian yang disebut di pesan error (misalnya Global Workflow Configuration, Global Bearer Token, Global Folder Configuration, atau AI Configuration), lalu jalankan ulang proses dari awal.'
    );
  }

  // 6) Engine tidak mengembalikan hasil gambar / video yang valid
  if (
    lower.includes('tidak mengembalikan hasil gambar') ||
    lower.includes('tidak mengembalikan hasil video') ||
    lower.includes('hasil gambar') ||
    lower.includes('hasil gagal tanpa pesan error') ||
    lower.includes('hasil gambar untuk slot ini tidak memiliki data')
  ) {
    return (
      'Penjelasan singkat: engine AI tidak mengirim balik gambar/video yang valid untuk permintaan ini.\n' +
      'Tindakan yang disarankan: coba ulang Generate untuk batch tersebut. Jika sering terjadi, kurangi jumlah batch/parallel dan periksa kembali deskripsi/prompt yang Anda gunakan.'
    );
  }

  // 7) Analisis otomatis gagal (character / product analysis)
  if (lower.includes('analisis otomatis')) {
    return (
      'Penjelasan singkat: proses analisis otomatis dari foto (untuk karakter atau produk) gagal.\n' +
      'Tindakan yang disarankan: cek kembali koneksi internet dan konfigurasi AI di halaman Pengaturan. Jika perlu, isi field deskripsi secara manual lalu lanjutkan generate seperti biasa.'
    );
  }

  // 8) Fallback umum
  return (
    'Penjelasan singkat: terjadi error saat menjalankan proses generate.\n' +
    'Langkah umum yang bisa dicoba:\n' +
    '1) Cek kembali konfigurasi di halaman Pengaturan sesuai pesan error.\n' +
    '2) Pastikan koneksi internet stabil.\n' +
    '3) Tekan Clear Data di halaman ini, lalu coba jalankan ulang proses dari awal.\n' +
    'Jika error tetap muncul, salin isi Activity Log dan kirim ke tim support untuk dianalisis lebih lanjut.'
  );
};
