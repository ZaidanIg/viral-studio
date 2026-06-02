'use client'

import React, { useState, useEffect } from 'react';
import { Sparkles, Loader2, Save, ArrowRight, User } from 'lucide-react';
import { motion } from 'framer-motion';

// Extension communication will bypass reCAPTCHA and SOP

const initialFormData = {
  namaKarakter: '',
  jenisKelamin: '',
  usia: '',
  etnis: '',
  warnaKulit: '',
  bentukWajah: '',
  warnaMata: '',
  bentukMata: '',
  detailMata: '',
  bentukHidung: '',
  bentukBibir: '',
  warnaBibir: '',
  bentukRahang: '',
  tahiLalat: '',
  bekasLuka: '',
  bintikBintik: '',
  warnaRambut: '',
  panjangRambut: '',
  gayaRambut: '',
  detailGaya: '',
  tinggiBadan: '',
  bentukTubuh: '',
  tato: '',
  tandaLahir: '',
  gayaPakaian: '',
  atasan: '',
  bawahan: '',
  outerwear: '',
  alasKaki: '',
  warnaPola: '',
  anting: '',
  aksesorisLeher: '',
  aksesorisTangan: '',
  kacamata: '',
  penutupKepala: '',
  ekspresi: 'neutral',
  postur: 'standing straight',
  bendaPendamping: '',
  lingkungan: 'white studio',
  gayaSeni: 'Photorealistic',
  kualitas: '8k, highly detailed',
  pencahayaan: 'studio lighting',
  paletWarna: '',
  tipeShot: 'Full body',
  promptNegatif: 'bad anatomy, distorted face, extra limbs, blurry, inconsistent character, different hair, wrong clothes, watermark, signature, text, logo',
};

type FormData = typeof initialFormData;

