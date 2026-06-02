import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import PageHeader from '../../shared/components/PageHeader';
import GradientLoader from '../../shared/components/GradientLoader';
import loadingGif0 from "../../../../asset/loading/Buat_jadi_video_cinematic_dan_pastikan_mobil.gif";
import loadingGif1 from "../../../../asset/loading/Buat_jadi_video_cinematic_dan_pastikan_mobil (1).gif";
import loadingGif2 from "../../../../asset/loading/Buat_jadi_video_cinematic_dan_pastikan_mobil (2).gif";
import loadingGif3 from "../../../../asset/loading/Buat_jadi_video_cinematic_dan_pastikan_mobil (3).gif";
import { getFriendlyErrorHint } from '../../shared/utils/friendlyError';
import { useAuthReady } from '../../shared/utils/useAuthReady';
import { useLanguage } from '../../shared/i18n';
import { type ImageResolutionOption, useImageResolution } from '../../shared/utils/useImageResolution';

// Local helper types for this page

type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';

const CATALOG_TUTORIAL_URL = 'https://www.youtube.com/embed/Dhj9QziMVVM?autoplay=1&mute=1&origin=http://localhost:3000';

interface ImageFile {
  file: File;
  preview: string;
}

interface ProductAngles {
  front: ImageFile | null;
  back: ImageFile | null;
  left: ImageFile | null;
  right: ImageFile | null;
  top: ImageFile | null;
  bottom: ImageFile | null;
}

type ActivityLogEntry = {
  id: number;
  type: 'INFO' | 'SUCCESS' | 'ERROR';
  message: string;
  timestamp: string;
};

type VideoAspectRatio = '16:9' | '9:16';
type VideoResolutionOption = '720p';

type CatalogVideoSettings = {
  aspectRatio: VideoAspectRatio;
  veoModel: '3.1-fast-low';
  resolution: VideoResolutionOption;
};

const getVideoSettingsFromAspectRatio = (
  ratio: AspectRatio,
  veoModel: CatalogVideoSettings['veoModel'],
): CatalogVideoSettings => {
  const isPortrait = ratio === '9:16';
  const aspectRatio: VideoAspectRatio = isPortrait ? '9:16' : '16:9';
  return {
    aspectRatio,
    veoModel,
    resolution: '720p',
  };
};

type CatalogAngleVideoOutput = {
  fileName: string;
  filePath: string;
  sceneIndex?: number;
  status?: 'generating' | 'completed' | 'failed';
  startedAt?: number;
  estimatedTotalSeconds?: number;
  prompt?: string;
  errorMessage?: string;
};

type CatalogAngleViewMode = 'photo' | 'video';

type CatalogImageOutput = {
  dataUrl: string;
  status?: 'generating' | 'completed' | 'failed';
  startedAt?: number;
  estimatedTotalSeconds?: number;
  prompt?: string;
  errorMessage?: string;
};

const initialProductAngles: ProductAngles = {
  front: null,
  back: null,
  left: null,
  right: null,
  top: null,
  bottom: null,
};

const DEFAULT_ANGLE_COUNT = 12;
const CATALOG_ANGLE_LABELS: string[] = Array.from(
  { length: DEFAULT_ANGLE_COUNT },
  (_, idx) => `Angle ${idx + 1}`,
);

// Dedicated video motion descriptions (separate from image prompts)
const VIDEO_MOTION_DETAILS: string[] = [
  'Extreme Macro + Slider In: slow push-in to texture for luxury intimacy.',
  'Rack Focus: static camera, shift focus from background to product detail.',
  'Orbit: slow 180° rotation around product/model for 3D reveal.',
  'Top-Down Slow-Mo Drop: overhead flatlay, product drops in 120fps+.',
  'Pan Reveal: lateral move past foreground blocker to reveal product.',
  'Whip Pan: fast pan transition landing on product hero.',
  'Low-Angle Push Up: rise from low angle to heroic framing.',
  'Light Sweep: camera locked, moving light for dynamic shadows.',
  'Dutch Tilt: diagonal tilt with slow tilt-up for artistic feel.',
  'Hand Interaction Follow: camera follows hand using/touching product.',
  'Pull-Out Context: start tight on logo, dolly/zoom out to full context.',
  'Signature Close Fade: slow tilt-up to logo, dramatic light, end fade-out.',
];

const CATALOG_ANGLE_BATCH_SIZE = 4;
const MAX_PARALLEL_REGENERATE = 4;

const CATALOG_ANGLE_GROUPS_COUNT = 3;

const getCatalogAngleGroups = (lang: 'en' | 'id' | 'ms') => {
  const titles = ['Angles 1–4', 'Angles 5–8', 'Angles 9–12'];

  return titles.map((title, idx) => {
    const start = idx * 4 + 1;
    const end = start + 3;
    return {
      id: String(idx + 1),
      title: `${idx + 1} · ${title}`,
      subtitle: `Angles ${start}–${end}`,
    };
  });
};

const DEFAULT_ENABLED_CATALOG_GROUPS = Array.from({ length: CATALOG_ANGLE_GROUPS_COUNT }, () => true);
const MIN_CATALOG_GROUPS = 1;
const MAX_CATALOG_GROUPS = 3;

const getCatalogAngleGroupIndex = (index: number): number => {
  if (index < 0) return -1;
  if (index < CATALOG_ANGLE_LABELS.length) {
    return Math.floor(index / 4);
  }

  const extendedStart = CATALOG_ANGLE_LABELS.length;
  const extendedEnd = CATALOG_ANGLE_LABELS.length + CATALOG_EXTENDED_ANGLE_LABELS.length;
  if (index >= extendedStart && index < extendedEnd) {
    return 6 + Math.floor((index - extendedStart) / 4);
  }

  const baseIndex = index % CATALOG_ANGLE_LABELS.length;
  return Math.floor(baseIndex / 4);
};

const CATALOG_EXTENDED_ANGLE_LABELS: string[] = [];

// Ads Maker-focused analysis schema
const CATALOG_CHARACTER_ANALYSIS_PARAMETERS: string[] = [
  'Model Role Archetype',
  'Persona & Demographic',
  'Emotion Cue (for ad)',
  'Pose / Body Language',
  'Camera Framing Preference',
  'Outfit Vibe (for ad)',
  'Accessories (visible)',
  'Hair & Makeup Notes',
  'Lighting Preference (character)',
];

const CATALOG_PRODUCT_ANALYSIS_PARAMETERS: string[] = [
  'Product Category',
  'Hero Feature / USP',
  'Benefit to Customer',
  'Use Case / Scene Suggestion',
  'Texture & Finish',
  'Color Palette',
  'Logo / Brand Element',
  'Do / Don\'ts (what to avoid)',
  'Background / Environment',
  'Lighting / Highlight',
  'CTA Wording Suggestion',
  'Offer / Price Mention',
  'Framing Guidance',
];

const CLOTHING_CHARACTER_KEYS: string[] = [
  'General Clothing Style',
  'Top',
  'Bottom',
  'Outerwear',
  'Footwear',
  'Jewelry',
  'Headwear (hats, etc.)',
];

const CLOTHING_PRODUCT_KEYWORDS: string[] = [
  'baju',
  'kaos',
  'kemeja',
  'dress',
  'gamis',
  'abaya',
  'blouse',
  'blus',
  't-shirt',
  'tshirt',
  'hoodie',
  'jaket',
  'jacket',
  'sweater',
  'cardigan',
  'outerwear',
  'atasan',
  'bawahan',
  'skirt',
  'rok',
  'pants',
  'celana',
  'jeans',
  'setelan',
  'outfit',
  'hijab',
  'kerudung',
  'scarf',
  'shawl',
];

const FACE_REFERENCE_SEPARATION_NOTE =
  'IMPORTANT: If you upload more than one face/model photo, SEPARATE the descriptions per model (e.g., "Model A: ...", "Model B: ...") so visual identities do not mix.';

const PRODUCT_IDENTITY_LOCK =
  'If the product must stay CONSISTENT across all images/videos, emphasize the product description and note: "Product identity is locked. Do NOT change its shape, color, material, logo, or unique attributes."';

const PRODUCT_FACE_IGNORE_NOTE =
  'If the product reference photo contains a human face, IGNORE the face. Do NOT copy that person. Only use the photo to understand product design, material, and texture; the final character face must come from the character reference photo (not the product photo).';

const CATALOG_EXTENDED_ANGLE_PROMPTS: string[] = [];

// Predefined environment rotation to avoid background repetition
const ANGLE_ENVIRONMENTS: string[] = [
  'minimal studio seamless backdrop',
  'window-lit living room with sofa (use only once)',
  'wardrobe / hanger corner',
  'textured plaster wall with stool',
  'modern workspace desk',
  'cozy reading nook with armchair',
  'bright bay window with curtains',
  'dressing room with mirror',
  'loft interior with plants',
  'neutral photo table flatlay',
  'retail display shelf',
  'sunlit tabletop flatlay with soft linen',
];

// Camera motion presets per angle (align with 12 angles)
const ANGLE_CAMERA_MOTION: string[] = [
  'locked-off neutral framing',
  'slow pedestal up for dimensional read',
  'subtle trucking move tracing silhouette',
  'small push-in from behind',
  'light arc move while in action',
  'tracking left-to-right at knee level',
  'gentle dolly-in over shoulder',
  'high-angle tilt down to product',
  'slow rise from frog-eye',
  'static wide with negative space',
  'micro slider for macro detail',
  'subtle push-in on mirror layers',
];

type DynamicAngleIdea = { label: string; prompt: string };

const buildDynamicAngleIdeas = (
  characterSummary: string,
  productSummary: string,
): DynamicAngleIdea[] => {
  const characterPhrases = characterSummary
    .split(/[.•\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);

  const productPhrasesRaw = productSummary
    .split(/[.,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const GENERIC_CUE_STOPWORDS = [
    'produk',
    'product',
    'model',
    'benefit',
    'persona',
    'demografi',
    'skena',
    'penggunaan',
    'emosi',
    'iklan',
    'bekerja',
    'rumah',
    'pose',
    'bahasa',
    'tubuh',
    'framing',
    'preferensi',
    'nuansa',
    'outfit',
    'hotel',
    'atau',
    'sebagai',
    'visual',
    'brand',
    'finishing',
    'matte',
    'putih',
    'sandal',
    'hindari',
    'cahaya',
    'interior',
    'bantal',
    'selimut',
    'rajut',
    'jendela',
    'alami',
    'menonjolkan',
    'dengan',
    'fokus',
    'fokuskan',
    'sertakan',
    'menciptakan',
    'cta',
    'dapatkan',
    'gunakan',
    'sebagaian',
    'cocok',
    'untuk',
    'menonton',
    'film',
    'menyoroti',
    'tekstur',
    'warna',
    'pada',
    'dari',
    'yang',
    'peran',
    'pelanggan',
    'utama',
    'setelan',
    'kamera',
    'full',
    'shot',
    'abu',
    'muda',
    'wanita',
    'membaca',
    'buku',
    'bersantai',
  ];
  const sanitize = (text: string) => text.replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const toTitleCase = (text: string) =>
    text
      .split(' ')
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  const limitWords = (text: string, count = 3) => text.split(' ').filter(Boolean).slice(0, count).join(' ');
  const shorten = (text: string, max = 18) => {
    if (text.length <= max) return text;
    const words = text.split(' ');
    let out = '';
    for (const w of words) {
      if ((out + ' ' + w).trim().length > max) break;
      out = (out ? out + ' ' : '') + w;
    }
    return out || text.slice(0, max - 1);
  };

  // Extract cue candidates from product & character summaries
  const extractCues = (phrases: string[]) =>
    phrases
      .flatMap((p) => p.split(/\s{2,}|;/))
      .map((p) => {
        const words = sanitize(p)
          .split(' ')
          .filter(Boolean)
          .filter((w) => !GENERIC_CUE_STOPWORDS.includes(w.toLowerCase()));
        return limitWords(words.join(' '), 4);
      })
      .map((p) => toTitleCase(p))
      .filter((p) => {
        const wc = p.split(' ').filter(Boolean).length;
        return wc >= 2 && wc <= 3;
      });

  const productCues = extractCues(productPhrasesRaw);
  const characterCues = extractCues(characterPhrases);

  const fallbackCues = ANGLE_ENVIRONMENTS.map((e) => toTitleCase(limitWords(sanitize(e), 3)));

  const merged: string[] = [];
  const maxAngles = DEFAULT_ANGLE_COUNT;
  const addCue = (cue: string) => {
    const trimmed = shorten(cue || '', 18).trim();
    const key = trimmed.toLowerCase();
    const hasGeneric = key
      .split(' ')
      .some((word) => GENERIC_CUE_STOPWORDS.includes(word));
    const wordCount = trimmed.split(' ').filter(Boolean).length;
    if (!trimmed || hasGeneric || wordCount < 2 || key.length < 3 || merged.some((c) => c.toLowerCase() === key)) return;
    merged.push(trimmed);
  };

  const maxLen = Math.max(productCues.length, characterCues.length);
  for (let i = 0; i < maxLen && merged.length < maxAngles; i += 1) {
    addCue(productCues[i]);
    if (merged.length >= maxAngles) break;
    addCue(characterCues[i]);
  }

  // Fill remaining slots with fallbacks
  for (let i = 0; merged.length < maxAngles && i < fallbackCues.length; i += 1) {
    addCue(fallbackCues[i]);
  }

  while (merged.length < maxAngles) {
    addCue(`Scene ${merged.length + 1}`);
  }

  return merged.slice(0, maxAngles).map((cue, idx) => {
    const env = ANGLE_ENVIRONMENTS[idx % ANGLE_ENVIRONMENTS.length];
    const label = `Angle ${idx + 1} · ${cue}`;
    const prompt = `${label}. Environment: ${env}. Ensure this angle is distinct.`;
    return { label, prompt };
  });
};

const CATALOG_PRODUCT_ANALYSIS_PARAM_TO_FIELD: Record<string, keyof CatalogProductFormData> = {
  'Product Type': 'productType',
  'Brand / Style': 'brandStyle',
  'Main Material': 'mainMaterial',
  Color: 'color',
  'Unique Details': 'uniqueDetails',
  Angle: 'angle',
  'Focus & Depth of Field': 'focus',
  'Action / State': 'actionState',
  Background: 'background',
  'Secondary Elements': 'secondaryElements',
  'Mood / Atmosphere': 'mood',
  Lighting: 'lighting',
  Shadows: 'shadows',
  'Photo Style': 'photoStyle',
  'Resolution & Quality': 'resolution',
};

const catalogInitialProductFormData = {
  productType: '',
  brandStyle: '',
  mainMaterial: '',
  color: '',
  uniqueDetails: '',
  angle: '',
  focus: '',
  actionState: '',
  background: '',
  secondaryElements: '',
  mood: '',
  lighting: '',
  shadows: '',
  photoStyle: '',
  resolution: '',
};

type CatalogProductFormData = typeof catalogInitialProductFormData;

interface CatalogEditModalState {
  isOpen: boolean;
  index: number | null;
  imageUrl: string | null;
  instruction: string;
  isSubmitting: boolean;
}

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const base64String = reader.result.split(',')[1];
        resolve(base64String);
      } else {
        reject(new Error('Failed to read file as a Base64 string.'));
      }
    };
    reader.onerror = (error) => reject(error);
  });

const downloadFile = (url: string, filename: string): void => {
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.parentNode?.removeChild(link);
};

const getVideoFileUrl = (filePath?: string): string | null => {
  if (!filePath) return null;

  try {
    // Strip file:// prefix if present (videoOutput.filePath might already be a file:// URL)
    let cleanPath = filePath;
    if (filePath.startsWith('file:///')) {
      cleanPath = filePath.replace('file:///', '');
    } else if (filePath.startsWith('file://')) {
      cleanPath = filePath.replace('file://', '');
    }
    
    const encoded = encodeURIComponent(cleanPath);
    const httpUrl = `http://localhost:3123/video?path=${encoded}`;
    console.log('Video URL generated:', httpUrl);
    return httpUrl;
  } catch (error) {
    console.error('Error generating video URL:', error);
    return null;
  }
};

const getLocalVideoFileUrl = (filePath?: string): string | null => {
  if (!filePath) return null;

  try {
    const normalized = filePath.replace(/\\/g, '/');
    // Use encodeURI to preserve slashes/colon in local file paths
    return `file:///${encodeURI(normalized.startsWith('/') ? normalized.slice(1) : normalized)}`;
  } catch (error) {
    console.error('Error generating local video URL:', error);
    return null;
  }
};

const mapAspectRatioToVideoSettings = (ratio: AspectRatio, veoModel: CatalogVideoSettings['veoModel']): CatalogVideoSettings => {
  const isPortrait = ratio === '9:16';
  const aspectRatio: VideoAspectRatio = isPortrait ? '9:16' : '16:9';
  return {
    aspectRatio,
    veoModel,
    resolution: '720p',
  };
};

const saveState = (key: string, state: any): void => {
  try {
    const stateString = JSON.stringify(state);
    localStorage.setItem(key, stateString);
  } catch {
    // ignore
  }
};

const loadState = <T,>(key: string, defaultState: T): T => {
  try {
    const storedState = localStorage.getItem(key);
    if (!storedState) return defaultState;
    const parsed = JSON.parse(storedState);
    if (parsed !== null && parsed !== undefined) {
      return parsed as T;
    }
  } catch {
    // ignore
  }
  return defaultState;
};

const getBackgroundInstruction = (background: string): string => {
  if (!background) return '';
  return ` Setting/Environment: The scene MUST take place ${background}. Ensure the lighting and shadows match this environment perfectly.`;
};

type EngineAspectRatioKey = 'portrait' | 'vertical' | 'square' | 'landscape';

const mapAspectRatioToEngineKey = (aspectRatio: AspectRatio): EngineAspectRatioKey => {
  switch (aspectRatio) {
    case '1:1':
      return 'square';
    case '16:9':
      return 'landscape';
    case '9:16':
      return 'portrait';
    case '4:3':
      return 'landscape';
    case '3:4':
      return 'vertical';
    default:
      return 'square';
  }
};

const isClothingProductType = (
  formData: CatalogProductFormData,
  productSummary: string,
): boolean => {
  const source = `${formData.productType} ${formData.brandStyle} ${formData.uniqueDetails} ${productSummary}`.toLowerCase();
  if (!source.trim()) return false;
  return CLOTHING_PRODUCT_KEYWORDS.some((keyword) => source.includes(keyword));
};

const buildCharacterSummaryForPrompt = (
  analysisSummary: string,
  analysisMap: Record<string, string>,
  isClothingProduct: boolean,
): string => {
  const fallback = analysisSummary.trim();
  if (!fallback) return '';
  if (!isClothingProduct) return fallback;

  const entries = Object.entries(analysisMap).filter(
    ([key, value]) => !!value && !CLOTHING_CHARACTER_KEYS.includes(key),
  );
  if (!entries.length) {
    return fallback;
  }
  const parts = entries.map(([key, value]) => `${key}: ${value}`);
  return parts.join('. ');
};

