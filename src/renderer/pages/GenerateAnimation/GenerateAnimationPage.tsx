import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import GradientLoader from '../../shared/components/GradientLoader';
import PageHeader from '../../shared/components/PageHeader';
import { getFriendlyErrorHint } from '../../shared/utils/friendlyError';
import { useAuthReady } from '../../shared/utils/useAuthReady';
import { useLanguage } from '../../shared/i18n';
import { type ImageResolutionOption, useImageResolution } from '../../shared/utils/useImageResolution';

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

const getVideoFileUrl = (filePath?: string): string | null => {
  if (!filePath) return null;
  const encoded = encodeURIComponent(filePath);
  return `http://localhost:3123/video?path=${encoded}`;
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
        'Gemini TTS rejected the request (401/403). Check your Gemini API Key and permissions in Settings before retrying.',
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

  const error = lastError instanceof Error ? lastError : new Error('Failed to call Gemini TTS.');
  throw error;
};

type Topic =
  | 'Education'
  | 'Story'
  | 'Adventure'
  | 'Fantasy & Magic'
  | 'Superhero & Hero'
  | 'Science & Space'
  | 'Family & Friendship'
  | 'Everyday Comedy'
  | 'Light Mystery'
  | 'Folktale'
  | 'Moral Values'
  | 'History & Culture'
  | 'Nature & Animals'
  | 'Sports & Games'
  | 'Food & Cooking'
  | 'Music & Arts'
  | 'Technology & Innovation'
  | 'Mystery Detective'
  | 'Holiday & Celebration'
  | 'Others';

type CharacterAge = 'Teen (13-17 years)' | 'Young Adult (18-25 years)' | 'Adult (26-45 years)' | 'Middle-Aged (46-60 years)' | 'Senior (60+ years)' | '';

type CharacterRole = 'Protagonist' | 'Antagonist' | 'Sidekick' | 'Mentor' | 'Rival' | 'Extra' | '';

type Character = {
  name: string;
  age: CharacterAge;
  role: CharacterRole;
  details: string;
  imagePreview?: string | null;
  imageBase64?: string | null;
  isGeneratingDescription: boolean;
  visualImageUrl?: string | null;
  isGeneratingVisual?: boolean;
  generatingCountdown?: number;
};

type StorytellingStyle =
  | 'Narration'
  | 'Voice Over'
  | 'Combination'
  | 'Visual only'
  | 'Bedtime Story'
  | 'Educational Documentary'
  | 'Light Comedy'
  | 'Free Style';

type LanguageCode = 'id' | 'en' | 'ms';

type StoryRecommendation = {
  title: string;
  flow: string;
};

type SceneField = {
  label_id: string;
  label_en: string;
  value_id: string;
  value_en: string;
};

type GeneratedScene = {
  scene_number: number;
  details: SceneField[];
};
type ActivityLogEntry = {
  id: number;
  type: 'INFO' | 'SUCCESS' | 'ERROR';
  message: string;
  timestamp: string;
};

const STORY_TUTORIAL_URL = 'https://www.youtube.com/embed/QgOI1gb_qiM?autoplay=1&mute=1&origin=http://localhost:3000';

type SceneExpandedMap = Record<number, boolean>;

const DEFAULT_TEXT_MODEL = 'gemini-2.5-flash';

const SAFE_GUIDELINES = [
  'Content must be 100% safe, kid-friendly, and compliant with Google AI Safety policies.',
  'No hate, harassment, violence, self-harm, sexual or pornographic content, or child exploitation.',
  'No personal data (PII), illegal instructions, dangerous or extremist material, or misinformation.',
  'If user text includes sensitive/offensive content, reinterpret into neutral, positive, and educational wording.',
  'Always avoid slurs, stereotypes, political agitation, medical/drug/weapon advice, or graphic details.',
].join(' ');

const BANNED_KEYWORDS: RegExp[] = [
  /suicide|self\s?harm|bunuh diri/i,
  /kill|murder|torture/i,
  /porn|sexual|explicit|18\+/i,
  /violence|gore|blood/i,
  /hate|racist|terror|extrem/i,
  /weapon|bomb|gun/i,
  /drug|narcotic/i,
  /pii|phone number|address|email/i,
];