export default function GenerateCharacterPage() {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isGenerating, setIsGenerating] = useState(false);
  const [bearerToken, setBearerToken] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState('');
  
  // Image Reference State
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [referenceMediaId, setReferenceMediaId] = useState<string | null>(null);
  const [referenceWorkflowId, setReferenceWorkflowId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const sessionIdRef = React.useRef(`${Date.now()}`);

  // No reCAPTCHA initialization needed on client side anymore.
  // The Chrome Extension handles it directly on labs.google.com.

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setReferenceImage(e.target.files[0]);
      setReferenceMediaId(null); // Reset media ID if new image is selected
    }
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          
          // GEM_PIX_2 model throws 500 Internal Error if reference images are too large!
          // We must resize to max 256 on the longest edge.
          if (width > height) {
            if (width > 256) {
              height = Math.round((height * 256) / width);
              width = 256;
            }
          } else {
            if (height > 256) {
              width = Math.round((width * 256) / height);
              height = 256;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            // Draw image on white background in case of transparency
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, width, height);
          }
          
          // Compress as JPEG to match the hardcoded mimeType in background.js
          const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
          resolve(dataUrl.split(',')[1]);
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const uploadImageToFlow = async (base64String: string): Promise<{ mediaId: string; workflowId: string | null }> => {
    const requestId = Date.now().toString();
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        window.removeEventListener(`VIRAL_STUDIO_UPLOAD_RESPONSE_${requestId}`, handleResponse);
        reject(new Error('Upload timeout.'));
      }, 30000);

      const handleResponse = (e: Event) => {
        clearTimeout(timeout);
        window.removeEventListener(`VIRAL_STUDIO_UPLOAD_RESPONSE_${requestId}`, handleResponse);
        
        const detail = (e as CustomEvent).detail;
        if (!detail || !detail.success || detail.error || (detail.data && detail.data.error)) {
          reject(new Error(detail?.error || detail?.data?.message || 'Upload error'));
          return;
        }
        
        const rawMediaId = detail.data?.mediaGenerationId?.mediaGenerationId;
        if (!rawMediaId) {
          reject(new Error('No media ID returned from upload.'));
          return;
        }

        // The upload token is a base64-encoded protobuf containing TWO UUIDs:
        // UUID[0] = image asset ID (imageInputs[].name)
        // UUID[1] = workflowId (required by batchGenerateImages)
        let mediaId = rawMediaId;
        let workflowId: string | null = null;
        try {
          const pad = 4 - (rawMediaId.length % 4);
          const padded = pad !== 4 ? rawMediaId + '='.repeat(pad) : rawMediaId;
          const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
          const uuidMatches = decoded.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi);
          if (uuidMatches && uuidMatches.length >= 2) {
            mediaId = uuidMatches[0];
            workflowId = uuidMatches[1];
            console.log('[Upload] Extracted mediaId:', mediaId, 'workflowId:', workflowId);
          }
        } catch (e) {
          console.warn('Failed to decode upload token', e);
        }
        
        if (!mediaId || !workflowId) {
          reject(new Error('Invalid upload response format: missing mediaId or workflowId.'));
          return;
        }

        resolve({ mediaId, workflowId });
      };

      window.addEventListener(`VIRAL_STUDIO_UPLOAD_RESPONSE_${requestId}`, handleResponse);

      window.dispatchEvent(new CustomEvent('VIRAL_STUDIO_UPLOAD_REQUEST', {
        detail: {
          id: requestId,
          payload: {
            imageBase64: base64String,
            bearerToken,
            sessionId: sessionIdRef.current,
          }
        }
      }));
    });
  };

  const buildPrompt = () => {
    // Basic prompt construction mimicking Zeo Studio
    const parts: string[] = [];
    let identity = `${formData.gayaSeni}, ${formData.kualitas} ${formData.tipeShot}, of a`;
    if (formData.usia) identity += ` ${formData.usia}`;
    if (formData.etnis) identity += ` ${formData.etnis}`;
    if (formData.jenisKelamin) identity += ` ${formData.jenisKelamin}`;
    if (formData.namaKarakter) identity += ` named ${formData.namaKarakter}`;
    parts.push(`${identity}.`);

    const faceDetails = [
      formData.bentukWajah && `${formData.bentukWajah} face`,
      formData.warnaKulit && `${formData.warnaKulit} healthy skin`,
    ].filter(Boolean).join(', ');
    if (faceDetails) parts.push(`Has a ${faceDetails}.`);

    const hair = [formData.panjangRambut, formData.gayaRambut, formData.warnaRambut].filter(Boolean).join(' ');
    if (hair) parts.push(`Hair is ${hair}.`);

    const outfit = [
      formData.atasan && `wearing a ${formData.atasan}`,
      formData.bawahan && `a pair of ${formData.bawahan}`,
    ].filter(Boolean).join(', ');
    if (outfit) parts.push(`She is ${outfit}.`);

    parts.push(`Lighting: ${formData.pencahayaan}.`);
    
    return parts.join(' ');
  };

  const handleGenerate = async () => {
    if (!bearerToken) {
      setError('Silakan masukkan Bearer Token Anda!');
      return;
    }

    setError('');
    setIsGenerating(true);

    try {
      let currentMediaId = referenceMediaId;
      let currentWorkflowId = referenceWorkflowId;

      if (referenceImage && !currentMediaId) {
        setIsUploading(true);
        try {
          // Compress the image before uploading so Google's API doesn't crash (500 error)
          const base64 = await compressImage(referenceImage);
          const uploadResult = await uploadImageToFlow(base64);
          currentMediaId = uploadResult.mediaId;
          currentWorkflowId = uploadResult.workflowId;
          setReferenceMediaId(currentMediaId);
          setReferenceWorkflowId(currentWorkflowId);
        } catch (err: any) {
          throw new Error('Gagal mengunggah gambar referensi: ' + err.message);
        } finally {
          setIsUploading(false);
        }
      }

      const prompt = buildPrompt();

      let imageInputs: any[] = [];
      if (currentMediaId) {
        // currentMediaId is the extracted UUID[0] from uploadImageToFlow decode
        imageInputs = [
          {
            name: currentMediaId,
            imageInputType: 'IMAGE_INPUT_TYPE_BASE_IMAGE',
          }
        ];
      }

      // We use a CustomEvent to talk to the Chrome Extension Content Script (content-bridge.js)
      // which acts as a proxy to labs.google.com to get the reCAPTCHA token and fetch the API.
      
      const requestId = Date.now().toString();
      
      const responsePromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          window.removeEventListener(`VIRAL_STUDIO_GENERATE_RESPONSE_${requestId}`, handleResponse);
          reject(new Error('Extension timeout. Make sure the Viral Studio Flow Bridge Chrome extension is installed and enabled.'));
        }, 60000); // 60s timeout

        const handleResponse = (e: Event) => {
          clearTimeout(timeout);
          window.removeEventListener(`VIRAL_STUDIO_GENERATE_RESPONSE_${requestId}`, handleResponse);
          
          const detail = (e as CustomEvent).detail;
          if (!detail) {
            reject(new Error('Empty response from extension'));
            return;
          }
          
          if (!detail.success || detail.error || (detail.data && detail.data.error)) {
            reject(new Error(detail.error || detail.data?.message || 'Extension error'));
            return;
          }
          
          resolve(detail.data);
        };

        window.addEventListener(`VIRAL_STUDIO_GENERATE_RESPONSE_${requestId}`, handleResponse);
      });

      // Dispatch request to Extension
      window.dispatchEvent(new CustomEvent('VIRAL_STUDIO_GENERATE_REQUEST', {
        detail: {
          id: requestId,
          payload: {
            prompt,
            bearerToken,
            sessionId: ';' + sessionIdRef.current, // Generate endpoint expects the semicolon prefix
            imageModelName: 'GEM_PIX_2',
            imageInputs,
            ...(currentWorkflowId ? { workflowId: currentWorkflowId } : {}),
          }
        }
      }));

      const data: any = await responsePromise;

      // Parse response — GEM_PIX API has multiple possible schemas:
      // Schema 1 (new): result.media[0].image.generatedImage.fifeUrl or encodedImage
      // Schema 2 (legacy): result.imagePanels[0].generatedImages[0].encodedImage
      let finalImageUrl: string | null = null;
      let mimeType = 'image/jpeg';

      if (Array.isArray(data?.media) && data.media.length > 0) {
        const gen = data.media[0]?.image?.generatedImage;
        const encoded = gen?.encodedImage || gen?.imageBytes || gen?.imageData || null;
        if (encoded) {
          finalImageUrl = `data:${gen?.mimeType || mimeType};base64,${encoded}`;
        } else if (gen?.fifeUrl) {
          finalImageUrl = gen.fifeUrl;
        }
      }

      if (!finalImageUrl && Array.isArray(data?.imagePanels) && data.imagePanels.length > 0) {
        const imgs = data.imagePanels[0]?.generatedImages || [];
        const encoded = imgs[0]?.encodedImage || imgs[0]?.imageBytes || null;
        if (encoded) {
          finalImageUrl = `data:${imgs[0]?.mimeType || mimeType};base64,${encoded}`;
        }
      }

      if (!finalImageUrl) {
        console.error('[Debug] Full API Response:', data);
        throw new Error('No image returned from API. Response keys: ' + Object.keys(data || {}).join(', '));
      }

      setImages((prev) => [finalImageUrl as string, ...prev]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Terjadi kesalahan saat generate gambar.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 80, paddingTop: 8 }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
          <User size={28} className="text-[var(--color-primary)]" />
          <span>Generate Character</span>
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
          Buat karakter hyper-realistic yang konsisten menggunakan Nano Banana (Google Flow Media).
          <br />
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            💡 Buka <strong>labs.google/fx</strong> di tab lain dan generate sekali agar ekstensi dapat menangkap Bearer &amp; reCAPTCHA token otomatis.
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ─────────── LEFT: FORM PANEL ─────────── */}
        <div className="lg:col-span-5 flex flex-col gap-4">

          {/* Bearer Token */}
          <div className="card p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[var(--color-primary)]" />
              <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-primary)' }}>Autentikasi</h2>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Bearer Token <span className="text-[var(--color-text-muted)]">(auto-captured dari labs.google)</span></label>
              <input
                type="password"
                value={bearerToken}
                onChange={(e) => setBearerToken(e.target.value)}
                placeholder="Biarkan kosong jika sudah generate di labs.google..."
                className="input w-full text-sm"
              />
            </div>
          </div>

          {/* Gambar Referensi */}
          <div className="card p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-400" />
              <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-primary)' }}>Gambar Referensi</h2>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Upload Gambar <span style={{ color: 'var(--color-text-muted)' }}>(opsional)</span></label>
              <label className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-colors hover:border-[var(--color-primary)]"
                style={{ borderColor: 'var(--border-subtle)', background: 'var(--color-surface-1)' }}>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleFileChange}
                  className="sr-only"
                />
                <Save className="w-5 h-5 opacity-40" />
                {referenceImage ? (
                  <span className="text-xs text-green-400 font-medium">{referenceImage.name}</span>
                ) : (
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>PNG, JPG, WEBP — klik untuk pilih</span>
                )}
              </label>
            </div>
          </div>

          {/* Identitas */}
          <div className="card p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-400" />
              <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-primary)' }}>Identitas Karakter</h2>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Nama Karakter</label>
              <input name="namaKarakter" value={formData.namaKarakter} onChange={handleChange} placeholder="e.g. Rara" className="input w-full text-sm" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Jenis Kelamin</label>
                <input name="jenisKelamin" value={formData.jenisKelamin} onChange={handleChange} placeholder="Female" className="input w-full text-sm" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Usia</label>
                <input name="usia" value={formData.usia} onChange={handleChange} placeholder="25 years old" className="input w-full text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Etnis / Ras</label>
                <input name="etnis" value={formData.etnis} onChange={handleChange} placeholder="Indonesian" className="input w-full text-sm" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Warna Kulit</label>
                <input name="warnaKulit" value={formData.warnaKulit} onChange={handleChange} placeholder="tan" className="input w-full text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Tinggi Badan</label>
                <input name="tinggiBadan" value={formData.tinggiBadan} onChange={handleChange} placeholder="160cm" className="input w-full text-sm" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Bentuk Tubuh</label>
                <input name="bentukTubuh" value={formData.bentukTubuh} onChange={handleChange} placeholder="slim" className="input w-full text-sm" />
              </div>
            </div>
          </div>

          {/* Rambut */}
          <div className="card p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-primary)' }}>Rambut</h2>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Warna</label>
                <input name="warnaRambut" value={formData.warnaRambut} onChange={handleChange} placeholder="black" className="input w-full text-sm" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Panjang</label>
                <input name="panjangRambut" value={formData.panjangRambut} onChange={handleChange} placeholder="long" className="input w-full text-sm" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Gaya</label>
                <input name="gayaRambut" value={formData.gayaRambut} onChange={handleChange} placeholder="straight" className="input w-full text-sm" />
              </div>
            </div>
          </div>

          {/* Pakaian */}
          <div className="card p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-pink-400" />
              <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-primary)' }}>Pakaian & Aksesoris</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Atasan</label>
                <input name="atasan" value={formData.atasan} onChange={handleChange} placeholder="white button-up shirt" className="input w-full text-sm" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Bawahan</label>
                <input name="bawahan" value={formData.bawahan} onChange={handleChange} placeholder="blue jeans" className="input w-full text-sm" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Outerwear</label>
                <input name="outerwear" value={formData.outerwear} onChange={handleChange} placeholder="leather jacket" className="input w-full text-sm" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Alas Kaki</label>
                <input name="alasKaki" value={formData.alasKaki} onChange={handleChange} placeholder="white sneakers" className="input w-full text-sm" />
              </div>
            </div>
          </div>

          {/* Visual */}
          <div className="card p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-400" />
              <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-primary)' }}>Visual & Teknis</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Gaya Seni</label>
                <input name="gayaSeni" value={formData.gayaSeni} onChange={handleChange} className="input w-full text-sm" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Tipe Shot</label>
                <input name="tipeShot" value={formData.tipeShot} onChange={handleChange} placeholder="Full body" className="input w-full text-sm" />
              </div>
              <div className="flex flex-col gap-1.5 col-span-2">
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Pencahayaan</label>
                <input name="pencahayaan" value={formData.pencahayaan} onChange={handleChange} className="input w-full text-sm" />
              </div>
              <div className="flex flex-col gap-1.5 col-span-2">
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Lingkungan / Latar</label>
                <input name="lingkungan" value={formData.lingkungan} onChange={handleChange} placeholder="white studio" className="input w-full text-sm" />
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || isUploading}
              className="btn-primary w-full flex items-center justify-center gap-2 font-semibold"
              style={{ padding: '14px 24px', borderRadius: 12, fontSize: 15 }}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Memproses di Google Flow...
                </>
              ) : isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Mengunggah Gambar Referensi...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate Karakter
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {error && (
              <div className="p-3 rounded-xl text-sm flex items-start gap-2"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                <span className="shrink-0 mt-0.5">⚠</span>
                <span>{error}</span>
              </div>
            )}
          </div>

        </div>

        {/* ─────────── RIGHT: PREVIEW PANEL ─────────── */}
        <div className="lg:col-span-7">
          <div className="card p-6 flex flex-col" style={{ minHeight: 560, position: 'sticky', top: 24 }}>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>Preview Hasil</h2>
              <span className="badge badge-brand">{images.length} Gambar</span>
            </div>

            <div className="flex-1">
              {images.length === 0 ? (
                <div className="h-full min-h-[440px] flex flex-col items-center justify-center text-center p-8 rounded-xl"
                  style={{ background: 'var(--color-surface-1)', color: 'var(--color-text-muted)' }}>
                  <div className="w-24 h-24 mb-5 rounded-full flex items-center justify-center"
                    style={{ background: 'var(--color-surface-2)', border: '1px solid var(--border-subtle)' }}>
                    <User className="w-12 h-12 opacity-30" />
                  </div>
                  <p className="text-base font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>Belum ada preview</p>
                  <p className="text-sm max-w-[240px]" style={{ lineHeight: 1.6 }}>
                    Isi form karakter di sebelah kiri, lalu tekan <strong>Generate Karakter</strong>.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {images.map((img, i) => (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                      key={i}
                      className="aspect-[3/4] relative rounded-xl overflow-hidden group"
                      style={{ border: '1px solid var(--border-subtle)' }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img} alt={`Generated Character ${i + 1}`} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-4"
                        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)' }}>
                        <a
                          href={img}
                          download={`character-${i + 1}.jpg`}
                          className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Save className="w-3.5 h-3.5" /> Simpan
                        </a>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
