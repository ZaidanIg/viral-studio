import React, { useEffect, useMemo, useRef, useState } from 'react';
import EditPenIcon from '../../shared/components/icons/EditPenIcon';
import PageHeader from '../../shared/components/PageHeader';
import GradientLoader from '../../shared/components/GradientLoader';
import loadingGif0 from "../../../../asset/loading/Buat_jadi_video_cinematic_dan_pastikan_mobil.gif";
import loadingGif1 from "../../../../asset/loading/Buat_jadi_video_cinematic_dan_pastikan_mobil (1).gif";
import loadingGif2 from "../../../../asset/loading/Buat_jadi_video_cinematic_dan_pastikan_mobil (2).gif";
import loadingGif3 from "../../../../asset/loading/Buat_jadi_video_cinematic_dan_pastikan_mobil (3).gif";
import { getFriendlyErrorHint } from '../../shared/utils/friendlyError';
import { useAuthReady } from '../../shared/utils/useAuthReady';
import { type ImageResolutionOption, useImageResolution } from '../../shared/utils/useImageResolution';
import { useLanguage } from '../../shared/i18n';

type ActivityLogEntry = {
  id: number;
  type: 'INFO' | 'SUCCESS' | 'ERROR';
  message: string;
  timestamp: string;
};

const GenerateAffiliateHeaderIcon: React.FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-6 w-6 mr-3 text-pink-400"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 12l2-2 4 4 10-10 2 2L9 20 3 14z" />
  </svg>
);

type ModelInput = {
  id: string;
  file?: File;
  metadataKeywords?: string[];
};

const AFFILIATE_TUTORIAL_URL = 'https://www.youtube.com/embed/gtgccY4Csb8?autoplay=1&mute=1&origin=http://localhost:3000';

type AdditionalProductPhoto = {
  id: string;
  file?: File;
  previewUrl?: string;
  description: string;
};

type ImageCategory = 'broll' | 'ugc' | 'commercial';

type GeneratedImage = {
  id: string;
  category: ImageCategory;
  fileName: string;
  filePath: string;
  includeInVideo?: boolean;
  prompt?: string;
  status?: 'empty' | 'generating' | 'success' | 'failed';
  errorMessage?: string;
  url?: string;
  startedAt?: number;
  estimatedTotalSeconds?: number;
  slotIndex?: number; // Track slot index for reliable matching
  generationMode?: 'new' | 'regen' | 'edit';
};

type AffiliateEditModalState = {
  isOpen: boolean;
  image: GeneratedImage | null;
  instruction: string;
  isSubmitting: boolean;
};

type VideoOutput = {
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

type VideoEditModalState = {
  isOpen: boolean;
  category: NarrationCategory | null;
  sceneIndex: number | null;
  fileName: string;
  filePath: string;
  instruction: string;
  isSubmitting: boolean;
};
type AspectRatioKey = 'portrait' | 'vertical' | 'square' | 'landscape';

type AdType = 'softselling' | 'hardselling' | 'storytelling';

type LanguageOption = 'id' | 'en' | 'ms';

type NarrationCategory = 'broll' | 'ugc' | 'commercial';

type NarrationState = {
  type: 'pendek';
  textId: string;
  textEn: string;
  activeLang: 'id' | 'en';
  isGenerating: boolean;
  isPlaying: boolean;
  selectedVoiceId: string;
  audioUrl: string | null;
  selectedSceneIndex: number;
};

type CaptionState = {
  captionId: string;
  captionEn: string;
  hashtagsId: string;
  hashtagsEn: string;
  activeLang: 'id' | 'en';
  isGenerating: boolean;
};

type VideoGenerationState = {
  isGenerating: boolean;
  outputs: VideoOutput[];
};

type VideoAspectOption = '16:9' | '9:16';
type VideoModelOption = '3.1-fast-low';
type VideoResolutionOption = '720p';

type VideoSettings = {
  aspectRatio: VideoAspectOption;
  veoModel: VideoModelOption;
  resolution: VideoResolutionOption;
};

type TtsVoice = {
  id: string;
  name: string;
  tone: string;
  gender: 'LK' | 'PR';
};

const ASPECT_RATIOS: Record<AspectRatioKey, { width: number; height: number }> = {
  portrait: { width: 1080, height: 1920 },
  vertical: { width: 1080, height: 1350 },
  square: { width: 1600, height: 1600 },
  landscape: { width: 1920, height: 1080 },
};

const GEMINI_TEXT_MODEL = 'gemini-2.5-flash';
const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash';

const MAX_MODELS = 2;
const MAX_ADDITIONAL_PHOTOS = 4;
const AFFILIATE_IMAGE_BATCH_SIZE = 4;

const getLanguageLabelForPrompt = (lang: LanguageOption) =>
  lang === 'id' ? 'Bahasa Indonesia' : lang === 'ms' ? 'Bahasa Melayu' : 'English';

const getLanguageNameEnglish = (lang: LanguageOption) =>
  lang === 'id' ? 'Indonesian' : lang === 'ms' ? 'Malay' : 'English';

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

const createDefaultNarrationState = (): NarrationState => ({
  type: 'pendek',
  textId: '',
  textEn: '',
  activeLang: 'id',
  isGenerating: false,
  isPlaying: false,
  selectedVoiceId: TTS_VOICES[0]?.id ?? '',
  audioUrl: null,
  selectedSceneIndex: 0,
});

const createDefaultCaptionState = (): CaptionState => ({
  captionId: '',
  captionEn: '',
  hashtagsId: '',
  hashtagsEn: '',
  activeLang: 'id',
  isGenerating: false,
});

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

const cropImage = (imageUrl: string, ratioKey: AspectRatioKey): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const { width: targetWidth, height: targetHeight } = ASPECT_RATIOS[ratioKey];

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context is not available'));
        return;
      }

      const sourceRatio = img.width / img.height;
      const targetRatio = targetWidth / targetHeight;
      let cropWidth: number;
      let cropHeight: number;
      let cropX: number;
      let cropY: number;

      if (sourceRatio > targetRatio) {
        cropHeight = img.height;
        cropWidth = img.height * targetRatio;
        cropX = (img.width - cropWidth) / 2;
        cropY = 0;
      } else {
        cropWidth = img.width;
        cropHeight = img.width / targetRatio;
        cropX = 0;
        cropY = (img.height - cropHeight) / 2;
      }

      canvas.width = targetWidth;
      canvas.height = targetHeight;
      ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to load image for cropping'));
    img.src = imageUrl;
  });

const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