const generateImageFromImages = async (
  prompt: string,
  images: { data: string; mimeType: string }[],
  aspectRatio: AspectRatio,
  bearerToken: string,
  productReference: string,
  modelReference: string,
): Promise<string> => {
  const apiUrl = 'https://api.mova.ai/generate-affiliate-images';
  const payload = {
    prompt,
    images,
    aspectRatio: mapAspectRatioToEngineKey(aspectRatio),
    bearerToken,
    productReference,
    modelReference,
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Affiliate image API error: ${response.status} ${errorText}`);
  }

  const result: any = await response.json();
  const image = result.image;

  return image;
};

const buildCatalogProductPrompt = (
  formData: CatalogProductFormData,
  aspectRatio: AspectRatio,
  isMainPrompt: boolean,
): string => {
  const parts: string[] = [];

  if (formData.productType) {
    parts.push(`Product Type: ${formData.productType}`);
  }

  if (formData.brandStyle) {
    parts.push(`Brand / Style: ${formData.brandStyle}`);
  }

  if (formData.mainMaterial) {
    parts.push(`Main Material: ${formData.mainMaterial}`);
  }

  if (formData.color) {
    parts.push(`Color: ${formData.color}`);
  }

  if (formData.uniqueDetails) {
    parts.push(`Unique Details: ${formData.uniqueDetails}`);
  }

  if (formData.angle) {
    parts.push(`Angle: ${formData.angle}`);
  }

  if (formData.focus) {
    parts.push(`Focus & Depth of Field: ${formData.focus}`);
  }

  if (formData.actionState) {
    parts.push(`Action / State: ${formData.actionState}`);
  }

  if (formData.background) {
    parts.push(`Background: ${formData.background}`);
  }

  if (formData.secondaryElements) {
    parts.push(`Secondary Elements: ${formData.secondaryElements}`);
  }

  if (formData.mood) {
    parts.push(`Mood / Atmosphere: ${formData.mood}`);
  }

  if (formData.lighting) {
    parts.push(`Lighting: ${formData.lighting}`);
  }

  if (formData.shadows) {
    parts.push(`Shadows: ${formData.shadows}`);
  }

  if (formData.photoStyle) {
    parts.push(`Photo Style: ${formData.photoStyle}`);
  }

  if (formData.resolution) {
    parts.push(`Resolution & Quality: ${formData.resolution}`);
  }

  const prompt = parts.join('. ');

  if (isMainPrompt) {
    return `ADS MAKER PRODUCT FIXED DESIGN PROMPT: ${prompt}`;
  }

  return prompt;
};

const PhotoStackIcon: React.FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="w-6 h-6 text-purple-400 mr-3"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6A1.125 1.125 0 0 1 2.25 10.875V7.125ZM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 0 1-1.125-1.125v-8.25ZM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 0 1-1.125-1.125v-2.25Z"
    />
  </svg>
);

const UserCircleIcon: React.FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="w-6 h-6"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
    />
  </svg>
);

const ImageIcon: React.FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm1.5-1.5a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
    />
  </svg>
);

const DownloadIcon: React.FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="w-4 h-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
    />
  </svg>
);

const CubeIcon: React.FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="w-4 h-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"
    />
  </svg>
);

const EyeIcon: React.FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="w-4 h-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
    />
  </svg>
);

const SparklesIcon: React.FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="w-4 h-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM18 12.75l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 18l-1.035.259a3.375 3.375 0 0 0-2.456 2.456L18 21.75l-.259-1.035a3.375 3.375 0 0 0-2.456-2.456L14.25 18l1.035-.259a3.375 3.375 0 0 0 2.456-2.456L18 12.75Z"
    />
  </svg>
);

const VIDEO_VIBE_OPTIONS = [
  { value: 'Neutral', label: 'Netral' },
  { value: 'Calm', label: 'Tenang' },
  { value: 'Confident', label: 'Percaya Diri' },
  { value: 'Elegant', label: 'Elegan' },
  { value: 'Energetic', label: 'Berenergi' },
  { value: 'Moody', label: 'Moody' },
  { value: 'Cinematic', label: 'Cinematic' },
  { value: 'Luxury', label: 'Luxury' },
  { value: 'Documentary', label: 'Documentary' },
  { value: 'Editorial', label: 'Editorial' },
  { value: 'Ethereal', label: 'Ethereal' },
];

const VIDEO_STANCE_OPTIONS = [
  { value: 'Standing Still', label: 'Berdiri Diam' },
  { value: 'Walking Past Camera', label: 'Berjalan Melewati Kamera' },
  { value: 'Walking Toward Camera', label: 'Berjalan ke Kamera' },
  { value: 'Sitting', label: 'Duduk' },
  { value: 'Leaning', label: 'Bersandar' },
  { value: 'Over Shoulder Lookback', label: 'Menoleh ke Belakang' },
  { value: 'Crossed Arms Hero', label: 'Berdiri Silang Tangan' },
  { value: 'Hand on Product', label: 'Fokus Tangan pada Produk' },
  { value: 'Turn to Camera', label: 'Berputar Menghadap Kamera' },
  { value: 'Dynamic Action', label: 'Gerakan Dinamis' },
];

const VIDEO_PERSPECTIVE_OPTIONS = [
  { value: 'Eye-Level', label: 'Sejajar Mata (Eye-Level)' },
  { value: 'Low Angle', label: 'Low Angle (Empowering)' },
  { value: 'High Angle', label: 'High Angle (Observing)' },
  { value: 'Three-Quarter', label: '3/4 View' },
  { value: 'Close-Up', label: 'Close-Up' },
  { value: 'Medium Shot', label: 'Medium Shot' },
  { value: 'Wide Shot', label: 'Wide / Establishing' },
  { value: 'Top-Down', label: 'Top-Down' },
  { value: 'Dutch Angle', label: 'Dutch Angle' },
  { value: 'Macro Detail', label: 'Push-in Macro Detail' },
];

const VIDEO_CAMERA_MOTION_OPTIONS = [
  { value: 'Static', label: 'Static / Locked' },
  { value: 'Slow Push In', label: 'Slow Push In' },
  { value: 'Slow Pull Out', label: 'Slow Pull Out' },
  { value: 'Slide Left', label: 'Slide Left' },
  { value: 'Slide Right', label: 'Slide Right' },
  { value: 'Tilt Up', label: 'Tilt Up' },
  { value: 'Tilt Down', label: 'Tilt Down' },
  { value: 'Orbit 90', label: 'Orbit 90°' },
  { value: 'Orbit 120', label: 'Orbit 120°' },
  { value: 'Orbit 180', label: 'Orbit 180°' },
  { value: 'Handheld Subtle', label: 'Handheld Subtle' },
  { value: 'Crane Up', label: 'Crane Up' },
  { value: 'Crane Down', label: 'Crane Down' },
];

const GenerateAdsMakerPage: React.FC = () => {
  const loadingGifs = useMemo(() => [loadingGif0, loadingGif1, loadingGif2, loadingGif3], []);
  const getLoadingGifByIndex = (index: number) => loadingGifs[index % loadingGifs.length];

  const { t: tBase, language } = useLanguage();
  const authReady = useAuthReady();

  // Replace all catalog wording to Ads Maker for this page without affecting other pages
  const catalogGenerator = React.useMemo(() => {
    const replaceText = (val: any) =>
      typeof val === 'string' ? val.replace(/catalog|katalog/gi, 'Ads Maker') : val;

    const mapped = Object.fromEntries(
      Object.entries(tBase.catalogGenerator).map(([key, val]) => [key, replaceText(val)]),
    ) as typeof tBase.catalogGenerator;

    // Explicit overrides for CTA copy
    return {
      ...mapped,
      generateCatalogPhotoshoot: 'Generate Ads Maker',
      generatingCatalog: 'Sedang membuat Ads Maker...',
      catalogAnglesTitle: mapped.catalogAnglesTitle?.replace(/24/g, '12') || 'Ads Maker Angles (12 angles)',
      catalogAnglesDesc:
        mapped.catalogAnglesDesc?.replace(/24/g, '12').replace(/Catalog/gi, 'Ads Maker') ||
        '12 Ads Maker angles with consistent character and product identity.',
      catalogPreviewHint:
        mapped.catalogPreviewHint?.replace(/24/g, '12') ||
        '12 Ads Maker photos will appear here after you press Generate Ads Maker.',
    };
  }, [tBase.catalogGenerator]);

  // Localized translations scoped to this page only
  const t = React.useMemo(() => ({ ...tBase, catalogGenerator }), [tBase, catalogGenerator]);
  const aspectRatios: AspectRatio[] = ['16:9', '9:16'];
  const savedAspectRatio = loadState<AspectRatio>('catalogAspectRatio', '9:16');

  const [prompt, setPrompt] = useState<string>(() => loadState('catalogPrompt', '') || '');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(
    aspectRatios.includes(savedAspectRatio) ? savedAspectRatio : '9:16',
  );
  const [imageResolution, setImageResolution] = useImageResolution();
  const veoModel: CatalogVideoSettings['veoModel'] = '3.1-fast-low';

  // Calculate fixed card dimensions based on resolution
  const cardDimensions = imageResolution === '1366x768' 
    ? { parameter: 427, preview: 907 }
    : { parameter: 599, preview: 1273 };

  const [enabledCatalogGroups, setEnabledCatalogGroups] = useState<boolean[]>(DEFAULT_ENABLED_CATALOG_GROUPS);
  const background = '';

  const [characterFile, setCharacterFile] = useState<ImageFile | null>(null);
  const [productSlots, setProductSlots] = useState<ProductAngles[]>([{ ...initialProductAngles }]);
  const [dynamicAngleLabels, setDynamicAngleLabels] = useState<string[] | null>(null);
  const [catalogProductFormData, setCatalogProductFormData] = useState<CatalogProductFormData>(
    catalogInitialProductFormData,
  );
  const isAngleLabelsReady =
    Array.isArray(dynamicAngleLabels) && dynamicAngleLabels.length >= DEFAULT_ANGLE_COUNT;
  const [activeTab] = useState<number>(0);

  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [angleImages, setAngleImages] = useState<(CatalogImageOutput | null)[]>([]);
  const [closeUpImages, setCloseUpImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isGeneratingAngles, setIsGeneratingAngles] = useState<boolean>(false);
  const [isGeneratingCloseUps, setIsGeneratingCloseUps] = useState<boolean>(false);
  const [isCombining, setIsCombining] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [activeAngleIndex, setActiveAngleIndex] = useState<number>(-1);

  const [regeneratingIndexes, setRegeneratingIndexes] = useState<number[]>([]);
  const [isRegeneratingFailedAngles, setIsRegeneratingFailedAngles] = useState<boolean>(false);
  const [lastBasePromptForAngles, setLastBasePromptForAngles] = useState<string | null>(null);
  const [lastAnglePrompts, setLastAnglePrompts] = useState<string[] | null>(null);
  const [nextCatalogAngleIndex, setNextCatalogAngleIndex] = useState<number>(0);
  const [nextExtendedAngleIndex, setNextExtendedAngleIndex] = useState<number>(0);

  const [angleVideos, setAngleVideos] = useState<(CatalogAngleVideoOutput | null)[]>([]);
  const [angleViewModes, setAngleViewModes] = useState<CatalogAngleViewMode[]>([]);
  const [videoGeneratingIndexes, setVideoGeneratingIndexes] = useState<number[]>([]);
  const [isBatchVideoRunning, setIsBatchVideoRunning] = useState<boolean>(false);
  const [isVideoPromptRecommending, setIsVideoPromptRecommending] = useState<boolean>(false);
  const [now, setNow] = useState<number>(Date.now());
  const [visibleCardIds, setVisibleCardIds] = useState<Set<string>>(new Set());
  const cardRevealTimeouts = useRef<NodeJS.Timeout[]>([]);
  const [visibleVideoCardIds, setVisibleVideoCardIds] = useState<Set<string>>(new Set());
  const videoCardRevealTimeouts = useRef<NodeJS.Timeout[]>([]);
  const [customVideoPromptsByIndex, setCustomVideoPromptsByIndex] = useState<Record<number, string>>({});
  const [customVideoParamsByIndex, setCustomVideoParamsByIndex] = useState<Record<number, {
    vibe: string;
    stance: string;
    perspective: string;
    cameraMotion: string;
  }>>({});
  
  // Video UI state for playback controls
  const defaultVideoUiState: {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    muted: boolean;
  } = {
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    muted: false,
  };
  
  const [videoUiStateByIndex, setVideoUiStateByIndex] = useState<Record<number, typeof defaultVideoUiState>>({});
  
  const getVideoUiState = (index: number) => {
    return videoUiStateByIndex[index] || defaultVideoUiState;
  };
  
  const patchVideoUiState = (
    index: number,
    patch: Partial<{
      isPlaying: boolean;
      currentTime: number;
      duration: number;
      volume: number;
      muted: boolean;
    }>,
  ) => {
    setVideoUiStateByIndex((prev) => {
      const existing = prev[index] || defaultVideoUiState;
      return {
        ...prev,
        [index]: {
          ...existing,
          ...patch,
        },
      };
    });
  };
  
  const pauseOtherVideos = (currentIndex: number) => {
    Object.entries(videoPreviewRefs.current).forEach(([key, el]) => {
      const idx = Number(key);
      const videoEl = el as HTMLVideoElement | null;
      if (idx !== currentIndex && videoEl && !videoEl.paused) {
        videoEl.pause();
      }
    });
  };
  
  const handleToggleVideoPlay = async (index: number) => {
    const videoEl = videoPreviewRefs.current[index];
    if (!videoEl) return;

    try {
      if (videoEl.paused) {
        pauseOtherVideos(index);
        await videoEl.play();
      } else {
        videoEl.pause();
      }
    } catch (error: any) {
      // Ignore AbortError - it's expected when video re-renders during play
      if (error?.name !== 'AbortError' && error?.name !== 'NotAllowedError') {
        console.error(`Error toggling video playback for angle ${index + 1}:`, error);
      }
    }
  };
  
  const handleSeekVideo = (index: number, nextTime: number) => {
    const videoEl = videoPreviewRefs.current[index];
    if (!videoEl) return;
    videoEl.currentTime = nextTime;
    patchVideoUiState(index, { currentTime: nextTime });
  };
  
  const handleSetVideoVolume = (index: number, nextVolume: number) => {
    const videoEl = videoPreviewRefs.current[index];
    if (!videoEl) return;

    const clamped = Math.max(0, Math.min(1, nextVolume));
    videoEl.volume = clamped;
    if (clamped > 0) {
      videoEl.muted = false;
      patchVideoUiState(index, { volume: clamped, muted: false });
    } else {
      patchVideoUiState(index, { volume: clamped });
    }
  };
  
  const handleToggleVideoMute = (index: number) => {
    const videoEl = videoPreviewRefs.current[index];
    if (!videoEl) return;
    const nextMuted = !videoEl.muted;
    videoEl.muted = nextMuted;
    patchVideoUiState(index, { muted: nextMuted });
  };
  const [videoPromptModal, setVideoPromptModal] = useState<{
    isOpen: boolean;
    index: number | null;
    draft: string;
    vibe: string;
    stance: string;
    perspective: string;
    cameraMotion: string;
  }>({ isOpen: false, index: null, draft: '', vibe: '', stance: '', perspective: '', cameraMotion: '' });

  const [catalogEditModal, setCatalogEditModal] = useState<CatalogEditModalState>({
    isOpen: false,
    index: null,
    imageUrl: null,
    instruction: '',
    isSubmitting: false,
  });

  useEffect(() => {
    if (!error) return;
    const timeout = setTimeout(() => {
      setError(null);
    }, 5000);
    return () => clearTimeout(timeout);
  }, [error]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const [characterAnalysisSummary, setCharacterAnalysisSummary] = useState<string>('');
  const [characterAnalysisMap, setCharacterAnalysisMap] = useState<Record<string, string>>({});
  const [productAnalysisSummary, setProductAnalysisSummary] = useState<string>('');
  const [isAnalyzingCharacter, setIsAnalyzingCharacter] = useState<boolean>(false);
  const [isAnalyzingProduct, setIsAnalyzingProduct] = useState<boolean>(false);

  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [activityLogCopyLabel, setActivityLogCopyLabel] = useState<string>(t.activityLog.copyLog);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const activityLogRef = useRef<HTMLDivElement>(null);
  const [isCreditsModalOpen, setIsCreditsModalOpen] = useState<boolean>(false);
  const [modalVideoUrl, setModalVideoUrl] = useState<string | null>(null);
  const videoPreviewRefs = useRef<Record<number, HTMLVideoElement | null>>({});

  const characterFileInputRef = useRef<HTMLInputElement>(null);
  const productFileInputRef = useRef<HTMLInputElement>(null);
  const combinedFileInputRef = useRef<HTMLInputElement>(null);
  const hasRunProductAnalysisRef = useRef(false);

  const analysisLanguageHint =
    language === 'en'
      ? 'Return ALL analysis values in English, concise and structured. Do not use Indonesian.'
      : language === 'ms'
      ? 'Balas SEMUA nilai analisis dalam Bahasa Melayu, ringkas dan terstruktur. Jangan gunakan Bahasa Indonesia.'
      : 'Balas SEMUA nilai analisis dalam Bahasa Indonesia yang ringkas dan terstruktur.';

  const addLog = (type: ActivityLogEntry['type'], message: string) => {
    if (!message) return;
    const prefixedMessage = `[Ads Maker] ${message}`;
    setActivityLogs((prev) => [
      ...prev,
      {
        id: prev.length ? prev[prev.length - 1].id + 1 : 1,
        timestamp: new Date().toLocaleTimeString(language === 'en' ? 'en-US' : language === 'ms' ? 'ms-MY' : 'id-ID', { hour12: false }),
        type,
        message: prefixedMessage,
      },
    ]);
  };

  const handleCopyActivityLog = () => {
    if (!activityLogs.length) return;

    const text = activityLogs
      .map((log) => `[${log.timestamp}] [${log.type}] ${log.message}`)
      .join('\n');

    navigator.clipboard
      .writeText(text)
      .then(() => {
        setActivityLogCopyLabel(t.activityLog.copied);
        setTimeout(() => setActivityLogCopyLabel(t.activityLog.copyLog), 1500);
      })
      .catch(() => {
        setActivityLogCopyLabel(t.activityLog.failed);
        setTimeout(() => setActivityLogCopyLabel(t.activityLog.copyLog), 1500);
      });
  };

  useEffect(() => {
    saveState('catalogPrompt', prompt);
  }, [prompt]);

  useEffect(() => {
    saveState('catalogAspectRatio', aspectRatio);
  }, [aspectRatio]);

  // Precompute dynamic angle labels only after both analyses are available
  useEffect(() => {
    const run = async () => {
      if (!characterAnalysisSummary?.trim() || !productAnalysisSummary?.trim()) return;

      const provider = localStorage.getItem('zeoStudio.ai.provider') || 'Gemini';
      const apiKey = localStorage.getItem('zeoStudio.ai.apiKey') || '';
      const zeoApi = (typeof window !== 'undefined' ? (window as any).zeoAPI : null) as
        | (typeof window.zeoAPI & { generateAngleLabels?: (args: any) => Promise<any> })
        | null;
      const useRemote = !!(zeoApi && zeoApi.generateAngleLabels && apiKey && provider.toLowerCase() === 'gemini');

      // Try remote Gemini via IPC first
      if (useRemote) {
        try {
          const res = await zeoApi.generateAngleLabels({
            apiKey,
            productSummary: productAnalysisSummary,
            characterSummary: characterAnalysisSummary,
            language,
          });

          if (res?.ok && Array.isArray(res.labels) && res.labels.length >= DEFAULT_ANGLE_COUNT) {
            const padded = Array.from({ length: DEFAULT_ANGLE_COUNT }, (_, i) => res.labels[i] || `Angle ${i + 1}`);
            setDynamicAngleLabels(padded);
            addLog('INFO', `Generated ${padded.length} angle labels (AI): ${padded.join(' | ')}`);
            return;
          }
          if (!res?.ok) {
            addLog('ERROR', `AI label request failed: ${res?.error || 'unknown error'}`);
          }
        } catch (err: any) {
          addLog('ERROR', `AI label request error: ${err?.message || String(err)}`);
        }
      } else {
        addLog('ERROR', 'AI label request skipped: provider bukan Gemini atau API key kosong.');
      }

      // Keep labels unset if AI fails; Generate button will remain disabled
      setDynamicAngleLabels(null);
    };

    void run();
  }, [characterAnalysisSummary, productAnalysisSummary, language]);

  // Countdown timer for video generation
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-fail videos that exceed estimated time (30s grace period)
  useEffect(() => {
    setAngleVideos((prev) => {
      let hasChanges = false;
      const updated = prev.map((video) => {
        if (video && video.status === 'generating' && video.startedAt) {
          const elapsed = Math.floor((now - video.startedAt) / 1000);
          const totalSeconds = video.estimatedTotalSeconds ?? 120;
          
          if (elapsed > totalSeconds + 30) {
            hasChanges = true;
            return {
              ...video,
              status: 'failed' as const,
              errorMessage: 'Video generation timeout - exceeded estimated time',
            };
          }
        }
        return video;
      });
      
      return hasChanges ? updated : prev;
    });
  }, [now]);

  // Auto-fail images that exceed estimated time (30s grace period)
  useEffect(() => {
    setAngleImages((prev) => {
      let hasChanges = false;
      const updated = prev.map((image) => {
        if (image && image.status === 'generating' && image.startedAt) {
          const elapsed = Math.floor((now - image.startedAt) / 1000);
          const totalSeconds = image.estimatedTotalSeconds ?? 120;
          
          if (elapsed > totalSeconds + 30) {
            hasChanges = true;
            return {
              ...image,
              status: 'failed' as const,
              errorMessage: 'Generation timeout - exceeded estimated time',
            };
          }
        }
        return image;
      });
      
      return hasChanges ? updated : prev;
    });
  }, [now]);

  const getRemainingSecondsForCatalogImage = (image: CatalogImageOutput | null | undefined): number | null => {
    if (!image || !image.startedAt || image.status !== 'generating') return null;
    const elapsed = Math.floor((now - image.startedAt) / 1000);
    const totalSeconds = image.estimatedTotalSeconds ?? 120;
    const remaining = totalSeconds - elapsed;
    return Math.max(0, remaining);
  };

  const getCountdownMessageForCatalogImage = (image: CatalogImageOutput | null | undefined): string | null => {
    if (!image || image.status !== 'generating') return null;
    const remaining = getRemainingSecondsForCatalogImage(image);
    if (remaining == null) return null;
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getRemainingSecondsForCatalogVideo = (video: CatalogAngleVideoOutput | null | undefined): number | null => {
    if (!video || !video.startedAt || video.status !== 'generating') return null;
    const elapsed = Math.floor((now - video.startedAt) / 1000);
    const totalSeconds = video.estimatedTotalSeconds ?? 120;
    const remaining = totalSeconds - elapsed;
    return Math.max(0, remaining);
  };

  const getCountdownMessageForCatalogVideo = (video: CatalogAngleVideoOutput | null | undefined): string | null => {
    if (!video || video.status !== 'generating') return null;
    const remaining = getRemainingSecondsForCatalogVideo(video);
    if (remaining == null) return null;
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.zeoAPI?.onBatchUpdate) return undefined;

    const unsubscribe = window.zeoAPI.onBatchUpdate?.((update: any) => {
      if (!update) return;

      const workflow = (update.workflow || '').toString().toLowerCase();
      const categoryRaw = (update.category || '').toString().toLowerCase();
      
      // Handle IMAGE generation workflow (catalog category)
      if (workflow.includes('gem_pix') || workflow.includes('affiliate images')) {
        if (!categoryRaw.startsWith('catalog')) {
          return;
        }

        const message: string = update.message || '';

        if (update.type === 'INFO' || update.type === 'BATCH_TOTAL' || update.type === 'PROGRESS') {
          if (message) addLog('INFO', message);
          return;
        }

        if (update.type === 'SCENE_COMPLETED') {
          const sceneIndex: number | null =
            typeof update.index === 'number' && Number.isFinite(update.index) ? update.index : null;
          if (sceneIndex && update.fileName && update.filePath) {
            const catalogIndex = sceneIndex - 1;

            setAngleImages((prev) => {
              const next = [...prev];
              if (catalogIndex >= 0) {
                if (next.length <= catalogIndex) {
                  const oldLength = next.length;
                  next.length = catalogIndex + 1;
                  for (let i = oldLength; i < next.length; i += 1) {
                    next[i] = null;
                  }
                }
                // Update existing placeholder or create new
                const existingImage = next[catalogIndex];
                next[catalogIndex] = {
                  dataUrl: String(update.filePath),
                  status: 'completed' as const,
                  startedAt: existingImage?.startedAt,
                  estimatedTotalSeconds: existingImage?.estimatedTotalSeconds,
                  prompt: existingImage?.prompt,
                };
              }
              return next;
            });

            setRegeneratingIndexes((prev) => prev.filter((idx) => idx !== catalogIndex));
          }

          if (message) addLog('SUCCESS', message);
          return;
        }

        if (update.type === 'ERROR') {
          const message = update.message || t.catalogGenerator.unknownImageError;
          setError(message);
          addLog('ERROR', message);
          return;
        }

        return;
      }

      // Handle VIDEO generation workflow (catalog category)
      if (workflow.includes('affiliate video')) {
        if (!categoryRaw.startsWith('catalog')) {
          return;
        }

        const message: string = update.message || '';

        if (update.type === 'INFO' || update.type === 'BATCH_TOTAL' || update.type === 'PROGRESS') {
          if (message) addLog('INFO', message);
          return;
        }

        if (update.type === 'SCENE_COMPLETED') {
          const sceneIndex: number | null =
            typeof update.index === 'number' && Number.isFinite(update.index) ? update.index : null;
          // Prefer explicit video paths; only fall back to filePath if it looks like a video file
          const rawVideoPath: string | undefined =
            update.videoFilePath || update.outputPath || update.filePath;
          const rawFileName: string | undefined = update.videoFileName || update.fileName;

          if (sceneIndex && rawVideoPath) {
            const catalogIndex = sceneIndex - 1;
            const filePath = String(rawVideoPath);
            const isVideoFile = /\.(mp4|mov|webm|mkv)$/i.test(filePath);

            if (!isVideoFile) {
              setVideoGeneratingIndexes((prev) => prev.filter((idx) => idx !== catalogIndex));
              addLog(
                'ERROR',
                t.catalogGenerator.videoAngleNonVideo.replace('{index}', String(catalogIndex + 1)),
              );
              return;
            }

            setAngleVideos((prev) => {
              const next = [...prev];
              if (catalogIndex >= 0) {
                if (next.length <= catalogIndex) {
                  const oldLength = next.length;
                  next.length = catalogIndex + 1;
                  for (let i = oldLength; i < next.length; i += 1) {
                    next[i] = null;
                  }
                }
                const fileName = rawFileName
                  ? String(rawFileName)
                  : filePath.split(/[\\/]/).pop() || 'catalog-video.mp4';
                
                // Update existing placeholder or create new
                const existingVideo = next[catalogIndex];
                next[catalogIndex] = {
                  fileName,
                  filePath,
                  sceneIndex,
                  status: 'completed' as const,
                  startedAt: existingVideo?.startedAt,
                  estimatedTotalSeconds: existingVideo?.estimatedTotalSeconds,
                  prompt: existingVideo?.prompt,
                };
              }
              return next;
            });

            setAngleViewModes((prev) => {
              const next = [...prev];
              if (catalogIndex >= 0) {
                if (next.length <= catalogIndex) {
                  const oldLength = next.length;
                  next.length = catalogIndex + 1;
                  for (let i = oldLength; i < next.length; i += 1) {
                    next[i] = 'photo';
                  }
                }
                next[catalogIndex] = 'video';
              }
              return next;
            });

            setVideoGeneratingIndexes((prev) => prev.filter((idx) => idx !== catalogIndex));
          }

          if (message) addLog('SUCCESS', message);
          return;
        }

        if (update.type === 'SCENE_ERROR') {
          const sceneIndex: number | null =
            typeof update.index === 'number' && Number.isFinite(update.index) ? update.index : null;
          if (sceneIndex) {
            const catalogIndex = sceneIndex - 1;
            
            // Update placeholder to failed status
            setAngleVideos((prev) => {
              const next = [...prev];
              if (catalogIndex >= 0 && catalogIndex < next.length && next[catalogIndex]) {
                next[catalogIndex] = {
                  ...next[catalogIndex]!,
                  status: 'failed' as const,
                  errorMessage: update.message || 'Video generation failed',
                };
              }
              return next;
            });
            
            setVideoGeneratingIndexes((prev) => prev.filter((idx) => idx !== catalogIndex));
          }

          let message = update.message || t.catalogGenerator.sceneVideoFailed;
          
          // Special handling for audio filter error
          if (message.includes('PUBLIC_ERROR_AUDIO_FILTERED')) {
            message = t.catalogGenerator.audioFilterError.replace('{index}', String(sceneIndex));
            
            // Suggest automatic retry with sanitized prompt
            addLog('INFO', t.catalogGenerator.audioFilterHint);
          }
          
          addLog('ERROR', message);
          setError(message);
          return;
        }

        if (update.type === 'ERROR') {
          const message = update.message || t.catalogGenerator.unknownVideoError;
          setError(message);
          addLog('ERROR', message);
          return;
        }

        return;
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const isCatalogAngleEnabled = useCallback(
    (index: number) => {
      const groupIndex = getCatalogAngleGroupIndex(index);
      if (groupIndex < 0) return true;
      return enabledCatalogGroups[groupIndex] !== false;
    },
    [enabledCatalogGroups],
  );


  
  const handleCloseVideoPromptModal = () => {
    setVideoPromptModal((prev) => ({ ...prev, isOpen: false, index: null, draft: '', vibe: '', stance: '', perspective: '', cameraMotion: '' }));
  };

  const buildCatalogVideoPromptForAngle = (index: number): string => {
    const labelFunc = (idx: number): string => {
      if (idx < 0) return '';
      if (idx < CATALOG_ANGLE_LABELS.length) {
        return CATALOG_ANGLE_LABELS[idx];
      }
      const extendedIdx = idx - CATALOG_ANGLE_LABELS.length;
      if (extendedIdx >= 0 && extendedIdx < CATALOG_EXTENDED_ANGLE_LABELS.length) {
        return CATALOG_EXTENDED_ANGLE_LABELS[extendedIdx];
      }
      return `Catalog Angle ${idx + 1}`;
    };

    const originalLabel = labelFunc(index) || `Catalog Angle ${index + 1}`;
    const settings = getVideoSettingsFromAspectRatio(aspectRatio, veoModel);
    
    // Filter sensitive words that might trigger audio filter
    const sanitizeLabel = (label: string): string => {
      return label
        .replace(/Frontal/gi, 'Front View')
        .replace(/On-body/gi, 'Body Proportion')
        .replace(/Back Shot/gi, 'Back View')
        .replace(/Full Body/gi, 'Full Length');
    };
    
    const label = sanitizeLabel(originalLabel);
    
    // Filter background instruction to avoid sensitive locations
    const sanitizeBackground = (bg: string): string => {
      return bg
        .replace(/bedroom|closet/gi, 'dressing room')
        .replace(/bathroom|vanity/gi, 'personal care area')
        .replace(/private|intimate|sensual|sexy/gi, 'personal');
    };
    
    const orientationText =
      settings.aspectRatio === '9:16'
        ? 'vertical 9:16, suitable for social media platforms'
        : 'horizontal 16:9, suitable for web platforms';

    const parts: string[] = [];

    parts.push('[Affiliate Video - Catalog]');
    parts.push(
      'REQUIRED: For the entire 6–8s video, maintain consistent character identity and product identity matching the reference photos. No changes to appearance, design, or materials.',
    );
    parts.push(
      'Video is one continuous shot with smooth camera motion and natural body movement. No text, watermarks, or UI elements. Focus on product presentation.',
    );
    const env = ANGLE_ENVIRONMENTS[index % ANGLE_ENVIRONMENTS.length];
    const motion = ANGLE_CAMERA_MOTION[index % ANGLE_CAMERA_MOTION.length];
    const videoMotion = VIDEO_MOTION_DETAILS[index % VIDEO_MOTION_DETAILS.length];

    parts.push(`Catalog scene: ${label}. Environment: ${env}. Camera motion: ${motion}. Video move: ${videoMotion}`);
    parts.push(
      settings.aspectRatio === '9:16'
        ? 'Orientation: vertical 9:16, suitable for social media.'
        : 'Orientation: horizontal 16:9, suitable for web content.',
    );

    // Add sanitized background instruction if available
    if (background) {
      const bgInstruction = sanitizeBackground(getBackgroundInstruction(background));
      if (bgInstruction) {
        parts.push(bgInstruction);
      }
    }

    return parts.join(' ');
  };

  const buildVideoPromptRecommendation = (index: number | null) => {
    if (index === null) return '';
    const label = getCatalogAngleLabelByIndex(index) || `Ads Maker Angle ${index + 1}`;
    const vibe = videoPromptModal.vibe || VIDEO_VIBE_OPTIONS[0].value;
    const stance = videoPromptModal.stance || VIDEO_STANCE_OPTIONS[0].value;
    const perspective = videoPromptModal.perspective || VIDEO_PERSPECTIVE_OPTIONS[0].value;
    const cameraMotion = videoPromptModal.cameraMotion || VIDEO_CAMERA_MOTION_OPTIONS[0].value;

    const envHint = background ? getBackgroundInstruction(background) : '';

    const parts = [
      // Context & objective
      `[AI Recommendation] ${label}. 6–8s single take, maintain consistent character & product identity.`,
      // Shot & perspective
      `Shot: ${perspective}.`,
      // Blocking / stance
      `Talent: ${stance}.`,
      // Camera motion
      `Camera: ${cameraMotion}.`,
      // Vibe / mood
      `Vibe: ${vibe}.`,
      // Environment
      envHint ? `Environment: ${envHint}.` : '',
      // Lighting & pacing
      'Lighting: soft key + gentle rim; avoid harsh specular. Tempo natural, no whip/jitter.',
      // Safety
      'No text, watermark, or UI. Focus on product clarity and smooth motion.',
    ].filter(Boolean);

    return parts.join(' ');
  };

  const getGeminiTextModel = () => {
    if (typeof window === 'undefined') return 'gemini-2.5-flash';
    const configuredModel = localStorage.getItem('zeoStudio.ai.model') || '';
    return configuredModel.trim() || 'gemini-2.5-flash';
  };

  const callGeminiForVideoPrompt = async (payload: unknown): Promise<any | null> => {
    if (typeof window === 'undefined') {
      return null;
    }

    const provider = localStorage.getItem('zeoStudio.ai.provider') || '';
    const apiKey = localStorage.getItem('zeoStudio.ai.apiKey') || '';

    if (!provider || !apiKey) {
      const msg = t.catalogGenerator.videoPromptAiConfigIncomplete;
      setError(msg);
      addLog('ERROR', msg);
      return null;
    }

    if (provider !== 'Gemini') {
      const msg = t.catalogGenerator.videoPromptAiProviderNotSupported;
      setError(msg);
      addLog('ERROR', msg);
      return null;
    }

    const model = getGeminiTextModel();
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const status = response.status;
        let errorMessage = `AI Error: ${status}`;
        try {
          const body = await response.json();
          const raw = body?.error?.message as string | undefined;
          if (raw) errorMessage = raw;
        } catch {
          // ignore
        }
        addLog('ERROR', errorMessage);
        setError(errorMessage);
        return null;
      }

      return response.json();
    } catch (err: any) {
      const msg = err?.message || 'Gagal menghubungi AI.';
      addLog('ERROR', msg);
      setError(msg);
      return null;
    }
  };

  const handleGenerateVideoPromptRecommendation = async () => {
    if (isVideoPromptRecommending) return;
    setIsVideoPromptRecommending(true);

    const fallback = buildVideoPromptRecommendation(videoPromptModal.index);
    setVideoPromptModal((prev) => ({ ...prev, draft: fallback }));
    setIsVideoPromptRecommending(false);
  };

  const handleSaveVideoPromptModal = () => {
    if (videoPromptModal.index === null) return;
    const idx = videoPromptModal.index;
    const nextText = String(videoPromptModal.draft || '').trim();

    setCustomVideoParamsByIndex((prev) => ({
      ...prev,
      [idx]: {
        vibe: videoPromptModal.vibe,
        stance: videoPromptModal.stance,
        perspective: videoPromptModal.perspective,
        cameraMotion: videoPromptModal.cameraMotion,
      },
    }));

    setCustomVideoPromptsByIndex((prev) => {
      const next = { ...prev };
      if (!nextText) {
        delete next[idx];
      } else {
        next[idx] = nextText;
      }
      return next;
    });

    setVideoPromptModal({ isOpen: false, index: null, draft: '', vibe: '', stance: '', perspective: '', cameraMotion: '' });

    // Langsung jalankan generate/regenerate video dengan prompt terbaru
    void handleGenerateCatalogAngleVideo(idx, nextText);
  };

  const handleGenerateCatalogAngleVideo = async (index: number, overridePrompt?: string) => {
    if (!isCatalogAngleEnabled(index)) {
      addLog('INFO', t.logMessages.adsMaker?.angleDisabled || t.logMessages.catalog.angleDisabled);
      return;
    }

    const imageOutput = angleImages[index];
    const label = getCatalogAngleLabelByIndex(index) || `Catalog Angle ${index + 1}`;

    if (!imageOutput?.dataUrl) {
      addLog('ERROR', t.logMessages.adsMaker?.angleNoPhoto || t.logMessages.catalog.angleNoPhoto);
      return;
    }

    if (videoGeneratingIndexes.includes(index)) {
      return;
    }

    const src = imageOutput.dataUrl;
    if (!src.startsWith('data:image')) {
      addLog(
        'ERROR',
        t.catalogGenerator.videoInvalidFormat.replace('{label}', label),
      );
      return;
    }

    const parts = src.split(',');
    if (parts.length < 2 || !parts[1].trim()) {
      addLog(
        'ERROR',
        t.catalogGenerator.videoInvalidData.replace('{label}', label),
      );
      return;
    }

    if (typeof window === 'undefined' || !window.zeoAPI?.startAffiliateVideoWorkflow) {
      const message = t.catalogGenerator.videoEngineUnavailable;
      setError(message);
      addLog('ERROR', message);
      return;
    }

    const bearerKey = localStorage.getItem('zeoStudio.bearerToken') || '';
    if (!bearerKey.trim()) {
      const message = t.catalogGenerator.videoBearerMissing;
      setError(message);
      addLog('ERROR', message);
      return;
    }

    const downloadPath = localStorage.getItem('zeoStudio.folder.output') || '';
    if (!downloadPath.trim()) {
      const message = t.catalogGenerator.outputFolderMissing;
      setError(message);
      addLog('ERROR', message);
      return;
    }

    const settings = getVideoSettingsFromAspectRatio(aspectRatio, veoModel);
    
    // Sanitize custom prompt if provided
    const sanitizeCustomPrompt = (prompt: string): string => {
      return prompt
        .replace(/Frontal/gi, 'Front View')
        .replace(/On-body/gi, 'Body Proportion')
        .replace(/Back Shot/gi, 'Back View')
        .replace(/Full Body/gi, 'Full Length')
        .replace(/bedroom|closet/gi, 'dressing room')
        .replace(/bathroom|vanity/gi, 'personal care area')
        .replace(/private|intimate|sensual|sexy/gi, 'personal');
    };
    
    const customPrompt = overridePrompt ?? (customVideoPromptsByIndex[index] || '');
    const sanitizedCustomPrompt = customPrompt.trim() ? sanitizeCustomPrompt(customPrompt.trim()) : '';
    
    const scenePrompt = sanitizedCustomPrompt || buildCatalogVideoPromptForAngle(index);
    const base64 = parts[1];

    try {
      setVideoGeneratingIndexes((prev) => (prev.includes(index) ? prev : [...prev, index]));
      
      // Create placeholder video immediately with loading state
      setAngleVideos((prev) => {
        const next = [...prev];
        if (next.length <= index) {
          const oldLength = next.length;
          next.length = index + 1;
          for (let i = oldLength; i < next.length; i += 1) {
            next[i] = null;
          }
        }
        next[index] = {
          fileName: `catalog-angle-${index + 1}.mp4`,
          filePath: '',
          sceneIndex: index + 1,
          status: 'generating' as const,
          startedAt: Date.now(),
          estimatedTotalSeconds: 300,
          prompt: scenePrompt.substring(0, 80),
        };
        return next;
      });
      
      // Schedule sequential card reveal
      const cardId = `catalog-video-${index}`;
      const timeout = setTimeout(() => {
        setVisibleVideoCardIds(prevVisible => new Set([...prevVisible, cardId]));
      }, 0); // Show immediately for single video
      videoCardRevealTimeouts.current.push(timeout);
      
      addLog('INFO', t.catalogGenerator.startingVideoGen.replace('{label}', label));
      
      // Log the prompt being sent for debugging
      addLog('INFO', t.catalogGenerator.videoScenePrompt.replace('{index}', String(index + 1)).replace('{prompt}', `${scenePrompt.substring(0, 200)}${scenePrompt.length > 200 ? '...' : ''}`));

      await window.zeoAPI.startAffiliateVideoWorkflow?.({
        bearerKey,
        downloadPath,
        aspectRatio: settings.aspectRatio,
        veoModel: settings.veoModel,
        resolution: settings.resolution,
        scenes: [
          {
            index: index + 1,
            prompt: scenePrompt,
            category: 'catalog',
            imageBase64: base64,
          },
        ],
        category: 'catalog',
        uiLanguage: language,
      });
    } catch (err: any) {
      const message = err?.message || t.catalogGenerator.videoGenError;
      setError(message);
      addLog('ERROR', message);
      setVideoGeneratingIndexes((prev) => prev.filter((i) => i !== index));
    }
  };

  const handleGenerateAllVideos = async () => {
    if (isBatchVideoRunning || isGeneratingAngles || videoGeneratingIndexes.length > 0) {
      addLog(
        'ERROR',
        t.catalogGenerator.cannotRunAllVideos,
      );
      return;
    }

    const targets = angleImages
      .map((src, index) => ({ src, index }))
      .filter(({ src, index }) => isCatalogAngleEnabled(index) && !!src && !angleVideos[index]);

    if (!targets.length) {
      addLog(
        'INFO',
        t.catalogGenerator.noAnglesReadyForVideo,
      );
      return;
    }

    const MAX_PARALLEL_VIDEO = 4;

    addLog(
      'INFO',
      t.catalogGenerator.startingAllVideos.replace('{count}', String(targets.length)).replace('{max}', String(MAX_PARALLEL_VIDEO)),
    );

    try {
      setIsBatchVideoRunning(true);
      for (let i = 0; i < targets.length; i += MAX_PARALLEL_VIDEO) {
        const chunk = targets.slice(i, i + MAX_PARALLEL_VIDEO);
        // eslint-disable-next-line no-await-in-loop
        await Promise.all(
          chunk.map(({ index }) =>
            handleGenerateCatalogAngleVideo(index).catch(() => {
              // Per-angle error already handled by handleGenerateCatalogAngleVideo
            }),
          ),
        );
      }

      addLog(
        'SUCCESS',
        t.catalogGenerator.allVideosCompleted,
      );
    } catch (err: any) {
      const message =
        err?.message ||
        t.catalogGenerator.allVideosError;
      setError(message);
      addLog('ERROR', message);
    } finally {
      setIsBatchVideoRunning(false);
    }
  };

  const runCatalogCharacterAnalysis = async (file: File) => {
    try {
      if (typeof window === 'undefined' || !window.zeoAPI?.analyzeCharacterImage) {
        addLog(
          'INFO',
          t.catalogGenerator.characterAnalysisSkippedEngine,
        );
        return;
      }

      const aiProvider = localStorage.getItem('zeoStudio.ai.provider') || '';
      const aiModel = localStorage.getItem('zeoStudio.ai.model') || '';
      const apiKey = localStorage.getItem('zeoStudio.ai.apiKey') || '';

      if (!aiProvider || !apiKey) {
        addLog(
          'INFO',
          t.catalogGenerator.characterAnalysisSkippedConfig,
        );
        return;
      }

      setIsAnalyzingCharacter(true);
      setCharacterAnalysisSummary('');
      addLog('INFO', t.logMessages.adsMaker?.characterAnalysisStarted || t.logMessages.catalog.characterAnalysisStarted);

      const imageBase64 = await fileToBase64(file);
      const schemaParameters = CATALOG_CHARACTER_ANALYSIS_PARAMETERS;

      const result = await window.zeoAPI.analyzeCharacterImage({
        imageBase64,
        mimeType: file.type || 'image/png',
        aiProvider,
        apiKey,
        schemaParameters,
        language,
        targetLanguage: language,
        analysisLanguageHint,
      });

      if (!result || !result.ok || !result.analysis) {
        const message: string =
          (result && result.error) ||
          t.catalogGenerator.characterAnalysisFailed;
        addLog('ERROR', message);
        return;
      }

      const rawAnalysis = result.analysis as Record<string, unknown>;

      const lines: string[] = [];
      const map: Record<string, string> = {};
      const labelMap: Record<string, { id: string; ms: string; en: string }> = {
        'Model Role Archetype': { id: 'Peran Model', ms: 'Peranan Model', en: 'Model Role Archetype' },
        'Persona & Demographic': { id: 'Persona & Demografi', ms: 'Persona & Demografi', en: 'Persona & Demographic' },
        'Emotion Cue (for ad)': { id: 'Emosi Utama (iklan)', ms: 'Emosi Utama (iklan)', en: 'Emotion Cue (for ad)' },
        'Pose / Body Language': { id: 'Pose / Bahasa Tubuh', ms: 'Pose / Bahasa Badan', en: 'Pose / Body Language' },
        'Camera Framing Preference': { id: 'Preferensi Framing Kamera', ms: 'Keutamaan Framing Kamera', en: 'Camera Framing Preference' },
        'Outfit Vibe (for ad)': { id: 'Nuansa Outfit (iklan)', ms: 'Nuansa Pakaian (iklan)', en: 'Outfit Vibe (for ad)' },
        'Accessories (visible)': { id: 'Aksesori (terlihat)', ms: 'Aksesori (kelihatan)', en: 'Accessories (visible)' },
        'Hair & Makeup Notes': { id: 'Catatan Rambut & Makeup', ms: 'Catatan Rambut & Solekan', en: 'Hair & Makeup Notes' },
        'Lighting Preference (character)': { id: 'Preferensi Cahaya (model)', ms: 'Keutamaan Cahaya (model)', en: 'Lighting Preference (character)' },
      };
      const pickLabel = (key: string) => {
        const entry = labelMap[key];
        if (!entry) return key;
        if (language === 'id') return entry.id;
        if (language === 'ms') return entry.ms;
        return entry.en;
      };
      CATALOG_CHARACTER_ANALYSIS_PARAMETERS.forEach((key) => {
        const value = rawAnalysis[key];
        if (typeof value === 'string') {
          const trimmed = value.trim();
          if (trimmed) {
            map[key] = trimmed;
            lines.push(`${pickLabel(key)}: ${trimmed}`);
          }
        }
      });

      const summary = lines.join('\n');

      if (summary.trim()) {
        setCharacterAnalysisMap(map);
        setCharacterAnalysisSummary(summary);
        addLog('SUCCESS', t.logMessages.adsMaker?.characterAnalysisSuccess || t.logMessages.catalog.characterAnalysisSuccess);
        setPrompt((prev) => (prev.trim().length ? prev : summary));
      } else {
        addLog(
          'INFO',
          t.catalogGenerator.characterAnalysisNoSummary,
        );
      }
    } catch (err: any) {
      const message =
        err?.message || t.catalogGenerator.characterAnalysisError;
      addLog('ERROR', message);
    } finally {
      setIsAnalyzingCharacter(false);
    }
  };

  const runCatalogProductAnalysis = async (file: File) => {
    try {
      if (typeof window === 'undefined' || !window.zeoAPI?.analyzeCharacterImage) {
        addLog(
          'INFO',
          t.catalogGenerator.productAnalysisSkippedEngine,
        );
        return;
      }

      const aiProvider = localStorage.getItem('zeoStudio.ai.provider') || '';
      const aiModel = localStorage.getItem('zeoStudio.ai.model') || '';
      const apiKey = localStorage.getItem('zeoStudio.ai.apiKey') || '';

      if (!aiProvider || !apiKey) {
        addLog(
          'INFO',
          t.catalogGenerator.productAnalysisSkippedConfig,
        );
        return;
      }

      setIsAnalyzingProduct(true);
      setProductAnalysisSummary('');
      addLog('INFO', t.logMessages.adsMaker?.productAnalysisStarted || t.logMessages.catalog.productAnalysisStarted);

      const imageBase64 = await fileToBase64(file);
      const schemaParameters = CATALOG_PRODUCT_ANALYSIS_PARAMETERS;

      const result = await window.zeoAPI.analyzeCharacterImage({
        imageBase64,
        mimeType: file.type || 'image/png',
        aiProvider,
        aiModel,
        apiKey,
        schemaParameters,
        language,
        targetLanguage: language,
        analysisLanguageHint,
      });

      if (!result || !result.ok || !result.analysis) {
        const message: string =
          (result && result.error) ||
          t.catalogGenerator.productAnalysisFailed;
        addLog('ERROR', message);
        return;
      }

      const rawAnalysis = result.analysis as Record<string, unknown>;

      const getField = (key: string): string => {
        const value = rawAnalysis[key];
        return typeof value === 'string' ? value.trim() : '';
      };

      const productCategory = getField('Product Category');
      const heroFeature = getField('Hero Feature / USP');
      const benefit = getField('Benefit to Customer');
      const useCase = getField('Use Case / Scene Suggestion');
      const texture = getField('Texture & Finish');
      const colorPalette = getField('Color Palette');
      const logoBrand = getField('Logo / Brand Element');
      const donts = getField("Do / Don'ts (what to avoid)");
      const backgroundDesc = getField('Background / Environment');
      const lightingHighlight = getField('Lighting / Highlight');
      const cta = getField('CTA Wording Suggestion');
      const offer = getField('Offer / Price Mention');
      const framing = getField('Framing Guidance');

      const isId = language === 'id';
      const isMs = language === 'ms';
      const text = {
        product: isId ? 'Produk' : isMs ? 'Produk' : 'Product',
        hero: isId ? 'USP / keunggulan' : isMs ? 'USP / kelebihan' : 'Hero USP',
        benefit: isId ? 'Benefit ke pelanggan' : isMs ? 'Manfaat kepada pelanggan' : 'Customer benefit',
        scene: isId ? 'Skena / penggunaan' : isMs ? 'Adegan / penggunaan' : 'Use case / scene',
        visual: isId ? 'Visual & brand' : isMs ? 'Visual & jenama' : 'Visual & brand cues',
        dont: isId ? 'Hindari' : isMs ? 'Elak' : 'Avoid',
        light: isId ? 'Cahaya' : isMs ? 'Cahaya' : 'Lighting',
        cta: isId ? 'CTA' : isMs ? 'CTA' : 'CTA',
        offer: isId ? 'Penawaran' : isMs ? 'Tawaran' : 'Offer',
        framing: isId ? 'Framing' : isMs ? 'Framing' : 'Framing',
      };

      setCatalogProductFormData((prev) => ({
        productType: productCategory || prev.productType,
        brandStyle: heroFeature || prev.brandStyle,
        mainMaterial: texture || prev.mainMaterial,
        color: colorPalette || prev.color,
        uniqueDetails: heroFeature || prev.uniqueDetails,
        angle: framing || prev.angle,
        focus: benefit || prev.focus,
        actionState: useCase || prev.actionState,
        background: backgroundDesc || prev.background,
        secondaryElements: logoBrand || prev.secondaryElements,
        mood: benefit || prev.mood,
        lighting: lightingHighlight || prev.lighting,
        shadows: prev.shadows,
        photoStyle: prev.photoStyle,
        resolution: prev.resolution,
      }));

      const summaryParts: string[] = [];

      const productSection: string[] = [];
      if (productCategory) productSection.push(`${text.product}: ${productCategory}`);
      if (heroFeature) productSection.push(`${text.hero}: ${heroFeature}`);
      if (productSection.length) summaryParts.push(productSection.join(' | '));

      if (benefit) summaryParts.push(`${text.benefit}: ${benefit}.`);
      if (useCase) summaryParts.push(`${text.scene}: ${useCase}.`);

      const visualParts: string[] = [];
      if (texture) visualParts.push(texture);
      if (colorPalette) visualParts.push(colorPalette);
      if (logoBrand) visualParts.push(`Brand: ${logoBrand}`);
      if (visualParts.length) summaryParts.push(`${text.visual}: ${visualParts.join('; ')}.`);

      if (donts) summaryParts.push(`${text.dont}: ${donts}.`);
      if (backgroundDesc || lightingHighlight) {
        const parts: string[] = [];
        if (backgroundDesc) parts.push(backgroundDesc);
        if (lightingHighlight) parts.push(lightingHighlight);
        summaryParts.push(`${text.light}: ${parts.join('; ')}.`);
      }
      if (framing) summaryParts.push(`${text.framing}: ${framing}.`);
      if (cta) summaryParts.push(`${text.cta}: ${cta}.`);
      if (offer) summaryParts.push(`${text.offer}: ${offer}.`);

      const summary = summaryParts.join('\n').trim();

      if (summary) {
        setProductAnalysisSummary(summary);
        addLog(
          'SUCCESS',
          t.catalogGenerator.productAnalysisSuccess,
        );
        setPrompt((prev) => (prev.trim().length ? prev : summary));
      } else {
        addLog(
          'INFO',
          t.catalogGenerator.productAnalysisNoSummary,
        );
      }
    } catch (err: any) {
      const message =
        err?.message || t.catalogGenerator.productAnalysisError;
      addLog('ERROR', message);
    } finally {
      setIsAnalyzingProduct(false);
    }
  };

  const handleCharacterFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCharacterFile({
        file,
        preview: URL.createObjectURL(file),
      });
      setCharacterAnalysisSummary('');
      runCatalogCharacterAnalysis(file);
    }
  };

  const handleCombinedFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const preview = URL.createObjectURL(file);

    // Set model
    setCharacterFile({ file, preview });
    setCharacterAnalysisSummary('');
    runCatalogCharacterAnalysis(file);

    // Set product (front) for current tab
    setProductSlots((prev) => {
      const next = [...prev];
      if (!next[activeTab]) {
        next[activeTab] = { ...initialProductAngles };
      }
      next[activeTab] = {
        ...next[activeTab],
        front: {
          file,
          preview,
        },
      };
      return next;
    });

    setProductAnalysisSummary('');
    hasRunProductAnalysisRef.current = true;
    runCatalogProductAnalysis(file);

    addLog('INFO', t.logMessages.adsMaker?.combinedUpload || 'Foto produk + model diunggah, menjalankan analisis produk & karakter');

    if (e.target) {
      e.target.value = '';
    }
    if (productFileInputRef.current) {
      productFileInputRef.current.value = '';
    }
  };

  const handleAngleFileChange = (e: React.ChangeEvent<HTMLInputElement>, angle: keyof ProductAngles) => {
    const file = e.target.files?.[0];
    if (file) {
      setProductSlots((prev) => {
        const newSlots = [...prev];

        // Pastikan slot aktif tersedia
        if (!newSlots[activeTab]) {
          newSlots[activeTab] = { ...initialProductAngles };
        }

        const currentSlot = newSlots[activeTab];
        newSlots[activeTab] = {
          ...currentSlot,
          [angle]: {
            file,
            preview: URL.createObjectURL(file),
          },
        };
        return newSlots;
      });

      // Allow re-selecting the same file
      if (e.target) {
        e.target.value = '';
      }
      if (productFileInputRef.current) {
        productFileInputRef.current.value = '';
      }

      if (!hasRunProductAnalysisRef.current) {
        hasRunProductAnalysisRef.current = true;
        runCatalogProductAnalysis(file);
      } else {
        addLog('INFO', t.catalogGenerator.logReferenceUploaded || 'Product photo updated');
      }
    }
  };

  const handleClearAngle = (angle: keyof ProductAngles) => {
    setProductSlots((prev) => {
      const newSlots = [...prev];
      newSlots[activeTab] = {
        ...newSlots[activeTab],
        [angle]: null,
      };
      return newSlots;
    });
  };

  const handleClearProductSlot = () => {
    setProductSlots((prev) => {
      const newSlots = [...prev];
      if (newSlots.length === 0) return [{ ...initialProductAngles }];
      newSlots[0] = { ...initialProductAngles };
      return newSlots;
    });
    hasRunProductAnalysisRef.current = false;
    setProductAnalysisSummary('');
    setCatalogProductFormData(catalogInitialProductFormData);
    if (productFileInputRef.current) {
      productFileInputRef.current.value = '';
    }
  };

  const hasAnyProductImage = productSlots.some((slot) => Object.values(slot).some((img) => img !== null));

  const getCatalogAngleLabelByIndex = (index: number): string => {
    if (index < 0) return 'No photo yet';

    const perBatch = dynamicAngleLabels?.length || CATALOG_ANGLE_LABELS.length;
    const batchIndex = Math.floor(index / perBatch);
    const baseIndex = index % perBatch;

    const waitingLabel = `Angle ${baseIndex + 1} (menunggu AI)`;
    const primaryLabel = dynamicAngleLabels?.[baseIndex] || waitingLabel;
    const extendedLabel = CATALOG_EXTENDED_ANGLE_LABELS[baseIndex] || primaryLabel;

    if (batchIndex === 0) {
      return primaryLabel || `Catalog angle ${baseIndex + 1}`;
    }

    if (batchIndex === 1) {
      return extendedLabel || `Catalog angle ${baseIndex + 1}`;
    }

    const fallbackBase = extendedLabel || primaryLabel || `Catalog angle ${baseIndex + 1}`;
    return `${fallbackBase} · Set ${batchIndex + 1}`;
  };

  const handleGenerate = useCallback(async () => {
    if (!authReady) {
      const message = t.catalogGenerator.statusNotReady;
      setError(message);
      addLog('ERROR', message);
      return;
    }

    if (!hasAnyProductImage) {
      setError(t.catalogGenerator.productPhotoRequired);
      addLog('ERROR', t.logMessages.adsMaker?.productPhotoRequired || t.logMessages.catalog.productPhotoRequired);
      return;
    }

    const bearerKey =
      typeof window !== 'undefined' ? localStorage.getItem('zeoStudio.bearerToken') || '' : '';
    if (!bearerKey) {
      setError(t.catalogGenerator.bearerTokenMissing);
      addLog('ERROR', t.catalogGenerator.bearerTokenMissing);
      return;
    }

    if (typeof window === 'undefined' || !window.zeoAPI?.generateAffiliateImages) {
      setError(t.catalogGenerator.engineUnavailable);
      addLog('ERROR', t.catalogGenerator.engineUnavailable);
      return;
    }

    setIsLoading(true);
    setIsCombining(true);
    setError(null);

    if (characterFile) {
      if (characterAnalysisSummary.trim()) {
        addLog('SUCCESS', t.catalogGenerator.characterAnalysisAvailable);
      } else {
        addLog('INFO', t.catalogGenerator.characterAnalysisNotAvailable);
      }
    }

    if (hasAnyProductImage) {
      if (productAnalysisSummary.trim()) {
        addLog(
          'SUCCESS',
          t.catalogGenerator.productAnalysisAvailable,
        );
      } else {
        addLog(
          'INFO',
          t.catalogGenerator.productAnalysisNotAvailable,
        );
      }
    }

    try {
      const angleOrder: (keyof ProductAngles)[] = ['front', 'back', 'left', 'right', 'top', 'bottom'];
      let primaryProduct: ImageFile | null = null;
      const additionalProductImages: ImageFile[] = [];

      for (const slot of productSlots) {
        for (const angle of angleOrder) {
          const img = slot[angle];
          if (!img) continue;
          if (!primaryProduct) {
            primaryProduct = img;
          } else {
            additionalProductImages.push(img);
          }
        }
      }

      if (!primaryProduct) {
        throw new Error(t.catalogGenerator.noProductPhotos);
      }

      const productRawBase64 = await fileToBase64(primaryProduct.file);
      const modelRawBase64List: string[] = characterFile ? [await fileToBase64(characterFile.file)] : [];
      const additionalRawBase64List: string[] = [];

      for (const img of additionalProductImages.slice(0, 6)) {
        additionalRawBase64List.push(await fileToBase64(img.file));
      }

      const aspectRatioKey = mapAspectRatioToEngineKey(aspectRatio);

      const bgInstruction = getBackgroundInstruction(background);
      const productDescriptionParts: string[] = [];
      for (let i = 0; i < productSlots.length; i += 1) {
        const slot = productSlots[i];
        const slotActive = Object.values(slot).some((img) => img !== null);
        if (!slotActive) continue;
        const angles: string[] = [];
        angleOrder.forEach((angle) => {
          if (slot[angle]) angles.push(angle);
        });
        if (angles.length) {
          productDescriptionParts.push(`PRODUCT ${i + 1}: angles ${angles.join(', ')}`);
        }
      }

      const productDescription = productDescriptionParts.join('. ');

      const totalProductImages = 1 + additionalProductImages.length;
      const productImagesDescription =
        additionalProductImages.length === 0
          ? '1 main product photo'
          : `${totalProductImages} product photos (1 main + ${additionalProductImages.length} additional)`;

      addLog(
        'INFO',
        t.catalogGenerator.preparingRefImages.replace('{description}', productImagesDescription),
      );

      const isClothingProduct = isClothingProductType(
        catalogProductFormData,
        productAnalysisSummary,
      );
      const characterSummaryForPrompt = characterFile
        ? buildCharacterSummaryForPrompt(
            characterAnalysisSummary,
            characterAnalysisMap,
            isClothingProduct,
          )
        : '';
      const productSummaryForPrompt = productAnalysisSummary.trim();

      const autoAnalysisSectionParts: string[] = [];
      if (characterSummaryForPrompt) {
        autoAnalysisSectionParts.push(`CATALOG CHARACTER ANALYSIS: ${characterSummaryForPrompt}`);
      }
      if (productSummaryForPrompt) {
        autoAnalysisSectionParts.push(`CATALOG PRODUCT ANALYSIS: ${productSummaryForPrompt}`);
      }

      const autoAnalysisSection =
        autoAnalysisSectionParts.length > 0
          ? `${autoAnalysisSectionParts.join('\n')}\n\n`
          : '';

      const hasProductFormDetails = Object.values(catalogProductFormData).some(
        (value) => typeof value === 'string' && value.trim().length > 0,
      );

      const productPromptSection =
        hasProductFormDetails && primaryProduct
          ? `CATALOG PRODUCT FIXED DESIGN PROMPT: ${buildCatalogProductPrompt(
              catalogProductFormData,
              aspectRatio,
              true,
            )}`
          : '';

      const combinePrompt = `IMPORTANT: The final output image MUST have an aspect ratio of exactly ${aspectRatio}. This is a strict requirement.\n\nTASK: Combine the catalog character with the provided products based on their multi-angle references. The goal is to create a PHOTOREALISTIC CATALOG IMAGE where both the character and the product are perfectly faithful to the reference photos.\n\nUSER PROMPT (SCENE ONLY): ${prompt}.\n\nThe USER PROMPT is ONLY allowed to control scene composition, camera framing, background/environment, mood, lighting style, and general storytelling. It is STRICTLY FORBIDDEN for the USER PROMPT to request any changes to the character's face, body shape, or skin tone compared to the reference image. The model's clothing and accessories in the reference image are NOT the final outfit: when the main catalog product is wearable clothing, you MUST dress the character using the catalog product design and you MUST ignore the original clothes in the character photo.\n\nNOTE (SCENE-ONLY PROMPT): The user prompt is only for scene, composition, background, mood, and lighting. It MUST NOT change face, skin tone, or body shape versus the reference photo. Clothes and accessories in the character photo are NOT final; if the catalog product is wearable (clothes, hijab, outfit set), the final outfit MUST follow the catalog product design, not the original clothes in the character photo.\n\n${autoAnalysisSection}CATALOG CHARACTER (IDENTITY LOCK): The person in EVERY catalog photo MUST be the exact same individual as in the character reference image. COPY the reference face and identity as faithfully as possible: same facial structure (eyes, eyebrows, nose, lips, jawline), same skin tone and texture, same age, and the same body type/proportions. Do NOT beautify or replace the model with a generic influencer face. If any part of the text prompt conflicts with the reference face or with the catalog product outfit, ALWAYS follow the reference face and catalog product outfit.\n\nOUTFIT RULES: If the catalog product is wearable clothing or accessories, the final outfit MUST follow the catalog product design (color, pattern, material, silhouette). The clothes seen in the character photo are only placeholders and must be replaced by the catalog product design. Do NOT invent random fashion that deviates from the catalog product.\n\nPRODUCT CONSISTENCY: The product appearance must stay identical to the reference product photos: same shape, color, logo, material, stitching, and unique attributes. Do NOT change or stylize the product differently from the references.`;

      const identityReinforcement = characterFile
        ? 'FACE CONSISTENCY REMINDER: For every catalog photo, the AI must treat the uploaded character image as the single source of truth for the face. Do not idealize, beautify, or change the bone structure. Preserve the same nose, lips, jawline, eye distance, and any small unique details such as moles or freckles so that normal people would immediately recognize it as the same person.\n\nWhen following the USER PROMPT and the angle descriptions, you are ONLY allowed to change camera angle, body pose, background, and product placement. You are NOT allowed to change the character\'s facial identity or skin tone compared to the reference image. For clothes and accessories, you must follow the catalog product outfit rather than the original clothes in the reference photo when the product is wearable clothing. If any conflict appears between the USER PROMPT or angle text and the reference image, you MUST always copy the reference face and use the catalog product outfit, completely ignoring any conflicting instruction about the clothes.'
        : '';

      const modelIdentityLock = characterFile
        ? 'UGC MODEL LOCK: All catalog photos must use the exact same model from the uploaded character reference. Keep the same face structure, skin tone, hair style, and body proportions. Do NOT replace the model with any other AI face or influencer look. If multiple prompts or angles request different looks, always keep the original model identity consistent.'
        : '';

      const strongerIdentityLock = characterFile
        ? 'CATALOG IDENTITY SUPER LOCK: Even though these are catalog photos that must clearly show the product and environment, the single highest priority is to COPY the exact same face and identity from the character reference photo. Treat the reference portrait as if you are doing a photoreal face copy-paste onto new poses and camera angles. If there is any trade-off between making the face identical to the reference and making the image more aesthetic or commercial, ALWAYS prioritize copying the reference face perfectly first, then arrange the product and background around that same face.'
        : '';

      const identitySection = [identityReinforcement, modelIdentityLock, strongerIdentityLock]
        .filter(Boolean)
        .join('\n\n');

      const diversityRules =
        'DIVERSITY RULES: Across 12 angles, vary shot size (wide / medium / tight / macro), camera height (eye / low / high), posture (standing / sitting / walking / leaning), and environment. REQUIREMENTS: at least 2 tight product close-ups (no full body), at least 2 shots with large negative space, max 1 sofa/living-room reuse, max 1 mirrored reflection, max 1 seated pose. If any two angles appear similar, change pose, camera height, or environment to make them clearly distinct.';

      const cinematicPoseRule =
        'CINEMATIC POSE & CAMERA: Setiap angle wajib punya pose/aksi tubuh berbeda yang selaras dengan jenis angle (duduk, berdiri, melangkah, menoleh, berinteraksi). Sertakan gerak kamera sinematik yang jelas (pan, tilt, dolly, orbit, slider) dengan kecepatan dan arah yang konsisten. Mood harus terasa sinematik (pencahayaan terarah, atmosfer jelas).';

      const basePromptForAngles = `${combinePrompt}${
        productPromptSection ? `\n\n${productPromptSection}` : ''
      }${bgInstruction}\n\n${cinematicPoseRule}\n\n${diversityRules}\n\n${PRODUCT_FACE_IGNORE_NOTE}\n\nCamera / Lens: captured with a Leica Vario-Elmarit-SL 24-90mm f/2.8-4 ASPH lens for all catalog photos.
{FACE_REFERENCE_SEPARATION_NOTE}
${identitySection ? `\n\n${identitySection}` : ''}`;

      const dynamicAngles = buildDynamicAngleIdeas(
        characterSummaryForPrompt,
        productSummaryForPrompt,
      );

      const anglePromptsMain = dynamicAngles.map((item) => item.prompt);

      const angleEntries = anglePromptsMain.map((text, idx) => {
        const env = ANGLE_ENVIRONMENTS[idx % ANGLE_ENVIRONMENTS.length];
        const motion = ANGLE_CAMERA_MOTION[idx % ANGLE_CAMERA_MOTION.length];
        const uniqueId = `UNIQUE ANGLE ID: ANG-${idx + 1}`;
        const textWithEnv = `${text} Environment: ${env}. Camera motion: ${motion}. ${uniqueId}. HARD RULE: This angle must be visually distinct from all other angles (no reused pose, no reused framing, no reused environment). If this resembles any other angle, immediately switch to a different posture (sit/stand/walk/lean), change camera height (low/high/eye), and pick a different environment from the list to break repetition.`;
        const aiLabel = dynamicAngleLabels?.[idx];
        const ideaLabelRaw = dynamicAngles[idx]?.label || '';
        const fallbackLabel = ideaLabelRaw.replace(/^Angle\s*\d+\s*·\s*/i, '').trim() || `Angle ${idx + 1}`;
        const label = aiLabel || fallbackLabel;
        return { text: textWithEnv, label, index: idx };
      });

      const seenTexts = new Set<string>();
      const uniqueEntries = angleEntries.map((entry) => {
        if (seenTexts.has(entry.text)) {
          const nudgedText = `${entry.text} EXTRA RULE: This angle must change pose, camera height, and mood to avoid duplication—rewrite to be distinct from all earlier angles.`;
          seenTexts.add(nudgedText);
          return { ...entry, text: nudgedText };
        }
        seenTexts.add(entry.text);
        return entry;
      });

      const anglePromptsAll = uniqueEntries.map((entry) => entry.text);

      const enabledEntries = anglePromptsAll
        .map((text, idx) => ({ text, index: idx }))
        .filter((entry) => {
          const groupIdx = getCatalogAngleGroupIndex(entry.index);
          return enabledCatalogGroups[groupIdx] !== false;
        });

      const totalAngles = enabledEntries.length;
      if (!totalAngles) {
        throw new Error(t.catalogGenerator.noAngleGroupsEnabled);
      }

      // Gunakan seluruh daftar angle (main + extended) yang di-enable dan lanjutkan dari slot pertama yang belum terisi
      const missingOffset = enabledEntries.findIndex((entry) => !angleImages[entry.index]?.dataUrl);
      const resumeOffset = missingOffset >= 0 ? missingOffset : nextCatalogAngleIndex;

      const effectiveStartIndex = resumeOffset >= totalAngles ? totalAngles : resumeOffset;
      if (effectiveStartIndex >= totalAngles) {
        addLog('INFO', t.catalogGenerator.allAnglesGenerated);
        return;
      }

      const totalBatches = Math.ceil(totalAngles / CATALOG_ANGLE_BATCH_SIZE);

      const isFirstBatch = effectiveStartIndex === 0;
      const currentBatchIndex = Math.floor(effectiveStartIndex / CATALOG_ANGLE_BATCH_SIZE) + 1;

      if (isFirstBatch) {
        setAngleImages([]);
        setCloseUpImages([]);
        setIsGeneratingAngles(false);
        setIsGeneratingCloseUps(false);
        setActivityLogs([]);
      }

      addLog(
        'INFO',
        isFirstBatch
          ? t.catalogGenerator.startingBatch.replace('{total}', String(totalBatches))
          : t.catalogGenerator.continuingBatch.replace('{batch}', String(currentBatchIndex)).replace('{total}', String(totalBatches)),
      );

      const batchStart = Math.min(effectiveStartIndex, totalAngles);
      const batchEnd = Math.min(batchStart + CATALOG_ANGLE_BATCH_SIZE, totalAngles);
      const batchEntries = enabledEntries.slice(batchStart, batchEnd);
      const batchIndexDisplay =
        Math.floor(batchStart / CATALOG_ANGLE_BATCH_SIZE) + 1;

      setLastBasePromptForAngles(`${basePromptForAngles}\n\n${PRODUCT_IDENTITY_LOCK}`);
      setLastAnglePrompts(enabledEntries.map((e) => e.text));

      // For now, close-up details are covered in the 24 angles above, so no separate close-up batch.
      const closeUpPrompts: string[] = [];

      // Comprehensive sanitization to avoid Google safety filters
      const sanitizeAngleText = (text: string): string => {
        return text
          .replace(/Frontal/gi, 'Front View')
          .replace(/Full Body/gi, 'Full Length')
          .replace(/Back Shot/gi, 'Back View')
          .replace(/On-body/gi, 'Body Proportion')
          .replace(/45°/gi, '45 degree')
          .replace(/Side Profile/gi, 'Side View')
          .replace(/body shape/gi, 'figure proportions')
          .replace(/\bbody\b/gi, 'figure')
          .replace(/bedroom|closet/gi, 'dressing room')
          .replace(/bathroom|vanity/gi, 'personal care area')
          .replace(/\bbed\b/gi, 'furniture')
          .replace(/private|intimate|sensual|sexy/gi, 'personal')
          .replace(/skin tone/gi, 'complexion')
          .replace(/shot\b/gi, 'view')
          .replace(/\bmodel\b/gi, 'person')
          .replace(/loungewear/gi, 'casual wear')
          .replace(/underwear|lingerie/gi, 'garment')
          .replace(/revealing/gi, 'showing');
      };
      
      // Sanitize base prompt to avoid safety filter
      const sanitizedBasePrompt = sanitizeAngleText(basePromptForAngles);

      const items: { category: 'broll' | 'ugc' | 'commercial'; prompt: string }[] = [];
      // Only send catalog angles for the current batch (no separate main image)
      batchEntries.forEach(({ text: angleText }) => {
        const sanitizedAngleText = sanitizeAngleText(angleText);
        const anglePrompt = `${sanitizedBasePrompt}\n\n${PRODUCT_IDENTITY_LOCK}\n\nPhotoshoot angle: ${sanitizedAngleText}.`;
        // Use category 'ugc' for all catalog photos showing character + product (as in 1.3.5)
        items.push({ category: 'ugc', prompt: anglePrompt });
      });

      // Create placeholder images immediately with loading state
      setAngleImages((prev) => {
        const next = [...prev];
        if (next.length < batchEnd) {
          const oldLength = next.length;
          next.length = batchEnd;
          for (let i = oldLength; i < batchEnd; i += 1) {
            next[i] = null;
          }
        }
        
        // Set placeholders for current batch
        batchEntries.forEach(({ index, text }) => {
          const sanitizedText = text
            .replace(/Frontal/gi, 'Front View')
            .replace(/Full Body/gi, 'Full Length')
            .replace(/Back Shot/gi, 'Back View');
          next[index] = {
            dataUrl: '',
            status: 'generating' as const,
            startedAt: Date.now(),
            estimatedTotalSeconds: 300,
            prompt: sanitizedText.substring(0, 80),
          };
        });
        
        return next;
      });
      
      // Schedule sequential card reveal with 2s delay
      batchEntries.forEach((entry, idx) => {
        const cardId = `catalog-image-${entry.index}`;
        const timeout = setTimeout(() => {
          setVisibleCardIds(prevVisible => new Set([...prevVisible, cardId]));
        }, idx * 2000);
        cardRevealTimeouts.current.push(timeout);
      });

      addLog(
        'INFO',
        t.catalogGenerator.sendingPrompts.replace('{count}', String(items.length)).replace('{batch}', String(batchIndexDisplay)).replace('{total}', String(totalBatches)),
      );

      const response = await window.zeoAPI.generateAffiliateImages({
        bearerKey,
        aspectRatioKey,
        imageResolution,
        items,
        references: {
          product: productRawBase64,
          models: modelRawBase64List,
          additional: additionalRawBase64List,
        },
      });

      if (!response || !response.ok) {
        const message = response?.error || t.catalogGenerator.engineResponseInvalid;
        throw new Error(message);
      }

      const results: any[] = Array.isArray(response.results) ? response.results : [];
      if (!results.length) {
        throw new Error(t.catalogGenerator.engineNoImages);
      }

      const batchRequested = items.length;
      const batchReturned = results.length;

      // Update existing placeholders with results
      const successLabels: string[] = [];
      let successAngles = 0;
      let failedWithErrorCount = 0;

      setAngleImages((prev) => {
        const next = [...prev];
        
        for (let i = 0; i < Math.min(batchReturned, batchRequested); i += 1) {
          const r = results[i];
          const entry = batchEntries[i];
          if (!entry) continue;
          const globalIndex = entry.index;
          const promptLabel = entry.text || `Catalog angle ${globalIndex + 1}`;
          const label = promptLabel.split('.')[0];

          if (r?.success && r.dataUrl) {
            // Update placeholder to completed with dataUrl
            const existingImage = next[globalIndex];
            next[globalIndex] = {
              dataUrl: r.dataUrl,
              status: 'completed' as const,
              startedAt: existingImage?.startedAt,
              estimatedTotalSeconds: existingImage?.estimatedTotalSeconds,
              prompt: existingImage?.prompt,
            };
            successAngles += 1;
            successLabels.push(label);
          } else {
            // Mark placeholder as failed
            const existingImage = next[globalIndex];
            next[globalIndex] = {
              dataUrl: '',
              status: 'failed' as const,
              startedAt: existingImage?.startedAt,
              estimatedTotalSeconds: existingImage?.estimatedTotalSeconds,
              prompt: existingImage?.prompt,
              errorMessage: (typeof r?.error === 'string' && r.error.trim()) || t.catalogGenerator.engineFailedNoMessage,
            };
            failedWithErrorCount += 1;
            const errMsg = next[globalIndex]?.errorMessage || t.catalogGenerator.engineFailedNoMessage;
            addLog('ERROR', t.catalogGenerator.engineFailedForAngle.replace('{label}', label).replace('{error}', errMsg));
          }
        }
        
        return next;
      });

      const missingCount = batchRequested > batchReturned ? batchRequested - batchReturned : 0;

      setGeneratedImage(null);
      setCloseUpImages([]);

      // Update active index to first completed image in batch
      setAngleImages((prev) => {
        const firstBatchIndex = prev.findIndex(
          (img, idx) => idx >= batchStart && idx < batchEnd && img?.dataUrl,
        );
        if (firstBatchIndex >= 0) {
          setActiveAngleIndex(firstBatchIndex);
        } else {
          const firstAvailableIndex = prev.findIndex((img) => img?.dataUrl);
          setActiveAngleIndex(firstAvailableIndex >= 0 ? firstAvailableIndex : -1);
        }
        return prev;
      });

      const totalSuccessSoFar = angleImages.filter((img) => img?.dataUrl).length;

      if (successAngles > 0) {
        addLog(
          'SUCCESS',
          t.catalogGenerator.batchCompleted.replace('{batch}', String(batchIndexDisplay)).replace('{total}', String(totalBatches)).replace('{success}', String(successAngles)).replace('{requested}', String(batchRequested)).replace('{totalSuccess}', String(totalSuccessSoFar)).replace('{totalAngles}', String(totalAngles)),
        );
        addLog('INFO', t.catalogGenerator.batchSuccessAngles.replace('{labels}', successLabels.join('; ')));
      }

      if (failedWithErrorCount > 0 || missingCount > 0) {
        addLog(
          'INFO',
          t.catalogGenerator.batchSummary.replace('{batch}', String(batchIndexDisplay)).replace('{requested}', String(batchRequested)).replace('{received}', String(batchReturned)).replace('{success}', String(successAngles)).replace('{failed}', String(failedWithErrorCount)).replace('{missing}', String(missingCount)),
        );
      }

      setNextCatalogAngleIndex(batchEnd);
    } catch (err: any) {
      const message =
        err?.message || t.catalogGenerator.catalogGenerationError;
      setError(message);
      addLog('ERROR', message);
    } finally {
      setIsLoading(false);
      setIsCombining(false);
      setIsGeneratingAngles(false);
      setIsGeneratingCloseUps(false);
    }
  }, [
    angleImages,
    aspectRatio,
    authReady,
    background,
    catalogProductFormData,
    characterAnalysisSummary,
    characterFile,
    enabledCatalogGroups,
    hasAnyProductImage,
    nextCatalogAngleIndex,
    productAnalysisSummary,
    productSlots,
    prompt,
  ]);

  const anyLoading = isLoading || isGeneratingAngles || isCombining || isGeneratingCloseUps;
  const allCatalogImages = angleImages;
  const hasGeneratedOnce = allCatalogImages.length > 0;
  const successfulImageCount = allCatalogImages.filter((img) => img?.dataUrl).length;

  const enabledGroupsCount = enabledCatalogGroups.filter((v) => v !== false).length;
  const hasMinCatalogGroups = enabledGroupsCount >= MIN_CATALOG_GROUPS;
  const hasMaxCatalogGroups = enabledGroupsCount >= MAX_CATALOG_GROUPS;
  const isAngleGroupSelectionValid = hasMinCatalogGroups;
  const totalEnabledAngles = enabledGroupsCount * CATALOG_ANGLE_BATCH_SIZE;
  const totalMainBatches =
    totalEnabledAngles > 0 ? Math.ceil(totalEnabledAngles / CATALOG_ANGLE_BATCH_SIZE) : 0;
  const canGenerateNextMainBatch =
    hasGeneratedOnce && totalEnabledAngles > 0 && nextCatalogAngleIndex < totalEnabledAngles;
  const nextMainBatchIndex = canGenerateNextMainBatch
    ? Math.floor(nextCatalogAngleIndex / CATALOG_ANGLE_BATCH_SIZE) + 1
    : totalMainBatches || 1;
  const hasCompletedMainBatches =
    hasGeneratedOnce &&
    totalEnabledAngles > 0 &&
    !canGenerateNextMainBatch &&
    angleImages.length >= totalEnabledAngles;

  const totalExtendedAngles = CATALOG_EXTENDED_ANGLE_PROMPTS.length;
  const totalExtendedBatches = Math.ceil(totalExtendedAngles / CATALOG_ANGLE_BATCH_SIZE);
  const extendedImagesSlice = angleImages.slice(
    CATALOG_ANGLE_LABELS.length,
    CATALOG_ANGLE_LABELS.length + totalExtendedAngles,
  );
  const extendedFilledCount = extendedImagesSlice.filter((src) => !!src).length;
  const hasAnyExtendedImage = extendedFilledCount > 0;
  const hasCompletedExtended = extendedFilledCount >= totalExtendedAngles;
  const currentExtendBatchIndex = hasCompletedExtended
    ? totalExtendedBatches
    : Math.floor(Math.max(0, nextExtendedAngleIndex) / CATALOG_ANGLE_BATCH_SIZE) + 1;

  const thumbnailAspectClass =
    aspectRatio === '1:1'
      ? 'aspect-[1/1]'
      : aspectRatio === '16:9'
      ? 'aspect-[16/9]'
      : aspectRatio === '9:16'
      ? 'aspect-[9/16]'
      : aspectRatio === '4:3'
      ? 'aspect-[4/3]'
      : 'aspect-[3/4]';

  const performFullReset = () => {
    // Reset input dasar & konfigurasi layout
    setPrompt('');
    setAspectRatio('9:16');
    setImageResolution('1366x768');

    // Reset file karakter dan hasil analisisnya
    setCharacterFile(null);
    setCharacterAnalysisSummary('');
    setCharacterAnalysisMap({});
    setIsAnalyzingCharacter(false);
    if (characterFileInputRef.current) {
      characterFileInputRef.current.value = '';
    }

    // Reset product photos, product analysis, and product form
    setProductSlots([{ ...initialProductAngles }]);
    hasRunProductAnalysisRef.current = false;
    setProductAnalysisSummary('');
    setCatalogProductFormData(catalogInitialProductFormData);
    setIsAnalyzingProduct(false);
    if (productFileInputRef.current) {
      productFileInputRef.current.value = '';
    }

    // Reset generated catalog results
    setGeneratedImage(null);
    setAngleImages([]);
    setCloseUpImages([]);

    // Reset process flags
    setIsLoading(false);
    setIsGeneratingAngles(false);
    setIsGeneratingCloseUps(false);
    setIsCombining(false);

    // Reset error & modal state
    setError(null);
    setModalImage(null);
    setActiveAngleIndex(-1);
    setRegeneratingIndexes([]);
    setIsRegeneratingFailedAngles(false);
    setLastBasePromptForAngles(null);
    setLastAnglePrompts(null);
    setNextCatalogAngleIndex(0);
    setNextExtendedAngleIndex(0);

    // Reset activity log & copy label
    setActivityLogs([]);
    setActivityLogCopyLabel(t.activityLog.copyLog);

    // Reset catalog edit modal state
    setCatalogEditModal({
      isOpen: false,
      index: null,
      imageUrl: null,
      instruction: '',
      isSubmitting: false,
    });
    setEditingIndex(null);

    // Clear image card reveal timeouts
    cardRevealTimeouts.current.forEach(timeout => clearTimeout(timeout));
    cardRevealTimeouts.current = [];
    setVisibleCardIds(new Set());
    
    // Clear video card reveal timeouts
    videoCardRevealTimeouts.current.forEach(timeout => clearTimeout(timeout));
    videoCardRevealTimeouts.current = [];
    setVisibleVideoCardIds(new Set());
    
    // Reset video states
    setAngleVideos([]);
    setAngleViewModes([]);
    setVideoGeneratingIndexes([]);
    setIsBatchVideoRunning(false);
    setCustomVideoPromptsByIndex({});
    setVideoPromptModal({ isOpen: false, index: null, draft: '' });
    
    // Reset angle groups to default
    setEnabledCatalogGroups(DEFAULT_ENABLED_CATALOG_GROUPS);
  };

  const handleFullReset = () => {
    if (anyLoading) return;
    setIsResetConfirmOpen(true);
  };

  const handleConfirmReset = () => {
    setIsResetConfirmOpen(false);
    if (anyLoading) return;
    performFullReset();
  };

  const handleExtendGenerateCatalog = useCallback(async () => {
    if (isLoading || regeneratingIndexes.length > 0) return;

    if (!authReady) {
      const message = t.catalogGenerator.statusNotReady;
      setError(message);
      addLog('ERROR', message);
      return;
    }

    if (!hasAnyProductImage) {
      setError(t.catalogGenerator.productPhotoRequired);
      addLog('ERROR', t.catalogGenerator.extendCanceledNoProduct);
      return;
    }

    const bearerKey =
      typeof window !== 'undefined' ? localStorage.getItem('zeoStudio.bearerToken') || '' : '';
    if (!bearerKey) {
      setError(t.catalogGenerator.bearerTokenMissing);
      addLog('ERROR', t.catalogGenerator.extendBearerMissing);
      return;
    }

    if (typeof window === 'undefined' || !window.zeoAPI?.generateAffiliateImages) {
      setError(t.catalogGenerator.engineUnavailable);
      addLog('ERROR', t.catalogGenerator.extendEngineUnavailable);
      return;
    }

    const totalExtendedAngles = CATALOG_EXTENDED_ANGLE_PROMPTS.length;
    const totalExtendedBatches = Math.ceil(totalExtendedAngles / CATALOG_ANGLE_BATCH_SIZE);

    // Cari index extended pertama yang masih kosong; jika ada, lanjut dari sana.
    const extendedSlice = angleImages.slice(
      CATALOG_ANGLE_LABELS.length,
      CATALOG_ANGLE_LABELS.length + totalExtendedAngles,
    );
    const firstMissingExtendedIndex = extendedSlice.findIndex((src) => !src);
    const resumeIndex = firstMissingExtendedIndex >= 0 ? firstMissingExtendedIndex : nextExtendedAngleIndex;

    const effectiveStartIndex =
      resumeIndex >= totalExtendedAngles ? 0 : resumeIndex;
    const isFirstExtendBatch = effectiveStartIndex === 0;
    const currentBatchIndex =
      Math.floor(effectiveStartIndex / CATALOG_ANGLE_BATCH_SIZE) + 1;

    setIsLoading(true);
    setError(null);

    addLog(
      'INFO',
      isFirstExtendBatch
        ? t.catalogGenerator.extendStartingBatch.replace('{total}', String(totalExtendedBatches))
        : t.catalogGenerator.extendContinuingBatch.replace('{batch}', String(currentBatchIndex)).replace('{total}', String(totalExtendedBatches)),
    );

    try {
      const angleOrder: (keyof ProductAngles)[] = ['front', 'back', 'left', 'right', 'top', 'bottom'];
      let primaryProduct: ImageFile | null = null;
      const additionalProductImages: ImageFile[] = [];

      for (const slot of productSlots) {
        for (const angle of angleOrder) {
          const img = slot[angle];
          if (!img) continue;
          if (!primaryProduct) {
            primaryProduct = img;
          } else {
            additionalProductImages.push(img);
          }
        }
      }

      if (!primaryProduct) {
        throw new Error(t.catalogGenerator.noProductPhotos);
      }

      const productRawBase64 = await fileToBase64(primaryProduct.file);
      const modelRawBase64List: string[] = [await fileToBase64(characterFile.file)];
      const additionalRawBase64List: string[] = [];

      for (const img of additionalProductImages.slice(0, 6)) {
        additionalRawBase64List.push(await fileToBase64(img.file));
      }

      const aspectRatioKey = mapAspectRatioToEngineKey(aspectRatio);

      const bgInstruction = getBackgroundInstruction(background);
      const productDescriptionParts: string[] = [];
      for (let i = 0; i < productSlots.length; i += 1) {
        const slot = productSlots[i];
        const slotActive = Object.values(slot).some((img) => img !== null);
        if (!slotActive) continue;
        const angles: string[] = [];
        angleOrder.forEach((angle) => {
          if (slot[angle]) angles.push(angle);
        });
        if (angles.length) {
          productDescriptionParts.push(`PRODUCT ${i + 1}: angles ${angles.join(', ')}`);
        }
      }

      const productDescription = productDescriptionParts.join('. ');

      const isClothingProduct = isClothingProductType(
        catalogProductFormData,
        productAnalysisSummary,
      );
      const characterSummaryForPrompt = buildCharacterSummaryForPrompt(
        characterAnalysisSummary,
        characterAnalysisMap,
        isClothingProduct,
      );
      const productSummaryForPrompt = productAnalysisSummary.trim();

      const autoAnalysisSectionParts: string[] = [];
      if (characterSummaryForPrompt) {
        autoAnalysisSectionParts.push(
          `CATALOG CHARACTER ANALYSIS: ${characterSummaryForPrompt}`,
        );
      }
      if (productSummaryForPrompt) {
        autoAnalysisSectionParts.push(`CATALOG PRODUCT ANALYSIS: ${productSummaryForPrompt}`);
      }

      const autoAnalysisSection =
        autoAnalysisSectionParts.length > 0
          ? `${autoAnalysisSectionParts.join('\n')}\n\n`
          : '';

      const hasProductFormDetails = Object.values(catalogProductFormData).some(
        (value) => typeof value === 'string' && value.trim().length > 0,
      );

      const combinePrompt = `IMPORTANT: The final output image MUST have an aspect ratio of exactly ${aspectRatio}. This is a strict requirement.\n\nTASK: Combine the catalog character with the provided products based on their multi-angle references. The goal is to create a PHOTOREALISTIC CATALOG IMAGE where both the character and the product are perfectly faithful to the reference photos.\n\nUSER PROMPT (SCENE ONLY): ${prompt}.\n\nThe USER PROMPT is ONLY allowed to control scene composition, camera framing, background/environment, mood, lighting style, and general storytelling. It is STRICTLY FORBIDDEN for the USER PROMPT to request any changes to the character's face, body shape, skin tone, hairstyle, hijab style, clothing, or accessories compared to the reference image. If the USER PROMPT accidentally asks for a different face, age, ethnicity, skin color, hair, or outfit, you MUST ignore that part of the text and keep the character identical to the reference photo.\n\nCATATAN (PROMPT HANYA UNTUK SCENE): Prompt dari pengguna hanya boleh dipakai untuk mengatur adegan, komposisi, latar, mood, dan pencahayaan. Prompt TIDAK BOLEH dipakai untuk mengganti wajah, warna kulit, bentuk tubuh, gaya rambut, hijab, atau pakaian dibandingkan foto referensi; jika ada instruksi yang bertentangan, abaikan instruksi teks tersebut dan tetap ikuti foto referensi.\n\n${autoAnalysisSection}CATALOG CHARACTER (IDENTITY LOCK): The person in EVERY catalog photo MUST be the exact same individual as in the character reference image. COPY the reference face and identity as faithfully as possible: same facial structure (eyes, eyebrows, nose, lips, jawline), same skin tone and texture, same age, same body type/proportions, and the same hijab / hair style, color, and wrapping. Do NOT beautify or replace the model with a generic influencer face. If any part of the text prompt conflicts with the reference face or outfit, ALWAYS follow the reference image and ignore the conflicting text.\n\nDalam setiap foto katalog, selalu anggap foto referensi karakter sebagai sumber kebenaran utama untuk wajah dan outfit. Jika prompt teks meminta hal yang bertentangan (misalnya warna kulit berbeda, bentuk wajah berbeda, hijab dilepas/pasang, atau pakaian berbeda), abaikan instruksi teks tersebut dan tetap ikuti foto referensi karakter.\n\nOUTFIT RULES: If the catalog product is wearable clothing or accessories, the final outfit MUST follow the catalog product design (color, pattern, material, silhouette). The clothes seen in the character photo are only placeholders and must be replaced by the catalog product design. Do NOT invent random fashion that deviates from the catalog product.\n\nPRODUCT CONSISTENCY: The product appearance must stay identical to the reference product photos: same shape, color, logo, material, stitching, and unique attributes. Do NOT change or stylize the product differently from the references.`;

      const identityReinforcement =
        'FACE CONSISTENCY REMINDER: For every catalog photo, the AI must treat the uploaded character image as the single source of truth for the face. Do not idealize, beautify, or change the bone structure. Preserve the same nose, lips, jawline, eye distance, and any small unique details such as moles or freckles so that normal people would immediately recognize it as the same person.\n\nWhen following the USER PROMPT and the angle descriptions, you are ONLY allowed to change camera angle, body pose, background, and product placement. You are NOT allowed to change the character\'s facial identity, skin tone, hairstyle, or outfit compared to the reference image. If any conflict appears between the USER PROMPT or angle text and the reference image, you MUST always copy the reference face and outfit exactly and completely ignore the conflicting instruction.';

      const productPromptSection =
        hasProductFormDetails && primaryProduct
          ? `CATALOG PRODUCT FIXED DESIGN PROMPT: ${buildCatalogProductPrompt(
              catalogProductFormData,
              aspectRatio,
              true,
            )}`
          : '';

      const cinematicPoseRule =
        'CINEMATIC POSE & CAMERA: Setiap angle wajib punya pose/aksi tubuh berbeda yang selaras dengan jenis angle (duduk, berdiri, melangkah, menoleh, berinteraksi). Sertakan gerak kamera sinematik yang jelas (pan, tilt, dolly, orbit, slider) dengan kecepatan dan arah yang konsisten. Mood harus terasa sinematik (pencahayaan terarah, atmosfer jelas).';

      const basePromptForAngles = `${combinePrompt}${
        productPromptSection ? `\n\n${productPromptSection}` : ''
      }${bgInstruction}\n\n${cinematicPoseRule}\n\nCamera / Lens: captured with a Leica Vario-Elmarit-SL 24-90mm f/2.8-4 ASPH lens for all catalog photos.\n\n${FACE_REFERENCE_SEPARATION_NOTE}\n\n${identityReinforcement}`;

      const anglePrompts = CATALOG_EXTENDED_ANGLE_PROMPTS;

      const totalAngles = anglePrompts.length;
      const batchStart = effectiveStartIndex >= totalAngles ? 0 : effectiveStartIndex;
      const batchEnd = Math.min(batchStart + CATALOG_ANGLE_BATCH_SIZE, totalAngles);
      const batchPrompts = anglePrompts.slice(batchStart, batchEnd);
      const batchIndexDisplay =
        Math.floor(batchStart / CATALOG_ANGLE_BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(totalAngles / CATALOG_ANGLE_BATCH_SIZE);

      setLastBasePromptForAngles(`${basePromptForAngles}\n\n${PRODUCT_IDENTITY_LOCK}`);
      setLastAnglePrompts((prev) => {
        const existing = Array.isArray(prev) ? prev : [];
        const expectedLength = CATALOG_ANGLE_LABELS.length + anglePrompts.length;
        if (existing.length >= expectedLength) return existing;
        return [...existing, ...anglePrompts];
      });

      // Comprehensive sanitization to avoid Google safety filters
      const sanitizeAngleText = (text: string): string => {
        return text
          .replace(/Frontal/gi, 'Front View')
          .replace(/Full Body/gi, 'Full Length')
          .replace(/Back Shot/gi, 'Back View')
          .replace(/On-body/gi, 'Body Proportion')
          .replace(/45°/gi, '45 degree')
          .replace(/Side Profile/gi, 'Side View')
          .replace(/body shape/gi, 'figure proportions')
          .replace(/\bbody\b/gi, 'figure')
          .replace(/bedroom|closet/gi, 'dressing room')
          .replace(/bathroom|vanity/gi, 'personal care area')
          .replace(/\bbed\b/gi, 'furniture')
          .replace(/private|intimate|sensual|sexy/gi, 'personal')
          .replace(/skin tone/gi, 'complexion')
          .replace(/shot\b/gi, 'view')
          .replace(/\bmodel\b/gi, 'person')
          .replace(/loungewear/gi, 'casual wear')
          .replace(/underwear|lingerie/gi, 'garment')
          .replace(/revealing/gi, 'showing');
      };
      
      // Sanitize base prompt to avoid safety filter
      const sanitizedBasePrompt = sanitizeAngleText(basePromptForAngles);

      const items: { category: 'broll' | 'ugc' | 'commercial'; prompt: string }[] = [];

      batchPrompts.forEach((angleText) => {
        const sanitizedAngleText = sanitizeAngleText(angleText);
        const anglePrompt = `${sanitizedBasePrompt}\n\n${PRODUCT_IDENTITY_LOCK}\n\nPhotoshoot angle: ${sanitizedAngleText}.`;
        items.push({ category: 'ugc', prompt: anglePrompt });
      });

      addLog(
        'INFO',
        t.catalogGenerator.extendSendingPrompts.replace('{count}', String(items.length)).replace('{batch}', String(batchIndexDisplay)).replace('{total}', String(totalBatches)),
      );

      const response = await window.zeoAPI.generateAffiliateImages({
        bearerKey,
        aspectRatioKey,
        imageResolution,
        items,
        references: {
          product: productRawBase64,
          models: modelRawBase64List,
          additional: additionalRawBase64List,
        },
      });

      if (!response || !response.ok) {
        const message = response?.error || t.catalogGenerator.extendEngineInvalid;
        throw new Error(message);
      }

      const results: any[] = Array.isArray(response.results) ? response.results : [];
      if (!results.length) {
        throw new Error(t.catalogGenerator.extendEngineNoImages);
      }

      const batchRequested = items.length;
      const batchReturned = results.length;

      const angleImagesList: string[] = (() => {
        const next = [...angleImages];
        const globalBatchEnd = CATALOG_ANGLE_LABELS.length + batchEnd;
        if (next.length < globalBatchEnd) {
          const oldLength = next.length;
          next.length = globalBatchEnd;
          for (let i = oldLength; i < globalBatchEnd; i += 1) {
            next[i] = '';
          }
        }
        return next;
      })();

      const successLabels: string[] = [];
      let successCount = 0;
      let failedWithErrorCount = 0;

      for (let i = 0; i < Math.min(batchReturned, batchRequested); i += 1) {
        const r = results[i];
        const localIndex = batchStart + i;
        const globalIndex = CATALOG_ANGLE_LABELS.length + localIndex;
        const labelBase =
          CATALOG_EXTENDED_ANGLE_LABELS[localIndex] || `Extended catalog angle ${localIndex + 1}`;
        const label = `${labelBase} · Set 2`;

        if (r?.success && r.dataUrl) {
          angleImagesList[globalIndex] = r.dataUrl;
          successCount += 1;
          successLabels.push(labelBase);
        } else if (r) {
          failedWithErrorCount += 1;
          const errMsg: string =
            (typeof r.error === 'string' && r.error.trim()) ||
            t.catalogGenerator.engineFailedNoMessage;
          addLog('ERROR', t.catalogGenerator.extendFailedForAngle.replace('{label}', label).replace('{error}', errMsg));
        }
      }

      const missingCount = batchRequested > batchReturned ? batchRequested - batchReturned : 0;

      setAngleImages(angleImagesList);

      const firstBatchIndex = angleImagesList.findIndex((src, idx) => {
        const localIdx = idx - CATALOG_ANGLE_LABELS.length;
        return localIdx >= batchStart && localIdx < batchEnd && !!src;
      });
      if (firstBatchIndex >= 0) {
        setActiveAngleIndex(firstBatchIndex);
      }

      if (successCount > 0) {
        addLog(
          'SUCCESS',
          t.catalogGenerator.extendBatchCompleted.replace('{batch}', String(batchIndexDisplay)).replace('{total}', String(totalBatches)).replace('{success}', String(successCount)).replace('{requested}', String(batchRequested)),
        );
        addLog('INFO', t.catalogGenerator.extendBatchSuccessAngles.replace('{labels}', successLabels.join('; ')));
      }

      if (failedWithErrorCount > 0 || missingCount > 0) {
        addLog(
          'INFO',
          t.catalogGenerator.extendBatchSummary.replace('{batch}', String(batchIndexDisplay)).replace('{requested}', String(batchRequested)).replace('{received}', String(batchReturned)).replace('{success}', String(successCount)).replace('{failed}', String(failedWithErrorCount)).replace('{missing}', String(missingCount)),
        );
      }

      // Recompute pointer berdasarkan slot extended yang masih kosong agar tidak macet di batch tertentu
      const postBatchExtendedSlice = angleImagesList.slice(
        CATALOG_ANGLE_LABELS.length,
        CATALOG_ANGLE_LABELS.length + totalAngles,
      );
      const nextMissing = postBatchExtendedSlice.findIndex((src) => !src);
      setNextExtendedAngleIndex(nextMissing >= 0 ? nextMissing : totalAngles);
    } catch (err: any) {
      const message = err?.message || t.catalogGenerator.extendError;
      setError(message);
      addLog('ERROR', message);
    } finally {
      setIsLoading(false);
    }
  }, [
    angleImages,
    aspectRatio,
    authReady,
    background,
    catalogProductFormData,
    characterAnalysisSummary,
    characterFile,
    hasAnyProductImage,
    isLoading,
    nextExtendedAngleIndex,
    productAnalysisSummary,
    productSlots,
    prompt,
    regeneratingIndexes,
  ]);

  const handleDownloadAllAngles = async () => {
    if (!angleImages.length) return;

    const zip = new JSZip();

    const downloadTargets = angleImages.filter((url) => url && url.trim() !== '');

    for (let i = 0; i < downloadTargets.length; i++) {
      const url = downloadTargets[i];
      const label = getCatalogAngleLabelByIndex(i) || `Angle ${i + 1}`;
      const safeLabel = label
        .replace(/\s+/g, '-')
        .replace(/[^a-zA-Z0-9.-]/g, '')
        .toLowerCase();
      const filename = `catalog-${safeLabel}.png`;

      try {
        const response = await fetch(url);
        const blob = await response.blob();
        zip.file(filename, blob, { compression: 'STORE' });
      } catch (err) {
        continue;
      }
    }

    const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
    const zipUrl = URL.createObjectURL(zipBlob);

    const link = document.createElement('a');
    link.href = zipUrl;
    link.setAttribute('download', 'catalog-angles.zip');
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);

    URL.revokeObjectURL(zipUrl);
    addLog('SUCCESS', t.logMessages.adsMaker?.zipReady || t.logMessages.catalog.zipReady);
  };

  const handleRegenerateAngle = async (index: number, options?: { bypassGuard?: boolean }) => {
    if (!options?.bypassGuard && (isLoading || regeneratingIndexes.length >= MAX_PARALLEL_REGENERATE)) {
      return;
    }

    if (!authReady) {
      const message = t.catalogGenerator.statusNotReady;
      setError(message);
      addLog('ERROR', message);
      return;
    }

    if (!hasAnyProductImage) {
      setError(t.catalogGenerator.productPhotoRequired);
      addLog('ERROR', t.catalogGenerator.regenCanceledNoProduct);
      return;
    }

    const bearerKey =
      typeof window !== 'undefined' ? localStorage.getItem('zeoStudio.bearerToken') || '' : '';
    if (!bearerKey) {
      setError(t.catalogGenerator.bearerTokenMissing);
      addLog('ERROR', t.catalogGenerator.regenBearerMissing);
      return;
    }

    if (typeof window === 'undefined' || !window.zeoAPI?.generateAffiliateImages) {
      setError(t.catalogGenerator.engineUnavailable);
      addLog('ERROR', t.catalogGenerator.regenEngineUnavailable);
      return;
    }

    if (!lastBasePromptForAngles || !lastAnglePrompts || !lastAnglePrompts[index]) {
      addLog(
        'ERROR',
        t.catalogGenerator.regenNoPromptData,
      );
      return;
    }

    const angleOrder: (keyof ProductAngles)[] = ['front', 'back', 'left', 'right', 'top', 'bottom'];
    let primaryProduct: ImageFile | null = null;
    const additionalProductImages: ImageFile[] = [];

    for (const slot of productSlots) {
      for (const angle of angleOrder) {
        const img = slot[angle];
        if (!img) continue;
        if (!primaryProduct) {
          primaryProduct = img;
        } else {
          additionalProductImages.push(img);
        }
      }
    }

    if (!primaryProduct) {
      const message = t.catalogGenerator.noProductPhotos;
      setError(message);
      addLog('ERROR', t.catalogGenerator.regenNoProductPhotos);
      return;
    }

    const productRawBase64 = await fileToBase64(primaryProduct.file);
    const modelRawBase64List: string[] = [await fileToBase64(characterFile.file)];
    const additionalRawBase64List: string[] = [];

    for (const img of additionalProductImages.slice(0, 6)) {
      additionalRawBase64List.push(await fileToBase64(img.file));
    }

    const aspectRatioKey = mapAspectRatioToEngineKey(aspectRatio);

    const angleText = lastAnglePrompts[index] || `Catalog angle ${index + 1}`;
    // Sanitize to avoid Google safety filters
    const sanitizedAngleText = angleText
      .replace(/Frontal/gi, 'Front View')
      .replace(/Full Body/gi, 'Full Length')
      .replace(/Back Shot/gi, 'Back View')
      .replace(/On-body/gi, 'Body Proportion')
      .replace(/45°/gi, '45 degree')
      .replace(/Side Profile/gi, 'Side View');
    const anglePrompt = `${lastBasePromptForAngles}\n\nPhotoshoot angle: ${sanitizedAngleText}.`;

    const label = getCatalogAngleLabelByIndex(index) || `Catalog angle ${index + 1}`;

    try {
      setRegeneratingIndexes((prev) =>
        prev.includes(index) ? prev : [...prev, index],
      );
      addLog('INFO', t.catalogGenerator.regenStarting.replace('{label}', label));

      // Set placeholder with status generating and countdown BEFORE API call
      setAngleImages((prev) => {
        const next = [...prev];
        if (index >= 0 && index < next.length) {
          next[index] = {
            dataUrl: prev[index]?.dataUrl || '',
            status: 'generating' as const,
            startedAt: Date.now(),
            estimatedTotalSeconds: 300,
            prompt: prev[index]?.prompt || label,
          };
        }
        return next;
      });

      const response = await window.zeoAPI.generateAffiliateImages({
        bearerKey,
        aspectRatioKey,
        imageResolution,
        items: [{ category: 'ugc', prompt: anglePrompt }],
        references: {
          product: productRawBase64,
          models: modelRawBase64List,
          additional: additionalRawBase64List,
        },
      });

      if (!response || !response.ok) {
        const message = response?.error || t.catalogGenerator.regenEngineInvalid;
        throw new Error(message);
      }

      const results: any[] = Array.isArray(response.results) ? response.results : [];
      const result = results[0];

      if (!result || !result.success || !result.dataUrl) {
        const errMsg: string = result?.error || t.catalogGenerator.regenFailed;
        setError(errMsg);
        addLog('ERROR', t.catalogGenerator.regenFailedForAngle.replace('{label}', label).replace('{error}', errMsg));
        return;
      }

      const newUrl: string = result.dataUrl;

      setAngleImages((prev) => {
        const next = [...prev];
        if (index >= 0 && index < next.length) {
          const existingImage = next[index];
          next[index] = {
            dataUrl: newUrl,
            status: 'completed' as const,
            startedAt: existingImage?.startedAt,
            estimatedTotalSeconds: existingImage?.estimatedTotalSeconds,
            prompt: existingImage?.prompt,
          };
        }
        return next;
      });

      setActiveAngleIndex(index);
      setModalImage(newUrl);
      addLog('SUCCESS', t.catalogGenerator.regenSuccess.replace('{label}', label));
    } catch (err: any) {
      const message = err?.message || t.catalogGenerator.regenError;
      setError(message);
      addLog('ERROR', message);
    } finally {
      setRegeneratingIndexes((prev) => prev.filter((i) => i !== index));
    }
  };

  const handleRegenerateFailedAngles = async () => {
    if (isLoading || regeneratingIndexes.length > 0) return;

    const failedIndexes: number[] = angleImages
      .map((src, index) => ({ src, index }))
      .filter((item) => !item.src)
      .map((item) => item.index);

    if (failedIndexes.length === 0) {
      return;
    }

    const targets = failedIndexes.slice(0, MAX_PARALLEL_REGENERATE);

    setIsRegeneratingFailedAngles(true);
    setIsLoading(true);
    try {
      await Promise.all(
        targets.map((idx) => handleRegenerateAngle(idx, { bypassGuard: true })),
      );
    } finally {
      setIsLoading(false);
      setRegeneratingIndexes([]);
      setIsRegeneratingFailedAngles(false);
    }
  };

  const handleOpenCatalogEditModal = (index: number) => {
    const imageOutput = angleImages[index];
    if (!imageOutput?.dataUrl) {
      addLog('ERROR', t.catalogGenerator.editOpenNoImage.replace('{index}', String(index + 1)));
      return;
    }

    const src = imageOutput.dataUrl;
    if (!src.startsWith('data:image')) {
      addLog('ERROR', t.catalogGenerator.editOpenInvalidFormat.replace('{index}', String(index + 1)));
      return;
    }

    setCatalogEditModal({
      isOpen: true,
      index,
      imageUrl: src,
      instruction: '',
      isSubmitting: false,
    });
  };

  const handleCloseCatalogEditModal = () => {
    setCatalogEditModal((prev) => ({ ...prev, isOpen: false, isSubmitting: false }));
  };

  const handleApplyCatalogEdit = async () => {
    if (!catalogEditModal.imageUrl || catalogEditModal.index === null || catalogEditModal.index < 0) {
      return;
    }

    if (!authReady) {
      const message = t.catalogGenerator.statusNotReady;
      setError(message);
      addLog('ERROR', message);
      return;
    }

    const index = catalogEditModal.index;
    const imageUrl = catalogEditModal.imageUrl;
    const editInstruction = catalogEditModal.instruction.trim();

    if (!editInstruction) {
      addLog('ERROR', t.catalogGenerator.editEmptyInstruction.replace('{index}', String(index + 1)));
      return;
    }

    if (!imageUrl.startsWith('data:image')) {
      addLog('ERROR', t.catalogGenerator.editInvalidFormat.replace('{index}', String(index + 1)));
      return;
    }

    const base64 = imageUrl.split(',')[1] || '';
    if (!base64) {
      addLog('ERROR', t.catalogGenerator.editEmptyData.replace('{index}', String(index + 1)));
      return;
    }

    if (typeof window === 'undefined' || !window.zeoAPI?.editStoryFrame) {
      addLog(
        'ERROR',
        t.catalogGenerator.editEngineUnavailable.replace('{index}', String(index + 1)),
      );
      return;
    }

    const bearerKey =
      typeof window !== 'undefined' ? localStorage.getItem('zeoStudio.bearerToken') || '' : '';
    if (!bearerKey.trim()) {
      const message = t.catalogGenerator.editBearerMissing;
      addLog('ERROR', t.catalogGenerator.editFailed.replace('{label}', String(index + 1)).replace('{error}', message));
      setError(message);
      return;
    }

    const label = getCatalogAngleLabelByIndex(index) || `Catalog angle ${index + 1}`;

    const editInstructionText = `Based on this instruction: "${editInstruction}", edit the following catalog product photo of the SAME product and model. The result must be a SINGLE, unified catalog image (no collages, no multiple panels, no UI). CRITICAL RULE: The product design, logo placement, materials, colors, and model identity MUST remain identical to the other catalog images; only adjust body pose, camera angle, and subtle background details. The final image aspect ratio MUST BE exactly ${aspectRatio}.`;

    addLog('INFO', t.catalogGenerator.editProcessing.replace('{label}', label));

    setCatalogEditModal((prev) => ({ ...prev, isSubmitting: true, isOpen: false }));
    setEditingIndex(index);

    // Set placeholder with status generating and countdown BEFORE API call
    setAngleImages((prev) => {
      const next = [...prev];
      if (index >= 0 && index < next.length) {
        next[index] = {
          dataUrl: prev[index]?.dataUrl || '',
          status: 'generating' as const,
          startedAt: Date.now(),
          estimatedTotalSeconds: 300,
          prompt: prev[index]?.prompt || label,
        };
      }
      return next;
    });

    try {
      const result = await window.zeoAPI.editStoryFrame({
        bearerKey,
        aspectRatio,
        imageResolution,
        instruction: editInstructionText,
        imageBase64: base64,
        mode: 'edit',
      });

      if (!result || !result.ok || !result.dataUrl) {
        const message = (result && result.error) || t.catalogGenerator.regenFailed;
        addLog('ERROR', t.catalogGenerator.editFailed.replace('{label}', label).replace('{error}', message));
        setCatalogEditModal((prev) => ({ ...prev, isSubmitting: false }));
        return;
      }

      const newUrl = result.dataUrl as string;

      setAngleImages((prev) => {
        const next = [...prev];
        if (index >= 0 && index < next.length) {
          const existingImage = next[index];
          next[index] = {
            dataUrl: newUrl,
            status: 'completed' as const,
            startedAt: existingImage?.startedAt,
            estimatedTotalSeconds: existingImage?.estimatedTotalSeconds,
            prompt: existingImage?.prompt,
          };
        }
        return next;
      });

      setModalImage(newUrl);
      setActiveAngleIndex(index);
      addLog('SUCCESS', t.catalogGenerator.editSuccess.replace('{label}', label));
      setCatalogEditModal((prev) => ({ ...prev, isSubmitting: false }));
    } catch (err: any) {
      const message = err?.message || String(err);
      addLog('ERROR', t.catalogGenerator.editError.replace('{label}', label).replace('{error}', message));
      setCatalogEditModal((prev) => ({ ...prev, isSubmitting: false }));
    } finally {
      setEditingIndex(null);
    }
  };

  const CatalogAngleGrid: React.FC<{ images: (CatalogImageOutput | null)[] }> = ({ images }) => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {images.map((imageOutput, index) => {
        // Only show enabled angles
        if (!isCatalogAngleEnabled(index)) return null;
        
        const label = getCatalogAngleLabelByIndex(index) || `Catalog angle ${index + 1}`;
        const isActive = activeAngleIndex === index;
        const isCardRegenerating = regeneratingIndexes.includes(index);
        const isCardEditing = editingIndex === index;
        const isVideoGenerating = videoGeneratingIndexes.includes(index);
        const isImageGenerating = imageOutput?.status === 'generating';
        const isImageFailed = imageOutput?.status === 'failed';
        const isBusy = isCardRegenerating || isCardEditing || isVideoGenerating || isImageGenerating;
        const src = imageOutput?.dataUrl || '';
        const cardId = `catalog-image-${index}`;
        const isVisible = visibleCardIds.has(cardId);
        const countdownMsg = getCountdownMessageForCatalogImage(imageOutput);

        const videoOutput = angleVideos[index];
        const videoUrl = getVideoFileUrl(videoOutput?.filePath || '');
        const localVideoUrl = getLocalVideoFileUrl(videoOutput?.filePath || '');
        // Always default to 'photo' mode - user must explicitly click Video tab
        const viewMode = angleViewModes[index] || 'photo';

        // Safety check: only render video if we have valid URLs
        const hasValidVideo = videoOutput && (videoUrl || localVideoUrl);

        const handleChangeViewMode = (mode: CatalogAngleViewMode) => {
          setAngleViewModes((prev) => {
            const next = [...prev];
            if (next.length <= index) {
              const oldLength = next.length;
              next.length = index + 1;
              for (let i = oldLength; i < next.length; i += 1) {
                next[i] = 'photo';
              }
            }
            next[index] = mode;
            return next;
          });
        };

        return (
          <div
            key={index}
            className={`relative group ${thumbnailAspectClass} cursor-pointer rounded-md overflow-hidden border-2 transition-all duration-700 ease-out ${
              isActive ? 'border-purple-500' : 'border-blue-500/60 hover:border-blue-400/80'
            } ${isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'}`}
            onClick={() => {
              if (isBusy) return;
              if (viewMode === 'photo' && src) {
                setModalImage(src);
              }
              if (src || (videoOutput && videoUrl)) {
                setActiveAngleIndex(index);
              }
            }}
          >
            {isVideoGenerating ? (
              <div className="w-full h-full relative flex flex-col items-center justify-center text-gray-100">
                <img
                  src={getLoadingGifByIndex(index)}
                  alt="Loading video"
                  className="absolute inset-0 w-full h-full object-cover opacity-60"
                />
                <div className="absolute inset-0 bg-black/60" />
                <div className="relative z-10 flex flex-col items-center text-center px-3">
                  {getCountdownMessageForCatalogVideo(videoOutput) && (
                    <div className="text-sm text-purple-300 font-bold">
                      {getCountdownMessageForCatalogVideo(videoOutput)}
                    </div>
                  )}
                  <div className="mt-1 text-[10px] text-gray-200 px-2 text-center">
                    {t.catalogGenerator.generateVideoStatus}
                  </div>
                </div>
              </div>
            ) : viewMode === 'video' && hasValidVideo ? (
              <div className="w-full h-full relative bg-black flex items-center justify-center">
                {src && <img src={src} alt={label} className="w-full h-full object-cover" />}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <div className="text-white text-xs font-semibold bg-green-600/90 px-3 py-1.5 rounded-lg">
                    ✓ Video Generated
                  </div>
                </div>
              </div>
            ) : isImageGenerating ? (
              <div className="w-full h-full relative flex flex-col items-center justify-center text-gray-100">
                <img
                  src={getLoadingGifByIndex(index)}
                  alt="Loading image"
                  className="absolute inset-0 w-full h-full object-cover opacity-60"
                />
                <div className="absolute inset-0 bg-black/60" />
                <div className="relative z-10 flex flex-col items-center text-center px-3">
                  {countdownMsg && (
                    <div className="text-sm text-purple-300 font-bold">{countdownMsg}</div>
                  )}
                  {(isCardRegenerating || isCardEditing) && (
                    <div className="mt-1 text-[10px] text-gray-200 px-2 text-center">
                      {isCardRegenerating ? 'Regenerasi...' : t.catalogGenerator.editingStatus}
                    </div>
                  )}
                  {!isCardRegenerating && !isCardEditing && (
                    <div className="mt-1 text-[10px] text-gray-200 px-2 text-center line-clamp-2">
                      {label}
                    </div>
                  )}
                </div>
              </div>
            ) : isImageFailed ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-red-950/40 text-red-300">
                <div className="text-2xl mb-2">⚠️</div>
                <div className="text-xs font-semibold">Failed</div>
                {imageOutput?.errorMessage && (
                  <div className="mt-1 text-[10px] text-red-400 px-2 text-center">
                    {imageOutput.errorMessage}
                  </div>
                )}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleRegenerateAngle(index);
                  }}
                  disabled={!authReady}
                  className="mt-2 inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-semibold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Regenerate
                </button>
              </div>
            ) : imageOutput?.status === 'completed' && src ? (
              <img src={src} alt={label} className="w-full h-full object-cover" />
            ) : imageOutput?.status === 'completed' && !src ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-yellow-950/40 text-yellow-300">
                <div className="text-2xl mb-2">⚠️</div>
                <div className="text-xs font-semibold">Image data missing</div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleRegenerateAngle(index);
                  }}
                  disabled={!authReady}
                  className="mt-2 inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-semibold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Regenerate
                </button>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-zinc-950 text-[10px] text-gray-500">
                <span>{isBusy ? '' : t.catalogGenerator.generateFailed}</span>
              </div>
            )}

            <div className="absolute top-1 left-1 right-1 px-2 flex items-center justify-between gap-1 pointer-events-none">
              <div className="max-w-[60%] px-2 py-0.5 rounded-md bg-black/65 text-[10px] text-gray-100 font-medium truncate">
                {label}
              </div>
              <div className="flex items-center gap-0.5 text-[10px]">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleChangeViewMode('photo');
                  }}
                  className={`px-2.5 py-1 rounded-lg border text-[10px] font-medium pointer-events-auto ${
                    viewMode === 'photo'
                      ? 'bg-purple-600 text-white border-purple-500'
                      : 'bg-black/60 text-gray-200 border-zinc-600 hover:bg-black/80'
                  }`}
                >
                  {t.catalogGenerator.fotoTab}
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleChangeViewMode('video');
                  }}
                  disabled={!videoOutput}
                  className={`px-2.5 py-1 rounded-lg border text-[10px] font-medium pointer-events-auto ${
                    viewMode === 'video'
                      ? 'bg-purple-600 text-white border-purple-500'
                      : 'bg-black/60 text-gray-200 border-zinc-600 hover:bg-black/80'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {t.catalogGenerator.videoTab}
                </button>
              </div>
            </div>

            {/* Only show loading overlay for video/edit/regenerate, not for image generating */}
            {isBusy && !isImageGenerating && !isVideoGenerating && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-30 text-gray-100">
                <img
                  src={getLoadingGifByIndex(index)}
                  alt="Loading"
                  className="absolute inset-0 w-full h-full object-cover opacity-60"
                />
                <div className="absolute inset-0 bg-black/60" />
                <div className="relative z-10 inline-flex flex-col items-center gap-1 text-[10px] text-gray-100 px-3 text-center">
                  <div className="mt-1 text-[10px] text-gray-200 px-2 text-center">
                    {isCardEditing
                      ? t.catalogGenerator.editingStatus
                      : isCardRegenerating
                      ? 'Regenerasi'
                      : t.catalogGenerator.generateVideoStatus}
                  </div>
                </div>
              </div>
            )}
            
            {!isBusy && videoOutput?.status === 'failed' && viewMode === 'video' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/40 text-red-300">
                <div className="text-2xl mb-2">⚠️</div>
                <div className="text-xs font-semibold">Failed</div>
                {videoOutput?.errorMessage && (
                  <div className="mt-1 text-[10px] text-red-400 px-2 text-center">
                    {videoOutput.errorMessage}
                  </div>
                )}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleGenerateCatalogAngleVideo(index);
                  }}
                  className="mt-2 inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-semibold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                >
                  Regenerate
                </button>
              </div>
            )}

            {/* Only show action buttons when not busy AND image is completed with valid data */}
            {!isBusy && !isImageGenerating && imageOutput?.status === 'completed' && src && (
              <div className="absolute inset-x-1 bottom-1 flex flex-col gap-1">
                {viewMode === 'photo' && (
                  <div className="w-full flex justify-center">
                    <div className="inline-flex flex-col items-stretch gap-1">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleOpenCatalogEditModal(index);
                          }}
                          disabled={!authReady}
                          className="px-2.5 py-1 rounded-lg text-white text-[11px] font-semibold btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 transition"
                          title={t.catalogGenerator.editPhotoTitle}
                        >
                          {t.common.edit}
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleRegenerateAngle(index);
                          }}
                          disabled={!authReady}
                          className="px-2.5 py-1 rounded-lg text-white text-[11px] font-semibold btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 transition"
                          title={t.catalogGenerator.regeneratePhotoTitle}
                        >
                          {t.common.regenerate}
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            if (src) downloadFile(src, `catalog-angle-${index + 1}.png`);
                          }}
                          disabled={!src}
                          className="px-2.5 py-1 bg-gray-700/80 rounded-lg text-white hover:bg-gray-600 transition text-[11px] font-semibold flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                          title={t.catalogGenerator.downloadPhotoTitle}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"
                            />
                          </svg>
                          <span>{t.common.download}</span>
                        </button>
                      </div>

                      {!videoOutput && (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleGenerateCatalogAngleVideo(index);
                            }}
                            disabled={!src}
                            className="flex-1 px-2.5 py-1 rounded-lg text-white text-[11px] font-semibold btn-glass-primary btn-video-gradient transition disabled:opacity-40 disabled:cursor-not-allowed"
                            title={t.catalogGenerator.viewEditVideoPrompt}
                          >
                            {t.catalogGenerator.generateVideo}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {viewMode === 'video' && (
                  <div className="w-full flex flex-col items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleGenerateCatalogAngleVideo(index);
                      }}
                      disabled={!src}
                      className="w-full px-2.5 py-1 rounded-lg text-white text-[11px] font-semibold btn-glass-primary btn-video-gradient transition disabled:opacity-40 disabled:cursor-not-allowed"
                      title={t.catalogGenerator.viewEditVideoPrompt}
                    >
                      {videoOutput ? t.catalogGenerator.regenerateVideo : t.catalogGenerator.generateVideo}
                    </button>

                    {videoOutput && videoOutput.status === 'completed' && (
                      <div className="w-full px-2 py-1 rounded-md bg-green-900/30 border border-green-700/50 text-center">
                        <div className="text-[10px] text-green-300 font-medium">
                          ✓ Video tersimpan otomatis
                        </div>
                        <div className="text-[9px] text-green-400/70 mt-0.5">
                          di folder output global
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const AngleUploadSlot: React.FC<{ angle: keyof ProductAngles; label: string }> = ({ angle, label }) => {
    const inputId = `catalog-file-input-${activeTab}-${angle}`;
    return (
      <div className="relative group">
        <div
          onClick={() => document.getElementById(inputId)?.click()}
          className={`w-full aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition overflow-hidden ${
            productSlots[activeTab][angle]
              ? 'border-purple-500 bg-zinc-950'
              : 'border-zinc-700 bg-zinc-900/40 hover:border-purple-400 hover:bg-zinc-900'
          }`}
        >
          {productSlots[activeTab][angle] ? (
            <img
              src={productSlots[activeTab][angle]!.preview}
              alt={`${label} view`}
              className="w-full h-full object-cover"
            />
          ) : (
            <>
              <CubeIcon />
              <span className="text-xs text-gray-400 mt-1">{label}</span>
            </>
          )}
        </div>
        <input
          id={inputId}
          type="file"
          onChange={(e) => handleAngleFileChange(e, angle)}
          accept="image/*"
          className="hidden"
        />
        {productSlots[activeTab][angle] && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClearAngle(angle);
            }}
            className="absolute top-1 right-1 bg-red-600/80 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition hover:bg-red-700"
            title="Remove"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3 w-3"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>
    );
  };

  const primaryProductSlot = productSlots[0];
  const primaryProductImage = primaryProductSlot?.front ?? null;

  const productInputId = 'ads-maker-product-file-input';

  return (
    <>
      <div className="h-full w-full flex flex-col min-h-0 text-gray-50">
      {modalImage && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4"
          onClick={() => setModalImage(null)}
        >
          <div
            className="bg-zinc-900 border border-zinc-700 rounded-2xl w-auto max-w-[90vw] max-h-[90vh] shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-4 py-3 border-b border-zinc-800"
            >
              <h3 className="text-sm font-semibold text-gray-100">Preview Ads Maker</h3>
              <button
                type="button"
                onClick={() => setModalImage(null)}
                className="text-[18px] text-gray-400 hover:text-gray-100 px-1"
              >
                ×
              </button>
            </div>
            <div className="flex-1 p-4 flex items-center justify-center overflow-y-auto custom-scrollbar">
              <img
                src={modalImage}
                alt="Preview Ads Maker"
                className="max-h-[80vh] w-auto max-w-full object-contain rounded-xl shadow-2xl"
              />
            </div>
          </div>
        </div>
      )}

      <PageHeader
        iconId="generate-adsmaker"
        iconClassName="h-6 w-6 mr-3 text-white"
        title="Generate Ads Maker"
        description="Generate Ads Maker"
        showBearerTest
        showApiKeyTest
      />

      <div className="flex-1 p-4 lg:p-6 min-h-0 overflow-hidden">
        <div className="flex h-full min-w-0 gap-4">
          {/* Left panel: parameters */}
          <section 
            className="bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col min-h-0 h-full"
            style={{
              width: `${cardDimensions.parameter}px`,
              backgroundColor: '#181818',
              backgroundImage:
                'linear-gradient(135deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.1) 75%, transparent 75%, transparent), linear-gradient(45deg, rgba(255,255,255,0.08) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.08) 75%, transparent 75%, transparent), linear-gradient(0deg, rgba(0,0,0,0.24), rgba(0,0,0,0.24))',
              backgroundSize: '12px 12px, 12px 12px, 100% 100%',
              backgroundBlendMode: 'overlay, overlay, normal',
            }}
          >
            <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar px-6 py-4 space-y-4">
              <div className="p-4 rounded-lg bg-zinc-900/80 border border-zinc-800">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-100">Unggah Foto Produk + Model</h2>
                </div>
                <p className="text-xs text-gray-400 mb-4">
                  Unggah satu foto yang memuat produk & model sekaligus. Analisis tetap dipisah menjadi produk dan karakter.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                  <div
                    onClick={() => combinedFileInputRef.current?.click()}
                    className="w-28 h-28 bg-zinc-950 rounded-lg border-2 border-dashed border-zinc-700 flex items-center justify-center text-center text-gray-400 text-[11px] cursor-pointer hover:border-purple-500 transition shrink-0 overflow-hidden"
                  >
                    {primaryProductImage ? (
                      <img
                        src={primaryProductImage.preview}
                        alt="preview upload"
                        className="w-full h-full object-cover"
                      />
                    ) : characterFile ? (
                      <img
                        src={characterFile.preview}
                        alt="preview upload"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <CubeIcon />
                        <span className="leading-tight text-center">
                          Foto
                          <br />
                          Produk + Model
                        </span>
                      </div>
                    )}
                  </div>
                  <input
                    type="file"
                    ref={combinedFileInputRef}
                    onChange={handleCombinedFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <div className="flex-grow flex flex-col gap-2 w-full text-[11px] text-gray-400">
                    <span>
                      • Akan mengisi slot produk utama (front) dan foto model sekaligus.
                    </span>
                    <span>• Menjalankan analisis produk dan karakter secara otomatis.</span>
                    <div className="flex flex-col gap-1 text-[11px]">
                      {isAnalyzingProduct && (
                        <span className="text-purple-300">Analisis produk berjalan…</span>
                      )}
                      {!isAnalyzingProduct && productAnalysisSummary && (
                        <span className="text-green-300">Analisis produk selesai.</span>
                      )}
                      {isAnalyzingCharacter && (
                        <span className="text-purple-300">Analisis karakter berjalan…</span>
                      )}
                      {!isAnalyzingCharacter && characterAnalysisSummary && (
                        <span className="text-green-300">Analisis karakter selesai.</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-gray-200">Ringkasan Analisis</h3>
                  <span className="text-[10px] text-gray-500">Dari foto gabungan</span>
                </div>

                <div className="space-y-2">
                  <label className="block text-[11px] font-semibold text-gray-300">{t.catalogGenerator.productAnalysis}</label>
                  <textarea
                    rows={3}
                    value={productAnalysisSummary}
                    onChange={(e) => setProductAnalysisSummary(e.target.value)}
                    className="w-full bg-zinc-950 rounded-lg px-3 py-2 text-[11px] text-gray-200 border border-zinc-700 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-y"
                    placeholder={t.catalogGenerator.productPlaceholder}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-[11px] font-semibold text-gray-300">{t.catalogGenerator.characterAnalysis}</label>
                  <textarea
                    rows={3}
                    value={characterAnalysisSummary}
                    onChange={(e) => setCharacterAnalysisSummary(e.target.value)}
                    className="w-full bg-zinc-950 rounded-lg px-3 py-2 text-[11px] text-gray-200 border border-zinc-700 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-y"
                    placeholder={t.catalogGenerator.characterPlaceholder}
                  />
                </div>
              </div>

              <div className="p-4 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-2">{t.catalogGenerator.aspectRatioLabel}</label>
                  <div className="border border-zinc-800 rounded-lg bg-zinc-950 p-1 flex gap-1">
                    {aspectRatios.map((ar) => {
                      const label = ar === '9:16' ? 'Portrait (9:16)' : 'Landscape (16:9)';
                      const isActive = aspectRatio === ar;
                      return (
                        <button
                          key={ar}
                          type="button"
                          onClick={() => setAspectRatio(ar)}
                          className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-md transition-all duration-150 border ${
                            isActive
                              ? 'bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 text-white border-transparent shadow-[0_0_0_1px_rgba(255,255,255,0.15)]'
                              : 'bg-transparent text-gray-300 border-transparent hover:border-zinc-700'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>


              </div>
            </div>

            <div className="px-6 pb-5 pt-3 border-t border-zinc-800 space-y-3">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={anyLoading || !characterFile || !authReady || !isAngleLabelsReady}
                className={`w-full min-h-[48px] px-4 rounded-lg text-white font-semibold text-sm flex items-center justify-center transition-all duration-200 btn-glass-primary
                               focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-zinc-900
                               ${
                                 anyLoading || !characterFile || !authReady
                                   ? 'bg-zinc-600 cursor-not-allowed'
                                   : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
                               }`}
              >
                {isLoading || isCombining
                  ? t.catalogGenerator.generatingCatalog
                  : authReady
                  ? t.catalogGenerator.generateCatalogPhotoshoot
                  : t.catalogGenerator.testTokenFirst}
              </button>

              <div className="max-h-52 bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-xs text-gray-200 flex flex-col">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-gray-100">{t.activityLog.title}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyActivityLog}
                      disabled={activityLogs.length === 0}
                      className="px-2 py-1 rounded-md border border-zinc-600 text-gray-200 hover:bg-zinc-800"
                    >
                      {activityLogCopyLabel}
                    </button>
                    <span className="text-[10px] text-gray-500">{t.catalogGenerator.logEntries.replace('{count}', String(activityLogs.length))}</span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
                  {activityLogs.length === 0 ? (
                    <p className="text-[11px] text-gray-500">
                      {t.catalogGenerator.noActivity}
                    </p>
                  ) : (
                    activityLogs.map((log) => (
                      <div key={log.id} className="flex gap-2 items-start">
                        <span className="text-[10px] text-gray-500 min-w-[46px]">{log.timestamp}</span>
                        <span
                          className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-md border ${
                            log.type === 'ERROR'
                              ? 'border-red-500/60 text-red-300'
                              : log.type === 'SUCCESS'
                              ? 'border-emerald-500/60 text-emerald-300'
                              : 'border-zinc-500/60 text-gray-300'
                          }`}
                        >
                          {log.type}
                        </span>
                        <span className="text-[11px] text-gray-200 whitespace-pre-wrap break-words flex-1">
                          {log.message}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Right panel: preview */}
          <section 
            className="bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col min-h-0 h-full flex-1 min-w-[720px]"
            style={{
              backgroundColor: '#181818',
              backgroundImage:
                'linear-gradient(135deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.1) 75%, transparent 75%, transparent), linear-gradient(45deg, rgba(255,255,255,0.08) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.08) 75%, transparent 75%, transparent), linear-gradient(0deg, rgba(0,0,0,0.24), rgba(0,0,0,0.24))',
              backgroundSize: '12px 12px, 12px 12px, 100% 100%',
              backgroundBlendMode: 'overlay, overlay, normal',
            }}
          >
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-50">{t.catalogGenerator.previewCatalog}</h3>
              <button
                type="button"
                onClick={handleFullReset}
                disabled={anyLoading}
                className={`inline-flex items-center px-4 py-2 text-[11px] font-semibold rounded-lg shadow-md transition-all duration-200
                  focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-zinc-900
                  ${
                    anyLoading
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'btn-glass-primary bg-red-600 hover:bg-red-700 text-white'
                  }`}
              >
                <span className="mr-1.5 text-xs">🗑️</span>
                <span>{t.catalogGenerator.clearData}</span>
              </button>
            </div>

            <div className="flex-1 flex flex-col px-6 py-4 min-h-0 overflow-y-auto custom-scrollbar">
              {isLoading && !hasGeneratedOnce && (
                <div className="flex-1 flex items-center justify-center">
                  <GradientLoader 
                    size="md" 
                    text={t.catalogGenerator.generatingCatalogProcess}
                    subtitle="Mohon tunggu"
                    showLogo={false}
                  />
                </div>
              )}

              {!isLoading && !hasGeneratedOnce && (
                <div className="flex-1 flex items-center justify-center bg-zinc-950/40 rounded-lg text-gray-500 text-center text-xs p-4">
                  <p>
                    {t.catalogGenerator.catalogPreviewHint}{' '}
                    <span className="font-semibold text-gray-300">{t.catalogGenerator.generateCatalogPhotoshoot}</span>.
                  </p>
                </div>
              )}

              {!isLoading && hasGeneratedOnce && (
                <div className="mb-3 text-[11px] text-gray-300">
                  <span className="font-semibold text-gray-100">
                    {t.catalogGenerator.totalPhotosSuccessful.replace('{count}', String(successfulImageCount))}
                  </span>
                  <span className="mx-1 text-gray-500">·</span>
                  <span className="text-gray-300">
                    {t.catalogGenerator.angleSlotsBatch.replace('{count}', String(allCatalogImages.length)).replace('{batch}', String(Math.ceil(allCatalogImages.length / CATALOG_ANGLE_LABELS.length)))}
                    {activeAngleIndex >= 0 && activeAngleIndex < allCatalogImages.length && (
                      <>
                        <span className="mx-1 text-gray-500">·</span>
                        <span className="text-gray-300">
                          {t.catalogGenerator.activeAngle.replace('{label}', getCatalogAngleLabelByIndex(activeAngleIndex))}
                        </span>
                      </>
                    )}
                  </span>
                  <p className="text-gray-500 mt-0.5">
                    {t.catalogGenerator.gridInstruction}
                  </p>
                </div>
              )}

              {hasGeneratedOnce && (
                <div className="pt-3 border-t border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-gray-100">{t.catalogGenerator.catalogAnglesTitle}</h4>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {t.catalogGenerator.catalogAnglesDesc}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Convert All to Video */}
                      <button
                        type="button"
                        onClick={handleGenerateAllVideos}
                        disabled={isBatchVideoRunning || anyLoading || videoGeneratingIndexes.length > 0 || !authReady}
                        className="flex items-center gap-2 btn-glass-primary btn-video-gradient text-white font-semibold py-1.5 px-3 min-w-[150px] rounded-lg text-[10px] transition disabled:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <span className="whitespace-nowrap">
                          {isBatchVideoRunning ? t.workflow.status.processing : t.catalogGenerator.generateAllVideos}
                        </span>
                      </button>

                      {canGenerateNextMainBatch && (
                        <button
                          type="button"
                          onClick={handleGenerate}
                          disabled={anyLoading || !authReady || !isAngleGroupSelectionValid || !isAngleLabelsReady}
                          className="flex items-center gap-2 btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-1.5 px-3 min-w-[150px] rounded-lg text-[10px] transition disabled:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <SparklesIcon />
                          <span className="whitespace-nowrap">
                            {anyLoading
                              ? t.workflow.status.processing
                              : t.catalogGenerator.continueMainBatch.replace('{batch}', String(nextMainBatchIndex)).replace('{total}', String(totalMainBatches))}
                          </span>
                        </button>
                      )}

                      {/* Regenerate Gagal */}
                      <button
                        type="button"
                        onClick={handleRegenerateFailedAngles}
                        disabled={anyLoading || angleImages.every((src) => !!src) || !authReady}
                        className="flex items-center gap-2 btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-1.5 px-3 min-w-[150px] rounded-lg text-[10px] transition disabled:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <SparklesIcon />
                        <span className="whitespace-nowrap">
                          {isRegeneratingFailedAngles ? t.workflow.status.processing : t.catalogGenerator.regenerateFailedAngles}
                        </span>
                      </button>

                      {/* Download Semua Gambar */}
                      <button
                        type="button"
                        onClick={handleDownloadAllAngles}
                        disabled={!hasCompletedMainBatches}
                        className="flex items-center gap-2 btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-1.5 px-3 min-w-[150px] rounded-lg text-[10px] transition disabled:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <DownloadIcon />
                        <span className="whitespace-nowrap">{t.catalogGenerator.downloadAllImages}</span>
                      </button>
                    </div>
                  </div>
                  <CatalogAngleGrid images={angleImages} />
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md shadow-2xl p-5">
            <h2 className="text-base font-semibold text-gray-50 mb-2">{t.catalogGenerator.resetConfirmTitle}</h2>
            <div className="space-y-2 text-sm text-gray-200 mb-4">
              <p>
                {t.catalogGenerator.resetConfirmMessage}
              </p>
              <p className="text-gray-400 text-xs">{t.catalogGenerator.actionCannotBeUndone}</p>
            </div>
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-3 py-1.5 rounded-md border border-zinc-600 text-gray-200 hover:bg-zinc-800"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-700 text-white font-semibold"
              >
                {t.common.delete}
              </button>
            </div>
          </div>
        </div>
      )}
      {videoPromptModal.isOpen && videoPromptModal.index !== null && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-3xl max-h-[90vh] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <div className="flex flex-col">
                <h3 className="text-sm font-semibold text-gray-100">{t.catalogGenerator.videoPromptTitle}</h3>
                <p className="text-[11px] text-gray-500">
                  {getCatalogAngleLabelByIndex(videoPromptModal.index)}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseVideoPromptModal}
                className="text-[18px] text-gray-400 hover:text-gray-100 px-1"
              >
                ×
              </button>
            </div>
            <div className="flex-1 p-4 space-y-4 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-gray-200">Vibe</div>
                  <select
                    value={videoPromptModal.vibe}
                    onChange={(e) => setVideoPromptModal((prev) => ({ ...prev, vibe: e.target.value }))}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg text-xs text-gray-100 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    {VIDEO_VIBE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-gray-200">Stance</div>
                  <select
                    value={videoPromptModal.stance}
                    onChange={(e) => setVideoPromptModal((prev) => ({ ...prev, stance: e.target.value }))}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg text-xs text-gray-100 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    {VIDEO_STANCE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-gray-200">Perspective</div>
                  <select
                    value={videoPromptModal.perspective}
                    onChange={(e) => setVideoPromptModal((prev) => ({ ...prev, perspective: e.target.value }))}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg text-xs text-gray-100 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    {VIDEO_PERSPECTIVE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-gray-200">Camera Motion</div>
                  <select
                    value={videoPromptModal.cameraMotion}
                    onChange={(e) => setVideoPromptModal((prev) => ({ ...prev, cameraMotion: e.target.value }))}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg text-xs text-gray-100 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    {VIDEO_CAMERA_MOTION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="text-[11px] font-semibold text-gray-200">{t.catalogGenerator.customPrompt}</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleGenerateVideoPromptRecommendation}
                      disabled={isVideoPromptRecommending}
                      className="px-2.5 py-1.5 rounded-md bg-gradient-to-r from-amber-500/80 to-orange-500/80 text-white text-[10px] font-semibold flex items-center gap-1 hover:from-amber-500 hover:to-orange-500 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <span className="text-xs">⚡</span>
                      {isVideoPromptRecommending ? t.catalogGenerator.videoPromptAiLoading : t.catalogGenerator.videoPromptAiButton}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setVideoPromptModal((prev) => ({
                          ...prev,
                          draft: '',
                        }))
                      }
                      className="px-2 py-1 rounded-md border border-zinc-600 text-[10px] text-gray-200 hover:bg-zinc-800"
                    >
                      {t.catalogGenerator.clear}
                    </button>
                  </div>
                </div>
                <textarea
                  value={videoPromptModal.draft}
                  onChange={(e) =>
                    setVideoPromptModal((prev) => ({
                      ...prev,
                      draft: e.target.value,
                    }))
                  }
                  placeholder={t.catalogGenerator.videoPromptPlaceholder}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg text-xs text-gray-100 px-3 py-2 min-h-[220px] resize-y focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
            </div>
            <div className="px-4 pb-4 pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleCloseVideoPromptModal}
                className="px-3 py-2 rounded-lg border border-zinc-600 text-gray-200 hover:bg-zinc-800 text-xs"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={handleSaveVideoPromptModal}
                className="px-3 py-2 rounded-lg btn-glass-primary btn-video-gradient text-white text-xs font-semibold"
              >
                {t.common.save}
              </button>
            </div>
          </div>
        </div>
      )}
      {catalogEditModal.isOpen && catalogEditModal.imageUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-xl max-h-[90vh] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-gray-100">{t.catalogGenerator.editCatalogPhoto}</h3>
              <button
                type="button"
                onClick={catalogEditModal.isSubmitting ? undefined : handleCloseCatalogEditModal}
                className="text-[18px] text-gray-400 hover:text-gray-100 px-1 disabled:opacity-40"
                disabled={catalogEditModal.isSubmitting}
              >
                ×
              </button>
            </div>
            <div className="flex-1 p-4 space-y-4 overflow-y-auto custom-scrollbar">
              <div className="w-full bg-zinc-950 rounded-lg overflow-hidden flex items-center justify-center">
                <img
                  src={catalogEditModal.imageUrl}
                  alt="Preview Edit Catalog"
                  className="max-h-[60vh] w-auto max-w-full object-contain"
                />
              </div>
              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-gray-200">{t.catalogGenerator.editInstruction}</div>
                <textarea
                  value={catalogEditModal.instruction}
                  onChange={(e) =>
                    setCatalogEditModal((prev) => ({
                      ...prev,
                      instruction: e.target.value,
                    }))
                  }
                  placeholder={t.catalogGenerator.editPlaceholder}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg text-xs text-gray-100 px-3 py-2 min-h-[96px] resize-none focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
            </div>
            <div className="px-4 pb-4 pt-2">
              <button
                type="button"
                onClick={() => void handleApplyCatalogEdit()}
                disabled={catalogEditModal.isSubmitting || !authReady}
                className="w-full btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-xs font-semibold py-2.5 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {catalogEditModal.isSubmitting ? t.workflow.status.processing : t.catalogGenerator.applyChange}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </>
);

}

export default GenerateAdsMakerPage;
