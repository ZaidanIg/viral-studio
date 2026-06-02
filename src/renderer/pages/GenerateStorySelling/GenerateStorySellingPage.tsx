import React, { useEffect, useRef, useState, useCallback } from 'react';
import PageHeader from '../../shared/components/PageHeader';
import GradientLoader from '../../shared/components/GradientLoader';
import { getFriendlyErrorHint } from '../../shared/utils/friendlyError';
import { useAuthReady } from '../../shared/utils/useAuthReady';
import { useImageResolution } from '../../shared/utils/useImageResolution';
import { useLanguage } from '../../shared/i18n';
import loadingGif0 from "../../../../asset/loading/Buat_jadi_video_cinematic_dan_pastikan_mobil.gif";
import loadingGif1 from "../../../../asset/loading/Buat_jadi_video_cinematic_dan_pastikan_mobil (1).gif";
import loadingGif2 from "../../../../asset/loading/Buat_jadi_video_cinematic_dan_pastikan_mobil (2).gif";
import loadingGif3 from "../../../../asset/loading/Buat_jadi_video_cinematic_dan_pastikan_mobil (3).gif";

// Basic shared types for this page

type ActivityLogEntry = {
  id: number;
  type: 'INFO' | 'SUCCESS' | 'ERROR';
  message: string;
  timestamp: string;
};

const STORYSELLING_TUTORIAL_URL = 'https://www.youtube.com/embed/vlfBk1-6BOs?autoplay=1&mute=1&origin=http://localhost:3000';

type ImageFile = {
  file: File;
  preview: string;
};

type TtsVoice = {
  id: string;
  name: string;
  tone: string;
  gender: 'LK' | 'PR';
};

type ThumbnailEditModalState = {
  isOpen: boolean;
  variantIndex: number | null;
  thumbIndex: number | null;
  imageUrl: string | null;
  instruction: string;
  isSubmitting: boolean;
};

type StoryVoHookVideoOutput = {
  fileName: string;
  filePath: string;
  sceneIndex?: number;
  status?: 'generating' | 'completed' | 'failed';
  startedAt?: number;
  estimatedTotalSeconds?: number;
  prompt?: string;
  errorMessage?: string;
  generationMode?: 'new' | 'regen';
};

type StoryVoVideoPhase = 'PROBLEM' | 'DISCOVERY' | 'TRANSFORMATION' | 'INVITATION';

const getVideoFileUrl = (filePath?: string): string | null => {
  if (!filePath) return null;
  const encoded = encodeURIComponent(filePath);
  return `http://localhost:3123/video?path=${encoded}`;
};

type StoryVoVideoAspectOption = '9:16';

type StoryVoVideoSettings = {
  aspectRatio: StoryVoVideoAspectOption;
  veoModel: '3.1-fast-low';
  resolution: '720p';
};

const STORY_VO_VIDEO_SETTINGS: StoryVoVideoSettings = {
  aspectRatio: '9:16',
  veoModel: '3.1-fast-low',
  resolution: '720p',
};

const loadingGifs = [loadingGif0, loadingGif1, loadingGif2, loadingGif3];
const getLoadingGifByIndex = (index: number) => loadingGifs[index % loadingGifs.length];

const TTS_VOICES: TtsVoice[] = [
  { id: 'Zephyr', name: 'Zephyr', tone: 'Ceria', gender: 'LK' },
  { id: 'Puck', name: 'Puck', tone: 'Semangat', gender: 'LK' },
  { id: 'Charon', name: 'Charon', tone: 'Informatif', gender: 'LK' },
  { id: 'Kore', name: 'Kore', tone: 'Tegas', gender: 'PR' },
  { id: 'Fenrir', name: 'Fenrir', tone: 'Bersemangat', gender: 'LK' },
  { id: 'Leda', name: 'Leda', tone: 'Muda', gender: 'PR' },
  { id: 'Orus', name: 'Orus', tone: 'Tegas', gender: 'LK' },
  { id: 'Aoede', name: 'Aoede', tone: 'Santai', gender: 'PR' },
  { id: 'Callirrhoe', name: 'Callirrhoe', tone: 'Tenang', gender: 'PR' },
  { id: 'Autonoe', name: 'Autonoe', tone: 'Ceria', gender: 'PR' },
  { id: 'Enceladus', name: 'Enceladus', tone: 'Lembut', gender: 'LK' },
  { id: 'Iapetus', name: 'Iapetus', tone: 'Jelas', gender: 'LK' },
  { id: 'Umbriel', name: 'Umbriel', tone: 'Tenang', gender: 'PR' },
  { id: 'Algieba', name: 'Algieba', tone: 'Halus', gender: 'LK' },
  { id: 'Despina', name: 'Despina', tone: 'Halus', gender: 'PR' },
  { id: 'Erinome', name: 'Erinome', tone: 'Jelas', gender: 'PR' },
  { id: 'Algenib', name: 'Algenib', tone: 'Serak', gender: 'LK' },
  { id: 'Rasalgethi', name: 'Rasalgethi', tone: 'Informatif', gender: 'LK' },
  { id: 'Laomedeia', name: 'Laomedeia', tone: 'Semangat', gender: 'PR' },
  { id: 'Achernar', name: 'Achernar', tone: 'Lembut', gender: 'LK' },
  { id: 'Alnilam', name: 'Alnilam', tone: 'Tegas', gender: 'LK' },
  { id: 'Schedar', name: 'Schedar', tone: 'Datar', gender: 'LK' },
  { id: 'Gacrux', name: 'Gacrux', tone: 'Dewasa', gender: 'LK' },
  { id: 'Pulcherrima', name: 'Pulcherrima', tone: 'Tegas', gender: 'PR' },
  { id: 'Achird', name: 'Achird', tone: 'Ramah', gender: 'PR' },
  { id: 'Zubenelgenubi', name: 'Zubenelgenubi', tone: 'Kasual', gender: 'LK' },
  { id: 'Vindemiatrix', name: 'Vindemiatrix', tone: 'Lembut', gender: 'PR' },
  { id: 'Sadachbia', name: 'Sadachbia', tone: 'Hidup', gender: 'LK' },
  { id: 'Sadaltager', name: 'Sadaltager', tone: 'Berpengetahuan', gender: 'LK' },
  { id: 'Sulafat', name: 'Sulafat', tone: 'Hangat', gender: 'PR' },
];

const TTS_TONE_MAP: Record<string, Record<string, string>> = {
  Ceria: { en: 'Cheerful', id: 'Ceria', ms: 'Ceria' },
  Semangat: { en: 'Energetic', id: 'Semangat', ms: 'Bersemangat' },
  Informatif: { en: 'Informative', id: 'Informatif', ms: 'Informatif' },
  Tegas: { en: 'Firm', id: 'Tegas', ms: 'Tegas' },
  Bersemangat: { en: 'Enthusiastic', id: 'Bersemangat', ms: 'Bersemangat' },
  Muda: { en: 'Youthful', id: 'Muda', ms: 'Muda' },
  Santai: { en: 'Relaxed', id: 'Santai', ms: 'Santai' },
  Tenang: { en: 'Calm', id: 'Tenang', ms: 'Tenang' },
  Lembut: { en: 'Soft', id: 'Lembut', ms: 'Lembut' },
  Jelas: { en: 'Clear', id: 'Jelas', ms: 'Jelas' },
  Halus: { en: 'Gentle', id: 'Halus', ms: 'Halus' },
  Serak: { en: 'Husky', id: 'Serak', ms: 'Serak' },
  Datar: { en: 'Flat', id: 'Datar', ms: 'Datar' },
  Dewasa: { en: 'Mature', id: 'Dewasa', ms: 'Dewasa' },
  Ramah: { en: 'Friendly', id: 'Ramah', ms: 'Mesra' },
  Kasual: { en: 'Casual', id: 'Kasual', ms: 'Kasual' },
  Hidup: { en: 'Lively', id: 'Hidup', ms: 'Hidup' },
  Berpengetahuan: { en: 'Knowledgeable', id: 'Berpengetahuan', ms: 'Berpengetahuan' },
  Hangat: { en: 'Warm', id: 'Hangat', ms: 'Hangat' },
};

const getLocalizedTone = (tone: string, lang: string): string => {
  return TTS_TONE_MAP[tone]?.[lang] || TTS_TONE_MAP[tone]?.id || tone;
};

const getTtsVoiceById = (id: string | null | undefined): TtsVoice | null => {
  if (!id) return null;
  const voice = TTS_VOICES.find((v) => v.id === id);
  return voice || null;
};

const buildVoiceStyleHint = (voiceId?: string): string | null => {
  const voice = getTtsVoiceById(voiceId);
  if (!voice) return null;
  const genderText = voice.gender === 'PR' ? 'female' : 'male';
  const toneText = voice.tone.toLowerCase();
  return `TTS voice style for the main narration is a ${genderText} voice with a ${toneText} character (${voice.name}). Align facial expression, body language, and motion rhythm with this voice style.`;
};

const chooseDefaultVoiceForPersona = (personaText: string): string | null => {
  const text = personaText.toLowerCase();

  const isFemale = /female|woman|girl|ibu|mama|istri|perempuan|wanita|cewek|perempuan/.test(text);
  const isMale = /male|man|boy|bapak|ayah|suami|laki-laki|pria|cowok/.test(text);

  const findFirst = (ids: string[]): string | null => {
    const found = ids.find((id) => TTS_VOICES.some((v) => v.id === id));
    return found || null;
  };

  if (isFemale) {
    return findFirst(['Autonoe', 'Callirrhoe', 'Umbriel', 'Achird', 'Sulafat', 'Leda']);
  }

  if (isMale) {
    return findFirst(['Zephyr', 'Puck', 'Orus', 'Gacrux', 'Alnilam', 'Fenrir']);
  }

  return null;
};

const getInitialVoiceId = (): string => {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('zeoStudio.storyVo.voiceId') || '';
      if (stored && TTS_VOICES.some((v) => v.id === stored)) {
        return stored;
      }
    } catch {}
  }
  return TTS_VOICES[0]?.id || '';
};

const GEMINI_TEXT_MODEL = 'gemini-2.5-flash';
const GEMINI_TTS_MODEL = 'gemini-2.5-flash-preview-tts';
const MAX_STORY_VARIANTS = 1;
const THUMBNAIL_BATCH_SIZE = 1;

// Aspect ratio for Story Selling thumbnails (currently fixed to 9:16)
type ThumbnailAspectRatioOption = '9:16';

type EngineAspectRatioKey = 'portrait' | 'vertical' | 'square' | 'landscape';

const DEFAULT_THUMBNAIL_ASPECT_RATIO: ThumbnailAspectRatioOption = '9:16';

const mapThumbnailAspectRatioToEngineKey = (
  _aspectRatio: ThumbnailAspectRatioOption,
): EngineAspectRatioKey => {
  // All Story Selling thumbnails are 9:16, mapped to 'portrait' in the engine.
  return 'portrait';
};

// Combined character + product analysis parameters for story selling & thumbnail
const STORY_VO_ANALYSIS_PARAMETERS: string[] = [
  'Persona & Demographics (estimated age, gender, lifestyle)',
  'Main facial expression & mood of the character',
  'Character facial details (face shape, skin tone, eye shape/color, lip shape/color, smile, and any unique traits such as dimples or glasses)',
  'Character hair style and color (length, straight/curly, parting/bangs, and main hair color)',
  'Primary outfit worn by the character (top/bottom/outerwear type and dominant colors)',
  'Body language & character position relative to the product',
  'Main product clearly visible in the photo (name/type/shape; if unclear, say "product not clearly visible")',
  'Product’s visual role as a solution (only from visible product; if unclear, say "unclear")',
  'Room/environment context (bedroom, living room, kitchen, etc.) — only if visible; otherwise say "not visible"',
  'Interior style / visual atmosphere (minimalist, cozy, luxurious, etc.) — only if visible; otherwise say "not visible"',
  'Implied problem observable from the photo (before the product helps) — avoid inventing objects not in the photo',
  'Transformation or benefit implied from the character + product combo (from visible cues only)',
  'Dominant colors & strongest color combinations (e.g., white-gray, warm light, etc.)',
  'Main lighting type (warm, cool, soft, dramatic, etc.)',
  'Main camera angle & composition (close-up, medium, wide; character & product position in frame)',
  'Primary visual focal point in the photo (face, product, specific detail, etc.)',
  'Safe area for thumbnail text placement (relatively empty/negative space)',
];

const STORY_PRODUCT_GUARDRAIL =
  'CRITICAL: Describe ONLY objects actually visible in the uploaded photo. Do NOT invent or assume items like cups, drinks, food, or props that are not clearly seen. If the main product is unclear, explicitly say "product not clearly visible" and keep the description generic without adding new objects.';

const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

const writeString = (view: DataView, offset: number, value: string) => {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
};

const pcmToWav = (pcmData: ArrayBuffer, sampleRate: number): Blob => {
  const pcm16 = new Int16Array(pcmData);
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcm16.length * (bitsPerSample / 8);

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < pcm16.length; i += 1) {
    view.setInt16(44 + i * 2, pcm16[i], true);
  }

  return new Blob([view], { type: 'audio/wav' });
};

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