const getBase64FromImageUrl = async (imageUrl: string): Promise<string> => {
  if (!imageUrl) return '';

  if (imageUrl.startsWith('data:image')) {
    const parts = imageUrl.split(',');
    return parts[1] || '';
  }

  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const reader = new FileReader();

    return await new Promise<string>((resolve, reject) => {
      reader.onloadend = () => {
        if (typeof reader.result !== 'string') {
          resolve('');
          return;
        }
        const dataUrl = reader.result;
        const commaIndex = dataUrl.indexOf(',');
        if (commaIndex === -1) {
          resolve('');
          return;
        }
        resolve(dataUrl.slice(commaIndex + 1));
      };
      reader.onerror = () => {
        reject(reader.error || new Error('Failed to read image data'));
      };
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
};

const getVideoFileUrl = (filePath?: string): string | null => {
  if (!filePath) return null;
  const encoded = encodeURIComponent(filePath);
  return `http://localhost:3123/video?path=${encoded}`;
};

const downloadDataUrl = (dataUrl: string, fileName: string) => {
  if (!dataUrl) return;
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
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

const callGeminiTts = async (
  apiKey: string,
  payload: unknown,
): Promise<{ audioData: string; sampleRate: number }> => {
  const model = 'gemini-2.5-flash-preview-tts';
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
        'Gemini TTS rejected the request (401/403). Check your Gemini API Key and access permissions in Settings before retrying.',
      );
    }

    if (lastStatus === 429) {
      throw new Error(
        'Gemini TTS is temporarily rate limiting (429). Wait a few minutes then retry, or reduce audio generation frequency.',
      );
    }

    if (lastStatus >= 500 && lastStatus < 600) {
      throw new Error(
        'Gemini TTS service is experiencing server-side issues (5xx). Wait a few minutes then retry.',
      );
    }
  }

  throw new Error(
    'Failed to call Gemini TTS. Check your internet connection and Gemini API Key in Settings, then retry.',
  );
};

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
            throw new Error(`Rejected by safety: ${result.promptFeedback.blockReason}`);
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
        'Gemini rejected the request (401/403). Check your Gemini API Key and project access permissions in Settings.',
      );
    }

    if (lastStatus === 429) {
      throw new Error(
        'Gemini is rate limiting due to quota (429). Wait a few minutes then retry, or reduce simultaneous prompts/images.',
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

  throw new Error(
    'Failed to call Gemini. Check your internet connection and AI configuration in Settings, then retry.',
  );
};

const GenerateAffiliatePage: React.FC = () => {
  const authReady = useAuthReady();
  const { t, language } = useLanguage();
  const loadingGifs = useMemo(() => [loadingGif0, loadingGif1, loadingGif2, loadingGif3], []);
  const getLoadingGifByIndex = (index: number) => loadingGifs[index % loadingGifs.length];
  const [imageResolution, setImageResolution] = useImageResolution();
  const veoModel: VideoModelOption = '3.1-fast-low';

  // Calculate fixed card dimensions based on resolution
  const cardDimensions = imageResolution === '1366x768' 
    ? { parameter: 427, preview: 907 }
    : { parameter: 599, preview: 1273 };

  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [activityLogCopyLabel, setActivityLogCopyLabel] = useState<string>(t.affiliateGenerator.copyLog);
  const [error, setError] = useState<string | null>(null);
  const [captionCopyLabels, setCaptionCopyLabels] = useState<Record<NarrationCategory, string>>({
    broll: t.affiliateGenerator.copyCaptionLabel,
    ugc: t.affiliateGenerator.copyCaptionLabel,
    commercial: t.affiliateGenerator.copyCaptionLabel,
  });

  const buildAiModelPrompt = (
    gender: 'auto' | 'female' | 'male',
    age: 'Remaja' | 'Dewasa' | 'Anak' | 'Orangtua',
    hijab: boolean,
  ): string => {
    const nationalityMap = {
      id: 'Indonesia',
      ms: 'Malaysia with polite Malay cultural traits',
      en: 'diverse global backgrounds',
    };
    const nationality = nationalityMap[language] || nationalityMap.id;

    if (gender === 'auto') {
      return `A model from ${nationality} suitable and relevant to the product, with a friendly expression, wearing simple casual clothing.`;
    }

    const ageMap = {
      Anak: { female: 'anak perempuan', male: 'anak laki-laki' },
      Remaja: { female: 'remaja wanita', male: 'remaja pria' },
      Dewasa: { female: 'wanita dewasa muda', male: 'pria dewasa muda' },
      Orangtua: { female: 'wanita tua', male: 'pria tua' },
    };
    const finalDesc = ageMap[age]?.[gender] || 'orang dewasa';

    let prompt = `A ${finalDesc} from ${nationality}`;

    if (hijab && gender === 'female') {
      prompt += ', wearing hijab,';
    } else {
      prompt += ', with short hair,';
    }

    prompt += ' friendly expression, wearing simple casual clothing.';
    return prompt;
  };
  const [hashtagCopyLabels, setHashtagCopyLabels] = useState<Record<NarrationCategory, string>>({
    broll: t.affiliateGenerator.copyHashtagLabel,
    ugc: t.affiliateGenerator.copyHashtagLabel,
    commercial: t.affiliateGenerator.copyHashtagLabel,
  });

  const [productFile, setProductFile] = useState<File | null>(null);
  const [productPreviewUrl, setProductPreviewUrl] = useState<string | null>(null);

  const [additionalPhotos, setAdditionalPhotos] = useState<AdditionalProductPhoto[]>([]);

  const [models, setModels] = useState<ModelInput[]>([]);

  const [productInfo, setProductInfo] = useState<string>('');

  const [aiGender, setAiGender] = useState<'auto' | 'female' | 'male'>('auto');
  const [aiAge, setAiAge] = useState<'Remaja' | 'Dewasa' | 'Anak' | 'Orangtua'>('Remaja');
  const [aiHijab, setAiHijab] = useState<boolean>(false);

  const [modelStyle, setModelStyle] = useState<string>('');
  const [poseDescription, setPoseDescription] = useState<string>('');

  const [ratio, setRatio] = useState<AspectRatioKey>('portrait');
  const [adType, setAdType] = useState<AdType>('softselling');
  const [accent, setAccent] = useState<string>('');

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [now, setNow] = useState<number>(Date.now());
  const [visibleCardIds, setVisibleCardIds] = useState<Set<string>>(new Set());
  const cardRevealTimeouts = useRef<NodeJS.Timeout[]>([]);
  const [visibleVideoCardIds, setVisibleVideoCardIds] = useState<Set<string>>(new Set());
  const videoCardRevealTimeouts = useRef<NodeJS.Timeout[]>([]);
  
  const DEFAULT_ESTIMATED_SECONDS = 300; // 5 minutes per image for affiliate generation
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [affiliateEditModal, setAffiliateEditModal] = useState<AffiliateEditModalState>({
    isOpen: false,
    image: null,
    instruction: '',
    isSubmitting: false,
  });
  const [videoEditModal, setVideoEditModal] = useState<VideoEditModalState>({
    isOpen: false,
    category: null,
    sceneIndex: null,
    fileName: '',
    filePath: '',
    instruction: '',
    isSubmitting: false,
  });
  const [nextAffiliateImageIndex, setNextAffiliateImageIndex] = useState<number>(0);
  const [fileInputResetKey, setFileInputResetKey] = useState<number>(Date.now());
  const [isGenerateButtonLocked, setIsGenerateButtonLocked] = useState<boolean>(false);

  const AFFILIATE_LABEL_GROUPS = React.useMemo(
    () => [
      { id: 'I', title: 'I · B-Roll', subtitle: 'Main (4 shots)' },
      { id: 'II', title: 'II · Content Affiliate', subtitle: 'Main (4 shots)' },
      { id: 'III', title: 'III · Commercial', subtitle: 'Main (4 shots)' },
    ],
    [],
  );
  const [enabledAffiliateLabels, setEnabledAffiliateLabels] = useState<boolean[]>(
    Array.from({ length: AFFILIATE_LABEL_GROUPS.length }, () => true),
  );

  const [videoStates, setVideoStates] = useState<Record<NarrationCategory, VideoGenerationState>>({
    broll: { isGenerating: false, outputs: [] },
    ugc: { isGenerating: false, outputs: [] },
    commercial: { isGenerating: false, outputs: [] },
  });

  const [isRecommending, setIsRecommending] = useState(false);
  const [isAnalyzingModelStyle, setIsAnalyzingModelStyle] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const [narrations, setNarrations] = useState<Record<NarrationCategory, NarrationState>>({
    broll: createDefaultNarrationState(),
    ugc: createDefaultNarrationState(),
    commercial: createDefaultNarrationState(),
  });

  const [captions, setCaptions] = useState<Record<NarrationCategory, CaptionState>>({
    broll: createDefaultCaptionState(),
    ugc: createDefaultCaptionState(),
    commercial: createDefaultCaptionState(),
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const downloadCountersRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-fail images and videos that exceed estimated time (with generous grace to avoid false timeouts)
  useEffect(() => {
    // Check for timed-out images
    setGeneratedImages((prev) => {
      let hasChanges = false;
      const updated = prev.map((img) => {
        if (img.status === 'generating' && img.startedAt) {
          const elapsed = Math.floor((now - img.startedAt) / 1000);
          const totalSeconds = img.estimatedTotalSeconds ?? DEFAULT_ESTIMATED_SECONDS;
          const failThreshold = totalSeconds + 600; // 10-minute grace to avoid false timeout

          // If time expired beyond grace, mark as failed
          if (elapsed >= failThreshold) {
            hasChanges = true;
            return {
              ...img,
              status: 'failed' as const,
              errorMessage: 'Generation timeout - please regenerate',
            };
          }
        }
        return img;
      });
      
      return hasChanges ? updated : prev;
    });

    // Check for timed-out videos
    setVideoStates((prev) => {
      let hasChanges = false;
      const updated: Record<NarrationCategory, VideoGenerationState> = { ...prev };
      
      (['broll', 'ugc', 'commercial'] as NarrationCategory[]).forEach((category) => {
        const state = prev[category];
        if (!state?.outputs) return;
        
        const updatedOutputs = state.outputs.map((video) => {
          if (video.status === 'generating' && video.startedAt) {
            const elapsed = Math.floor((now - video.startedAt) / 1000);
            const totalSeconds = video.estimatedTotalSeconds ?? 300;
            const failThreshold = totalSeconds + 600; // 10-minute grace to avoid false timeout

            // If time expired beyond grace, mark as failed
            if (elapsed >= failThreshold) {
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
        
        if (state.outputs !== updatedOutputs) {
          updated[category] = { ...state, outputs: updatedOutputs };
        }
      });
      
      return hasChanges ? updated : prev;
    });
  }, [now]);

  const getRemainingSeconds = (img: GeneratedImage): number | null => {
    if (img.status !== 'generating') return null;
    const totalSeconds = img.estimatedTotalSeconds ?? DEFAULT_ESTIMATED_SECONDS;
    const startedAt = img.startedAt ?? Date.now();
    const elapsed = Math.floor((now - startedAt) / 1000);
    const remaining = totalSeconds - elapsed;
    return Math.max(0, remaining);
  };

  const getCountdownMessage = (img: GeneratedImage): string | null => {
    if (img.status !== 'generating') return null;
    const remaining = getRemainingSeconds(img);
    if (remaining == null) return null;
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getRemainingSecondsForVideo = (video: VideoOutput): number | null => {
    if (video.status !== 'generating') return null;
    const totalSeconds = video.estimatedTotalSeconds ?? 300;
    const startedAt = video.startedAt ?? Date.now();
    const elapsed = Math.floor((now - startedAt) / 1000);
    const remaining = totalSeconds - elapsed;
    return Math.max(0, remaining);
  };

  const getCountdownMessageForVideo = (video: VideoOutput): string | null => {
    if (video.status !== 'generating') return null;
    const remaining = getRemainingSecondsForVideo(video);
    if (remaining == null) return null;
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const hasAnyModelImage = models.some((m) => m.file || m.previewUrl);

  const handleCaptionTextChange = (category: NarrationCategory, value: string) => {
    setCaptions((prev) => {
      const current = prev[category];
      if (!current) return prev;

      if (current.activeLang === 'id') {
        return {
          ...prev,
          [category]: {
            ...current,
            captionId: value,
          },
        };
      }

      return {
        ...prev,
        [category]: {
          ...current,
          captionEn: value,
        },
      };
    });
  };

  const handleHashtagsTextChange = (category: NarrationCategory, value: string) => {
    setCaptions((prev) => {
      const current = prev[category];
      if (!current) return prev;

      if (current.activeLang === 'id') {
        return {
          ...prev,
          [category]: {
            ...current,
            hashtagsId: value,
          },
        };
      }

      return {
        ...prev,
        [category]: {
          ...current,
          hashtagsEn: value,
        },
      };
    });
  };

  useEffect(() => {
    if (!error) return;
    const timeout = setTimeout(() => {
      setError(null);
    }, 5000);
    return () => clearTimeout(timeout);
  }, [error]);

  const [narrationAudioStatus, setNarrationAudioStatus] = useState<{
    category: NarrationCategory | null;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
  }>({ category: null, isPlaying: false, currentTime: 0, duration: 0 });

  const narrationCategories: NarrationCategory[] = ['broll', 'ugc', 'commercial'];

  const getGeminiTextModel = () => {
    if (typeof window === 'undefined') return GEMINI_TEXT_MODEL;
    const configuredModel = localStorage.getItem('zeoStudio.ai.model') || '';
    return configuredModel.trim() || GEMINI_TEXT_MODEL;
  };

  const getVideoSettingsFromRatio = (): VideoSettings => {
    // Ikuti rasio utama gambar: landscape -> 16:9, lainnya (portrait, vertical, square) -> 9:16
    const aspectRatio: VideoAspectOption = ratio === 'landscape' ? '16:9' : '9:16';
    return {
      aspectRatio,
      veoModel,
      resolution: '720p',
    };
  };

  const addLog = (type: ActivityLogEntry['type'], message: string) => {
    if (!message) return;
    if (type === 'ERROR') {
      setError(message);
    }
    const prefixedMessage = `[Affiliate] ${message}`;
    setActivityLogs((prev) => [
      ...prev,
      {
        id: prev.length ? prev[prev.length - 1].id + 1 : 1,
        type,
        message: prefixedMessage,
        timestamp: new Date().toLocaleTimeString(language === 'en' ? 'en-US' : language === 'ms' ? 'ms-MY' : 'id-ID', { hour12: false }),
      },
    ]);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const apiKey = localStorage.getItem('zeoStudio.ai.apiKey') || '';
    const folderOutput = localStorage.getItem('zeoStudio.folder.output') || '';

    if (!apiKey) {
      addLog(
        'INFO',
        t.affiliateGenerator.apiKeyNotConfigured,
      );
    }
    if (!folderOutput) {
      addLog('INFO', t.affiliateGenerator.outputFolderNotConfigured);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.zeoAPI?.onBatchUpdate) return undefined;

    const unsubscribe = window.zeoAPI.onBatchUpdate?.((update: any) => {
      if (!update) return;

      const workflow = (update.workflow || '').toLowerCase();
      const isAffiliateVideo = workflow.includes('affiliate video');
      const isAffiliateImage = workflow.includes('affiliate image');
      
      if (!isAffiliateVideo && !isAffiliateImage) {
        return;
      }

      const message: string = update.message || '';
      const categoryRaw = (update.category || '').toString().toLowerCase();
      
      const categoryMatch: NarrationCategory | ImageCategory | null =
        categoryRaw === 'broll' || categoryRaw === 'ugc' || categoryRaw === 'commercial'
          ? (categoryRaw as NarrationCategory)
          : null;

      if (update.type === 'INFO' || update.type === 'BATCH_TOTAL' || update.type === 'PROGRESS') {
        if (message) addLog('INFO', message);
        return;
      }

      if (update.type === 'SCENE_COMPLETED') {
        // Handle affiliate image completion
        if (isAffiliateImage && categoryMatch && update.dataUrl) {
          const imageIndex = typeof update.index === 'number' && Number.isFinite(update.index) ? update.index : undefined;
          
          setGeneratedImages((prev) => {
            return prev.map((img) => {
              // Match by category and slotIndex (index from backend)
              if (img.category === categoryMatch && img.slotIndex === imageIndex && img.status === 'generating') {
                return {
                  ...img,
                  url: update.dataUrl,
                  status: 'success' as const,
                };
              }
              return img;
            });
          });
          
          const label = categoryMatch === 'broll' ? 'B-roll' : categoryMatch === 'ugc' ? 'Content Affiliate' : 'Commercial';
          addLog('SUCCESS', `${label} image #${(imageIndex ?? 0) + 1} completed`);
          return;
        }
        
        // Handle affiliate video completion
        if (isAffiliateVideo && categoryMatch && update.fileName && update.filePath) {
          const sceneIdx = typeof update.index === 'number' && Number.isFinite(update.index) ? update.index : undefined;
          
          setVideoStates((prev) => {
            const existing = prev[categoryMatch] || { isGenerating: false, outputs: [] };
            const existingOutputs = existing.outputs || [];
            
            // Find and update existing placeholder by sceneIndex
            const updatedOutputs = existingOutputs.map(output => {
              if (output.sceneIndex === sceneIdx) {
                return {
                  ...output,
                  fileName: String(update.fileName),
                  filePath: String(update.filePath),
                  status: 'completed' as const,
                  generationMode: undefined,
                };
              }
              return output;
            });
            
            // If no placeholder found, add as new (fallback for old workflows)
            const hasMatchingPlaceholder = existingOutputs.some(o => o.sceneIndex === sceneIdx);
            if (!hasMatchingPlaceholder && sceneIdx !== undefined) {
              updatedOutputs.push({
                fileName: String(update.fileName),
                filePath: String(update.filePath),
                sceneIndex: sceneIdx,
                status: 'completed' as const,
                generationMode: undefined,
              });
            }
            
            return {
              ...prev,
              [categoryMatch]: {
                ...existing,
                outputs: updatedOutputs,
              },
            };
          });
          
          if (message) addLog('SUCCESS', message);
          return;
        }
      }

      if (update.type === 'BATCH_COMPLETE') {
        if (isAffiliateVideo && categoryMatch) {
          setVideoStates((prev) => ({
            ...prev,
            [categoryMatch]: {
              ...(prev[categoryMatch] || { isGenerating: false, outputs: [] }),
              isGenerating: false,
            },
          }));
        }

        if (typeof update.successCount === 'number' && update.successCount === 0) {
          if (message) addLog('ERROR', message);
        } else if (message) {
          addLog('SUCCESS', message);
        }
        return;
      }

      if (update.type === 'ERROR' || update.type === 'SCENE_ERROR') {
        // Handle affiliate image error
        if (isAffiliateImage && categoryMatch) {
          const imageIndex = typeof update.index === 'number' && Number.isFinite(update.index) ? update.index : undefined;
          
          setGeneratedImages((prev) => {
            return prev.map((img) => {
              if (img.category === categoryMatch && img.slotIndex === imageIndex && img.status === 'generating') {
                return {
                  ...img,
                  status: 'failed' as const,
                  errorMessage: message || 'Image generation failed',
                };
              }
              return img;
            });
          });
          
          if (message) addLog('ERROR', message);
          return;
        }
        
        // Handle affiliate video error
        if (isAffiliateVideo && categoryMatch) {
          const sceneIdx = typeof update.index === 'number' && Number.isFinite(update.index) ? update.index : undefined;
          
          setVideoStates((prev) => {
            const existing = prev[categoryMatch] || { isGenerating: false, outputs: [] };
            const existingOutputs = existing.outputs || [];
            
            // Mark placeholder as failed if sceneIndex matches
            const updatedOutputs = existingOutputs.map(output => {
              if (output.sceneIndex === sceneIdx && output.status === 'generating') {
                return {
                  ...output,
                  status: 'failed' as const,
                  errorMessage: message || 'Video generation failed',
                  generationMode: undefined,
                };
              }
              return output;
            });
            
            return {
              ...prev,
              [categoryMatch]: {
                ...existing,
                outputs: updatedOutputs,
                isGenerating: update.type === 'ERROR' ? false : existing.isGenerating,
              },
            };
          });
        }

        if (message) addLog('ERROR', message);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        URL.revokeObjectURL(audio.src);
      }
      audioRef.current = null;
    };
  }, []);

  const handleCopyActivityLog = () => {
    if (!activityLogs.length) return;

    const text = activityLogs
      .map((log) => `[${log.timestamp}] [${log.type}] ${log.message}`)
      .join('\n');

    navigator.clipboard
      .writeText(text)
      .then(() => {
        setActivityLogCopyLabel(t.affiliateGenerator.copied);
        setTimeout(() => setActivityLogCopyLabel(t.affiliateGenerator.copyLog), 1500);
      })
      .catch(() => {
        setActivityLogCopyLabel(t.affiliateGenerator.copyFailed);
        setTimeout(() => setActivityLogCopyLabel(t.affiliateGenerator.copyLog), 1500);
      });
  };

  const handleProductChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0] || null;
    setProductFile(file);
    if (productPreviewUrl) {
      URL.revokeObjectURL(productPreviewUrl);
      setProductPreviewUrl(null);
    }
    if (file) {
      const url = URL.createObjectURL(file);
      setProductPreviewUrl(url);
      addLog('INFO', `${t.logMessages.affiliate.photoSelected}: ${file.name}`);
      void runProductRecommendationFromFile(file);
    }
  };

  const handlePrimaryCharacterFileChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;

    setModels((prev) => {
      const next = [...prev];
      let primary = next[0];

      if (!primary) {
        primary = { id: `model-${Date.now()}-1` };
        next.unshift(primary);
      }

      if (primary.previewUrl) {
        URL.revokeObjectURL(primary.previewUrl);
      }

      const url = URL.createObjectURL(file);
      next[0] = { ...primary, file, previewUrl: url };

      return next;
    });

    addLog('INFO', `${t.logMessages.affiliate.photoSelected}: ${file.name}`);

    // Analisis otomatis pakaian & aksesoris karakter berdasarkan foto, menggunakan Gemini
    void runModelStyleAnalysisFromFile(file);
  };

  const handleGenerateImageSlot = async (imageId: string) => {
    if (!authReady) {
      const message = t.logMessages.common.statusNotReady;
      setError(message);
      addLog('ERROR', message);
      return;
    }

    if (!productFile) {
      addLog('ERROR', t.logMessages.affiliate.photoRequired);
      return;
    }

    const apiKey =
      typeof window !== 'undefined' ? localStorage.getItem('zeoStudio.ai.apiKey') || '' : '';
    if (!apiKey) {
      addLog('ERROR', t.logMessages.common.apiKeyMissing);
      return;
    }

    const bearerKey =
      typeof window !== 'undefined' ? localStorage.getItem('zeoStudio.bearerToken') || '' : '';
    if (!bearerKey) {
      addLog('ERROR', t.logMessages.common.bearerTokenMissing);
      return;
    }

    if (typeof window === 'undefined' || !window.zeoAPI?.generateAffiliateImages) {
      addLog(
        'ERROR',
        t.logMessages.common.engineNotAvailable,
      );
      return;
    }

    const target = generatedImages.find((img) => img.id === imageId);
    if (!target) {
      addLog('ERROR', t.logMessages.affiliate.imageDataError);
      return;
    }

    if (!target.prompt) {
      addLog('ERROR', t.logMessages.imageGenerator.promptEmpty);
      return;
    }

    try {
      setGeneratedImages((prev) =>
        prev.map((img) =>
          img.id === imageId
            ? {
                ...img,
                status: 'generating',
                errorMessage: undefined,
                startedAt: Date.now(),
                estimatedTotalSeconds: DEFAULT_ESTIMATED_SECONDS,
                generationMode: img.url ? 'regen' : 'new',
              }
            : img,
        ),
      );

      addLog(
        'INFO',
        t.affiliateGenerator.resendingImagePrompt.replace('{category}',
          target.category === 'broll'
            ? t.affiliateGenerator.categoryBroll
            : target.category === 'ugc'
            ? t.affiliateGenerator.categoryUgc
            : t.affiliateGenerator.categoryCommercial
        ),
      );

      const productBase64 = await compressImage(productFile);
      const productRawBase64 = productBase64.split(',')[1] || '';

      const modelFiles = models.filter((m) => m.file).slice(0, 2);
      const modelRawBase64List: string[] = [];
      // eslint-disable-next-line no-restricted-syntax
      for (const m of modelFiles) {
        if (!m.file) continue;
        // eslint-disable-next-line no-await-in-loop
        const base64 = await compressImage(m.file);
        const raw = base64.split(',')[1];
        if (raw) modelRawBase64List.push(raw);
      }

      const additionalFiles = additionalPhotos.filter((p) => p.file).slice(0, 3);
      const additionalRawBase64List: string[] = [];
      // eslint-disable-next-line no-restricted-syntax
      for (const p of additionalFiles) {
        if (!p.file) continue;
        // eslint-disable-next-line no-await-in-loop
        const base64 = await compressImage(p.file);
        const raw = base64.split(',')[1];
        if (raw) additionalRawBase64List.push(raw);
      }

      const items = [{ category: target.category, prompt: target.prompt }];

      const referencesForCategory =
        target.category === 'ugc'
          ? {
              product: productRawBase64,
              models: modelRawBase64List,
              additional: additionalRawBase64List,
            }
          : {
              product: productRawBase64,
              models: [],
              additional: additionalRawBase64List,
            };

      const response = await window.zeoAPI.generateAffiliateImages({
        bearerKey,
        aspectRatioKey: ratio,
        imageResolution,
        items,
        references: referencesForCategory,
        uiLanguage: language,
      });

      if (!response || !response.ok) {
        const message = response?.error || t.affiliateGenerator.engineResponseInvalid;
        throw new Error(message);
      }

      const results = Array.isArray(response.results) ? response.results : [];
      if (!results.length) {
        throw new Error(t.affiliateGenerator.engineNoImages);
      }

      const result = results[0];
      const success = !!result.success;

      if (!success) {
        const errMsg: string = result.error || 'Unknown error from Nano Banana.';
        addLog('ERROR', `${t.logMessages.affiliate.generateFailed}: ${errMsg}`);
        setGeneratedImages((prev) =>
          prev.map((img) =>
            img.id === imageId
              ? {
                  ...img,
                  status: 'failed',
                  errorMessage: errMsg,
                  url: '',
                  generationMode: undefined,
                }
              : img,
          ),
        );
        return;
      }

      const dataUrl: string | undefined = result.dataUrl;
      if (!dataUrl) {
        const errMsg = t.affiliateGenerator.engineNoImageData;
        addLog('ERROR', errMsg);
        setGeneratedImages((prev) =>
          prev.map((img) =>
            img.id === imageId
              ? {
                  ...img,
                  status: 'failed',
                  errorMessage: errMsg,
                  url: '',
                  generationMode: undefined,
                }
              : img,
          ),
        );
        return;
      }

      setGeneratedImages((prev) =>
        prev.map((img) =>
          img.id === imageId
            ? {
                ...img,
                status: 'success',
                errorMessage: undefined,
                url: dataUrl,
                generationMode: undefined,
              }
            : img,
        ),
      );

      addLog(
        'SUCCESS',
        t.affiliateGenerator.imageRegenerateSuccess.replace('{category}',
          target.category === 'broll'
            ? t.affiliateGenerator.categoryBroll
            : target.category === 'ugc'
            ? t.affiliateGenerator.categoryUgc
            : t.affiliateGenerator.categoryCommercial
        ),
      );
    } catch (error: any) {
      const message = error?.message || t.logMessages.affiliate.generateFailed;
      addLog('ERROR', `${t.logMessages.affiliate.generateFailed}: ${message}`);
      setGeneratedImages((prev) =>
        prev.map((img) =>
          img.id === imageId
            ? {
                ...img,
                status: 'failed',
                errorMessage: message,
                generationMode: undefined,
              }
            : img,
        ),
      );
    }
  };

  const handleToggleIncludeInVideo = (imageId: string) => {
    setGeneratedImages((prev) =>
      prev.map((img) => {
        if (img.id !== imageId) return img;
        const isIncluded = img.includeInVideo !== false;
        return {
          ...img,
          includeInVideo: !isIncluded,
        };
      }),
    );
  };

  const handleOpenAffiliateEditModal = (image: GeneratedImage) => {
    if (!image.url) {
      addLog('ERROR', t.logMessages.affiliate.editInstructionEmpty);
      return;
    }

    setAffiliateEditModal({
      isOpen: true,
      image,
      instruction: '',
      isSubmitting: false,
    });
  };

  const handleCloseAffiliateEditModal = () => {
    setAffiliateEditModal((prev) => ({ ...prev, isOpen: false, isSubmitting: false }));
  };

  const handleApplyAffiliateEdit = async () => {
    const target = affiliateEditModal.image;
    if (!target || !target.url) {
      return;
    }

    if (!authReady) {
      const message = t.logMessages.common.statusNotReady;
      setError(message);
      addLog('ERROR', message);
      return;
    }

    const editInstruction = affiliateEditModal.instruction.trim();
    if (!editInstruction) {
      addLog('ERROR', t.logMessages.affiliate.editInstructionEmpty);
      return;
    }

    const imageUrl = target.url;
    const base64 = await getBase64FromImageUrl(imageUrl);
    if (!base64) {
      addLog('ERROR', t.logMessages.affiliate.imageDataError);
      return;
    }

    if (typeof window === 'undefined' || !window.zeoAPI?.editStoryFrame) {
      addLog(
        'ERROR',
        t.logMessages.common.engineNotAvailable,
      );
      return;
    }

    const bearerKey =
      typeof window !== 'undefined' ? localStorage.getItem('zeoStudio.bearerToken') || '' : '';
    if (!bearerKey.trim()) {
      addLog(
        'ERROR',
        t.logMessages.common.bearerTokenMissing,
      );
      return;
    }

    const aspectRatio = ratio === 'landscape' ? '16:9' : '9:16';

    const editInstructionText = `Based on this instruction: "${editInstruction}", edit the following image. The result must be a SINGLE, UNIFIED IMAGE, not multiple panels or containing any text. Keep the rest of the image highly consistent. ABSOLUTELY CRITICAL RULE: The final image aspect ratio MUST BE exactly ${aspectRatio}.`;

    addLog('INFO', t.logMessages.affiliate.editStarted);

    setAffiliateEditModal((prev) => ({ ...prev, isSubmitting: true, isOpen: false }));

    setGeneratedImages((prev) =>
      prev.map((img) =>
        img.id === target.id
          ? {
              ...img,
              status: 'generating',
              errorMessage: undefined,
              startedAt: Date.now(),
              estimatedTotalSeconds: DEFAULT_ESTIMATED_SECONDS,
              generationMode: 'edit',
            }
          : img,
      ),
    );

    try {
      const result = await window.zeoAPI.editStoryFrame({
        bearerKey,
        imageBase64: base64,
        instruction: editInstructionText,
        aspectRatio,
        imageResolution,
      });

      if (!result || !result.ok || !result.dataUrl) {
        throw new Error(result?.error || t.affiliateGenerator.editImageFailed);
      }

      setGeneratedImages((prev) =>
        prev.map((img) =>
          img.id === target.id
            ? {
                ...img,
                status: 'success',
                errorMessage: undefined,
                url: result.dataUrl || '',
                generationMode: undefined,
              }
            : img,
        ),
      );

      addLog('SUCCESS', t.logMessages.affiliate.editSuccess);
    } catch (error: any) {
      const message = error?.message || t.affiliateGenerator.editImageError;
      addLog('ERROR', `${t.logMessages.affiliate.editFailed}: ${message}`);

      setGeneratedImages((prev) =>
        prev.map((img) =>
          img.id === target.id
            ? {
                ...img,
                status: 'failed',
                errorMessage: message,
                generationMode: undefined,
              }
            : img,
        ),
      );
    } finally {
      setAffiliateEditModal((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const runProductRecommendationFromFile = async (file: File) => {
    const fileToUse = file || productFile;
    if (!fileToUse) return;

    const apiKey =
      typeof window !== 'undefined' ? localStorage.getItem('zeoStudio.ai.apiKey') || '' : '';
    if (!apiKey) {
      addLog('ERROR', t.logMessages.common.apiKeyMissing);
      return;
    }

    setIsRecommending(true);

    try {
      const productBase64 = await compressImage(fileToUse);
      const analyzePromptMap = {
        en: 'You are a product photo analyst. Based on this product image, write a STRUCTURED summary in English using exactly this format (one line per point):\n- Product Type: ...\n- Shape & Material: ...\n- Dominant Colors: ...\n- Packaging / Label Details: ...\n- Fixed Visual Elements: ...\nFocus ONLY on visual facts seen in the photo (shape, colors, materials, labels). Do NOT add marketing copy, photo concepts, mood, or story. Reply with ONLY the five lines above, no intro or closing.',
        ms: 'Anda ialah seorang penganalisis foto produk. Berdasarkan gambar produk ini, tuliskan ringkasan BERSTRUKTUR dalam Bahasa Melayu dengan format tepat berikut (satu baris setiap poin):\n- Jenis Produk: ...\n- Bentuk & Material: ...\n- Warna Dominan: ...\n- Butiran Pembungkusan / Label: ...\n- Elemen Visual Tetap: ...\nFokus HANYA pada fakta visual yang terlihat di foto (bentuk, warna, bahan, label). Jangan tambah salinan pemasaran, konsep foto, mood, atau cerita. Jawab HANYA dengan lima baris di atas tanpa pembuka atau penutup.',
        id: 'Anda adalah seorang analis foto produk. Berdasarkan gambar produk ini, tuliskan ringkasan TERSTRUKTUR dalam Bahasa Indonesia dengan format persis berikut (satu baris per poin):\n- Jenis Produk: ...\n- Bentuk & Material: ...\n- Warna Dominan: ...\n- Detail Kemasan / Label: ...\n- Elemen Visual Tetap: ...\nFokus hanya pada fakta visual yang benar-benar terlihat di foto (bentuk, warna, bahan, label). Jangan menambahkan copywriting, konsep foto, suasana, atau cerita. Jawab HANYA dengan lima baris di atas tanpa kalimat pembuka atau penutup.',
      };
      const analyzePrompt = analyzePromptMap[language] || analyzePromptMap.id;

      const payload = {
        contents: [
          {
            parts: [
              { text: analyzePrompt },
              { inlineData: { mimeType: 'image/png', data: productBase64.split(',')[1] } },
            ],
          },
        ],
      };

      const recommendationText = await callGemini(apiKey, getGeminiTextModel(), payload, 'text');
      setProductInfo(recommendationText.trim());
      addLog('SUCCESS', t.logMessages.affiliate.recommendationSuccess);
    } catch (error) {
      const message = error instanceof Error ? error.message : t.affiliateGenerator.recommendationError;
      addLog('ERROR', `${t.logMessages.affiliate.recommendationError}: ${message}`);
    } finally {
      setIsRecommending(false);
    }
  };

  const runModelStyleAnalysisFromFile = async (file: File) => {
    if (!file) return;

    const apiKey =
      typeof window !== 'undefined' ? localStorage.getItem('zeoStudio.ai.apiKey') || '' : '';
    if (!apiKey) {
      addLog('ERROR', t.logMessages.common.apiKeyMissing);
      return;
    }

    setIsAnalyzingModelStyle(true);

    try {
      const modelBase64 = await compressImage(file);
      const outfitPromptMap = {
        en: 'You are a fashion stylist. Based on this model photo, write a STRUCTURED description in English with exactly the following format (one line per point):\n- Top: ...\n- Bottom: ...\n- Hair/Hijab: ...\n- Shoes: ...\n- Accessories: ...\n- Dominant Colors: ...\nDescribe only clothing and accessories clearly visible in the photo. Do NOT add character interpretation, story, or new style suggestions. Reply with EXACTLY six lines above, no intro or closing.',
        ms: 'Anda ialah seorang penggaya fesyen. Berdasarkan foto model ini, tuliskan deskripsi BERSTRUKTUR dalam Bahasa Melayu dengan format tepat berikut (satu baris setiap poin):\n- Atasan: ...\n- Bawahan: ...\n- Hijab/Rambut: ...\n- Kasut: ...\n- Aksesori: ...\n- Warna Dominan: ...\nHanya jelaskan pakaian dan aksesori yang benar-benar terlihat di foto. Jangan tambah interpretasi watak, cerita, atau cadangan gaya baharu. Jawab HANYA dengan enam baris di atas tanpa pembuka atau penutup.',
        id: 'Anda adalah seorang fashion stylist. Berdasarkan foto model ini, tuliskan deskripsi BERSTRUKTUR dalam Bahasa Indonesia dengan format tepat berikut (satu baris per poin):\n- Atasan: ...\n- Bawahan: ...\n- Hijab/Rambut: ...\n- Sepatu: ...\n- Aksesori: ...\n- Warna Dominan: ...\nHanya jelaskan pakaian dan aksesori yang benar-benar terlihat di foto. Jangan tambah interpretasi karakter, cerita, atau saran gaya baru. Jawab HANYA dengan enam baris di atas tanpa pembuka atau penutup.',
      };
      const outfitPrompt = outfitPromptMap[language] || outfitPromptMap.id;

      const payload = {
        contents: [
          {
            parts: [
              { text: outfitPrompt },
              { inlineData: { mimeType: 'image/png', data: modelBase64.split(',')[1] } },
            ],
          },
        ],
      };

      const descriptionText = await callGemini(apiKey, getGeminiTextModel(), payload, 'text');
      setModelStyle(descriptionText.trim());
      addLog('SUCCESS', t.affiliateGenerator.modelStyleSuccess);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t.affiliateGenerator.recommendationError;
      addLog('ERROR', t.affiliateGenerator.modelStyleFailed.replace('{message}', message));
    } finally {
      setIsAnalyzingModelStyle(false);
    }
  };

  const handleAnalyzeModelStyleFromImage = async () => {
    if (!hasAnyModelImage) {
      addLog(
        'ERROR',
        t.logMessages.affiliate.photoRequired,
      );
      return;
    }

    const firstModelWithFile = models.find((m) => m.file);
    if (!firstModelWithFile || !firstModelWithFile.file) {
      addLog(
        'ERROR',
        t.logMessages.affiliate.imageDataError,
      );
      return;
    }

    await runModelStyleAnalysisFromFile(firstModelWithFile.file);
  };

  const handleGenerate = async () => {
    if (isGenerating || isRecommending) return;

    if (!productFile) {
      addLog('ERROR', t.affiliateGenerator.productPhotoRequired);
      return;
    }

    if (!productInfo.trim()) {
      addLog('ERROR', t.affiliateGenerator.productPhotoRequired);
      return;
    }

    const apiKey = typeof window !== 'undefined' ? localStorage.getItem('zeoStudio.ai.apiKey') || '' : '';
    if (!apiKey) {
      addLog('ERROR', t.affiliateGenerator.apiKeyNotConfiguredShort);
      return;
    }

    const bearerKey = typeof window !== 'undefined' ? localStorage.getItem('zeoStudio.bearerToken') || '' : '';
    if (!bearerKey) {
      addLog('ERROR', t.affiliateGenerator.bearerTokenNotConfigured);
      return;
    }

    if (typeof window === 'undefined' || !window.zeoAPI?.generateAffiliateImages) {
      addLog('ERROR', t.affiliateGenerator.engineUnavailable);
      return;
    }

    const enabledCategoriesFromLabels = enabledCategories;
    if (!enabledCategoriesFromLabels.length) {
      addLog('ERROR', t.affiliateGenerator.selectAtLeastOneGroup);
      return;
    }

    const totalAffiliateSlots = enabledCategoriesFromLabels.length * AFFILIATE_IMAGE_BATCH_SIZE;
    const totalAffiliateBatches = Math.ceil(totalAffiliateSlots / AFFILIATE_IMAGE_BATCH_SIZE);
    const effectiveStartIndex = nextAffiliateImageIndex >= totalAffiliateSlots ? 0 : nextAffiliateImageIndex;
    const isFirstBatch = generatedImages.length === 0 || effectiveStartIndex === 0;
    const currentBatchIndex = Math.floor(effectiveStartIndex / AFFILIATE_IMAGE_BATCH_SIZE) + 1;

    setIsGenerateButtonLocked(true);
    setIsGenerating(true);

    if (isFirstBatch) {
      setGeneratedImages([]);
      setActivityLogs([]);
      setNextAffiliateImageIndex(0);
      setVisibleCardIds(new Set());
      setVisibleVideoCardIds(new Set());
      
      // Clear any existing timeouts
      cardRevealTimeouts.current.forEach(timeout => clearTimeout(timeout));
      cardRevealTimeouts.current = [];
      videoCardRevealTimeouts.current.forEach(timeout => clearTimeout(timeout));
      videoCardRevealTimeouts.current = [];
      addLog(
        'INFO',
        t.affiliateGenerator.generateStarted.replace('{ratio}', ratio).replace('{adType}', adType).replace('{language}', language).replace('{accent}', accent ? `, accent ${accent}` : ''),
      );
    } else {
      addLog(
        'INFO',
        t.affiliateGenerator.continuingBatch.replace('{batch}', String(currentBatchIndex)).replace('{total}', String(totalAffiliateBatches)).replace('{ratio}', ratio).replace('{adType}', adType).replace('{language}', language).replace('{accent}', accent ? `, accent ${accent}` : ''),
      );
    }

    try {
      addLog('INFO', t.affiliateGenerator.preparingReferences);

      const productBase64 = await compressImage(productFile);
      const productRawBase64 = productBase64.split(',')[1] || '';

      const anyModelUploaded = models.some((m) => m.file);
      const multipleModelsUploaded = models.filter((m) => m.file).length > 1;

      const modelFiles = models.filter((m) => m.file).slice(0, 2);
      const modelRawBase64List: string[] = [];
      // eslint-disable-next-line no-restricted-syntax
      for (const m of modelFiles) {
        if (!m.file) continue;
        // eslint-disable-next-line no-await-in-loop
        const base64 = await compressImage(m.file);
        const raw = base64.split(',')[1];
        if (raw) modelRawBase64List.push(raw);
      }

      const additionalFiles = additionalPhotos.filter((p) => p.file).slice(0, 3);
      const additionalRawBase64List: string[] = [];
      // eslint-disable-next-line no-restricted-syntax
      for (const p of additionalFiles) {
        if (!p.file) continue;
        // eslint-disable-next-line no-await-in-loop
        const base64 = await compressImage(p.file);
        const raw = base64.split(',')[1];
        if (raw) additionalRawBase64List.push(raw);
      }

      const optionsForPrompt = {
        productInfo: productInfo.trim(),
        modelStyle: modelStyle.trim(),
        poseDescription: poseDescription.trim(),
        generatedModelPrompt: buildAiModelPrompt(aiGender, aiAge, aiHijab),
        ratio: ASPECT_RATIOS[ratio],
        adType,
        additionalProductPhotoDescriptions: additionalPhotos
          .map((p) => p.description || '')
          .filter((desc) => desc.trim() !== '')
          .join('; '),
      };

      addLog('INFO', t.affiliateGenerator.requestingCreativeIdeas);

      const creativeDirectorSchema = {
        type: 'OBJECT',
        properties: {
          broll: {
            type: 'ARRAY',
            description: '4 B-roll photo ideas (macro, detail, texture, no model).',
            items: { type: 'OBJECT', properties: { text: { type: 'STRING' } } },
          },
          ugc: {
            type: 'ARRAY',
            description: "4 Content Affiliate photo ideas, MUST include placeholder 'Replikasi model dari foto referensi'.",
            items: { type: 'OBJECT', properties: { text: { type: 'STRING' } } },
          },
          commercial: {
            type: 'ARRAY',
            description: '4 Commercial photo ideas (staging, concept, no model).',
            items: { type: 'OBJECT', properties: { text: { type: 'STRING' } } },
          },
        },
        required: ['broll', 'ugc', 'commercial'],
      };

      const creativeDirectorPrompt = `You are a Creative Director. Based on Ad Type ('${optionsForPrompt.adType}') and Product Description ('${
        optionsForPrompt.productInfo || 'no specific description'
      }'), create 12 photo ideas for the product in this image.
Create 4 B-Roll ideas (focus macro, detail, texture, no model).
Create 4 Content Affiliate ideas (testimonial content style: 1. Casual/Candid, 2. Positive/Happy Hook, 3. Testimonial/Recommendation, 4. Negative/Doubt Hook). IMPORTANT: Each Content Affiliate prompt MUST include the placeholder text 'Replikasi model dari foto referensi'.
Create 4 Commercial ideas (focus staging, grouping, concept, no model).
For all ideas, use shooting style: realistic professional photo with high quality, as if taken with Red Magic 11 Pro flagship smartphone camera with 35mm lens, natural depth of field, sharp detail, clean lighting.
Ensure each idea avoids any text or writing (including watermark, logo, typography, subtitle, UI), avoids 2D elements like illustrations, cartoons, anime, or flat images; and avoids glitch, excessive digital noise, distortion, visual artifacts, unnatural body proportions, crippled fingers or hands, ruined faces, cut bodies, or anatomy that disrupts product appearance.
Answer ONLY with valid JSON format according to the schema.`;

      const creativePayload = {
        contents: [
          {
            parts: [
              { text: creativeDirectorPrompt },
              { inlineData: { mimeType: 'image/png', data: productBase64.split(',')[1] } },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: creativeDirectorSchema,
        },
      };
      let allPromptsString: string;

      try {
        allPromptsString = await callGemini(apiKey, getGeminiTextModel(), creativePayload, 'text');
      } catch (error: any) {
        const message = error?.message || '';

        if (message.includes('Status terakhir: 503') || message.includes('Gemini API error: 503')) {
          addLog(
            'ERROR',
            t.affiliateGenerator.gemini503Retry,
          );

          const fallbackPrompt = `${creativeDirectorPrompt}

Reply ONLY with valid JSON with structure:
{
  "broll": [{ "text": "..." }],
  "ugc": [{ "text": "..." }],
  "commercial": [{ "text": "..." }]
}`;

          const fallbackPayload = {
            contents: [
              {
                parts: [
                  { text: fallbackPrompt },
                  { inlineData: { mimeType: 'image/png', data: productBase64.split(',')[1] } },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
            },
          };

          allPromptsString = await callGemini(apiKey, getGeminiTextModel(), fallbackPayload, 'text');
        } else {
          throw error;
        }
      }

      const allPrompts = JSON.parse(allPromptsString);

      if (
        !allPrompts ||
        !Array.isArray(allPrompts.broll) ||
        !Array.isArray(allPrompts.ugc) ||
        !Array.isArray(allPrompts.commercial)
      ) {
        throw new Error(t.affiliateGenerator.creativeIdeasIncomplete);
      }

      addLog('INFO', t.affiliateGenerator.creativeIdeasSuccess);

      const brollPrompts: { text: string }[] = allPrompts.broll;
      const ugcPrompts: { text: string }[] = allPrompts.ugc;
      const commercialPrompts: { text: string }[] = allPrompts.commercial;

      const buildFinalImagePrompt = (category: ImageCategory, promptText: string): string => {
        const ratioInfo = ASPECT_RATIOS[ratio];
        const ratioPrompt = `Main format: ${ratio} (${ratioInfo.width}x${ratioInfo.height} pixels). Composition must be cleanly cropped without black bars. `;
        let basePrompt = `${ratioPrompt}${promptText}`;

        if (optionsForPrompt.productInfo) {
          basePrompt += ` Main product follows reference photo: ${optionsForPrompt.productInfo}. Focus on keeping type, shape, and function same as reference photo (don't change to another product).`;
        }

        if (optionsForPrompt.additionalProductPhotoDescriptions) {
          basePrompt += ` Also use angles and details from supporting photos: ${optionsForPrompt.additionalProductPhotoDescriptions}.`;
        }

        switch (optionsForPrompt.adType) {
          case 'softselling':
            basePrompt +=
              ' Visual style: natural, lifestyle, authentic, subtle product placement, aesthetic, and classy.';
            break;
          case 'hardselling':
            basePrompt +=
              ' Visual style: bold, direct, very focused product, clear branding, vibrant colors, and sales-oriented.';
            break;
          case 'storytelling':
            basePrompt +=
              ' Visual style: emotional, cinematic, narrative, like a moment in a story close to daily life.';
            break;
          default:
            break;
        }

        if (category === 'broll') {
          basePrompt +=
            ' Shot type: B-roll macro or close-up highlighting physical shape, texture, packaging detail, and usage of product from reference photo. Avoid showing face or body model; if human hands appear, show only as supporting element.';
          basePrompt +=
            ' IMPORTANT: In all B-roll shots, product must be 100% same as main product photo (shape, color, material, logo, packaging detail, and proportion must not change). Do not replace product with variant, flavor, or other type even if text description differs; always follow main product photo as source of truth.';
        } else if (category === 'commercial') {
          basePrompt +=
            ' Shot type: commercial photo with neat concept, placing product as main focus in the middle of set or relevant environment. Avoid showing model face; if human needed, just show silhouette or hands as support.';
        }

        if (category === 'ugc') {
          if (anyModelUploaded) {
            basePrompt = basePrompt.replace(
              'Replikasi model dari foto referensi',
              'Use product from main product photo, and display with model whose face, body proportion, and clothing style replicate the uploaded model reference photo.',
            );
            basePrompt +=
              ' Model face and hair style must be consistent with reference photo so they look like the same person in all photos. Do not copy face from main product photo.';
          } else {
            basePrompt = basePrompt.replace(
              'Replikasi model dari foto referensi',
              'Use product from main product photo and display with relevant and natural AI model.',
            );
            basePrompt += ` ${optionsForPrompt.generatedModelPrompt}`;
          }

          if (optionsForPrompt.modelStyle) {
            basePrompt += ` Model clothing and accessories style follows description: "${optionsForPrompt.modelStyle}". Maintain color and clothing type to be consistent across all Content Affiliate photos.`;
          }
          if (optionsForPrompt.poseDescription && multipleModelsUploaded) {
            basePrompt += ` Interaction and pose between models follow instruction: "${optionsForPrompt.poseDescription}".`;
          }
        }

        basePrompt +=
          ' Shooting style: realistic professional photo with high quality, as if taken with Red Magic 11 Pro flagship smartphone camera with 35mm lens, natural depth of field, sharp detail, clean lighting.';

        basePrompt +=
          ' Avoid any text or writing (including watermark, logo, typography, subtitle, UI), avoid 2D elements like illustrations, cartoons, anime, or flat images; avoid glitch, excessive digital noise, distortion, visual artifacts, unnatural body proportions, crippled fingers or hands, ruined faces, cut bodies, or anatomy that disrupts product appearance.';

        return basePrompt;
      };

      const brollItems: { category: ImageCategory; prompt: string }[] = [];
      const ugcItems: { category: ImageCategory; prompt: string }[] = [];
      const commercialItems: { category: ImageCategory; prompt: string }[] = [];

      const pushCategoryPrompts = (
        category: ImageCategory,
        prompts: { text: string }[],
        target: { category: ImageCategory; prompt: string }[],
      ) => {
        const maxCount = Math.min(4, prompts.length);
        for (let i = 0; i < maxCount; i += 1) {
          const promptText = (prompts[i]?.text || '').trim();
          if (!promptText) continue;
          const finalPrompt = buildFinalImagePrompt(category, promptText);
          target.push({ category, prompt: finalPrompt });
        }
      };
      // Only process categories that are enabled
      if (enabledCategoriesFromLabels.includes('broll')) {
        pushCategoryPrompts('broll', brollPrompts, brollItems);
      }
      if (enabledCategoriesFromLabels.includes('ugc')) {
        pushCategoryPrompts('ugc', ugcPrompts, ugcItems);
      }
      if (enabledCategoriesFromLabels.includes('commercial')) {
        pushCategoryPrompts('commercial', commercialPrompts, commercialItems);
      }

      if (!brollItems.length && !ugcItems.length && !commercialItems.length) {
        throw new Error(t.affiliateGenerator.noValidPrompts);
      }

      const allItemsWithMeta: { category: ImageCategory; prompt: string; slotIndex: number }[] = [];

      // Only add items for enabled categories
      if (enabledCategoriesFromLabels.includes('broll')) {
        brollItems.forEach((item, idx) => {
          allItemsWithMeta.push({ category: 'broll', prompt: item.prompt, slotIndex: idx });
        });
      }

      if (enabledCategoriesFromLabels.includes('ugc')) {
        ugcItems.forEach((item, idx) => {
          allItemsWithMeta.push({ category: 'ugc', prompt: item.prompt, slotIndex: idx });
        });
      }

      if (enabledCategoriesFromLabels.includes('commercial')) {
        commercialItems.forEach((item, idx) => {
          allItemsWithMeta.push({ category: 'commercial', prompt: item.prompt, slotIndex: idx });
        });
      }

      if (!allItemsWithMeta.length) {
        throw new Error(t.affiliateGenerator.noValidPrompts);
      }

      const totalRequested = allItemsWithMeta.length;
      const batchStart = effectiveStartIndex >= totalRequested ? 0 : effectiveStartIndex;
      const batchEnd = Math.min(batchStart + AFFILIATE_IMAGE_BATCH_SIZE, totalRequested);
      const batchItems = allItemsWithMeta.slice(batchStart, batchEnd);
      const batchIndexDisplay = Math.floor(batchStart / AFFILIATE_IMAGE_BATCH_SIZE) + 1;

      // Create placeholder cards immediately for better UX
      const labelMap: Record<ImageCategory, string[]> = {
        broll: ['Macro Glide', 'Texture Close', 'Detail Sweep', 'Soft Focus'],
        ugc: ['Hook Shot', 'Smile Testi', 'Trusty Close', 'Low Doubt'],
        commercial: ['Hero Center', 'Product Stack', 'Context Scene', 'Ambient Glow'],
      };

      const placeholderCards: GeneratedImage[] = batchItems.map((meta, idx) => {
        const cat = meta.category;
        const slotNumber = (meta.slotIndex ?? idx) + 1;
        const cardId = `${cat}-${meta.slotIndex}-${Date.now()}-${idx}`;
        console.log(`[PLACEHOLDER] Creating card: id=${cardId}, category=${cat}, slotIndex=${meta.slotIndex}`);
        const labelsForCat = labelMap[cat] || [];
        const slotLabel = labelsForCat[slotNumber - 1] || `${cat} ${slotNumber}`;

        return {
          id: cardId,
          category: cat,
          fileName: slotLabel,
          filePath: '',
          url: '',
          includeInVideo: true,
          prompt: meta.prompt,
          status: 'generating' as const,
          startedAt: Date.now(),
          estimatedTotalSeconds: DEFAULT_ESTIMATED_SECONDS,
          generationMode: 'new',
          slotIndex: meta.slotIndex, // Add slotIndex for matching
        };
      });
      
      setGeneratedImages((prev) => [...prev, ...placeholderCards]);
      
      // Schedule sequential card reveal with 2s delay
      placeholderCards.forEach((card, idx) => {
        const timeout = setTimeout(() => {
          setVisibleCardIds(prevVisible => new Set([...prevVisible, card.id]));
        }, idx * 2000);
        cardRevealTimeouts.current.push(timeout);
      });

      let successCount = 0;
      let failCount = 0;
      let batchReturned = 0;

      addLog(
        'INFO',
        t.affiliateGenerator.sendingPrompts.replace('{count}', String(batchItems.length)).replace('{batch}', String(batchIndexDisplay)).replace('{total}', String(totalAffiliateBatches)),
      );

      const brollBatchItems = batchItems.filter((item) => item.category === 'broll');
      const ugcBatchItems = batchItems.filter((item) => item.category === 'ugc');
      const commercialBatchItems = batchItems.filter((item) => item.category === 'commercial');

      const processBatchGroup = async (
        category: ImageCategory,
        itemsForCategory: { category: ImageCategory; prompt: string; slotIndex: number }[],
      ) => {
        if (!itemsForCategory.length) return;

        const referencesForCategory =
          category === 'ugc'
            ? {
                product: productRawBase64,
                models: modelRawBase64List,
                additional: additionalRawBase64List,
              }
            : {
                product: productRawBase64,
                models: [],
                additional: additionalRawBase64List,
              };

        const response = await window.zeoAPI.generateAffiliateImages({
          bearerKey,
          aspectRatioKey: ratio,
          items: itemsForCategory.map((item) => ({
            category: item.category,
            prompt: item.prompt,
          })),
          references: referencesForCategory,
        });

        if (!response || !response.ok) {
          const message = response?.error || t.affiliateGenerator.engineResponseInvalid;
          throw new Error(message);
        }

        const results = Array.isArray(response.results) ? response.results : [];

        if (!results.length) {
          throw new Error(t.affiliateGenerator.engineNoImages);
        }

        batchReturned += results.length;

        results.forEach((result: any, index: number) => {
          const meta = itemsForCategory[index];
          if (!meta) {
            console.log(`[UPDATE] No meta found for index ${index}`);
            return;
          }

          const cat = meta.category;
          const label = cat === 'broll' ? 'B-roll' : cat === 'ugc' ? 'Content Affiliate' : 'Commercial';
          const slotNumber = (meta.slotIndex ?? index) + 1;
          const success = !!result?.success;
          
          console.log(`[UPDATE] Processing result: category=${cat}, slotIndex=${meta.slotIndex}, success=${success}`);

          // Process result OUTSIDE of state setter to avoid duplicate logs
          let updateStatus: 'success' | 'failed' = 'failed';
          let errorMessage: string | undefined;
          let dataUrl: string | undefined;

          if (!success) {
            const errMsg: string = result?.error || t.affiliateGenerator.unknownEngineError;
            addLog('ERROR', t.affiliateGenerator.generateSlotFailed.replace('{label}', label).replace('{slot}', String(slotNumber)).replace('{error}', errMsg));
            failCount += 1;
            updateStatus = 'failed';
            errorMessage = errMsg;
          } else {
            dataUrl = result.dataUrl;
            if (!dataUrl) {
              const errMsg = t.affiliateGenerator.engineSlotNoData.replace('{label}', label).replace('{slot}', String(slotNumber));
              addLog('ERROR', errMsg);
              failCount += 1;
              updateStatus = 'failed';
              errorMessage = errMsg;
            } else {
              console.log(`[UPDATE] Success! Updating card with dataUrl length: ${dataUrl.length}`);
              successCount += 1;
              addLog('SUCCESS', `${label} slot ${slotNumber} completed successfully`);
              updateStatus = 'success';
            }
          }

          // Update existing placeholder card (state update only, no side effects)
          setGeneratedImages((prev) => {
            const updated = prev.map((img) => {
              // Match by category and slotIndex for reliable updates
              if (img.category === cat && img.slotIndex === meta.slotIndex && img.status === 'generating') {
                console.log(`[UPDATE] Found matching card: id=${img.id}, updating to ${updateStatus}`);
                
                if (updateStatus === 'failed') {
                  return {
                    ...img,
                    status: 'failed' as const,
                    errorMessage,
                    generationMode: undefined,
                  };
                }

                return {
                  ...img,
                  url: dataUrl,
                  status: 'success' as const,
                  generationMode: undefined,
                };
              }
              return img;
            });
            
            const stillGenerating = updated.filter(img => img.status === 'generating').length;
            console.log(`[UPDATE] After update: ${stillGenerating} cards still generating`);
            return updated;
          });
        });
      };

      await processBatchGroup('broll', brollBatchItems);
      await processBatchGroup('ugc', ugcBatchItems);
      await processBatchGroup('commercial', commercialBatchItems);

      if (successCount > 0) {
        addLog(
          'SUCCESS',
          t.affiliateGenerator.batchCompleted.replace('{batch}', String(batchIndexDisplay)).replace('{total}', String(totalAffiliateBatches)).replace('{success}', String(successCount)).replace('{count}', String(batchItems.length)),
        );
      } else {
        addLog(
          'ERROR',
          t.affiliateGenerator.batchFailed.replace('{batch}', String(batchIndexDisplay)).replace('{total}', String(totalAffiliateBatches)),
        );
      }

      const missingCount = batchItems.length > batchReturned ? batchItems.length - batchReturned : 0;

      addLog(
        'INFO',
        t.affiliateGenerator.batchSummary.replace('{batch}', String(batchIndexDisplay)).replace('{sent}', String(batchItems.length)).replace('{received}', String(batchReturned)).replace('{success}', String(successCount)).replace('{failed}', String(failCount)).replace('{missing}', String(missingCount)),
      );

      setNextAffiliateImageIndex(batchEnd);
    } catch (error: any) {
      const message = error?.message || t.affiliateGenerator.generateError;
      console.error('Generate affiliate error:', error);
      addLog('ERROR', t.affiliateGenerator.generateFailed.replace('{message}', message));
    } finally {
      setIsGenerating(false);
      setIsGenerateButtonLocked(false);
      
      // Clear timeouts
      cardRevealTimeouts.current.forEach(timeout => clearTimeout(timeout));
      cardRevealTimeouts.current = [];
      videoCardRevealTimeouts.current.forEach(timeout => clearTimeout(timeout));
      videoCardRevealTimeouts.current = [];
    }
  };

  const stopCurrentAudio = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
    }
    audioRef.current = null;

    setNarrations((prev) => ({
      ...prev,
      broll: { ...prev.broll, isPlaying: false },
      ugc: { ...prev.ugc, isPlaying: false },
      commercial: { ...prev.commercial, isPlaying: false },
    }));

    setNarrationAudioStatus({ category: null, isPlaying: false, currentTime: 0, duration: 0 });
  };


  const handleNarrationTypeChange = (_category: NarrationCategory, _type: 'pendek' | 'panjang') => {
    // Tipe narasi tidak lagi digunakan; selalu generate narasi pendek untuk video singkat.
  };

  const handleNarrationTextChange = (category: NarrationCategory, value: string) => {
    setNarrations((prev) => {
      const current = prev[category];
      if (!current) return prev;

      if (current.activeLang === 'id') {
        return {
          ...prev,
          [category]: {
            ...current,
            textId: value,
          },
        };
      }

      return {
        ...prev,
        [category]: {
          ...current,
          textEn: value,
        },
      };
    });
  };

  const handleVoiceChange = (category: NarrationCategory, voiceId: string) => {
    setNarrations((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        selectedVoiceId: voiceId,
      },
    }));
  };

  const handleGenerateNarration = async (category: NarrationCategory) => {
    if (!authReady) {
      const message = t.logMessages.common.statusNotReady;
      setError(message);
      addLog('ERROR', message);
      return;
    }

    if (!productFile) {
      addLog('ERROR', t.logMessages.affiliate.photoRequired);
      return;
    }

    const apiKey =
      typeof window !== 'undefined' ? localStorage.getItem('zeoStudio.ai.apiKey') || '' : '';
    if (!apiKey) {
      addLog('ERROR', t.logMessages.common.apiKeyMissing);
      return;
    }

    setNarrations((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        isGenerating: true,
      },
    }));

    try {
      const productBase64 = await compressImage(productFile);
      const narrationFallbackMap: Record<string, string> = {
        en: 'the product in the image',
        id: 'produk yang ada di gambar',
        ms: 'produk dalam imej',
      };
      const productInfoForPrompt = productInfo.trim() || narrationFallbackMap[language] || narrationFallbackMap.id;

      const totalImagesForVideo = generatedImages.filter(
        (img) => img.includeInVideo !== false && img.status === 'success' && img.url,
      ).length;

      let sceneCount = 1;
      if (category === 'ugc') {
        const maxScenes = 12;
        const sourceCount = totalImagesForVideo || generatedImages.length;
        sceneCount = Math.max(1, Math.min(sourceCount || 1, maxScenes));
      } else {
        const categoryImagesCount = generatedImages.filter(
          (img) => img.category === category && img.status === 'success' && img.url,
        ).length;
        const maxScenes = 4;
        sceneCount = Math.max(1, Math.min(categoryImagesCount || 1, maxScenes));
      }

      let toneInstruction = '';
      const accentTrimmed = accent.trim();
      if (accentTrimmed) {
        const toneAccentMap: Record<string, string> = {
          en: `IMPORTANT: Use a TONE and ACCENT characteristic of: ${accentTrimmed}. If this is a regional accent, adjust pronunciation and intonation to sound authentic.`,
          id: `PENTING: Gunakan TONE dan AKSEN yang khas dari: ${accentTrimmed}. Jika ini adalah aksen daerah (misal: Jawa medok, Batak), sesuaikan pengecapan dan intonasi agar terdengar otentik.`,
          ms: `PENTING: Gunakan NADA dan LOGHAT yang khas daripada: ${accentTrimmed}. Jika ini adalah loghat daerah, sesuaikan sebutan dan intonasi agar kedengaran asli.`,
        };
        toneInstruction = toneAccentMap[language] || toneAccentMap.id;
      } else if (productInfo.trim()) {
        const toneProductMap: Record<string, string> = {
          en: `Use a TONE that matches the product description: "${productInfoForPrompt}".`,
          id: `Gunakan TONE yang sesuai dengan deskripsi produk: "${productInfoForPrompt}".`,
          ms: `Gunakan NADA yang sesuai dengan penerangan produk: "${productInfoForPrompt}".`,
        };
        toneInstruction = toneProductMap[language] || toneProductMap.id;
      }

      const promptLanguageLabel = getLanguageLabelForPrompt(language as LanguageOption);
      let baseNarrationPrompt = '';

      if (category === 'broll') {
        const brollPromptMap: Record<string, string> = {
          en: `You are a short video ad copywriter. Based on product description: "${productInfoForPrompt}" and the product image, create a LIST of ${sceneCount} B-roll video opening narrations in ${promptLanguageLabel}. Each narration MUST be ONE very short sentence (about 10–18 words) with a reading duration of MAX 8 seconds (target 6–8 seconds). When in doubt, prioritize shorter, concise sentences that go straight to the main point, focusing on product sensation and details. ${toneInstruction} Each line must start with [TONE] followed by a space, then the sentence. EXAMPLE OUTPUT: [Cheerful] On this colorful track, every turn opens a gateway to imaginative adventure. Provide results directly without introductory sentences.`,
          id: `Anda adalah seorang copywriter iklan video pendek. Berdasarkan deskripsi produk: "${productInfoForPrompt}" dan gambar produk, buatlah DAFTAR ${sceneCount} narasi pembuka video B-roll dalam ${promptLanguageLabel}. Setiap narasi HARUS berupa SATU kalimat sangat singkat (sekitar 10–18 kata) dengan durasi baca MAKSIMAL 8 detik (target 6–8 detik). Jika ragu, utamakan kalimat yang lebih pendek, padat, dan langsung ke poin utama, serta fokus pada sensasi dan detail produk. ${toneInstruction} Setiap baris harus diawali dengan [TONE] lalu spasi, diikuti kalimat. CONTOH OUTPUT: [Ceria] Di lintasan penuh warna ini, setiap putaran membuka gerbang petualangan imajinasi. Langsung berikan hasilnya tanpa kalimat pembuka.`,
          ms: `Anda adalah seorang penulis salinan iklan video pendek. Berdasarkan penerangan produk: "${productInfoForPrompt}" dan imej produk, cipta SENARAI ${sceneCount} narasi pembukaan video B-roll dalam ${promptLanguageLabel}. Setiap narasi MESTI berupa SATU ayat sangat ringkas (kira-kira 10–18 patah perkataan) dengan tempoh bacaan MAKSIMUM 8 saat (sasaran 6–8 saat). Jika ragu, utamakan ayat yang lebih pendek, padat, dan terus ke poin utama, serta fokus pada sensasi dan butiran produk. ${toneInstruction} Setiap baris mesti dimulakan dengan [NADA] diikuti ruang, kemudian ayat. CONTOH OUTPUT: [Bertenaga] Di lintasan penuh warna ini, setiap pusingan membuka pintu pengembaraan imaginasi. Berikan hasil terus tanpa ayat pembukaan.`,
        };
        baseNarrationPrompt = brollPromptMap[language] || brollPromptMap.id;
      } else if (category === 'ugc') {
        const ugcPromptMap: Record<string, string> = {
          en: `You are a content creator recording a CONTENT AFFILIATE/testimonial video using this product. Based on product description: "${productInfoForPrompt}" and the product image, create a LIST of ${sceneCount} short affiliate content scripts in ${promptLanguageLabel} from a first-person perspective (I/me). OUTPUT MUST consist of exactly ${sceneCount} lines, without blank lines and without numbering. Each LINE represents ONE video scene, as ONE short sentence combining: 1) a brief hook, 2) a short experience/testimonial after using the product, 3) a concise call-to-action (CTA). Each line should be about 12–18 words with a reading duration of MAX 8 seconds (target 6–8 seconds). When in doubt, make sentences shorter and remove unnecessary filler words. ${toneInstruction} Use a casual, natural, and honest conversational style. Each line must start with [TONE] followed by a space, then the main sentence. DO NOT split one script into multiple lines. EXAMPLE OUTPUT: [Casual] Honestly, I was skeptical at first, but after a week using this bag, I feel so much more confident every time I go out.`,
          id: `Anda adalah seorang content creator yang sedang merekam video CONTENT AFFILIATE/testimoni menggunakan produk ini. Berdasarkan deskripsi produk: "${productInfoForPrompt}" dan gambar produk, buatlah DAFTAR ${sceneCount} skrip konten affiliate singkat dalam ${promptLanguageLabel} dari sudut pandang orang pertama (aku/saya/gue). OUTPUT HARUS terdiri dari tepat ${sceneCount} baris, tanpa baris kosong dan tanpa penomoran. Setiap BARIS mewakili SATU scene video, berupa SATU kalimat pendek yang menggabungkan: 1) hook singkat, 2) pengalaman/testimoni singkat setelah memakai produk, 3) ajakan (CTA) yang padat. Panjang tiap baris sekitar 12–18 kata dengan durasi baca MAKSIMAL 8 detik (target 6–8 detik). Jika ragu, buat kalimat lebih pendek dan hilangkan kata-kata pengisi yang tidak penting. ${toneInstruction} Gunakan gaya bahasa percakapan yang santai, natural, dan terasa jujur. Setiap baris harus diawali dengan [TONE] lalu spasi, diikuti kalimat utama. JANGAN memecah satu skrip menjadi beberapa baris. CONTOH OUTPUT: [Santai] Jujur, awalnya aku ragu, tapi setelah seminggu pakai tas ini, aku jadi jauh lebih percaya diri setiap keluar rumah.`,
          ms: `Anda adalah seorang pencipta kandungan yang sedang merakam video KANDUNGAN AFFILIATE/testimoni menggunakan produk ini. Berdasarkan penerangan produk: "${productInfoForPrompt}" dan imej produk, cipta SENARAI ${sceneCount} skrip kandungan affiliate ringkas dalam ${promptLanguageLabel} dari sudut pandang orang pertama (saya/aku). OUTPUT MESTI terdiri daripada tepat ${sceneCount} baris, tanpa baris kosong dan tanpa penomboran. Setiap BARIS mewakili SATU scene video, berupa SATU ayat pendek yang menggabungkan: 1) hook ringkas, 2) pengalaman/testimoni ringkas selepas menggunakan produk, 3) seruan tindakan (CTA) yang padat. Panjang setiap baris kira-kira 12–18 patah perkataan dengan tempoh bacaan MAKSIMUM 8 saat (sasaran 6–8 saat). Jika ragu, buat ayat lebih pendek dan buang perkataan pengisi yang tidak penting. ${toneInstruction} Gunakan gaya bahasa perbualan yang santai, semula jadi, dan terasa jujur. Setiap baris mesti dimulakan dengan [NADA] diikuti ruang, kemudian ayat utama. JANGAN pecahkan satu skrip kepada beberapa baris. CONTOH OUTPUT: [Santai] Jujur, mulanya saya ragu, tapi selepas seminggu guna beg ini, saya jadi lebih yakin setiap kali keluar rumah.`,
        };
        baseNarrationPrompt = ugcPromptMap[language] || ugcPromptMap.id;
      } else {
        const ctaMap: Record<string, Record<string, string>> = {
          en: {
            default: 'CTA (call-to-action with "click the cart below")',
            hardselling: 'A clear and urgent CTA (e.g.: "Click the cart now!")',
            softselling: 'A subtle CTA (e.g.: "Try it out, check the cart.")',
            storytelling: 'A story-related CTA (e.g.: "Ready to change your story? Check the cart.")',
          },
          id: {
            default: 'CTA (ajakan bertindak dengan "klik keranjang dibawah")',
            hardselling: 'CTA yang jelas dan mendesak (misal: "Klik keranjang sekarang!")',
            softselling: 'CTA yang halus (misal: "Cobain deh, cek keranjang.")',
            storytelling: 'CTA yang terkait cerita (misal: "Siap ubah ceritamu? Cek keranjang.")',
          },
          ms: {
            default: 'CTA (seruan tindakan dengan "klik bakul di bawah")',
            hardselling: 'CTA yang jelas dan mendesak (contoh: "Klik bakul sekarang!")',
            softselling: 'CTA yang halus (contoh: "Cuba lah, semak bakul.")',
            storytelling: 'CTA yang berkaitan cerita (contoh: "Bersedia ubah cerita anda? Semak bakul.")',
          },
        };
        const langCta = ctaMap[language] || ctaMap.id;
        const ctaInstruction = langCta[adType] || langCta.default;

        const commercialPromptMap: Record<string, string> = {
          en: `You are a marketing director for short video ads. Based on product description: "${productInfoForPrompt}" and the product image, create a LIST of ${sceneCount} short ad narrations in ${promptLanguageLabel} with structure: Short hook and CTA (${ctaInstruction}). Each script MUST be ONE short ad sentence (about 12–20 words) with a reading duration of MAX 8 seconds (target 6–8 seconds). Avoid long or wordy sentences; go straight to the main benefit and call-to-action. ${toneInstruction} Each line must start with [TONE] followed by a space, then the sentence. EXAMPLE OUTPUT: [Energetic] Want glowing skin? [Satisfied] The solution is right here. Provide results directly without introductory sentences.`,
          id: `Anda adalah seorang marketing director untuk iklan video pendek. Berdasarkan deskripsi produk: "${productInfoForPrompt}" dan gambar produk, buatlah DAFTAR ${sceneCount} narasi iklan singkat dalam ${promptLanguageLabel} dengan struktur: Hook singkat dan CTA (${ctaInstruction}). Setiap skrip HARUS berupa SATU kalimat iklan pendek (sekitar 12–20 kata) dengan durasi baca MAKSIMAL 8 detik (target 6–8 detik). Hindari kalimat panjang atau bertele-tele; langsung ke manfaat utama dan ajakan bertindak. ${toneInstruction} Setiap baris harus diawali dengan [TONE] lalu spasi, diikuti kalimat. CONTOH OUTPUT: [Enerjik] Mau kulit glowing? [Puas] Solusinya ada di sini. Langsung berikan hasilnya tanpa kalimat pembuka.`,
          ms: `Anda adalah seorang pengarah pemasaran untuk iklan video pendek. Berdasarkan penerangan produk: "${productInfoForPrompt}" dan imej produk, cipta SENARAI ${sceneCount} narasi iklan ringkas dalam ${promptLanguageLabel} dengan struktur: Hook ringkas dan CTA (${ctaInstruction}). Setiap skrip MESTI berupa SATU ayat iklan pendek (kira-kira 12–20 patah perkataan) dengan tempoh bacaan MAKSIMUM 8 saat (sasaran 6–8 saat). Elakkan ayat panjang atau berbelit-belit; terus ke manfaat utama dan seruan tindakan. ${toneInstruction} Setiap baris mesti dimulakan dengan [NADA] diikuti ruang, kemudian ayat. CONTOH OUTPUT: [Bertenaga] Mahu kulit berseri? [Puas] Penyelesaiannya ada di sini. Berikan hasil terus tanpa ayat pembukaan.`,
        };
        baseNarrationPrompt = commercialPromptMap[language] || commercialPromptMap.id;
      }

      const narrationStyleMap: Record<string, Record<string, string>> = {
        en: {
          softselling: ' NARRATION STYLE: Use subtle, poetic language focused on feelings or emotional benefits.',
          hardselling: ' NARRATION STYLE: Use clear, persuasive, and to-the-point language with a strong CTA.',
          storytelling: ' NARRATION STYLE: Use storytelling language that builds atmosphere and creates emotional connection.',
        },
        id: {
          softselling: ' GAYA NARASI: Gunakan bahasa yang halus, puitis, dan fokus pada rasa atau manfaat emosional.',
          hardselling: ' GAYA NARASI: Gunakan bahasa yang jelas, persuasif, dan langsung ke intinya (to the point), dengan CTA yang kuat.',
          storytelling: ' GAYA NARASI: Gunakan bahasa yang bercerita, membangun suasana, dan menciptakan koneksi emosional.',
        },
        ms: {
          softselling: ' GAYA NARASI: Gunakan bahasa yang halus, puitis, dan fokus pada perasaan atau manfaat emosional.',
          hardselling: ' GAYA NARASI: Gunakan bahasa yang jelas, persuasif, dan terus ke intinya, dengan CTA yang kuat.',
          storytelling: ' GAYA NARASI: Gunakan bahasa yang bercerita, membina suasana, dan mencipta hubungan emosional.',
        },
      };
      const langStyles = narrationStyleMap[language] || narrationStyleMap.id;
      if (langStyles[adType]) {
        baseNarrationPrompt += langStyles[adType];
      }

      const idPayload = {
        contents: [
          {
            parts: [
              { text: baseNarrationPrompt },
              { inlineData: { mimeType: 'image/png', data: productBase64.split(',')[1] } },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ['TEXT'],
        },
      };

      const narrationTextId = await callGemini(apiKey, getGeminiTextModel(), idPayload, 'text');

      let narrationTextEn = narrationTextId;
      let narrationTextForId = narrationTextId;

      if (language !== 'en') {
        const translationPromptEn = `Translate the following narration text to natural, compelling English. Keep any bracketed tone instructions as they are, and preserve line breaks (each line is a separate short script). Text: "${narrationTextId}"`;
        const enPayload = {
          contents: [{ parts: [{ text: translationPromptEn }] }],
          generationConfig: { responseModalities: ['TEXT'] },
        };
        narrationTextEn = await callGemini(apiKey, getGeminiTextModel(), enPayload, 'text');
      }

      const useIdAsPrimary = language !== 'en';

      setNarrations((prev) => ({
        ...prev,
        [category]: {
          ...prev[category],
          textId: useIdAsPrimary ? narrationTextId : narrationTextForId,
          textEn: narrationTextEn,
          activeLang: useIdAsPrimary ? 'id' : 'en',
          isGenerating: false,
          selectedSceneIndex: 0,
        },
      }));

      const categoryLabel =
        category === 'broll' ? 'B-Roll' : category === 'ugc' ? 'Content Affiliate' : 'Commercial';

      addLog(
        'SUCCESS',
        t.affiliateGenerator.narrationSuccess.replace('{category}', categoryLabel).replace('{language}', getLanguageLabelForPrompt(language as LanguageOption)),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t.affiliateGenerator.narrationError.replace('{category}', '').replace('{message}', '');
      const categoryLabel =
        category === 'broll' ? 'B-Roll' : category === 'ugc' ? 'Content Affiliate' : 'Commercial';
      addLog(
        'ERROR',
        t.affiliateGenerator.narrationError.replace('{category}', categoryLabel).replace('{message}', message),
      );
      setNarrations((prev) => ({
        ...prev,
        [category]: {
          ...prev[category],
          isGenerating: false,
        },
      }));
    }
  };

  const handlePlayNarration = async (category: NarrationCategory) => {
    const current = narrations[category];

    if (current.isPlaying) {
      stopCurrentAudio();
      return;
    }

    const baseText =
      current.activeLang === 'id'
        ? current.textId || current.textEn
        : current.textEn || current.textId;

    const allLines = (baseText || '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (!allLines.length) {
      return;
    }

    const cleanedText = allLines
      .filter((line) => !line.startsWith('AI sedang') && !line.startsWith('Gagal'))
      .join(' ');

    const textToSpeak = cleanedText.replace(/(\[.*?\]|\*\*(.*?)\*\*)/g, '').trim();
    if (!textToSpeak) return;

    const voiceId = current.selectedVoiceId || TTS_VOICES[0]?.id || '';
    if (!voiceId) {
      addLog('ERROR', t.affiliateGenerator.ttsVoiceUnavailable);
      return;
    }

    const apiKey =
      typeof window !== 'undefined' ? localStorage.getItem('zeoStudio.ai.apiKey') || '' : '';
    if (!apiKey) {
      addLog(
        'ERROR',
        t.affiliateGenerator.ttsApiKeyMissing,
      );
      return;
    }

    stopCurrentAudio();

    setNarrations((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        isPlaying: true,
      },
    }));

    try {
      const payload = {
        contents: [{ parts: [{ text: textToSpeak }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voiceId,
              },
            },
          },
        },
      };

      const { audioData, sampleRate } = await callGeminiTts(apiKey, payload);
      const pcmData = base64ToArrayBuffer(audioData);
      const wavBlob = pcmToWav(pcmData, sampleRate);
      const audioUrl = URL.createObjectURL(wavBlob);

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      setNarrations((prev) => ({
        ...prev,
        [category]: {
          ...prev[category],
          audioUrl,
          isPlaying: true,
        },
      }));

      audio.addEventListener('loadedmetadata', () => {
        setNarrationAudioStatus({
          category,
          isPlaying: true,
          currentTime: 0,
          duration: Number.isFinite(audio.duration) ? audio.duration : 0,
        });
      });

      audio.addEventListener('timeupdate', () => {
        setNarrationAudioStatus((prev) =>
          prev.category === category
            ? {
                ...prev,
                currentTime: audio.currentTime,
                duration: Number.isFinite(audio.duration) ? audio.duration : prev.duration,
              }
            : prev,
        );
      });

      audio.addEventListener('ended', () => {
        setNarrationAudioStatus((prev) =>
          prev.category === category
            ? {
                ...prev,
                isPlaying: false,
                currentTime: audio.duration || prev.currentTime,
              }
            : prev,
        );
        setNarrations((prev) => ({
          ...prev,
          [category]: {
            ...prev[category],
            isPlaying: false,
          },
        }));
      });

      try {
        await audio.play();
      } catch {
        setNarrationAudioStatus((prev) =>
          prev.category === category ? { ...prev, isPlaying: false } : prev,
        );
        setNarrations((prev) => ({
          ...prev,
          [category]: {
            ...prev[category],
            isPlaying: false,
          },
        }));
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t.affiliateGenerator.ttsError.replace('{message}', '');
      addLog('ERROR', t.affiliateGenerator.ttsError.replace('{message}', message));
      stopCurrentAudio();
    }
  };

  const handleSeekNarrationAudio = (category: NarrationCategory, value: number) => {
    if (narrationAudioStatus.category !== category || !audioRef.current) return;
    const audio = audioRef.current;
    const duration = audio.duration || narrationAudioStatus.duration || 0;
    if (!duration || Number.isNaN(duration)) return;

    const nextTime = Math.max(0, Math.min(duration, (value / 100) * duration));
    audio.currentTime = nextTime;
    setNarrationAudioStatus((prev) =>
      prev.category === category ? { ...prev, currentTime: nextTime, duration } : prev,
    );
  };

  const handleDownloadNarrationAudio = (category: NarrationCategory) => {
    const audioUrl = narrations[category].audioUrl;
    if (!audioUrl) {
      addLog('ERROR', t.affiliateGenerator.downloadAudioFirst);
      return;
    }

    const a = document.createElement('a');
    const dateCode = new Date().toISOString().slice(0, 10);
    const baseName = `narasi-${category}-${dateCode}`;
    const key = `${baseName}.wav`;
    const counters = downloadCountersRef.current;
    const current = counters[key] ?? 0;
    const next = current + 1;
    counters[key] = next;
    const suffix = current === 0 ? '' : `-${String(next).padStart(2, '0')}`;

    a.href = audioUrl;
    a.download = `${baseName}${suffix}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleGenerateCaption = async (category: NarrationCategory) => {
    if (!authReady) {
      const message = t.logMessages.common.statusNotReady;
      setError(message);
      addLog('ERROR', message);
      return;
    }

    if (!productFile) {
      addLog('ERROR', t.logMessages.affiliate.photoRequired);
      return;
    }

    const apiKey =
      typeof window !== 'undefined' ? localStorage.getItem('zeoStudio.ai.apiKey') || '' : '';
    if (!apiKey) {
      addLog('ERROR', t.logMessages.common.apiKeyMissing);
      return;
    }

    setCaptions((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        isGenerating: true,
      },
    }));

    try {
      const productBase64 = await compressImage(productFile);
      const captionFallbackMap: Record<string, string> = {
        en: 'the product in the image',
        id: 'produk yang ada di gambar',
        ms: 'produk dalam imej',
      };
      const productInfoForPrompt = productInfo.trim() || captionFallbackMap[language] || captionFallbackMap.id;

      const hashtagDescMap: Record<string, string> = {
        en: 'List of relevant and SEO-friendly hashtags in the same language. IMPORTANT: Maximum 5 hashtags.',
        id: 'List of relevant and SEO-friendly hashtags in the same language. PENTING: Maksimal 5 hashtags.',
        ms: 'List of relevant and SEO-friendly hashtags in the same language. PENTING: Maksimum 5 hashtags.',
      };

      const captionJsonSchema = {
        type: 'OBJECT',
        properties: {
          caption: {
            type: 'STRING',
            description: `Engaging social media caption in ${getLanguageLabelForPrompt(language as LanguageOption)}, max 3 sentences. Includes hook, benefits/problem-solution, and a call-to-action.`,
          },
          hashtags: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: hashtagDescMap[language] || hashtagDescMap.id,
          },
        },
        required: ['caption', 'hashtags'],
      };

      const captionPromptMap: Record<string, string> = {
        en: `You are a social media marketing expert. Based on product description: "${productInfoForPrompt}" and this product image, create a JSON containing caption and SEO-friendly hashtags in ${getLanguageLabelForPrompt(language as LanguageOption)}. Caption must be engaging (hook), highlight benefits or solutions, and end with a call-to-action (e.g.: "check the cart below!"). Maximum 3 sentences. Hashtags must be relevant to the product and target market. IMPORTANT: Provide **maximum 5 hashtags** that are most relevant and SEO-friendly. Follow the given JSON schema.`,
        id: `Anda adalah seorang ahli marketing media sosial. Berdasarkan deskripsi produk: "${productInfoForPrompt}" dan gambar produk ini, buatkan JSON berisi caption dan hashtags yang SEO-friendly dalam ${getLanguageLabelForPrompt(language as LanguageOption)}. Caption harus menarik (hook), menyoroti manfaat atau solusi, dan diakhiri call-to-action (misal: "cek keranjang dibawah!"). Maksimal 3 kalimat. Hashtags harus relevan dengan produk dan target pasar. PENTING: Berikan **maksimal 5 hashtags** yang paling relevan dan SEO-friendly. Ikuti skema JSON yang diberikan.`,
        ms: `Anda adalah seorang pakar pemasaran media sosial. Berdasarkan penerangan produk: "${productInfoForPrompt}" dan imej produk ini, cipta JSON mengandungi kapsyen dan hashtag yang mesra SEO dalam ${getLanguageLabelForPrompt(language as LanguageOption)}. Kapsyen mesti menarik (hook), menyerlahkan manfaat atau penyelesaian, dan diakhiri seruan tindakan (contoh: "semak bakul di bawah!"). Maksimum 3 ayat. Hashtag mesti relevan dengan produk dan pasaran sasaran. PENTING: Berikan **maksimum 5 hashtag** yang paling relevan dan mesra SEO. Ikut skema JSON yang diberikan.`,
      };
      let captionPrompt = captionPromptMap[language] || captionPromptMap.id;

      const captionStyleMap: Record<string, Record<string, string>> = {
        en: {
          softselling: ' CAPTION STYLE: Caption should be *aesthetic* and *subtle*, more focused on *lifestyle* and *emotional benefits*.',
          hardselling: ' CAPTION STYLE: Caption should be *to the point*, *sales-driven*, with a *very clear CTA* and highlighting promotions if any.',
          storytelling: ' CAPTION STYLE: Caption should be *storytelling*, *emotional*, and *invite the audience into the story* or share their experience.',
        },
        id: {
          softselling: ' GAYA CAPTION: Caption harus *aesthetic* dan *subtle*, lebih fokus ke *lifestyle* dan *manfaat emosional*.',
          hardselling: ' GAYA CAPTION: Caption harus *to the point*, *menjual*, dengan *CTA yang sangat jelas* dan menonjolkan promo jika ada.',
          storytelling: ' GAYA CAPTION: Caption harus *bercerita*, *emosional*, dan *mengajak audiens masuk ke dalam cerita* atau membagikan pengalaman mereka.',
        },
        ms: {
          softselling: ' GAYA KAPSYEN: Kapsyen mesti *estetik* dan *halus*, lebih fokus pada *gaya hidup* dan *manfaat emosional*.',
          hardselling: ' GAYA KAPSYEN: Kapsyen mesti *terus ke inti*, *menjual*, dengan *CTA yang sangat jelas* dan menonjolkan promosi jika ada.',
          storytelling: ' GAYA KAPSYEN: Kapsyen mesti *bercerita*, *emosional*, dan *mengajak audiens masuk ke dalam cerita* atau berkongsi pengalaman mereka.',
        },
      };
      const langCaptionStyles = captionStyleMap[language] || captionStyleMap.id;
      if (langCaptionStyles[adType]) {
        captionPrompt += langCaptionStyles[adType];
      }

      const payload = {
        contents: [
          {
            parts: [
              { text: captionPrompt },
              { inlineData: { mimeType: 'image/png', data: productBase64.split(',')[1] } },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: captionJsonSchema,
        },
      };

      const captionJsonStringId = await callGemini(apiKey, getGeminiTextModel(), payload, 'text');
      const captionDataId = JSON.parse(captionJsonStringId);

      let captionDataEn = captionDataId;
      let captionForId = captionDataId;

      if (language !== 'en') {
        const translationPromptEn = `Translate the following JSON caption and hashtags into natural, compelling English. Keep the JSON structure. Input: ${JSON.stringify(
          captionDataId,
        )} Output:`;
        const enPayload = {
          contents: [{ parts: [{ text: translationPromptEn }] }],
          generationConfig: { responseMimeType: 'application/json', responseSchema: captionJsonSchema },
        };
        const captionJsonStringEn = await callGemini(apiKey, getGeminiTextModel(), enPayload, 'text');
        captionDataEn = JSON.parse(captionJsonStringEn);
      }

      const normalizeHashtags = (tags: string[]): string =>
        tags
          .map((h) => `#${h.replace(/#/g, '').trim()}`)
          .filter((h) => h !== '#')
          .join(' ');

      const idCaptionText = captionDataId.caption;
      const idHashtagsText = normalizeHashtags(captionDataId.hashtags || []);

      const enCaptionText = captionDataEn.caption;
      const enHashtagsText = normalizeHashtags(captionDataEn.hashtags || []);

      const useIdAsPrimary = language !== 'en';

      setCaptions((prev) => ({
        ...prev,
        [category]: {
          ...prev[category],
          captionId: idCaptionText,
          captionEn: enCaptionText,
          hashtagsId: idHashtagsText,
          hashtagsEn: enHashtagsText,
          activeLang: useIdAsPrimary ? 'id' : 'en',
          isGenerating: false,
        },
      }));

      const categoryLabel =
        category === 'broll' ? 'B-Roll' : category === 'ugc' ? 'Content Affiliate' : 'Commercial';

      addLog(
        'SUCCESS',
        t.affiliateGenerator.captionSuccess.replace('{category}', categoryLabel),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t.affiliateGenerator.captionError.replace('{category}', '').replace('{message}', '');
      const categoryLabel =
        category === 'broll' ? 'B-Roll' : category === 'ugc' ? 'UGC' : 'Commercial';
      addLog(
        'ERROR',
        t.affiliateGenerator.captionError.replace('{category}', categoryLabel).replace('{message}', message),
      );

      setCaptions((prev) => ({
        ...prev,
        [category]: {
          ...prev[category],
          isGenerating: false,
        },
      }));
    }
  };

  const handleCopyNarration = async (category: NarrationCategory) => {
    const current = narrations[category];
    const text =
      current.activeLang === 'id'
        ? current.textId || current.textEn
        : current.textEn || current.textId;

    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      const categoryLabel =
        category === 'broll' ? 'B-roll' : category === 'ugc' ? 'Content Affiliate' : 'Commercial';
      addLog('SUCCESS', t.affiliateGenerator.narrationCopied.replace('{category}', categoryLabel));
    } catch {
      addLog('ERROR', t.affiliateGenerator.narrationCopyFailed);
    }
  };

  const handleCopyCaption = async (category: NarrationCategory) => {
    const current = captions[category];
    const text =
      current.activeLang === 'id'
        ? current.captionId || current.captionEn
        : current.captionEn || current.captionId;
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      const categoryLabel =
        category === 'broll' ? 'B-roll' : category === 'ugc' ? 'Content Affiliate' : 'Commercial';
      addLog('SUCCESS', t.affiliateGenerator.captionCopied.replace('{category}', categoryLabel));
      setCaptionCopyLabels((prev) => ({
        ...prev,
        [category]: t.affiliateGenerator.copiedLabel,
      }));
      setTimeout(() => {
        setCaptionCopyLabels((prev) => ({
          ...prev,
          [category]: t.affiliateGenerator.copyCaptionLabel,
        }));
      }, 1500);
    } catch {
      addLog('ERROR', t.affiliateGenerator.captionCopyFailed);
    }
  };

  const handleCopyHashtags = async (category: NarrationCategory) => {
    const current = captions[category];
    const text =
      current.activeLang === 'id'
        ? current.hashtagsId || current.hashtagsEn
        : current.hashtagsEn || current.hashtagsId;
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      const categoryLabel =
        category === 'broll' ? 'B-roll' : category === 'ugc' ? 'Content Affiliate' : 'Commercial';
      addLog('SUCCESS', t.affiliateGenerator.hashtagCopied.replace('{category}', categoryLabel));
      setHashtagCopyLabels((prev) => ({
        ...prev,
        [category]: t.affiliateGenerator.copiedLabel,
      }));
      setTimeout(() => {
        setHashtagCopyLabels((prev) => ({
          ...prev,
          [category]: t.affiliateGenerator.copyHashtagLabel,
        }));
      }, 1500);
    } catch {
      addLog('ERROR', t.affiliateGenerator.hashtagCopyFailed);
    }
  };

  const handleCopyAllTexts = async (category: NarrationCategory) => {
    const narration = narrations[category];
    const caption = captions[category];

    const narrationText =
      narration.activeLang === 'id'
        ? narration.textId || narration.textEn
        : narration.textEn || narration.textId;

    const captionText =
      caption.activeLang === 'id'
        ? caption.captionId || caption.captionEn
        : caption.captionEn || caption.captionId;

    const hashtagsText =
      caption.activeLang === 'id'
        ? caption.hashtagsId || caption.hashtagsEn
        : caption.hashtagsEn || caption.hashtagsId;

    const copyLabelMap: Record<string, { narration: string; caption: string; hashtags: string }> = {
      en: { narration: 'Narration', caption: 'Caption', hashtags: 'Hashtags' },
      id: { narration: 'Narasi', caption: 'Caption', hashtags: 'Hashtags' },
      ms: { narration: 'Narasi', caption: 'Kapsyen', hashtags: 'Hashtag' },
    };
    const cl = copyLabelMap[language] || copyLabelMap.id;

    const parts: string[] = [];
    if (narrationText) {
      parts.push(`${cl.narration}:\n${narrationText}`);
    }
    if (captionText) {
      parts.push(`${cl.caption}:\n${captionText}`);
    }
    if (hashtagsText) {
      parts.push(`${cl.hashtags}:\n${hashtagsText}`);
    }

    const finalText = parts.join('\n\n').trim();
    if (!finalText) {
      const categoryLabel =
        category === 'broll' ? 'B-roll' : category === 'ugc' ? 'Content Affiliate' : 'Commercial';
      addLog(
        'ERROR',
        t.affiliateGenerator.noTextsForCategory.replace('{category}', categoryLabel),
      );
      return;
    }

    try {
      await navigator.clipboard.writeText(finalText);
      const categoryLabel =
        category === 'broll' ? 'B-roll' : category === 'ugc' ? 'Content Affiliate' : 'Commercial';
      addLog(
        'SUCCESS',
        t.affiliateGenerator.allTextsCopied.replace('{category}', categoryLabel),
      );
    } catch {
      addLog('ERROR', t.affiliateGenerator.allTextsCopyFailed);
    }
  };

  const handlePrepareVideoPrompt = async (category: NarrationCategory) => {
    if (!authReady) {
      const message = t.logMessages.common.statusNotReady;
      setError(message);
      addLog('ERROR', message);
      return;
    }

    const narration = narrations[category];
    const caption = captions[category];

    const langLabelMap = {
        id: 'ID',
        ms: 'MY',
        en: 'EN',
      };
      const langLabel = langLabelMap[language] || langLabelMap.id;
      const activeLangLabel = narration.activeLang === 'id' ? langLabel : 'EN';
    const title =
      category === 'broll' ? 'B-roll' : category === 'ugc' ? 'Content Affiliate' : 'Commercial';

    const narrationText =
      narration.activeLang === 'id'
        ? narration.textId || narration.textEn
        : narration.textEn || narration.textId;

    const captionText =
      caption.activeLang === 'id'
        ? caption.captionId || caption.captionEn
        : caption.captionEn || caption.captionId;

    const hashtagsText =
      caption.activeLang === 'id'
        ? caption.hashtagsId || caption.hashtagsEn
        : caption.hashtagsEn || caption.hashtagsId;

    const parts: string[] = [];
    const videoLabelMap: Record<string, { adType: string; ratio: string; narrationLang: string; accent: string; productSummary: string; narration: string; caption: string; hashtags: string }> = {
      en: { adType: 'Ad type', ratio: 'Ratio', narrationLang: 'Narration language', accent: 'Voice Accent', productSummary: 'Product Summary & Concept', narration: 'Narration (voice over)', caption: 'Caption for posting', hashtags: 'Hashtags' },
      id: { adType: 'Tipe iklan', ratio: 'Rasio', narrationLang: 'Bahasa narasi', accent: 'Aksen Suara', productSummary: 'Ringkasan Produk & Konsep', narration: 'Narasi (voice over)', caption: 'Caption untuk posting', hashtags: 'Hashtags' },
      ms: { adType: 'Jenis iklan', ratio: 'Nisbah', narrationLang: 'Bahasa narasi', accent: 'Loghat Suara', productSummary: 'Ringkasan Produk & Konsep', narration: 'Narasi (suara latar)', caption: 'Kapsyen untuk posting', hashtags: 'Hashtag' },
    };
    const vl = videoLabelMap[language] || videoLabelMap.id;

    parts.push(`[Video prompt affiliate - ${title}]`);
    parts.push(`${vl.adType}: ${adType}`);
    parts.push(`${vl.ratio}: ${ratio}`);
    parts.push(`${vl.narrationLang}: ${language} (${activeLangLabel})`);
    if (accent.trim()) {
      parts.push(`${vl.accent}: ${accent.trim()}`);
    }

    if (productInfo.trim()) {
      parts.push('', `${vl.productSummary}:`, productInfo.trim());
    }

    if (narrationText) {
      parts.push('', `${vl.narration}:`, narrationText);
    }

    if (captionText) {
      parts.push('', `${vl.caption}:`, captionText);
    }

    if (hashtagsText) {
      parts.push('', `${vl.hashtags}:`, hashtagsText);
    }

    const finalText = parts.join('\n').trim();

    if (!finalText) {
      addLog(
        'ERROR',
        t.affiliateGenerator.noContentForVideoPrompt.replace('{category}', title),
      );
      return;
    }

    // Untuk VEO, gunakan versi prompt yang sangat ringkas agar tidak terlalu panjang.
    // Clipboard tetap memakai finalText penuh; hanya payload ke VEO yang dipersingkat.
    const veoParts: string[] = [];
    veoParts.push(`[Affiliate Video - ${title}]`);

    const productLabelMap: Record<string, string> = { en: 'Product', id: 'Produk', ms: 'Produk' };
    const video8secMap: Record<string, string> = {
      en: 'Professional realistic 8-second video, no text/logo/UI.',
      id: 'Video 8 detik realistis profesional, tanpa teks/logo/UI.',
      ms: 'Video 8 saat realistik profesional, tanpa teks/logo/UI.',
    };
    let compactProductInfo = '';
    if (productInfo.trim()) {
      compactProductInfo = productInfo.trim().slice(0, 120);
      veoParts.push(`${productLabelMap[language] || productLabelMap.id}: ${compactProductInfo}`);
    }

    veoParts.push(video8secMap[language] || video8secMap.id);

    // Language guard dan clean visual instruction TIDAK dimasukkan ke veoBaseCore
    // karena veoBaseCore akan dipotong ke ~220 karakter dan instruksi penting ini akan hilang.
    // Sebaliknya, kita tambahkan language guard ringkas langsung ke setiap scenePrompt.
    const compactLanguageGuardMap: Record<string, string> = {
      en: 'All spoken dialogue MUST be in English only. No other languages.',
      id: 'WAJIB: Semua dialog/ucapan dalam video HARUS 100% Bahasa Indonesia. DILARANG menggunakan bahasa Inggris.',
      ms: 'WAJIB: Semua dialog/pertuturan dalam video MESTI 100% Bahasa Melayu. DILARANG menggunakan bahasa Inggeris.',
    };
    const compactCleanVisualMap: Record<string, string> = {
      en: 'No text/subtitle/watermark/logo/UI overlay. One continuous shot, no transitions. Clean realistic footage.',
      id: 'Tanpa teks/subtitle/watermark/logo/UI. Satu shot kontinu tanpa transisi. Video realistis bersih.',
      ms: 'Tanpa teks/sari kata/tera air/logo/UI. Satu tangkapan berterusan tanpa peralihan. Video realistik bersih.',
    };
    const compactLanguageGuard = compactLanguageGuardMap[language] || compactLanguageGuardMap.id;
    const compactCleanVisual = compactCleanVisualMap[language] || compactCleanVisualMap.id;

    const veoBaseCore = veoParts.join(' ').trim();

    // Batasi panjang prompt dasar ke ~220 karakter untuk memberi ruang narasi scene + language guard.
    const veoPromptBase =
      veoBaseCore.length > 220 ? `${veoBaseCore.slice(0, 220)}...` : veoBaseCore;

    try {
      await navigator.clipboard.writeText(finalText);
      addLog(
        'SUCCESS',
        t.affiliateGenerator.videoPromptCopied.replace('{category}', title),
      );
    } catch {
      addLog('ERROR', t.affiliateGenerator.videoPromptCopyFailed);
    }

    try {
      let targetCategory: ImageCategory;
      let images: GeneratedImage[];

      if (category === 'ugc') {
        // Untuk Content Affiliate, gunakan semua gambar yang dipilih VID (lintas kategori)
        targetCategory = 'ugc';
        images = generatedImages.filter(
          (img) => img.includeInVideo !== false && img.status === 'success' && img.url,
        );
      } else {
        targetCategory = category === 'broll' ? 'broll' : 'commercial';
        images = imagesByCategory(targetCategory).filter(
          (img) => img.includeInVideo !== false && img.status === 'success' && img.url,
        );
      }

      if (images.length === 0) {
        addLog(
          'INFO',
          t.affiliateGenerator.noImagesForVideo.replace('{category}', title),
        );
        return;
      }

      if (typeof window === 'undefined' || !window.zeoAPI?.startAffiliateVideoWorkflow) {
        addLog(
          'ERROR',
          t.logMessages.common.engineNotAvailable,
        );
        return;
      }

      const bearerKey = localStorage.getItem('zeoStudio.bearerToken') || '';
      if (!bearerKey.trim()) {
        addLog('ERROR', t.logMessages.common.bearerTokenMissing);
        return;
      }

      const downloadPath = localStorage.getItem('zeoStudio.folder.output') || '';
      if (!downloadPath.trim()) {
        addLog('ERROR', t.logMessages.common.folderOutputMissing);
        return;
      }

      const settings = getVideoSettingsFromRatio();
      const veoAspect: '16:9' | '9:16' = settings.aspectRatio;

      const narrationLines = (narrationText || '')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      const scenesPayload = images
        .map((img, idx) => {
          const dataUrl = img.url || '';
          const partsUrl = dataUrl.split(',');
          if (partsUrl.length < 2) {
            return null;
          }
          const base64 = partsUrl[1];
          if (!base64.trim()) {
            return null;
          }

          const sceneScriptRaw =
            narrationLines[idx] || narrationLines[narrationLines.length - 1] || '';

          // Bersihkan tag awal seperti [Ceria], [Playful], dll sebelum dikirim ke VEO.
          const sceneScriptClean = sceneScriptRaw.replace(/^\[[^\]]+\]\s*/, '');

          // Batasi narasi per-scene agar cocok untuk durasi ~8 detik dan tidak terlalu panjang untuk VEO.
          const sceneScript = sceneScriptClean.length > 100
            ? `${sceneScriptClean.slice(0, 100)}...`
            : sceneScriptClean;

          const narrationLabelForVeo = language === 'en' ? 'Narration' : 'Narasi';
          let scenePrompt = sceneScript
            ? `${veoPromptBase} ${narrationLabelForVeo}: ${sceneScript}`
            : veoPromptBase;

          if (scenePrompt.length > 300) {
            scenePrompt = `${scenePrompt.slice(0, 300)}...`;
          }

          // Tambahkan language guard dan clean visual SETELAH pemotongan agar tidak pernah terpotong.
          scenePrompt = `${scenePrompt} ${compactLanguageGuard} ${compactCleanVisual}`;

          return {
            index: idx + 1,
            prompt: scenePrompt,
            category: targetCategory,
            imageBase64: base64,
          };
        })
        .filter((scene) => scene !== null);

      if (!scenesPayload.length) {
        addLog(
          'ERROR',
          t.affiliateGenerator.videoSceneFailed.replace('{category}', title),
        );
        return;
      }

      // Create placeholder videos immediately with loading state
      const labelMap: Record<NarrationCategory, string[]> = {
        broll: ['Macro Glide', 'Texture Close', 'Detail Sweep', 'Soft Focus'],
        ugc: ['Hook Shot', 'Smile Testi', 'Trusty Close', 'Low Doubt'],
        commercial: ['Hero Center', 'Product Stack', 'Context Scene', 'Ambient Glow'],
      };

      const placeholderVideos: VideoOutput[] = scenesPayload.map((scene, idx) => {
        const labelsForCat = labelMap[targetCategory] || [];
        const slotLabel = labelsForCat[scene.index - 1] || `${targetCategory} Scene ${scene.index}`;

        return {
          fileName: slotLabel,
          filePath: '',
          sceneIndex: scene.index,
          status: 'generating' as const,
          startedAt: Date.now(),
          estimatedTotalSeconds: 300,
          prompt: scene.prompt?.slice(0, 80) || '',
          generationMode: 'new',
        };
      });

      setVideoStates((prev) => ({
        ...prev,
        [category]: { 
          isGenerating: true, 
          outputs: placeholderVideos,
        },
      }));

      // Schedule sequential card reveal with 2s delay
      placeholderVideos.forEach((video, idx) => {
        const cardId = `video-${category}-${video.sceneIndex ?? idx}`;
        const timeout = setTimeout(() => {
          setVisibleVideoCardIds(prevVisible => new Set([...prevVisible, cardId]));
        }, idx * 2000);
        videoCardRevealTimeouts.current.push(timeout);
      });

      addLog(
        'INFO',
        t.affiliateGenerator.startingVideoGenerate.replace('{count}', String(scenesPayload.length)).replace('{category}', title).replace('{targetCategory}', targetCategory),
      );

      await window.zeoAPI.startAffiliateVideoWorkflow?.({
        bearerKey,
        downloadPath,
        aspectRatio: veoAspect,
        veoModel: settings.veoModel,
        resolution: settings.resolution,
        scenes: scenesPayload,
        category: targetCategory,
        uiLanguage: language,
      });
    } catch (error: any) {
      const message = error?.message || String(error);
      addLog('ERROR', t.affiliateGenerator.videoGenerateFailed.replace('{category}', title).replace('{message}', message));
      
      // Clear video card reveal timeouts on error
      videoCardRevealTimeouts.current.forEach(timeout => clearTimeout(timeout));
      videoCardRevealTimeouts.current = [];
      
      setVideoStates((prev) => ({
        ...prev,
        [category]: {
          ...(prev[category] || { isGenerating: false, outputs: [] }),
          isGenerating: false,
        },
      }));
    }
  };

  const imagesByCategory = (category: ImageCategory) =>
    generatedImages.filter((img) => img.category === category);

  const handleDownloadGeneratedImage = (image: GeneratedImage) => {
    if (!image.url) {
      addLog('ERROR', t.affiliateGenerator.imageNotAvailableForDownload);
      return;
    }

    const dateCode = new Date().toISOString().slice(0, 10);
    const baseNameRaw =
      image.fileName && image.fileName.trim().length > 0
        ? image.fileName.replace(/\.[a-zA-Z0-9]+$/, '')
        : `${image.category}-${dateCode}`;
    const key = `${baseNameRaw}.png`;
    const counters = downloadCountersRef.current;
    const current = counters[key] ?? 0;
    const next = current + 1;
    counters[key] = next;
    const suffix = current === 0 ? '' : `-${String(next).padStart(2, '0')}`;

    const fileName = `${baseNameRaw}${suffix}.png`;

    downloadDataUrl(image.url, fileName);
  };

  const handleRegenerateVideo = async (
    category: NarrationCategory,
    output: VideoOutput,
    extraInstruction?: string,
  ) => {
    if (!authReady) {
      const message = t.logMessages.common.statusNotReady;
      setError(message);
      addLog('ERROR', message);
      return;
    }

    const title = category === 'broll' ? 'B-Roll' : category === 'ugc' ? 'Content Affiliate' : 'Commercial';

    const narration = narrations[category];
    const narrationText =
      narration.activeLang === 'id'
        ? narration.textId || narration.textEn
        : narration.textEn || narration.textId;

    const veoParts: string[] = [];
    veoParts.push(`[Affiliate Video - ${title}]`);

    const productLabelMap2: Record<string, string> = { en: 'Product', id: 'Produk', ms: 'Produk' };
    const video8secMap2: Record<string, string> = {
      en: 'Professional realistic 8-second video, no text/logo/UI.',
      id: 'Video 8 detik realistis profesional, tanpa teks/logo/UI.',
      ms: 'Video 8 saat realistik profesional, tanpa teks/logo/UI.',
    };
    if (productInfo.trim()) {
      const compactProductInfo = productInfo.trim().slice(0, 120);
      veoParts.push(`${productLabelMap2[language] || productLabelMap2.id}: ${compactProductInfo}`);
    }

    veoParts.push(video8secMap2[language] || video8secMap2.id);

    // Language guard dan clean visual TIDAK dimasukkan ke veoBaseCore (akan terpotong).
    // Ditambahkan langsung ke scenePrompt setelah pemotongan.
    const compactLanguageGuardMap2: Record<string, string> = {
      en: 'All spoken dialogue MUST be in English only. No other languages.',
      id: 'WAJIB: Semua dialog/ucapan dalam video HARUS 100% Bahasa Indonesia. DILARANG menggunakan bahasa Inggris.',
      ms: 'WAJIB: Semua dialog/pertuturan dalam video MESTI 100% Bahasa Melayu. DILARANG menggunakan bahasa Inggeris.',
    };
    const compactCleanVisualMap2: Record<string, string> = {
      en: 'No text/subtitle/watermark/logo/UI overlay. One continuous shot, no transitions. Clean realistic footage.',
      id: 'Tanpa teks/subtitle/watermark/logo/UI. Satu shot kontinu tanpa transisi. Video realistis bersih.',
      ms: 'Tanpa teks/sari kata/tera air/logo/UI. Satu tangkapan berterusan tanpa peralihan. Video realistik bersih.',
    };
    const compactLanguageGuard2 = compactLanguageGuardMap2[language] || compactLanguageGuardMap2.id;
    const compactCleanVisual2 = compactCleanVisualMap2[language] || compactCleanVisualMap2.id;

    const veoBaseCore = veoParts.join(' ').trim();
    const veoPromptBase =
      veoBaseCore.length > 220 ? `${veoBaseCore.slice(0, 220)}...` : veoBaseCore;

    let targetCategory: ImageCategory;
    let images: GeneratedImage[];

    if (category === 'ugc') {
      targetCategory = 'ugc';
      images = generatedImages.filter(
        (img) => img.includeInVideo !== false && img.status === 'success' && img.url,
      );
    } else {
      targetCategory = category === 'broll' ? 'broll' : 'commercial';
      images = imagesByCategory(targetCategory).filter(
        (img) => img.includeInVideo !== false && img.status === 'success' && img.url,
      );
    }

    if (images.length === 0) {
      addLog(
        'INFO',
        t.affiliateGenerator.noImagesForRegenerate.replace('{category}', title),
      );
      return;
    }

    const rawSceneIndex =
      typeof output.sceneIndex === 'number' && output.sceneIndex > 0
        ? output.sceneIndex
        : 1;
    const sceneIndex = Math.min(Math.max(rawSceneIndex, 1), images.length);
    const imageIndex = sceneIndex - 1;
    const sourceImage = images[imageIndex];

    if (!sourceImage || !sourceImage.url) {
      addLog('ERROR', t.affiliateGenerator.sourceImageNotFound);
      return;
    }

    const partsUrl = sourceImage.url.split(',');
    if (partsUrl.length < 2 || !partsUrl[1].trim()) {
      addLog('ERROR', t.affiliateGenerator.sourceImageInvalid);
      return;
    }
    const base64 = partsUrl[1];

    const narrationLines = (narrationText || '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const sceneScriptRaw =
      narrationLines[imageIndex] || narrationLines[narrationLines.length - 1] || '';
    const sceneScriptClean = sceneScriptRaw.replace(/^\[[^\]]+\]\s*/, '');
    const sceneScript =
      sceneScriptClean.length > 100
        ? `${sceneScriptClean.slice(0, 100)}...`
        : sceneScriptClean;

    const narrationLabelForVeo2 = language === 'en' ? 'Narration' : 'Narasi';
    let scenePrompt = sceneScript ? `${veoPromptBase} ${narrationLabelForVeo2}: ${sceneScript}` : veoPromptBase;

    const extraTrimmed = extraInstruction?.trim() || '';
    if (extraTrimmed) {
      const extraLabelMap: Record<string, string> = { en: 'Additional instructions', id: 'Instruksi tambahan', ms: 'Arahan tambahan' };
      scenePrompt = `${scenePrompt} ${extraLabelMap[language] || extraLabelMap.id}: ${extraTrimmed}`;
    }

    if (scenePrompt.length > 300) {
      scenePrompt = `${scenePrompt.slice(0, 300)}...`;
    }

    // Tambahkan language guard dan clean visual SETELAH pemotongan agar tidak pernah terpotong.
    scenePrompt = `${scenePrompt} ${compactLanguageGuard2} ${compactCleanVisual2}`;

    if (typeof window === 'undefined' || !window.zeoAPI?.startAffiliateVideoWorkflow) {
      addLog(
        'ERROR',
        t.affiliateGenerator.videoEngineUnavailable,
      );
      return;
    }

    const bearerKey = localStorage.getItem('zeoStudio.bearerToken') || '';
    if (!bearerKey.trim()) {
      addLog('ERROR', t.affiliateGenerator.bearerTokenMissing);
      return;
    }

    const downloadPath = localStorage.getItem('zeoStudio.folder.output') || '';
    if (!downloadPath.trim()) {
      addLog('ERROR', t.affiliateGenerator.outputFolderMissing);
      return;
    }

    const settings = getVideoSettingsFromRatio();
    const veoAspect: '16:9' | '9:16' = settings.aspectRatio;

    setVideoStates((prev) => {
      const existing = prev[category] || { isGenerating: false, outputs: [] };
      const outputs = existing.outputs || [];
      const updatedOutputs = outputs.map((o) =>
        o.sceneIndex === output.sceneIndex
          ? {
              ...o,
              status: 'generating' as const,
              startedAt: Date.now(),
              estimatedTotalSeconds: 300,
              generationMode: 'regen',
              errorMessage: undefined,
            }
          : o,
      );

      return {
        ...prev,
        [category]: {
          ...existing,
          isGenerating: true,
          outputs: updatedOutputs,
        },
      };
    });

    addLog(
      'INFO',
      t.affiliateGenerator.startingRegenerate.replace('{scene}', String(sceneIndex)).replace('{category}', title),
    );

    try {
      await window.zeoAPI.startAffiliateVideoWorkflow?.({
        bearerKey,
        downloadPath,
        aspectRatio: veoAspect,
        veoModel: settings.veoModel,
        resolution: settings.resolution,
        scenes: [
          {
            index: sceneIndex,
            prompt: scenePrompt,
            category: targetCategory,
            imageBase64: base64,
          },
        ],
        category: targetCategory,
        uiLanguage: language,
      });
    } catch (error: any) {
      const message = error?.message || String(error);
      addLog('ERROR', t.affiliateGenerator.regenerateFailed.replace('{category}', title).replace('{message}', message));
      setVideoStates((prev) => ({
        ...prev,
        [category]: {
          ...(prev[category] || { isGenerating: false, outputs: [] }),
          isGenerating: false,
        },
      }));
    }
  };

  const handleOpenVideoEditModal = (category: NarrationCategory, output: VideoOutput) => {
    setVideoEditModal({
      isOpen: true,
      category,
      sceneIndex:
        typeof output.sceneIndex === 'number' && output.sceneIndex > 0 ? output.sceneIndex : 1,
      fileName: output.fileName,
      filePath: output.filePath,
      instruction: '',
      isSubmitting: false,
    });
  };

  const handleCloseVideoEditModal = () => {
    setVideoEditModal((prev) => ({ ...prev, isOpen: false, isSubmitting: false }));
  };

  const handleApplyVideoEdit = async () => {
    const { category, sceneIndex, filePath, instruction } = videoEditModal;
    if (!category || !sceneIndex || !filePath) {
      return;
    }

    const trimmed = instruction.trim();
    if (!trimmed) {
      addLog('ERROR', t.logMessages.affiliate.editInstructionEmpty);
      return;
    }

    const outputs = videoStates[category]?.outputs || [];
    const targetOutput =
      outputs.find((o) => o.filePath === filePath) ||
      outputs.find((o) => o.sceneIndex === sceneIndex) ||
      null;

    if (!targetOutput) {
      addLog('ERROR', t.affiliateGenerator.videoDataNotFound);
      return;
    }

    setVideoEditModal((prev) => ({ ...prev, isSubmitting: true }));

    await handleRegenerateVideo(category, targetOutput, trimmed);

    setVideoEditModal({
      isOpen: false,
      category: null,
      sceneIndex: null,
      fileName: '',
      filePath: '',
      instruction: '',
      isSubmitting: false,
    });
  };

  const renderNarrationCaptionCard = (category: NarrationCategory) => {
    const narration = narrations[category];
    const caption = captions[category];
    const langLabel = language === 'ms' ? 'MY' : 'ID';
    const title = category === 'broll' ? 'B-Roll' : category === 'ugc' ? 'Content Affiliate' : 'Commercial';

    const narrationDisplayText =
      narration.activeLang === 'id'
        ? narration.textId || narration.textEn
        : narration.textEn || narration.textId;

    const captionDisplayText =
      caption.activeLang === 'id'
        ? caption.captionId || caption.captionEn
        : caption.captionEn || caption.captionId;

    const hashtagsDisplayText =
      caption.activeLang === 'id'
        ? caption.hashtagsId || caption.hashtagsEn
        : caption.hashtagsEn || caption.hashtagsId;

    const narrationLinesForDisplay = (narrationDisplayText || '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const sceneCount = narrationLinesForDisplay.length;

    const successfulImagesForCategory = imagesByCategory(category as ImageCategory).filter(
      (img) => img.status === 'success' && img.url,
    );
    const imageCountForCategory = successfulImagesForCategory.length;
    const sceneSelectorVisible = sceneCount > 1 || imageCountForCategory > 1;
    const sceneOptionsCount = sceneSelectorVisible
      ? Math.max(sceneCount || 1, imageCountForCategory || 1)
      : sceneCount;

    const isPreviewLocked = generatedImages.length === 0;
    const isVideoGenerating = videoStates[category]?.isGenerating;
    const currentVideoSettings = getVideoSettingsFromRatio();
    const videoOutputs = videoStates[category]?.outputs || [];

    if (isPreviewLocked) {
      return (
        <div className="mt-4 text-[11px] text-gray-500 italic">
          {t.affiliateGenerator.narrationCardLocked}
        </div>
      );
    }

    return (
      <div className="mt-4 p-4 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs space-y-4">
        {/* Narration & Caption Section */}
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-purple-300">
              {t.affiliateGenerator.narrationCardTitle.replace('{category}', title)}
            </h4>
            <p className="text-[11px] text-gray-400">
              {t.affiliateGenerator.narrationCardDesc}
            </p>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-3">
          {/* Narration Controls */}
          <button
            type="button"
            onClick={() => handleGenerateNarration(category)}
            disabled={narration.isGenerating || !authReady}
            className={`w-full py-2 px-3 rounded-lg text-white font-semibold text-[11px] flex items-center justify-center transition-all duration-200 btn-glass-primary
              focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-zinc-900
              ${
                narration.isGenerating || !authReady
                  ? 'bg-zinc-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
              }`}
          >
            {narration.isGenerating
              ? category === 'ugc'
                ? t.affiliateGenerator.creatingScript
                : t.affiliateGenerator.creatingNarration
              : category === 'ugc'
              ? t.affiliateGenerator.createScript
              : t.affiliateGenerator.createNarration}
          </button>

          <div className="p-2 rounded-lg bg-zinc-900/80 border border-purple-500/40 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-purple-300">{t.affiliateGenerator.narration}</span>
            </div>

            <textarea
              rows={5}
              value={narrationDisplayText}
              onChange={(e) => handleNarrationTextChange(category, e.target.value)}
              placeholder={t.affiliateGenerator.narrationPlaceholder}
              className="w-full p-2 border border-zinc-700 bg-zinc-900 rounded-lg text-gray-200 text-[11px] resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
            />

            <div className="mt-1 space-y-1">
              <label className="block text-[11px] text-gray-300">{t.affiliateGenerator.selectVoice}</label>
              <select
                value={narration.selectedVoiceId}
                onChange={(e) => handleVoiceChange(category, e.target.value)}
                className="w-full p-1.5 border border-zinc-700 bg-zinc-900 rounded-md text-[11px] text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
              >
                {TTS_VOICES.map((voice) => (
                  <option
                    key={voice.id}
                    value={voice.id}
                  >{`(${voice.gender}) ${voice.name} - ${voice.tone}`}</option>
                ))}
              </select>
            </div>

            <div className="mt-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 flex flex-col gap-1 text-[11px] text-gray-200">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handlePlayNarration(category)}
                  className="px-3 py-1.5 rounded-md text-[11px] font-semibold text-white flex items-center justify-center transition-all duration-200 btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
                >
                  {narration.isPlaying ? t.affiliateGenerator.pause : t.affiliateGenerator.play}
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadNarrationAudio(category)}
                  disabled={!narration.audioUrl}
                  className="px-2 py-1 rounded-md border border-zinc-600 text-[10px] text-gray-200 hover:bg-zinc-800 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {t.affiliateGenerator.downloadAudio}
                </button>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="w-10 text-[10px] tabular-nums text-gray-400">
                  {narrationAudioStatus.category === category
                    ? `${Math.floor(narrationAudioStatus.currentTime / 60)
                        .toString()
                        .padStart(2, '0')}:${Math.floor(narrationAudioStatus.currentTime % 60)
                        .toString()
                        .padStart(2, '0')}`
                    : '00:00'}
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={
                    narrationAudioStatus.category === category && narrationAudioStatus.duration > 0
                      ? (narrationAudioStatus.currentTime / narrationAudioStatus.duration) * 100
                      : 0
                  }
                  onChange={(e) => handleSeekNarrationAudio(category, Number(e.target.value) || 0)}
                  className="flex-1 accent-purple-500 cursor-pointer"
                />
                <span className="w-10 text-[10px] tabular-nums text-gray-400 text-right">
                  {narrationAudioStatus.category === category && narrationAudioStatus.duration > 0
                    ? `${Math.floor(narrationAudioStatus.duration / 60)
                        .toString()
                        .padStart(2, '0')}:${Math.floor(narrationAudioStatus.duration % 60)
                        .toString()
                        .padStart(2, '0')}`
                    : '00:00'}
                </span>
              </div>
            </div>
          </div>

          {/* Video */}
          <div
            className={`mt-3 p-2 rounded-lg bg-zinc-900/80 border border-purple-500/40 space-y-2 ${
              isPreviewLocked ? 'hidden' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-purple-300">{t.affiliateGenerator.videoAffiliateLabel}</span>
            </div>
            <div className="mt-2 text-[11px] text-gray-400 space-y-1">
              <p>{t.affiliateGenerator.videoConfigIntro}</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>{t.affiliateGenerator.videoConfigAspect.replace('{ratio}', currentVideoSettings.aspectRatio)}</li>
                <li>{t.affiliateGenerator.videoConfigModel}</li>
                <li>{t.affiliateGenerator.videoConfigResolution.replace('{resolution}', currentVideoSettings.resolution)}</li>
              </ul>
              <p className="italic text-[10px] text-gray-500">
                {t.affiliateGenerator.videoConfigNote}
              </p>
            </div>

            <button
              type="button"
              onClick={() => handlePrepareVideoPrompt(category)}
              disabled={isPreviewLocked || isVideoGenerating || !authReady}
              className={`mt-2 w-full py-1.5 px-2 rounded-lg text-[11px] font-semibold text-white flex items-center justify-center transition-all duration-200 btn-glass-primary
                focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-zinc-900
                ${
                  isVideoGenerating || !authReady
                    ? 'bg-zinc-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
                }`}
            >
              {!authReady
                ? t.affiliateGenerator.testTokenFirst
                : isVideoGenerating
                ? t.affiliateGenerator.generatingVideo
                : t.affiliateGenerator.generateVideo}
            </button>


            {!isVideoGenerating && videoOutputs.length === 0 && (
              <div className="mt-2 flex items-center justify-center bg-zinc-950/40 rounded-lg min-h-[220px] mb-4 text-gray-500 text-center text-xs p-4">
                <p>
                  {t.affiliateGenerator.videoPreviewEmpty}{' '}
                  <span className="font-semibold text-gray-300">
                    {t.affiliateGenerator.generateVideo} {title}
                  </span>
                  .
                </p>
              </div>
            )}

            {(isVideoGenerating || videoOutputs.length > 0) && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-[11px] text-gray-300">
                  <span className="font-semibold">{t.affiliateGenerator.videoPreviewLabel}</span>
                  <span className="text-[10px] text-gray-500">
                    {videoOutputs.length > 0
                      ? t.affiliateGenerator.videoFilesSaved.replace('{count}', String(videoOutputs.length))
                      : t.affiliateGenerator.noVideos}
                  </span>
                </div>

                {!isVideoGenerating && videoOutputs.length > 0 && (
                  <p className="text-[10px] text-amber-300">
                    {t.affiliateGenerator.videoGenerationCompleted}
                  </p>
                )}

                {videoOutputs.length > 0 && (
                  <div
                    className={`grid gap-3 mt-1 text-[11px] ${
                      ratio === 'landscape' ? 'grid-cols-2' : 'grid-cols-4'
                    }`}
                  >
                    {videoOutputs.map((output, index) => {
                      const videoUrl = getVideoFileUrl(output.filePath);
                      const isGenerating = output.status === 'generating';
          const isFailed = output.status === 'failed';
          const countdownMsg = getCountdownMessageForVideo(output);
                      const cardId = `video-${category}-${output.sceneIndex ?? index}`;
                      const isVisible = visibleVideoCardIds.has(cardId) || output.status === 'completed' || output.status === 'failed';
                      
                      return (
                        <div key={`${output.sceneIndex}-${index}`} className={`relative group transition-all duration-500 ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
                          {!isGenerating && videoUrl && (
                            <div className="absolute top-1.5 right-1.5 z-10 flex gap-1.5 items-center justify-end">
                              <button
                                type="button"
                                className="h-7 px-3 rounded-md text-[10px] font-semibold flex items-center justify-center border transition-all duration-200 btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 border-purple-300/80 text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
                                title="Video ini dibuat dari gambar Affiliate"
                              >
                                VID
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!isVideoGenerating) {
                                    void handleRegenerateVideo(category, output);
                                  }
                                }}
                                disabled={isVideoGenerating}
                                className="text-[10px] px-2 py-1 rounded-md bg-zinc-900/80 hover:bg-zinc-800 text-gray-100 border border-zinc-700 disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                {isVideoGenerating ? t.affiliateGenerator.regenerating : t.affiliateGenerator.regenerateBtn}
                              </button>
                            </div>
                          )}
                          <div
                            style={{
                              aspectRatio:
                                ratio === 'landscape'
                                  ? '16 / 9'
                                  : ratio === 'square'
                                  ? '1 / 1'
                                  : '9 / 16',
                            }}
                            className={`relative w-full rounded-lg border overflow-hidden ${
                              isFailed ? 'border-red-500/60 bg-red-950/20' : 'border-zinc-700 bg-black'
                            }`}
                          >
                            {isGenerating ? (
                              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-100">
                                <img
                                  src={getLoadingGifByIndex(index)}
                                  alt="Loading video"
                                  className="absolute inset-0 w-full h-full object-cover opacity-60"
                                />
                                <div className="absolute inset-0 bg-black/60" />
                                <div className="relative z-10 flex flex-col items-center text-center px-3">
                                  {countdownMsg && (
                                    <div className="text-sm text-purple-300 font-bold">{countdownMsg}</div>
                                  )}
                                  <div className="mt-1 text-[10px] text-gray-200 px-2 text-center line-clamp-2">
                                    {output.generationMode === 'regen'
                                      ? 'Regenerating Video...'
                                      : 'Generating Video...'}
                                  </div>
                                </div>
                              </div>
                            ) : isFailed ? (
                              <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/40 text-red-300">
                                <div className="text-2xl mb-2">⚠️</div>
                                <div className="text-xs font-semibold">Failed</div>
                                {output.errorMessage && (
                                  <div className="mt-1 text-[10px] text-red-400 px-2 text-center">
                                    {output.errorMessage}
                                  </div>
                                )}
                              </div>
                            ) : videoUrl ? (
                              <video
                                className="w-full h-full object-cover"
                                src={`${videoUrl}#t=0.5`}
                                controls
                                preload="metadata"
                              />
                            ) : null}
                          </div>
                          <p
                            className={`mt-1 text-[10px] truncate ${
                              isFailed ? 'text-red-400' : isGenerating ? 'text-blue-300' : 'text-emerald-300'
                            }`}
                            title={output.fileName || `Scene ${output.sceneIndex}`}
                          >
                            {output.fileName || `Scene ${output.sceneIndex} - ${isGenerating ? 'Generating...' : 'Failed'}`}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Caption & Hashtag */}
          <div
            className={`mt-3 p-2 rounded-lg bg-zinc-900/80 border border-purple-500/40 space-y-2 ${
              isPreviewLocked ? 'hidden' : ''
            }`}
          >
            <button
              type="button"
              onClick={() => handleGenerateCaption(category)}
              disabled={caption.isGenerating || !authReady}
              className={`w-full py-2 px-3 rounded-lg text-white font-semibold text-[11px] flex items-center justify-center transition-all duration-200 btn-glass-primary
                focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-zinc-900
                ${
                  caption.isGenerating || !authReady
                    ? 'bg-zinc-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
                }`}
            >
              {caption.isGenerating ? t.affiliateGenerator.generatingCaption : t.affiliateGenerator.generateCaption}
            </button>

            {(caption.captionId || caption.captionEn) && (
              <div className="mt-2 space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-purple-300">Caption &amp; Hashtags</span>
                </div>

                <div>
                  <label className="block text-[11px] text-gray-300 mb-1">{t.affiliateGenerator.caption}</label>
                  <textarea
                    rows={4}
                    value={captionDisplayText}
                    onChange={(e) => handleCaptionTextChange(category, e.target.value)}
                    className="w-full p-2 border border-zinc-700 bg-zinc-900 rounded-lg text-gray-200 text-[11px] resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-gray-300 mb-1">{t.affiliateGenerator.hashtags}</label>
                  <textarea
                    rows={3}
                    value={hashtagsDisplayText}
                    onChange={(e) => handleHashtagsTextChange(category, e.target.value)}
                    className="w-full p-2 border border-zinc-700 bg-zinc-900 rounded-lg text-gray-200 text-[11px] resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => handleCopyCaption(category)}
                    className="w-full bg-zinc-800 text-gray-100 font-semibold py-1 px-2 rounded-md text-[11px] border border-zinc-700 hover:bg-zinc-700 transition-colors duration-200"
                  >
                    {captionCopyLabels[category]}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyHashtags(category)}
                    className="w-full bg-zinc-800 text-gray-100 font-semibold py-1 px-2 rounded-md text-[11px] border border-zinc-700 hover:bg-zinc-700 transition-colors duration-200"
                  >
                    {hashtagCopyLabels[category]}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyAllTexts(category)}
                  className="mt-2 w-full bg-purple-600 text-white font-semibold py-1 px-2 rounded-lg text-[11px] hover:bg-purple-700 transition-colors duration-200"
                >
                  {t.affiliateGenerator.copyAllTexts}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const enabledCategories = React.useMemo(
    () =>
      (['broll', 'ugc', 'commercial'] as ImageCategory[]).filter(
        (_cat, idx) => enabledAffiliateLabels[idx],
      ),
    [enabledAffiliateLabels],
  );
  const totalAffiliateSlots = enabledCategories.length * AFFILIATE_IMAGE_BATCH_SIZE || 0;
  const totalAffiliateBatches =
    totalAffiliateSlots > 0 ? Math.ceil(totalAffiliateSlots / AFFILIATE_IMAGE_BATCH_SIZE) : 0;
  const hasGeneratedAnyAffiliate = generatedImages.length > 0;
  
  const canGenerateNextAffiliateBatch =
    hasGeneratedAnyAffiliate &&
    totalAffiliateSlots > 0 &&
    nextAffiliateImageIndex < totalAffiliateSlots &&
    !isGenerating;
  const nextAffiliateBatchIndex =
    nextAffiliateImageIndex > 0
      ? Math.floor(nextAffiliateImageIndex / AFFILIATE_IMAGE_BATCH_SIZE) + 1
      : 1;

  const performFullReset = () => {
    // Hentikan audio yang sedang diputar
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
    }
    audioRef.current = null;

    // Bersihkan file produk & preview
    if (productPreviewUrl) {
      URL.revokeObjectURL(productPreviewUrl);
    }
    setProductFile(null);
    setProductPreviewUrl(null);
    setProductInfo('');

    // Bersihkan foto model & preview
    models.forEach((m) => {
      if (m.previewUrl) URL.revokeObjectURL(m.previewUrl);
    });
    setModels([]);
    setModelStyle('');
    setPoseDescription('');

    // Bersihkan foto produk tambahan
    additionalPhotos.forEach((p) => {
      if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
    });
    setAdditionalPhotos([]);

    // Reset parameter ringan
    setAiGender('auto');
    setAiAge('Remaja');
    setAiHijab(false);
    setAccent('');
    setRatio('portrait');
    setAdType('softselling');
    setFileInputResetKey(Date.now());
    setIsGenerateButtonLocked(false);
    setIsRecommending(false);

    setIsGenerating(false);
    setGeneratedImages([]);
    setSelectedImage(null);
    setVisibleCardIds(new Set());
    setVisibleVideoCardIds(new Set());
    
    // Clear timeouts
    cardRevealTimeouts.current.forEach(timeout => clearTimeout(timeout));
    cardRevealTimeouts.current = [];
    videoCardRevealTimeouts.current.forEach(timeout => clearTimeout(timeout));
    videoCardRevealTimeouts.current = [];

    setAffiliateEditModal({
      isOpen: false,
      image: null,
      instruction: '',
      isSubmitting: false,
    });

    setVideoEditModal({
      isOpen: false,
      category: null,
      sceneIndex: null,
      fileName: '',
      filePath: '',
      instruction: '',
      isSubmitting: false,
    });

    setNextAffiliateImageIndex(0);

    setVideoStates({
      broll: { isGenerating: false, outputs: [] },
      ugc: { isGenerating: false, outputs: [] },
      commercial: { isGenerating: false, outputs: [] },
    });

    setNarrations({
      broll: createDefaultNarrationState(),
      ugc: createDefaultNarrationState(),
      commercial: createDefaultNarrationState(),
    });

    setCaptions({
      broll: createDefaultCaptionState(),
      ugc: createDefaultCaptionState(),
      commercial: createDefaultCaptionState(),
    });

    setNarrationAudioStatus({ category: null, isPlaying: false, currentTime: 0, duration: 0 });

    setActivityLogs([]);
    setActivityLogCopyLabel(t.affiliateGenerator.copyLog);
    setError(null);
    
    // Reset label selections and index
    setEnabledAffiliateLabels(Array(AFFILIATE_LABEL_GROUPS.length).fill(true));
    setNextAffiliateImageIndex(0);
  };

  const isAnyVideoGenerating =
    videoStates.broll.isGenerating || videoStates.ugc.isGenerating || videoStates.commercial.isGenerating;

  const handleFullReset = () => {
    if (isGenerating || isAnyVideoGenerating) return;
    setIsResetConfirmOpen(true);
  };

  const handleConfirmReset = () => {
    setIsResetConfirmOpen(false);
    if (isGenerating || isAnyVideoGenerating) return;
    performFullReset();
  };

  return (
    <>
      {videoEditModal.isOpen && videoEditModal.category && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-gray-100">{t.affiliateGenerator.videoEditTitle}</h3>
              <button
                type="button"
                onClick={videoEditModal.isSubmitting ? undefined : handleCloseVideoEditModal}
                className="text-[18px] text-gray-400 hover:text-gray-100 px-1 disabled:opacity-40"
                disabled={videoEditModal.isSubmitting}
              >
                ×
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="space-y-1">
                <div className="text-[11px] text-gray-400 truncate">
                  {videoEditModal.fileName}
                </div>
                <div className="text-[10px] text-purple-300">
                  {t.affiliateGenerator.videoEditSceneCategory
                    .replace('{scene}', String(videoEditModal.sceneIndex ?? 1))
                    .replace('{category}',
                      videoEditModal.category === 'broll'
                        ? t.affiliateGenerator.categoryBroll
                        : videoEditModal.category === 'ugc'
                        ? t.affiliateGenerator.categoryUgc
                        : t.affiliateGenerator.categoryCommercial
                    )}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-gray-200">{t.affiliateGenerator.videoEditInstructionLabel}</div>
                <textarea
                  value={videoEditModal.instruction}
                  onChange={(e) =>
                    setVideoEditModal((prev) => ({
                      ...prev,
                      instruction: e.target.value,
                    }))
                  }
                  placeholder={t.affiliateGenerator.editPlaceholder}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg text-xs text-gray-100 px-3 py-2 min-h-[96px] resize-none focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
                <p className="text-[10px] text-gray-500">
                  {t.affiliateGenerator.videoEditNote}
                </p>
              </div>
            </div>
            <div className="px-4 pb-4 pt-2">
              <button
                type="button"
                onClick={() => void handleApplyVideoEdit()}
                disabled={videoEditModal.isSubmitting || !authReady}
                className="w-full btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-xs font-semibold py-2.5 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {videoEditModal.isSubmitting ? t.affiliateGenerator.processingEdit : t.affiliateGenerator.processEdit}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="h-full w-full flex flex-col min-h-0 text-gray-50">
        <PageHeader
          iconId="generate-affiliate"
          iconClassName="h-6 w-6 mr-3 text-white"
          title={t.affiliateGenerator.title}
          description={t.affiliateGenerator.description}
          tutorialUrl={AFFILIATE_TUTORIAL_URL}
          tutorialTitle="Tutorial Generate Affiliate"
          tutorialMode="direct"
        />

      <div className="flex-1 p-4 lg:p-6 min-h-0 overflow-hidden">
        <div className="flex h-full min-w-0 gap-4">
          {/* Left Panel: Parameters */}
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
                <h2 className="text-sm font-semibold text-gray-100 mb-3">{t.affiliateGenerator.uploadCharacterPhoto}</h2>
                <p className="text-xs text-gray-400 mb-4">
                  {t.affiliateGenerator.uploadCharacterDesc}
                </p>
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                  <div
                    onClick={() => document.getElementById('affiliate-character-input')?.click()}
                    className="w-28 h-28 bg-zinc-950 rounded-lg border-2 border-dashed border-zinc-700 flex items-center justify-center text-center text-gray-400 text-[11px] cursor-pointer hover:border-purple-500 transition shrink-0"
                  >
                    {hasAnyModelImage && models.find((m) => m.previewUrl) ? (
                      <img
                        src={models.find((m) => m.previewUrl)?.previewUrl || ''}
                        alt="Preview Karakter"
                        className="w-full h-full object-cover rounded-md"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xl">👤</span>
                        <span>{t.affiliateGenerator.clickToUpload}</span>
                      </div>
                    )}
                  </div>
                  <input
                    id="affiliate-character-input"
                    type="file"
                    accept="image/*"
                    onChange={handlePrimaryCharacterFileChange}
                    className="hidden"
                  />
                  <div className="flex-grow flex flex-col gap-2 w-full">
                    {hasAnyModelImage && (
                      <button
                        type="button"
                        onClick={() => {
                          setModels([]);
                          setModelStyle('');
                          setIsAnalyzingModelStyle(false);
                        }}
                        className="w-full bg-zinc-700 hover:bg-zinc-600 text-white text-xs py-1.5 px-3 rounded-lg transition"
                      >
                        {t.affiliateGenerator.deleteCharacterPhoto}
                      </button>
                    )}
                    {isAnalyzingModelStyle && (
                      <div className="mt-1 text-[11px] text-purple-300 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                        <span>{t.affiliateGenerator.analyzingCharacter}</span>
                      </div>
                    )}
                    {!isAnalyzingModelStyle && (
                      <div className="mt-2 w-full">
                        <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                          {t.affiliateGenerator.characterAnalysis}
                        </label>
                        <textarea
                          rows={3}
                          value={modelStyle}
                          onChange={(e) => setModelStyle(e.target.value)}
                          className="w-full bg-zinc-950 rounded-lg px-3 py-2 text-[11px] text-gray-200 border border-zinc-700 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-y"
                          placeholder={t.affiliateGenerator.characterPlaceholder}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Unggah Foto Produk */}
              <div className="p-4 rounded-lg bg-zinc-900/80 border border-zinc-800">
                <h2 className="text-sm font-semibold text-gray-100 mb-3">{t.affiliateGenerator.uploadProductPhoto}</h2>
                <p className="text-xs text-gray-400 mb-4">
                  {t.affiliateGenerator.uploadProductDesc}
                </p>

                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  <div
                    onClick={() => document.getElementById('affiliate-product-input')?.click()}
                    className="w-28 h-28 bg-zinc-950 rounded-lg border-2 border-dashed border-zinc-700 flex items-center justify-center text-center text-gray-400 text-[11px] cursor-pointer hover:border-purple-500 transition shrink-0"
                  >
                    {productPreviewUrl ? (
                      <img
                        src={productPreviewUrl}
                        alt="Preview Produk"
                        className="w-full h-full object-cover rounded-md"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xl">📦</span>
                        <span>{t.affiliateGenerator.clickToUpload}</span>
                      </div>
                    )}
                  </div>
                  <input
                    key={fileInputResetKey}
                    id="affiliate-product-input"
                    type="file"
                    accept="image/*"
                    onChange={handleProductChange}
                    className="hidden"
                  />
                  <div className="flex-grow flex flex-col gap-2 w-full">
                    {productPreviewUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          if (productPreviewUrl) {
                            URL.revokeObjectURL(productPreviewUrl);
                          }
                          setProductPreviewUrl(null);
                          setProductFile(null);
                          setProductInfo('');
                          setIsRecommending(false);
                          addLog('INFO', t.logMessages.affiliate.photoRemoved);
                        }}
                        className="w-full bg-zinc-700 hover:bg-zinc-600 text-white text-xs py-1.5 px-3 rounded-lg transition"
                      >
                        {t.affiliateGenerator.deleteProductPhoto}
                      </button>
                    )}
                    {isRecommending && productFile ? (
                      <div className="mt-2 w-full text-[11px] text-purple-300 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                        <span>{t.affiliateGenerator.analyzingProduct}</span>
                      </div>
                    ) : (
                      <div className="mt-2 w-full">
                        <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                          {t.affiliateGenerator.productAnalysis}
                        </label>
                        <textarea
                          id="product-info-input"
                          rows={3}
                          value={productInfo}
                          onChange={(e) => setProductInfo(e.target.value)}
                          placeholder={t.affiliateGenerator.productPlaceholder}
                          className="w-full bg-zinc-950 rounded-lg px-3 py-2 text-[11px] text-gray-200 border border-zinc-700 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-y"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Fitur Foto Produk Pendukung dihapus: hanya gunakan satu foto produk utama sebagai referensi. */}
              </div>

              {/* Rasio, Tipe Iklan, Bahasa & Aksen + Generate & Activity Log */}
              <div className="p-4 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-4">
                <div>
                  <p className="block text-gray-300 font-semibold text-xs mb-1">{t.affiliateGenerator.imageRatio}</p>
                  <div className="flex rounded-lg border border-zinc-700 overflow-hidden bg-zinc-800">
                    {([
                      { key: 'portrait' as const, label: t.affiliateGenerator.portraitOption },
                      { key: 'landscape' as const, label: t.affiliateGenerator.landscapeOption },
                    ]).map((item) => {
                      const isActive = ratio === item.key;
                      return (
                        <button
                          type="button"
                          key={item.key}
                          onClick={() => setRatio(item.key)}
                          className={`flex-1 px-4 py-2 text-center transition-all duration-200 text-xs font-semibold border-r border-zinc-700 last:border-r-0
                            ${isActive
                              ? 'bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 text-white shadow-inner'
                              : 'text-gray-300 hover:bg-zinc-700'}
                          `}
                          aria-pressed={isActive}
                        >
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="block text-gray-300 font-semibold text-xs mb-1">{t.affiliateGenerator.adTypeLabel}</p>
                  <select
                    id="ad-type-select"
                    value={adType}
                    onChange={(e) => setAdType(e.target.value as typeof adType)}
                    className="w-full p-2 border border-zinc-700 bg-zinc-800 rounded-lg text-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                  >
                    <option value="softselling">{t.affiliateGenerator.adTypeSoftselling}</option>
                    <option value="hardselling">{t.affiliateGenerator.adTypeHardselling}</option>
                    <option value="storytelling">{t.affiliateGenerator.adTypeStorytelling}</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <p className="block text-gray-300 font-semibold text-xs mb-1">{t.affiliateGenerator.styleSettings}</p>
                  <div>
                    <label
                      htmlFor="accent-input"
                      className="block text-gray-400 font-medium text-[11px] mb-1"
                    >
                      {t.affiliateGenerator.accent}
                    </label>
                    <input
                      id="accent-input"
                      type="text"
                      value={accent}
                      onChange={(e) => setAccent(e.target.value)}
                      placeholder={t.affiliateGenerator.accentPlaceholder}
                      className="w-full p-2 border border-zinc-700 bg-zinc-800 rounded-lg text-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="block text-xs font-semibold text-gray-300">{t.affiliateGenerator.angleGroupsLabel || 'Affiliate Style Groups'}</span>
                    <div className="flex items-center gap-1 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setEnabledAffiliateLabels(Array(AFFILIATE_LABEL_GROUPS.length).fill(true))}
                        className="px-2 py-1 rounded-md border border-zinc-600 text-gray-200 hover:bg-zinc-800"
                      >
                        {t.affiliateGenerator.selectAllBtn}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEnabledAffiliateLabels(Array(AFFILIATE_LABEL_GROUPS.length).fill(false))}
                        className="px-2 py-1 rounded-md border border-zinc-600 text-gray-200 hover:bg-zinc-800"
                      >
                        {t.affiliateGenerator.clearBtn}
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500 mb-2">
                    {t.affiliateGenerator.styleGroupsDesc}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {AFFILIATE_LABEL_GROUPS.map((group, idx) => {
                      const isActive = enabledAffiliateLabels[idx];
                      return (
                        <button
                          key={group.id}
                          type="button"
                          onClick={() => {
                            setEnabledAffiliateLabels((prev) => {
                              const next = [...prev];
                              next[idx] = !next[idx];
                              return next;
                            });
                          }}
                          className={`flex items-start justify-start gap-2 px-3 py-2 rounded-lg text-left text-[11px] font-medium border transition-all duration-200
                            bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700
                            ${
                              isActive
                                ? 'text-white border-transparent shadow-lg shadow-purple-500/30 ring-2 ring-purple-200/70'
                                : 'text-white/70 border-purple-500/30 hover:text-white opacity-60'
                            }
                          `}
                          title={`${group.title} · ${group.subtitle}`}
                        >
                          <span
                            className={`mt-[2px] inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-bold ${
                              isActive
                                ? 'border-white/70 bg-white/20 text-white'
                                : 'border-white/40 bg-white/10 text-white/60'
                            }`}
                          >
                            ✓
                          </span>
                          <span className="flex flex-col leading-tight">
                            <span className="text-[11px] font-semibold">{group.title}</span>
                            <span className="text-[10px] text-white/80">{group.subtitle}</span>
                          </span>
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
                disabled={
                  isGenerating ||
                  isRecommending || // Disable generate while analyzing product
                  !authReady ||
                  isGenerateButtonLocked ||
                  enabledAffiliateLabels.filter(Boolean).length === 0 ||
                  !productFile ||
                  !productInfo.trim()
                }
                className={`w-full min-h-[48px] px-4 rounded-lg text-white font-semibold text-sm flex items-center justify-center transition-all duration-200 btn-glass-primary
                  focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-zinc-900
                  ${
                    isGenerating || !authReady || enabledAffiliateLabels.filter(Boolean).length === 0 || !productFile || !productInfo.trim()
                      ? 'bg-zinc-600 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
                  }`}
              >
                {isGenerating
                  ? t.affiliateGenerator.generating
                  : authReady
                  ? t.affiliateGenerator.generateAffiliate
                  : t.affiliateGenerator.testTokenFirst}
              </button>

              <div className="max-h-52 bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-xs text-gray-200 flex flex-col">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-gray-100">{t.affiliateGenerator.activityLogLabel}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyActivityLog}
                      disabled={activityLogs.length === 0}
                      className="px-2 py-0.5 rounded-md border border-zinc-600 text-[10px] text-gray-200 hover:bg-zinc-800 disabled:opacity-40"
                    >
                      {activityLogCopyLabel}
                    </button>
                    <span className="text-[10px] text-gray-500">{activityLogs.length} {t.common.entries}</span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
                  {activityLogs.length === 0 ? (
                    <p className="text-[11px] text-gray-500">
                      {t.affiliateGenerator.noActivity}
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

          {/* Right Panel: Output Preview */}
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
              <h3 className="text-lg font-semibold text-gray-50">{t.affiliateGenerator.previewAffiliate}</h3>
              <div className="flex items-center gap-2">
                {canGenerateNextAffiliateBatch && (
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={isGenerating || isRecommending || !authReady || isGenerateButtonLocked}
                    className="flex items-center gap-2 btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-1.5 px-3 min-w-[150px] rounded-lg text-[10px] transition disabled:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="whitespace-nowrap">
                      {isGenerating
                        ? t.affiliateGenerator.generating
                        : t.affiliateGenerator.continueGenerate.replace('{batch}', String(nextAffiliateBatchIndex)).replace('{total}', String(totalAffiliateBatches))}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleFullReset}
                  disabled={isGenerating || isAnyVideoGenerating}
                  className={`inline-flex items-center px-4 py-2 text-[11px] font-semibold rounded-lg shadow-md transition-all duration-200
                    focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-zinc-900
                    ${
                      isGenerating || isAnyVideoGenerating
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'btn-glass-primary bg-red-600 hover:bg-red-700 text-white'
                    }`}
                >
                  <span className="mr-1.5 text-xs">🗑️</span>
                  <span>{t.affiliateGenerator.clearData}</span>
                </button>
              </div>
            </div>

            <div className="flex-1 flex flex-col px-6 pt-0 pb-4 min-h-0 overflow-y-auto custom-scrollbar">
              {/* Content Affiliate - gabungan semua kategori gambar */}
              <div className="flex-1 flex flex-col">
                {generatedImages.length > 0 && (
                  <div className="flex items-center justify-between mb-2 px-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-purple-400">{t.affiliateGenerator.contentAffiliateLabel}</span>
                      <span className="text-[10px] text-gray-500">{t.affiliateGenerator.imagesCount.replace('{count}', String(generatedImages.length))}</span>
                    </div>
                  </div>
                )}

                {generatedImages.length === 0 ? (
                  isGenerating ? (
                    <div className="flex-1 flex items-center justify-center mt-4">
                      <GradientLoader
                        size="md"
                        text={t.affiliateGenerator.generating}
                        subtitle="Mohon tunggu"
                        showLogo={false}
                      />
                    </div>
                  ) : (
                    <div className="mt-4 flex-1 flex items-center justify-center bg-zinc-950/40 rounded-lg text-gray-500 text-center text-xs p-6 min-h-[420px]">
                      <p>
                        {t.affiliateGenerator.emptyPreviewMessage}{' '}
                        <span className="font-semibold text-gray-300">{t.affiliateGenerator.generateAffiliate}</span>.
                      </p>
                    </div>
                  )
                ) : (
                  <div
                    className={`grid gap-3 text-xs ${
                      ratio === 'landscape' ? 'grid-cols-2' : 'grid-cols-4'
                    }`}
                  >
                    {generatedImages.map((img, index) => {
                          const isIncluded = img.includeInVideo !== false;
                          const isFailed = img.status === 'failed';
                          const isGeneratingSlot = img.status === 'generating';
                          const isVisible = visibleCardIds.has(img.id) || img.status === 'success' || img.status === 'failed';
                          return (
                            <div key={img.id} className={`relative group transition-all duration-500 ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
                              {isGeneratingSlot ? (
                                <div
                                  style={{
                                    aspectRatio:
                                      ratio === 'landscape'
                                        ? '16 / 9'
                                        : ratio === 'square'
                                        ? '1 / 1'
                                        : '9 / 16',
                                  }}
                                  className="relative w-full rounded-lg border border-blue-500/60 overflow-hidden"
                                >
                                  <img
                                    src={getLoadingGifByIndex(index)}
                                    alt="Loading image"
                                    className="absolute inset-0 w-full h-full object-cover opacity-60"
                                  />
                                  <div className="absolute inset-0 bg-black/60" />
                                  <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-3">
                                    {getCountdownMessage(img) && (
                                      <div className="text-sm text-purple-300 font-bold mb-1">
                                        {getCountdownMessage(img)}
                                      </div>
                                    )}
                                    <div className="text-[10px] text-gray-200 px-2 text-center line-clamp-2">
                                      {img.generationMode === 'edit'
                                        ? t.catalogGenerator.editingStatus
                                        : img.generationMode === 'regen'
                                        ? 'Regenerasi...'
                                        : img.fileName || img.prompt || 'Inspo siap diproses'}
                                    </div>
                                  </div>
                                </div>
                              ) : isFailed ? (
                                <button
                                  type="button"
                                  onClick={() => handleGenerateImageSlot(img.id)}
                                  disabled={!authReady}
                                  style={{
                                    aspectRatio:
                                      ratio === 'landscape'
                                        ? '16 / 9'
                                        : ratio === 'square'
                                        ? '1 / 1'
                                        : '9 / 16',
                                  }}
                                  className="relative w-full rounded-lg border border-red-500/60 bg-zinc-900/80 text-[11px] text-red-200 flex flex-col items-center justify-center px-3 py-3 hover:bg-zinc-900 cursor-pointer"
                                >
                                  <span className="mb-1 font-semibold">
                                    {`${t.logMessages.affiliate.generateFailed} #${index + 1}`}
                                  </span>
                                  <span className="text-[10px] text-red-300 mb-1 text-center line-clamp-2">
                                    {img.errorMessage || t.affiliateGenerator.clickToRegenerate}
                                  </span>
                                  <span className="mt-1 inline-flex items-center justify-center px-3 py-1 rounded-md border border-red-400/80 text-[10px] text-red-100">
                                    {t.affiliateGenerator.regenerateImage}
                                  </span>
                                </button>
                              ) : (
                                <>
                                  <div className="absolute top-1.5 left-1.5 z-10 flex gap-1.5">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!isGeneratingSlot) {
                                          void handleGenerateImageSlot(img.id);
                                        }
                                      }}
                                      disabled={isGeneratingSlot || !authReady}
                                      className="text-[10px] px-2 py-1 rounded-md bg-zinc-900/80 hover:bg-zinc-800 text-gray-100 border border-zinc-700 disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                      {isGeneratingSlot ? t.affiliateGenerator.regenerating : t.affiliateGenerator.regenerateBtn}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenAffiliateEditModal(img);
                                      }}
                                      disabled={!authReady}
                                      className="text-[10px] px-2 py-1 rounded-md bg-zinc-900/80 hover:bg-zinc-800 text-gray-100 border border-zinc-700"
                                    >
                                      {t.affiliateGenerator.editBtn}
                                    </button>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedImage(img)}
                                    style={{
                                      aspectRatio:
                                        ratio === 'landscape'
                                          ? '16 / 9'
                                          : ratio === 'square'
                                          ? '1 / 1'
                                          : '9 / 16',
                                    }}
                                    className="relative w-full rounded-lg border border-zinc-700 overflow-hidden bg-black focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
                                    aria-label={`${t.affiliateGenerator.contentAffiliateLabel} #${index + 1}`}
                                  >
                                    <img
                                      src={img.url}
                                      alt={img.fileName || img.id}
                                      className="w-full h-full object-cover"
                                    />
                                  </button>
                                  <div className="absolute bottom-1.5 right-1.5 z-10 flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleIncludeInVideo(img.id)}
                                      className={`h-7 px-3 rounded-md text-[10px] font-semibold flex items-center justify-center border transition-all duration-200 btn-glass-primary
                                        focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-zinc-900
                                        ${
                                          isIncluded
                                            ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 border-purple-300/80 text-white shadow-sm'
                                            : 'bg-black/70 border-zinc-500 text-gray-200 hover:bg-zinc-800'
                                        }`}
                                      title={
                                        isIncluded
                                          ? t.affiliateGenerator.includeInVideo
                                          : t.affiliateGenerator.excludeFromVideo
                                      }
                                    >
                                      {isIncluded ? 'VID' : 'OFF'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDownloadGeneratedImage(img)}
                                      className="h-7 px-3 rounded-md text-[10px] font-semibold flex items-center justify-center bg-black/80 border border-zinc-500 text-gray-100 hover:bg-zinc-800"
                                      title={t.affiliateGenerator.downloadImage}
                                    >
                                      {t.affiliateGenerator.downloadImage}
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                  </div>
                )}
              </div>

              {/* Content Affiliate (disembunyikan di tampilan, tetap pakai kategori 'ugc' di internal) */}
              <div className="hidden">
                <div className="flex items-center justify-between mb-2 px-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-purple-400">{t.affiliateGenerator.contentAffiliateLabel}</span>
                    {imagesByCategory('ugc').length > 0 && (
                      <span className="text-[10px] text-gray-500">
                        {t.affiliateGenerator.imagesCount.replace('{count}', String(imagesByCategory('ugc').length))}
                      </span>
                    )}
                  </div>
                </div>

                <div
                  className={`grid gap-3 text-xs ${
                    ratio === 'landscape' ? 'grid-cols-2' : 'grid-cols-4'
                  }`}
                >
                      {imagesByCategory('ugc').length === 0 ? (
                        <div className="col-span-full flex items-center justify-center text-gray-400 text-[11px] h-28 border border-zinc-800 rounded-lg bg-zinc-900/70">
                          {t.affiliateGenerator.noContent}
                        </div>
                      ) : (
                        imagesByCategory('ugc').map((img, index) => {
                          const isIncluded = img.includeInVideo !== false;
                          const isFailedOrEmpty = img.status === 'failed';
                          const isGeneratingSlot = img.status === 'generating';
                          return (
                            <div key={img.id} className="relative group">
                              {isFailedOrEmpty ? (
                                <button
                                  type="button"
                                  onClick={isGeneratingSlot ? undefined : () => handleGenerateImageSlot(img.id)}
                                  disabled={isGeneratingSlot || !authReady}
                                  style={{
                                    aspectRatio:
                                      ratio === 'landscape'
                                        ? '16 / 9'
                                        : ratio === 'square'
                                        ? '1 / 1'
                                        : '9 / 16',
                                  }}
                                  className={`relative w-full rounded-lg border border-zinc-700 bg-zinc-900/80 text-[11px] text-gray-200 flex flex-col items-center justify-center px-3 py-3 ${
                                    isGeneratingSlot ? 'opacity-70 cursor-wait' : 'hover:bg-zinc-900 cursor-pointer'
                                  }`}
                                >
                                  <span className="mb-1 font-semibold">
                                    {isGeneratingSlot
                                      ? t.affiliateGenerator.regenerating
                                      : img.status === 'failed'
                                      ? `${t.logMessages.affiliate.generateFailed} Content Affiliate #${index + 1}`
                                      : `${t.affiliateGenerator.generateImage} Content Affiliate #${index + 1}`}
                                  </span>
                                  <span className="text-[10px] text-purple-200 mb-1 text-center line-clamp-2">
                                    {img.errorMessage ||
                                      (isGeneratingSlot
                                        ? t.affiliateGenerator.generating
                                        : t.affiliateGenerator.clickToGenerate)}
                                  </span>
                                  <span className="mt-1 inline-flex items-center justify-center px-3 py-1 rounded-md border border-zinc-600 text-[10px] text-gray-100">
                                    {isGeneratingSlot ? t.affiliateGenerator.regenerating : t.affiliateGenerator.generateImage}
                                  </span>
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleIncludeInVideo(img.id)}
                                    className={`absolute top-1.5 left-1.5 z-10 h-6 px-3 rounded-md text-[10px] font-semibold flex items-center justify-center border transition-all duration-200 btn-glass-primary
                                      focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-zinc-900
                                      ${
                                        isIncluded
                                          ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 border-purple-300/80 text-white shadow-sm'
                                          : 'bg-black/70 border-zinc-500 text-gray-200 hover:bg-zinc-800'
                                      }`}
                                    title={
                                      isIncluded
                                        ? t.affiliateGenerator.includeInVideo
                                        : t.affiliateGenerator.excludeFromVideo
                                    }
                                  >
                                    {isIncluded ? 'VID' : 'OFF'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedImage(img)}
                                    style={{
                                      aspectRatio:
                                        ratio === 'landscape'
                                          ? '16 / 9'
                                          : ratio === 'square'
                                          ? '1 / 1'
                                          : '9 / 16',
                                    }}
                                    className="relative w-full rounded-lg border border-zinc-700 overflow-hidden bg-black focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
                                    aria-label={`Content Affiliate #${index + 1}`}
                                  >
                                    <img
                                      src={img.url}
                                      alt={img.fileName || img.id}
                                      className="w-full h-full object-cover"
                                    />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadGeneratedImage(img)}
                                    className="absolute bottom-1.5 right-1.5 z-10 h-7 px-3 rounded-md text-[10px] font-semibold flex items-center justify-center bg-black/80 border border-zinc-500 text-gray-100 hover:bg-zinc-800"
                                    title={t.affiliateGenerator.downloadImage}
                                  >
                                    {t.affiliateGenerator.downloadImage}
                                  </button>
                                </>
                              )}
                            </div>
                          );
                        })
                      )}
                </div>
              </div>

              {/* Commercial (disembunyikan di tampilan, tetap dipakai untuk logika internal) */}
              <div className="hidden">
                <div className="flex items-center justify-between mb-2 px-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-purple-400">{t.affiliateGenerator.contentAffiliateLabel}</span>
                    {imagesByCategory('commercial').length > 0 && (
                      <span className="text-[10px] text-gray-500">
                        {t.affiliateGenerator.imagesCount.replace('{count}', String(imagesByCategory('commercial').length))}
                      </span>
                    )}
                  </div>
                </div>

                <div
                  className={`grid gap-3 text-xs ${
                    ratio === 'landscape' ? 'grid-cols-2' : 'grid-cols-4'
                  }`}
                >
                      {imagesByCategory('commercial').length === 0 ? (
                        <div className="col-span-full flex items-center justify-center text-gray-400 text-[11px] h-28 border border-zinc-800 rounded-lg bg-zinc-900/70">
                          {t.affiliateGenerator.noCommercial}
                        </div>
                      ) : (
                        imagesByCategory('commercial').map((img, index) => {
                          const isIncluded = img.includeInVideo !== false;
                          const isFailedOrEmpty = img.status === 'failed' || !img.url;
                          const isGeneratingSlot = img.status === 'generating';
                          return (
                            <div key={img.id} className="relative group">
                              {isFailedOrEmpty ? (
                                <button
                                  type="button"
                                  onClick={isGeneratingSlot ? undefined : () => handleGenerateImageSlot(img.id)}
                                  disabled={isGeneratingSlot || !authReady}
                                  style={{
                                    aspectRatio:
                                      ratio === 'landscape'
                                        ? '16 / 9'
                                        : ratio === 'square'
                                        ? '1 / 1'
                                        : '9 / 16',
                                  }}
                                  className={`relative w-full rounded-lg border border-zinc-700 bg-zinc-900/80 text-[11px] text-gray-200 flex flex-col items-center justify-center px-3 py-3 ${
                                    isGeneratingSlot ? 'opacity-70 cursor-wait' : 'hover:bg-zinc-900 cursor-pointer'
                                  }`}
                                >
                                  <span className="mb-1 font-semibold">
                                    {isGeneratingSlot
                                      ? t.affiliateGenerator.regeneratingCommercial
                                      : img.status === 'failed'
                                      ? `${t.logMessages.affiliate.generateFailed} Commercial #${index + 1}`
                                      : `${t.affiliateGenerator.generateImage} Commercial #${index + 1}`}
                                  </span>
                                  <span className="text-[10px] text-gray-400 mb-1 text-center line-clamp-2">
                                    {img.errorMessage ||
                                      (isGeneratingSlot
                                        ? t.affiliateGenerator.generating
                                        : t.affiliateGenerator.clickToGenerate)}
                                  </span>
                                  <span className="mt-1 inline-flex items-center justify-center px-3 py-1 rounded-md border border-zinc-600 text-[10px] text-gray-100">
                                    {isGeneratingSlot ? t.affiliateGenerator.regenerating : t.affiliateGenerator.generateImage}
                                  </span>
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleIncludeInVideo(img.id)}
                                    className={`absolute top-1.5 left-1.5 z-10 h-6 px-3 rounded-md text-[10px] font-semibold flex items-center justify-center border transition-all duration-200 btn-glass-primary
                                      focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-zinc-900
                                      ${
                                        isIncluded
                                          ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 border-purple-300/80 text-white shadow-sm'
                                          : 'bg-black/70 border-zinc-500 text-gray-200 hover:bg-zinc-800'
                                      }`}
                                    title={
                                      isIncluded
                                        ? t.affiliateGenerator.includeInVideo
                                        : t.affiliateGenerator.excludeFromVideo
                                    }
                                  >
                                    {isIncluded ? 'VID' : 'OFF'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedImage(img)}
                                    style={{
                                      aspectRatio:
                                        ratio === 'landscape'
                                          ? '16 / 9'
                                          : ratio === 'square'
                                          ? '1 / 1'
                                          : '9 / 16',
                                    }}
                                    className="relative w-full rounded-lg border border-zinc-700 overflow-hidden bg-black focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
                                    aria-label={`Commercial #${index + 1}`}
                                  >
                                    <img
                                      src={img.url}
                                      alt={img.fileName || img.id}
                                      className="w-full h-full object-cover"
                                    />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadGeneratedImage(img)}
                                    className="absolute bottom-1.5 right-1.5 z-10 h-7 px-3 rounded-md text-[10px] font-semibold flex items-center justify-center bg-black/80 border border-zinc-500 text-gray-100 hover:bg-zinc-800"
                                    title={t.affiliateGenerator.downloadImage}
                                  >
                                    {t.affiliateGenerator.downloadImage}
                                  </button>
                                </>
                              )}
                            </div>
                          );
                        })
                      )}
                </div>
              </div>

              {/* Narasi, Caption & Video - Satu Paket (Content Affiliate sebagai pusat) */}
              {hasGeneratedAnyAffiliate && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2 px-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-purple-400">{t.affiliateGenerator.narrationCaptionTitle}</span>
                      <span className="text-[10px] text-gray-500">{t.affiliateGenerator.narrationCaptionSubtitle}</span>
                    </div>
                  </div>
                  {renderNarrationCaptionCard('ugc')}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
      </div>

      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md shadow-2xl p-5">
            <h2 className="text-base font-semibold text-gray-50 mb-2">{t.affiliateGenerator.confirmResetTitle}</h2>
            <div className="space-y-2 text-sm text-gray-200 mb-4">
              <p>{t.affiliateGenerator.confirmResetMessage}</p>
              <p className="text-gray-400 text-xs">{t.affiliateGenerator.confirmResetWarning}</p>
            </div>
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-3 py-1.5 rounded-md border border-zinc-600 text-gray-200 hover:bg-zinc-800"
              >
                {t.affiliateGenerator.cancelBtn}
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-700 text-white font-semibold"
              >
                {t.affiliateGenerator.deleteBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {affiliateEditModal.isOpen && affiliateEditModal.image && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-xl max-h-[90vh] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-gray-100">{t.affiliateGenerator.imageEditTitle}</h3>
              <button
                type="button"
                onClick={affiliateEditModal.isSubmitting ? undefined : handleCloseAffiliateEditModal}
                className="text-[18px] text-gray-400 hover:text-gray-100 px-1 disabled:opacity-40"
                disabled={affiliateEditModal.isSubmitting}
              >
                ×
              </button>
            </div>
            <div className="flex-1 p-4 space-y-4 overflow-y-auto custom-scrollbar">
              <div className="w-full max-h-[60vh] flex items-center justify-center bg-zinc-950 rounded-lg overflow-hidden">
                <img
                  src={affiliateEditModal.image.url}
                  alt={affiliateEditModal.image.fileName || affiliateEditModal.image.id}
                  className="max-h-[60vh] w-auto object-contain"
                />
              </div>
              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-gray-200">{t.affiliateGenerator.imageEditInstructionLabel}</div>
                <textarea
                  value={affiliateEditModal.instruction}
                  onChange={(e) =>
                    setAffiliateEditModal((prev) => ({
                      ...prev,
                      instruction: e.target.value,
                    }))
                  }
                  placeholder={t.affiliateGenerator.imageEditPlaceholder}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg text-xs text-gray-100 px-3 py-2 min-h-[96px] resize-none focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
            </div>
            <div className="px-4 pb-4">
              <button
                type="button"
                onClick={() => void handleApplyAffiliateEdit()}
                disabled={affiliateEditModal.isSubmitting || !authReady}
                className="w-full btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-xs font-semibold py-2.5 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {affiliateEditModal.isSubmitting ? t.affiliateGenerator.imageEditProcessing : t.affiliateGenerator.imageEditApply}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="bg-zinc-900 border border-zinc-700 rounded-2xl w-auto max-w-[90vw] max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <div className="min-w-0 mr-4">
                <p className="text-[11px] text-gray-400 truncate">
                  {selectedImage.fileName || selectedImage.id}
                </p>
                <p className="text-[10px] text-purple-300">
                  {t.affiliateGenerator.categoryLabel}{' '}
                  {selectedImage.category === 'broll'
                    ? t.affiliateGenerator.categoryBroll
                    : selectedImage.category === 'ugc'
                    ? t.affiliateGenerator.categoryUgc
                    : t.affiliateGenerator.categoryCommercial}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedImage) return;
                    handleDownloadGeneratedImage(selectedImage);
                  }}
                  className="px-2 py-1 text-[10px] rounded-md border border-zinc-600 text-gray-200 hover:bg-zinc-800"
                >
                  {t.affiliateGenerator.downloadBtn}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedImage(null)}
                  className="text-[18px] text-gray-400 hover:text-gray-100 px-1"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex justify-center custom-scrollbar">
              <img
                src={selectedImage.url}
                alt={selectedImage.fileName || selectedImage.id}
                className="max-h-[80vh] w-auto max-w-full object-contain rounded-xl shadow-2xl"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GenerateAffiliatePage;