const sanitizeUserText = (text: string) => {
  if (!text) return '';
  return text
    .replace(/[{}<>`]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/(suicide|kill|murder|porn|sexual|violence)/gi, '')
    .trim();
};

const containsBanned = (text: string) => BANNED_KEYWORDS.some((re) => re.test(text));

const moderateInputOrThrow = (raw: string) => {
  const clean = sanitizeUserText(raw);
  if (containsBanned(clean)) {
    throw new Error('Input mengandung kata terlarang. Harap gunakan bahasa yang aman/edukatif.');
  }
  return clean;
};

const appendSafety = (text: string) => `${text}\n\nSAFETY: ${SAFE_GUIDELINES}`;

type TtsVoice = {
  id: string;
  name: string;
  tone: string;
  gender: 'LK' | 'PR';
};

const TTS_TONE_MAP: Record<string, Record<string, string>> = {
  Ceria:          { en: 'Cheerful',      id: 'Ceria',          ms: 'Ceria' },
  Semangat:       { en: 'Energetic',     id: 'Semangat',       ms: 'Bersemangat' },
  Informatif:     { en: 'Informative',   id: 'Informatif',     ms: 'Informatif' },
  Tegas:          { en: 'Firm',          id: 'Tegas',          ms: 'Tegas' },
  Bersemangat:    { en: 'Enthusiastic',  id: 'Bersemangat',    ms: 'Bersemangat' },
  Muda:           { en: 'Youthful',      id: 'Muda',           ms: 'Muda' },
  Santai:         { en: 'Relaxed',       id: 'Santai',         ms: 'Santai' },
  Tenang:         { en: 'Calm',          id: 'Tenang',         ms: 'Tenang' },
  Lembut:         { en: 'Soft',          id: 'Lembut',         ms: 'Lembut' },
  Jelas:          { en: 'Clear',         id: 'Jelas',          ms: 'Jelas' },
  Halus:          { en: 'Smooth',        id: 'Halus',          ms: 'Halus' },
  Serak:          { en: 'Raspy',         id: 'Serak',          ms: 'Serak' },
  Datar:          { en: 'Flat',          id: 'Datar',          ms: 'Datar' },
  Dewasa:         { en: 'Mature',        id: 'Dewasa',         ms: 'Dewasa' },
  Ramah:          { en: 'Friendly',      id: 'Ramah',          ms: 'Mesra' },
  Kasual:         { en: 'Casual',        id: 'Kasual',         ms: 'Kasual' },
  Hidup:          { en: 'Lively',        id: 'Hidup',          ms: 'Hidup' },
  Berpengetahuan: { en: 'Knowledgeable', id: 'Berpengetahuan', ms: 'Berpengetahuan' },
  Hangat:         { en: 'Warm',          id: 'Hangat',         ms: 'Hangat' },
};

const getLocalizedTone = (tone: string, lang: string): string => {
  const entry = TTS_TONE_MAP[tone];
  if (!entry) return tone;
  return entry[lang] || entry.id || tone;
};

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

const StoryHeaderIcon: React.FC = () => (
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
      d="M4.75 5.75C4.75 4.784 5.534 4 6.5 4h8.25A2.25 2.25 0 0 1 17 6.25v11a.75.75 0 0 1-1.133.624L12 15.5l-3.867 2.374A.75.75 0 0 1 7 17.25v-11A1.5 1.5 0 0 0 5.5 4.75H5a.75.75 0 0 0-.75.75v12.5A1.75 1.75 0 0 0 6 19.75h11a.75.75 0 0 0 0-1.5H6A.25.25 0 0 1 5.75 18V6.5c0-.414.336-.75.75-.75h.25"
    />
  </svg>
);

const GenerateAnimationPage: React.FC = () => {
  const authReady = useAuthReady();
  const [imageResolution] = useImageResolution();
  const veoModel = '3.1-fast-low';

  // Calculate fixed card dimensions based on resolution
  const cardDimensions = imageResolution === '1366x768' 
    ? { parameter: 427, preview: 907 }
    : { parameter: 599, preview: 1273 };

  const [topic, setTopic] = useState<Topic>('Education');
  const [topicDetail, setTopicDetail] = useState('');
  const [topicHistory, setTopicHistory] = useState<string[]>([]);
  const [isRekomTopicLoading, setIsRekomTopicLoading] = useState(false);
  const topicDetailRef = useRef<HTMLTextAreaElement | null>(null);

  const [characterStyle, setCharacterStyle] = useState<string>('Animasi 3D Lucu (Little Giants)');
  const [customCharacterStyle, setCustomCharacterStyle] = useState('');
  const customCharacterStyleRef = useRef<HTMLTextAreaElement | null>(null);
  const [characterCountInput, setCharacterCountInput] = useState<string>('1');
  const [characters, setCharacters] = useState<Character[]>([
    {
      name: '',
      age: 'Kids',
      role: 'Protagonist',
      details: '',
      imagePreview: null,
      imageBase64: null,
      isGeneratingDescription: false,
      visualImageUrl: null,
      isGeneratingVisual: false,
    },
  ]);

  type SceneImageStatus = 'idle' | 'loading' | 'success' | 'error';

  const MAX_FRAME_HISTORY = 3;

  interface SceneImagePair {
    status: SceneImageStatus;
    startUrl?: string;
    endUrl?: string;
    error?: string;
    isRegeneratingStart?: boolean;
    isRegeneratingEnd?: boolean;
    isEditingStart?: boolean;
    isEditingEnd?: boolean;
    isPovStart?: boolean;
    isPovEnd?: boolean;
    isAngleStart?: boolean;
    isAngleEnd?: boolean;
    isRotateStart?: boolean;
    isRotateEnd?: boolean;
    startHistory?: string[];
    endHistory?: string[];
    isComparingStart?: boolean;
    isComparingEnd?: boolean;
    generatingCountdown?: number;
  }

  const [storytellingStyle, setStorytellingStyle] = useState<StorytellingStyle>('Narration');
  const [customStorytellingStyleNote, setCustomStorytellingStyleNote] = useState('');
  const customStyleNoteRef = useRef<HTMLTextAreaElement | null>(null);
  const [lighting, setLighting] = useState<string>('Automatic (AI)');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [sceneCount, setSceneCount] = useState<number>(3);

  const [storyIdea, setStoryIdea] = useState('');
  const [isProcessingSummary, setIsProcessingSummary] = useState(false);
  const [isSceneCountHighlighted, setIsSceneCountHighlighted] = useState(false);
  const [recommendedSceneCount, setRecommendedSceneCount] = useState<number | null>(null);
  const [isSceneRekomModalOpen, setIsSceneRekomModalOpen] = useState(false);

  const [narratorVoice, setNarratorVoice] = useState<string>('Kore');

  const [recommendations, setRecommendations] = useState<StoryRecommendation[]>([]);
  const [isGeneratingFlow, setIsGeneratingFlow] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState<StoryRecommendation | null>(null);

  const [generatedScenes, setGeneratedScenes] = useState<GeneratedScene[]>([]);
  const [totalScenesToGenerate, setTotalScenesToGenerate] = useState(0);
  const [isGeneratingScenes, setIsGeneratingScenes] = useState(false);
  const [sceneProgressText, setSceneProgressText] = useState<string>('');

  const [sceneExpandedMap, setSceneExpandedMap] = useState<SceneExpandedMap>({});

  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const alertTimeoutRef = useRef<number | null>(null);
  const lastGeminiQuotaErrorRef = useRef<number | null>(null);
  const lastGeminiCooldownLogRef = useRef<number | null>(null);
  const isSceneBatchInFlightRef = useRef(false);

  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const { t, language } = useLanguage();
  const [activityLogCopyLabel, setActivityLogCopyLabel] = useState<string>(t.activityLog.copyLog);
  const [error, setError] = useState<string | null>(null);

  // Update narrator voice based on global language
  useEffect(() => {
    setNarratorVoice(language === 'id' || language === 'ms' ? 'Kore' : 'Puck');
  }, [language]);

  const [sceneImageMap, setSceneImageMap] = useState<Record<number, SceneImagePair>>({});
  const [expandedFlowIndexes, setExpandedFlowIndexes] = useState<Record<number, boolean>>({});

  type FrameKind = 'start' | 'end';

  type CameraAngleKey = 'eye-level' | 'low-angle' | 'high-angle' | 'close-up' | 'wide-shot' | 'over-shoulder';
  type CameraRotationKey = 'left-25' | 'left-45' | 'right-25' | 'right-45';

  const CAMERA_ANGLE_OPTIONS: { key: CameraAngleKey; label: string }[] = [
    { key: 'eye-level', label: 'Eye level (normal)' },
    { key: 'low-angle', label: 'Low angle (from below)' },
    { key: 'high-angle', label: 'High angle (from above)' },
    { key: 'close-up', label: 'Close-up (closer)' },
    { key: 'wide-shot', label: 'Wide shot (wider)' },
    { key: 'over-shoulder', label: 'Over-the-shoulder' },
  ];

  const CAMERA_ROTATION_OPTIONS: { key: CameraRotationKey; label: string }[] = [
    { key: 'left-25', label: 'Left 25° (light)' },
    { key: 'left-45', label: 'Left 45° (wide)' },
    { key: 'right-25', label: 'Right 25° (light)' },
    { key: 'right-45', label: 'Right 45° (wide)' },
  ];

  interface FrameEditModalState {
    isOpen: boolean;
    sceneNumber: number | null;
    kind: FrameKind | null;
    imageUrl: string | null;
    instruction: string;
    isSubmitting: boolean;
  }

  const [frameEditModal, setFrameEditModal] = useState<FrameEditModalState>({
    isOpen: false,
    sceneNumber: null,
    kind: null,
    imageUrl: null,
    instruction: '',
    isSubmitting: false,
  });

  const [angleMenuState, setAngleMenuState] = useState<{ sceneNumber: number; kind: FrameKind } | null>(null);
  const [rotationMenuState, setRotationMenuState] = useState<{ sceneNumber: number; kind: FrameKind } | null>(null);

  const [jsonPreview, setJsonPreview] = useState<{ sceneNumber: number; json: string } | null>(null);
  const [jsonCopyLabel, setJsonCopyLabel] = useState('');
  const [characterPreview, setCharacterPreview] = useState<{ index: number; url: string } | null>(null);
  const [sceneImagePreview, setSceneImagePreview] = useState<
    { sceneNumber: number; kind: FrameKind; url: string } | null
  >(null);

  useEffect(() => {
    if (!error) return;
    const timeout = setTimeout(() => {
      setError(null);
    }, 5000);
    return () => clearTimeout(timeout);
  }, [error]);

  type SceneAudioState = {
    isGenerating: boolean;
    audioUrl: string | null;
    voiceId?: string;
  };

  type SceneMovementState = {
    text: string;
    applied: boolean;
  };

  type SceneVideoStatus = {
    status: 'idle' | 'running' | 'completed' | 'error';
    filePath?: string;
    fileName?: string;
    lastMessage?: string;
    generatingCountdown?: number;
  };

  type StoryThumbnail = {
    id: number;
    url: string;
    prompt?: string;
    description?: string;
    isRegenerating?: boolean;
  };

  type StorySocialState = {
    isGenerating: boolean;
    thumbnails: StoryThumbnail[];
    caption: string;
    hashtags: string;
    description: string;
  };

  const [sceneAudioMap, setSceneAudioMap] = useState<Record<number, SceneAudioState>>({});
  const [sceneMovementMap, setSceneMovementMap] = useState<Record<number, SceneMovementState>>({});
  const [sceneVideoMap, setSceneVideoMap] = useState<Record<number, SceneVideoStatus>>({});

  const [storySocial, setStorySocial] = useState<StorySocialState>({
    isGenerating: false,
    thumbnails: [],
    caption: '',
    hashtags: '',
    description: '',
  });

  const [storyThumbnailPreview, setStoryThumbnailPreview] = useState<
    { id: number; url: string; description?: string } | null
  >(null);

  const [movementModal, setMovementModal] = useState<{
    isOpen: boolean;
    sceneNumber: number | null;
    text: string;
    isLoading: boolean;
  }>({ isOpen: false, sceneNumber: null, text: '', isLoading: false });

  const videoCountdownRefs = useRef<Record<number, ReturnType<typeof setInterval>>>({});

  const clearVideoCountdown = useCallback((sceneNumber: number) => {
    const timer = videoCountdownRefs.current[sceneNumber];
    if (timer) {
      clearInterval(timer);
      delete videoCountdownRefs.current[sceneNumber];
    }
  }, []);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [audioStatus, setAudioStatus] = useState<{
    sceneNumber: number | null;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
  }>({ sceneNumber: null, isPlaying: false, currentTime: 0, duration: 0 });

  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const stopCurrentSceneAudio = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
    }
    audioRef.current = null;
    setAudioStatus({ sceneNumber: null, isPlaying: false, currentTime: 0, duration: 0 });
  };

  const addLog = useCallback(
    (type: ActivityLogEntry['type'], message: string) => {
      if (!message) return;
      if (type === 'ERROR') {
        setError(message);
      }
      const prefixedMessage = `[Story] ${message}`;
      setActivityLogs((prev) => [
        ...prev,
        {
          id: prev.length ? prev[prev.length - 1].id + 1 : 1,
          type,
          message: prefixedMessage,
          timestamp: new Date().toLocaleTimeString(language === 'en' ? 'en-US' : language === 'ms' ? 'ms-MY' : 'id-ID', { hour12: false }),
        },
      ]);
    },
    [],
  );

  const showAlert = useCallback(
    (message: string) => {
      if (!message) return;
      addLog('ERROR', message);
    },
    [addLog],
  );

  const ensureAuthReady = useCallback(() => {
    if (authReady) return true;
    showAlert(t.storyGenerator.statusNotReady);
    return false;
  }, [authReady, showAlert]);

  useEffect(() => () => {
    if (alertTimeoutRef.current) {
      window.clearTimeout(alertTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.zeoAPI?.onBatchUpdate) {
      return undefined;
    }

    const unsubscribe = window.zeoAPI.onBatchUpdate((update: any) => {
      if (!update) return;

      const rawType = String(update.type || '');
      const message: string = update.message || '';

      // Terima event SCENE_* meskipun workflow bukan 'Generate Scene' (story video kadang kirim tanpa nama workflow)
      if (!rawType.startsWith('SCENE_') && rawType !== 'ERROR' && rawType !== 'BATCH_COMPLETE') {
        if (update.workflow !== 'Generate Scene') return;
      }

      if (message) {
        const logType: ActivityLogEntry['type'] =
          rawType === 'SCENE_COMPLETED' || rawType === 'BATCH_COMPLETE'
            ? 'SUCCESS'
            : rawType === 'SCENE_ERROR' || rawType === 'ERROR'
            ? 'ERROR'
            : 'INFO';

        addLog(logType, message);
      }

      const index = typeof update.index === 'number' ? update.index : null;
      if (index == null) return;

      setSceneVideoMap((prev) => {
        const current = prev[index] || { status: 'idle' as SceneVideoStatus['status'] };

        if (rawType === 'SCENE_STARTED') {
          return {
            ...prev,
            [index]: {
              ...current,
              status: 'running',
              lastMessage: message || t.storyGenerator.videoStartedDefault,
            },
          };
        }

        if (rawType === 'SCENE_COMPLETED') {
          clearVideoCountdown(index);
          return {
            ...prev,
            [index]: {
              ...current,
              status: 'completed',
              filePath: update.filePath,
              fileName: update.fileName,
              lastMessage: message || t.storyGenerator.videoCompletedDefault,
              generatingCountdown: undefined,
            },
          };
        }

        if (rawType === 'SCENE_ERROR' || rawType === 'ERROR') {
          clearVideoCountdown(index);
          return {
            ...prev,
            [index]: {
              ...current,
              status: 'error',
              lastMessage: message || t.storyGenerator.videoFailedDefault,
              generatingCountdown: undefined,
            },
          };
        }

        return prev;
      });
    });

    return unsubscribe;
  }, [addLog]);

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

  const getLockedCharacterPrompt = () => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem('zeoStudio.characterPrompt.source');
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { name?: string; prompt?: string };
      if (!parsed || typeof parsed.prompt !== 'string' || !parsed.prompt.trim()) return null;
      return parsed.prompt.trim();
    } catch {
      return null;
    }
  };

  const handleSceneVoiceChange = (sceneNumber: number, voiceId: string) => {
    setNarratorVoice(voiceId);
    setSceneAudioMap((prev) => ({
      ...prev,
      [sceneNumber]: {
        ...(prev[sceneNumber] || { isGenerating: false, audioUrl: null }),
        voiceId,
      },
    }));
  };

  const handleGenerateSceneNarration = async (scene: GeneratedScene) => {
    if (typeof window === 'undefined') {
      addLog('ERROR', t.storyGenerator.audioDesktopOnly);
      return;
    }

    if (!ensureAuthReady()) {
      return;
    }

    const apiKey = localStorage.getItem('zeoStudio.ai.apiKey') || '';
    const provider = localStorage.getItem('zeoStudio.ai.provider') || '';

    if (!apiKey || !provider) {
      addLog('ERROR', t.storyGenerator.geminiApiKeyMissing);
      return;
    }

    if (provider !== 'Gemini') {
      addLog('ERROR', t.storyGenerator.narrationGeminiOnly);
      return;
    }

    const audioDetail = scene.details.find((d) => d.label_en === 'Dialogue & Audio');
    const rawText = audioDetail
      ? language === 'en'
        ? audioDetail.value_en
        : audioDetail.value_id
      : '';

    if (!rawText || !rawText.trim()) {
      addLog('ERROR', t.storyGenerator.sceneNoDialogue.replace('{scene}', String(scene.scene_number)));
      return;
    }

    const textToSpeak = sanitizeUserText(rawText.replace(/(\[.*?\]|\*\*(.*?)\*\*)/g, '').trim());
    if (!textToSpeak) {
      addLog('ERROR', t.storyGenerator.sceneDialogueEmpty.replace('{scene}', String(scene.scene_number)));
      return;
    }

    const currentSceneAudio = sceneAudioMap[scene.scene_number];
    const voiceId = (currentSceneAudio && currentSceneAudio.voiceId) || narratorVoice || 'Kore';

    setSceneAudioMap((prev) => ({
      ...prev,
      [scene.scene_number]: {
        ...(prev[scene.scene_number] || { isGenerating: false, audioUrl: null }),
        voiceId,
        isGenerating: true,
      },
    }));

    addLog('INFO', t.storyGenerator.creatingNarration.replace('{scene}', String(scene.scene_number)));

    try {
      const payload = {
        contents: [{ parts: [{ text: appendSafety(textToSpeak) }] }],
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

      setSceneAudioMap((prev) => ({
        ...prev,
        [scene.scene_number]: {
          ...(prev[scene.scene_number] || { isGenerating: false, audioUrl: null }),
          isGenerating: false,
          audioUrl,
        },
      }));

      addLog('SUCCESS', t.storyGenerator.narrationSuccess.replace('{scene}', String(scene.scene_number)));
    } catch (error: any) {
      const message =
        (error && error.message) || t.storyGenerator.narrationErrorDefault;
      addLog('ERROR', t.storyGenerator.narrationFailed.replace('{scene}', String(scene.scene_number)).replace('{error}', message));
      setSceneAudioMap((prev) => ({
        ...prev,
        [scene.scene_number]: {
          ...(prev[scene.scene_number] || { isGenerating: false, audioUrl: null }),
          isGenerating: false,
        },
      }));
    }
  };

  const handlePlayPauseSceneAudio = (sceneNumber: number) => {
    const state = sceneAudioMap[sceneNumber];
    if (!state?.audioUrl) return;

    const isSameScene = audioStatus.sceneNumber === sceneNumber;
    const audio = audioRef.current;

    if (isSameScene && audio && !audio.paused) {
      audio.pause();
      setAudioStatus((prev) => ({ ...prev, isPlaying: false }));
      return;
    }

    if (!audio || !isSameScene) {
      stopCurrentSceneAudio();
      const el = new Audio(state.audioUrl);
      audioRef.current = el;

      el.addEventListener('loadedmetadata', () => {
        setAudioStatus({
          sceneNumber,
          isPlaying: true,
          currentTime: 0,
          duration: Number.isFinite(el.duration) ? el.duration : 0,
        });
      });

      el.addEventListener('timeupdate', () => {
        setAudioStatus((prev) =>
          prev.sceneNumber === sceneNumber
            ? {
                ...prev,
                currentTime: el.currentTime,
                duration: Number.isFinite(el.duration) ? el.duration : prev.duration,
              }
            : prev,
        );
      });

      el.addEventListener('ended', () => {
        setAudioStatus((prev) =>
          prev.sceneNumber === sceneNumber
            ? { ...prev, isPlaying: false, currentTime: el.duration || prev.currentTime }
            : prev,
        );
      });

      el.play().catch(() => {
        setAudioStatus({ sceneNumber, isPlaying: false, currentTime: 0, duration: 0 });
      });
      return;
    }

    audio.play().catch(() => {
      setAudioStatus((prev) => ({ ...prev, isPlaying: false }));
    });
    setAudioStatus((prev) => ({ ...prev, sceneNumber, isPlaying: true }));
  };

  const handleSeekSceneAudio = (sceneNumber: number, value: number) => {
    if (audioStatus.sceneNumber !== sceneNumber || !audioRef.current) return;
    const audio = audioRef.current;
    const duration = audio.duration || audioStatus.duration || 0;
    if (!duration || Number.isNaN(duration)) return;

    const nextTime = Math.max(0, Math.min(duration, (value / 100) * duration));
    audio.currentTime = nextTime;
    setAudioStatus((prev) =>
      prev.sceneNumber === sceneNumber ? { ...prev, currentTime: nextTime, duration } : prev,
    );
  };

  const handleDownloadSceneAudio = (sceneNumber: number) => {
    const state = sceneAudioMap[sceneNumber];
    if (!state?.audioUrl) return;

    const a = document.createElement('a');
    a.href = state.audioUrl;
    a.download = `scene_${sceneNumber}_narration.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    addLog('SUCCESS', t.storyGenerator.narrationDownloaded.replace('{scene}', String(sceneNumber)));
  };

  const handleOpenMovementSuggestion = async (scene: GeneratedScene) => {
    if (!ensureAuthReady()) {
      return;
    }

    const { plainId, plainEn } = buildScenePlainTexts(scene);

    setMovementModal({
      isOpen: true,
      sceneNumber: scene.scene_number,
      text: '',
      isLoading: true,
    });

    const baseInstruction = [
      'You are an expert animation director and camera movement designer.',
      'Based on the description of this scene (including dialogue and core visual details),',
      'propose a SMOOTH, NATURAL camera and subject movement that connects the START and END frame of this scene.',
      '',
      'Requirements:',
      '- Keep the movement suitable for children content (no violence, no horror).',
      '- Prefer simple but cinematic motion (pan, tilt, dolly, zoom, subtle character motion).',
      '- Describe the movement briefly but concretely.',
      '',
      'Output format (concise, in ' + langLabel + '):',
      'Movement: [short description of camera + subject movement, 1-2 sentences].',
      'Negative Prompt: [visual issues to avoid, e.g., glitch, blur, distortion, overly fast motion].',
      '',
      'Scene description (' + langLabel + ', for reference only):',
      language === 'en' ? plainEn : plainId,
    ].join('\n');

    const payload = {
      contents: [
        {
          parts: [
            {
              text: appendSafety(baseInstruction),
            },
          ],
        },
      ],
    };

    try {
      const result = await callGemini(payload);
      const { error, data } = handleGeminiResponse<string>(result);

      if (error || !data) {
        addLog('ERROR', t.storyGenerator.movementSuggestionFailed.replace('{scene}', String(scene.scene_number)));
        setMovementModal({
          isOpen: true,
          sceneNumber: scene.scene_number,
          text: '',
          isLoading: false,
        });
        return;
      }

      setMovementModal({
        isOpen: true,
        sceneNumber: scene.scene_number,
        text: data,
        isLoading: false,
      });
    } catch (err: any) {
      const message =
        (err && err.message) || t.storyGenerator.movementSuggestionError.replace('{scene}', String(scene.scene_number)).replace('{error}', '');
      addLog('ERROR', t.storyGenerator.movementSuggestionError.replace('{scene}', String(scene.scene_number)).replace('{error}', message));
      setMovementModal({
        isOpen: true,
        sceneNumber: scene.scene_number,
        text: '',
        isLoading: false,
      });
    }
  };

  const handleCloseMovementModal = () => {
    setMovementModal({ isOpen: false, sceneNumber: null, text: '', isLoading: false });
  };

  const handleMovementModalTextChange = (value: string) => {
    setMovementModal((prev) => ({
      ...prev,
      text: value,
    }));
  };

  const handleApplyMovementSuggestion = () => {
    if (!movementModal.sceneNumber || !movementModal.text.trim()) {
      handleCloseMovementModal();
      return;
    }

    const sceneNumber = movementModal.sceneNumber;
    const text = movementModal.text.trim();

    setSceneMovementMap((prev) => ({
      ...prev,
      [sceneNumber]: {
        text,
        applied: true,
      },
    }));

    addLog('SUCCESS', t.storyGenerator.movementApplied.replace('{scene}', String(sceneNumber)));
    handleCloseMovementModal();
  };

  const handleOpenMovementEdit = (scene: GeneratedScene) => {
    const existing = sceneMovementMap[scene.scene_number]?.text || '';
    setMovementModal({
      isOpen: true,
      sceneNumber: scene.scene_number,
      text: existing,
      isLoading: false,
    });
  };

  const handleRetryScene = async (scene: GeneratedScene) => {
    addLog('INFO', t.storyGenerator.retryStarting.replace('{scene}', String(scene.scene_number)));
    
    // Reset scene status
    setSceneImageMap((prev) => ({
      ...prev,
      [scene.scene_number]: {
        startUrl: '',
        endUrl: '',
        isGeneratingStart: false,
        isGeneratingEnd: false,
        isRegeneratingStart: false,
        isRegeneratingEnd: false,
      },
    }));
    
    setSceneVideoMap((prev) => ({
      ...prev,
      [scene.scene_number]: {
        status: 'idle',
        lastMessage: '',
      },
    }));

    try {
      // 1. Regenerate start frame
      await handleRegenerateFrame(scene, 'start');
      
      // 2. Regenerate end frame  
      await handleRegenerateFrame(scene, 'end');
      
      // 3. Generate video with new frames
      await handleGenerateSceneVideo(scene);
      
      addLog('SUCCESS', t.storyGenerator.retrySuccess.replace('{scene}', String(scene.scene_number)));
    } catch (error: any) {
      const message = error?.message || t.storyGenerator.retryErrorDefault;
      addLog('ERROR', t.storyGenerator.retryFailed.replace('{scene}', String(scene.scene_number)).replace('{error}', message));
    }
  };

  const handleGenerateSceneVideo = async (scene: GeneratedScene) => {
    if (typeof window === 'undefined' || !window.zeoAPI?.startSceneWorkflow) {
      addLog('ERROR', t.storyGenerator.videoDesktopOnly);
      return;
    }

    if (!ensureAuthReady()) {
      return;
    }

    const bearerKey = localStorage.getItem('zeoStudio.bearerToken') || '';
    if (!bearerKey.trim()) {
      addLog('ERROR', t.storyGenerator.videoBearerMissing);
      return;
    }

    const downloadPath = localStorage.getItem('zeoStudio.folder.output') || '';
    const flowProjectId = localStorage.getItem('zeoStudio.workflow.flowProjectId') || '';

    if (!downloadPath.trim()) {
      addLog('ERROR', t.storyGenerator.videoOutputMissing);
      return;
    }

    const imageState = sceneImageMap[scene.scene_number];
    if (!imageState || !imageState.startUrl || !imageState.endUrl) {
      addLog('ERROR', t.storyGenerator.videoNoFrames.replace('{scene}', String(scene.scene_number)));
      return;
    }

    if (
      !imageState.startUrl.startsWith('data:image') ||
      !imageState.endUrl.startsWith('data:image')
    ) {
      addLog('ERROR', t.storyGenerator.videoInvalidFormat.replace('{scene}', String(scene.scene_number)));
      return;
    }

    const startBase64 = imageState.startUrl.split(',')[1] || '';
    const endBase64 = imageState.endUrl.split(',')[1] || '';

    if (!startBase64 || !endBase64) {
      addLog('ERROR', t.storyGenerator.videoEmptyData.replace('{scene}', String(scene.scene_number)));
      return;
    }

    const { plainId, plainEn } = buildScenePlainTexts(scene);
    const movement = sceneMovementMap[scene.scene_number]?.text || '';

    const videoPromptParts: string[] = [];
    videoPromptParts.push(
      'Create a short children-friendly video of about 8 seconds based on this scene description.',
    );
    videoPromptParts.push('Target duration: approximately 8 seconds.');
    videoPromptParts.push(
      'Use the START and END reference images as the main visual keyframes. The motion between them must feel smooth and cinematic and comfortably fill ~8 seconds (not too fast, not too slow).',
    );
    videoPromptParts.push(
      'Keep style, characters, and environment consistent with the reference images.',
    );
    videoPromptParts.push('');
    videoPromptParts.push('Scene description (' + langLabel + '):');
    videoPromptParts.push(language === 'en' ? plainEn : plainId);

    if (movement.trim()) {
      videoPromptParts.push('');
      videoPromptParts.push('Preferred movement (English, follow as closely as possible):');
      videoPromptParts.push(movement.trim());
    }

    const videoPrompt = videoPromptParts.join('\n');
    const resolution: '720p' = '720p';

    clearVideoCountdown(scene.scene_number);

    setSceneVideoMap((prev) => ({
      ...prev,
      [scene.scene_number]: {
        ...(prev[scene.scene_number] || { status: 'idle' as SceneVideoStatus['status'] }),
        status: 'running',
        lastMessage: t.storyGenerator.videoSending,
        generatingCountdown: 300,
      },
    }));

    const countdownInterval = setInterval(() => {
      setSceneVideoMap((prev) => {
        const current = prev[scene.scene_number];
        if (!current || current.status !== 'running') {
          clearVideoCountdown(scene.scene_number);
          return prev;
        }
        const newCountdown = (current.generatingCountdown ?? 0) - 1;
        if (newCountdown <= -30) {
          clearVideoCountdown(scene.scene_number);
          addLog('ERROR', t.storyGenerator.videoTimeout?.replace('{scene}', String(scene.scene_number)) || `Scene ${scene.scene_number} video generation timeout (300s exceeded)`);
          return {
            ...prev,
            [scene.scene_number]: {
              status: 'error',
              lastMessage: 'Timeout - Generation exceeded 300 seconds',
              generatingCountdown: undefined,
            },
          };
        }
        return {
          ...prev,
          [scene.scene_number]: { ...current, generatingCountdown: newCountdown },
        };
      });
    }, 1000);

    videoCountdownRefs.current[scene.scene_number] = countdownInterval;

    addLog('INFO', t.storyGenerator.videoStarting.replace('{scene}', String(scene.scene_number)));

    try {
      // NOTE: startSceneWorkflow must return promptly; we optimistically mark status=running above.
      // If IPC fails, catch will mark error.
      await window.zeoAPI.startSceneWorkflow({
        bearerKey,
        downloadPath,
        flowProjectId,
        aspectRatio,
        veoModel,
        resolution,
        uiLanguage: language,
        scenes: [
          {
            index: scene.scene_number,
            mode: 'pair-chunk',
            startImageBase64: startBase64,
            endImageBase64: endBase64,
            prompt: videoPrompt,
          },
        ],
      });

      // If no exception thrown, keep status running; renderer updates via scene-video events.
      setSceneVideoMap((prev) => ({
        ...prev,
        [scene.scene_number]: {
          ...(prev[scene.scene_number] || { status: 'idle' as SceneVideoStatus['status'] }),
          status: 'running',
          lastMessage: t.storyGenerator.videoJobSubmitted,
        },
      }));

      // Safety timeout: jika tidak ada event lanjutan, reset ke idle supaya tombol retry tidak stuck
      setTimeout(() => {
        setSceneVideoMap((prev) => {
          const current = prev[scene.scene_number];
          if (!current || current.status !== 'running') return prev;
          return {
            ...prev,
            [scene.scene_number]: {
              ...current,
              status: 'error',
              lastMessage: current.lastMessage || t.storyGenerator.videoNoUpdates,
            },
          };
        });
      }, 300000);
    } catch (err: any) {
      const message =
        (err && err.message) || t.storyGenerator.videoStartError;
      addLog('ERROR', t.storyGenerator.videoStartFailed.replace('{scene}', String(scene.scene_number)).replace('{error}', message));
      setSceneVideoMap((prev) => ({
        ...prev,
        [scene.scene_number]: {
          ...(prev[scene.scene_number] || {
            status: 'idle' as SceneVideoStatus['status'],
          }),
          status: 'error',
          lastMessage: message,
        },
      }));
    }
  };

  const handleGenerateStorySocial = async () => {
    if (!selectedFlow) {
      showAlert(t.storyGenerator.selectFlowFirst);
      return;
    }

    if (!generatedScenes.length) {
      showAlert(t.storyGenerator.createScenesFirst);
      return;
    }

    if (storySocial.isGenerating) {
      return;
    }

    if (!ensureAuthReady()) {
      return;
    }

    const targetLangNativeMap = {
        id: 'Bahasa Indonesia',
        ms: 'Bahasa Melayu',
        en: 'English',
      };
      const targetLangNative = targetLangNativeMap[language] || targetLangNativeMap.id;

    const sceneSummaries = generatedScenes
      .slice(0, 10)
      .map((scene) => {
        const core = scene.details.find((d) => d.label_en === 'Core Scene Description');
        const audioDetail = scene.details.find((d) => d.label_en === 'Dialogue & Audio');
        const coreText = (core?.value_en || core?.value_id || '').trim();
        const audioText = (audioDetail?.value_en || audioDetail?.value_id || '').trim();
        const parts: string[] = [];
        if (coreText) {
          parts.push(`Core: ${coreText}`);
        }
        if (audioText) {
          parts.push(`Dialogue & Audio: ${audioText}`);
        }
        const joined = parts.join(' | ');
        return joined ? `Scene #${scene.scene_number}: ${joined}` : `Scene #${scene.scene_number}`;
      })
      .join('\n');

    const instructionLines = [
      'You are an expert social media strategist for kids animation content.',
      'Based on the following animated children story, create THREE different thumbnail concepts and one social media post package for this story.',
      '',
      `Story title: ${selectedFlow.title}`,
      `Story flow (high level outline): ${selectedFlow.flow}`,
      '',
      'Scene breakdown (English, for reference only):',
      sceneSummaries || '(no detailed scenes, only use title and flow above).',
      '',
      `Write all human-facing text (caption, hashtags, and description) in ${targetLangNative}.`,
      '',
      'Return ONLY a valid JSON object with the following structure (no commentary, no markdown):',
      '{',
      '  "thumbnails": [',
      '    { "prompt_en": "..." },',
      '    { "prompt_en": "..." },',
      '    { "prompt_en": "..." }',
      '  ],',
      '  "caption": "caption text in the target language",',
      '  "hashtags": ["#tag1", "#tag2", "#tag3"],',
      '  "description": "short description paragraph in the target language (1-3 sentences)"',
      '}',
      '',
      'Rules:',
      '- Thumbnail prompts MUST be in English and describe the visual composition for an eye-catching YouTube/TikTok thumbnail.',
      '- Thumbnails must be bright, kid-friendly, and related to the core idea of the story.',
      '- Caption: max 3 short sentences, exciting hook, mention main character or conflict, include a soft call-to-action.',
      '- Hashtags: max 7 items. Each hashtag MUST start with # and MUST NOT contain spaces.',
      '- Description: 1-3 sentences suitable for video description or social media post.',
    ];

    const payload = {
      contents: [
        {
          parts: [
            {
              text: appendSafety(instructionLines.join('\n')),
            },
          ],
        },
      ],
    };

    setStorySocial((prev) => ({
      ...prev,
      isGenerating: true,
    }));

    addLog('INFO', t.storyGenerator.generatingSocialPackage);

    try {
      const result = await callGemini(payload);
      const { error, data } = handleGeminiResponse<string>(result);

      if (error || !data) {
        addLog('ERROR', t.storyGenerator.socialPackageFailed);
        setStorySocial((prev) => ({
          ...prev,
          isGenerating: false,
        }));
        return;
      }

      const parsed = cleanAndParseJson(data) as any;
      if (!parsed || !Array.isArray(parsed.thumbnails) || !parsed.thumbnails.length) {
        addLog('ERROR', t.storyGenerator.socialFormatInvalid);
        setStorySocial((prev) => ({
          ...prev,
          isGenerating: false,
        }));
        return;
      }

      const rawCaption = typeof parsed.caption === 'string' ? parsed.caption.trim() : '';
      const rawDescription =
        typeof parsed.description === 'string' ? parsed.description.trim() : '';

      const normalizeHashtagsFromAny = (value: unknown): string => {
        if (Array.isArray(value)) {
          return value
            .map((h) => `#${String(h || '')
              .replace(/#/g, '')
              .trim()}`)
            .filter((h) => h !== '#')
            .join(' ');
        }
        if (!value) return '';
        const text = String(value);
        if (!text.trim()) return '';
        return text
          .split(/[\s,]+/)
          .map((h) => `#${h.replace(/#/g, '').trim()}`)
          .filter((h) => h !== '#')
          .join(' ');
      };

      const hashtagsText = normalizeHashtagsFromAny(parsed.hashtags);

      const thumbnailEntries: { prompt: string; description?: string }[] = parsed.thumbnails
        .map((t: any) => {
          if (!t) return null;
          const candidate =
            (typeof t.prompt_en === 'string' && t.prompt_en) ||
            (typeof t.visual_prompt_en === 'string' && t.visual_prompt_en) ||
            (typeof t.prompt === 'string' && t.prompt) ||
            (typeof t.text === 'string' && t.text) ||
            '';
          const prompt = String(candidate || '').trim();
          if (!prompt) return null;
          const desc =
            (typeof t.description === 'string' && t.description.trim()) ||
            (typeof t.desc === 'string' && t.desc.trim()) ||
            undefined;
          return { prompt, description: desc };
        })
        .filter((v: { prompt: string; description?: string } | null) => !!v)
        .slice(0, 3) as { prompt: string; description?: string }[];

      const prompts: string[] = thumbnailEntries.map((t) => t.prompt);

      if (!prompts.length) {
        addLog('ERROR', t.storyGenerator.socialNoPrompts);
        setStorySocial((prev) => ({
          ...prev,
          isGenerating: false,
        }));
        return;
      }

      setStorySocial((prev) => ({
        ...prev,
        caption: rawCaption,
        hashtags: hashtagsText,
        description: rawDescription,
        thumbnails: [],
      }));

      if (typeof window === 'undefined' || !window.zeoAPI?.generateAffiliateImages) {
        addLog('ERROR', t.storyGenerator.socialEngineUnavailable);
        setStorySocial((prev) => ({
          ...prev,
          isGenerating: false,
        }));
        return;
      }

      const bearerKey = localStorage.getItem('zeoStudio.bearerToken') || '';
      if (!bearerKey.trim()) {
        addLog('ERROR', t.storyGenerator.socialBearerMissing);
        setStorySocial((prev) => ({
          ...prev,
          isGenerating: false,
        }));
        return;
      }

      const aspectRatioKey = aspectRatio === '9:16' ? 'portrait' : 'landscape';

      const modelBase64List: string[] = characters
        .map((c) => c.visualImageUrl)
        .filter((url): url is string => !!url && typeof url === 'string' && url.startsWith('data:image'))
        .map((url) => {
          const parts = url.split(',');
          return parts[1] || '';
        })
        .filter((b64) => b64 && b64.length > 0);

      const titleForThumbnail = (selectedFlow.title || '').trim();

      const langLabelForThumb = language === 'en' ? 'English' : language === 'ms' ? 'Malay' : 'Indonesian';
      const promptsWithTitle = prompts.map((basePrompt) => {
        const core = basePrompt.trim();
        const styleLine = `Use the same visual style as the main story: "${characterStyle}". If character references are provided, match their face, clothing layers, and colors exactly.`;
        if (!titleForThumbnail) return `${core}. ${styleLine}`;
        return `${core}. ${styleLine} Add big, bold, kid-friendly title text INSIDE the image that clearly says "${titleForThumbnail}" in ${langLabelForThumb}, using bright contrasting colors and a thick outline so the text is very readable even on small phone screens.`;
      });

      const items = promptsWithTitle.map((prompt, index) => ({
        category: 'thumbnail',
        prompt,
        index,
      }));

      const response = await window.zeoAPI.generateAffiliateImages({
        bearerKey,
        aspectRatioKey,
        imageResolution,
        items,
        references: {
          product: null,
          models: modelBase64List,
          additional: [],
        },
      });

      if (!response || !response.ok || !Array.isArray(response.results)) {
        const message = (response && response.error) || t.storyGenerator.socialNoThumbnails;
        addLog('ERROR', t.storyGenerator.socialThumbnailsFailed.replace('{error}', message));
        setStorySocial((prev) => ({
          ...prev,
          isGenerating: false,
        }));
        return;
      }

      const thumbnails: StoryThumbnail[] = response.results
        .filter((r: any) => r && r.success && r.dataUrl)
        .slice(0, 3)
        .map((r: any, idx: number) => {
          const promptIndex = typeof r.index === 'number' ? r.index : idx;
          const base = thumbnailEntries[promptIndex] || thumbnailEntries[idx] || {
            prompt: prompts[promptIndex] || prompts[idx] || '',
            description: undefined,
          };
          return {
            id: idx + 1,
            url: String(r.dataUrl),
            prompt: base.prompt,
            description: base.description,
          };
        });

      if (!thumbnails.length) {
        addLog('ERROR', t.storyGenerator.socialNoThumbnails);
        setStorySocial((prev) => ({
          ...prev,
          isGenerating: false,
        }));
        return;
      }

      setStorySocial((prev) => ({
        ...prev,
        isGenerating: false,
        thumbnails,
      }));

      addLog('SUCCESS', t.storyGenerator.socialSuccess);
    } catch (error: any) {
      const message = error?.message || String(error);
      addLog('ERROR', t.storyGenerator.socialPackageError.replace('{error}', message));
      setStorySocial((prev) => ({
        ...prev,
        isGenerating: false,
      }));
    }
  };

  const handleRegenerateStoryThumbnail = async (thumbId: number) => {
    const target = storySocial.thumbnails.find((t) => t.id === thumbId);
    if (!target || !target.prompt) return;

    if (!ensureAuthReady()) {
      return;
    }

    if (typeof window === 'undefined' || !window.zeoAPI?.generateAffiliateImages) {
      addLog('ERROR', t.storyGenerator.regenEngineUnavailable);
      return;
    }

    const bearerKey = localStorage.getItem('zeoStudio.bearerToken') || '';
    if (!bearerKey.trim()) {
      addLog('ERROR', t.storyGenerator.regenBearerMissing);
      return;
    }

    const aspectRatioKey = aspectRatio === '9:16' ? 'portrait' : 'landscape';

    const modelBase64List: string[] = characters
      .map((c) => c.visualImageUrl)
      .filter((url): url is string => !!url && typeof url === 'string' && url.startsWith('data:image'))
      .map((url) => {
        const parts = url.split(',');
        return parts[1] || '';
      })
      .filter((b64) => b64 && b64.length > 0);

    const titleForThumbnail = (selectedFlow?.title || '').trim();

    const basePrompt = target.prompt.trim();
    const langLabelForThumb = language === 'en' ? 'English' : language === 'ms' ? 'Malay' : 'Indonesian';
    const styleLine = `Use the same visual style as the main story: "${characterStyle}". If character references are provided, match their face, clothing layers, and colors exactly.`;
    const finalPrompt =
      titleForThumbnail && basePrompt
        ? `${basePrompt}. ${styleLine} Add big, bold, kid-friendly title text INSIDE the image that clearly says "${titleForThumbnail}" in ${langLabelForThumb}, using bright contrasting colors and a thick outline so the text is very readable even on small phone screens.`
        : `${basePrompt}. ${styleLine}`;

    setStorySocial((prev) => ({
      ...prev,
      thumbnails: prev.thumbnails.map((t) =>
        t.id === thumbId
          ? {
              ...t,
              isRegenerating: true,
            }
          : t,
      ),
    }));

    try {
      const response = await window.zeoAPI.generateAffiliateImages({
        bearerKey,
        aspectRatioKey,
        imageResolution,
        items: [{ category: 'thumbnail', prompt: finalPrompt, index: 0 }],
        references: {
          product: null,
          models: modelBase64List,
          additional: [],
        },
      });

      if (!response || !response.ok || !Array.isArray(response.results) || !response.results[0]) {
        const message = (response && response.error) || t.storyGenerator.socialNoThumbnails;
        addLog('ERROR', t.storyGenerator.regenThumbnailFailed.replace('{error}', message));
        setStorySocial((prev) => ({
          ...prev,
          thumbnails: prev.thumbnails.map((t) =>
            t.id === thumbId
              ? {
                  ...t,
                  isRegenerating: false,
                }
              : t,
          ),
        }));
        return;
      }

      const result = response.results[0];
      if (!result.success || !result.dataUrl) {
        const errMsg: string = result.error || t.storyGenerator.socialNoThumbnails;
        addLog('ERROR', t.storyGenerator.regenThumbnailFailed.replace('{error}', errMsg));
        setStorySocial((prev) => ({
          ...prev,
          thumbnails: prev.thumbnails.map((t) =>
            t.id === thumbId
              ? {
                  ...t,
                  isRegenerating: false,
                }
              : t,
          ),
        }));
        return;
      }

      const newUrl: string = result.dataUrl;

      setStorySocial((prev) => ({
        ...prev,
        thumbnails: prev.thumbnails.map((t) =>
          t.id === thumbId
            ? {
                ...t,
                url: newUrl,
                isRegenerating: false,
              }
            : t,
        ),
      }));

      addLog('SUCCESS', t.storyGenerator.regenThumbnailSuccess.replace('{id}', String(thumbId)));
    } catch (error: any) {
      const message = error?.message || String(error);
      addLog('ERROR', t.storyGenerator.regenThumbnailError.replace('{error}', message));
      setStorySocial((prev) => ({
        ...prev,
        thumbnails: prev.thumbnails.map((t) =>
          t.id === thumbId
            ? {
                ...t,
                isRegenerating: false,
              }
            : t,
        ),
      }));
    }
  };

  const handleCopyStoryCaption = async () => {
    const text = storySocial.caption.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      addLog('SUCCESS', t.storyGenerator.captionCopied);
    } catch {
      addLog('ERROR', t.storyGenerator.captionCopyFailed);
    }
  };

  const handleCopyStoryHashtags = async () => {
    const text = storySocial.hashtags.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      addLog('SUCCESS', t.storyGenerator.hashtagsCopied);
    } catch {
      addLog('ERROR', t.storyGenerator.hashtagsCopyFailed);
    }
  };

  const handleCopyStoryDescription = async () => {
    const text = storySocial.description.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      addLog('SUCCESS', t.storyGenerator.descriptionCopied);
    } catch {
      addLog('ERROR', t.storyGenerator.descriptionCopyFailed);
    }
  };

  const handleToggleCompareFrame = (sceneNumber: number, kind: FrameKind) => {
    setSceneImageMap((prev) => {
      const current = prev[sceneNumber];
      if (!current) return prev;

      const hasHistory =
        kind === 'start' ? (current.startHistory && current.startHistory.length > 0) : (current.endHistory && current.endHistory.length > 0);
      if (!hasHistory) return prev;

      const next: SceneImagePair = {
        ...current,
        isComparingStart: kind === 'start' ? !current.isComparingStart : current.isComparingStart,
        isComparingEnd: kind === 'end' ? !current.isComparingEnd : current.isComparingEnd,
      };

      return {
        ...prev,
        [sceneNumber]: next,
      };
    });
  };

  const handleUndoFrame = (sceneNumber: number, kind: FrameKind) => {
    setSceneImageMap((prev) => {
      const current = prev[sceneNumber];
      if (!current) return prev;

      const history = kind === 'start' ? current.startHistory || [] : current.endHistory || [];
      if (!history.length) return prev;

      const last = history[history.length - 1];
      const remaining = history.slice(0, history.length - 1);

      const next: SceneImagePair = {
        ...current,
        startUrl: kind === 'start' ? last : current.startUrl,
        endUrl: kind === 'end' ? last : current.endUrl,
        startHistory: kind === 'start' ? remaining : current.startHistory,
        endHistory: kind === 'end' ? remaining : current.endHistory,
      };

      if (kind === 'start' && !next.startHistory?.length) {
        next.isComparingStart = false;
      }
      if (kind === 'end' && !next.endHistory?.length) {
        next.isComparingEnd = false;
      }

      return {
        ...prev,
        [sceneNumber]: next,
      };
    });
  };

  const handleApplyCameraRotation = async (
    scene: GeneratedScene,
    kind: FrameKind,
    rotationKey: CameraRotationKey,
  ) => {
    const sceneState = sceneImageMap[scene.scene_number];
    const imageUrl = kind === 'start' ? sceneState?.startUrl : sceneState?.endUrl;

    if (!imageUrl) {
      addLog('ERROR', t.storyGenerator.rotateImageNotAvailable.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(scene.scene_number)));
      return;
    }

    if (!imageUrl.startsWith('data:image')) {
      addLog('ERROR', t.storyGenerator.rotateInvalidFormat.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(scene.scene_number)));
      return;
    }

    const base64 = imageUrl.split(',')[1] || '';
    if (!base64) {
      addLog('ERROR', t.storyGenerator.rotateEmptyData.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(scene.scene_number)));
      return;
    }

    if (!ensureAuthReady()) {
      return;
    }

    const rotationDescriptions: Record<CameraRotationKey, string> = {
      'left-25':
        'rotate the virtual camera approximately 25 degrees to the LEFT around the main characters, so that the viewer sees the scene slightly more from their left side while keeping the same moment and blocking',
      'left-45':
        'rotate the virtual camera approximately 45 degrees to the LEFT around the main characters, so that the viewer sees the scene clearly from their left side while keeping the same moment and blocking',
      'right-25':
        'rotate the virtual camera approximately 25 degrees to the RIGHT around the main characters, so that the viewer sees the scene slightly more from their right side while keeping the same moment and blocking',
      'right-45':
        'rotate the virtual camera approximately 45 degrees to the RIGHT around the main characters, so that the viewer sees the scene clearly from their right side while keeping the same moment and blocking',
    };

    const rotText = rotationDescriptions[rotationKey];

    let rotationInstruction = `You are editing this image by changing ONLY the horizontal rotation of the virtual camera. Target rotation: ${rotText}. The STORY MOMENT, characters, poses, props, and environment MUST remain exactly the same as in the original image. DO NOT change the character design, clothing, facial features, body proportions, or lighting style. Just rotate/orbit the virtual camera left or right to achieve the new view. The result MUST have an OBVIOUSLY different horizontal viewing direction compared to the original (do NOT return an identical or nearly identical framing). The final image MUST keep the same aspect ratio ${aspectRatio} and remain a single unified frame without any text or UI.`;

    if (characterStyle === 'Animasi Syariah') {
      rotationInstruction +=
        ' CRITICAL STYLE RULE: Maintain the "Animasi Syariah" 3D faceless character style ((no eyes:5.0), (no nose:5.0), (WAJIB TANPA FITUR WAJAH:3.0)) and Islamic clothing while changing only the camera rotation.';
    } else if (characterStyle === 'SUPER REALISTIS') {
      rotationInstruction +=
        ' CRITICAL STYLE RULE: Maintain the "SUPER REALISTIS" photorealistic style (high-end Sony mirrorless look) while changing only the camera rotation.';
    }

    if (typeof window === 'undefined' || !window.zeoAPI?.editStoryFrame) {
      addLog('ERROR', t.storyGenerator.rotateEngineUnavailable.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(scene.scene_number)));
      return;
    }

    const bearerKey = localStorage.getItem('zeoStudio.bearerToken') || '';
    if (!bearerKey.trim()) {
      addLog('ERROR', t.storyGenerator.rotateBearerMissing.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(scene.scene_number)));
      return;
    }

    addLog('INFO', t.storyGenerator.rotatingCamera.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(scene.scene_number)));

    setRotationMenuState(null);

    setSceneImageMap((prev) => ({
      ...prev,
      [scene.scene_number]: {
        ...(prev[scene.scene_number] || { status: 'success' as SceneImageStatus }),
        isRotateStart: kind === 'start',
        isRotateEnd: kind === 'end',
      },
    }));

    try {
      const result = await window.zeoAPI.editStoryFrame({
        bearerKey,
        aspectRatio,
        imageResolution,
        instruction: rotationInstruction,
        imageBase64: base64,
        mode: 'rotate',
      });

      if (!result || !result.ok || !result.dataUrl) {
        const message = (result && result.error) || t.storyGenerator.rotateFailedGenerate;
        addLog('ERROR', t.storyGenerator.rotateFailed.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(scene.scene_number)).replace('{error}', message));
        setSceneImageMap((prev) => ({
          ...prev,
          [scene.scene_number]: {
            ...(prev[scene.scene_number] || { status: 'success' as SceneImageStatus }),
            isRotateStart: false,
            isRotateEnd: false,
          },
        }));
        return;
      }

      const newUrl = result.dataUrl as string;

      setSceneImageMap((prev) => {
        const current = prev[scene.scene_number] || { status: 'success' as SceneImageStatus };
        const startHistory = current.startHistory || [];
        const endHistory = current.endHistory || [];
        const prevStart = current.startUrl;
        const prevEnd = current.endUrl;

        let nextStartHistory = startHistory;
        let nextEndHistory = endHistory;

        if (kind === 'start' && prevStart) {
          nextStartHistory = [...startHistory, prevStart].slice(-MAX_FRAME_HISTORY);
        } else if (kind === 'end' && prevEnd) {
          nextEndHistory = [...endHistory, prevEnd].slice(-MAX_FRAME_HISTORY);
        }

        return {
          ...prev,
          [scene.scene_number]: {
            ...current,
            status: 'success',
            startUrl: kind === 'start' ? newUrl : current.startUrl,
            endUrl: kind === 'end' ? newUrl : current.endUrl,
            error: undefined,
            isRotateStart: false,
            isRotateEnd: false,
            startHistory: nextStartHistory,
            endHistory: nextEndHistory,
          },
        };
      });

      addLog('SUCCESS', t.storyGenerator.rotateSuccess.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(scene.scene_number)));
    } catch (error: any) {
      const message = error?.message || String(error);
      addLog('ERROR', t.storyGenerator.rotateFailed.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(scene.scene_number)).replace('{error}', message));
      setSceneImageMap((prev) => ({
        ...prev,
        [scene.scene_number]: {
          ...(prev[scene.scene_number] || { status: 'success' as SceneImageStatus }),
          isRotateStart: false,
          isRotateEnd: false,
        },
      }));
    }
  };

  const handleRegenerateFrame = async (scene: GeneratedScene, kind: FrameKind) => {
    if (typeof window === 'undefined' || !window.zeoAPI) {
      addLog('ERROR', t.storyGenerator.regenFrameEngineUnavailable.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(scene.scene_number)));
      return;
    }

    const hasStoryImageEngine = typeof window.zeoAPI.generateStorySceneImages === 'function';
    const hasAffiliateImageEngine = typeof window.zeoAPI.generateAffiliateImages === 'function';

    if (!hasStoryImageEngine && !hasAffiliateImageEngine) {
      addLog('ERROR', t.storyGenerator.regenFrameEngineUnavailable.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(scene.scene_number)));
      return;
    }

    if (!ensureAuthReady()) {
      return;
    }

    const bearerKey = localStorage.getItem('zeoStudio.bearerToken') || '';
    if (!bearerKey.trim()) {
      addLog('ERROR', t.storyGenerator.regenFrameBearerMissing.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(scene.scene_number)));
      return;
    }

    const { startPrompt, endPrompt } = buildSceneImagePrompts(scene);

    const modelBase64List: string[] = characters
      .map((c) => c.visualImageUrl)
      .filter((url): url is string => !!url && typeof url === 'string' && url.startsWith('data:image'))
      .map((url) => {
        const parts = url.split(',');
        return parts[1] || '';
      })
      .filter((b64) => b64 && b64.length > 0);

    const aspectRatioKey = aspectRatio === '9:16' ? 'portrait' : 'landscape';
    const sceneState = sceneImageMap[scene.scene_number];

    addLog('INFO', t.storyGenerator.regeneratingFrame.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(scene.scene_number)));

    try {
      setSceneImageMap((prev) => ({
        ...prev,
        [scene.scene_number]: {
          ...(prev[scene.scene_number] || { status: 'success' as SceneImageStatus }),
          isRegeneratingStart: kind === 'start',
          isRegeneratingEnd: kind === 'end',
        },
      }));

      let newUrl: string | undefined;
      let lastError: string | null = null;

      // 0) Khusus untuk END frame: coba dulu edit langsung dari START frame agar lingkungan & kamera tetap identik
      if (kind === 'end' && window.zeoAPI?.editStoryFrame && sceneState?.startUrl) {
        const startUrl = sceneState.startUrl;

        if (startUrl.startsWith('data:image')) {
          const base64 = startUrl.split(',')[1] || '';

          if (base64) {
            let endEditInstruction = `You are editing the START frame of this storyboard scene to create the END frame of the SAME SHOT a few seconds later. CRITICAL RULES: Keep the same camera angle, perspective, room layout, window and door positions, major props, lighting, and overall color palette as the original image. The END frame must look like the same shot continuing, not a new shot or a new location. You may ONLY adjust the characters' poses, gestures, facial expressions, and small object movements to reflect the later moment described below. The final image MUST keep the same aspect ratio ${aspectRatio} and remain a single, unified frame without any text or UI. END FRAME DESCRIPTION (English):\n${endPrompt}`;

            if (characterStyle === 'Animasi Syariah') {
              endEditInstruction +=
                ' CRITICAL STYLE RULE: Maintain the "Animasi Syariah" 3D faceless character style ((no eyes:5.0), (no nose:5.0), (WAJIB TANPA FITUR WAJAH:3.0)) and Islamic clothing while changing only pose/gesture and tiny details.';
            } else if (characterStyle === 'SUPER REALISTIS') {
              endEditInstruction +=
                ' CRITICAL STYLE RULE: Maintain the "SUPER REALISTIS" photorealistic style (high-end Sony mirrorless camera look). Do NOT make it look like CGI or cartoon.';
            }

            try {
              const result = await window.zeoAPI.editStoryFrame({
                bearerKey,
                aspectRatio,
                imageResolution,
                instruction: endEditInstruction,
                imageBase64: base64,
                mode: 'end-from-start',
              });

              if (!result || !result.ok || !result.dataUrl) {
                const message = (result && result.error) || 'Failed to generate a new image.';
                lastError = lastError || message;
              } else {
                newUrl = result.dataUrl as string;
              }
            } catch (error: any) {
              const message = error?.message || String(error);
              lastError = lastError || message;
            }
          }
        }
      }

      // 1) Coba dulu engine utama story (GEM_PIX via generate-story-scene-images) jika belum berhasil dari edit START->END
      if (!newUrl && hasStoryImageEngine) {
        const result = await window.zeoAPI.generateStorySceneImages?.({
          bearerKey,
          aspectRatio,
          imageResolution,
          startPrompt: kind === 'start' ? startPrompt : '',
          endPrompt: kind === 'end' ? endPrompt : '',
          references: {
            product: null,
            models: modelBase64List,
            additional: [],
          },
        });

        if (result && result.ok) {
          newUrl = kind === 'start' ? result.start?.dataUrl : result.end?.dataUrl;
        } else if (result && !result.ok) {
          lastError = lastError || result.error || 'Failed to generate a new image.';
        }
      }

      // 2) Jika semua di atas gagal, fallback ke affiliate image engine (lama)
      if (!newUrl && hasAffiliateImageEngine) {
        const prompt = kind === 'start' ? startPrompt : endPrompt;
        const result = await window.zeoAPI.generateAffiliateImages?.({
          bearerKey,
          aspectRatioKey,
          imageResolution,
          items: [{ category: 'broll', prompt }],
          references: {
            product: null,
            models: modelBase64List,
            additional: [],
          },
        });

        if (!result || !result.ok || !Array.isArray(result.results) || !result.results[0]) {
          const message = (result && result.error) || 'Failed to generate a new image.';
          lastError = lastError || message;
        } else {
          const item = result.results[0];
          if (!item.success || !item.dataUrl) {
            const message = item.error || 'Failed to generate a new image.';
            lastError = lastError || message;
          } else {
            newUrl = item.dataUrl as string;
          }
        }
      }

      if (!newUrl) {
        addLog(
          'ERROR',
          t.storyGenerator.regenFrameFailed.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(scene.scene_number)).replace('{error}', lastError || t.storyGenerator.regenFrameNoImage),
        );
        setSceneImageMap((prev) => ({
          ...prev,
          [scene.scene_number]: {
            ...(prev[scene.scene_number] || { status: 'success' as SceneImageStatus }),
            isRegeneratingStart: false,
            isRegeneratingEnd: false,
          },
        }));
        return;
      }

      setSceneImageMap((prev) => {
        const current = prev[scene.scene_number] || { status: 'success' as SceneImageStatus };
        const startHistory = current.startHistory || [];
        const endHistory = current.endHistory || [];
        const prevStart = current.startUrl;
        const prevEnd = current.endUrl;

        let nextStartHistory = startHistory;
        let nextEndHistory = endHistory;

        if (kind === 'start' && prevStart) {
          nextStartHistory = [...startHistory, prevStart].slice(-MAX_FRAME_HISTORY);
        } else if (kind === 'end' && prevEnd) {
          nextEndHistory = [...endHistory, prevEnd].slice(-MAX_FRAME_HISTORY);
        }

        return {
          ...prev,
          [scene.scene_number]: {
            ...current,
            status: 'success',
            startUrl: kind === 'start' ? newUrl : current.startUrl,
            endUrl: kind === 'end' ? newUrl : current.endUrl,
            isRegeneratingStart: false,
            isRegeneratingEnd: false,
            error: undefined,
            startHistory: nextStartHistory,
            endHistory: nextEndHistory,
          },
        };
      });

      addLog('SUCCESS', t.storyGenerator.regenFrameSuccess.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(scene.scene_number)));
    } catch (error: any) {
      const message = error?.message || String(error);
      addLog('ERROR', t.storyGenerator.regenFrameFailed.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(scene.scene_number)).replace('{error}', message));
      setSceneImageMap((prev) => ({
        ...prev,
        [scene.scene_number]: {
          ...(prev[scene.scene_number] || { status: 'success' as SceneImageStatus }),
          isRegeneratingStart: false,
          isRegeneratingEnd: false,
        },
      }));
    }
  };

  const handlePovFrame = async (scene: GeneratedScene, kind: FrameKind) => {
    const sceneState = sceneImageMap[scene.scene_number];
    const imageUrl = kind === 'start' ? sceneState?.startUrl : sceneState?.endUrl;

    if (!imageUrl) {
      addLog('ERROR', t.storyGenerator.povImageNotAvailable.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(scene.scene_number)));
      return;
    }

    if (!imageUrl.startsWith('data:image')) {
      addLog('ERROR', t.storyGenerator.povInvalidFormat.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(scene.scene_number)));
      return;
    }

    const base64 = imageUrl.split(',')[1] || '';
    if (!base64) {
      addLog('ERROR', t.storyGenerator.povEmptyData.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(scene.scene_number)));
      return;
    }

    if (!ensureAuthReady()) {
      return;
    }

    let povInstruction = `This is an image that is cropped too tightly. Your task is to "uncrop" or "outpaint" this image, expanding the view to reveal more of the scene around the central subject. The result must be a SINGLE, UNIFIED IMAGE. Do not create multiple panels or add any text. The original content of the image (characters, objects, style) MUST remain IDENTICAL and perfectly preserved. Simply add more details to the top, bottom, and sides to create a wider composition. ABSOLUTELY CRITICAL RULE: The final image aspect ratio MUST BE exactly ${aspectRatio}.`;

    if (characterStyle === 'Animasi Syariah') {
      povInstruction +=
        ' CRITICAL STYLE RULE: Maintain the "Animasi Syariah" style ((no eyes:5.0), (no nose:5.0), ALL characters faceless (faceless:3.0), (WAJIB TANPA FITUR WAJAH:3.0), Islamic attire, 3D style).';
    } else if (characterStyle === 'SUPER REALISTIS') {
      povInstruction +=
        ' CRITICAL STYLE RULE: Maintain the "SUPER REALISTIS" style (photorealistic, Sony mirrorless camera look).';
    }

    if (typeof window === 'undefined' || !window.zeoAPI?.editStoryFrame) {
      addLog('ERROR', t.storyGenerator.povEngineUnavailable.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(scene.scene_number)));
      return;
    }

    const bearerKey = localStorage.getItem('zeoStudio.bearerToken') || '';
    if (!bearerKey.trim()) {
      addLog('ERROR', t.storyGenerator.povBearerMissing.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(scene.scene_number)));
      return;
    }

    addLog('INFO', t.storyGenerator.runningPov.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(scene.scene_number)));

    try {
      setSceneImageMap((prev) => ({
        ...prev,
        [scene.scene_number]: {
          ...(prev[scene.scene_number] || { status: 'success' as SceneImageStatus }),
          isPovStart: kind === 'start',
          isPovEnd: kind === 'end',
        },
      }));

      const result = await window.zeoAPI.editStoryFrame({
        bearerKey,
        aspectRatio,
        imageResolution,
        instruction: povInstruction,
        imageBase64: base64,
        mode: 'pov',
      });

      if (!result || !result.ok || !result.dataUrl) {
        const message = (result && result.error) || t.storyGenerator.povFailedGenerate;
        addLog('ERROR', t.storyGenerator.povFailed.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(scene.scene_number)).replace('{error}', message));
        setSceneImageMap((prev) => ({
          ...prev,
          [scene.scene_number]: {
            ...(prev[scene.scene_number] || { status: 'success' as SceneImageStatus }),
            isPovStart: false,
            isPovEnd: false,
          },
        }));
        return;
      }

      const newUrl = result.dataUrl as string;

      setSceneImageMap((prev) => {
        const current = prev[scene.scene_number] || { status: 'success' as SceneImageStatus };
        const startHistory = current.startHistory || [];
        const endHistory = current.endHistory || [];
        const prevStart = current.startUrl;
        const prevEnd = current.endUrl;

        let nextStartHistory = startHistory;
        let nextEndHistory = endHistory;

        if (kind === 'start' && prevStart) {
          nextStartHistory = [...startHistory, prevStart].slice(-MAX_FRAME_HISTORY);
        } else if (kind === 'end' && prevEnd) {
          nextEndHistory = [...endHistory, prevEnd].slice(-MAX_FRAME_HISTORY);
        }

        return {
          ...prev,
          [scene.scene_number]: {
            ...current,
            status: 'success',
            startUrl: kind === 'start' ? newUrl : current.startUrl,
            endUrl: kind === 'end' ? newUrl : current.endUrl,
            error: undefined,
            isPovStart: false,
            isPovEnd: false,
            startHistory: nextStartHistory,
            endHistory: nextEndHistory,
          },
        };
      });

      addLog('SUCCESS', t.storyGenerator.povSuccess.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(scene.scene_number)));
    } catch (error: any) {
      const message = error?.message || String(error);
      addLog('ERROR', t.storyGenerator.povFailed.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(scene.scene_number)).replace('{error}', message));
      setSceneImageMap((prev) => ({
        ...prev,
        [scene.scene_number]: {
          ...(prev[scene.scene_number] || { status: 'success' as SceneImageStatus }),
          isPovStart: false,
          isPovEnd: false,
        },
      }));
    }
  };

  const handleApplyCameraAngle = async (
    scene: GeneratedScene,
    kind: FrameKind,
    angleKey: CameraAngleKey,
  ) => {
    const sceneState = sceneImageMap[scene.scene_number];
    const imageUrl = kind === 'start' ? sceneState?.startUrl : sceneState?.endUrl;

    if (!imageUrl) {
      addLog('ERROR', t.storyGenerator.angleImageNotAvailable.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(scene.scene_number)));
      return;
    }

    if (!imageUrl.startsWith('data:image')) {
      addLog('ERROR', t.storyGenerator.angleInvalidFormat.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(scene.scene_number)));
      return;
    }

    const base64 = imageUrl.split(',')[1] || '';
    if (!base64) {
      addLog('ERROR', t.storyGenerator.angleEmptyData.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(scene.scene_number)));
      return;
    }

    if (!ensureAuthReady()) {
      return;
    }

    const angleDescriptions: Record<CameraAngleKey, string> = {
      'eye-level': 'neutral eye-level shot at the height of the main character',
      'low-angle': 'LOW ANGLE shot looking slightly upward at the main character to make them feel more heroic/powerful',
      'high-angle': 'HIGH ANGLE shot looking slightly downward at the scene',
      'close-up': 'CLOSE-UP shot that moves the camera closer to the main character, focusing on face and upper body',
      'wide-shot': 'WIDE SHOT that moves the camera back to show more of the environment while keeping the same action',
      'over-shoulder':
        'OVER-THE-SHOULDER shot from behind the main character, still looking at the same subject in front of them',
    };

    const angleText = angleDescriptions[angleKey] || 'neutral eye-level shot at the height of the main character';

    let angleInstruction = `You are editing this image by changing ONLY the virtual camera angle. Target camera angle: ${angleText}. The STORY MOMENT, characters, poses, props, and environment MUST remain exactly the same as in the original image. DO NOT change the character design, clothing, facial features, body proportions, or lighting style. Just reposition the virtual camera to achieve the new angle. The result MUST have an OBVIOUSLY different camera angle compared to the original (do NOT return an identical or nearly identical framing). The final image MUST keep the same aspect ratio ${aspectRatio} and remain a single unified frame without any text or UI.`;

    if (characterStyle === 'Animasi Syariah') {
      angleInstruction +=
        ' CRITICAL STYLE RULE: Maintain the "Animasi Syariah" 3D faceless character style ((no eyes:5.0), (no nose:5.0), (WAJIB TANPA FITUR WAJAH:3.0)) and Islamic clothing while changing only the camera angle.';
    } else if (characterStyle === 'SUPER REALISTIS') {
      angleInstruction +=
        ' CRITICAL STYLE RULE: Maintain the "SUPER REALISTIS" photorealistic style (high-end Sony mirrorless look) while changing only the camera angle.';
    }

    if (typeof window === 'undefined' || !window.zeoAPI?.editStoryFrame) {
      addLog('ERROR', t.storyGenerator.angleEngineUnavailable.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(scene.scene_number)));
      return;
    }

    const bearerKey = localStorage.getItem('zeoStudio.bearerToken') || '';
    if (!bearerKey.trim()) {
      addLog('ERROR', t.storyGenerator.angleBearerMissing.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(scene.scene_number)));
      return;
    }

    addLog('INFO', t.storyGenerator.changingAngle.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(scene.scene_number)));

    setAngleMenuState(null);

    setSceneImageMap((prev) => ({
      ...prev,
      [scene.scene_number]: {
        ...(prev[scene.scene_number] || { status: 'success' as SceneImageStatus }),
        isAngleStart: kind === 'start',
        isAngleEnd: kind === 'end',
      },
    }));

    try {
      const result = await window.zeoAPI.editStoryFrame({
        bearerKey,
        aspectRatio,
        imageResolution,
        instruction: angleInstruction,
        imageBase64: base64,
        mode: 'angle',
      });

      if (!result || !result.ok || !result.dataUrl) {
        const message = (result && result.error) || t.storyGenerator.angleFailedGenerate;
        addLog('ERROR', t.storyGenerator.angleFailed.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(scene.scene_number)).replace('{error}', message));
        setSceneImageMap((prev) => ({
          ...prev,
          [scene.scene_number]: {
            ...(prev[scene.scene_number] || { status: 'success' as SceneImageStatus }),
            isAngleStart: false,
            isAngleEnd: false,
          },
        }));
        return;
      }

      const newUrl = result.dataUrl as string;

      setSceneImageMap((prev) => {
        const current = prev[scene.scene_number] || { status: 'success' as SceneImageStatus };
        const startHistory = current.startHistory || [];
        const endHistory = current.endHistory || [];
        const prevStart = current.startUrl;
        const prevEnd = current.endUrl;

        let nextStartHistory = startHistory;
        let nextEndHistory = endHistory;

        if (kind === 'start' && prevStart) {
          nextStartHistory = [...startHistory, prevStart].slice(-MAX_FRAME_HISTORY);
        } else if (kind === 'end' && prevEnd) {
          nextEndHistory = [...endHistory, prevEnd].slice(-MAX_FRAME_HISTORY);
        }

        return {
          ...prev,
          [scene.scene_number]: {
            ...current,
            status: 'success',
            startUrl: kind === 'start' ? newUrl : current.startUrl,
            endUrl: kind === 'end' ? newUrl : current.endUrl,
            error: undefined,
            isAngleStart: false,
            isAngleEnd: false,
            startHistory: nextStartHistory,
            endHistory: nextEndHistory,
          },
        };
      });

      addLog('SUCCESS', t.storyGenerator.angleSuccess.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(scene.scene_number)));
    } catch (error: any) {
      const message = error?.message || String(error);
      addLog('ERROR', t.storyGenerator.angleFailed.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(scene.scene_number)).replace('{error}', message));
      setSceneImageMap((prev) => ({
        ...prev,
        [scene.scene_number]: {
          ...(prev[scene.scene_number] || { status: 'success' as SceneImageStatus }),
          isAngleStart: false,
          isAngleEnd: false,
        },
      }));
    }
  };

  const handleOpenFrameEditModal = (scene: GeneratedScene, kind: FrameKind) => {
    const sceneState = sceneImageMap[scene.scene_number];
    const imageUrl = kind === 'start' ? sceneState?.startUrl : sceneState?.endUrl;

    if (!imageUrl) {
      addLog('ERROR', t.storyGenerator.editOpenFailed.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(scene.scene_number)));
      return;
    }

    setFrameEditModal({
      isOpen: true,
      sceneNumber: scene.scene_number,
      kind,
      imageUrl,
      instruction: '',
      isSubmitting: false,
    });
  };

  const handleCloseFrameEditModal = () => {
    setFrameEditModal((prev) => ({ ...prev, isOpen: false, isSubmitting: false }));
  };

  const handleApplyFrameEdit = async () => {
    if (!frameEditModal.sceneNumber || !frameEditModal.kind || !frameEditModal.imageUrl) {
      return;
    }

    if (!ensureAuthReady()) {
      return;
    }

    const sceneNumber = frameEditModal.sceneNumber;
    const kind = frameEditModal.kind;
    const imageUrl = frameEditModal.imageUrl;
    const editInstruction = frameEditModal.instruction.trim();

    if (!editInstruction) {
      addLog('ERROR', t.storyGenerator.editEmptyInstruction.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(sceneNumber)));
      return;
    }

    if (!imageUrl.startsWith('data:image')) {
      addLog('ERROR', t.storyGenerator.editInvalidFormat.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(sceneNumber)));
      return;
    }

    const base64 = imageUrl.split(',')[1] || '';
    if (!base64) {
      addLog('ERROR', t.storyGenerator.editEmptyData.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(sceneNumber)));
      return;
    }

    let editInstructionText = `Based on this instruction: "${editInstruction}", edit the following image. The result must be a SINGLE, UNIFIED IMAGE, not multiple panels or containing any text. Keep the rest of the image highly consistent. ABSOLUTELY CRITICAL RULE: The final image aspect ratio MUST BE exactly ${aspectRatio}.`;

    if (characterStyle === 'Animasi Syariah') {
      editInstructionText = `Based on this instruction: "${editInstruction}", edit the following image. CRITICAL STYLE RULE: The "Animasi Syariah" style MUST be maintained ((no eyes:5.0), (no nose:5.0), ALL characters faceless (faceless:3.0), (WAJIB TANPA FITUR WAJAH:3.0), Islamic attire, 3D style). Keep the rest of the image consistent. The result must be a SINGLE, UNIFIED IMAGE, not multiple panels. The final image aspect ratio MUST BE exactly ${aspectRatio}.`;
    } else if (characterStyle === 'SUPER REALISTIS') {
      editInstructionText = `Based on this instruction: "${editInstruction}", edit the following image. CRITICAL STYLE RULE: The "SUPER REALISTIS" style MUST be maintained (photorealistic, Sony mirrorless camera look). Keep the rest of the image consistent. The result must be a SINGLE, UNIFIED IMAGE, not multiple panels. The final image aspect ratio MUST BE exactly ${aspectRatio}.`;
    }

    if (typeof window === 'undefined' || !window.zeoAPI?.editStoryFrame) {
      addLog('ERROR', t.storyGenerator.editEngineUnavailable.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(sceneNumber)));
      return;
    }

    const bearerKey = localStorage.getItem('zeoStudio.bearerToken') || '';
    if (!bearerKey.trim()) {
      addLog('ERROR', t.storyGenerator.editBearerMissing.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(sceneNumber)));
      return;
    }

    addLog('INFO', t.storyGenerator.runningEdit.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(sceneNumber)));

    // Tutup modal segera dan tandai frame sedang di-edit
    setFrameEditModal((prev) => ({ ...prev, isSubmitting: true, isOpen: false }));

    setSceneImageMap((prev) => ({
      ...prev,
      [sceneNumber]: {
        ...(prev[sceneNumber] || { status: 'success' as SceneImageStatus }),
        isEditingStart: kind === 'start',
        isEditingEnd: kind === 'end',
      },
    }));

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
        const message = (result && result.error) || t.storyGenerator.editFailedGenerate;
        addLog('ERROR', t.storyGenerator.editFailed.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(sceneNumber)).replace('{error}', message));
        setFrameEditModal((prev) => ({ ...prev, isSubmitting: false }));
        return;
      }

      const newUrl = result.dataUrl as string;

      setSceneImageMap((prev) => {
        const current = prev[sceneNumber] || { status: 'success' as SceneImageStatus };
        const startHistory = current.startHistory || [];
        const endHistory = current.endHistory || [];
        const prevStart = current.startUrl;
        const prevEnd = current.endUrl;

        let nextStartHistory = startHistory;
        let nextEndHistory = endHistory;

        if (kind === 'start' && prevStart) {
          nextStartHistory = [...startHistory, prevStart].slice(-MAX_FRAME_HISTORY);
        } else if (kind === 'end' && prevEnd) {
          nextEndHistory = [...endHistory, prevEnd].slice(-MAX_FRAME_HISTORY);
        }

        return {
          ...prev,
          [sceneNumber]: {
            ...current,
            status: 'success',
            startUrl: kind === 'start' ? newUrl : current.startUrl,
            endUrl: kind === 'end' ? newUrl : current.endUrl,
            error: undefined,
            isEditingStart: false,
            isEditingEnd: false,
            startHistory: nextStartHistory,
            endHistory: nextEndHistory,
          },
        };
      });

      addLog('SUCCESS', t.storyGenerator.editSuccess.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(sceneNumber)));
      setFrameEditModal((prev) => ({ ...prev, isOpen: false, isSubmitting: false }));
    } catch (error: any) {
      const message = error?.message || String(error);
      addLog('ERROR', t.storyGenerator.editFailed.replace('{kind}', kind.toUpperCase()).replace('{scene}', String(sceneNumber)).replace('{error}', message));
      setFrameEditModal((prev) => ({ ...prev, isSubmitting: false }));
      setSceneImageMap((prev) => ({
        ...prev,
        [sceneNumber]: {
          ...(prev[sceneNumber] || { status: 'success' as SceneImageStatus }),
          isEditingStart: false,
          isEditingEnd: false,
        },
      }));
    }
  };

  const buildSceneImagePrompts = (scene: GeneratedScene) => {
    const { plainEn } = buildScenePlainTexts(scene);

    const filteredScenePrompt = plainEn
      .split('\n')
      .filter((line) => !line.toLowerCase().startsWith('dialogue & audio:'))
      .join('\n')
      .trim();

    const characterPrompt = getLockedCharacterPrompt();

    let styleInstruction = '';
    if (characterStyle === 'Animasi Syariah') {
      styleInstruction =
        'CRITICAL STYLE RULE: This is "Animasi Syariah" 3D animation style. ALL CHARACTERS (main and background) MUST be faceless (faceless:3.0), with no eyes (no eyes:5.0), no nose (no nose:5.0), no eyebrows (no eyebrows:3.0), and MUST wear modest Islamic attire (gamis/koko/peci for male, syari hijab for female).';
    } else if (characterStyle === 'Fortnite Toon 3D') {
      styleInstruction =
        'CRITICAL STYLE RULE: This is "Fortnite Toon 3D" style. Characters must be stylized 3D with bold colors, slight outlines, clean shapes, and game-like lighting—no photorealism. Keep proportions consistent and avoid realistic skin or camera looks.';
    } else if (characterStyle === 'Animasi Gaya Pixar') {
      styleInstruction =
        'CRITICAL STYLE RULE: This is "Pixar"-inspired 3D animation style. Characters must have expressive faces, big friendly eyes, soft rounded shapes, and vibrant colors, similar to modern Pixar films. Keep proportions and style consistent across all scenes.';
    } else {
      styleInstruction = `CRITICAL STYLE RULE: Use a consistent "${characterStyle}" visual style for all characters and scenes.`;
    }

    const aspectInstruction = `The final image aspect ratio MUST BE exactly ${aspectRatio}. The image must NOT contain any text, letters, numbers, UI, subtitles, or watermarks.`;

    const characterInstruction = characterPrompt
      ? `The appearance of every main character in this image MUST be perfectly consistent with the following reference description. Use it ONLY for face, body, hair, clothing, and accessories, but IGNORE its original camera, lens, or lighting instructions. The visual style MUST follow the style rule above.\n\n${characterPrompt}`
      : getCharacterPromptInfo(false);

    const consistencyInstruction =
      'CRITICAL CONSISTENCY RULE: All main characters MUST look IDENTICAL across ALL frames and ALL scenes in this storyboard. Do NOT change their face shape, skin tone, hairstyle, hair color, body proportions, or clothing layers from one frame/scene to another, unless the story explicitly says that the outfit changes (for example: from diving suit to school uniform). You may change only camera angle, pose, gesture, and facial expression while keeping the same character design.';

    const baseInstruction = `Generate a single, unified image for ONE storyboard frame. DO NOT create a collage, comic strip, split-screen, or multiple panels in one image. The image must represent only ONE scene.`;

    const common = `${baseInstruction}\n${aspectInstruction}\n${styleInstruction}\n${consistencyInstruction}\n\n${characterInstruction}`;

    const sceneDescription = `Scene #${scene.scene_number} description (for visual only, no subtitles):\n${filteredScenePrompt}`;

    const startPrompt = `${common}\n\nThe image should represent the natural STARTING composition of this scene, before any large motion happens.\n\n${sceneDescription}`;
    const endPrompt = `${common}\n\nThe image should represent the END composition of this scene, capturing the most important moment or pose just before cutting to the next scene.\n\n${sceneDescription}`;

    return { startPrompt, endPrompt };
  };

  const getGeminiTextModel = () => {
    if (typeof window === 'undefined') return DEFAULT_TEXT_MODEL;
    const configuredModel = localStorage.getItem('zeoStudio.ai.model') || '';
    return configuredModel.trim() || DEFAULT_TEXT_MODEL;
  };

  const callGemini = useCallback(
    async (payload: unknown, overrideModel?: string): Promise<any | null> => {
      if (typeof window === 'undefined') {
        showAlert(t.storyGenerator.aiDesktopOnly);
        return null;
      }

      if (!ensureAuthReady()) {
        return null;
      }

      const apiKey = localStorage.getItem('zeoStudio.ai.apiKey') || '';
      const provider = localStorage.getItem('zeoStudio.ai.provider') || '';

      if (!apiKey || !provider) {
        showAlert(t.storyGenerator.aiConfigIncomplete);
        return null;
      }

      if (provider !== 'Gemini') {
        showAlert(t.storyGenerator.aiGeminiOnly);
        return null;
      }

      // Simple cooldown after rate limit/quota to avoid spamming the API
      const COOLDOWN_MS = 45_000;
      if (lastGeminiQuotaErrorRef.current) {
        const elapsed = Date.now() - lastGeminiQuotaErrorRef.current;
        if (elapsed < COOLDOWN_MS) {
          const remaining = Math.max(1, Math.ceil((COOLDOWN_MS - elapsed) / 1000));
          const now = Date.now();
          if (!lastGeminiCooldownLogRef.current || now - lastGeminiCooldownLogRef.current > 5000) {
            addLog('INFO', t.storyGenerator.geminiCooldown.replace('{seconds}', String(remaining)));
            lastGeminiCooldownLogRef.current = now;
          }
          return null;
        }
      }

      const model = overrideModel || getGeminiTextModel();
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const status = response.status;
          let errorMessage = `API Error: ${status}`;
          let isQuotaError = false;
          try {
            const body = await response.json();
            const raw = body?.error?.message as string | undefined;
            if (raw) {
              errorMessage = raw;
            }
          } catch {
            // ignore JSON parse error
          }

          if (
            errorMessage.includes('You exceeded your current quota') ||
            errorMessage.includes('Quota exceeded')
          ) {
            isQuotaError = true;
          }

          if (isQuotaError || status === 429) {
            lastGeminiQuotaErrorRef.current = Date.now();
            addLog('ERROR', t.storyGenerator.geminiQuotaError);
          } else if (status === 401 || status === 403) {
            addLog('ERROR', t.storyGenerator.geminiAuthError);
          } else if (status >= 500 && status < 600) {
            addLog('ERROR', t.storyGenerator.geminiServerError);
          } else {
            addLog('ERROR', t.storyGenerator.geminiCallFailed.replace('{error}', errorMessage));
          }

          return null;
        }

        return response.json();
      } catch (error: any) {
        const message = error?.message || 'Failed to reach AI.';
        addLog('ERROR', t.storyGenerator.geminiNetworkError.replace('{error}', message));
        return null;
      }
    },
    [addLog, ensureAuthReady, getGeminiTextModel, showAlert],
  );

  const cleanAndParseJson = (text: string | null | undefined) => {
    if (!text) return null;
    let jsonString = text.trim();
    const match = jsonString.match(/```json\s*([\s\S]*?)\s*```/);
    if (match) {
      jsonString = match[1];
    }
    try {
      return JSON.parse(jsonString);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to parse JSON from AI:', e, jsonString);
      return null;
    }
  };

  const handleGeminiResponse = <T,>(result: any): { error: boolean; data: T | null } => {
    if (!result) {
      // callGemini sudah mencatat error jaringan / HTTP
      return { error: true, data: null };
    }

    if (result.promptFeedback && result.promptFeedback.blockReason) {
      addLog('ERROR', t.storyGenerator.geminiSafetyBlocked);
      return { error: true, data: null };
    }

    const candidate = result.candidates && result.candidates[0];
    if (!candidate) {
      addLog('ERROR', t.storyGenerator.geminiNoAnswer);
      return { error: true, data: null };
    }

    const finishReason = candidate.finishReason as string | undefined;
    if (finishReason === 'SAFETY') {
      addLog('ERROR', t.storyGenerator.geminiSafetyContent);
      return { error: true, data: null };
    }
    if (finishReason === 'MAX_TOKENS') {
      addLog('ERROR', t.storyGenerator.geminiMaxTokens);
      return { error: true, data: null };
    }

    const parts = candidate.content?.parts || [];
    if (!parts.length) {
      addLog('ERROR', t.storyGenerator.geminiEmptyResponse);
      return { error: true, data: null };
    }

    if (parts[0].inlineData) {
      return { error: false, data: result as T };
    }

    const text = parts[0].text as string | undefined;
    if (!text) {
      addLog('ERROR', t.storyGenerator.geminiEmptyText);
      return { error: true, data: null };
    }
    return { error: false, data: text.trim() as T };
  };

  const langLabel = language === 'en' ? 'English' : language === 'ms' ? 'Bahasa Melayu' : 'Bahasa Indonesia';

  const getTopicInfo = () => {
    const safeDetail = topicDetail ? sanitizeUserText(topicDetail) : '';
    return `Main Topic: "${topic}"${safeDetail ? `, Topic Detail: "${safeDetail}"` : ''}`;
  };

  const getCharacterPromptInfo = (forSyariahRule = false) => {
    let info = `Primary visual style is '${characterStyle}'. All characters must be drawn in this style. `;

    if (characterStyle === 'Animasi Syariah') {
      info +=
        "This style is 'Animasi Syariah'. STRICT RULES: ALL CHARACTERS MUST be rendered as 3D characters (NO FACE:2.0), (NO EYES:5.0), (NO NOSE:5.0), (MANDATORY NO FACIAL FEATURES:3.0). Clothing MUST be Islamic-inspired (men: gamis/koko and peci; women: syari hijab). ";
    } else if (characterStyle === 'Fortnite Toon 3D') {
      info +=
        "This style is 'Fortnite Toon 3D'. Characters are stylized 3D with bold colors, slight outlines, and a game/toon look—never photorealistic. ";
    }

    const hasCharacterDetails = characters.some((c) => c.name.trim() || c.details.trim() || c.imageBase64);
    if (!hasCharacterDetails) {
      const count = characters.length || 1;
      info += `No specific character details were provided by the user. Therefore, create ${count} main characters that are highly specific and detailed. For each character, describe face shape, hair color and style, eye color, layered clothing (e.g., white cotton shirt under a blue denim jacket), footwear, and accessories. Ensure every character description is rich with visual detail. Ensure these character appearances stay consistent across all scenes.`;
    } else {
      info += `There are ${characters.length} main characters. Details: `;
      characters.forEach((c, i) => {
        const roleText = c.role ? `Role=${c.role}. ` : '';
        let baseDesc = `Character ${i + 1}: Name=${c.name || 'not specified'}, Age=${c.age || 'not specified'}. ${roleText}`;
        if (c.details.trim()) {
          baseDesc +=
            "Based on the user description: '" +
            c.details +
            "', expand into a highly specific, detailed visual description. Explain face shape, hair color and style, eye color, layered clothing (e.g., white cotton shirt under a blue denim jacket), footwear, and accessories. Make each character description very rich in visual detail. ";
          if (characterStyle === 'Animasi Syariah') {
            baseDesc +=
              " ENSURE the clothing description is Islamic attire (gamis/koko/peci for men, syari hijab for women) and replace face description with 'plain 3D face without features, (no eyes:5.0), (no nose:5.0), (MANDATORY NO FACIAL FEATURES:3.0)'. ";
          }
        }
        if (c.imageBase64 && !forSyariahRule) {
          baseDesc +=
            'This character’s appearance MUST BE VERY SIMILAR and CONSISTENT with the provided reference image. DO NOT change clothing, hair, or facial features unless explicitly instructed in the story flow.';
        }
        info += baseDesc;
      });
    }
    return info;
  };

  const getStorytellingStyleInstruction = () => {
    switch (storytellingStyle) {
      case 'Narasi':
        return "Storytelling Style is 'Narration', meaning ONLY CHARACTERS in the video speak (dialogue). NO narrator voice. In 'Core Scene Description', explicitly mention that the character is seen speaking (e.g., 'mouth is moving while talking'). Use short dialogue with very simple language that kids can understand.";
      case 'Voice Over':
        return "Storytelling Style is 'Voice Over', meaning ONLY THE NARRATOR VOICE exists. Characters in the video MUST NOT be seen speaking. In 'Core Scene Description', make sure to state the character is NOT seen speaking (e.g., 'mouth closed', 'listening', or 'only expressing'). Narration should sound clear, calm, and like a storyteller guiding children.";
      case 'Kombinasi':
        return "Storytelling Style is 'Combination'. This means the 'Dialogue & Audio' column MUST include a mix of narrator voice (voice-over) AND/OR character dialogue. This column cannot be empty. Use clear formatting: 'Narrator: [narration text]. [Character Name]: \"[dialogue text]\".' In 'Core Scene Description', if character dialogue exists, mention that the character is seen talking. If only the narrator speaks, ensure characters are not shown speaking. At least one (narrator or character) must speak in every scene.";
      case 'Visual saja':
        return "Storytelling Style is 'Visual only'. The 'Dialogue & Audio' content MUST ONLY contain sound effect (SFX) descriptions like '[wind sound]'. NO narration or dialogue. Use sound effects that help explain the visual action (e.g., footsteps, door opening, water sounds).";
      case 'Dongeng Sebelum Tidur':
        return "Storytelling Style is 'Bedtime Story'. ONLY a gentle narrator voice, like a parent reading a bedtime story. The story pace is slow and calming; avoid tense or scary moods. Characters in the video do not need to be shown speaking; focus on calm and comforting expressions.";
      case 'Dokumenter Edukatif':
        return "Storytelling Style is 'Educational Documentary'. ONLY a narrator voice as the main storyteller. Narration should sound like an educational documentary for kids: clear, structured, and explaining key lessons or facts from each scene in short sentences. Characters may appear as visual examples but need not have much dialogue.";
      case 'Komedi Ringan':
        return "Storytelling Style is 'Light Comedy'. The story should feel funny, cheerful, and light for kids. Use playful yet polite dialogue, without insults or harsh humor. In every scene, aim for a small laugh moment (fun surprise, exaggerated funny reaction, or safe silly situation).";
      case 'Free Style': {
        const noteRaw = customStorytellingStyleNote.trim();
        if (noteRaw) {
          try {
            const safeNote = moderateInputOrThrow(noteRaw);
            return `Storytelling Style is 'Free Style'. Follow this user instruction as the TOP PRIORITY: "${safeNote}". Still ensure the story and audio are kid-friendly and follow all other rules in this prompt.`;
          } catch (e) {
            return "Storytelling Style is 'Free Style'. The user note was blocked for safety; continue with a creative, kid-friendly style following all rules in this prompt.";
          }
        }
        return "Storytelling Style is 'Free Style'. The user did not provide special instructions, so use a creative style that remains kid-friendly and follows all other rules in this prompt.";
      }
      default:
        return 'Storytelling style is not specified.';
    }
  };

  const handleTopicClick = (value: Topic) => {
    setTopic(value);
    // Fokuskan input detail topik supaya langsung bisa diketik
    setTimeout(() => topicDetailRef.current?.focus(), 0);
  };

  const handleRekomTopic = async () => {
    if (!topicDetail.trim() && !topic) {
      showAlert(t.storyGenerator.topicOrDetailRequired);
      return;
    }

    if (!ensureAuthReady()) {
      return;
    }

    const baseText = topicDetail.trim();
    const historyPrompt =
      topicHistory.length > 0
        ? `Do not repeat ideas similar to these: ${topicHistory.join(', ')}.`
        : '';

    const targetLang = langLabel;
    let safeBaseText = sanitizeUserText(baseText);
    try {
      if (baseText) {
        safeBaseText = moderateInputOrThrow(baseText);
      }
    } catch (e) {
      showAlert((e as Error).message);
      return;
    }
    const instruction = safeBaseText
      ? `Expand this story idea: "${safeBaseText}" into a super-detailed narrative concept for a short animated video. Explain the premise, brief character introductions, main conflict, and resolution in one rich paragraph. Write the idea in ${targetLang}.`
      : `Provide one specific, creative, and engaging story idea or topic for the "${topic}" category suitable for kids. Write the idea in ${targetLang}.`;

    const payload = {
      contents: [
        {
          parts: [
            {
              text: appendSafety(
                `${instruction} ${historyPrompt} Answer ONLY with the topic idea itself, short and concise without any preamble, using ${targetLang}.`,
              ),
            },
          ],
        },
      ],
    };

    addLog('INFO', t.storyGenerator.requestingTopicRecom);

    setIsRekomTopicLoading(true);
    try {
      const result = await callGemini(payload);
      const { error, data } = handleGeminiResponse<string>(result);
      if (!error && data) {
        const newTopic = data.replace(/["']/g, '');
        setTopicDetail(newTopic);
        setTopicHistory((prev) => {
          const next = [...prev, newTopic];
          if (next.length > 5) next.shift();
          return next;
        });
        addLog('SUCCESS', t.storyGenerator.topicRecomSuccess);
      } else {
        addLog('ERROR', t.storyGenerator.topicRecomFailed);
      }
    } finally {
      setIsRekomTopicLoading(false);
    }
  };

  const handleApplyCharacterCount = () => {
    const parsed = parseInt(characterCountInput || '1', 10);
    const safeCount = Number.isNaN(parsed) ? 1 : Math.max(1, Math.min(parsed, 6));
    setCharacterCountInput(String(safeCount));
    setCharacters(
      Array.from({ length: safeCount }, () => ({
        name: '',
        age: 'Kids',
        role: 'Protagonist',
        details: '',
        imagePreview: null,
        imageBase64: null,
        isGeneratingDescription: false,
        visualImageUrl: null,
        isGeneratingVisual: false,
      })),
    );
  };

  const handleCharacterFieldChange = (index: number, field: keyof Character, value: string) => {
    setCharacters((prev) => {
      const next = [...prev];
      const current = next[index];
      if (!current) return prev;
      next[index] = {
        ...current,
        [field]: value,
      };
      return next;
    });
  };

  const handleGenerateCharacterVisual = useCallback(
    async (index: number, baseChar: Character) => {
      const char = baseChar;
      if (!char) return;

      if (!ensureAuthReady()) {
        return;
      }

      if (typeof window === 'undefined' || !window.zeoAPI?.generateAffiliateImages) {
        addLog('ERROR', t.storyGenerator.characterVisualEngineUnavailable.replace('{index}', String(index + 1)));
        return;
      }

      const bearerKey = localStorage.getItem('zeoStudio.bearerToken') || '';
      if (!bearerKey.trim()) {
        addLog('ERROR', t.storyGenerator.characterVisualBearerMissing.replace('{index}', String(index + 1)));
        return;
      }

      const aspectRatioKey = aspectRatio === '9:16' ? 'portrait' : 'landscape';

      const nameText = char.name?.trim() || `Role ${index + 1}`;
      const roleText = char.role ? `Role in story: ${char.role}.` : '';
      const ageText = char.age ? `Age range: ${char.age}.` : '';
      const detailsText = char.details?.trim()
        ? `Character description: "${char.details}". Expand into a highly detailed visual description (face, hair, eyes, layered clothing, footwear, and accessories).`
        : 'No detailed description provided. Create a highly detailed visual description for this main character (face, hair, eyes, layered clothing, footwear, and accessories).';

      let styleInstruction = '';
      if (characterStyle === 'Animasi Syariah') {
        styleInstruction =
          "Visual style is 'Animasi Syariah'. ALL characters MUST be 3D without facial features ((no eyes:5.0), (no nose:5.0), (MANDATORY NO FACIAL FEATURES:3.0)) and wear Islamic attire (gamis/koko/peci for men, syari hijab for women).";
      } else if (characterStyle === 'SUPER REALISTIS') {
        styleInstruction =
          "Visual style is 'SUPER REALISTIC'. Images must look like ultra-realistic human photos taken with a high-quality Sony mirrorless camera, not cartoons.";
      } else if (characterStyle === 'Animasi Gaya Pixar') {
        styleInstruction =
          "Visual style is Pixar-like 3D animation: cute characters with soft shapes, big expressive eyes, and bright colors, consistent across all images.";
      } else {
        styleInstruction = `Use a consistent visual style "${characterStyle}" suitable for children’s content.`;
      }

      const basePrompt = `One full-body character image of ${nameText}. ${roleText} ${ageText} ${detailsText} Focus only on one main character, with a simple neutral background and no text or logo.`;

      const finalPrompt = `${basePrompt} ${styleInstruction}`;

      let modelRawBase64List: string[] = [];
      if (char.imageBase64) {
        modelRawBase64List = [char.imageBase64];
      }

      setCharacters((prev) => {
        const next = [...prev];
        const current = next[index];
        if (!current) return prev;
        next[index] = {
          ...current,
          isGeneratingVisual: true,
          generatingCountdown: 300,
        };
        return next;
      });

      const countdownInterval = setInterval(() => {
        setCharacters((prev) => {
          const next = [...prev];
          const current = next[index];
          if (!current || !current.isGeneratingVisual) {
            clearInterval(countdownInterval);
            return prev;
          }
          const newCountdown = (current.generatingCountdown ?? 0) - 1;
          if (newCountdown <= -30) {
            clearInterval(countdownInterval);
            addLog('ERROR', t.storyGenerator.characterVisualTimeout?.replace('{index}', String(index + 1)) || `Character ${index + 1} generation timeout (300s exceeded)`);
            next[index] = {
              ...current,
              isGeneratingVisual: false,
              generatingCountdown: undefined,
            };
          } else {
            next[index] = { ...current, generatingCountdown: newCountdown };
          }
          return next;
        });
      }, 1000);

      addLog('INFO', t.storyGenerator.creatingCharacterVisual.replace('{index}', String(index + 1)));

      try {
        const response = await window.zeoAPI.generateAffiliateImages({
          bearerKey,
          aspectRatioKey,
          imageResolution,
          items: [{ category: 'ugc', prompt: finalPrompt }],
          references: {
            product: null,
            models: modelRawBase64List,
            additional: [],
          },
        });

        if (!response || !response.ok || !Array.isArray(response.results) || !response.results[0]) {
          const message = (response && response.error) || t.storyGenerator.characterVisualEngineNoImage;
          addLog('ERROR', t.storyGenerator.characterVisualFailed.replace('{index}', String(index + 1)).replace('{error}', message));
          setCharacters((prev) => {
            const next = [...prev];
            const current = next[index];
            if (!current) return prev;
            next[index] = {
              ...current,
              isGeneratingVisual: false,
              generatingCountdown: undefined,
            };
            return next;
          });
          return;
        }

        const result = response.results[0];
        if (!result.success || !result.dataUrl) {
          const errMsg: string = result.error || t.storyGenerator.characterVisualError;
          addLog('ERROR', t.storyGenerator.characterVisualFailed.replace('{index}', String(index + 1)).replace('{error}', errMsg));
          setCharacters((prev) => {
            const next = [...prev];
            const current = next[index];
            if (!current) return prev;
            next[index] = {
              ...current,
              isGeneratingVisual: false,
              generatingCountdown: undefined,
            };
            return next;
          });
          return;
        }

        const url: string = result.dataUrl;

        setCharacters((prev) => {
          const next = [...prev];
          const current = next[index];
          if (!current) return prev;
          next[index] = {
            ...current,
            visualImageUrl: url,
            isGeneratingVisual: false,
            generatingCountdown: undefined,
          };
          return next;
        });

        addLog('SUCCESS', t.storyGenerator.characterVisualSuccess.replace('{index}', String(index + 1)));
      } catch (err: any) {
        const message = err?.message || t.storyGenerator.characterVisualError;
        addLog('ERROR', t.storyGenerator.characterVisualFailed.replace('{index}', String(index + 1)).replace('{error}', message));
        setCharacters((prev) => {
          const next = [...prev];
          const current = next[index];
          if (!current) return prev;
          next[index] = {
            ...current,
            isGeneratingVisual: false,
            generatingCountdown: undefined,
          };
          return next;
        });
      }
    },
    [addLog, aspectRatio, characterStyle, ensureAuthReady],
  );

  const handleOpenCharacterPreview = (index: number) => {
    const char = characters[index];
    if (!char?.visualImageUrl) return;
    setCharacterPreview({ index, url: char.visualImageUrl });
  };

  const handleDownloadCharacterVisual = (index: number) => {
    if (typeof window === 'undefined') return;
    const char = characters[index];
    const url = char?.visualImageUrl;
    if (!url) return;

    try {
      const a = document.createElement('a');
      const baseName = (char.name && char.name.trim()) || `character-${index + 1}`;
      const safeName = baseName.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
      a.href = url;
      a.download = `${safeName || `character-${index + 1}`}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      addLog('SUCCESS', t.storyGenerator.characterImageDownloaded.replace('{index}', String(index + 1)));
    } catch {
      addLog('ERROR', t.storyGenerator.characterImageDownloadFailed.replace('{index}', String(index + 1)));
    }
  };

  const handleCharacterImageChange: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    const inputEl = event.target;
    const file = inputEl.files?.[0];
    const indexAttr = inputEl.getAttribute('data-char-index');
    const index = indexAttr ? parseInt(indexAttr, 10) : -1;
    if (!file || Number.isNaN(index) || index < 0) {
      addLog('ERROR', t.storyGenerator.characterUploadFailed);
      if (inputEl) inputEl.value = '';
      return;
    }

    addLog('INFO', t.storyGenerator.characterUploadReceived.replace('{index}', String(index + 1)).replace('{filename}', file.name));

    // Tampilkan preview segera dengan object URL agar user langsung melihat hasil upload
    const previewUrl = URL.createObjectURL(file);
    setCharacters((prev) => {
      const next = [...prev];
      const current = next[index];
      if (!current) return prev;
      next[index] = {
        ...current,
        imagePreview: previewUrl,
        imageBase64: '',
        details: '',
        isGeneratingDescription: true,
        visualImageUrl: null,
        isGeneratingVisual: false,
      };
      return next;
    });

    const reader = new FileReader();
    reader.onload = async (e) => {
      const result = e.target?.result as string | null;
      if (!result) {
        addLog('ERROR', t.storyGenerator.characterFileReadFailed.replace('{index}', String(index + 1)));
        setCharacters((prev) => {
          const next = [...prev];
          const current = next[index];
          if (!current) return prev;
          next[index] = {
            ...current,
            isGeneratingDescription: false,
          };
          return next;
        });
        return;
      }

      const base64 = result.split(',')[1] || '';
      if (!base64.trim()) {
        addLog('ERROR', t.storyGenerator.characterImageDataEmpty.replace('{index}', String(index + 1)));
        setCharacters((prev) => {
          const next = [...prev];
          const current = next[index];
          if (!current) return prev;
          next[index] = {
            ...current,
            details: t.storyGenerator.characterDescriptionFailed,
            isGeneratingDescription: false,
          };
          return next;
        });
        return;
      }

      setCharacters((prev) => {
        const next = [...prev];
        const current = next[index];
        if (!current) return prev;
        next[index] = {
          ...current,
          imagePreview: previewUrl || result,
          imageBase64: base64,
          details: '',
          isGeneratingDescription: true,
          visualImageUrl: null,
          isGeneratingVisual: false,
        };
        return next;
      });

      const payload = {
        contents: [
          {
            parts: [
              {
                text: appendSafety(`Analyze this character image in great detail. Respond ONLY in JSON format, using ${langLabel} for all free text values: { "description": "SUPER DETAILED description of the character's visual appearance (to be used as a fixed prompt for image AI). Must include: skin color & tone, face shape, hair color & style, hair length, eye shape & color (except for Animasi Syariah style which has no facial features), nose shape, lip shape & color, relative height and body shape, MAIN OUTFIT LAYERS (top, bottom, outer layer, shoes), distinctive accessories (watch, glasses, bag, ribbon, etc.), and main vibe/emotional character. Write this so the character look can be LOCKED and REPEATED exactly the same in all scenes, still matching the story topic '${moderateInputOrThrow(topicDetail)}'", "gender": "Male or Female", "suggested_name": "one suitable first name for this character" }.

Important note: do not make drastic changes from the original photo; the description must reflect the character in the photo as accurately as possible. Do NOT mix languages; use only ${langLabel}.`),
              },
              {
                inlineData: {
                  mimeType: file.type,
                  data: base64,
                },
              },
            ],
          },
        ],
      };

      const aiResult = await callGemini(payload);
      const { error, data } = handleGeminiResponse<string>(aiResult);

      let updatedCharForVisual: Character | null = null;

      setCharacters((prev) => {
        const next = [...prev];
        const current = next[index];
        if (!current) return prev;

        if (!error && data) {
          const parsed = cleanAndParseJson(data);
          if (parsed) {
            const updated: Character = {
              ...current,
              details: parsed.description || 'Failed to get description.',
              name: parsed.suggested_name || current.name,
              age: 'Kids',
              isGeneratingDescription: false,
            };
            next[index] = updated;
            updatedCharForVisual = updated;
            return next;
          }
          next[index] = {
            ...current,
            details: t.storyGenerator.characterDataProcessFailed,
            isGeneratingDescription: false,
          };
          return next;
        }

        next[index] = {
          ...current,
          details: t.storyGenerator.characterAnalysisFailed,
          isGeneratingDescription: false,
        };
        return next;
      });

      if (!error && updatedCharForVisual) {
        void handleGenerateCharacterVisual(index, updatedCharForVisual);
      }

      // Reset input value supaya memilih file yang sama diulang tetap memicu onChange
      if (inputEl) inputEl.value = '';
    };

    reader.readAsDataURL(file);
  };

  const handleRemoveCharacterImage = (index: number) => {
    setCharacters((prev) => {
      const next = [...prev];
      const current = next[index];
      if (!current) return prev;
      next[index] = {
        ...current,
        imagePreview: null,
        imageBase64: null,
      };
      return next;
    });
  };

  const handleProcessSummary = async () => {
    if (!ensureAuthReady()) {
      return;
    }

    if (!topicDetail.trim()) {
      showAlert(t.storyGenerator.topicDetailRequired);
      return;
    }
    if (!characterStyle.trim()) {
      showAlert(t.storyGenerator.characterStyleRequired);
      return;
    }

    setIsSceneCountHighlighted(true);

    addLog('INFO', t.storyGenerator.summaryStarted);

    let safeTopicDetail: string;
    try {
      safeTopicDetail = moderateInputOrThrow(topicDetail);
    } catch (e) {
      showAlert((e as Error).message);
      return;
    }

    const recPayload = {
      contents: [
        {
          parts: [
            {
              text: appendSafety(
                `Based on this story idea: "${safeTopicDetail}", how many scenes are ideal for a short video (each scene ~8 seconds)? Answer ONLY with the number.`,
              ),
            },
          ],
        },
      ],
    };

    const recResult = await callGemini(recPayload);
    const { error: recError, data: recData } = handleGeminiResponse<string>(recResult);
    if (!recError && recData) {
      const recNumber = parseInt(recData, 10);
      const userSceneCount = sceneCount;

      if (Number.isFinite(recNumber) && recNumber > 0 && recNumber !== userSceneCount) {
        setRecommendedSceneCount(recNumber);
        setIsSceneRekomModalOpen(true);
        addLog('INFO', t.storyGenerator.sceneRecomAI.replace('{count}', String(recNumber)));
        return;
      }
    }

    await generateStorySummary();
  };

  const generateStorySummary = async (overrideSceneCount?: number) => {
    if (!ensureAuthReady()) {
      return;
    }

    setIsProcessingSummary(true);
    try {
      addLog('INFO', t.storyGenerator.summaryCallingAI);
      const hasExistingCharacter = characters.some((c) => c.details.trim() || c.imageBase64);

      if (!hasExistingCharacter && characters.length > 0) {
        const charPayload = {
          contents: [
            {
              parts: [
                {
                  text: appendSafety(
                    `Create one main character for a kids story with the topic "${moderateInputOrThrow(topicDetail)}". Respond ONLY in JSON: {"name": "Character Name", "age": "Age (e.g., Kids)", "details": "Super detailed description of the character's physical appearance (face, hair, eyes, layered clothing, props, style, etc)"}`,
                  ),
                },
              ],
            },
          ],
        };

        const charResult = await callGemini(charPayload);
        const { error: charError, data: charText } = handleGeminiResponse<string>(charResult);
        if (!charError && charText) {
// ...
          const charData = cleanAndParseJson(charText);
          if (charData) {
            setCharacters((prev) => {
              const next = [...prev];
              if (!next.length) {
                next.push({
                  name: charData.name,
                  age: (charData.age as CharacterAge) || 'Kids',
                  role: 'Protagonist',
                  details: charData.details,
                  imagePreview: null,
                  imageBase64: null,
                  isGeneratingDescription: false,
                });
              } else {
                next[0] = {
                  ...next[0],
                  name: charData.name,
                  age: (charData.age as CharacterAge) || 'Kids',
                  details: charData.details,
                };
              }
              return next;
            });
          }
        }
      }

      const effectiveSceneCount =
        typeof overrideSceneCount === 'number' && overrideSceneCount > 0
          ? overrideSceneCount
          : sceneCount;

      const payload = {
        contents: [
          {
            parts: [
              {
                text: appendSafety(
                  `You are a creative children's storyteller. Based on the following data, create an engaging story outline for kids. DATA:\n- ${getTopicInfo()}\n- Character Info: "${getCharacterPromptInfo()}"\n- Storytelling Style: "${storytellingStyle}"\n- Desired Scene Count: ${effectiveSceneCount}\nTASKS:\n1. Create a story with a clear beginning, middle, and end.\n2. Split the story into ${effectiveSceneCount} scenes.\n3. Output format must be: "Scene 1: [summary]. Scene 2: [summary]..."\n4. Answer ONLY with the story outline in ${langLabel}.`,
                ),
              },
            ],
          },
        ],
      };

      const result = await callGemini(payload);
      const { error, data } = handleGeminiResponse<string>(result);
      if (!error && data) {
        setStoryIdea(data);
        setRecommendations([]);
        setSelectedFlow(null);
        setGeneratedScenes([]);
        setTotalScenesToGenerate(0);
        setSceneExpandedMap({});
        addLog('SUCCESS', t.storyGenerator.summarySuccess);
      } else {
        addLog('ERROR', t.storyGenerator.summaryFailed);
      }
    } finally {
      setIsProcessingSummary(false);
    }
  };

  const handleIgnoreSceneRecommendation = async () => {
    addLog('INFO', t.storyGenerator.sceneRecomIgnored);
    setIsSceneRekomModalOpen(false);
    await generateStorySummary();
  };

  const handleApplySceneRecommendation = async () => {
    if (!recommendedSceneCount) {
      setIsSceneRekomModalOpen(false);
      await generateStorySummary();
      return;
    }
    addLog('INFO', t.storyGenerator.sceneRecomApplied.replace('{count}', String(recommendedSceneCount)));
    setSceneCount(recommendedSceneCount);
    setIsSceneRekomModalOpen(false);
    await generateStorySummary(recommendedSceneCount);
  };

  const handleGenerateFlow = async () => {
    if (!storyIdea) {
      showAlert(t.storyGenerator.selectFlowFirst);
      return;
    }

    if (!ensureAuthReady()) {
      return;
    }

    setIsGeneratingFlow(true);
    setRecommendations([]);

    addLog('INFO', t.storyGenerator.flowGenerating);

    const payload = {
      contents: [
        {
          parts: [
            {
              text: appendSafety(
                `You are a professional scriptwriter. Story context: "${storyIdea}".
Task: Provide 3 unique recommendations for title and storyline in ${langLabel}.
RULES:
1. The first recommendation MUST be a cleaner paragraph version of the original story context. The title must match.
2. The next two recommendations are creative variations of the original story.
3. Return ONLY in valid JSON array format: [{"title": "Title 1", "flow": "Storyline 1..."}, {"title": "Title 2", "flow": "Storyline 2..."}, {"title": "Title 3", "flow": "Storyline 3..."}]`,
              ),
            },
          ],
        },
      ],
    };

    const result = await callGemini(payload);
    const { error, data } = handleGeminiResponse<string>(result);

    setIsGeneratingFlow(false);

    if (!error && data) {
      const parsed = cleanAndParseJson(data) as StoryRecommendation[] | null;
      if (parsed && parsed.length > 0) {
        setRecommendations(parsed);
        addLog('SUCCESS', t.storyGenerator.flowSuccess);
        return;
      }

      const fallbackPayload = {
        contents: [
          {
            parts: [
              {
                text: appendSafety(
                  `Based on this story summary: "${storyIdea}", create one short, catchy title. Answer ONLY with the title, no quotes.`,
                ),
              },
            ],
          },
        ],
      };
      const titleResult = await callGemini(fallbackPayload);
      const { error: titleErr, data: titleText } = handleGeminiResponse<string>(titleResult);
      const originalTitle = !titleErr && titleText ? titleText : 'Original Story Idea';
      const originalFlow: StoryRecommendation = {
        title: originalTitle,
        flow: storyIdea.replace(/Scene \d+:/g, '').replace(/\n/g, ' ').trim(),
      };
      setRecommendations([originalFlow]);
      showAlert(t.storyGenerator.flowFallbackAlert);
      addLog('ERROR', t.storyGenerator.flowFallbackError);
    } else {
      showAlert(t.storyGenerator.flowFailedAlert);
      addLog('ERROR', t.storyGenerator.flowFailedError);
    }
  };

  const progressPercentage = useMemo(() => {
    if (!totalScenesToGenerate || totalScenesToGenerate <= 0) return 0;
    return Math.round((generatedScenes.length / totalScenesToGenerate) * 100);
  }, [generatedScenes.length, totalScenesToGenerate]);

  const generateSceneBatch = useCallback(
    async () => {
      if (!ensureAuthReady()) {
        return;
      }

      if (isSceneBatchInFlightRef.current) {
        return;
      }
      if (!selectedFlow) return;
      if (totalScenesToGenerate <= 0) return;

      const BATCH_SIZE = 5;
      const prevScenes = generatedScenes;
      const scenesGenerated = prevScenes.length;
      const scenesToRequest = Math.min(totalScenesToGenerate - scenesGenerated, BATCH_SIZE);
      const nextSceneStart = scenesGenerated + 1;

      if (scenesToRequest <= 0) {
        setIsGeneratingScenes(false);
        return;
      }

      isSceneBatchInFlightRef.current = true;

      setIsGeneratingScenes(true);
      setSceneProgressText(
        t.storyGenerator.creatingScene.replace('{current}', String(scenesGenerated + 1)).replace('{total}', String(totalScenesToGenerate)),
      );

      addLog('INFO', t.storyGenerator.startingScenes.replace('{start}', String(nextSceneStart)).replace('{end}', String(nextSceneStart + scenesToRequest - 1)));

      let negativePromptId = `text, writing, watermark, subtitle, logo, blurry, distortion, low quality, ${
        aspectRatio === '16:9' ? 'vertical frame' : 'horizontal frame'
      }, inconsistent characters, ${
        language === 'id' || language === 'ms'
          ? 'English language/text/voice/dialogue, song, music'
          : 'Indonesian language/text/voice/dialogue, song, music'
      }, multiple panels, collage, split screen`;
      let negativePromptEn = `text, writing, watermark, subtitle, logo, blurry, distortion, blur, low quality, ${
        aspectRatio === '16:9' ? 'vertical frame' : 'horizontal frame'
      }, inconsistent characters, ${
        language === 'id' || language === 'ms'
          ? 'english language, english text, english voice, english dialogue, song, music'
          : 'indonesian language, indonesian text, indonesian voice, indonesian dialogue, song, music'
      }, multiple panels, collage, split screen`;

      if (characterStyle === 'Animasi Syariah') {
        negativePromptId +=
          ', (eyes:5.0), (nose:5.0), (eyebrows:3.0), (detailed face:2.0), facial features, realistic face, 2D, anime, pixar, roblox, minecraft, painting, photo, real human, visible eyes, visible nose';
        negativePromptEn +=
          ', (eyes:5.0), (nose:5.0), (eyebrows:3.0), (detailed face:2.0), facial features, realistic face, 2D, anime, pixar, roblox, minecraft, painting, photo, real human, visible eyes, visible nose';
      } else if (characterStyle === 'SUPER REALISTIS') {
        negativePromptId +=
          ', 3D, animation, cartoon, painting, illustration, cgi, blurry, pixar, anime, roblox, minecraft, unrealistic';
        negativePromptEn +=
          ', 3D, animation, cartoon, painting, illustration, cgi, blurry, pixar, anime, roblox, minecraft, unrealistic';
      }

      const consistencyInfo = `MANDATORY CONSISTENCY INFO: ${getCharacterPromptInfo(
        true,
      )} Follow this character info STRICTLY to maintain visual consistency across all scenes.`;

      const continuationPrompt =
        scenesGenerated > 0
          ? `You previously created scenes 1 to ${scenesGenerated}. Now continue the story and create details for the next ${scenesToRequest} scenes, starting from scene number ${nextSceneStart}. ${consistencyInfo}`
          : `Create detailed prompts for the first ${scenesToRequest} scenes. ${consistencyInfo}`;

      let syariahRuleId = '';
      let syariahRuleEn = '';
      if (characterStyle === 'Animasi Syariah') {
        syariahRuleId =
          " CRITICAL STYLE RULE: This is 'Animasi Syariah'. ALL CHARACTERS (main and background) MUST be (faceless:3.0), (no eyes:5.0), (no nose:5.0), (no eyebrows:3.0), (MANDATORY NO FACIAL FEATURES:3.0). They must wear Islamic attire (gamis/koko/peci for male, syari hijab for female). This is the most important visual rule.";
        syariahRuleEn =
          " CRITICAL STYLE RULE: This is 'Animasi Syariah'. ALL CHARACTERS (main and background) MUST be (faceless:3.0), (no eyes:5.0), (no nose:5.0), (no eyebrows:3.0), (WAJIB TANPA FITUR WAJAH:3.0). They must wear Islamic attire (gamis/koko/peci for male, syari hijab for female). This is the most important visual rule.";
      }

      let coreVisualIdBase = '';
      let coreVisualEnBase = '';
      if (characterStyle === 'Animasi Syariah') {
        coreVisualIdBase =
          'MAIN VISUAL: 3D SYARIAH (NO EYES:5.0, NO NOSE:5.0). Detailed scene description.';
        coreVisualEnBase =
          'MAIN VISUAL: 3D SYARIAH (NO EYES:5.0, NO NOSE:5.0). Detailed scene description.';
      } else if (characterStyle === 'Pixar') {
        coreVisualIdBase =
          'MAIN VISUAL: Expressive 3D Pixar-style animation with full facial features matching the character description. Detailed scene description.';
        coreVisualEnBase =
          'MAIN VISUAL: Expressive 3D Pixar-style animation with full facial features matching the character description. Detailed scene description.';
      } else if (characterStyle === 'SUPER REALISTIS') {
        coreVisualIdBase =
          'MAIN VISUAL: Super realistic 3D style with full facial features and detailed textures, matching the character description. Detailed scene description.';
        coreVisualEnBase =
          'MAIN VISUAL: Super realistic 3D style with full facial features and detailed textures, matching the character description. Detailed scene description.';
      } else {
        coreVisualIdBase =
          `MAIN VISUAL: ${characterStyle} animation style consistent with the character description. Detailed scene description.`;
        coreVisualEnBase =
          `MAIN VISUAL: ${characterStyle} style consistent with the character description. Detailed scene description.`;
      }

      const storyboardText = `You are a meticulous storyboard AI assistant. Story Info:
- Title: "${selectedFlow.title}"
- Final Flow: "${selectedFlow.flow}"
- ${getTopicInfo()}
- Aspect Ratio: ${aspectRatio}
- Lighting: ${lighting}
INSTRUCTION: ${continuationPrompt}
STRICT RULES:
1.  **OUTPUT FORMAT**: Return ONLY a VALID JSON ARRAY.
2.  **CHARACTER CONSISTENCY**: Use the super-detailed character description. Keep 100% consistency.
3.  **JSON STRUCTURE**: Each scene object MUST have this structure:
    {"scene_number": (number), "details": [
        {"label_id": "Scene Purpose", "label_en": "Scene Purpose", "value_id": "(Hook / Introduce / Conflict / Escalation / Revelation / Plan / Climax / Fallout / Resolution)", "value_en": "(Hook / Introduce / Conflict / Escalation / Revelation / Plan / Climax / Fallout / Resolution)"},
        {"label_id": "Appearing Characters", "label_en": "Appearing Characters", "value_id": "(List which main characters appear in this scene; if a main character is absent, explicitly mention they are off-screen)", "value_en": "(List which main characters appear in this scene; if a main character is absent, explicitly mention they are off-screen)"},
        {"label_id": "Consistent Character", "label_en": "Consistent Character", "value_id": "(MUST repeat the detailed physical description from ${getCharacterPromptInfo()} here for CONSISTENCY.${syariahRuleId})", "value_en": "(MUST repeat the detailed physical description from ${getCharacterPromptInfo()} here for CONSISTENCY.${syariahRuleEn})"}, 
        {"label_id": "Core Scene Description", "label_en": "Core Scene Description", "value_id": "(${coreVisualIdBase} ${syariahRuleId})", "value_en": "(${coreVisualEnBase} ${syariahRuleEn})"}, 
        {"label_id": "Cinematography", "label_en": "Cinematography", "value_id": "(MUST mention aspect ratio ${aspectRatio}. PICK a cinematic angle/shot for this scene: eye-level, low-angle, high-angle, close-up, extreme close-up/detail insert, wide/establishing, over-the-shoulder, cutaway to object/mood). Avoid repeating the same angle every scene; vary across scenes like a professional film.)", "value_en": "(MUST mention aspect ratio ${aspectRatio}. PICK a cinematic angle/shot for this scene: eye-level, low-angle, high-angle, close-up, extreme close-up/detail insert, wide/establishing, over-the-shoulder, cutaway to object/mood). Avoid repeating the same angle every scene; vary across scenes like a professional film.)"}, 
        {"label_id": "Color & Lighting", "label_en": "Color & Lighting", "value_id": "...", "value_en": "..."}, 
        {"label_id": "Dialogue & Audio", "label_en": "Dialogue & Audio", "value_id": "...", "value_en": "..."}, 
        {"label_id": "Negative Instructions", "label_en": "Negative Instructions", "value_id": "${negativePromptId}", "value_en": "${negativePromptEn}"}
    ]}
4.  **STORYTELLING STYLE (IMPORTANT!)**: ${getStorytellingStyleInstruction()}.
5.  **DURATION & NARRATION (CRITICAL)**: Text in "Core Scene Description" and "Dialogue & Audio" must be SHORT to fit ~8s video. Hard caps:
    - "Core Scene Description" MAX 1–2 short sentences, <= 35 words total (truncate if longer).
    - "Dialogue & Audio" MAX 2 short exchanges, <= 22 words total (truncate if longer).
6.  **DURATION PER SCENE (HARD LIMIT)**: Each scene must represent about 8 seconds. If any dialogue/action would exceed ~8s or the word limits above, MOVE THE OVERFLOW to the NEXT scene (continue the same storyline). If scenes run out, COMPRESS and truncate to keep every scene <=8s.
7.  **AUDIO LANGUAGE**: Text in 'Dialogue & Audio' must use the selected language. Start the value with the tag: "(Audio in ${
                  language === 'en' ? 'English' : language === 'ms' ? 'Malay' : 'Indonesian'
                })".`;

      const payload = {
        contents: [
          {
            parts: [
              {
                text: appendSafety(storyboardText),
              },
            ],
          },
        ],
      };

      try {
        const result = await callGemini(payload);

        if (
          !result &&
          lastGeminiQuotaErrorRef.current &&
          Date.now() - lastGeminiQuotaErrorRef.current < 45_000
        ) {
          setSceneProgressText(t.storyGenerator.waitingQuota);
          setTimeout(() => {
            setIsGeneratingScenes(false);
          }, 500);
          return;
        }

        const { error, data } = handleGeminiResponse<string>(result);

        if (!error && data) {
          const parsed = cleanAndParseJson(data) as GeneratedScene[] | null;
          if (parsed && Array.isArray(parsed) && parsed.length > 0) {
            const mergedByNumber = new Map<number, GeneratedScene>();

            prevScenes.forEach((scene) => {
              if (!scene || typeof scene.scene_number !== 'number') return;
              mergedByNumber.set(scene.scene_number, scene);
            });

            parsed.forEach((scene) => {
              if (!scene || typeof scene.scene_number !== 'number') return;
              mergedByNumber.set(scene.scene_number, scene);
            });

            const mergedList = Array.from(mergedByNumber.values())
              .sort((a, b) => a.scene_number - b.scene_number)
              .slice(0, totalScenesToGenerate);

            const newCount = mergedList.length;
            const prevSceneNumbers = new Set(prevScenes.map((s) => s.scene_number));
            const newlyAddedNumbers = mergedList
              .map((s) => s.scene_number)
              .filter((num) => !prevSceneNumbers.has(num));

            setGeneratedScenes(mergedList);


            setSceneProgressText(
              t.storyGenerator.creatingScene.replace('{current}', String(Math.min(newCount, totalScenesToGenerate))).replace('{total}', String(totalScenesToGenerate)),
            );

            const addedCount = Math.max(0, newCount - scenesGenerated);
            if (addedCount > 0) {
              addLog('SUCCESS', t.storyGenerator.scenesCreated.replace('{start}', String(nextSceneStart)).replace('{end}', String(nextSceneStart + addedCount - 1)));
            } else {
              addLog('INFO', t.storyGenerator.scenesExisting);
            }

            if (newCount >= totalScenesToGenerate) {
              addLog('SUCCESS', t.storyGenerator.allScenesReady.replace('{total}', String(totalScenesToGenerate)));
            }

            setTimeout(() => {
              setIsGeneratingScenes(false);
            }, 500);

            return;
          }
        }

        addLog('ERROR', t.storyGenerator.scenesBatchFailed);
        setTimeout(() => {
          setIsGeneratingScenes(false);
        }, 500);
      } finally {
        isSceneBatchInFlightRef.current = false;
      }
    },
    [
      addLog,
      aspectRatio,
      callGemini,
      characterStyle,
      ensureAuthReady,
      generatedScenes.length,
      getCharacterPromptInfo,
      getStorytellingStyleInstruction,
      language,
      lighting,
      selectedFlow,
      totalScenesToGenerate,
    ],
  );

  useEffect(() => {
    // Otomatis jalankan batch pertama setelah user memilih alur cerita.
    // Hanya jalan jika:
    // - sudah ada selectedFlow
    // - isGeneratingScenes true
    // - totalScenesToGenerate > 0
    // - belum ada scene yang dibuat (generatedScenes.length === 0)
    if (!selectedFlow) return;
    if (!isGeneratingScenes) return;
    if (totalScenesToGenerate <= 0) return;
    if (generatedScenes.length > 0) return;
    if (isSceneBatchInFlightRef.current) return;

    void generateSceneBatch();
  }, [
    generateSceneBatch,
    generatedScenes.length,
    isGeneratingScenes,
    selectedFlow,
    totalScenesToGenerate,
  ]);

  const handleSelectFlow = async (index: number | 'custom', customTitle?: string, customFlowText?: string) => {
    let flow: StoryRecommendation | null = null;
    if (index === 'custom') {
      if (!customFlowText || !customFlowText.trim()) {
        showAlert(t.storyGenerator.flowCustomRequired);
        return;
      }
      flow = {
        title: customTitle?.trim() || t.storyGenerator.flowCustomDefaultTitle,
        flow: customFlowText.trim(),
      };
    } else {
      flow = recommendations[index] || null;
    }

    if (!flow) return;

    if (!ensureAuthReady()) {
      return;
    }

    addLog('INFO', t.storyGenerator.flowSelected.replace('{title}', flow.title).replace('{count}', String(sceneCount)));

    setSelectedFlow(flow);
    setGeneratedScenes([]);
    setTotalScenesToGenerate(sceneCount);
    setSceneExpandedMap({});
    setIsGeneratingScenes(true);
    setSceneProgressText(t.storyGenerator.analyzingStoryline);
  };

  const buildScenePlainTexts = (scene: GeneratedScene) => {
    const audioDetail = scene.details.find((d) => d.label_en === 'Dialogue & Audio');
    const selectedLangAudioValue = audioDetail
      ? language === 'en'
        ? audioDetail.value_en
        : audioDetail.value_id
      : '';

    const plainId = scene.details
      .map((d) => {
        if (!d || !d.label_id || !d.value_id) return null;
        if (d.label_en === 'Dialogue & Audio') {
          return `${d.label_id}:\n${selectedLangAudioValue}`;
        }
        return `${d.label_id}:\n${d.value_id}`;
      })
      .filter(Boolean)
      .join('\n\n');

    const plainEn = scene.details
      .map((d) => {
        if (!d || !d.label_en || !d.value_en) return null;
        if (d.label_en === 'Dialogue & Audio') {
          return `${d.label_en}:\n${selectedLangAudioValue}`;
        }
        return `${d.label_en}:\n${d.value_en}`;
      })
      .filter(Boolean)
      .join('\n\n');

    const json: any = {
      scene_number: scene.scene_number,
      aspect_ratio: aspectRatio,
      details: scene.details.reduce<Record<string, string>>((obj, item) => {
        if (item && item.label_en) {
          const key = item.label_en.toLowerCase().replace(/\s&\s/g, '_').replace(/\s/g, '_');
          obj[key] = item.value_en;
        }
        return obj;
      }, {}),
    };

    return {
      plainId,
      plainEn,
      jsonString: JSON.stringify(json, null, 2),
    };
  };

  const handleGenerateSceneImages = async (scene: GeneratedScene) => {
    if (typeof window === 'undefined' || !window.zeoAPI) {
      addLog('ERROR', t.storyGenerator.sceneImageEngineUnavailable.replace('{scene}', String(scene.scene_number)));
      return;
    }

    const hasStoryImageEngine = typeof window.zeoAPI.generateStorySceneImages === 'function';
    const hasAffiliateImageEngine = typeof window.zeoAPI.generateAffiliateImages === 'function';

    if (!hasStoryImageEngine && !hasAffiliateImageEngine) {
      addLog('ERROR', t.storyGenerator.sceneImageEngineUnavailable.replace('{scene}', String(scene.scene_number)));
      return;
    }

    if (!ensureAuthReady()) {
      return;
    }

    const bearerKey = localStorage.getItem('zeoStudio.bearerToken') || '';
    if (!bearerKey.trim()) {
      addLog('ERROR', t.storyGenerator.sceneImageBearerMissing.replace('{scene}', String(scene.scene_number)));
      return;
    }

    const { startPrompt, endPrompt } = buildSceneImagePrompts(scene);

    const modelBase64List: string[] = characters
      .map((c) => c.visualImageUrl)
      .filter((url): url is string => !!url && typeof url === 'string' && url.startsWith('data:image'))
      .map((url) => {
        const parts = url.split(',');
        return parts[1] || '';
      })
      .filter((b64) => b64 && b64.length > 0);

    setSceneImageMap((prev) => ({
      ...prev,
      [scene.scene_number]: {
        status: 'loading',
        startUrl: prev[scene.scene_number]?.startUrl,
        endUrl: prev[scene.scene_number]?.endUrl,
        error: undefined,
        generatingCountdown: 300,
      },
    }));

    const countdownInterval = setInterval(() => {
      setSceneImageMap((prev) => {
        const current = prev[scene.scene_number];
        if (!current || current.status !== 'loading') {
          clearInterval(countdownInterval);
          return prev;
        }
        const newCountdown = (current.generatingCountdown ?? 0) - 1;
        if (newCountdown <= -30) {
          clearInterval(countdownInterval);
          addLog('ERROR', t.storyGenerator.sceneImageTimeout?.replace('{scene}', String(scene.scene_number)) || `Scene ${scene.scene_number} generation timeout (300s exceeded)`);
          return {
            ...prev,
            [scene.scene_number]: {
              status: 'error',
              startUrl: current.startUrl,
              endUrl: current.endUrl,
              error: 'Timeout',
              generatingCountdown: undefined,
            },
          };
        }
        return {
          ...prev,
          [scene.scene_number]: { ...current, generatingCountdown: newCountdown },
        };
      });
    }, 1000);

    addLog('INFO', t.storyGenerator.startingSceneVisual.replace('{scene}', String(scene.scene_number)));

    try {
      let startUrl: string | undefined;
      let endUrl: string | undefined;

      if (hasStoryImageEngine) {
        const result = await window.zeoAPI.generateStorySceneImages?.({
          bearerKey,
          aspectRatio,
          imageResolution,
          startPrompt,
          endPrompt,
          references: {
            product: null,
            models: modelBase64List,
            additional: [],
          },
        });

        if (!result || !result.ok) {
          const message = (result && result.error) || t.storyGenerator.sceneImageError;
          addLog('ERROR', t.storyGenerator.sceneImageFailed.replace('{scene}', String(scene.scene_number)).replace('{error}', message));
          setSceneImageMap((prev) => ({
            ...prev,
            [scene.scene_number]: {
              status: 'error',
              startUrl: prev[scene.scene_number]?.startUrl,
              endUrl: prev[scene.scene_number]?.endUrl,
              error: undefined,
              generatingCountdown: undefined,
            },
          }));
          return;
        }

        startUrl = result.start?.dataUrl;
        endUrl = result.end?.dataUrl;
      } else if (hasAffiliateImageEngine) {
        const aspectRatioKey = aspectRatio === '9:16' ? 'portrait' : 'landscape';
        const result = await window.zeoAPI.generateAffiliateImages?.({
          bearerKey,
          aspectRatioKey,
          imageResolution,
          items: [
            { category: 'broll', prompt: startPrompt },
            { category: 'broll', prompt: endPrompt },
          ],
          references: {
            product: null,
            models: modelBase64List,
            additional: [],
          },
        });

        if (!result || !result.ok || !Array.isArray(result.results)) {
          const message = (result && result.error) || t.storyGenerator.sceneImageError;
          addLog('ERROR', t.storyGenerator.sceneImageFailed.replace('{scene}', String(scene.scene_number)).replace('{error}', message));
          setSceneImageMap((prev) => ({
            ...prev,
            [scene.scene_number]: {
              status: 'error',
              startUrl: prev[scene.scene_number]?.startUrl,
              endUrl: prev[scene.scene_number]?.endUrl,
              error: undefined,
              generatingCountdown: undefined,
            },
          }));
          return;
        }

        const startResult = result.results[0];
        const endResult = result.results[1];

        if (!startResult?.success || !endResult?.success) {
          const message = startResult?.error || endResult?.error || t.storyGenerator.sceneImageError;
          addLog('ERROR', t.storyGenerator.sceneImageFailed.replace('{scene}', String(scene.scene_number)).replace('{error}', message));
          setSceneImageMap((prev) => ({
            ...prev,
            [scene.scene_number]: {
              status: 'error',
              startUrl: prev[scene.scene_number]?.startUrl,
              endUrl: prev[scene.scene_number]?.endUrl,
              error: undefined,
              generatingCountdown: undefined,
            },
          }));
          return;
        }

        startUrl = startResult.dataUrl;
        endUrl = endResult.dataUrl;
      }

      if (!startUrl || !endUrl) {
        addLog('ERROR', t.storyGenerator.sceneImageNoStartEnd.replace('{scene}', String(scene.scene_number)));
        setSceneImageMap((prev) => ({
          ...prev,
          [scene.scene_number]: {
            status: 'error',
            startUrl: prev[scene.scene_number]?.startUrl,
            endUrl: prev[scene.scene_number]?.endUrl,
            error: undefined,
            generatingCountdown: undefined,
          },
        }));
        return;
      }

      setSceneImageMap((prev) => {
        const current = prev[scene.scene_number];
        const startHistory = current?.startHistory || [];
        const endHistory = current?.endHistory || [];
        const prevStart = current?.startUrl;
        const prevEnd = current?.endUrl;

        let nextStartHistory = startHistory;
        let nextEndHistory = endHistory;

        if (prevStart) {
          nextStartHistory = [...startHistory, prevStart].slice(-MAX_FRAME_HISTORY);
        }
        if (prevEnd) {
          nextEndHistory = [...endHistory, prevEnd].slice(-MAX_FRAME_HISTORY);
        }

        return {
          ...prev,
          [scene.scene_number]: {
            status: 'success',
            startUrl: startUrl || prevStart,
            endUrl: endUrl || prevEnd,
            error: undefined,
            startHistory: nextStartHistory,
            endHistory: nextEndHistory,
            generatingCountdown: undefined,
          },
        };
      });

      addLog('SUCCESS', t.storyGenerator.sceneImageSuccess.replace('{scene}', String(scene.scene_number)));
    } catch (error: any) {
      const message = error?.message || String(error);
      addLog('ERROR', t.storyGenerator.sceneImageFailed.replace('{scene}', String(scene.scene_number)).replace('{error}', message));
      setSceneImageMap((prev) => ({
        ...prev,
        [scene.scene_number]: {
          status: 'error',
          startUrl: prev[scene.scene_number]?.startUrl,
          endUrl: prev[scene.scene_number]?.endUrl,
          error: undefined,
        },
      }));
    }
  };

  const handleToggleSceneExpanded = (sceneNumber: number) => {
    setSceneExpandedMap((prev) => ({
      ...prev,
      [sceneNumber]: !prev[sceneNumber],
    }));
  };

  
  const handleCopyToClipboard = async (text: string, onSuccess: () => void, onError: () => void) => {
    if (!text) {
      onError();
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        onSuccess();
      } catch {
        onError();
      }
      return;
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (ok) {
        onSuccess();
      } else {
        onError();
      }
    } catch {
      onError();
    }
  };

  const handleOpenSceneJsonPreview = (sceneNumber: number, json: string) => {
    if (!json) return;
    setJsonPreview({ sceneNumber, json });
    setJsonCopyLabel(t.storyGenerator.copyLabel);
  };

  const handleCloseJsonPreview = () => {
    setJsonPreview(null);
    setJsonCopyLabel(t.storyGenerator.copyLabel);
  };

  const handleCopyJsonPreview = async () => {
    if (!jsonPreview?.json) return;
    await handleCopyToClipboard(
      jsonPreview.json,
      () => {
        setJsonCopyLabel(t.storyGenerator.copiedLabel);
        setTimeout(() => setJsonCopyLabel(t.storyGenerator.copyLabel), 1500);
      },
      () => {
        setJsonCopyLabel(t.storyGenerator.failedLabel);
        setTimeout(() => setJsonCopyLabel(t.storyGenerator.copyLabel), 1500);
      },
    );
  };

  const handleApplyJsonPreview = () => {
    if (!jsonPreview) return;

    const { sceneNumber, json } = jsonPreview;

    let parsed: any;
    try {
      parsed = JSON.parse(json);
    } catch (err: any) {
      const message = err?.message || String(err);
      addLog('ERROR', t.storyGenerator.jsonInvalid.replace('{scene}', String(sceneNumber)).replace('{error}', message));
      return;
    }

    const detailsObj = parsed && typeof parsed === 'object' ? parsed.details : null;
    if (!detailsObj || typeof detailsObj !== 'object') {
      addLog('ERROR', t.storyGenerator.jsonNoDetails.replace('{scene}', String(sceneNumber)));
      return;
    }

    setGeneratedScenes((prev) =>
      prev.map((scene) => {
        if (scene.scene_number !== sceneNumber) return scene;

        const updatedDetails = scene.details.map((field) => {
          if (!field || !field.label_en) return field;
          const key = field.label_en.toLowerCase().replace(/\s&\s/g, '_').replace(/\s/g, '_');

          if (Object.prototype.hasOwnProperty.call(detailsObj, key)) {
            const newValue = detailsObj[key];
            return {
              ...field,
              value_en: typeof newValue === 'string' ? newValue : String(newValue ?? ''),
            };
          }

          return field;
        });

        return {
          ...scene,
          details: updatedDetails,
        };
      }),
    );

    addLog('SUCCESS', t.storyGenerator.jsonUpdated.replace('{scene}', String(sceneNumber)));

    handleCloseJsonPreview();
  };

  const topicButtons: { value: Topic; label: string; icon: string }[] = [
    { value: 'Education', label: t.storyGenerator.topicEducation, icon: '🎓' },
    { value: 'Story', label: t.storyGenerator.topicStory, icon: '📖' },
    { value: 'Adventure', label: t.storyGenerator.topicAdventure, icon: '🚀' },
    { value: 'Fantasy & Magic', label: t.storyGenerator.topicFantasyMagic, icon: '🪄' },
    { value: 'Superhero & Hero', label: t.storyGenerator.topicSuperhero, icon: '🦸' },
    { value: 'Science & Space', label: t.storyGenerator.topicScienceSpace, icon: '🪐' },
    { value: 'Family & Friendship', label: t.storyGenerator.topicFamilyFriendship, icon: '👨‍👩‍👧‍👦' },
    { value: 'Everyday Comedy', label: t.storyGenerator.topicDailyComedy, icon: '😂' },
    { value: 'Light Mystery', label: t.storyGenerator.topicLightMystery, icon: '🕵️‍♂️' },
    { value: 'Folktale', label: t.storyGenerator.topicNusantaraFolktale, icon: '🏞️' },
    { value: 'Moral Values', label: t.storyGenerator.topicMoralValues, icon: '🌟' },
    { value: 'History & Culture', label: t.storyGenerator.topicHistoryCulture, icon: '🏛️' },
    { value: 'Nature & Animals', label: t.storyGenerator.topicNatureAnimals, icon: '🦁' },
    { value: 'Sports & Games', label: t.storyGenerator.topicSportsGames, icon: '⚽' },
    { value: 'Food & Cooking', label: t.storyGenerator.topicFoodCooking, icon: '🍳' },
    { value: 'Music & Arts', label: t.storyGenerator.topicMusicArts, icon: '🎵' },
    { value: 'Technology & Innovation', label: t.storyGenerator.topicTechnology, icon: '💻' },
    { value: 'Mystery Detective', label: t.storyGenerator.topicMysteryDetective, icon: '🔍' },
    { value: 'Holiday & Celebration', label: t.storyGenerator.topicHolidayCelebration, icon: '🎉' },
    { value: 'Others', label: t.storyGenerator.topicCustom, icon: '✍️' },
  ];

  const characterStyles = [
    { value: 'Cute 3D Animation (Little Giants)', label: t.storyGenerator.styleLittleGiants, icon: '👧' },
    { value: 'Pixar-style Animation', label: t.storyGenerator.stylePixar, icon: '🤠' },
    { value: 'Roblox Blocky Style', label: t.storyGenerator.styleRoblox, icon: '🧱' },
    { value: 'Minecraft Voxel Style', label: t.storyGenerator.styleMinecraft, icon: '⛏️' },
    { value: 'Cute Chibi Anime', label: t.storyGenerator.styleAnimeChibi, icon: '🌸' },
    { value: 'Syariah Animation', label: t.storyGenerator.styleSyariah, icon: '🕌' },
    { value: 'Fortnite Toon 3D', label: t.storyGenerator.styleFortniteToon3D, icon: '🎮' },
    { value: '2D Flat Cartoon', label: t.storyGenerator.styleCartoon2D, icon: '🎨' },
    { value: 'Storybook Illustration', label: t.storyGenerator.styleStorybook, icon: '📚' },
    { value: 'Clay / Stop Motion', label: t.storyGenerator.styleClaymation, icon: '🧸' },
    { value: 'Low Poly 3D', label: t.storyGenerator.styleLowPoly, icon: '🔺' },
    { value: 'Comic Book Style', label: t.storyGenerator.styleComic, icon: '📰' },
    { value: 'Soft Watercolor', label: t.storyGenerator.styleWatercolor, icon: '🖌️' },
    { value: 'Retro Pixel Art', label: t.storyGenerator.stylePixelArt, icon: '🧊' },
    { value: 'Child Crayon', label: t.storyGenerator.styleCrayon, icon: '🖍️' },
    { value: 'Anime Shonen Style', label: t.storyGenerator.styleAnimeShonen, icon: '⚡' },
    { value: 'Ghibli Animation', label: t.storyGenerator.styleGhibli, icon: '🍃' },
    { value: 'Paper Cut Art', label: t.storyGenerator.stylePaperCut, icon: '✂️' },
    { value: 'Noir Black & White', label: t.storyGenerator.styleNoir, icon: '🎬' },
    { value: 'Others', label: t.storyGenerator.styleCustom, icon: '✍️' },
  ];

  const storytellingStyles: { value: StorytellingStyle; label: string; icon: string; description: string }[] = [
    {
      value: 'Narration',
      label: t.storyGenerator.narrationNarrative,
      icon: '🗣️',
      description: t.storyGenerator.narrationNarrativeDesc,
    },
    {
      value: 'Voice Over',
      label: t.storyGenerator.narrationVoiceOver,
      icon: '🎙️',
      description: t.storyGenerator.narrationVoiceOverDesc,
    },
    {
      value: 'Combination',
      label: t.storyGenerator.narrationCombination,
      icon: '🎭',
      description: t.storyGenerator.narrationCombinationDesc,
    },
    {
      value: 'Visual only',
      label: t.storyGenerator.narrationVisualOnly,
      icon: '🖼️',
      description: t.storyGenerator.narrationVisualOnlyDesc,
    },
    {
      value: 'Bedtime Story',
      label: t.storyGenerator.narrationBedtime,
      icon: '🌙',
      description: t.storyGenerator.narrationBedtimeDesc,
    },
    {
      value: 'Educational Documentary',
      label: t.storyGenerator.narrationDocumentary,
      icon: '📚',
      description: t.storyGenerator.narrationDocumentaryDesc,
    },
    {
      value: 'Light Comedy',
      label: t.storyGenerator.narrationComedy,
      icon: '😂',
      description: t.storyGenerator.narrationComedyDesc,
    },
    {
      value: 'Free Style',
      label: t.storyGenerator.narrationCustomStyle,
      icon: '✍️',
      description: t.storyGenerator.narrationCustomStyleDesc,
    },
  ];

  const lightingOptions: { value: string; label: string; icon: string }[] = [
    { value: 'Automatic (AI)', label: t.storyGenerator.lightingAutomatic, icon: '✨' },
    { value: 'Bright Daylight', label: t.storyGenerator.lightingDaylight, icon: '☀️' },
    { value: 'Golden Hour', label: t.storyGenerator.lightingGoldenHour, icon: '🌅' },
    { value: 'Night', label: t.storyGenerator.lightingNight, icon: '🌙' },
    { value: 'Neon Lights', label: t.storyGenerator.lightingNeon, icon: '💡' },
    { value: 'Mysterious/Dark', label: t.storyGenerator.lightingMysterious, icon: '🌃' },
    { value: 'Overcast Dusk', label: t.storyGenerator.lightingOvercast, icon: '🌥️' },
    { value: 'Warm Indoor', label: t.storyGenerator.lightingIndoorWarm, icon: '🏠' },
  ];

  const canGenerateFlow = !!storyIdea && !isProcessingSummary;

  const hasScenes = generatedScenes.length > 0;

  const isAnyProcessing = isGeneratingFlow || isGeneratingScenes || storySocial.isGenerating;

  const hasAnyOutput =
    recommendations.length > 0 ||
    generatedScenes.length > 0 ||
    storySocial.thumbnails.length > 0 ||
    activityLogs.length > 0;

  const performFullReset = () => {
    // Hentikan audio yang sedang diputar
    stopCurrentSceneAudio();

    // Reset input utama ke kondisi awal
    setTopic('Education');
    setTopicDetail('');
    setTopicHistory([]);
    setCharacterStyle('Animasi 3D Lucu (Little Giants)');
    setCustomCharacterStyle('');
    setCharacterCountInput('1');
    setCharacters([
      {
        name: '',
        age: 'Kids',
        role: 'Protagonist',
        details: '',
        imagePreview: null,
        imageBase64: null,
        isGeneratingDescription: false,
        visualImageUrl: null,
        isGeneratingVisual: false,
      },
    ]);

    setIsGeneratingFlow(false);
    setRecommendations([]);
    setSelectedFlow(null);

    setGeneratedScenes([]);
    setTotalScenesToGenerate(0);
    setIsGeneratingScenes(false);
    setSceneProgressText(t.storyGenerator.startingProgress);

    setSceneExpandedMap({});

    setSceneImageMap({});
    setSceneAudioMap({});
    setSceneMovementMap({});
    setSceneVideoMap({});

    setStorySocial({
      isGenerating: false,
      thumbnails: [],
      caption: '',
      hashtags: '',
      description: '',
    });

    setStoryThumbnailPreview(null);
    setSceneImagePreview(null);
    setCharacterPreview(null);
    setJsonPreview(null);

    setMovementModal({ isOpen: false, sceneNumber: null, text: '', isLoading: false });
    setFrameEditModal({
      isOpen: false,
      sceneNumber: null,
      kind: null,
      imageUrl: null,
      instruction: '',
      isSubmitting: false,
    });

    setActivityLogs([]);
    setActivityLogCopyLabel(t.activityLog.copyLog);
    setError(null);
  };

  const handleFullReset = () => {
    if (isAnyProcessing) return;
    setIsResetConfirmOpen(true);
  };

  const handleConfirmReset = () => {
    setIsResetConfirmOpen(false);
    if (isAnyProcessing) return;
    performFullReset();
  };

  return (
    <div className="h-full w-full flex flex-col min-h-0 text-gray-50">
      <PageHeader
        iconId="generate-story"
        iconClassName="h-6 w-6 mr-3 text-white"
        title={t.storyGenerator.title}
        description={t.storyGenerator.description}
        tutorialUrl={STORY_TUTORIAL_URL}
        tutorialTitle="Tutorial Generate Story"
        tutorialMode="direct"
      />

      <div className="flex-1 p-4 lg:p-6 min-h-0 overflow-hidden">
        <div className="flex h-full min-w-0 gap-4">
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
              <div className="p-4 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-100">{t.storyGenerator.mainStoryTopic}</h3>
                  <button
                    type="button"
                    onClick={handleRekomTopic}
                    disabled={isRekomTopicLoading || !authReady}
                    className="text-[11px] text-white font-semibold py-1 px-3 rounded-md flex items-center justify-center gap-1 transition-all duration-200 btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <span className="text-xs">{isRekomTopicLoading ? '⏳' : '✨'}</span>
                    <span className="whitespace-nowrap">{isRekomTopicLoading ? t.storyGenerator.processing : t.storyGenerator.aiRecommendation}</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {topicButtons.map((btn) => {
                    const isActive = topic === btn.value;
                    return (
                      <button
                        key={btn.value}
                        type="button"
                        onClick={() => handleTopicClick(btn.value)}
                        className={`selection-btn flex flex-col items-center justify-center text-center gap-1 p-2 rounded-lg h-16 text-[11px] transition-all ${
                          isActive
                            ? 'btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white'
                            : 'bg-zinc-800 hover:bg-zinc-700 text-gray-200'
                        }`}
                      >
                        <span className="text-base">{btn.icon}</span>
                        <span>{btn.label}</span>
                      </button>
                    );
                  })}
                </div>
                <textarea
                  value={topicDetail}
                  onChange={(e) => setTopicDetail(e.target.value)}
                  rows={3}
                  ref={topicDetailRef}
                  className="mt-3 w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-xs placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                  placeholder={t.storyGenerator.topicPlaceholder}
                />
              </div>

              <div className="p-4 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-3">
                <h3 className="text-sm font-semibold text-gray-100">{t.storyGenerator.characterStyleCast}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-3">
                  {characterStyles.map((style) => {
                    const isActive =
                      style.value === 'Lainnya'
                        ? characterStyle === customCharacterStyle || characterStyle === 'Gaya Bebas'
                        : characterStyle === style.value;
                    return (
                      <button
                        key={style.value}
                        type="button"
                        onClick={() => {
                          if (style.value === 'Lainnya') {
                            setCustomCharacterStyle((prev) => prev || 'Gaya Bebas');
                            setCharacterStyle(customCharacterStyle || 'Gaya Bebas');
                            setTimeout(() => customCharacterStyleRef.current?.focus(), 0);
                          } else {
                            setCharacterStyle(style.value);
                          }
                        }}
                        className={`selection-btn flex flex-col items-center justify-center text-center gap-1 p-2 rounded-lg h-16 text-[11px] transition-all ${
                          isActive
                            ? 'btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white'
                            : 'bg-zinc-800 hover:bg-zinc-700 text-gray-200'
                        }`}
                      >
                        <span className="text-base">{style.icon}</span>
                        <span>{style.label}</span>
                      </button>
                    );
                  })}
                </div>
                <textarea
                  value={customCharacterStyle}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomCharacterStyle(val);
                    setCharacterStyle(val || 'Gaya Bebas');
                  }}
                  ref={customCharacterStyleRef}
                  rows={2}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-xs placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 resize-y"
                  placeholder={t.storyGenerator.customCharacterStylePlaceholder}
                />

                <div className="mt-3 space-y-2">
                  <label className="block text-xs font-medium text-gray-200">
                    {t.storyGenerator.mainCastCount}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1}
                      max={6}
                      value={characterCountInput}
                      onChange={(e) => setCharacterCountInput(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-xs placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCharacterCount}
                      className="px-3 py-2 rounded-lg text-white text-xs font-semibold transition-all duration-200 btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                    >
                      {t.storyGenerator.applyButton}
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {characters.map((char, index) => (
                      <div
                        key={index}
                        className="bg-zinc-900 border border-zinc-800 rounded-lg p-2 space-y-2 text-xs"
                      >
                        <div className="relative aspect-square w-full bg-zinc-800 rounded-md flex items-center justify-center overflow-hidden">
                          {char.imagePreview && (
                            <button
                              type="button"
                              onClick={() => handleRemoveCharacterImage(index)}
                              className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-md p-1 text-[10px]"
                            >
                              ×
                            </button>
                          )}
                          <label className="w-full h-full flex items-center justify-center cursor-pointer">
                            {char.imagePreview ? (
                              <img
                                src={char.imagePreview}
                                alt={`Karakter ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-3xl text-zinc-500">🖼️</span>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              data-char-index={index}
                              className="hidden"
                              onChange={handleCharacterImageChange}
                            />
                          </label>
                        </div>

                        <input
                          type="text"
                          value={char.name}
                          onChange={(e) => handleCharacterFieldChange(index, 'name', e.target.value)}
                          placeholder={t.storyGenerator.characterName}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-1.5 text-xs placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                        />

                        <select
                          value={char.role}
                          onChange={(e) => handleCharacterFieldChange(index, 'role', e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                        >
                          <option value="">{t.storyGenerator.characterRoleOptional}</option>
                          <option value="Protagonis">{t.storyGenerator.protagonist}</option>
                          <option value="Antagonis">{t.storyGenerator.antagonist}</option>
                          <option value="Sidekick">{t.storyGenerator.sidekick}</option>
                          <option value="Mentor">{t.storyGenerator.mentor}</option>
                          <option value="Rival">{t.storyGenerator.rival}</option>
                          <option value="Figuran">{t.storyGenerator.supporting}</option>
                        </select>

                        <select
                          value={char.age}
                          onChange={(e) => handleCharacterFieldChange(index, 'age', e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                        >
                          <option value="">{t.storyGenerator.selectAge}</option>
                          <option value="Teen (13-17 years)">{t.storyGenerator.ageTeen}</option>
                          <option value="Young Adult (18-25 years)">{t.storyGenerator.ageYoungAdult}</option>
                          <option value="Adult (26-45 years)">{t.storyGenerator.ageAdult}</option>
                          <option value="Middle-Aged (46-60 years)">{t.storyGenerator.ageMiddleAged}</option>
                          <option value="Senior (60+ years)">{t.storyGenerator.ageSenior}</option>
                        </select>

                        <div className="relative">
                          <textarea
                            value={char.details}
                            onChange={(e) => handleCharacterFieldChange(index, 'details', e.target.value)}
                            rows={3}
                            placeholder={t.storyGenerator.characterDescription}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-1.5 text-xs placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                          />
                          {char.isGeneratingDescription && (
                            <div className="absolute inset-0 bg-zinc-950/80 flex items-center justify-center rounded-md">
                              <GradientLoader size="sm" mode="spinner-only" />
                            </div>
                          )}
                        </div>

                        <div className="mt-2 space-y-1">
                          {(char.visualImageUrl || char.isGeneratingVisual) && (
                            <>
                              <div className="relative w-full aspect-square bg-zinc-800 rounded-md overflow-hidden">
                                {char.visualImageUrl && (
                                  <img
                                    src={char.visualImageUrl}
                                    alt={`Visual karakter ${index + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                )}
                                {!char.visualImageUrl && !char.isGeneratingVisual && (
                                  <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
                                    No image
                                  </div>
                                )}
                                {char.isGeneratingVisual && (
                                  <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2">
                                    <GradientLoader size="sm" mode="spinner-only" />
                                    <div className="text-white text-sm font-semibold">
                                      Generating...
                                    </div>
                                    {char.generatingCountdown !== undefined && char.generatingCountdown > 0 && (
                                      <div className="text-gray-300 text-xs">
                                        ~{char.generatingCountdown}s
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              <div className="flex justify-between gap-2 mt-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenCharacterPreview(index)}
                                  disabled={char.isGeneratingVisual}
                                  className="flex-1 px-2 py-1 rounded-md text-[10px] font-semibold border border-zinc-700 text-gray-100 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                  {t.storyGenerator.viewCharacter}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadCharacterVisual(index)}
                                  disabled={char.isGeneratingVisual}
                                  className="flex-1 px-2 py-1 rounded-md text-[10px] font-semibold border border-zinc-700 text-gray-100 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                  {t.storyGenerator.download}
                                </button>
                              </div>
                            </>
                          )}

                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => void handleGenerateCharacterVisual(index, char)}
                              disabled={char.isGeneratingVisual || !authReady}
                              className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all duration-200
                                ${
                                  char.isGeneratingVisual || !authReady
                                    ? 'bg-zinc-700 text-gray-400 cursor-not-allowed'
                                    : 'btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white'
                                }`}
                            >
                              {char.isGeneratingVisual
                                ? t.storyGenerator.generating
                                : authReady
                                ? char.visualImageUrl
                                  ? t.storyGenerator.regenerateVisual
                                  : t.storyGenerator.generateVisual
                                : t.storyGenerator.testTokenFirst}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-3">
                <h3 className="text-sm font-semibold text-gray-100">{t.storyGenerator.storytellingStyle}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {storytellingStyles.map((item) => {
                    const isActive = storytellingStyle === item.value;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => {
                          setStorytellingStyle(item.value);
                          if (item.value === 'Free Style') {
                            setTimeout(() => customStyleNoteRef.current?.focus(), 0);
                          }
                        }}
                        className={`selection-btn flex flex-col items-center justify-center text-center gap-1 p-2 rounded-lg h-16 text-[11px] transition-all ${
                          isActive
                            ? 'btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white'
                            : 'bg-zinc-800 hover:bg-zinc-700 text-gray-200'
                        }`}
                      >
                        <span className="text-base">{item.icon}</span>
                        <span className="font-medium">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
                {storytellingStyle === 'Free Style' && (
                  <div className="space-y-1">
                    <label className="block text-[11px] font-medium text-gray-200">
                      {t.storyGenerator.storytellingNote}
                    </label>
                    <textarea
                      value={customStorytellingStyleNote}
                      onChange={(e) => setCustomStorytellingStyleNote(e.target.value)}
                      rows={2}
                      ref={customStyleNoteRef}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-xs placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                      placeholder={t.storyGenerator.storytellingNotePlaceholder}
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="p-4 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-100">{t.storyGenerator.timeLighting}</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-[11px]">
                    {lightingOptions.map((option) => {
                      const isActive = lighting === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setLighting(option.value)}
                          className={`selection-btn flex flex-col items-center justify-center text-center gap-1 p-2 rounded-lg h-16 text-[11px] transition-all ${
                            isActive
                              ? 'btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white'
                              : 'bg-zinc-800 hover:bg-zinc-700 text-gray-200'
                          }`}
                        >
                          <span className="text-base">{option.icon}</span>
                          <span>{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-100">{t.storyGenerator.videoAspectRatio}</h3>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setAspectRatio('16:9')}
                      className={`selection-btn flex flex-col items-center justify-center text-center gap-1 p-2 rounded-lg h-16 text-[11px] transition-all ${
                        aspectRatio === '16:9'
                          ? 'btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-gray-200'
                      }`}
                    >
                      <span className="text-base">🖥️</span>
                      <span>16:9</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAspectRatio('9:16')}
                      className={`selection-btn flex flex-col items-center justify-center text-center gap-1 p-2 rounded-lg h-16 text-[11px] transition-all ${
                        aspectRatio === '9:16'
                          ? 'btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-gray-200'
                      }`}
                    >
                      <span className="text-base">📱</span>
                      <span>9:16</span>
                    </button>
                  </div>
                </div>
              </div>

              <div
                className={`p-4 rounded-lg bg-zinc-900/80 border space-y-3 ${
                  isSceneCountHighlighted ? 'border-yellow-400 ring-1 ring-yellow-400/70' : 'border-zinc-800'
                }`}
              >
                <label className="block text-sm font-semibold text-gray-100">{t.storyGenerator.sceneCount}</label>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={sceneCount}
                  onChange={(e) => {
                    const val = parseInt(e.target.value || '0', 10);
                    setSceneCount(Number.isNaN(val) ? 0 : val);
                  }}
                  className="mt-1 w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-xs placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>

              <div className="p-4 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <label className="block text-sm font-semibold text-gray-100">
                      {t.storyGenerator.finalStorySummary}
                    </label>
                    <p className="text-[11px] text-gray-400 mt-1">
                      {t.storyGenerator.finalStorySummaryDesc}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleProcessSummary}
                    disabled={isProcessingSummary || !authReady}
                    className="shrink-0 text-[11px] px-4 py-1.5 rounded-lg text-white font-semibold text-center leading-snug transition-all duration-200 btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:bg-purple-900 disabled:text-gray-400 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isProcessingSummary ? t.storyGenerator.processing : authReady ? t.storyGenerator.processSummary : t.storyGenerator.testTokenFirst}
                  </button>
                </div>
                {storyIdea && (
                  <textarea
                    value={storyIdea}
                    readOnly
                    rows={4}
                    className="mt-2 w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs text-gray-100"
                  />
                )}
              </div>

              <div className="mt-4">
                <div className="space-y-3">
                  {recommendations.length === 0 ? (
                    <p className="text-[11px] text-gray-500">
                      {t.storyGenerator.recommendationHint}
                    </p>
                  ) : (
                    <>
                      {recommendations.map((rec, idx) => {
                        const isExpanded = expandedFlowIndexes[idx] || false;
                        const maxChars = 420;
                        const needsTruncate = rec.flow.length > maxChars;
                        const displayText = !needsTruncate || isExpanded
                          ? rec.flow
                          : `${rec.flow.slice(0, maxChars)}...`;

                        return (
                          <div
                            key={rec.title + idx.toString()}
                            className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs"
                          >
                            <div className="flex items-start justify-between gap-3 mb-1">
                              <h4 className="text-sm font-semibold text-gray-100 pr-2">{rec.title}</h4>
                              <button
                                type="button"
                                onClick={() => handleSelectFlow(idx)}
                                disabled={!authReady}
                                className="shrink-0 text-[11px] text-white font-semibold px-3 py-1 rounded-lg btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                              >
                                {t.storyGenerator.selectFlow}
                              </button>
                            </div>
                            <p className="text-[11px] text-gray-400 whitespace-pre-wrap">{displayText}</p>
                            {needsTruncate && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedFlowIndexes((prev) => ({
                                    ...prev,
                                    [idx]: !isExpanded,
                                  }))
                                }
                                className="mt-1 text-[11px] text-purple-300 hover:text-purple-200"
                              >
                                {isExpanded ? t.storyGenerator.hideDetails : t.storyGenerator.viewMore}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 pb-5 pt-3 border-t border-zinc-800 space-y-3">
              <button
                type="button"
                onClick={handleGenerateFlow}
                disabled={!canGenerateFlow || isGeneratingFlow || !authReady}
                className={`w-full py-3 px-4 rounded-lg text-white font-semibold text-lg flex items-center justify-center transition-all duration-200 btn-glass-primary
                    focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-zinc-900
                    ${
                      !canGenerateFlow || isGeneratingFlow || !authReady
                        ? 'bg-zinc-600 cursor-not-allowed'
                        : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
                    }`}
              >
                {isGeneratingFlow
                  ? t.storyGenerator.processing
                  : authReady
                  ? t.storyGenerator.generateStoryboard
                  : t.storyGenerator.testTokenFirst}
              </button>

              <div className="max-h-52 bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-xs text-gray-200 flex flex-col">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-gray-100">{t.activityLog.title}</span>
                  <div className="flex items-center gap-3 mt-3">
                    <button
                      type="button"
                      onClick={handleCopyActivityLog}
                      disabled={activityLogs.length === 0}
                      className="px-2 py-0.5 rounded-md border border-zinc-600 text-[10px] text-gray-200 hover:bg-zinc-800 disabled:opacity-40"
                    >
                      {activityLogCopyLabel}
                    </button>
                    <span className="text-[10px] text-gray-500">{t.storyGenerator.logEntries.replace('{count}', String(activityLogs.length))}</span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
                  {activityLogs.length === 0 ? (
                    <p className="text-[11px] text-gray-500">
                      {t.storyGenerator.noActivity}
                    </p>
                  ) : (
                    activityLogs.map((log) => (
                      <div key={log.id} className="flex gap-2 items-start">
                        <span className="text-[10px] text-gray-500 min-w-[46px]">{log.timestamp}</span>
                        <span
                          className={`text-[10px] font-semibold ${
                            log.type === 'SUCCESS'
                              ? 'text-emerald-400'
                              : log.type === 'ERROR'
                              ? 'text-red-400'
                              : 'text-blue-300'
                          }`}
                        >
                          {log.type}
                        </span>
                        <span className="text-[10px] text-gray-200 flex-1">{log.message}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>

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
                <h3 className="text-lg font-semibold text-gray-50">{t.storyGenerator.previewStoryboard}</h3>
                {hasScenes && (
                  <p className="text-[11px] text-gray-400">
                    {t.storyGenerator.clickSceneCard}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {totalScenesToGenerate > 0 && (
                  <div className="text-right text-[11px] text-gray-400">
                    <div>
                      {generatedScenes.length}/{totalScenesToGenerate} {t.storyGenerator.sceneProgress}
                    </div>
                    <div>{progressPercentage}% {t.storyGenerator.completed}</div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleFullReset}
                  disabled={isAnyProcessing}
                  className={`inline-flex items-center px-4 py-2 text-[11px] font-semibold rounded-lg shadow-md transition-all duration-200
                    focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-zinc-900
                    ${
                      isAnyProcessing
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'btn-glass-primary bg-red-600 hover:bg-red-700 text-white'
                    }`}
                >
                  <span className="mr-1.5 text-xs">🗑️</span>
                  <span>{t.storyGenerator.clearData}</span>
                </button>
              </div>
            </div>

            <div className="flex-1 flex flex-col px-6 py-4 min-h-0 overflow-y-auto custom-scrollbar">
              {!hasScenes && !isGeneratingScenes && (
                <div className="flex-1 flex items-center justify-center bg-zinc-950/40 rounded-lg text-gray-500 text-center text-xs p-4">
                  <p className="max-w-xs">
                    {t.storyGenerator.storyboardHint}{' '}
                    <span className="font-semibold text-gray-300">{t.storyGenerator.generateStoryboard}</span>.
                  </p>
                </div>
              )}

              {isGeneratingScenes && (
                <div className="mb-4">
                  <GradientLoader 
                    size="sm" 
                    text={t.workflow.status.processing}
                    subtitle="Mohon tunggu, sedang membuat story"
                  />
                  <div className="mt-2 w-full h-2 bg-zinc-800 rounded-md overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300"
                      style={{ width: `${Math.max(0, Math.min(100, progressPercentage))}%` }}
                    />
                  </div>
                </div>
              )}

              {hasScenes && selectedFlow && (
                <div className="mb-4 p-4 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-100 mb-1">{selectedFlow.title}</h2>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-300">
                        <span>
                          🎬 {generatedScenes.length}/{totalScenesToGenerate} {t.storyGenerator.sceneProgress}
                        </span>
                        <span>⏱️ {t.storyGenerator.estimatedDuration} ~{totalScenesToGenerate * 8} {t.storyGenerator.seconds}</span>
                        <span>🌐 {t.storyGenerator.narrativeLanguage}: {language === 'id' ? t.storyGenerator.indonesian : language === 'ms' ? t.storyGenerator.malay : t.storyGenerator.english}</span>
                        <span>🖼️ {t.storyGenerator.aspectRatio}: {aspectRatio}</span>
                      </div>
                    </div>
                    <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        onClick={() => void handleGenerateStorySocial()}
                        disabled={storySocial.isGenerating || !authReady}
                        className="w-full sm:w-auto inline-flex items-center justify-center px-3 py-2 rounded-lg text-[11px] font-semibold text-white btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:bg-purple-900 disabled:text-gray-400 disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        {storySocial.isGenerating
                          ? t.storyGenerator.processingThumbnail
                          : authReady
                          ? t.storyGenerator.generateThumbnailCaption
                          : t.storyGenerator.testTokenFirst}
                      </button>
                    </div>
                  </div>

                  {storySocial.thumbnails.length > 0 && (
                    <div className="mt-2 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {storySocial.thumbnails.map((thumb) => (
                          <div key={thumb.id} className="space-y-1">
                            <div className="text-[10px] text-gray-300 font-semibold">Thumbnail #{thumb.id}</div>
                            <div
                              className={`relative w-full ${
                                aspectRatio === '16:9' ? 'aspect-video' : 'aspect-[9/16]'
                              } bg-zinc-900 rounded-lg overflow-hidden cursor-pointer`}
                              onClick={() =>
                                setStoryThumbnailPreview({
                                  id: thumb.id,
                                  url: thumb.url,
                                  description: thumb.description,
                                })
                              }
                            >
                              <img
                                src={thumb.url}
                                alt={`Story Thumbnail ${thumb.id}`}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute bottom-1 right-1 flex gap-1">
                                <a
                                  href={thumb.url}
                                  download={`story_thumbnail_${thumb.id}.png`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="px-2 py-0.5 rounded-md bg-zinc-900/90 hover:bg-zinc-800 text-[10px] text-gray-100 border border-zinc-700"
                                >
                                  {t.storyGenerator.download}
                                </a>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleRegenerateStoryThumbnail(thumb.id);
                                  }}
                                  disabled={thumb.isRegenerating || storySocial.isGenerating || !authReady}
                                  className="px-2 py-0.5 rounded-md bg-zinc-900/90 hover:bg-zinc-800 text-[10px] text-gray-100 border border-zinc-700 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                  {thumb.isRegenerating ? t.storyGenerator.regenerating : t.storyGenerator.regenerate}
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-2 text-[11px] text-gray-200">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold">{t.storyGenerator.captionLabel}</span>
                            <button
                              type="button"
                              onClick={() => void handleCopyStoryCaption()}
                              disabled={!storySocial.caption.trim()}
                              className="px-2 py-0.5 rounded-md border border-zinc-600 text-[10px] text-gray-200 hover:bg-zinc-800 disabled:opacity-40"
                            >
                              {t.buttons.copy}
                            </button>
                          </div>
                          <textarea
                            readOnly
                            rows={3}
                            value={storySocial.caption}
                            className="w-full p-2 border border-zinc-700 bg-zinc-900 rounded-lg text-gray-200 text-[11px] resize-none focus:outline-none focus:ring-1 focus:ring-purple-500"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold">{t.storyGenerator.hashtagLabel}</span>
                            <button
                              type="button"
                              onClick={() => void handleCopyStoryHashtags()}
                              disabled={!storySocial.hashtags.trim()}
                              className="px-2 py-0.5 rounded-md border border-zinc-600 text-[10px] text-gray-200 hover:bg-zinc-800 disabled:opacity-40"
                            >
                              {t.buttons.copy}
                            </button>
                          </div>
                          <textarea
                            readOnly
                            rows={2}
                            value={storySocial.hashtags}
                            className="w-full p-2 border border-zinc-700 bg-zinc-900 rounded-lg text-gray-200 text-[11px] resize-none focus:outline-none focus:ring-1 focus:ring-purple-500"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold">{t.storyGenerator.descriptionLabel}</span>
                            <button
                              type="button"
                              onClick={() => void handleCopyStoryDescription()}
                              disabled={!storySocial.description.trim()}
                              className="px-2 py-0.5 rounded-md border border-zinc-600 text-[10px] text-gray-200 hover:bg-zinc-800 disabled:opacity-40"
                            >
                              {t.buttons.copy}
                            </button>
                          </div>
                          <textarea
                            readOnly
                            rows={3}
                            value={storySocial.description}
                            className="w-full p-2 border border-zinc-700 bg-zinc-900 rounded-lg text-gray-200 text-[11px] resize-none focus:outline-none focus:ring-1 focus:ring-purple-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {hasScenes && (
                <div className="flex-1 w-full space-y-3">
                  {generatedScenes.map((scene) => {
                    const { plainId, plainEn, jsonString } = buildScenePlainTexts(scene);
                    const activeLang = language;
                    const coreDetail = scene.details.find((d) => d.label_en === 'Core Scene Description');
                    const fullCoreText = (language === 'en' ? coreDetail?.value_en : coreDetail?.value_id) || '';

                    const imageState = sceneImageMap[scene.scene_number] || { status: 'idle' as const };

                    const audioState =
                      sceneAudioMap[scene.scene_number] || { isGenerating: false, audioUrl: null };

                    const movementState = sceneMovementMap[scene.scene_number];
                    const videoState = sceneVideoMap[scene.scene_number];

                    const hasStartHistory = (imageState.startHistory?.length ?? 0) > 0;
                    const hasEndHistory = (imageState.endHistory?.length ?? 0) > 0;

                    const startDisplayUrl =
                      imageState.isComparingStart && imageState.startHistory && imageState.startHistory.length > 0
                        ? imageState.startHistory[imageState.startHistory.length - 1]
                        : imageState.startUrl;

                    const endDisplayUrl =
                      imageState.isComparingEnd && imageState.endHistory && imageState.endHistory.length > 0
                        ? imageState.endHistory[imageState.endHistory.length - 1]
                        : imageState.endUrl;

                    return (
                      <div
                        key={scene.scene_number}
                        className="w-full text-left rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs text-gray-200 px-4 py-3 hover:border-purple-500/70 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-purple-300">
                              Scene #{scene.scene_number}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-md border border-purple-500/60 text-purple-200">
                              {t.storyGenerator.storyBadge}
                            </span>
                          </div>
                        </div>

                        {fullCoreText && (
                          <p className="text-[11px] text-gray-50 whitespace-pre-wrap break-words leading-relaxed">
                            {fullCoreText}
                          </p>
                        )}

                        <div className="mt-3 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={imageState.status === 'loading' || !authReady}
                              className="text-[11px] px-3 py-1.5 rounded-md bg-teal-600 hover:bg-teal-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleGenerateSceneImages(scene);
                              }}
                            >
                              {t.storyGenerator.regenerate}
                            </button>
                            <button
                              type="button"
                              className="text-[11px] bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-md"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenSceneJsonPreview(scene.scene_number, jsonString);
                              }}
                            >
                              JSON
                            </button>
                          </div>
                        </div>

                        <div className="mt-3 bg-zinc-950/70 border border-zinc-800 rounded-lg p-3">
                          {imageState.status === 'loading' && (
                            <div className="relative w-full max-w-sm mx-auto aspect-video bg-zinc-800 rounded-md overflow-hidden flex items-center justify-center">
                              <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900"></div>
                              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2">
                                <GradientLoader size="sm" mode="spinner-only" />
                                <div className="text-white text-xs font-semibold">
                                  Generating Scene Visual...
                                </div>
                                {imageState.generatingCountdown !== undefined && imageState.generatingCountdown > 0 && (
                                  <div className="text-gray-300 text-[10px]">
                                    ~{imageState.generatingCountdown}s remaining
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          {imageState.status !== 'success' && imageState.status !== 'loading' && (
                            <button
                              type="button"
                              disabled={!authReady}
                              onClick={() => void handleGenerateSceneImages(scene)}
                              className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white text-[11px] font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2"
                            >
                              {authReady
                                ? `🎨 ${t.storyGenerator.createVisualScene}`
                                : t.storyGenerator.testTokenFirst}
                            </button>
                          )}

                          {imageState.status === 'success' && (
                            <div className="space-y-2">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
                                {/* Start & End Frame: biarkan sesuai kode kamu sekarang */}
                                {/* (Seluruh isi div grid yang sudah ada, jangan diubah) */}
                                {/* Gunakan isi Start/End frame yang sama persis, hanya dibungkus oleh space-y-3 ini. */}
                                {startDisplayUrl && (
                                  <div className="space-y-1">
                                    <div className="text-[10px] text-gray-400 font-semibold">{t.storyGenerator.startFrame}</div>
                                    <div
                                      className={`relative w-full ${
                                        aspectRatio === '16:9' ? 'aspect-video' : 'aspect-[9/16]'
                                      } bg-zinc-900 rounded-md overflow-hidden`}
                                      onClick={() =>
                                        setSceneImagePreview({
                                          sceneNumber: scene.scene_number,
                                          kind: 'start',
                                          url: startDisplayUrl as string,
                                        })
                                      }
                                    >
                                      <img
                                        src={startDisplayUrl}
                                        alt={`Scene ${scene.scene_number} - Start`}
                                        className="w-full h-full object-cover"
                                      />
                                      <div className="absolute top-1 left-1 flex gap-1">
                                        <button
                                          type="button"
                                          disabled={imageState.isRegeneratingStart || !authReady}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            void handleRegenerateFrame(scene, 'start');
                                          }}
                                          className="text-[9px] px-2 py-0.5 rounded-md bg-zinc-900/80 hover:bg-zinc-800 text-gray-100 border border-zinc-700 disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                          {imageState.isRegeneratingStart ? t.storyGenerator.processingShort : t.storyGenerator.regenerate}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            void handlePovFrame(scene, 'start');
                                          }}
                                          disabled={imageState.isPovStart || !authReady}
                                          className="text-[9px] px-2 py-0.5 rounded-md bg-zinc-900/80 hover:bg-zinc-800 text-gray-100 border border-zinc-700 disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                          {imageState.isPovStart ? t.storyGenerator.processingShort : t.storyGenerator.widerView}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenFrameEditModal(scene, 'start');
                                          }}
                                          disabled={imageState.isEditingStart || !authReady}
                                          className="text-[9px] px-2 py-0.5 rounded-md bg-zinc-900/80 hover:bg-zinc-800 text-gray-100 border border-zinc-700 disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                          {imageState.isEditingStart ? t.storyGenerator.processingShort : t.storyGenerator.edit}
                                        </button>
                                        <a
                                          href={imageState.startUrl}
                                          download={`scene_${scene.scene_number}_start.png`}
                                          className="text-[9px] px-2 py-0.5 rounded-md bg-zinc-900/80 hover:bg-zinc-800 text-gray-100 border border-zinc-700"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {t.storyGenerator.download}
                                        </a>
                                      </div>
                                      <div className="absolute bottom-1 right-1">
                                        <div className="relative inline-flex items-end gap-1 text-left">
                                          <div className="relative inline-block text-left">
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleToggleCompareFrame(scene.scene_number, 'start');
                                              }}
                                              disabled={!hasStartHistory}
                                              className="text-[9px] px-2 py-0.5 rounded-md bg-zinc-900/80 hover:bg-zinc-800 text-gray-100 border border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                              {t.storyGenerator.compare}
                                            </button>
                                          </div>
                                          <div className="relative inline-block text-left">
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleUndoFrame(scene.scene_number, 'start');
                                              }}
                                              disabled={!hasStartHistory}
                                              className="text-[9px] px-2 py-0.5 rounded-md bg-zinc-900/80 hover:bg-zinc-800 text-gray-100 border border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                              {t.storyGenerator.undo}
                                            </button>
                                          </div>
                                          <div className="relative inline-block text-left">
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setRotationMenuState((prev) =>
                                                  prev &&
                                                  prev.sceneNumber === scene.scene_number &&
                                                  prev.kind === 'start'
                                                    ? null
                                                    : { sceneNumber: scene.scene_number, kind: 'start' },
                                                );
                                                setAngleMenuState(null);
                                              }}
                                              disabled={imageState.isRotateStart || !authReady}
                                              className="text-[9px] px-2 py-0.5 rounded-md bg-zinc-900/80 hover:bg-zinc-800 text-gray-100 border border-zinc-700 disabled:opacity-60 disabled:cursor-not-allowed"
                                            >
                                              {imageState.isRotateStart ? t.storyGenerator.processingShort : t.storyGenerator.rotation}
                                            </button>
                                            {rotationMenuState &&
                                              rotationMenuState.sceneNumber === scene.scene_number &&
                                              rotationMenuState.kind === 'start' && (
                                                <div
                                                  className="absolute bottom-full right-0 mb-1 w-40 rounded-md bg-zinc-900 border border-zinc-700 shadow-lg z-20"
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  <div className="py-1 max-h-56 overflow-y-auto">
                                                    {CAMERA_ROTATION_OPTIONS.map((opt) => (
                                                      <button
                                                        key={opt.key}
                                                        type="button"
                                                        onClick={() => handleApplyCameraRotation(scene, 'start', opt.key)}
                                                        className="w-full text-left px-2 py-1 text-[10px] text-gray-100 hover:bg-zinc-800"
                                                      >
                                                        {opt.label}
                                                      </button>
                                                    ))}
                                                  </div>
                                                </div>
                                              )}
                                          </div>
                                          <div className="relative inline-block text-left">
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setAngleMenuState((prev) =>
                                                  prev &&
                                                  prev.sceneNumber === scene.scene_number &&
                                                  prev.kind === 'start'
                                                    ? null
                                                    : { sceneNumber: scene.scene_number, kind: 'start' },
                                                );
                                                setRotationMenuState(null);
                                              }}
                                              disabled={imageState.isAngleStart || !authReady}
                                              className="text-[9px] px-2 py-0.5 rounded-md bg-zinc-900/80 hover:bg-zinc-800 text-gray-100 border border-zinc-700 disabled:opacity-60 disabled:cursor-not-allowed"
                                            >
                                              {imageState.isAngleStart ? t.storyGenerator.processingShort : t.storyGenerator.angleCamera}
                                            </button>
                                            {angleMenuState &&
                                              angleMenuState.sceneNumber === scene.scene_number &&
                                              angleMenuState.kind === 'start' && (
                                                <div
                                                  className="absolute bottom-full right-0 mb-1 w-40 rounded-md bg-zinc-900 border border-zinc-700 shadow-lg z-20"
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  <div className="py-1 max-h-56 overflow-y-auto">
                                                    {CAMERA_ANGLE_OPTIONS.map((opt) => (
                                                      <button
                                                        key={opt.key}
                                                        type="button"
                                                        onClick={() => handleApplyCameraAngle(scene, 'start', opt.key)}
                                                        className="w-full text-left px-2 py-1 text-[10px] text-gray-100 hover:bg-zinc-800"
                                                      >
                                                        {opt.label}
                                                      </button>
                                                    ))}
                                                  </div>
                                                </div>
                                              )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                {endDisplayUrl && (
                                  <div className="space-y-1">
                                    <div className="text-[10px] text-gray-400 font-semibold">{t.storyGenerator.endFrame}</div>
                                    <div
                                      className={`relative w-full ${
                                        aspectRatio === '16:9' ? 'aspect-video' : 'aspect-[9/16]'
                                      } bg-zinc-900 rounded-md overflow-hidden`}
                                      onClick={() =>
                                        setSceneImagePreview({
                                          sceneNumber: scene.scene_number,
                                          kind: 'end',
                                          url: endDisplayUrl as string,
                                        })
                                      }
                                    >
                                      <img
                                        src={endDisplayUrl}
                                        alt={`Scene ${scene.scene_number} - End`}
                                        className="w-full h-full object-cover"
                                      />
                                      <div className="absolute top-1 left-1 flex gap-1">
                                        <button
                                          type="button"
                                          disabled={imageState.isRegeneratingEnd || !authReady}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            void handleRegenerateFrame(scene, 'end');
                                          }}
                                          className="text-[9px] px-2 py-0.5 rounded-md bg-zinc-900/80 hover:bg-zinc-800 text-gray-100 border border-zinc-700 disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                          {imageState.isRegeneratingEnd ? t.storyGenerator.processingShort : t.storyGenerator.regenerate}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            void handlePovFrame(scene, 'end');
                                          }}
                                          disabled={imageState.isPovEnd || !authReady}
                                          className="text-[9px] px-2 py-0.5 rounded-md bg-zinc-900/80 hover:bg-zinc-800 text-gray-100 border border-zinc-700 disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                          {imageState.isPovEnd ? t.storyGenerator.processingShort : t.storyGenerator.widerView}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenFrameEditModal(scene, 'end');
                                          }}
                                          disabled={imageState.isEditingEnd || !authReady}
                                          className="text-[9px] px-2 py-0.5 rounded-md bg-zinc-900/80 hover:bg-zinc-800 text-gray-100 border border-zinc-700 disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                          {imageState.isEditingEnd ? t.storyGenerator.processingShort : t.storyGenerator.edit}
                                        </button>
                                        <a
                                          href={imageState.endUrl}
                                          download={`scene_${scene.scene_number}_end.png`}
                                          className="text-[9px] px-2 py-0.5 rounded-md bg-zinc-900/80 hover:bg-zinc-800 text-gray-100 border border-zinc-700"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {t.storyGenerator.download}
                                        </a>
                                      </div>
                                      <div className="absolute bottom-1 right-1">
                                        <div className="relative inline-flex items-end gap-1 text-left">
                                          <div className="relative inline-block text-left">
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleToggleCompareFrame(scene.scene_number, 'end');
                                              }}
                                              disabled={!hasEndHistory}
                                              className="text-[9px] px-2 py-0.5 rounded-md bg-zinc-900/80 hover:bg-zinc-800 text-gray-100 border border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                              {t.storyGenerator.compare}
                                            </button>
                                          </div>
                                          <div className="relative inline-block text-left">
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleUndoFrame(scene.scene_number, 'end');
                                              }}
                                              disabled={!hasEndHistory}
                                              className="text-[9px] px-2 py-0.5 rounded-md bg-zinc-900/80 hover:bg-zinc-800 text-gray-100 border border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                              {t.storyGenerator.undo}
                                            </button>
                                          </div>
                                          <div className="relative inline-block text-left">
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setRotationMenuState((prev) =>
                                                  prev &&
                                                  prev.sceneNumber === scene.scene_number &&
                                                  prev.kind === 'end'
                                                    ? null
                                                    : { sceneNumber: scene.scene_number, kind: 'end' },
                                                );
                                                setAngleMenuState(null);
                                              }}
                                              disabled={imageState.isRotateEnd || !authReady}
                                              className="text-[9px] px-2 py-0.5 rounded-md bg-zinc-900/80 hover:bg-zinc-800 text-gray-100 border border-zinc-700 disabled:opacity-60 disabled:cursor-not-allowed"
                                            >
                                              {imageState.isRotateEnd ? t.storyGenerator.processingShort : t.storyGenerator.rotation}
                                            </button>
                                            {rotationMenuState &&
                                              rotationMenuState.sceneNumber === scene.scene_number &&
                                              rotationMenuState.kind === 'end' && (
                                                <div
                                                  className="absolute bottom-full right-0 mb-1 w-40 rounded-md bg-zinc-900 border border-zinc-700 shadow-lg z-20"
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  <div className="py-1 max-h-56 overflow-y-auto">
                                                    {CAMERA_ROTATION_OPTIONS.map((opt) => (
                                                      <button
                                                        key={opt.key}
                                                        type="button"
                                                        onClick={() => handleApplyCameraRotation(scene, 'end', opt.key)}
                                                        className="w-full text-left px-2 py-1 text-[10px] text-gray-100 hover:bg-zinc-800"
                                                      >
                                                        {opt.label}
                                                      </button>
                                                    ))}
                                                  </div>
                                                </div>
                                              )}
                                          </div>
                                          <div className="relative inline-block text-left">
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setAngleMenuState((prev) =>
                                                  prev &&
                                                  prev.sceneNumber === scene.scene_number &&
                                                  prev.kind === 'end'
                                                    ? null
                                                    : { sceneNumber: scene.scene_number, kind: 'end' },
                                                );
                                                setRotationMenuState(null);
                                              }}
                                              disabled={imageState.isAngleEnd || !authReady}
                                              className="text-[9px] px-2 py-0.5 rounded-md bg-zinc-900/80 hover:bg-zinc-800 text-gray-100 border border-zinc-700 disabled:opacity-60 disabled:cursor-not-allowed"
                                            >
                                              {imageState.isAngleEnd ? t.storyGenerator.processingShort : t.storyGenerator.angleCamera}
                                            </button>
                                            {angleMenuState &&
                                              angleMenuState.sceneNumber === scene.scene_number &&
                                              angleMenuState.kind === 'end' && (
                                                <div
                                                  className="absolute bottom-full right-0 mb-1 w-40 rounded-md bg-zinc-900 border border-zinc-700 shadow-lg z-20"
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  <div className="py-1 max-h-56 overflow-y-auto">
                                                    {CAMERA_ANGLE_OPTIONS.map((opt) => (
                                                      <button
                                                        key={opt.key}
                                                        type="button"
                                                        onClick={() => handleApplyCameraAngle(scene, 'end', opt.key)}
                                                        className="w-full text-left px-2 py-1 text-[10px] text-gray-100 hover:bg-zinc-800"
                                                      >
                                                        {opt.label}
                                                      </button>
                                                    ))}
                                                  </div>
                                                </div>
                                              )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Kontrol Audio + Saran Gerakan + Generate Video */}
                              <div className="space-y-2">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px]">
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-300 whitespace-nowrap">{t.storyGenerator.narratorVoiceLabel}</span>
                                    <select
                                      value={audioState.voiceId || narratorVoice}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        handleSceneVoiceChange(scene.scene_number, e.target.value);
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      className="max-w-[220px] w-full sm:w-auto p-1.5 border border-zinc-700 bg-zinc-900 rounded-md text-[11px] text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                                    >
                                      {TTS_VOICES.map((voice) => (
                                        <option key={voice.id} value={voice.id}>{`(${voice.gender}) ${voice.name} - ${getLocalizedTone(voice.tone, language)}`}</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void handleGenerateSceneNarration(scene);
                                    }}
                                    disabled={audioState.isGenerating || !authReady}
                                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white text-[11px] font-semibold py-2 rounded-lg flex items-center justify-center gap-2"
                                  >
                                    {audioState.isGenerating
                                      ? t.storyGenerator.creatingAudio
                                      : authReady
                                      ? `🔊 ${t.storyGenerator.createNarrationAudio}`
                                      : t.storyGenerator.testTokenFirst}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void handleOpenMovementSuggestion(scene);
                                    }}
                                    disabled={!authReady}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold py-2 rounded-lg flex items-center justify-center gap-2"
                                  >
                                    {movementState?.applied
                                      ? `✅ ${t.storyGenerator.movementSuggestionApplied}`
                                      : `🚀 ${t.storyGenerator.movementSuggestion}`}
                                  </button>
                                </div>
                                {audioState.audioUrl && (
                                  <div className="mt-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 flex flex-col gap-1 text-[11px] text-gray-200">
                                    <div className="flex items-center justify-between gap-2">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handlePlayPauseSceneAudio(scene.scene_number);
                                        }}
                                        className="px-2 py-1 rounded-md bg-zinc-100 text-zinc-900 text-[11px] font-semibold hover:bg-white"
                                      >
                                        {audioStatus.sceneNumber === scene.scene_number && audioStatus.isPlaying
                                          ? t.storyGenerator.pauseAudio
                                          : t.storyGenerator.playAudio}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDownloadSceneAudio(scene.scene_number);
                                        }}
                                        className="px-2 py-1 rounded-md border border-zinc-600 text-[10px] text-gray-200 hover:bg-zinc-800"
                                      >
                                        {t.storyGenerator.downloadAudio}
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="w-10 text-[10px] tabular-nums text-gray-400">
                                        {audioStatus.sceneNumber === scene.scene_number
                                          ? `${Math.floor(audioStatus.currentTime / 60)
                                              .toString()
                                              .padStart(2, '0')}:${Math.floor(audioStatus.currentTime % 60)
                                              .toString()
                                              .padStart(2, '0')}`
                                          : '00:00'}
                                      </span>
                                      <input
                                        type="range"
                                        min={0}
                                        max={100}
                                        value={
                                          audioStatus.sceneNumber === scene.scene_number && audioStatus.duration > 0
                                            ? (audioStatus.currentTime / audioStatus.duration) * 100
                                            : 0
                                        }
                                        onChange={(e) =>
                                          handleSeekSceneAudio(scene.scene_number, Number(e.target.value) || 0)
                                        }
                                        onClick={(e) => e.stopPropagation()}
                                        className="flex-1 accent-purple-500 cursor-pointer"
                                      />
                                      <span className="w-10 text-[10px] tabular-nums text-gray-400 text-right">
                                        {audioStatus.sceneNumber === scene.scene_number && audioStatus.duration > 0
                                          ? `${Math.floor(audioStatus.duration / 60)
                                              .toString()
                                              .padStart(2, '0')}:${Math.floor(audioStatus.duration % 60)
                                              .toString()
                                              .padStart(2, '0')}`
                                          : '--:--'}
                                      </span>
                                    </div>
                                  </div>
                                )}

                                <div className="pt-1 space-y-1">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void handleGenerateSceneVideo(scene);
                                    }}
                                    disabled={!authReady}
                                    className="w-full btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-[11px] font-semibold py-2 rounded-lg flex items-center justify-center gap-2 disabled:bg-purple-900 disabled:text-gray-300 disabled:opacity-70 disabled:cursor-not-allowed"
                                  >
                                    {videoState?.status === 'running'
                                      ? `🎬 ${t.storyGenerator.generatingVideo}`
                                      : authReady
                                      ? `🎬 ${t.storyGenerator.generateVideoFromScene}`
                                      : t.storyGenerator.testTokenFirst}
                                  </button>

                                  {/* Retry Scene Button */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void handleRetryScene(scene);
                                    }}
                                    disabled={!authReady}
                                    className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white text-[11px] font-semibold py-2 rounded-lg flex items-center justify-center gap-2 disabled:bg-zinc-600 disabled:text-gray-300 disabled:opacity-70 disabled:cursor-not-allowed"
                                  >
                                    {videoState?.status === 'running'
                                      ? `🔄 ${t.storyGenerator.retryingScene}`
                                      : authReady
                                      ? `🔄 ${t.storyGenerator.retryScene}`
                                      : t.storyGenerator.testTokenFirst}
                                  </button>

                                  {videoState && videoState.lastMessage && (
                                    <div className="text-[10px] text-gray-400 mt-0.5">
                                      {videoState.lastMessage}
                                      {videoState.fileName && (
                                        <span className="ml-1 font-semibold text-gray-300">
                                          ({videoState.fileName})
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  {videoState?.status === 'running' && !videoState?.filePath && (
                                    <div className="mt-2 relative w-full max-w-sm mx-auto aspect-video bg-zinc-800 rounded-md overflow-hidden flex items-center justify-center">
                                      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/30 to-blue-900/30"></div>
                                      <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2">
                                        <GradientLoader size="sm" mode="spinner-only" />
                                        <div className="text-white text-xs font-semibold">
                                          🎬 Generating Video...
                                        </div>
                                        {videoState.generatingCountdown !== undefined && videoState.generatingCountdown > 0 && (
                                          <div className="text-gray-300 text-[10px]">
                                            ~{videoState.generatingCountdown}s remaining
                                          </div>
                                        )}
                                        {videoState.lastMessage && (
                                          <div className="text-gray-400 text-[9px] text-center max-w-xs">
                                            {videoState.lastMessage}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {videoState?.filePath && getVideoFileUrl(videoState.filePath) && (
                                    <div className="mt-2 space-y-1 max-w-sm mx-auto">
                                      <div
                                        className={`relative w-full ${
                                          aspectRatio === '16:9' ? 'aspect-video' : 'aspect-[9/16]'
                                        } rounded-md overflow-hidden border border-zinc-700/70 bg-black`}
                                      >
                                        <video
                                          className="w-full h-full bg-black"
                                          src={`${getVideoFileUrl(videoState.filePath)}#t=0.5`}
                                          controls
                                          preload="metadata"
                                        />

                                        <div className="absolute top-1 right-1 flex gap-1">
                                          <a
                                            href={getVideoFileUrl(videoState.filePath) || undefined}
                                            download={videoState.fileName || undefined}
                                            onClick={(e) => e.stopPropagation()}
                                            className="px-2 py-0.5 rounded-md bg-zinc-900/90 hover:bg-zinc-800 text-[10px] text-gray-100 border border-zinc-700"
                                          >
                                            {t.storyGenerator.download}
                                          </a>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              void handleGenerateSceneVideo(scene);
                                            }}
                                            className="px-2 py-0.5 rounded-md bg-zinc-900/90 hover:bg-zinc-800 text-[10px] text-gray-100 border border-zinc-700 disabled:opacity-60 disabled:cursor-not-allowed"
                                            disabled={!authReady}
                                          >
                                            {t.storyGenerator.regenerateVideo}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              void handleRetryScene(scene);
                                            }}
                                            className="px-2 py-0.5 rounded-md bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-[10px] text-white border border-zinc-700 disabled:opacity-60 disabled:cursor-not-allowed"
                                            disabled={!authReady}
                                          >
                                            🔄 {t.storyGenerator.retryAll}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleOpenMovementEdit(scene);
                                            }}
                                            className="px-2 py-0.5 rounded-md bg-zinc-900/90 hover:bg-zinc-800 text-[10px] text-gray-100 border border-zinc-700"
                                          >
                                            {t.storyGenerator.editMovement}
                                          </button>
                                        </div>
                                      </div>

                                      {videoState.fileName && (
                                        <div className="flex flex-wrap items-center gap-2 text-[10px] mt-1">
                                          <span className="text-emerald-300 truncate max-w-[80%]">
                                            📁 {videoState.fileName}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {hasScenes && generatedScenes.length < totalScenesToGenerate && (
                <div className="pt-3 border-t border-zinc-800 mt-3">
                  <button
                    type="button"
                    onClick={() => void generateSceneBatch()}
                    disabled={isGeneratingScenes || !authReady}
                    className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-xs font-semibold flex items-center justify-center gap-2"
                  >
                    {isGeneratingScenes
                      ? t.storyGenerator.analyzingStoryline
                      : authReady
                      ? `${t.storyGenerator.continueScenes || 'Continue Scenes'} (${generatedScenes.length}/${totalScenesToGenerate})`
                      : t.storyGenerator.testTokenFirst}
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md shadow-2xl flex flex-col p-5">
            <h2 className="text-base font-semibold text-gray-50 mb-2">{t.storyGenerator.resetConfirmTitle}</h2>
            <div className="space-y-2 text-sm text-gray-200 mb-4">
              <p>
                {t.storyGenerator.resetConfirmMessage}
              </p>
              <p className="text-gray-400 text-xs">{t.storyGenerator.resetConfirmWarning}</p>
            </div>
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-3 py-1.5 rounded-md border border-zinc-600 text-gray-200 hover:bg-zinc-800"
              >
                {t.buttons.cancel}
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-700 text-white font-semibold"
              >
                {t.buttons.reset}
              </button>
            </div>
          </div>
        </div>
      )}

      {frameEditModal.isOpen && frameEditModal.imageUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-xl max-h-[90vh] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-gray-100">{t.storyGenerator.editModalTitle.replace('{kind}', frameEditModal.kind?.toUpperCase() || '').replace('{scene}', String(frameEditModal.sceneNumber || ''))}</h3>
              <button
                type="button"
                onClick={frameEditModal.isSubmitting ? undefined : handleCloseFrameEditModal}
                className="text-[18px] text-gray-400 hover:text-gray-100 px-1 disabled:opacity-40"
                disabled={frameEditModal.isSubmitting}
              >
                ×
              </button>
            </div>
            <div className="flex-1 p-4 space-y-4 overflow-y-auto custom-scrollbar">
              <div
                className={`w-full ${aspectRatio === '16:9' ? 'aspect-video' : 'aspect-[9/16]'} bg-zinc-950 rounded-lg overflow-hidden`}
              >
                <img
                  src={frameEditModal.imageUrl}
                  alt="Preview Edit Frame"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-gray-200">{t.storyGenerator.editInstructionLabel}</div>
                <textarea
                  value={frameEditModal.instruction}
                  onChange={(e) =>
                    setFrameEditModal((prev) => ({
                      ...prev,
                      instruction: e.target.value,
                    }))
                  }
                  placeholder={t.storyGenerator.editModalPlaceholder}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg text-xs text-gray-100 px-3 py-2 min-h-[96px] resize-none focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
            </div>
            <div className="px-4 pb-4 pt-2">
              <button
                type="button"
                onClick={() => void handleApplyFrameEdit()}
                disabled={frameEditModal.isSubmitting || !authReady}
                className="w-full btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-xs font-semibold py-2.5 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {frameEditModal.isSubmitting ? t.storyGenerator.editProcessing : t.storyGenerator.editModalApply}
              </button>
            </div>
          </div>
        </div>
      )}

      {movementModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-gray-100">{t.storyGenerator.movementModalTitle.replace('{scene}', String(movementModal.sceneNumber || ''))}</h3>
              <button
                type="button"
                onClick={movementModal.isLoading ? undefined : handleCloseMovementModal}
                className="text-[18px] text-gray-400 hover:text-gray-100 px-1 disabled:opacity-40"
                disabled={movementModal.isLoading}
              >
                ×
              </button>
            </div>
            <div className="p-4 space-y-3">
              {movementModal.isLoading && (
                <div className="text-[11px] text-gray-300">
                  {t.storyGenerator.movementAnalyzing}
                </div>
              )}
              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-gray-200">{t.storyGenerator.movementDescription}</div>
                <textarea
                  value={movementModal.text}
                  onChange={(e) => handleMovementModalTextChange(e.target.value)}
                  placeholder={'Movement: ...\nNegative Prompt: ...'}
                  disabled={movementModal.isLoading}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg text-xs text-gray-100 px-3 py-2 min-h-[120px] resize-none focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-60"
                />
                <p className="text-[10px] text-gray-400">
                  {t.storyGenerator.movementEditHint}{' '}
                  <span className="font-semibold">{t.storyGenerator.movementModalApply}</span>.
                </p>
              </div>
            </div>
            <div className="px-4 pb-4">
              <button
                type="button"
                onClick={handleApplyMovementSuggestion}
                disabled={movementModal.isLoading || !movementModal.text.trim()}
                className="w-full btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-xs font-semibold py-2.5 rounded-lg disabled:bg-purple-900 disabled:text-gray-400 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {movementModal.isLoading ? t.storyGenerator.editProcessing : t.storyGenerator.movementModalApply}
              </button>
            </div>
          </div>
        </div>
      )}

      {storyThumbnailPreview && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-auto max-w-[90vw] max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-gray-100">
                {t.storyGenerator.thumbnailPreviewTitle} #{storyThumbnailPreview.id}
              </h3>
              <button
                type="button"
                onClick={() => setStoryThumbnailPreview(null)}
                className="text-[18px] text-gray-400 hover:text-gray-100 px-1"
              >
                ×
              </button>
            </div>
            <div className="p-4 space-y-3 flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 flex items-center justify-center overflow-auto custom-scrollbar">
                <img
                  src={storyThumbnailPreview.url}
                  alt={`Story Thumbnail ${storyThumbnailPreview.id}`}
                  className="max-h-[80vh] max-w-[80vw] w-auto h-auto object-contain rounded-xl shadow-2xl"
                />
              </div>
              {storyThumbnailPreview.description && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-gray-200">
                      {t.storyGenerator.thumbnailDescription}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        const text = storyThumbnailPreview.description?.trim();
                        if (!text) return;
                        try {
                          await navigator.clipboard.writeText(text);
                          addLog('SUCCESS', t.storyGenerator.descriptionCopied);
                        } catch {
                          addLog('ERROR', t.storyGenerator.descriptionCopyFailed);
                        }
                      }}
                      className="px-2 py-0.5 rounded-md border border-zinc-600 text-[10px] text-gray-200 hover:bg-zinc-800"
                    >
                      {t.storyGenerator.copyLabel}
                    </button>
                  </div>
                  <textarea
                    readOnly
                    rows={4}
                    value={storyThumbnailPreview.description}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg text-xs text-gray-100 px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {characterPreview && (
        <div className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center px-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-auto max-w-[90vw] max-h-[90vh] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-gray-100">{t.storyGenerator.characterPreviewTitle}</h3>
              <button
                type="button"
                onClick={() => setCharacterPreview(null)}
                className="text-[18px] text-gray-400 hover:text-gray-100 px-1"
              >
                ×
              </button>
            </div>
            <div className="flex-1 p-4 flex items-center justify-center overflow-y-auto custom-scrollbar">
              <img
                src={characterPreview.url}
                alt={`${t.storyGenerator.characterPreviewTitle} #${characterPreview.index + 1}`}
                className="max-h-[80vh] w-auto max-w-full object-contain rounded-xl shadow-2xl"
              />
            </div>
          </div>
        </div>
      )}

      {sceneImagePreview && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-auto max-w-[90vw] max-h-[90vh] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <div className="text-xs text-gray-300">
                <div className="font-semibold text-gray-100">
                  Scene #{sceneImagePreview.sceneNumber} -{' '}
                  {sceneImagePreview.kind === 'start' ? t.storyGenerator.startFrame : t.storyGenerator.endFrame}
                </div>
                <div className="text-[11px] text-gray-400">{t.storyGenerator.clickOutsideToClose}</div>
              </div>
              <button
                type="button"
                onClick={() => setSceneImagePreview(null)}
                className="text-[20px] text-gray-400 hover:text-gray-100 px-2"
              >
                ×
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center p-4 overflow-y-auto custom-scrollbar">
              <img
                src={sceneImagePreview.url}
                alt={`Preview Scene ${sceneImagePreview.sceneNumber} - ${
                  sceneImagePreview.kind === 'start' ? 'Start' : 'End'
                }`}
                className="max-w-full max-h-[80vh] w-auto object-contain rounded-xl shadow-2xl"
              />
            </div>
          </div>
        </div>
      )}

      {jsonPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-[min(90vw,800px)] max-h-[80vh] bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <h4 className="text-sm font-semibold text-gray-100">
                {t.storyGenerator.jsonPreviewTitle.replace('{scene}', String(jsonPreview.sceneNumber))}
              </h4>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyJsonPreview}
                  className="text-[11px] px-2 py-1 rounded-md border border-zinc-600 text-gray-200 hover:bg-zinc-800"
                >
                  {jsonCopyLabel}
                </button>
                <button
                  type="button"
                  onClick={handleApplyJsonPreview}
                  className="text-[11px] px-2 py-1 rounded-md bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {t.storyGenerator.jsonPreviewApply}
                </button>
                <button
                  type="button"
                  onClick={handleCloseJsonPreview}
                  className="text-[14px] text-gray-400 hover:text-gray-100"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-4">
              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 max-h-[60vh] overflow-auto">
                <textarea
                  className="w-full bg-transparent text-[11px] text-gray-200 font-mono resize-none outline-none min-h-[260px]"
                  value={jsonPreview.json}
                  onChange={(e) =>
                    setJsonPreview((prev) => (prev ? { ...prev, json: e.target.value } : prev))
                  }
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {isSceneRekomModalOpen && recommendedSceneCount && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 w-full max-w-md text-sm text-gray-200 space-y-3">
            <h3 className="text-base font-semibold text-white mb-1">{t.storyGenerator.sceneRecomModalTitle}</h3>
            <p className="text-xs text-gray-300">
              {t.storyGenerator.sceneRecomModalMessage.replace('{userCount}', String(sceneCount)).replace('{aiCount}', String(recommendedSceneCount))}
            </p>
            <div className="flex gap-3 justify-end mt-2 text-xs">
              <button
                type="button"
                onClick={() => void handleIgnoreSceneRecommendation()}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-gray-100 font-semibold py-2 px-3 rounded-lg"
              >
                {t.storyGenerator.sceneRecomModalKeepMine}
              </button>
              <button
                type="button"
                onClick={() => void handleApplySceneRecommendation()}
                className="flex-1 text-white font-semibold py-2 px-3 rounded-lg btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                {t.storyGenerator.sceneRecomModalUseRecom}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GenerateAnimationPage;