const callGemini = async (
  apiKey: string,
  model: string,
  payload: unknown,
  expect: 'text' | 'image',
): Promise<string> => {
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  let attempt = 0;
  const maxAttempts = 3;
  let delay = 1000;
  let lastError: unknown;
  let lastStatus: number | null = null;

  while (attempt < maxAttempts) {
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result: any = await response.json();
        const candidate = result?.candidates?.[0];

        if (!candidate) {
          if (result?.promptFeedback?.blockReason) {
            throw new Error(`Blocked by safety: ${result.promptFeedback.blockReason}`);
          }
          throw new Error('Gemini response is empty or invalid.');
        }

        if (expect === 'text') {
          const partWithText = candidate.content?.parts?.find((p: any) => typeof p.text === 'string');
          const text: string | undefined = partWithText?.text ?? candidate.content?.parts?.[0]?.text;
          if (!text) throw new Error('No text data received from Gemini.');
          return text;
        }

        const partWithImage = candidate.content?.parts?.find(
          (p: any) => p.inlineData && typeof p.inlineData.data === 'string',
        );
        const base64Data: string | undefined = partWithImage?.inlineData?.data;

        if (!base64Data) {
          const textPart: string | undefined = candidate.content?.parts?.[0]?.text;
          if (textPart) {
            throw new Error(`Gemini returned text instead of image: ${textPart}`);
          }
          throw new Error('No image data received from Gemini.');
        }

        return `data:image/png;base64,${base64Data}`;
      }

      lastStatus = response.status;

      if (response.status === 429 || response.status >= 500) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
        attempt += 1;
        continue;
      }

      throw new Error(`Gemini API error: ${response.status}`);
    } catch (err) {
      lastError = err;
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
      attempt += 1;
    }
  }

  if (typeof lastStatus === 'number') {
    if (lastStatus === 401 || lastStatus === 403) {
      throw new Error(
        'Gemini rejected the request (401/403). Recheck the Gemini API Key and project access permissions in Settings.',
      );
    }

    if (lastStatus === 429) {
      throw new Error(
        'Gemini is rate limiting because quota or call limits are reached (429). Wait a few minutes then retry, or reduce the number of prompts/images generated at once.',
      );
    }

    if (lastStatus >= 500 && lastStatus < 600) {
      throw new Error(
        'Gemini service is experiencing server-side issues (5xx). Wait a few minutes then retry.',
      );
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error('Failed to call Gemini. Check internet connection and AI settings, then retry.');
};

const callGeminiTts = async (
  apiKey: string,
  payload: unknown,
): Promise<{ audioData: string; sampleRate: number }> => {
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent?key=${apiKey}`;

  let attempt = 0;
  const maxAttempts = 3;
  let delay = 1000;
  let lastError: unknown;
  let lastStatus: number | null = null;

  while (attempt < maxAttempts) {
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result: any = await response.json();
        const inlineData = result?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
        const audioData: string | undefined = inlineData?.data;
        const mimeType: string | undefined = inlineData?.mimeType;

        if (!audioData || !mimeType || !mimeType.startsWith('audio/')) {
          throw new Error('No valid audio data returned from Gemini TTS.');
        }

        const sampleRateMatch = mimeType.match(/rate=(\d+)/);
        const sampleRate = sampleRateMatch ? parseInt(sampleRateMatch[1], 10) : 24000;

        return { audioData, sampleRate };
      }

      lastStatus = response.status;

      if (response.status === 429 || response.status >= 500) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
        attempt += 1;
        continue;
      }

      throw new Error(`Gemini TTS API error: ${response.status}`);
    } catch (err) {
      lastError = err;
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
      attempt += 1;
    }
  }

  if (typeof lastStatus === 'number') {
    if (lastStatus === 401 || lastStatus === 403) {
      throw new Error(
        'Gemini TTS rejected the request (401/403). Recheck the Gemini API Key and access permissions in Settings before retrying.',
      );
    }

    if (lastStatus === 429) {
      throw new Error(
        'Gemini TTS is temporarily rate limiting because quota or call limits were reached (429). Wait a few minutes then retry, or reduce audio generation frequency.',
      );
    }

    if (lastStatus >= 500 && lastStatus < 600) {
      throw new Error(
        'Gemini TTS service is experiencing server-side issues (5xx). Wait a few minutes then retry.',
      );
    }
  }

  throw new Error('Failed to call Gemini TTS. Check your internet connection and Gemini API Key in Settings, then retry.');
};

const compressImage = (file: File, maxWidth = 1024, maxHeight = 1024): Promise<string> =>
  new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const img = new Image();
          img.onload = () => {
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
              }
            } else if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Canvas context is not available'));
              return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/png');
            resolve(dataUrl);
          };
          img.onerror = (err) => reject(err || new Error('Failed to load image'));
          img.src = reader.result as string;
        } catch (err) {
          reject(err as Error);
        }
      };
      reader.onerror = (err) => reject(err || new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    } catch (err) {
      reject(err as Error);
    }
  });

const getBase64PayloadFromDataUrl = (dataUrl: string): string => {
  if (!dataUrl) return '';
  if (!dataUrl.startsWith('data:')) return dataUrl;
  const parts = dataUrl.split(',');
  return parts[1] || '';
};

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const parseStoryVariants = (raw: string): string[] => {
  if (!raw) return [];
  const normalized = raw.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const bySeparator = normalized
    .split(/\n-{3,}\s*\n/g)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);
  if (bySeparator.length > 1) return bySeparator;

  const byBlankLines = normalized
    .split(/\n\s*\n+/g)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);
  if (byBlankLines.length > 1) return byBlankLines;

  return [normalized];
};

const StorySellingHeaderIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
    />
  </svg>
);

const GenerateStorySellingPage: React.FC = () => {
  const authReady = useAuthReady();
  const [imageResolution] = useImageResolution();

  // Calculate fixed card dimensions based on resolution
  const cardDimensions = imageResolution === '1366x768' 
    ? { parameter: 427, preview: 907 }
    : { parameter: 599, preview: 1273 };

  const [combinedFile, setCombinedFile] = useState<ImageFile | null>(null);

  const [discoveryRef, setDiscoveryRef] = useState<ImageFile | null>(null);
  const [transformationRef, setTransformationRef] = useState<ImageFile | null>(null);
  const [invitationRef, setInvitationRef] = useState<ImageFile | null>(null);

  const [problem, setProblem] = useState('');
  const [discovery, setDiscovery] = useState('');
  const [transformation, setTransformation] = useState('');
  const [invitation, setInvitation] = useState('');

  const [storyScript, setStoryScript] = useState('');
  const [storyVariants, setStoryVariants] = useState<string[]>([]);
  const [activeVariantIndex, setActiveVariantIndex] = useState<number>(0);
  const [isEditingStory, setIsEditingStory] = useState<boolean>(false);
  const [editingStoryText, setEditingStoryText] = useState<string>('');
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [generatedCaption, setGeneratedCaption] = useState<string>('');
  const [generatedHashtags, setGeneratedHashtags] = useState<string[]>([]);
  const [isGeneratingCaption, setIsGeneratingCaption] = useState<boolean>(false);

  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(getInitialVoiceId);
  const [hasUserChangedVoice, setHasUserChangedVoice] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioUrls, setAudioUrls] = useState<(string | null)[]>([]);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [thumbnailsByVariant, setThumbnailsByVariant] = useState<string[][]>([]);
  const [variantVoiceIds, setVariantVoiceIds] = useState<string[]>([]);

  const [thumbnailAspectRatio, setThumbnailAspectRatio] =
    useState<ThumbnailAspectRatioOption>(DEFAULT_THUMBNAIL_ASPECT_RATIO);
  const [thumbnailEditModal, setThumbnailEditModal] = useState<ThumbnailEditModalState>({
    isOpen: false,
    variantIndex: null,
    thumbIndex: null,
    imageUrl: null,
    instruction: '',
    isSubmitting: false,
  });
  const [editingThumbnailKey, setEditingThumbnailKey] = useState<string | null>(null);
  const [regeneratingThumbnailKey, setRegeneratingThumbnailKey] = useState<string | null>(null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(null);

  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);
  const [thumbnailGenerationFailed, setThumbnailGenerationFailed] = useState(false);

  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [imageAnalysisSummary, setImageAnalysisSummary] = useState('');

  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const { t, language } = useLanguage();
  const [activityLogCopyLabel, setActivityLogCopyLabel] = useState<string>(t.activityLog.copyLog);
  const [error, setError] = useState<string | null>(null);

  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState<number>(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  const [audioSampleRate, setAudioSampleRate] = useState<number | null>(null);
  const [audioSampleRates, setAudioSampleRates] = useState<(number | null)[]>([]);

  const [hookVideosByVariant, setHookVideosByVariant] = useState<StoryVoHookVideoOutput[][]>([]);
  const [hookVideoGeneratingVariants, setHookVideoGeneratingVariants] = useState<number[]>([]);
  const [now, setNow] = useState<number>(Date.now());
  const [visibleVideoCardIds, setVisibleVideoCardIds] = useState<Set<string>>(new Set());
  const videoCardRevealTimeouts = useRef<NodeJS.Timeout[]>([]);

  const [storyVideoPhase, setStoryVideoPhase] = useState<StoryVoVideoPhase>('PROBLEM');
  const [isGeneratingAllVideos, setIsGeneratingAllVideos] = useState(false);
  const [videoGenerationStatus, setVideoGenerationStatus] = useState<'idle' | 'generating' | 'completed' | 'partial'>('idle');
  const [failedVideoPhases, setFailedVideoPhases] = useState<StoryVoVideoPhase[]>([]);
  const [hasAttemptedVideoGeneration, setHasAttemptedVideoGeneration] = useState(false);

  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const combinedInputRef = useRef<HTMLInputElement>(null);
  const discoveryRefInputRef = useRef<HTMLInputElement>(null);
  const transformationRefInputRef = useRef<HTMLInputElement>(null);
  const invitationRefInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoBatchPhaseMapRef = useRef<Record<string, StoryVoVideoPhase>>({});

  // Countdown timer for video generation
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-fail videos that exceed estimated time
  useEffect(() => {
    setHookVideosByVariant((prev) => {
      let hasChanges = false;
      const updated = prev.map((variantVideos) => {
        return variantVideos.map((video) => {
          if (video && video.status === 'generating' && video.startedAt) {
            const elapsed = Math.floor((now - video.startedAt) / 1000);
            const totalSeconds = video.estimatedTotalSeconds ?? 120;
            
            if (elapsed >= totalSeconds) {
              hasChanges = true;
              return {
                ...video,
                status: 'failed' as const,
                errorMessage: 'Video generation timeout',
              };
            }
          }
          return video;
        });
      });
      
      return hasChanges ? updated : prev;
    });
  }, [now]);

  const getRemainingSecondsForVideo = (video: StoryVoHookVideoOutput | null | undefined): number | null => {
    if (!video || !video.startedAt || video.status !== 'generating') return null;
    const elapsed = Math.floor((now - video.startedAt) / 1000);
    const totalSeconds = video.estimatedTotalSeconds ?? 120;
    const remaining = totalSeconds - elapsed;
    return Math.max(0, remaining);
  };

  const getCountdownMessageForVideo = (video: StoryVoHookVideoOutput | null | undefined): string | null => {
    if (!video || video.status !== 'generating') return null;
    const remaining = getRemainingSecondsForVideo(video);
    if (remaining == null) return null;
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const addLog = (type: ActivityLogEntry['type'], message: string) => {
    if (!message) return;
    const prefixedMessage = `[StorySelling] ${message}`;
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

  const updateVideoGenerationStatus = useCallback(() => {
    const allPhases: StoryVoVideoPhase[] = ['PROBLEM', 'DISCOVERY', 'TRANSFORMATION', 'INVITATION'];
    const completedPhases: StoryVoVideoPhase[] = [];
    const failedPhases: StoryVoVideoPhase[] = [];

    allPhases.forEach((phase, index) => {
      const phaseVideos = hookVideosByVariant[index] || [];
      const hasVideo = phaseVideos.length > 0 && phaseVideos[0] !== undefined;
      const isGenerating = hookVideoGeneratingVariants.includes(index);
      
      if (hasVideo) {
        completedPhases.push(phase);
      } else if (isGenerating) {
        // Still generating, don't mark as failed yet
      } else if (hasAttemptedVideoGeneration) {
        // If we've attempted generation before and this phase is not completed and not currently generating
        failedPhases.push(phase);
      }
    });

    setFailedVideoPhases(failedPhases);

    if (isGeneratingAllVideos) {
      setVideoGenerationStatus('generating');
    } else if (completedPhases.length === 4) {
      setVideoGenerationStatus('completed');
    } else if (completedPhases.length > 0 || failedPhases.length > 0) {
      setVideoGenerationStatus('partial');
    } else {
      setVideoGenerationStatus('idle');
    }
  }, [hookVideosByVariant, hookVideoGeneratingVariants, isGeneratingAllVideos, hasAttemptedVideoGeneration]);

  // Update status whenever relevant states change
  useEffect(() => {
    updateVideoGenerationStatus();
  }, [updateVideoGenerationStatus]);

  const handleRegenerateFailedVideos = async () => {
    if (failedVideoPhases.length === 0) return;
    
    setIsGeneratingAllVideos(true);
    addLog('INFO', t.storySellingGenerator.regeneratingFailedPhases.replace('{count}', String(failedVideoPhases.length)));
    
    try {
      for (const phase of failedVideoPhases) {
        const phaseIndex = getVideoPhaseIndex(phase);
        await handleGenerateVideoHooksForVariant(activeVariantIndex, phase, 0);
      }
      addLog('SUCCESS', t.storySellingGenerator.failedRegenCompleted);
    } catch (error) {
      addLog('ERROR', t.storySellingGenerator.someFailedNotRegenerated);
    } finally {
      setIsGeneratingAllVideos(false);
    }
  };

  const handleGenerateVideos = async () => {
    const variantsFromState = storyVariants.length > 0 ? storyVariants : storyScript.trim() ? [storyScript] : [];
    if (variantsFromState.length === 0) {
      setError(t.storySellingGenerator.narrationNotAvailable);
      addLog('ERROR', t.storySellingGenerator.generateVideoCanceled);
      return;
    }

    setHasAttemptedVideoGeneration(true);
    setFailedVideoPhases([]);
    setVideoGenerationStatus('idle');

    // Jalankan 4 fase video paralel (tanpa thumbnail)
    addLog(
      'INFO',
      t.storySellingGenerator.startingGenerate4Phases,
    );

    await handleGenerateAllVideoPhases(0);
  };

  const applyAutoVoiceFromAnalysis = (rawAnalysis: Record<string, unknown>) => {
    if (hasUserChangedVoice) return;

    const personaKey = 'Persona & Demografi (perkiraan usia, gender, gaya hidup)';
    const personaRaw =
      typeof rawAnalysis[personaKey] === 'string'
        ? (rawAnalysis[personaKey] as string)
        : '';

    const autoVoiceId = chooseDefaultVoiceForPersona(personaRaw);
    if (!autoVoiceId || autoVoiceId === selectedVoiceId) return;

    setSelectedVoiceId(autoVoiceId);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('zeoStudio.storyVo.voiceId', autoVoiceId);
      } catch {}
    }

    setVariantVoiceIds((prev) => {
      if (!prev.length) return prev;
      const next = [...prev];
      for (let i = 0; i < next.length; i += 1) {
        if (!next[i]) {
          next[i] = autoVoiceId;
        }
      }
      return next;
    });
  };

  useEffect(() => {
    if (!error) return;
    const timeout = setTimeout(() => {
      setError(null);
    }, 5000);
    return () => clearTimeout(timeout);
  }, [error]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.zeoAPI?.onBatchUpdate) return undefined;

    const unsubscribe = window.zeoAPI.onBatchUpdate?.((update: any) => {
      if (!update) return;

      const workflow = (update.workflow || '').toString().toLowerCase();
      if (!workflow.includes('affiliate video')) {
        return;
      }

      const categoryRaw = (update.category || '').toString().toLowerCase();
      if (!categoryRaw.startsWith('story-vo-v')) {
        return;
      }

      const message: string = update.message || '';

      let variantIndex: number | null = null;
      const match = categoryRaw.match(/story-vo-v(\d+)/);
      if (match && match[1]) {
        const num = Number.parseInt(match[1], 10);
        if (Number.isFinite(num) && num > 0) {
          variantIndex = num - 1;
        }
      }

      if (variantIndex === null || variantIndex < 0) {
        if (message) addLog('INFO', message);
        return;
      }

      const phaseForCategory: StoryVoVideoPhase =
        videoBatchPhaseMapRef.current[categoryRaw] || 'PROBLEM';
      const rowIndex = getVideoPhaseIndex(phaseForCategory);

      const phaseLabelForLog =
        phaseForCategory === 'PROBLEM'
          ? 'Problem'
          : phaseForCategory === 'DISCOVERY'
          ? 'Discovery'
          : phaseForCategory === 'TRANSFORMATION'
          ? 'Transformation'
          : 'Invitation';

      const withPhase = (text: string | null | undefined): string => {
        const base = (text || '').trim();
        if (!base) return '';
        // Remove scene numbers like "#1", "#2", etc. from the message since each phase only has 1 video
        const cleanedBase = base.replace(/#\d+/g, '').replace(/\s+/g, ' ').trim();
        return `Video ${phaseLabelForLog} · ${cleanedBase}`;
      };

      if (
        update.type === 'INFO' ||
        update.type === 'BATCH_TOTAL' ||
        update.type === 'PROGRESS'
      ) {
        const msg = withPhase(message);
        if (msg) addLog('INFO', msg);
        return;
      }

      if (update.type === 'SCENE_COMPLETED') {
        const sceneIndex: number | null =
          typeof update.index === 'number' && Number.isFinite(update.index)
            ? update.index
            : null;
        if (sceneIndex && update.fileName && update.filePath) {
          const hookIndex = sceneIndex - 1;
          setHookVideosByVariant((prev) => {
            const next = [...prev];
            while (next.length <= rowIndex) {
              next.push([]);
            }
            const current = [...(next[rowIndex] || [])];
            while (current.length <= hookIndex) {
              current.push(undefined as any);
            }
            
            // Update existing placeholder or create new
            const existingVideo = current[hookIndex];
            current[hookIndex] = {
              fileName: String(update.fileName),
              filePath: String(update.filePath),
              sceneIndex,
              status: 'completed' as const,
              startedAt: existingVideo?.startedAt,
              estimatedTotalSeconds: existingVideo?.estimatedTotalSeconds,
              prompt: existingVideo?.prompt,
            };
            next[rowIndex] = current;
            return next;
          });
        }
        {
          const msg = withPhase(message);
          if (msg) addLog('SUCCESS', msg);
        }
        return;
      }

      if (update.type === 'BATCH_COMPLETE') {
        setHookVideoGeneratingVariants((prev) => prev.filter((idx) => idx !== rowIndex));

        const successCount =
          typeof update.successCount === 'number' ? Number(update.successCount) : null;

        if (successCount === 0) {
          const msg = withPhase(message);
          if (msg) addLog('ERROR', msg);
        } else {
          const msg = withPhase(message);
          if (msg) addLog('SUCCESS', msg);
        }

        // After one batch completes, shift the button label only if the batch matches current storyVideoPhase.
        if (successCount === null || successCount > 0) {
          setStoryVideoPhase((prev) => {
            if (phaseForCategory !== prev) return prev;
            if (prev === 'PROBLEM') return 'DISCOVERY';
            if (prev === 'DISCOVERY') return 'TRANSFORMATION';
            if (prev === 'TRANSFORMATION') return 'INVITATION';
            return prev;
          });
        }

        return;
      }

      if (update.type === 'ERROR') {
        // Untuk error fatal yang menghentikan batch, engine biasanya juga akan mengirim BATCH_COMPLETE.
        // Jika tidak, clear status generating agar tombol bisa dipakai ulang.
        setHookVideoGeneratingVariants((prev) => prev.filter((idx) => idx !== rowIndex));
        const msg = withPhase(message);
        if (msg) addLog('ERROR', msg);
      }

      if (update.type === 'SCENE_ERROR') {
        // Error pada salah satu scene, update placeholder to failed status
        const sceneIndex: number | null =
          typeof update.index === 'number' && Number.isFinite(update.index)
            ? update.index
            : null;
        
        if (sceneIndex) {
          const hookIndex = sceneIndex - 1;
          setHookVideosByVariant((prev) => {
            const next = [...prev];
            if (next.length > rowIndex && next[rowIndex]) {
              const current = [...next[rowIndex]];
              if (current[hookIndex] && current[hookIndex].status === 'generating') {
                current[hookIndex] = {
                  ...current[hookIndex],
                  status: 'failed' as const,
                  errorMessage: message || 'Video generation failed',
                };
                next[rowIndex] = current;
              }
            }
            return next;
          });
        }
        
        const msg = withPhase(message);
        if (msg) addLog('ERROR', msg);
      }
    });

    return unsubscribe;
  }, []);

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

  const hydrateStoryBlocksFromAnalysis = async (analysis: string) => {
    const summary = analysis.trim();
    if (!summary) return;

    if (problem.trim() || discovery.trim() || transformation.trim() || invitation.trim()) {
      return;
    }

    const apiKey =
      typeof window !== 'undefined' ? localStorage.getItem('zeoStudio.ai.apiKey') || '' : '';
    if (!apiKey) {
      addLog(
        'INFO',
        t.storySellingGenerator.skipAutoBlockDraft,
      );
      return;
    }

    try {
      addLog(
        'INFO',
        t.storySellingGenerator.draftingBlocks,
      );

      const blockLangLabel = language === 'en' ? 'English' : language === 'ms' ? 'Malay' : 'Indonesian';
      const blockTone =
        language === 'en'
          ? 'casual English'
          : language === 'ms'
          ? 'casual Malay (Bahasa Melayu)'
          : 'Bahasa Indonesia yang santai';

      const payload = {
        contents: [
          {
            parts: [
              {
                text: `Here is the visual analysis summary of the combined character + product photo:\n${summary}\n\nCreate 4 short paragraphs (max 1–2 sentences each) in ${blockTone} with the structure:\n[PROBLEM] ...\n[DISCOVERY] ...\n[TRANSFORMATION] ...\n[INVITATION] ...\n\nRules:\n- Keep the language ${blockLangLabel}; do not mix other languages.\n- No hard selling; do not mention promo, discounts, or price.\n- Position the product as a gentle solution and personal recommendation.\n- Return ONLY 4 lines with the exact tags above.`,
              },
            ],
          },
        ],
        generationConfig: { responseModalities: ['TEXT'] },
      };

      let text = await callGemini(apiKey, GEMINI_TEXT_MODEL, payload, 'text');
      if (language === 'id') {
        text = normalizeStoryPronouns(text);
      }
      const rawLines = text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => !!line);

      let nextProblem = '';
      let nextDiscovery = '';
      let nextTransformation = '';
      let nextInvitation = '';

      rawLines.forEach((originalLine) => {
        const line = originalLine.replace(/^[\-\*•]\s*/, '');
        if (/^\[PROBLEM\]/i.test(line) || /^\[MASALAH\]/i.test(line)) {
          nextProblem = line.replace(/^\[(PROBLEM|MASALAH)\]\s*/i, '');
        } else if (/^\[DISCOVERY\]/i.test(line) || /^\[PENEMUAN\]/i.test(line)) {
          nextDiscovery = line.replace(/^\[(DISCOVERY|PENEMUAN)\]\s*/i, '');
        } else if (/^\[TRANSFORMATION\]/i.test(line) || /^\[TRANSFORMASI\]/i.test(line)) {
          nextTransformation = line.replace(/^\[(TRANSFORMATION|TRANSFORMASI)\]\s*/i, '');
        } else if (/^\[INVITATION\]/i.test(line) || /^\[UNDANGAN\]/i.test(line)) {
          nextInvitation = line.replace(/^\[(INVITATION|UNDANGAN)\]\s*/i, '');
        }
      });

      if (!problem.trim() && nextProblem) setProblem(nextProblem);
      if (!discovery.trim() && nextDiscovery) setDiscovery(nextDiscovery);
      if (!transformation.trim() && nextTransformation) setTransformation(nextTransformation);
      if (!invitation.trim() && nextInvitation) setInvitation(nextInvitation);

      if (nextProblem || nextDiscovery || nextTransformation || nextInvitation) {
        addLog(
          'SUCCESS',
          t.storySellingGenerator.autoFilledBlocks,
        );
      } else {
        addLog(
          'INFO',
          t.storySellingGenerator.aiCouldNotDraftBlocks,
        );
      }
    } catch (err: any) {
      const message =
        err?.message ||
        t.storySellingGenerator.errorDraftingBlocks;
      addLog('ERROR', message);
    }
  };

  const runStoryImageAnalysis = async (file: File) => {
    try {
      if (typeof window === 'undefined' || !window.zeoAPI?.analyzeCharacterImage) {
        addLog(
          'INFO',
          t.storySellingGenerator.skipAnalysisEngineUnavailable,
        );
        return;
      }

      const aiProvider = localStorage.getItem('zeoStudio.ai.provider') || '';
      const aiModel = localStorage.getItem('zeoStudio.ai.model') || '';
      const apiKey = localStorage.getItem('zeoStudio.ai.apiKey') || '';

      if (!aiProvider || !apiKey) {
        addLog(
          'INFO',
          t.storySellingGenerator.skipAnalysisAiNotConfigured,
        );
        return;
      }

      setIsAnalyzingImage(true);
      setImageAnalysisSummary('');
      addLog('INFO', t.storySellingGenerator.startingAnalysis);

      const imageBase64 = await fileToBase64(file);
      const schemaParameters = STORY_VO_ANALYSIS_PARAMETERS;

      // Add language instruction for analysis
      const languageInstruction = language === 'en'
        ? 'Return ALL analysis values in English, concise and structured. Do not use Indonesian.'
        : language === 'ms'
        ? 'Balas SEMUA nilai analisis dalam Bahasa Melayu, ringkas dan terstruktur. Jangan gunakan Bahasa Indonesia.'
        : 'Balas SEMUA nilai analisis dalam Bahasa Indonesia yang ringkas dan terstruktur.';

      const guardrailInstruction = `${languageInstruction}\n${STORY_PRODUCT_GUARDRAIL}`;

      const result = await window.zeoAPI.analyzeCharacterImage({
        imageBase64,
        mimeType: file.type || 'image/png',
        aiProvider,
        aiModel,
        apiKey,
        schemaParameters,
        instruction: guardrailInstruction,
      });

      if (!result || !result.ok || !result.analysis) {
        const message: string =
          (result && result.error) ||
          t.storySellingGenerator.analysisFailedDefault;
        addLog('ERROR', message);
        return;
      }

      const rawAnalysis = result.analysis as Record<string, unknown>;
      const lines: string[] = [];

      applyAutoVoiceFromAnalysis(rawAnalysis);

      STORY_VO_ANALYSIS_PARAMETERS.forEach((key) => {
        const value = rawAnalysis[key];
        if (typeof value === 'string') {
          const trimmed = value.trim();
          if (trimmed) {
            lines.push(`${key}: ${trimmed}`);
          }
        }
      });

      const summary = lines.join('\n');

      if (summary.trim()) {
        setImageAnalysisSummary(summary);
        addLog(
          'SUCCESS',
          t.storySellingGenerator.analysisSummaryReady,
        );
        void hydrateStoryBlocksFromAnalysis(summary);
      } else {
        addLog(
          'INFO',
          t.storySellingGenerator.analysisNoSummary,
        );
      }
    } catch (err: any) {
      const message =
        err?.message || t.storySellingGenerator.analysisErrorDefault;
      addLog('ERROR', message);
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  const handleCombinedFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCombinedFile({ file, preview: URL.createObjectURL(file) });
    void runStoryImageAnalysis(file);
  };

  const handleDiscoveryRefChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDiscoveryRef({ file, preview: URL.createObjectURL(file) });
  };

  const handleTransformationRefChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTransformationRef({ file, preview: URL.createObjectURL(file) });
  };

  const handleInvitationRefChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setInvitationRef({ file, preview: URL.createObjectURL(file) });
  };

  const stopAudio = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setIsAudioPlaying(false);
    setAudioCurrentTime(0);
  };

  const setupAudioPlayer = (url: string | null, rate: number | null) => {
    const prev = audioRef.current;
    if (prev) {
      prev.pause();
    }

    setAudioUrl(url);
    setAudioSampleRate(rate ?? null);
    setAudioDuration(0);
    setAudioCurrentTime(0);
    setIsAudioPlaying(false);

    if (!url) {
      audioRef.current = null;
      return;
    }

    const audio = new Audio(url);
    audioRef.current = audio;

    audio.onloadedmetadata = () => {
      setAudioDuration(audio.duration || 0);
    };

    audio.ontimeupdate = () => {
      setAudioCurrentTime(audio.currentTime || 0);
    };

    audio.onplay = () => {
      setIsAudioPlaying(true);
    };

    audio.onpause = () => {
      setIsAudioPlaying(false);
    };

    audio.onended = () => {
      setIsAudioPlaying(false);
      setAudioCurrentTime(audio.duration || 0);
    };
  };

  const normalizeStoryPronouns = (text: string): string => {
    let result = text;
    const replacements: [RegExp, string][] = [
      [/\b[Gg]ue\b/g, 'aku'],
      [/\b[Gg]ua\b/g, 'aku'],
      [/\b[Ss]aya\b/g, 'aku'],
      [/\b[Aa]nda\b/g, 'kamu'],
      [/\b[Ll]o\b/g, 'kamu'],
      [/\b[Ll]u\b/g, 'kamu'],
      [/\b[Kk]alian\b/g, 'kamu'],
    ];
    replacements.forEach(([re, rep]) => {
      result = result.replace(re, rep);
    });
    return result;
  };

  const buildStoryPrompt = (combinedImageBase64: string): any => {
    const problemText = problem.trim();
    const discoveryText = discovery.trim();
    const transformationText = transformation.trim();
    const invitationText = invitation.trim();

    const userBlocks: string[] = [];
    if (problemText) userBlocks.push(`PROBLEM (user draft): ${problemText}`);
    if (discoveryText) userBlocks.push(`DISCOVERY (user draft): ${discoveryText}`);
    if (transformationText) userBlocks.push(`TRANSFORMATION (user draft): ${transformationText}`);
    if (invitationText) userBlocks.push(`INVITATION (user draft): ${invitationText}`);

    const userHint = userBlocks.length
      ? `Use the following drafts as inspiration; you may refine but do not change the meaning: ${userBlocks.join(' ')}`
      : 'If no user draft is provided, create your own natural, product-relevant example for the character in the photo.';

    const analysisHint = imageAnalysisSummary.trim()
      ? `Visual analysis summary of the combined character + product photo:\n${imageAnalysisSummary}\n\nUse this as context when writing the story, but do not copy word-for-word. Focus on personal experience and product benefits.`
      : '';

    const isEnglish = language === 'en';
    const isMalay = language === 'ms';
    const langLabel = isEnglish ? 'English' : isMalay ? 'Bahasa Melayu' : 'Bahasa Indonesia';
    const casualTone = isEnglish ? 'informal English (casual tone)' : isMalay ? 'informal Malay (casual tone)' : 'informal Indonesian (casual tone)';
    const pronounRule = isEnglish
      ? '- Use natural 2nd-person pronouns; keep tone friendly and light.'
      : isMalay
      ? '- Use natural Malay pronouns "saya" and "anda"; keep tone friendly and light.'
      : '- ONLY use pronouns "aku" and "kamu" (do NOT use "gue", "gua", "lo", "lu", "saya", "Anda", or other pronouns).';
    const productFocusRule =
      '- Identify the most plausible main product visible in the photo and make it the HERO solution of the story. If the product is unclear, infer ONE believable product (e.g., sofa, lamp, skincare, storage rack) and keep the story centered on that product’s benefit. Do NOT make the story only about the outfit/fashion of the character; always link each section to the product benefit and soft CTA.';

    const promptText = `You are a copywriter for a short video story selling an affiliate product.

TASK:
- Write 1 voice-over narrative script in ${casualTone}.
${pronounRule}
${productFocusRule}
- The script MUST follow these 4 sections in order:
  [PROBLEM] ...
  [DISCOVERY] ...
  [TRANSFORMATION] ...
  [INVITATION] ...

IMPORTANT RULES (language: ${langLabel}):
- Focus on honest personal experience; avoid sounding like TV ads or hard selling.
- Soft-selling tone, slightly flirty and playful as if chatting with a close friend, but stay polite and non-sexual.
- No explicit sexual content, no sensual descriptions of body parts, no sexual invitations.
- Narrative must be 100% in ${langLabel}; avoid mixing other languages except for product/brand names.
- Present the product as a gentle solution and personal recommendation, not a hard sell.
- [PROBLEM] should hook within the first 1–2 seconds (can greet or provoke curiosity).
- [INVITATION] must be a gentle ask, e.g., invite to check the product (like “yellow cart”) as a friendly suggestion.
- Max total 80–100 words for the whole script.

IMAGE INPUT:
- One combined photo already containing the character/persona and the product in one frame/room.
- Assume the person in the photo is the main storyteller and the visible product is the main solution.

${analysisHint}

${userHint}

OUTPUT:
- Produce exactly 1 complete narrative script with 4 main lines, one per section, using this exact format:
  [PROBLEM] ...
  [DISCOVERY] ...
  [TRANSFORMATION] ...
  [INVITATION] ...
- Do NOT add extra separators like "---" or any other text beyond these 4 lines.`;

    return {
      contents: [
        {
          parts: [
            { text: promptText },
            { inlineData: { mimeType: 'image/png', data: combinedImageBase64 } },
          ],
        },
      ],
      generationConfig: { responseModalities: ['TEXT'] },
    };
  };

  const buildThumbnailPrompt = (script: string): string => {
    const scriptSnippet = script.trim().slice(0, 500);
    const analysisForThumbnail = imageAnalysisSummary.trim()
      ? `Visual analysis summary of the character + product photo (persona, mood, body position, main product, room context, interior style, colors, lighting, composition, focal point, and safe area for text):\n${imageAnalysisSummary}\n\nUse this to decide composition, focus, and text placement. Do NOT copy the full analysis into the image; treat it as a visual guide only.`
      : 'If no visual analysis is available, use the photo content and narrative directly to decide the strongest thumbnail composition.';

    const isEnglish = language === 'en';
    const isMalayThumb = language === 'ms';
    const hookLang = isEnglish ? 'English' : isMalayThumb ? 'Malay' : 'Indonesian';
    const hookHint = `big and clearly legible (in ${hookLang})`;

    const promptText = `You are the thumbnail designer for a short story-selling product video.

Based on the following narrative (brief, for context only; do NOT rewrite this text inside the image):
"""${scriptSnippet}"""

${analysisForThumbnail}

IMAGE TASK (language for any text inside image: ${hookLang}):
- Create one strong 9:16 thumbnail for the story-selling content.
- Focus on the character’s expression (per the photo) and highlight the product aesthetically.
- When appropriate, position the product as the visual hero and the character’s face as emotional support.
- Use empty/negative space for a large hook text.
- Avoid crowded text; if adding text, use only 2–4 hook words that are ${hookHint}.
- Avoid logos, watermarks, UI, and e-commerce elements.
- Visual style should be modern, high contrast, yet realistic (not cartoon). Tone may be lightly flirty/playful but must remain polite and non-sexual (no vulgarity, no objectification).

Return a single thumbnail concept ready for 9:16 short video content, using the provided character + product photo as the main visual reference.`;

    return promptText;
  };

  const extractHookLineFromVariant = (script: string, section: StoryVoVideoPhase): string => {
    if (!script) return '';
    const lines = script.replace(/\r\n/g, '\n').split('\n');
    const label = section.toUpperCase();
    const sectionRegex = new RegExp(`^\\[${label}\\]`, 'i');

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      if (sectionRegex.test(line)) {
        return line.replace(sectionRegex, '').trim();
      }
    }

    const firstNonEmpty = lines.find((line) => line.trim().length > 0);
    return firstNonEmpty ? firstNonEmpty.trim() : '';
  };

  const buildHookVideoPromptForPhase = (
    script: string,
    hookIndex: number,
    phase: StoryVoVideoPhase,
    voiceId?: string,
    extraInstruction?: string,
  ): string => {
    const hookLine = extractHookLineFromVariant(script, phase);
    const analysisHint = imageAnalysisSummary.trim()
      ? `Visual analysis summary of the character + product photo:\n${imageAnalysisSummary}\n\nUse this information to keep the character’s face, body, product, room, and lighting consistent across the video.`
      : '';

    const parts: string[] = [];
    if (phase === 'PROBLEM') {
      parts.push('[Affiliate Video - Story Selling Problem]');
    } else if (phase === 'DISCOVERY') {
      parts.push('[Affiliate Video - Story Selling Discovery]');
    } else if (phase === 'TRANSFORMATION') {
      parts.push('[Affiliate Video - Story Selling Transformation]');
    } else {
      parts.push('[Affiliate Video - Story Selling Invitation]');
    }
    parts.push('Short video 6–8 seconds, 9:16 ratio, one continuous shot without cuts or flashy transitions.');
    parts.push(
      'Main character and product MUST stay 100% consistent with the story selling reference photo (face, body shape, skin tone, hairstyle, clothing, and product position). Do not change into another person mid-video.',
    );

    if (phase === 'PROBLEM') {
      parts.push(
        'Focus on facial expression and body language conveying the PROBLEM as the opening hook, with gentle camera motion and small natural body movement.',
      );
    } else if (phase === 'DISCOVERY') {
      parts.push(
        'Focus on the moment the character discovers or tries the solution (DISCOVERY), showing surprise/curiosity turning into joy or relief.',
      );
    } else if (phase === 'TRANSFORMATION') {
      parts.push(
        'Focus on the end result after using the solution (TRANSFORMATION); show improved mood, satisfied expression, and room/product condition already better.',
      );
    } else if (phase === 'INVITATION') {
      parts.push(
        'Focus on the gentle gesture inviting viewers to try the same solution (INVITATION), e.g., pointing to the product or giving a friendly invitation gesture.',
      );
      parts.push(
        'If the dialogue mentions “yellow cart” or similar, NEVER show buttons, icons, banners, highlights, or any overlay that resembles a yellow cart in the video. Treat that phrase as spoken only, not as UI drawn in the frame.',
      );
      parts.push(
        'As a visual hint, you may direct the character’s gaze or hand slightly to the lower frame area (as if pointing to the app’s yellow cart outside the video), but keep the bottom of the video clean without text, buttons, or extra graphic elements.',
      );
    }
    parts.push(
      'Do NOT show text, subtitles, captions, watermarks, logos, buttons, frames, panels, stickers, emojis, or any UI elements (including social media/chat/e-commerce UI) inside the frame. Keep the video clean with no added text/graphics.',
    );
    parts.push(
      'Do NOT overlay other images on the video (no picture-in-picture, collage, split screen, or floating product shot). All visuals in-frame must feel naturally captured by a real camera.',
    );
    parts.push(
      'Avoid excessive visual effects like glitch, fake light flares, animated particles, cartoon filters, or extreme grading that breaks realism. Keep visuals modern, realistic, lightly flirty & playful but polite and non-sexual (no porn, no explicit).',
    );

    parts.push(
      'If the engine adds audio, it must be natural dialogue from the main character in the scene (lip-sync with matching expression), not off-screen voice-over or extra narrator.',
    );
    const spokenLangGuardMap: Record<string, string> = {
      en: 'All spoken words must be 100% in natural English and must not use other languages.',
      id: 'All spoken words must be 100% in natural Indonesian and must not use other languages (avoid English or other foreign languages).',
      ms: 'All spoken words must be 100% in natural Malay (Bahasa Melayu) and must not use other languages (avoid English or other foreign languages).',
    };
    parts.push(spokenLangGuardMap[language] || spokenLangGuardMap.id);
    parts.push(
      'Strictly forbid adding background music, generic ambience unrelated to the scene, or dramatic sound effects. Audio in the video (if any) must come purely from natural dialogue and physical sounds (breath, footsteps, fabric rustle, furniture) with no extra effects.',
    );

    if (hookLine) {
      const label =
        phase === 'PROBLEM'
          ? 'PROBLEM'
          : phase === 'DISCOVERY'
          ? 'DISCOVERY'
          : phase === 'TRANSFORMATION'
          ? 'TRANSFORMATION'
          : 'INVITATION';
      parts.push(
        `Use this line as the main dialogue spoken by the character in [${label}] (lip-sync and expression must match). You may slightly shorten it, but keep the same meaning and do not add other dialogue that changes the message: "${hookLine}".`,
      );
    }

    const sectionLabel =
      phase === 'PROBLEM'
        ? 'PROBLEM'
        : phase === 'DISCOVERY'
        ? 'DISCOVERY'
        : phase === 'TRANSFORMATION'
        ? 'TRANSFORMATION'
        : 'INVITATION';

    parts.push(
      `This is a video variation for section ${sectionLabel} number ${
        hookIndex + 1
      } for the same narrative. Create slightly different composition or motion than other variations, while keeping the same character and product.`,
    );

    const trimmedExtra = (extraInstruction || '').trim();
    if (trimmedExtra) {
      parts.push(
        `Additional creator instruction (MUST follow without changing the main dialogue meaning): ${trimmedExtra}.`,
      );
    }

    if (discoveryRef || transformationRef || invitationRef) {
      const refLabels: string[] = [];
      if (discoveryRef) refLabels.push('DISCOVERY');
      if (transformationRef) refLabels.push('TRANSFORMATION');
      if (invitationRef) refLabels.push('INVITATION');

      if (refLabels.length > 0) {
        const refLabelText = refLabels.join(', ');
        parts.push(
          `Creative note: Besides focusing on [PROBLEM], the creator may have reference photos for ${refLabelText}. Use those references only as extra inspiration (mood, lighting, light gestures) while keeping this video as the opening hook (PROBLEM).`,
        );
      }
    }

    if (analysisHint) {
      parts.push(analysisHint);
    }

    const voiceStyleHint = buildVoiceStyleHint(voiceId);
    if (voiceStyleHint) {
      parts.push(voiceStyleHint);
    }

    return parts.join('\n\n');
  };

  const generateAssetsForVariant = async (
    variantIndex: number,
    script: string,
    totalVariants: number,
    combinedBase64: string,
    apiKey: string,
    opts?: { includeVoice?: boolean; includeThumbnail?: boolean },
  ) => {
    const cleanedScript = script.replace(/(\[.*?\])/g, '').trim();
    if (!cleanedScript) {
      addLog('INFO', t.storySellingGenerator.emptyNarrationSkipped);
      return;
    }

    const includeVoice = opts?.includeVoice !== false;
    const includeThumbnail = opts?.includeThumbnail !== false;

    if (!includeVoice && !includeThumbnail) return;

    if (includeVoice) setIsGeneratingAudio(true);
    if (includeThumbnail) setIsGeneratingThumbnail(true);

    const voiceIdForVariant = (() => {
      const existing = variantVoiceIds[variantIndex];
      if (existing && existing.trim()) return existing;
      return selectedVoiceId || TTS_VOICES[0]?.id || '';
    })();

    setVariantVoiceIds((prev) => {
      const next = [...prev];
      if (next.length <= variantIndex) {
        const oldLength = next.length;
        next.length = variantIndex + 1;
        for (let i = oldLength; i < next.length; i += 1) {
          next[i] = voiceIdForVariant;
        }
      }
      next[variantIndex] = voiceIdForVariant;
      return next;
    });

    addLog(
      'INFO',
      t.storySellingGenerator.startingVoAndThumbnail.replace('{count}', String(THUMBNAIL_BATCH_SIZE)),
    );

    try {
      // 1) Generate audio untuk varian ini (opsional)
      if (includeVoice) {
        try {
          const ttsPayload = {
            contents: [{ parts: [{ text: cleanedScript }] }],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: voiceIdForVariant,
                  },
                },
              },
            },
          };

          const { audioData, sampleRate } = await callGeminiTts(apiKey, ttsPayload);
          const pcmData = base64ToArrayBuffer(audioData);
          const wavBlob = pcmToWav(pcmData, sampleRate);
          const url = URL.createObjectURL(wavBlob);

          setAudioUrls((prev) => {
            const next = [...prev];
            if (next.length <= variantIndex) {
              const oldLength = next.length;
              next.length = variantIndex + 1;
              for (let i = oldLength; i < next.length; i += 1) {
                next[i] = null;
              }
            }
            next[variantIndex] = url;
            return next;
          });

          setAudioSampleRates((prev) => {
            const next = [...prev];
            if (next.length <= variantIndex) {
              const oldLength = next.length;
              next.length = variantIndex + 1;
              for (let i = oldLength; i < next.length; i += 1) {
                next[i] = null;
              }
            }
            next[variantIndex] = sampleRate;
            return next;
          });

          addLog('SUCCESS', t.storySellingGenerator.audioVoSuccess);
          setActiveVariantIndex(variantIndex);
          setupAudioPlayer(url, sampleRate);
        } catch (err: any) {
          const message =
            err?.message ||
            t.storySellingGenerator.audioVoError;
          addLog('ERROR', message);
        }
      }

      // 2) Generate thumbnails untuk varian ini menggunakan engine Nano Banana (opsional)
      if (includeThumbnail) {
        try {
          const bearerKey =
            typeof window !== 'undefined'
              ? localStorage.getItem('zeoStudio.bearerToken') || ''
              : '';

          if (!bearerKey) {
            addLog(
              'ERROR',
              t.storySellingGenerator.thumbnailBearerMissing,
            );
            return;
          }

          if (typeof window === 'undefined' || !window.zeoAPI?.generateAffiliateImages) {
            addLog(
              'ERROR',
              t.storySellingGenerator.thumbnailEngineUnavailable,
            );
            return;
          }

          const aspectRatioKey = mapThumbnailAspectRatioToEngineKey(thumbnailAspectRatio);
          const thumbnailPrompt = buildThumbnailPrompt(cleanedScript);

          const items = Array.from({ length: THUMBNAIL_BATCH_SIZE }, () => ({
            category: 'ugc',
            prompt: thumbnailPrompt,
          }));

          const response = await window.zeoAPI.generateAffiliateImages({
            bearerKey,
            aspectRatioKey,
            items,
            references: {
              product: combinedBase64,
              models: [],
              additional: [],
            },
          });

          if (!response || !response.ok) {
            const message = response?.error || t.storySellingGenerator.thumbnailResponseInvalid;
            throw new Error(message);
          }

          const results: any[] = Array.isArray(response.results) ? response.results : [];
          if (!results.length) {
            throw new Error(t.storySellingGenerator.thumbnailNoResults);
          }

          const thumbs: string[] = [];
          let failedWithErrorCount = 0;

          for (let i = 0; i < Math.min(results.length, THUMBNAIL_BATCH_SIZE); i += 1) {
            const r = results[i];
            if (r?.success && r.dataUrl) {
              thumbs.push(r.dataUrl as string);
              addLog(
                'SUCCESS',
                t.storySellingGenerator.thumbnailSuccess.replace('{current}', String(thumbs.length)).replace('{total}', String(THUMBNAIL_BATCH_SIZE)),
              );
            } else if (r) {
              failedWithErrorCount += 1;
              const errMsg: string =
                (typeof r?.error === 'string' && r.error.trim()) ||
                t.storySellingGenerator.thumbnailResponseInvalid;
              addLog(
                'ERROR',
                t.storySellingGenerator.thumbnailEngineFailed.replace('{current}', String(i + 1)).replace('{total}', String(THUMBNAIL_BATCH_SIZE)).replace('{error}', errMsg),
              );
            }
          }

          if (!thumbs.length) {
            throw new Error(
              t.storySellingGenerator.thumbnailNoSuccess,
            );
          }

          setThumbnailsByVariant((prev) => {
            const next = [...prev];
            if (next.length <= variantIndex) {
              const oldLength = next.length;
              next.length = variantIndex + 1;
              for (let i = oldLength; i < next.length; i += 1) {
                next[i] = [];
              }
            }
            next[variantIndex] = thumbs;
            return next;
          });

          if (thumbs.length > 0) {
            setThumbnailUrl(thumbs[0]);
            setThumbnailGenerationFailed(false);
          }

          if (failedWithErrorCount > 0) {
            addLog(
              'INFO',
              t.storySellingGenerator.thumbnailSomePartialSuccess.replace('{count}', String(thumbs.length)),
            );
          }
        } catch (err: any) {
          const message =
            err?.message || t.storySellingGenerator.thumbnailError;
          addLog('ERROR', message);
          setThumbnailGenerationFailed(true);
        }
      }
    } finally {
      if (includeVoice) setIsGeneratingAudio(false);
      if (includeThumbnail) setIsGeneratingThumbnail(false);
    }
  };

  const handleGenerateAllVideoPhases = async (variantIndex: number) => {
    const phases: StoryVoVideoPhase[] = ['PROBLEM', 'DISCOVERY', 'TRANSFORMATION', 'INVITATION'];

    setIsGeneratingAllVideos(true);
    setHasAttemptedVideoGeneration(true);
    addLog('INFO', t.storySellingGenerator.startingAllVideoPhases);

    try {
      const results = await Promise.allSettled(
        phases.map((phase) => handleGenerateVideoHooksForVariant(variantIndex, phase)),
      );

      results.forEach((res, idx) => {
        if (res.status === 'rejected') {
          const phase = phases[idx];
          const phaseName =
            phase === 'PROBLEM'
              ? 'Problem'
              : phase === 'DISCOVERY'
              ? 'Discovery'
              : phase === 'TRANSFORMATION'
              ? 'Transformation'
              : 'Invitation';
          addLog('ERROR', t.storySellingGenerator.failedPhaseVideo.replace('{phase}', phaseName).replace('{error}', res.reason?.message || res.reason || 'Unknown error'));
        }
      });

      const anyRejected = results.some((r) => r.status === 'rejected');
      if (!anyRejected) {
        addLog('SUCCESS', t.storySellingGenerator.allVideoCompleted);
      }
    } finally {
      setIsGeneratingAllVideos(false);
    }
  };

  const handleGenerateVideoHooksForVariant = async (
    variantIndex: number,
    phaseOverride?: StoryVoVideoPhase,
    sceneOverride?: number,
    extraInstruction?: string,
  ) => {
    const fetchImageFile = async (url: string, filename = 'fallback-reference.jpg'): Promise<File> => {
      const response = await fetch(url);
      const blob = await response.blob();
      const mime = blob.type || 'image/jpeg';
      return new File([blob], filename, { type: mime });
    };

    const variantsFromState =
      storyVariants.length > 0
        ? storyVariants
        : storyScript.trim()
        ? [storyScript]
        : [];

    if (variantIndex < 0 || variantIndex >= variantsFromState.length) {
      return;
    }

    const scriptSource = variantsFromState[variantIndex] || '';
    if (!scriptSource.trim()) {
      setError(t.storySellingGenerator.narrationForVideoMissing);
      addLog('ERROR', t.storySellingGenerator.generateVideoNarrationEmpty);
      return;
    }

    const phase = phaseOverride ?? storyVideoPhase;
    const voiceIdForVariant =
      variantVoiceIds[variantIndex] || selectedVoiceId || TTS_VOICES[0]?.id || '';
    const phaseName =
      phase === 'PROBLEM'
        ? 'Problem'
        : phase === 'DISCOVERY'
        ? 'Discovery'
        : phase === 'TRANSFORMATION'
        ? 'Transformation'
        : 'Invitation';

    const phaseRowIndex = getVideoPhaseIndex(phase);

    if (hookVideoGeneratingVariants.includes(phaseRowIndex)) {
      addLog(
        'INFO',
        t.storySellingGenerator.videoPhaseAlreadyRunning,
      );
      return;
    }

    if (typeof window === 'undefined' || !window.zeoAPI?.startAffiliateVideoWorkflow) {
      const message = t.storySellingGenerator.videoEngineUnavailable;
      setError(message);
      addLog('ERROR', message);
      return;
    }

    const bearerKey =
      typeof window !== 'undefined' ? localStorage.getItem('zeoStudio.bearerToken') || '' : '';
    if (!bearerKey.trim()) {
      const message = t.storySellingGenerator.bearerTokenMissing;
      setError(message);
      addLog('ERROR', message);
      return;
    }

    const downloadPath =
      typeof window !== 'undefined' ? localStorage.getItem('zeoStudio.folder.output') || '' : '';
    if (!downloadPath.trim()) {
      const message = t.storySellingGenerator.folderOutputMissing;
      setError(message);
      addLog('ERROR', message);
      return;
    }

    let baseImageFile: File | null = null;

    const fallbackBaseFile = combinedFile?.file || null;

    if (phase === 'PROBLEM') {
      baseImageFile = combinedFile?.file || null;
    } else if (phase === 'DISCOVERY') {
      baseImageFile = discoveryRef?.file || fallbackBaseFile;
    } else if (phase === 'TRANSFORMATION') {
      baseImageFile = transformationRef?.file || fallbackBaseFile;
    } else if (phase === 'INVITATION') {
      baseImageFile = invitationRef?.file || fallbackBaseFile;
    }

    if (!baseImageFile) {
      // Try thumbnail fallback (e.g., when user refreshed and File objects are lost)
      const thumbnailFallback =
        (thumbnailsByVariant[variantIndex] && thumbnailsByVariant[variantIndex][0]) ||
        thumbnailUrl ||
        null;

      if (thumbnailFallback) {
        try {
          baseImageFile = await fetchImageFile(thumbnailFallback, `fallback-${phaseName.toLowerCase()}.jpg`);
          addLog(
            'INFO',
            t.storySellingGenerator.refPhotoFallbackThumbnail.replace('{phase}', phaseName),
          );
        } catch (err: any) {
          const message =
            err?.message ||
            t.storySellingGenerator.refPhotoFallbackError.replace('{phase}', phaseName);
          setError(message);
          addLog('ERROR', message);
          return;
        }
      }
    }

    if (!baseImageFile) {
      const phaseMissingMessage =
        phase === 'PROBLEM'
          ? t.storySellingGenerator.phaseMissingCombined
          : phase === 'DISCOVERY'
          ? t.storySellingGenerator.phaseMissingDiscovery
          : phase === 'TRANSFORMATION'
          ? t.storySellingGenerator.phaseMissingTransformation
          : t.storySellingGenerator.phaseMissingInvitation;

      setError(t.storySellingGenerator.uploadRefBeforeGenerate.replace('{phase}', phaseName));
      addLog('ERROR', t.storySellingGenerator.generatePhaseCanceled.replace('{phase}', phaseName).replace('{reason}', phaseMissingMessage));
      return;
    } else if (
      (phase === 'DISCOVERY' && !discoveryRef?.file && fallbackBaseFile) ||
      (phase === 'TRANSFORMATION' && !transformationRef?.file && fallbackBaseFile) ||
      (phase === 'INVITATION' && !invitationRef?.file && fallbackBaseFile)
    ) {
      addLog(
        'INFO',
        t.storySellingGenerator.refPhotoFallbackCombined.replace('{phase}', phaseName),
      );
    }

    if (!baseImageFile) {
      setError(t.storySellingGenerator.imageRefMissing);
      addLog('ERROR', t.storySellingGenerator.generateVideoImageRefMissing);
      return;
    }

    try {
      const combinedBase64Url = await compressImage(baseImageFile);
      const combinedBase64 = getBase64PayloadFromDataUrl(combinedBase64Url);

      const categoryKey = `story-vo-v${variantIndex + 1}-${phase.toLowerCase()}`.toLowerCase();
      videoBatchPhaseMapRef.current[categoryKey] = phase;

      const allScenes = Array.from({ length: 1 }).map((_, idx) => ({
        index: idx + 1,
        prompt: buildHookVideoPromptForPhase(
          scriptSource,
          idx,
          phase,
          voiceIdForVariant,
          typeof extraInstruction === 'string' ? extraInstruction : undefined,
        ),
        category: categoryKey,
        imageBase64: combinedBase64,
      }));

      let scenes = allScenes;
      let isSingleScene = false;
      let sceneNumberForLog: number | null = null;

      if (typeof sceneOverride === 'number' && Number.isFinite(sceneOverride)) {
        const idx = sceneOverride;
        if (idx >= 0 && idx < allScenes.length) {
          scenes = [allScenes[idx]];
          isSingleScene = true;
          sceneNumberForLog = idx + 1;
        }
      }

      setHookVideoGeneratingVariants((prev) =>
        prev.includes(phaseRowIndex) ? prev : [...prev, phaseRowIndex],
      );

      // For single scene regenerate, update existing placeholder to generating state
      if (isSingleScene && sceneNumberForLog != null) {
        const sceneIdx = sceneNumberForLog - 1;
        setHookVideosByVariant((prev) => {
          const next = [...prev];
          if (next.length > phaseRowIndex && next[phaseRowIndex]) {
            const current = [...next[phaseRowIndex]];
            if (current[sceneIdx]) {
              current[sceneIdx] = {
                ...current[sceneIdx],
                status: 'generating' as const,
                startedAt: Date.now(),
                estimatedTotalSeconds: 300,
                errorMessage: undefined,
                generationMode: 'regen',
              };
              next[phaseRowIndex] = current;
            }
          }
          return next;
        });
      }

      // Create placeholder videos immediately with loading state
      if (!isSingleScene) {
        const placeholderVideos: StoryVoHookVideoOutput[] = allScenes.map((scene, idx) => ({
          fileName: `${phaseName.toLowerCase()}-scene-${scene.index}.mp4`,
          filePath: '',
          sceneIndex: scene.index,
          status: 'generating' as const,
          startedAt: Date.now(),
          estimatedTotalSeconds: 300,
          prompt: scene.prompt?.slice(0, 80) || '',
          generationMode: 'new',
        }));

        setHookVideosByVariant((prev) => {
          const next = [...prev];
          while (next.length <= phaseRowIndex) {
            next.push([]);
          }
          next[phaseRowIndex] = placeholderVideos;
          return next;
        });

        // Schedule sequential card reveal with 2s delay
        // Use phaseRowIndex for delay so each phase appears 2s apart
        placeholderVideos.forEach((video, idx) => {
          const cardId = `story-video-${phaseRowIndex}-${video.sceneIndex ?? idx}`;
          const timeout = setTimeout(() => {
            setVisibleVideoCardIds(prevVisible => new Set([...prevVisible, cardId]));
          }, phaseRowIndex * 2000); // ← Delay based on phase, not scene
          videoCardRevealTimeouts.current.push(timeout);
        });
      }

      if (isSingleScene && sceneNumberForLog != null) {
        addLog(
          'INFO',
          t.storySellingGenerator.videoPhaseStartRegenerate.replace('{phase}', phaseName),
        );
      } else {
        addLog(
          'INFO',
          t.storySellingGenerator.videoPhaseStartGenerate.replace('{phase}', phaseName),
        );
      }

      await window.zeoAPI.startAffiliateVideoWorkflow?.({
        bearerKey,
        downloadPath,
        aspectRatio: STORY_VO_VIDEO_SETTINGS.aspectRatio,
        veoModel: STORY_VO_VIDEO_SETTINGS.veoModel,
        resolution: STORY_VO_VIDEO_SETTINGS.resolution,
        scenes,
        category: categoryKey,
        uiLanguage: language,
      });
    } catch (err: any) {
      const message =
        err?.message ||
        t.storySellingGenerator.videoPhaseError.replace('{phase}', phaseName);
      setError(message);
      addLog('ERROR', message);
      
      // Clear video card reveal timeouts on error
      videoCardRevealTimeouts.current.forEach(timeout => clearTimeout(timeout));
      videoCardRevealTimeouts.current = [];
      
      setHookVideoGeneratingVariants((prev) => prev.filter((idx) => idx !== phaseRowIndex));
    }
  };

  const handleGenerateStoryAndAssets = async () => {
    if (!combinedFile) {
      setError(t.storySellingGenerator.uploadPhotoFirst);
      addLog('ERROR', t.storySellingGenerator.generateCanceledNoPhoto);
      return;
    }

    const apiKey =
      typeof window !== 'undefined' ? localStorage.getItem('zeoStudio.ai.apiKey') || '' : '';
    if (!apiKey) {
      setError(t.storySellingGenerator.apiKeyMissing);
      addLog('ERROR', t.storySellingGenerator.generateCanceledNoApiKey);
      return;
    }

    setIsGeneratingStory(true);
    setError(null);
    setStoryVariants([]);
    setActiveVariantIndex(0);
    setAudioUrl(null);
    setAudioUrls([]);
    setAudioDuration(0);
    setAudioCurrentTime(0);
    setIsAudioPlaying(false);
    setAudioSampleRate(null);
    setAudioSampleRates([]);
    audioRef.current = null;
    // Reset thumbnail state but do not generate video here
    setThumbnailUrl(null);
    setThumbnailsByVariant([]);
    setThumbnailGenerationFailed(false);
    setVariantVoiceIds([]);
    // Reset video state
    setHookVideosByVariant([]);
    setHookVideoGeneratingVariants([]);
    setStoryVideoPhase('PROBLEM');
    setHasAttemptedVideoGeneration(false);
    setFailedVideoPhases([]);
    setVideoGenerationStatus('idle');
    addLog(
      'INFO',
      t.storySellingGenerator.startingStorySelling,
    );

    try {
      const combinedBase64Url = await compressImage(combinedFile.file);
      const combinedBase64 = getBase64PayloadFromDataUrl(combinedBase64Url);

      // 1) Generate story script (hingga MAX_STORY_VARIANTS varian)
      const storyPayload = buildStoryPrompt(combinedBase64);
      const rawScript = await callGemini(apiKey, GEMINI_TEXT_MODEL, storyPayload, 'text');
      const trimmed = (language === 'id' ? normalizeStoryPronouns(rawScript) : rawScript).trim();
      const parsedVariants = parseStoryVariants(trimmed).slice(0, MAX_STORY_VARIANTS);

      let variants: string[] = [];
      if (parsedVariants.length === 0) {
        variants = [trimmed];
        setStoryScript(trimmed);
        setStoryVariants([]);
        setActiveVariantIndex(0);
        addLog('SUCCESS', t.storySellingGenerator.narrationSuccess);
      } else {
        variants = parsedVariants;
        setStoryVariants(variants);
        setActiveVariantIndex(0);
        setStoryScript(variants[0]);
        addLog('SUCCESS', t.storySellingGenerator.narrationSuccess);
      }

      const totalVariants = variants.length;
      if (totalVariants <= 0) {
        throw new Error(t.storySellingGenerator.narrationEmpty);
      }

      // Siapkan array audio & thumbnail untuk seluruh script yang ada (saat ini 1 script utama)
      setAudioUrls(new Array(totalVariants).fill(null));
      setAudioSampleRates(new Array(totalVariants).fill(null));
      setThumbnailsByVariant(new Array(totalVariants).fill([]));
      const defaultVoiceId = selectedVoiceId || TTS_VOICES[0]?.id || '';
      setVariantVoiceIds(new Array(totalVariants).fill(defaultVoiceId));

      // 2) Generate VO saja untuk script utama (thumbnail dan video dipisah tombol lain)
      addLog('INFO', t.storySellingGenerator.startingVoOnly);

      await generateAssetsForVariant(0, variants[0], totalVariants, combinedBase64, apiKey, {
        includeVoice: true,
        includeThumbnail: false,
      });
    } catch (err: any) {
      const message = err?.message || t.storySellingGenerator.generateError;
      setError(message);
      addLog('ERROR', message);
    } finally {
      setIsGeneratingStory(false);
      setIsGeneratingAllVideos(false);
    }
  };

  const handleSeekAudio = (nextTime: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(nextTime) || nextTime < 0) return;
    const clamped = audioDuration > 0 ? Math.min(nextTime, audioDuration) : nextTime;
    audio.currentTime = clamped;
    setAudioCurrentTime(clamped);
  };

  const handleSeekVariantAudio = (index: number, nextTime: number) => {
    if (activeVariantIndex !== index) return;
    handleSeekAudio(nextTime);
  };

  const handlePlayPauseVariantAudio = (index: number) => {
    const url = audioUrls[index] || null;
    const rate = audioSampleRates[index] ?? null;
    if (!url) return;
    const isSameUrl = audioUrl === url;

    // Jika audio untuk varian ini belum ter-load, atau berbeda dari yang aktif, muat ulang player
    if (!isSameUrl || !audioRef.current) {
      setActiveVariantIndex(index);
      setupAudioPlayer(url, rate);
      const audioAfterSetup = audioRef.current;
      if (!audioAfterSetup) return;
      void audioAfterSetup.play();
      return;
    }

    // Jika URL sama dan player sudah ada, cukup toggle play/pause
    setActiveVariantIndex(index);
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      void audio.play();
    } else {
      audio.pause();
    }
  };

  const handleDownloadVariantAudio = (index: number) => {
    const url = audioUrls[index] || null;
    if (!url) return;
    const a = document.createElement('a');
    const dateCode = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `story-vo-${dateCode}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleGenerateThumbnailsForVariant = async (index: number) => {
    if (!combinedFile) {
      setError(t.storySellingGenerator.thumbnailGenerateCanceledNoPhoto);
      addLog('ERROR', t.storySellingGenerator.generateCanceledNoPhoto);
      return;
    }

    const variantsFromState =
      storyVariants.length > 0
        ? storyVariants
        : storyScript.trim()
        ? [storyScript]
        : [];

    if (index < 0 || index >= variantsFromState.length) {
      return;
    }

    const scriptSource = variantsFromState[index] || '';
    if (!scriptSource.trim()) {
      setError(t.storySellingGenerator.thumbnailGenerateCanceledNoNarration);
      addLog('ERROR', t.storySellingGenerator.generateVideoNarrationEmpty);
      return;
    }

    const bearerKey =
      typeof window !== 'undefined' ? localStorage.getItem('zeoStudio.bearerToken') || '' : '';
    if (!bearerKey) {
      setError(t.storySellingGenerator.thumbnailGenerateCanceledNoBearer);
      addLog('ERROR', t.storySellingGenerator.thumbnailBearerMissing);
      return;
    }

    if (typeof window === 'undefined' || !window.zeoAPI?.generateAffiliateImages) {
      setError(t.storySellingGenerator.thumbnailEngineUnavailable);
      addLog(
        'ERROR',
        t.storySellingGenerator.thumbnailEngineUnavailable,
      );
      return;
    }

    setIsGeneratingThumbnail(true);
    setError(null);
    addLog(
      'INFO',
      t.storySellingGenerator.startingVoAndThumbnail.replace('{count}', String(THUMBNAIL_BATCH_SIZE)),
    );

    try {
      const combinedBase64Url = await compressImage(combinedFile.file);
      const combinedBase64 = getBase64PayloadFromDataUrl(combinedBase64Url);

      const aspectRatioKey = mapThumbnailAspectRatioToEngineKey(thumbnailAspectRatio);
      const thumbnailPrompt = buildThumbnailPrompt(scriptSource);

      const items = Array.from({ length: THUMBNAIL_BATCH_SIZE }, () => ({
        category: 'ugc',
        prompt: thumbnailPrompt,
      }));

      const response = await window.zeoAPI.generateAffiliateImages({
        bearerKey,
        aspectRatioKey,
        items,
        references: {
          product: combinedBase64,
          models: [],
          additional: [],
        },
      });

      if (!response || !response.ok) {
        const message = response?.error || 'Respon engine Nano Banana tidak valid.';
        throw new Error(message);
      }

      const results: any[] = Array.isArray(response.results) ? response.results : [];
      if (!results.length) {
        throw new Error('Engine Nano Banana tidak mengembalikan hasil thumbnail.');
      }

      const thumbs: string[] = [];
      let failedWithErrorCount = 0;

      for (let i = 0; i < Math.min(results.length, THUMBNAIL_BATCH_SIZE); i += 1) {
        const r = results[i];
        if (r?.success && r.dataUrl) {
          thumbs.push(r.dataUrl as string);
          addLog(
            'SUCCESS',
            `Thumbnail ${thumbs.length}/${THUMBNAIL_BATCH_SIZE} untuk script narasi ini berhasil dibuat.`,
          );
        } else if (r) {
          failedWithErrorCount += 1;
          const errMsg: string =
            (typeof r?.error === 'string' && r.error.trim()) ||
            'Engine Nano Banana mengembalikan hasil gagal tanpa pesan error.';
          addLog(
            'ERROR',
            `Engine gagal membuat thumbnail ${i + 1}/${THUMBNAIL_BATCH_SIZE} untuk script narasi ini: ${errMsg}`,
          );
        }
      }

      if (!thumbs.length) {
        throw new Error(
          'Engine Nano Banana tidak menghasilkan thumbnail berhasil untuk script narasi ini.',
        );
      }

      setThumbnailsByVariant((prev) => {
        const next = [...prev];
        if (next.length <= index) {
          const oldLength = next.length;
          next.length = index + 1;
          for (let i = oldLength; i < next.length; i += 1) {
            next[i] = [];
          }
        }
        next[index] = thumbs;
        return next;
      });

      if (thumbs.length > 0) {
        setThumbnailUrl(thumbs[0]);
      }

      if (failedWithErrorCount > 0) {
        addLog(
          'INFO',
          `Beberapa thumbnail untuk script narasi ini gagal dibuat, tetapi ${thumbs.length} berhasil.`,
        );
      }
    } catch (err: any) {
      const message =
        err?.message || 'Terjadi kesalahan saat membuat thumbnail untuk script narasi ini.';
      setError(message);
      addLog('ERROR', message);
    } finally {
      setIsGeneratingThumbnail(false);
    }
  };

  const handleOpenThumbnailEditModal = (variantIndex: number, thumbIndex: number) => {
    const variantThumbs = thumbnailsByVariant[variantIndex] || [];
    const src = variantThumbs[thumbIndex];
    if (!src) {
      addLog(
        'ERROR',
        `Gagal membuka Edit untuk thumbnail Script Utama · Thumb ${thumbIndex + 1}: gambar belum tersedia.`,
      );
      return;
    }

    if (!src.startsWith('data:image')) {
      addLog(
        'ERROR',
        `Gagal membuka Edit untuk thumbnail Script Utama · Thumb ${thumbIndex + 1}: format gambar tidak valid.`,
      );
      return;
    }

    setThumbnailEditModal({
      isOpen: true,
      variantIndex,
      thumbIndex,
      imageUrl: src,
      instruction: '',
      isSubmitting: false,
    });
  };

  const handleCloseThumbnailEditModal = () => {
    setThumbnailEditModal((prev) => ({ ...prev, isOpen: false, isSubmitting: false }));
  };

  const handleApplyThumbnailEdit = async () => {
    if (
      !thumbnailEditModal.imageUrl ||
      thumbnailEditModal.variantIndex === null ||
      thumbnailEditModal.thumbIndex === null ||
      thumbnailEditModal.variantIndex < 0 ||
      thumbnailEditModal.thumbIndex < 0
    ) {
      return;
    }

    const variantIndex = thumbnailEditModal.variantIndex;
    const thumbIndex = thumbnailEditModal.thumbIndex;
    const imageUrl = thumbnailEditModal.imageUrl;
    const editInstruction = thumbnailEditModal.instruction.trim();

    if (!editInstruction) {
      addLog(
        'ERROR',
        `Gagal menjalankan Edit untuk thumbnail Script Utama · Thumb ${
          thumbIndex + 1
        }: instruksi edit kosong.`,
      );
      return;
    }

    if (!imageUrl.startsWith('data:image')) {
      addLog(
        'ERROR',
        `Gagal menjalankan Edit untuk thumbnail Script Utama · Thumb ${
          thumbIndex + 1
        }: format gambar tidak valid.`,
      );
      return;
    }

    const base64 = imageUrl.split(',')[1] || '';
    if (!base64) {
      addLog(
        'ERROR',
        `Gagal menjalankan Edit untuk thumbnail Script Utama · Thumb ${
          thumbIndex + 1
        }: data gambar kosong.`,
      );
      return;
    }

    if (typeof window === 'undefined' || !window.zeoAPI?.editStoryFrame) {
      addLog(
        'ERROR',
        `Gagal menjalankan Edit untuk thumbnail Script Utama · Thumb ${
          thumbIndex + 1
        }: Engine Generate Image (GEM_PIX) tidak tersedia. Pastikan aplikasi desktop Electron Zeo Affiliate berjalan.`,
      );
      return;
    }

    const bearerKey =
      typeof window !== 'undefined' ? localStorage.getItem('zeoStudio.bearerToken') || '' : '';
    if (!bearerKey.trim()) {
      const message =
        'Global Bearer Token untuk Nano Banana Pro belum dikonfigurasi. Buka halaman Pengaturan.';
      addLog(
        'ERROR',
        `Gagal menjalankan Edit untuk thumbnail Script Utama · Thumb ${
          thumbIndex + 1
        }: ${message}`,
      );
      setError(message);
      return;
    }

    const label = `Script Utama · Thumb ${thumbIndex + 1}`;
    const editInstructionText = `Berdasarkan instruksi berikut: "${editInstruction}", edit thumbnail story selling ini. Hasil akhir harus tetap memakai karakter dan produk yang sama, hanya menyesuaikan komposisi, warna, teks hook, atau detail visual ringan. Rasio gambar akhir HARUS ${thumbnailAspectRatio}.`;

    addLog('INFO', t.storySellingGenerator.thumbnailEditProcessing.replace('{label}', label));

    setThumbnailEditModal((prev) => ({ ...prev, isSubmitting: true, isOpen: false }));
    setEditingThumbnailKey(`${variantIndex}-${thumbIndex}`);

    try {
      const result = await window.zeoAPI.editStoryFrame({
        bearerKey,
        aspectRatio: thumbnailAspectRatio,
        instruction: editInstructionText,
        imageBase64: base64,
        mode: 'edit',
      });

      if (!result || !result.ok || !result.dataUrl) {
        const message = (result && result.error) || t.storySellingGenerator.thumbnailResponseInvalid;
        addLog('ERROR', t.storySellingGenerator.thumbnailEditFailed.replace('{label}', label).replace('{error}', message));
        setThumbnailEditModal((prev) => ({ ...prev, isSubmitting: false }));
        return;
      }

      const newUrl = result.dataUrl as string;

      setThumbnailsByVariant((prev) => {
        const next = [...prev];
        if (!next[variantIndex]) next[variantIndex] = [];
        const thumbs = [...next[variantIndex]];
        if (thumbIndex >= 0 && thumbIndex < thumbs.length) {
          thumbs[thumbIndex] = newUrl;
        }
        next[variantIndex] = thumbs;
        return next;
      });

      setThumbnailUrl((prev) => (prev === imageUrl ? newUrl : prev));
      addLog('SUCCESS', t.storySellingGenerator.thumbnailEditSuccess.replace('{label}', label));
      setThumbnailEditModal((prev) => ({ ...prev, isSubmitting: false }));
    } catch (err: any) {
      const message = err?.message || String(err);
      addLog('ERROR', t.storySellingGenerator.thumbnailEditFailed.replace('{label}', label).replace('{error}', message));
      setThumbnailEditModal((prev) => ({ ...prev, isSubmitting: false }));
      setError(message);
    } finally {
      setEditingThumbnailKey(null);
    }
  };

  const handleRegenerateSingleThumbnail = async (variantIndex: number, thumbIndex: number) => {
    if (!combinedFile) {
      setError(t.storySellingGenerator.thumbnailGenerateCanceledNoPhoto);
      addLog(
        'ERROR',
        t.storySellingGenerator.generateCanceledNoPhoto,
      );
      return;
    }

    const variantsFromState =
      storyVariants.length > 0 ? storyVariants : storyScript.trim() ? [storyScript] : [];

    if (variantIndex < 0 || variantIndex >= variantsFromState.length) {
      return;
    }

    const scriptSource = variantsFromState[variantIndex] || '';
    if (!scriptSource.trim()) {
      setError(t.storySellingGenerator.thumbnailGenerateCanceledNoNarration);
      addLog(
        'ERROR',
        t.storySellingGenerator.generateVideoNarrationEmpty,
      );
      return;
    }

    const bearerKey =
      typeof window !== 'undefined' ? localStorage.getItem('zeoStudio.bearerToken') || '' : '';
    if (!bearerKey) {
      setError(t.storySellingGenerator.thumbnailGenerateCanceledNoBearer);
      addLog(
        'ERROR',
        t.storySellingGenerator.thumbnailBearerMissing,
      );
      return;
    }

    if (typeof window === 'undefined' || !window.zeoAPI?.generateAffiliateImages) {
      setError(t.storySellingGenerator.thumbnailEngineUnavailable);
      addLog(
        'ERROR',
        t.storySellingGenerator.thumbnailEngineUnavailable,
      );
      return;
    }

    const label = `Varian ${variantIndex + 1} · Thumb ${thumbIndex + 1}`;
    const oldSrc = (thumbnailsByVariant[variantIndex] || [])[thumbIndex];

    setIsGeneratingThumbnail(true);
    setRegeneratingThumbnailKey(`${variantIndex}-${thumbIndex}`);
    setError(null);
    addLog('INFO', t.storySellingGenerator.thumbnailRegenProcessing.replace('{label}', label));

    try {
      const combinedBase64Url = await compressImage(combinedFile.file);
      const combinedBase64 = getBase64PayloadFromDataUrl(combinedBase64Url);

      const aspectRatioKey = mapThumbnailAspectRatioToEngineKey(thumbnailAspectRatio);
      const thumbnailPrompt = buildThumbnailPrompt(scriptSource);

      const response = await window.zeoAPI.generateAffiliateImages({
        bearerKey,
        aspectRatioKey,
        items: [
          {
            category: 'ugc',
            prompt: thumbnailPrompt,
          },
        ],
        references: {
          product: combinedBase64,
          models: [],
          additional: [],
        },
      });

      if (!response || !response.ok) {
        const message = response?.error || t.storySellingGenerator.thumbnailResponseInvalid;
        throw new Error(message);
      }

      const results: any[] = Array.isArray(response.results) ? response.results : [];
      const result = results[0];

      if (!result || !result.success || !result.dataUrl) {
        const errMsg: string =
          (result && typeof result.error === 'string' && result.error.trim()) ||
          t.storySellingGenerator.thumbnailResponseInvalid;
        throw new Error(errMsg);
      }

      const newUrl: string = result.dataUrl;

      setThumbnailsByVariant((prev) => {
        const next = [...prev];
        if (!next[variantIndex]) next[variantIndex] = [];
        const thumbs = [...next[variantIndex]];
        if (thumbIndex >= 0 && thumbIndex < thumbs.length) {
          thumbs[thumbIndex] = newUrl;
        }
        next[variantIndex] = thumbs;
        return next;
      });

      setThumbnailUrl((prev) => (prev === oldSrc ? newUrl : prev));
      setThumbnailGenerationFailed(false);
      addLog('SUCCESS', t.storySellingGenerator.thumbnailRegenSuccess.replace('{label}', label));
    } catch (err: any) {
      const message =
        err?.message || t.storySellingGenerator.thumbnailRegenError.replace('{label}', label);
      setError(message);
      addLog('ERROR', message);
      setThumbnailGenerationFailed(true);
    } finally {
      setIsGeneratingThumbnail(false);
      setRegeneratingThumbnailKey(null);
    }
  };

  const handleChangeVariantVoice = (index: number, voiceId: string) => {
    const nextId = voiceId || selectedVoiceId || TTS_VOICES[0]?.id || '';
    setHasUserChangedVoice(true);
    setSelectedVoiceId(nextId);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('zeoStudio.storyVo.voiceId', nextId);
      } catch {}
    }

    setVariantVoiceIds((prev) => {
      const next = [...prev];
      if (next.length <= index) {
        const oldLength = next.length;
        next.length = index + 1;
        for (let i = oldLength; i < next.length; i += 1) {
          next[i] = nextId;
        }
      }
      next[index] = nextId;
      return next;
    });
  };

  const handleRegenerateThumbnail = async () => {
    await handleRegenerateSingleThumbnail(0, 0);
    // Setelah thumbnail diregenerasi, jalankan ulang 4 fase video secara paralel agar tidak perlu klik terpisah
    void handleGenerateAllVideoPhases(0);
  };

  const handleRegenerateVariantAudio = async (index: number) => {
    const variantsFromState =
      storyVariants.length > 0
        ? storyVariants
        : storyScript.trim()
        ? [storyScript]
        : [];

    if (index < 0 || index >= variantsFromState.length) {
      return;
    }

    const scriptSource = variantsFromState[index] || '';
    if (!scriptSource.trim()) {
      setError(t.storySellingGenerator.voRegenCanceledNoNarration);
      addLog('ERROR', t.storySellingGenerator.generateVideoNarrationEmpty);
      return;
    }

    const apiKey =
      typeof window !== 'undefined' ? localStorage.getItem('zeoStudio.ai.apiKey') || '' : '';
    if (!apiKey) {
      setError(t.storySellingGenerator.apiKeyMissing);
      addLog('ERROR', t.storySellingGenerator.voRegenCanceledNoApiKey);
      return;
    }

    const cleaned = scriptSource.replace(/(\[.*?\])/g, '').trim();
    if (!cleaned) {
      setError(t.storySellingGenerator.voRegenCanceledInvalidText);
      addLog('ERROR', t.storySellingGenerator.voRegenCanceledInvalidText);
      return;
    }

    const voiceIdForVariant =
      variantVoiceIds[index] || selectedVoiceId || TTS_VOICES[0]?.id || '';

    setIsGeneratingAudio(true);
    setError(null);
    addLog(
      'INFO',
      t.storySellingGenerator.startingVoOnly,
    );

    try {
      const ttsPayload = {
        contents: [{ parts: [{ text: cleaned }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voiceIdForVariant,
              },
            },
          },
        },
      };

      const { audioData, sampleRate } = await callGeminiTts(apiKey, ttsPayload);
      const pcmData = base64ToArrayBuffer(audioData);
      const wavBlob = pcmToWav(pcmData, sampleRate);
      const url = URL.createObjectURL(wavBlob);

      setAudioUrls((prev) => {
        const next = [...prev];
        if (next.length <= index) {
          const oldLength = next.length;
          next.length = index + 1;
          for (let i = oldLength; i < next.length; i += 1) {
            next[i] = null;
          }
        }
        next[index] = url;
        return next;
      });

      setAudioSampleRates((prev) => {
        const next = [...prev];
        if (next.length <= index) {
          const oldLength = next.length;
          next.length = index + 1;
          for (let i = oldLength; i < next.length; i += 1) {
            next[i] = null;
          }
        }
        next[index] = sampleRate;
        return next;
      });

      setActiveVariantIndex(index);
      setupAudioPlayer(url, sampleRate);
      addLog('SUCCESS', t.storySellingGenerator.voRegenSuccess);
    } catch (err: any) {
      const message =
        err?.message || t.storySellingGenerator.voRegenError.replace('{index}', String(index + 1));
      setError(message);
      addLog('ERROR', message);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleGenerateThumbnailFromActiveVariant = async () => {
    if (!combinedFile) {
      setError(t.storySellingGenerator.thumbnailGenerateCanceledNoPhoto);
      addLog('ERROR', t.storySellingGenerator.generateCanceledNoPhoto);
      return;
    }

    const scriptSource = storyVariants[activeVariantIndex] || storyScript || '';
    if (!scriptSource.trim()) {
      setError(t.storySellingGenerator.thumbnailGenerateCanceledNoNarration);
      addLog('ERROR', t.storySellingGenerator.generateVideoNarrationEmpty);
      return;
    }

    const bearerKey =
      typeof window !== 'undefined' ? localStorage.getItem('zeoStudio.bearerToken') || '' : '';
    if (!bearerKey) {
      setError(t.storySellingGenerator.thumbnailGenerateCanceledNoBearer);
      addLog('ERROR', t.storySellingGenerator.thumbnailBearerMissing);
      return;
    }

    if (typeof window === 'undefined' || !window.zeoAPI?.generateAffiliateImages) {
      setError(t.storySellingGenerator.thumbnailEngineUnavailable);
      addLog(
        'ERROR',
        t.storySellingGenerator.thumbnailEngineUnavailable,
      );
      return;
    }

    setIsGeneratingThumbnail(true);
    setError(null);
    addLog(
      'INFO',
      t.storySellingGenerator.startingVoAndThumbnail.replace('{count}', '1'),
    );

    try {
      const combinedBase64Url = await compressImage(combinedFile.file);
      const combinedBase64 = getBase64PayloadFromDataUrl(combinedBase64Url);

      const aspectRatioKey = mapThumbnailAspectRatioToEngineKey(thumbnailAspectRatio);
      const thumbnailPrompt = buildThumbnailPrompt(scriptSource);

      const response = await window.zeoAPI.generateAffiliateImages({
        bearerKey,
        aspectRatioKey,
        items: [
          {
            category: 'ugc',
            prompt: thumbnailPrompt,
          },
        ],
        references: {
          product: combinedBase64,
          models: [],
          additional: [],
        },
      });

      if (!response || !response.ok) {
        const message = response?.error || 'Respon engine Nano Banana tidak valid.';
        throw new Error(message);
      }

      const results: any[] = Array.isArray(response.results) ? response.results : [];
      const result = results[0];

      if (!result || !result.success || !result.dataUrl) {
        const errMsg: string =
          (result && typeof result.error === 'string' && result.error.trim()) ||
          'Engine Nano Banana tidak mengembalikan thumbnail yang valid.';
        throw new Error(errMsg);
      }

      const imageDataUrl: string = result.dataUrl;
      setThumbnailUrl(imageDataUrl);
      addLog(
        'SUCCESS',
        'Thumbnail story selling berhasil dibuat berdasarkan script narasi utama.',
      );
    } catch (err: any) {
      const message = err?.message || 'Terjadi kesalahan saat membuat thumbnail dari varian aktif.';
      addLog('ERROR', message);
      setError(message);
    } finally {
      setIsGeneratingThumbnail(false);
    }
  };

  const handlePlayPauseAudio = () => {
    handlePlayPauseVariantAudio(activeVariantIndex);
  };

  const handleDownloadAudio = () => {
    handleDownloadVariantAudio(activeVariantIndex);
  };

  const handleDownloadThumbnail = (imageUrl: string | null) => {
    if (!imageUrl) return;
    const a = document.createElement('a');
    const dateCode = new Date().toISOString().slice(0, 10);
    a.href = imageUrl;
    a.download = `story-thumbnail-${dateCode}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleClearAll = () => {
    stopAudio();
    
    // Clear video card reveal timeouts
    videoCardRevealTimeouts.current.forEach(timeout => clearTimeout(timeout));
    videoCardRevealTimeouts.current = [];
    setVisibleVideoCardIds(new Set());
    
    setCombinedFile(null);
    setDiscoveryRef(null);
    setTransformationRef(null);
    setInvitationRef(null);
    setIsAnalyzingImage(false);
    setImageAnalysisSummary('');
    setProblem('');
    setDiscovery('');
    setTransformation('');
    setInvitation('');
    setStoryScript('');
    setStoryVariants([]);
    setActiveVariantIndex(0);
    setAudioUrl(null);
    setAudioUrls([]);
    setAudioDuration(0);
    setAudioCurrentTime(0);
    setIsAudioPlaying(false);
    setAudioSampleRate(null);
    setAudioSampleRates([]);
    audioRef.current = null;
    setThumbnailUrl(null);
    setThumbnailsByVariant([]);
    setThumbnailAspectRatio(DEFAULT_THUMBNAIL_ASPECT_RATIO);
    setThumbnailEditModal({
      isOpen: false,
      variantIndex: null,
      thumbIndex: null,
      imageUrl: null,
      instruction: '',
      isSubmitting: false,
    });
    setEditingThumbnailKey(null);
    setRegeneratingThumbnailKey(null);
    setThumbnailPreviewUrl(null);
    setHookVideosByVariant([]);
    setHookVideoGeneratingVariants([]);
    setStoryVideoPhase('PROBLEM');
    setActivityLogs([]);
    setActivityLogCopyLabel(t.activityLog.copyLog);
    setError(null);
  };

  const handleOpenResetConfirm = () => {
    setIsResetConfirmOpen(true);
  };

  const handleConfirmReset = () => {
    setIsResetConfirmOpen(false);
    handleClearAll();
  };

  const autoSaveStory = useCallback((text: string) => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    setAutoSaveStatus('unsaved');

    autoSaveTimeoutRef.current = setTimeout(() => {
      const updatedText = text.trim();
      if (!updatedText) return;

      setAutoSaveStatus('saving');
      
      if (storyVariants.length > 0) {
        const newVariants = [...storyVariants];
        newVariants[activeVariantIndex] = updatedText;
        setStoryVariants(newVariants);
        setStoryScript(updatedText);
      } else {
        setStoryScript(updatedText);
      }
      
      setAutoSaveStatus('saved');
      addLog('SUCCESS', t.storySellingGenerator.autosaveSuccess);
    }, 1000); // Auto-save after 1 second of inactivity
  }, [storyVariants, activeVariantIndex]);

  const handleEditStory = () => {
    const currentStory = storyVariants.length > 0 ? storyVariants[activeVariantIndex] : storyScript;
    setEditingStoryText(currentStory);
    setIsEditingStory(true);
    setAutoSaveStatus('saved');
  };

  const handleSaveStory = () => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }

    const updatedText = editingStoryText.trim();
    if (!updatedText) return;

    setAutoSaveStatus('saving');
    
    if (storyVariants.length > 0) {
      const newVariants = [...storyVariants];
      newVariants[activeVariantIndex] = updatedText;
      setStoryVariants(newVariants);
      setStoryScript(updatedText);
    } else {
      setStoryScript(updatedText);
    }
    
    setIsEditingStory(false);
    setEditingStoryText('');
    setAutoSaveStatus('saved');
    addLog('SUCCESS', t.storySellingGenerator.storyUpdateSuccess);
  };

  const handleCancelEditStory = () => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }
    
    setIsEditingStory(false);
    setEditingStoryText('');
    setAutoSaveStatus('saved');
    setGeneratedCaption('');
    setGeneratedHashtags([]);
  };

  const generateCaptionAndHashtags = async (storyText: string) => {
    if (!storyText.trim()) return;
    
    setIsGeneratingCaption(true);
    try {
      // Simulate API call to generate caption and hashtags
      // In real implementation, this would call an AI service
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Generate caption (first 100 characters of story, optimized for social media)
      const caption = storyText.length > 100 
        ? storyText.substring(0, 97) + '...' 
        : storyText;
      
      // Generate hashtags based on story content
      const hashtags = [
        '#StorySelling',
        '#Marketing',
        '#BusinessTips',
        '#Entrepreneur',
        '#SuccessStory',
        '#Inspiration',
        '#Growth',
        '#Strategy'
      ];
      
      setGeneratedCaption(caption);
      setGeneratedHashtags(hashtags);
      addLog('SUCCESS', t.storySellingGenerator.captionGenSuccess);
    } catch (error) {
      addLog('ERROR', t.storySellingGenerator.captionGenError);
    } finally {
      setIsGeneratingCaption(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      addLog('SUCCESS', t.storySellingGenerator.clipboardCopySuccess);
    } catch (error) {
      addLog('ERROR', t.storySellingGenerator.clipboardCopyError);
    }
  };

  const copyCaptionAndHashtags = () => {
    const fullText = `${generatedCaption}\n\n${generatedHashtags.join(' ')}`;
    copyToClipboard(fullText);
  };

  // Auto-save cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  const handleCancelReset = () => {
    setIsResetConfirmOpen(false);
  };

  const hasStory = !!storyScript.trim();
  const hasAssets = !!audioUrl;
  const visibleScripts = hasStory ? [storyScript] : [];
  const hasAnyHookVideos = hookVideosByVariant.some(
    (variantHooks) => Array.isArray(variantHooks) && variantHooks.length > 0,
  );
  const activeVariantHasAudio = !!audioUrls[activeVariantIndex];
  const getVideoPhaseIndex = (phase: StoryVoVideoPhase): number => {
    if (phase === 'PROBLEM') return 0;
    if (phase === 'DISCOVERY') return 1;
    if (phase === 'TRANSFORMATION') return 2;
    return 3;
  };

  const activePhaseIndex = getVideoPhaseIndex(storyVideoPhase);
  const isGeneratingHooksForActiveVariant = hookVideoGeneratingVariants.includes(activePhaseIndex);

  const isPhaseCompleted = (phase: StoryVoVideoPhase): boolean => {
    const rowIndex = getVideoPhaseIndex(phase);
    const hooks = hookVideosByVariant[rowIndex] || [];
    const completedCount = hooks.filter((item) => item && item.filePath).length;
    return completedCount >= 4;
  };

  const getNextVisiblePhase = (): StoryVoVideoPhase => {
    if (!isPhaseCompleted('PROBLEM')) return 'PROBLEM';
    if (!isPhaseCompleted('DISCOVERY')) return 'DISCOVERY';
    if (!isPhaseCompleted('TRANSFORMATION')) return 'TRANSFORMATION';
    return 'INVITATION';
  };

  const isAllPhasesCompleted = (): boolean =>
    isPhaseCompleted('PROBLEM') &&
    isPhaseCompleted('DISCOVERY') &&
    isPhaseCompleted('TRANSFORMATION') &&
    isPhaseCompleted('INVITATION');

  const getVideoPhaseIdleLabel = (): string => {
    const phase = getNextVisiblePhase();
    switch (phase) {
      case 'PROBLEM':
        return 'Generate Video Problem (1x)';
      case 'DISCOVERY':
        return 'Generate Video Discovery (1x)';
      case 'TRANSFORMATION':
        return 'Generate Video Transformation (1x)';
      case 'INVITATION':
      default:
        return 'Generate Video Invitation (1x)';
    }
  };

  const getVideoPhaseLoadingLabel = (): string => {
    // Use current running phase for loading text
    switch (storyVideoPhase) {
      case 'PROBLEM':
        return 'Processing Problem Videos...';
      case 'DISCOVERY':
        return 'Processing Discovery Videos...';
      case 'TRANSFORMATION':
        return 'Processing Transformation Videos...';
      case 'INVITATION':
      default:
        return 'Processing Invitation Videos...';
    }
  };

  return (
    <div className="h-full w-full flex flex-col min-h-0 text-gray-50">
      <PageHeader
        iconId="generate-storyselling"
        iconClassName="h-6 w-6 mr-3 text-white"
        title={t.storySellingGenerator.title}
        description={t.storySellingGenerator.description}
        tutorialUrl={STORYSELLING_TUTORIAL_URL}
        tutorialTitle="Tutorial Generate Storyselling"
        tutorialMode="direct"
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
            <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar px-6 py-4 space-y-4 text-sm">
              {/* Unggah Foto Karakter */}
              <div className="p-4 rounded-lg bg-zinc-900/80 border border-zinc-800">
                <h2 className="text-sm font-semibold text-gray-100 mb-3">{t.storySellingGenerator.uploadCharacterProduct}</h2>
                <p className="text-xs text-gray-400 mb-4">
                  {t.storySellingGenerator.uploadCharacterProductDesc}
                </p>
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                  <div
                    onClick={() => combinedInputRef.current?.click()}
                    className="w-28 aspect-[3/4] bg-zinc-950 rounded-lg border-2 border-dashed border-zinc-700 flex items-center justify-center text-center text-gray-400 text-[11px] cursor-pointer hover:border-purple-500 transition shrink-0"
                  >
                    {combinedFile ? (
                      <img
                        src={combinedFile.preview}
                        alt="preview karakter dan produk"
                        className="w-full h-full object-cover rounded-md"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-lg">🖼️</span>
                        <span>{t.storySellingGenerator.clickToUpload}</span>
                      </div>
                    )}
                  </div>
                  <input
                    type="file"
                    ref={combinedInputRef}
                    onChange={handleCombinedFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <div className="flex-grow flex flex-col gap-2 w-full text-xs text-gray-300">
                    <p>
                      {t.storySellingGenerator.selectPhotoDesc}
                    </p>
                    {isAnalyzingImage && (
                      <div className="mt-1 text-[11px] text-purple-300 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                        <span>{t.storySellingGenerator.analyzingImage}</span>
                      </div>
                    )}
                    {!isAnalyzingImage && (
                      <div className="mt-2">
                        <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                          {t.storySellingGenerator.imageAnalysisLabel}
                        </label>
                        <textarea
                          rows={4}
                          value={imageAnalysisSummary}
                          onChange={(e) => setImageAnalysisSummary(e.target.value)}
                          className="w-full bg-zinc-950 rounded-lg px-3 py-2 text-[11px] text-gray-200 border border-zinc-700 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-y"
                          placeholder={t.storySellingGenerator.imageAnalysisPlaceholder}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-3 p-4 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-3">
                <h2 className="text-sm font-semibold text-gray-100 mb-2">
                  {t.storySellingGenerator.referencePhotos}
                </h2>
                <p className="text-xs text-gray-400 mb-3">
                  {t.storySellingGenerator.referencePhotosDesc}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-gray-300">{t.storySellingGenerator.discovery}</span>
                    <div
                      onClick={() => discoveryRefInputRef.current?.click()}
                      className="w-full aspect-[3/4] bg-zinc-950 rounded-lg border-2 border-dashed border-zinc-700 flex items-center justify-center text-center text-gray-400 text-[11px] cursor-pointer hover:border-purple-500 transition"
                    >
                      {discoveryRef ? (
                        <img
                          src={discoveryRef.preview}
                          alt="Foto referensi Penemuan"
                          className="w-full h-full object-cover rounded-md"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-lg">🖼️</span>
                          <span>{t.storySellingGenerator.uploadFoto}</span>
                        </div>
                      )}
                    </div>
                    <input
                      type="file"
                      ref={discoveryRefInputRef}
                      onChange={handleDiscoveryRefChange}
                      accept="image/*"
                      className="hidden"
                    />
                    <p className="text-[11px] text-gray-500">
                      {t.storySellingGenerator.discoveryHint}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-gray-300">{t.storySellingGenerator.transformation}</span>
                    <div
                      onClick={() => transformationRefInputRef.current?.click()}
                      className="w-full aspect-[3/4] bg-zinc-950 rounded-lg border-2 border-dashed border-zinc-700 flex items-center justify-center text-center text-gray-400 text-[11px] cursor-pointer hover:border-purple-500 transition"
                    >
                      {transformationRef ? (
                        <img
                          src={transformationRef.preview}
                          alt="Foto referensi Transformasi"
                          className="w-full h-full object-cover rounded-md"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-lg">🖼️</span>
                          <span>{t.storySellingGenerator.uploadFoto}</span>
                        </div>
                      )}
                    </div>
                    <input
                      type="file"
                      ref={transformationRefInputRef}
                      onChange={handleTransformationRefChange}
                      accept="image/*"
                      className="hidden"
                    />
                    <p className="text-[11px] text-gray-500">
                      {t.storySellingGenerator.transformationHint}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-gray-300">{t.storySellingGenerator.invitation}</span>
                    <div
                      onClick={() => invitationRefInputRef.current?.click()}
                      className="w-full aspect-[3/4] bg-zinc-950 rounded-lg border-2 border-dashed border-zinc-700 flex items-center justify-center text-center text-gray-400 text-[11px] cursor-pointer hover:border-purple-500 transition"
                    >
                      {invitationRef ? (
                        <img
                          src={invitationRef.preview}
                          alt="Foto referensi Undangan"
                          className="w-full h-full object-cover rounded-md"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-lg">🖼️</span>
                          <span>{t.storySellingGenerator.uploadFoto}</span>
                        </div>
                      )}
                    </div>
                    <input
                      type="file"
                      ref={invitationRefInputRef}
                      onChange={handleInvitationRefChange}
                      accept="image/*"
                      className="hidden"
                    />
                    <p className="text-[11px] text-gray-500">
                      {t.storySellingGenerator.invitationHint}
                    </p>
                  </div>
                </div>
              </div>

              {/* Blok Story Selling */}
              <div className="p-4 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-3">
                <h2 className="text-sm font-semibold text-gray-100 mb-1">{t.storySellingGenerator.storySellingBlocks}</h2>
                <p className="text-[11px] text-gray-400 mb-2">
                  {t.storySellingGenerator.storySellingBlocksDesc}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-300 mb-1">{t.storySellingGenerator.problem}</label>
                    <textarea
                      rows={2}
                      value={problem}
                      onChange={(e) => setProblem(e.target.value)}
                      className="w-full bg-zinc-950 rounded-lg px-3 py-2 text-[11px] text-gray-200 border border-zinc-700 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                      placeholder={t.storySellingGenerator.problemPlaceholder}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-300 mb-1">{t.storySellingGenerator.discovery}</label>
                    <textarea
                      rows={2}
                      value={discovery}
                      onChange={(e) => setDiscovery(e.target.value)}
                      className="w-full bg-zinc-950 rounded-lg px-3 py-2 text-[11px] text-gray-200 border border-zinc-700 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                      placeholder={t.storySellingGenerator.discoveryPlaceholder}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-300 mb-1">{t.storySellingGenerator.transformation}</label>
                    <textarea
                      rows={2}
                      value={transformation}
                      onChange={(e) => setTransformation(e.target.value)}
                      className="w-full bg-zinc-950 rounded-lg px-3 py-2 text-[11px] text-gray-200 border border-zinc-700 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                      placeholder={t.storySellingGenerator.transformationPlaceholder}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-300 mb-1">{t.storySellingGenerator.invitation}</label>
                    <textarea
                      rows={2}
                      value={invitation}
                      onChange={(e) => setInvitation(e.target.value)}
                      className="w-full bg-zinc-950 rounded-lg px-3 py-2 text-[11px] text-gray-200 border border-zinc-700 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                      placeholder={t.storySellingGenerator.invitationPlaceholder}
                    />
                  </div>
                </div>

                <div className="space-y-2 mt-3">
                </div>
              </div>
            </div>

            <div className="px-6 pb-5 pt-3 border-t border-zinc-800 space-y-3">
              <button
                type="button"
                onClick={handleGenerateStoryAndAssets}
                disabled={
                  isGeneratingStory ||
                  isGeneratingAudio ||
                  isGeneratingThumbnail ||
                  isGeneratingAllVideos ||
                  !combinedFile ||
                  !problem.trim() ||
                  !discovery.trim() ||
                  !transformation.trim() ||
                  !invitation.trim()
                }
                className={`w-full min-h-[48px] px-4 rounded-lg text-white font-semibold text-sm flex items-center justify-center transition-all duration-200 btn-glass-primary
                  focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-zinc-900
                  ${
                    isGeneratingStory || isGeneratingAudio || isGeneratingThumbnail || isGeneratingAllVideos || !combinedFile || !problem.trim() || !discovery.trim() || !transformation.trim() || !invitation.trim()
                      ? 'bg-zinc-600 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
                  }`}
              >
                {isGeneratingStory || isGeneratingAudio || isGeneratingThumbnail || isGeneratingAllVideos
                  ? t.storySellingGenerator.generatingNarrative
                  : t.storySellingGenerator.generateStorySelling}
              </button>

              <div className="max-h-52 bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-xs text-gray-200 flex flex-col">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-gray-100">{t.activityLog.title}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyActivityLog}
                      disabled={activityLogs.length === 0}
                      className="px-2 py-0.5 rounded-md border border-zinc-600 text-[10px] text-gray-200 hover:bg-zinc-800 disabled:opacity-40"
                    >
                      {activityLogCopyLabel}
                    </button>
                    <span className="text-[10px] text-gray-500">{t.storySellingGenerator.logEntries.replace('{count}', String(activityLogs.length))}</span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
                  {activityLogs.length === 0 ? (
                    <p className="text-[11px] text-gray-500">
                      {t.storySellingGenerator.noActivity}
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
              <div>
                <h3 className="text-lg font-semibold text-gray-50">{t.storySellingGenerator.previewStorySelling}</h3>
                {hasStory && (
                  <p className="mt-0.5 text-[11px] text-gray-400">
                    {t.storySellingGenerator.previewSubtitle}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenResetConfirm}
                  className="inline-flex items-center px-4 py-2 text-[11px] font-semibold rounded-lg shadow-md transition-all duration-200 btn-glass-primary bg-red-600 hover:bg-red-700 text-white"
                >
                  <span className="mr-1.5 text-xs">🗑️</span>
                  <span>{t.storySellingGenerator.clearData}</span>
                </button>
              </div>
            </div>

            <div className="flex-1 flex flex-col px-6 pt-0 pb-4 min-h-0 overflow-y-auto custom-scrollbar">
              {!hasStory && !hasAssets && (
                <div className="mt-4 flex-1 flex items-center justify-center bg-zinc-950/40 rounded-lg text-gray-500 text-center text-xs p-4">
                  <p>
                    {t.storySellingGenerator.emptyPreviewHint}{' '}
                    <span className="font-semibold text-gray-300">{t.storySellingGenerator.generateStorySelling}</span>.
                  </p>
                </div>
              )}

              {hasStory && (
                <div className="sticky top-0 z-20 bg-zinc-900 border-b border-zinc-800 pt-2 pb-2 text-[11px] text-gray-300">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-gray-100">{t.storySellingGenerator.mainNarrativeScript}</span>
                      <p className="text-[10px] text-gray-500">
                        {t.storySellingGenerator.mainNarrativeSubtitle}
                      </p>
                    </div>
                    <div className="mt-2 sm:mt-0 flex flex-wrap items-center gap-2">
                      {/* Show Regenerate Failed button if there are failed videos and video generation was attempted */}
                      <button
                        type="button"
                        onClick={handlePlayPauseAudio}
                        disabled={!activeVariantHasAudio}
                        className="px-3 py-1.5 rounded-lg text-white text-[11px] font-semibold btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {activeVariantHasAudio && isAudioPlaying ? t.storySellingGenerator.pauseVo : t.storySellingGenerator.playVo}
                      </button>
                      <button
                        type="button"
                        onClick={handleGenerateVideos}
                        disabled={isGeneratingAllVideos || isGeneratingStory}
                        className="px-3 py-1.5 rounded-lg text-white text-[11px] font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {isGeneratingAllVideos ? t.storySellingGenerator.generatingVideos : t.storySellingGenerator.generateVideos}
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadAudio}
                        disabled={!activeVariantHasAudio}
                        className="px-3 py-1.5 rounded-lg text-white text-[11px] font-semibold bg-purple-700 hover:bg-purple-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {t.storySellingGenerator.downloadAudio}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRegenerateVariantAudio(activeVariantIndex)}
                        disabled={isGeneratingAudio}
                        className="px-3 py-1.5 rounded-lg text-white text-[11px] font-semibold bg-purple-700 hover:bg-purple-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {isGeneratingAudio ? t.storySellingGenerator.processingVo : t.storySellingGenerator.regenerateVo}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {hasStory && (
                <div className="mt-4 mb-3 text-[11px] text-gray-300 space-y-2">

                  <div className="space-y-2">
                    {visibleScripts.map((variantText, idx) => {
                      const hasAudioForVariant = !!audioUrls[idx];
                      const isActive = activeVariantIndex === idx;
                      const currentTime = isActive ? audioCurrentTime : 0;
                      const duration = isActive ? audioDuration : 0;
                      const variantSampleRate = audioSampleRates[idx] ?? null;
                      const voiceIdForVariant =
                        variantVoiceIds[idx] || selectedVoiceId || TTS_VOICES[0]?.id || '';
                      const hooksForVariant = hookVideosByVariant[idx] || [];
                      const isGeneratingHooks = hookVideoGeneratingVariants.includes(idx);

                      return (
                        <div
                          key={idx}
                          className="relative bg-zinc-950 border border-zinc-800 rounded-lg p-3 flex flex-col gap-2"
                        >
                          {isGeneratingStory && (
                            <div className="absolute inset-0 rounded-lg overflow-hidden flex flex-col items-center justify-center bg-black/70 z-20 text-gray-100">
                              <GradientLoader size="sm" showLogo={false} text={t.storySellingGenerator.generatingNarrative} subtitle={t.storySellingGenerator.pleaseWait} />
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-md text-[10px] border border-purple-400 text-purple-100">
                                {t.storySellingGenerator.mainScript}
                              </span>
                              {isActive && hasAudioForVariant && (
                                <span className="text-[10px] text-emerald-300">{t.storySellingGenerator.audioPlaying}</span>
                              )}
                              {!hasAudioForVariant && (
                                <span className="text-[10px] text-red-300">{t.storySellingGenerator.audioNotAvailable}</span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2 items-center justify-between text-[10px] text-gray-300">
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                              <span className="text-[10px] font-semibold text-gray-300 whitespace-nowrap">
                                {t.storySellingGenerator.ttsVoice}
                              </span>
                              <select
                                value={voiceIdForVariant}
                                onChange={(e) => handleChangeVariantVoice(idx, e.target.value)}
                                className="flex-1 sm:flex-none p-1.5 border border-zinc-700 bg-zinc-900 rounded-md text-[10px] text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer min-w-[120px]"
                              >
                                {TTS_VOICES.map((voice) => (
                                  <option key={voice.id} value={voice.id}>
                                    {voice.name} — {getLocalizedTone(voice.tone, language)}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="flex flex-col gap-1 text-[10px] text-gray-400">
                            <input
                              type="range"
                              min={0}
                              max={hasAudioForVariant ? duration : 0}
                              step={0.1}
                              value={hasAudioForVariant ? currentTime : 0}
                              onChange={(e) => handleSeekVariantAudio(idx, Number(e.target.value))}
                              disabled={!hasAudioForVariant}
                              className="w-full accent-purple-500 disabled:opacity-40"
                            />
                            <div className="flex justify-between">
                              <span>
                                {formatTime(currentTime)} / {formatTime(duration)}
                              </span>
                              {variantSampleRate && (
                                <span>{`${Math.round(variantSampleRate / 1000)} kHz`}</span>
                              )}
                            </div>
                          </div>

                          <div className="mt-1 bg-zinc-950 border border-zinc-800 rounded-md p-2">
                            {isEditingStory && isActive ? (
                              <div className="space-y-2">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-[10px] text-gray-400">
                                    {t.storySellingGenerator.autoSaveLabel} 
                                    <span className={`ml-1 font-semibold ${
                                      autoSaveStatus === 'saved' ? 'text-green-400' : 
                                      autoSaveStatus === 'saving' ? 'text-yellow-400' : 
                                      'text-orange-400'
                                    }`}>
                                      {autoSaveStatus === 'saved' ? t.storySellingGenerator.autoSaveSaved : 
                                       autoSaveStatus === 'saving' ? t.storySellingGenerator.autoSaveSaving : 
                                       t.storySellingGenerator.autoSaveUnsaved}
                                    </span>
                                  </span>
                                </div>
                                <textarea
                                  value={editingStoryText}
                                  onChange={(e) => {
                                    setEditingStoryText(e.target.value);
                                    autoSaveStory(e.target.value);
                                    // Auto-generate caption and hashtags when text changes
                                    if (e.target.value.trim().length > 50) {
                                      generateCaptionAndHashtags(e.target.value);
                                    }
                                  }}
                                  className="w-full bg-zinc-900 border border-zinc-700 rounded text-[11px] text-gray-200 p-2 min-h-[200px] resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                                  placeholder={t.storySellingGenerator.editStoryPlaceholder}
                                />
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={handleCancelEditStory}
                                    className="px-3 py-1 rounded-md border border-zinc-600 text-[10px] text-gray-300 hover:bg-zinc-800 transition"
                                  >
                                    {t.storySellingGenerator.cancelBtn}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleSaveStory}
                                    className="px-3 py-1 rounded-md bg-purple-600 text-[10px] text-white hover:bg-purple-700 transition"
                                  >
                                    {t.storySellingGenerator.saveBtn}
                                  </button>
                                </div>
                                
                                {/* Caption and Hashtags Section */}
                                {(generatedCaption || generatedHashtags.length > 0) && (
                                  <div className="mt-3 p-3 bg-zinc-900 border border-zinc-700 rounded-lg space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] font-semibold text-gray-300">
                                        {t.storySellingGenerator.captionAndHashtags}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={copyCaptionAndHashtags}
                                        className="px-3 py-1.5 rounded-lg text-white text-[11px] font-semibold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1"
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
                                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                          />
                                        </svg>
                                        {t.storySellingGenerator.copyAll}
                                      </button>
                                    </div>
                                    
                                    {isGeneratingCaption ? (
                                      <div className="flex items-center gap-2 text-[10px] text-gray-400">
                                        <GradientLoader size="sm" mode="spinner-only" className="w-3 h-3" />
                                        {t.storySellingGenerator.generatingCaption}
                                      </div>
                                    ) : (
                                      <>
                                        {generatedCaption && (
                                          <div className="space-y-1">
                                            <span className="text-[9px] text-gray-500">{t.storySellingGenerator.captionLabel}</span>
                                            <div className="p-2 bg-zinc-950 border border-zinc-600 rounded text-[10px] text-gray-200">
                                              {generatedCaption}
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => copyToClipboard(generatedCaption)}
                                              className="px-3 py-1.5 rounded-lg text-white text-[11px] font-semibold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1"
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
                                                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                                />
                                              </svg>
                                              {t.storySellingGenerator.copyCaption}
                                            </button>
                                          </div>
                                        )}
                                        
                                        {generatedHashtags.length > 0 && (
                                          <div className="space-y-1">
                                            <span className="text-[9px] text-gray-500">{t.storySellingGenerator.hashtagsLabel}</span>
                                            <div className="p-2 bg-zinc-950 border border-zinc-600 rounded">
                                              <div className="flex flex-wrap gap-1">
                                                {generatedHashtags.map((tag, index) => (
                                                  <span
                                                    key={index}
                                                    className="px-2 py-0.5 bg-purple-900 text-purple-200 text-[9px] rounded"
                                                  >
                                                    {tag}
                                                  </span>
                                                ))}
                                              </div>
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => copyToClipboard(generatedHashtags.join(' '))}
                                              className="px-3 py-1.5 rounded-lg text-white text-[11px] font-semibold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1"
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
                                                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                                />
                                              </svg>
                                              {t.storySellingGenerator.copyHashtags}
                                            </button>
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="group relative">
                                <div className="text-[11px] text-gray-200 whitespace-pre-wrap">
                                  {variantText}
                                </div>
                                <button
                                  type="button"
                                  onClick={handleEditStory}
                                  className="absolute top-1 right-1 px-2 py-1 rounded bg-zinc-800 text-[10px] text-gray-300 hover:bg-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                  title={t.storySellingGenerator.editBtn}
                                >
                                  {t.storySellingGenerator.editBtn}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {hasAnyHookVideos && (
                <div className="mt-2 mb-3 text-[11px] text-gray-300 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span className="font-semibold text-gray-100">{t.storySellingGenerator.videoStorySelling}</span>
                      <p className="text-[10px] text-gray-500">
                        {t.storySellingGenerator.videoStorySellingDesc}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      {hookVideosByVariant.map((variantHooks, vIdx) => {
                        const hooks = variantHooks || [];
                        const hasAnyForVariant = hooks.some((hook) => !!hook);
                        const isVariantGenerating = hookVideoGeneratingVariants.includes(vIdx);

                        const phaseLabel =
                          vIdx === 0
                            ? 'Problem'
                            : vIdx === 1
                            ? 'Discovery'
                            : vIdx === 2
                            ? 'Transformation'
                            : 'Invitation';

                        const phaseForRow: StoryVoVideoPhase =
                          vIdx === 0
                            ? 'PROBLEM'
                            : vIdx === 1
                            ? 'DISCOVERY'
                            : vIdx === 2
                            ? 'TRANSFORMATION'
                            : 'INVITATION';

                        return (
                          <div key={`hook-row-${vIdx}`} className="space-y-2">
                            <div className="text-center">
                              <span className="inline-block px-2 py-1 rounded-md bg-zinc-800 text-[10px] text-gray-100 font-medium">
                                {phaseLabel}
                              </span>
                            </div>
                            {Array.from({ length: 1 }).map((_, sceneIdx) => {
                              const output = hooks[sceneIdx];
                              const videoUrl = output ? getVideoFileUrl(output.filePath) : null;
                              const isGenerating = output?.status === 'generating';
                              const isFailed = output?.status === 'failed';
                              const countdownMsg = getCountdownMessageForVideo(output);
                              const cardId = `story-video-${vIdx}-${output?.sceneIndex ?? sceneIdx}`;
                              const isVisible = visibleVideoCardIds.has(cardId) || output?.status === 'completed' || output?.status === 'failed';

                              return (
                                <div
                                  key={`${output?.filePath || `placeholder-${sceneIdx}`}`}
                                  className={`relative rounded-md overflow-hidden border transition-all duration-500 ${
                                    isFailed ? 'border-red-500/60 bg-red-950/20' : 'border-zinc-800 bg-black'
                                  } ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
                                >
                                  <div className="absolute top-1 left-1 right-1 z-10 px-2 flex items-center justify-between pointer-events-none">
                                    {!isGenerating && videoUrl && (
                                      <div className="flex gap-1 pointer-events-auto">
                                        <button
                                          type="button"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            void handleGenerateVideoHooksForVariant(
                                              activeVariantIndex,
                                              phaseForRow,
                                              sceneIdx,
                                            );
                                          }}
                                          disabled={isVariantGenerating}
                                          className="px-2.5 py-1 rounded-md text-[10px] font-semibold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white disabled:opacity-60 disabled:cursor-not-allowed"
                                          title={t.storySellingGenerator.regenerate}
                                        >
                                          {isVariantGenerating ? t.storySellingGenerator.processingVideo : t.storySellingGenerator.regenerate}
                                        </button>
                                      </div>
                                    )}
                                    {!isGenerating && videoUrl && (
                                      <div className="pointer-events-auto">
                                        <a
                                          href={videoUrl}
                                          download={output?.fileName || undefined}
                                          onClick={(event) => event.stopPropagation()}
                                          className="px-2 py-1 rounded-md bg-zinc-900/90 hover:bg-zinc-800 text-[10px] text-gray-100 border border-zinc-700 text-center"
                                        >
                                          {t.storySellingGenerator.downloadBtn}
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                  <div className="relative w-full pb-[177.78%] bg-black overflow-hidden">
                                    {isGenerating ? (
                                      <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-100">
                                        <img
                                          src={getLoadingGifByIndex(vIdx + sceneIdx)}
                                          alt="Loading video"
                                          className="absolute inset-0 w-full h-full object-cover opacity-60"
                                        />
                                        <div className="absolute inset-0 bg-black/60" />
                                        <div className="relative z-10 flex flex-col items-center text-center px-3">
                                          {countdownMsg && (
                                            <div className="text-sm text-purple-300 font-bold">{countdownMsg}</div>
                                          )}
                                          <div className="mt-1 text-[10px] text-gray-200 px-2 text-center line-clamp-2">
                                            {output?.generationMode === 'regen' ? 'Regenerating Video...' : 'Generating Video...'}
                                          </div>
                                        </div>
                                      </div>
                                    ) : isFailed ? (
                                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/40 text-red-300">
                                        <div className="text-2xl mb-2">⚠️</div>
                                        <div className="text-xs font-semibold">Failed</div>
                                        {output?.errorMessage && (
                                          <div className="mt-1 text-[10px] text-red-400 px-2 text-center">
                                            {output.errorMessage}
                                          </div>
                                        )}
                                        <button
                                          type="button"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            void handleGenerateVideoHooksForVariant(
                                              activeVariantIndex,
                                              phaseForRow,
                                              sceneIdx,
                                            );
                                          }}
                                          disabled={isVariantGenerating}
                                          className="mt-2 inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-semibold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                          {isVariantGenerating ? t.storySellingGenerator.processingVideo : t.storySellingGenerator.regenerate}
                                        </button>
                                      </div>
                                    ) : videoUrl ? (
                                      <video
                                        src={`${videoUrl}#t=0.5`}
                                        className="absolute inset-0 w-full h-full object-cover bg-black"
                                        controls
                                        preload="metadata"
                                        playsInline
                                      />
                                    ) : (
                                      <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center text-[10px] text-gray-400 gap-1">
                                        <span>{t.storySellingGenerator.noVideoYet}</span>
                                        <button
                                          type="button"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            void handleGenerateVideoHooksForVariant(
                                              activeVariantIndex,
                                              phaseForRow,
                                              sceneIdx,
                                            );
                                          }}
                                          disabled={isVariantGenerating}
                                          className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                          {isVariantGenerating ? t.storySellingGenerator.processingVideo : t.storySellingGenerator.regenerate}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md shadow-2xl p-5">
            <h2 className="text-base font-semibold text-gray-50 mb-2">{t.storySellingGenerator.confirmResetTitle}</h2>
            <div className="space-y-2 text-sm text-gray-200 mb-4">
              <p>
                {t.modals.confirmReset.message}
              </p>
              <p className="text-gray-400 text-xs">{t.storySellingGenerator.cannotBeUndone}</p>
            </div>
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={handleCancelReset}
                className="px-3 py-1.5 rounded-md border border-zinc-600 text-gray-200 hover:bg-zinc-800"
              >
                {t.storySellingGenerator.cancelBtn}
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-700 text-white font-semibold"
              >
                {t.storySellingGenerator.resetBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GenerateStorySellingPage;
