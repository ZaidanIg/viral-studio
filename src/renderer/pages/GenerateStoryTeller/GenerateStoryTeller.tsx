import React, { useEffect, useState } from 'react';
import PageHeader from '../../shared/components/PageHeader';
import GradientLoader from '../../shared/components/GradientLoader';
import { getFriendlyErrorHint } from '../../shared/utils/friendlyError';
import { useAuthReady } from '../../shared/utils/useAuthReady';
import { useImageResolution } from '../../shared/utils/useImageResolution';
import { useLanguage } from '../../shared/i18n';

type PuzzleMode = 'single' | 'double';
type PuzzleAspectRatio = '16:9' | '9:16';

type PuzzleStatus = 'idle' | 'prompt-ready' | 'generating' | 'completed' | 'error';

type StoryboardScene = {
  id: number;
  narration_segment: string;
  visual_prompt: string;
  duration_seconds: number;
};

type PuzzleItem = {
  id: number;
  index: number;
  mode: PuzzleMode;
  startPath: string;
  endPath: string;
  startPreviewUrl?: string;
  endPreviewUrl?: string;
  startImageBase64?: string;
  endImageBase64?: string;
  prompt: string;
  promptSource: 'ai' | 'manual' | null;
  isPromptSaved: boolean;
  isPromptGenerating: boolean;
  status: PuzzleStatus;
  lastMessage?: string;
  videoFilePath?: string;
  videoFileName?: string;
  videoUrl?: string;
};

const STORY_STYLES = [
  { id: 'Claymation', label: 'Claymation', emoji: '🧱' },
  { id: 'Puppet Animation', label: 'Puppet Animation', emoji: '🎎' },
  { id: 'Object Animation', label: 'Object Animation', emoji: '✏️' },
  { id: 'Brickfilm', label: 'Brickfilm', emoji: '🧩' },
  { id: 'Cutout Animation', label: 'Cutout Animation', emoji: '✂️' },
  { id: 'Pixilation', label: 'Pixilation', emoji: '🕺' },
  { id: 'Sand Animation', label: 'Sand Animation', emoji: '⏳' },
  { id: 'Light Painting', label: 'Light Painting', emoji: '🔦' },
  { id: 'Silhouette Animation', label: 'Silhouette', emoji: '🌑' },
  { id: 'Paint-on-Glass', label: 'Paint-on-Glass', emoji: '🎨' },
  { id: 'Needle Felt', label: 'Needle Felt', emoji: '🧶' },
  { id: 'Food Animation', label: 'Food Animation', emoji: '🥦' },
  { id: 'Chalk Animation', label: 'Chalk Animation', emoji: '🖍️' },
  { id: 'Whiteboard Animation', label: 'Whiteboard', emoji: '🖊️' },
  { id: 'Pinscreen Animation', label: 'Pinscreen', emoji: '📍' },
  { id: 'Origami Animation', label: 'Origami', emoji: '🦢' },
  { id: 'Embroidery Animation', label: 'Embroidery', emoji: '🧵' },
  { id: 'Sticker Animation', label: 'Sticker', emoji: '🏷️' },
  { id: 'Nature Animation', label: 'Nature', emoji: '🍂' },
  { id: 'Hardware Animation', label: 'Hardware', emoji: '🔧' },
];

const STORY_TELLER_TUTORIAL_URL = 'https://www.youtube.com/embed/gTDPWwMGBx8?autoplay=1&mute=1&origin=http://localhost:3000';

const VOICES = [
  { name: 'Kore', label: 'Kore (Clear Narration)' },
  { name: 'Puck', label: 'Puck' },
  { name: 'Charon', label: 'Charon' },
  { name: 'Fenrir', label: 'Fenrir' },
  { name: 'Zephyr', label: 'Zephyr' },
];

async function generateSpeech(apiKey: string, text: string, voiceName: string, speed = 1, pitch = 0): Promise<string> {
  const prosodyHint = `Voice guidance: speaking rate ${speed.toFixed(1)}x, pitch ${(pitch >= 0 ? '+' : '') + pitch.toFixed(1)} semitone. Read the script exactly as given.`;
  const finalText = `${prosodyHint}\n${text}`;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    contents: [{ parts: [{ text: finalText }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName } },
      },
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Gemini TTS failed: ${msg || res.statusText}`);
  }
  const json = await res.json();
  const inline = json?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  const b64 = inline?.data;
  const mime = inline?.mimeType || 'audio/wav';
  if (!b64) throw new Error('No audio data generated');

  const bin = atob(b64);
  const pcmBytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) pcmBytes[i] = bin.charCodeAt(i);

  const needsWavWrapper = mime.includes('pcm');
  let blob: Blob;
  if (needsWavWrapper) {
    // assume 16-bit PCM, mono, 24000 Hz (Gemini default)
    const sampleRate = 24000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const wavHeader = new ArrayBuffer(44);
    const view = new DataView(wavHeader);
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + pcmBytes.length, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // PCM chunk size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, 'data');
    view.setUint32(40, pcmBytes.length, true);
    const wavBytes = new Uint8Array(44 + pcmBytes.length);
    wavBytes.set(new Uint8Array(wavHeader), 0);
    wavBytes.set(pcmBytes, 44);
    blob = new Blob([wavBytes], { type: 'audio/wav' });
  } else {
    blob = new Blob([pcmBytes], { type: mime || 'audio/wav' });
  }

  return URL.createObjectURL(blob);
}

type ActivityLogEntry = {
  id: number;
  type: 'INFO' | 'SUCCESS' | 'ERROR';
  message: string;
  timestamp: string;
};

const GenerateStoryTellerHeaderIcon: React.FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-6 w-6 mr-3 text-indigo-400"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="4" width="18" height="14" rx="2" ry="2" />
    <path d="M7 4v14M17 4v14" />
    <path d="M3 10h4M3 14h4M17 10h4M17 14h4" />
  </svg>
);

const getVideoFileUrl = (filePath?: string): string | null => {
  if (!filePath) return null;
  const normalized = filePath.replace(/\\/g, '/');
  const httpUrl = `http://localhost:3123/video?path=${encodeURIComponent(filePath)}`;
  const fileUrl = `file:///${encodeURI(normalized)}`;
  // Gunakan http (server lokal) untuk menghindari blokir file:// di renderer; file:// sebagai fallback
  return httpUrl || fileUrl;
};

const getPuzzleVideoSrc = (item: PuzzleItem): string | null => {
  // Jika videoUrl sudah http(s), pakai langsung. Jika file://, pakai server lokal dulu.
  if (item.videoUrl && /^https?:\/\//i.test(item.videoUrl)) return item.videoUrl;
  const fromFilePath = getVideoFileUrl(item.videoFilePath);
  if (fromFilePath) return fromFilePath;
  return item.videoUrl || null;
};

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

const getFileName = (filePath: string): string => {
  const parts = filePath.split(/[\\/]/);
  return parts[parts.length - 1] || filePath;
};

const STORY_LOG_TAG = '[Story]';

const GenerateStoryTellerPage: React.FC = () => {
  const { t, language: uiLanguage } = useLanguage();
  const authReady = useAuthReady();
  const [puzzleMode, setPuzzleMode] = useState<PuzzleMode>('single');
  const [aspectRatio, setAspectRatio] = useState<PuzzleAspectRatio>('16:9');
  const [imageResolution] = useImageResolution();
  const veoModel = '3.1-fast-low';
  // Calculate fixed card dimensions based on resolution
  const cardDimensions = imageResolution === '1366x768'
    ? { parameter: 427 }
    : { parameter: 599 };
  const [outputFolder, setOutputFolder] = useState<string>('');
  const [maxImages, setMaxImages] = useState<number>(50);
  const [puzzleItems, setPuzzleItems] = useState<PuzzleItem[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isGeneratingPuzzle, setIsGeneratingPuzzle] = useState<boolean>(false);
  const [audioFileName, setAudioFileName] = useState<string>('');
  const [storyStyle, setStoryStyle] = useState<string>(STORY_STYLES[0].id);
  const [narrativeText, setNarrativeText] = useState<string>('');
  const [isAnalyzingAudio, setIsAnalyzingAudio] = useState<boolean>(false);
  const [storyboardScenes, setStoryboardScenes] = useState<StoryboardScene[]>([]);
  const [sceneVoice, setSceneVoice] = useState<Record<number, string>>({});
  const [sceneSpeed, setSceneSpeed] = useState<Record<number, number>>({});
  const [scenePitch, setScenePitch] = useState<Record<number, number>>({});
  const [sceneAudioUrl, setSceneAudioUrl] = useState<Record<number, string>>({});
  const [sceneAudioLoading, setSceneAudioLoading] = useState<Record<number, boolean>>({});
  const [sceneVideoUrl, setSceneVideoUrl] = useState<Record<number, string>>({});
  const [sceneVideoLoading, setSceneVideoLoading] = useState<Record<number, boolean>>({});
  const [sceneVideoEtaEnd, setSceneVideoEtaEnd] = useState<Record<number, number>>({});
  const [sceneVideoEtaText, setSceneVideoEtaText] = useState<Record<number, string>>({});
  const [sceneAudioProgress, setSceneAudioProgress] = useState<Record<number, number>>({});
  const [sceneAudioDuration, setSceneAudioDuration] = useState<Record<number, number>>({});
  const [sceneAudioPlaying, setSceneAudioPlaying] = useState<Record<number, boolean>>({});
  const sceneAudioRef = React.useRef<Record<number, HTMLAudioElement | null>>({});
  const [activityLogCopyLabel, setActivityLogCopyLabel] = useState<string>(t.activityLog.copyLog);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const getImageFileUrl = (filePath?: string) => {
    if (!filePath) return '';
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;
    const normalized = encodeURI(filePath.replace(/\\/g, '/'));
    return `file:///${normalized}`;
  };

  const ensureOutputFolder = async (): Promise<string | null> => {
    let folder = '';
    try {
      folder =
        localStorage.getItem('zeoStudio.folder.output') ||
        localStorage.getItem('zeoStudio.folder.output.lastSaved') ||
        '';
    } catch {
      folder = '';
    }

    if (folder.trim()) {
      return folder;
    }

    if (typeof window !== 'undefined' && window.zeoAPI?.selectFolder) {
      addLog('INFO', 'Memilih folder output...');
      const picked = await window.zeoAPI.selectFolder({ title: 'Pilih folder output' });
      if (picked && !picked.canceled && picked.path) {
        folder = picked.path;
        try {
          localStorage.setItem('zeoStudio.folder.output', folder);
          localStorage.setItem('zeoStudio.folder.output.lastSaved', folder);
          localStorage.setItem('zeoPuzzle.outputFolder', folder);
        } catch {
          /* ignore */
        }
        addLog('SUCCESS', `Folder diset: ${folder}`);
        return folder;
      }
    }

    addLog('ERROR', 'Output folder belum dikonfigurasi. Set di Settings.');
    return null;
  };

  const addLog = (type: ActivityLogEntry['type'], message: string) => {
    if (!message) return;
    if (type === 'ERROR') {
      setError(message);
    }
    const prefixedMessage = `${STORY_LOG_TAG} ${message}`;
    setActivityLogs((prev) => [
      ...prev,
      {
        id: prev.length ? prev[prev.length - 1].id + 1 : 1,
        type,
        message: prefixedMessage,
        timestamp: new Date().toLocaleTimeString(uiLanguage === 'ms' ? 'ms-MY' : uiLanguage === 'id' ? 'id-ID' : 'en-US', { hour12: false }),
      },
    ]);
  };

  useEffect(() => {
    if (!Object.values(sceneVideoLoading).some(Boolean)) return undefined;

    const interval = setInterval(() => {
      setSceneVideoEtaText((prev) => {
        const next: Record<number, string> = { ...prev };
        Object.entries(sceneVideoEtaEnd).forEach(([id, end]) => {
          const sceneId = Number(id);
          if (!sceneVideoLoading[sceneId]) return;
          const endMs = typeof end === 'number' ? end : Number(end);
          const remainingMs = Math.max(0, endMs - Date.now());
          const minutes = Math.floor(remainingMs / 60000);
          const seconds = Math.floor((remainingMs % 60000) / 1000);
          next[sceneId] = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        });
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [sceneVideoLoading, sceneVideoEtaEnd]);

  useEffect(() => {
    if (!error) return;
    const timeout = setTimeout(() => {
      setError(null);
    }, 5000);
    return () => clearTimeout(timeout);
  }, [error]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const globalOutput = localStorage.getItem('zeoStudio.folder.output') || '';
    const storedOutput = localStorage.getItem('zeoPuzzle.outputFolder') || '';
    const effective = storedOutput || globalOutput;
    if (effective) {
      setOutputFolder(effective);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.zeoAPI?.onBatchUpdate) return undefined;

    const unsubscribe = window.zeoAPI.onBatchUpdate?.((update: any) => {
      if (!update) return;

      const workflow = (update.workflow || '').toLowerCase();
      if (!workflow.includes('generate scene') && !workflow.includes('generate puzzle')) {
        return;
      }

      const message: string = update.message || '';

      if (update.type === 'INFO') {
        if (message) addLog('INFO', message);
        return;
      }

      if (update.type === 'ERROR') {
        if (message) addLog('ERROR', message);
        setIsGeneratingPuzzle(false);
        return;
      }

      if (update.type === 'BATCH_TOTAL') {
        if (message) addLog('INFO', message);
        return;
      }

      if (update.type === 'PROGRESS') {
        const puzzleIndex = typeof update.index === 'number' ? update.index : undefined;
        if (puzzleIndex) {
          setPuzzleItems((prev) =>
            prev.map((item) =>
              item.index === puzzleIndex
                ? {
                    ...item,
                    lastMessage: message || item.lastMessage,
                  }
                : item,
            ),
          );
        }
        if (message) addLog('INFO', message);
        return;
      }

      if (update.type === 'BATCH_COMPLETE') {
        setIsGeneratingPuzzle(false);
        if (message) addLog('SUCCESS', message);
        return;
      }

      if (update.type === 'SCENE_STARTED') {
        const puzzleIndex = typeof update.index === 'number' ? update.index : undefined;
        if (!puzzleIndex) return;
        setPuzzleItems((prev) =>
          prev.map((item) =>
            item.index === puzzleIndex
              ? {
                  ...item,
                  status: 'generating',
                  lastMessage: message || item.lastMessage,
                  // When regenerating, clear previous video preview for this scene
                  videoFilePath: undefined,
                  videoFileName: undefined,
                  videoUrl: undefined,
                }
              : item,
          ),
        );
        if (message) addLog('INFO', message);
        return;
      }

      if (update.type === 'SCENE_COMPLETED') {
        const puzzleIndex = typeof update.index === 'number' ? update.index : undefined;
        if (!puzzleIndex) return;

        const filePath = typeof update.filePath === 'string' ? update.filePath : undefined;
        const fileName = typeof update.fileName === 'string' ? update.fileName : undefined;
        const videoUrl = typeof update.videoUrl === 'string' ? update.videoUrl : undefined;

        setPuzzleItems((prev) =>
          prev.map((item) =>
            item.index === puzzleIndex
              ? {
                  ...item,
                  status: 'completed',
                  lastMessage: message || item.lastMessage,
                  videoFilePath: filePath || item.videoFilePath,
                  videoFileName: fileName || item.videoFileName,
                  videoUrl: videoUrl || item.videoUrl,
                }
              : item,
          ),
        );
        if (message) addLog('SUCCESS', message);
        return;
      }

      if (update.type === 'SCENE_ERROR') {
        const puzzleIndex = typeof update.index === 'number' ? update.index : undefined;
        if (!puzzleIndex) return;
        setPuzzleItems((prev) =>
          prev.map((item) =>
            item.index === puzzleIndex
              ? {
                  ...item,
                  status: 'error',
                  lastMessage: message || item.lastMessage,
                }
              : item,
          ),
        );
        if (message) addLog('ERROR', message);
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        try {
          unsubscribe();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const buildPuzzlesFromFiles = (files: string[], mode: PuzzleMode): PuzzleItem[] => {
    const sorted = [...files].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    const puzzles: PuzzleItem[] = [];

    if (sorted.length === 0) return puzzles;

    if (mode === 'single') {
      sorted.forEach((filePath, idx) => {
        puzzles.push({
          id: idx + 1,
          index: idx + 1,
          mode,
          startPath: filePath,
          endPath: filePath,
          prompt: '',
          promptSource: null,
          isPromptSaved: false,
          isPromptGenerating: false,
          status: 'idle',
        });
      });
      return puzzles;
    }

    // double mode: pair images in chunks of two; last image pairs with itself if odd count
    let i = 0;
    let puzzleIndex = 1;
    while (i < sorted.length) {
      const startPath = sorted[i];
      const endPath = sorted[i + 1] || sorted[i];
      puzzles.push({
        id: puzzleIndex,
        index: puzzleIndex,
        mode,
        startPath,
        endPath,
        prompt: '',
        promptSource: null,
        isPromptSaved: false,
        isPromptGenerating: false,
        status: 'idle',
      });
      puzzleIndex += 1;
      i += 2;
    }
    return puzzles;
  };

  const handleSelectOutputFolder = async () => {
    if (typeof window === 'undefined' || !window.zeoAPI?.selectFolder) return;
    try {
      const result = await window.zeoAPI.selectFolder({
        defaultPath: outputFolder || undefined,
        title: t.sceneGenerator.selectOutputFolder,
      });
      if (result?.canceled) return;
      const folderPath = (result as any)?.filePaths?.[0] ?? result?.path ?? '';
      if (!folderPath) return;
      setOutputFolder(folderPath);
      localStorage.setItem('zeoPuzzle.outputFolder', folderPath);
      localStorage.setItem('zeoStudio.folder.output', folderPath);
      addLog('SUCCESS', `${t.logMessages.common.folderOutputUpdated}: ${folderPath}`);
    } catch (err: any) {
      addLog('ERROR', err?.message || t.logMessages.sceneGenerator.engineNotAvailable);
    }
  };

  const handleVisualPromptChange = (sceneId: number, value: string) => {
    setStoryboardScenes((prev) => prev.map((sc) => (sc.id === sceneId ? { ...sc, visual_prompt: value } : sc)));
  };

  const handleScriptTextChange = (sceneId: number, value: string) => {
    setStoryboardScenes((prev) => prev.map((sc) => (sc.id === sceneId ? { ...sc, narration_segment: value } : sc)));
  };

  const handleGenerateVideo = async (scene: StoryboardScene) => {
    if (!scene?.visual_prompt) {
      addLog('ERROR', 'Visual prompt kosong, tidak bisa generate video.');
      return;
    }
    const bearerKey = localStorage.getItem('zeoStudio.bearerToken') || '';
    const downloadPath = (await ensureOutputFolder()) || '';
    const uiLang = uiLanguage || 'id';
    if (!bearerKey.trim()) {
      addLog('ERROR', 'Global Bearer Token belum diisi (Settings).');
      return;
    }
    if (!downloadPath.trim()) {
      addLog('ERROR', 'Output folder belum diisi (Settings).');
      return;
    }
    addLog('INFO', `Membuat video scene ${scene.id} dengan gaya ${storyStyle}...`);
    setSceneVideoLoading((prev) => ({ ...prev, [scene.id]: true }));
    setSceneVideoEtaEnd((prev) => ({ ...prev, [scene.id]: Date.now() + 5 * 60 * 1000 }));
    try {
      if (typeof window === 'undefined' || !(window as any).zeoAPI?.generateSceneVideo) {
        throw new Error('Engine video tidak tersedia di desktop app.');
      }

      const res = await (window as any).zeoAPI.generateSceneVideo({
        prompt: scene.visual_prompt,
        style: storyStyle,
        aspectRatio: '9:16',
        durationSeconds: scene.duration_seconds || 8,
        bearerKey,
        downloadPath,
        uiLanguage: uiLang,
      });

      if (!res?.ok) throw new Error(res?.error || 'Generate video gagal');

      let url = '';
      if (typeof res.videoUrl === 'string' && res.videoUrl) {
        url = res.videoUrl;
      } else if (typeof res.filePath === 'string' && res.filePath) {
        const fromLocalServer = getVideoFileUrl(res.filePath);
        url = fromLocalServer || '';
      } else if (typeof res.base64 === 'string' && res.base64) {
        const blob = new Blob([Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0))], { type: 'video/mp4' });
        url = URL.createObjectURL(blob);
      }

      if (!url) throw new Error('URL video tidak ditemukan.');

      if (sceneVideoUrl[scene.id]) URL.revokeObjectURL(sceneVideoUrl[scene.id]);
      setSceneVideoUrl((prev) => ({ ...prev, [scene.id]: url }));
      addLog('SUCCESS', `Video scene ${scene.id} siap.`);
    } catch (err: any) {
      const msg = err?.message || String(err);
      addLog('ERROR', `Gagal membuat video scene ${scene.id}: ${msg}`);
    } finally {
      setSceneVideoLoading((prev) => ({ ...prev, [scene.id]: false }));
      setSceneVideoEtaEnd((prev) => {
        const next = { ...prev };
        delete next[scene.id];
        return next;
      });
      setSceneVideoEtaText((prev) => {
        const next = { ...prev };
        delete next[scene.id];
        return next;
      });
    }
  };

  const handleGeneratePuzzles = async () => {
    if (isLoading) return;

    const folderPath = (await ensureOutputFolder()) || '';

    if (!folderPath.trim()) {
      addLog('ERROR', t.logMessages.common.folderOutputMissing);
      return;
    }

    if (typeof window === 'undefined' || !window.zeoAPI?.getImageFiles) {
      addLog('ERROR', t.logMessages.sceneGenerator.engineNotAvailable);
      return;
    }

    setIsLoading(true);
    setPuzzleItems([]);
    setError(null);

    setOutputFolder(folderPath);

    addLog('INFO', `${t.logMessages.sceneGenerator.scanningImages}: ${folderPath}`);

    try {
      const result = await window.zeoAPI.getImageFiles({ folderPath });

      if (!result || !result.ok) {
        const message = result && result.error ? result.error : t.sceneGenerator.unableToReadImages;
        addLog('ERROR', message);
        setIsLoading(false);
        return;
      }

      const files = Array.isArray(result.files) ? result.files : [];
      const limit = puzzleMode === 'single' ? 300 : 600;
      const capped = Math.min(Math.max(1, maxImages), limit);

      // jika tidak ada file, buat placeholder slot sesuai capped (tanpa path agar tidak muncul broken image)
      if (!files.length) {
        const placeholders = Array.from({ length: capped }, () => '');
        const puzzles = buildPuzzlesFromFiles(placeholders, puzzleMode);
        setPuzzleItems(puzzles);
        addLog('INFO', `No images found. Created ${puzzles.length} empty puzzle slot(s).`);
        setIsLoading(false);
        return;
      }

      const limitedFiles = files.slice(0, capped);

      addLog(
        'INFO',
        `${t.logMessages.sceneGenerator.scenesArranged} (${limitedFiles.length}/${files.length})`,
      );

      const puzzles = buildPuzzlesFromFiles(limitedFiles, puzzleMode);
      setPuzzleItems(puzzles);

      addLog('SUCCESS', `${t.logMessages.sceneGenerator.scenesArranged}: ${puzzles.length}`);

    } catch (error: any) {
      const message = error?.message || String(error);
      addLog('ERROR', `${t.logMessages.sceneGenerator.arrangeFailed}: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePromptChange = (puzzleId: number, value: string) => {
    setPuzzleItems((prev) =>
      prev.map((item) =>
        item.id === puzzleId
          ? {
              ...item,
              prompt: value,
              isPromptSaved: false,
              promptSource: 'manual',
              lastMessage: undefined,
            }
          : item,
      ),
    );
  };

  const handleSavePrompt = (puzzleId: number) => {
    setPuzzleItems((prev) => {
      const next = prev.map((item) =>
        item.id === puzzleId
          ? {
              ...item,
              prompt: item.prompt.trim(),
              isPromptSaved: item.prompt.trim().length >= 10,
              status: item.prompt.trim().length >= 10 ? 'prompt-ready' : item.status,
            }
          : item,
      );

      const updated = next.find((item) => item.id === puzzleId);
      if (updated) {
        if (!updated.prompt.trim()) {
          addLog('ERROR', t.logMessages.sceneGenerator.promptEmpty);
        } else if (updated.prompt.trim().length < 10) {
          addLog('ERROR', t.sceneGenerator.promptTooShort);
        } else {
          addLog('SUCCESS', t.logMessages.sceneGenerator.promptSaved);
        }
      }

      return next;
    });
  };

  const handleRemoveImage = (cardIndex: number, target: 'start' | 'end') => {
    setPuzzleItems((prev) => {
      const next = [...prev];
      const item = next[cardIndex];
      if (!item) return prev;
      if (target === 'start') {
        if (item.startPreviewUrl) URL.revokeObjectURL(item.startPreviewUrl);
        item.startPath = '';
        item.startPreviewUrl = undefined;
        item.startImageBase64 = undefined;
      } else {
        if (item.endPreviewUrl) URL.revokeObjectURL(item.endPreviewUrl);
        item.endPath = '';
        item.endPreviewUrl = undefined;
        item.endImageBase64 = undefined;
      }
      return [...next];
    });
  };

  const handleGeneratePromptForPuzzle = async (puzzleId: number) => {
    const targetPuzzle = puzzleItems.find((item) => item.id === puzzleId);
    if (!targetPuzzle) return;

    if (typeof window === 'undefined' || !window.zeoAPI?.generateScenePrompt) {
      addLog('ERROR', t.logMessages.sceneGenerator.engineNotAvailable);
      return;
    }

    const aiProvider = localStorage.getItem('zeoStudio.ai.provider') || '';
    const aiModel = localStorage.getItem('zeoStudio.ai.model') || '';
    const apiKey = localStorage.getItem('zeoStudio.ai.apiKey') || '';

    if (!aiProvider || !aiModel || !apiKey) {
      addLog('ERROR', t.logMessages.sceneGenerator.aiConfigIncomplete);
      return;
    }

    if (aiProvider !== 'Gemini') {
      addLog('ERROR', t.logMessages.ai.providerNotSupported);
      return;
    }

    setPuzzleItems((prev) =>
      prev.map((item) =>
        item.id === puzzleId
          ? {
              ...item,
              isPromptGenerating: true,
              lastMessage: undefined,
            }
          : item,
      ),
    );

    addLog('INFO', t.logMessages.sceneGenerator.aiHelpRequested);

    const generateScenePrompt = window.zeoAPI.generateScenePrompt;

    try {
      const result = await generateScenePrompt({
        aiProvider,
        aiModel,
        apiKey,
        scene: {
          index: targetPuzzle.index,
          mode: targetPuzzle.mode,
          startPath: targetPuzzle.startPath,
          endPath: targetPuzzle.endPath,
        },
      });

      if (!result || !result.ok || !result.prompt) {
        const errorMessage = (result && result.error) || 'AI did not return a usable prompt.';
        throw new Error(errorMessage);
      }

      const aiPrompt = result.prompt.trim();

      setPuzzleItems((prev) =>
        prev.map((item) =>
          item.id === puzzleId
            ? {
                ...item,
                prompt: aiPrompt,
                promptSource: 'ai',
                isPromptSaved: false,
                isPromptGenerating: false,
                status: 'prompt-ready',
                lastMessage: t.logMessages.sceneGenerator.aiAnalyzePromptsGenerated,
              }
            : item,
        ),
      );

      addLog('SUCCESS', t.logMessages.sceneGenerator.aiAnalyzePromptsGenerated);
    } catch (error: any) {
      const message = error?.message || String(error);
      setPuzzleItems((prev) =>
        prev.map((item) =>
          item.id === puzzleId
            ? {
                ...item,
                isPromptGenerating: false,
                status: 'error',
                lastMessage: message,
              }
            : item,
        ),
      );
      addLog(
        'ERROR',
        t.logMessages.sceneGenerator.aiPromptFailWithIndex
          .replace('{index}', String(targetPuzzle.index))
          .replace('{message}', message),
      );
    }
  };

  const hasPuzzles = puzzleItems.length > 0;
  const allPromptsSaved = hasPuzzles && puzzleItems.every((item) => item.isPromptSaved && item.prompt.trim().length >= 10);

  const handleStartGeneratePuzzle = async (options?: { puzzlesOverride?: PuzzleItem[]; skipPromptCheck?: boolean }) => {
    if (isGeneratingPuzzle) return;

    if (!authReady) {
      addLog('ERROR', t.logMessages.common.statusNotReady);
      return;
    }

    const puzzlesToUse = options?.puzzlesOverride ?? puzzleItems;

    if (!options?.skipPromptCheck && (!puzzlesToUse.length || !puzzlesToUse.every((item) => item.isPromptSaved && item.prompt.trim().length >= 10))) {
      addLog('ERROR', t.logMessages.sceneGenerator.allPromptsRequired);
      return;
    }

    if (typeof window === 'undefined' || !window.zeoAPI?.startSceneWorkflow) {
      addLog('ERROR', t.logMessages.sceneGenerator.engineNotAvailable);
      return;
    }

    const bearerKey = localStorage.getItem('zeoStudio.bearerToken') || '';
    const downloadPath = (await ensureOutputFolder()) || '';
    const flowProjectId = localStorage.getItem('zeoStudio.workflow.flowProjectId') || '';

    if (!bearerKey.trim()) {
      addLog('ERROR', t.logMessages.common.bearerTokenMissing);
      return;
    }

    if (!downloadPath.trim()) {
      addLog('ERROR', t.logMessages.common.folderOutputMissing);
      return;
    }

    const resolution: '720p' = '720p';

    try {
      setIsGeneratingPuzzle(true);
      setError(null);
      addLog('INFO', t.logMessages.sceneGenerator.batchStarted);

      const payloadPuzzles = puzzlesToUse.map((item) => ({
        index: item.index,
        mode: item.mode === 'double' ? 'pair-chunk' : item.mode,
        startPath: item.startPath,
        endPath: item.endPath,
        startImageBase64: item.startImageBase64,
        endImageBase64: item.endImageBase64,
        prompt: item.prompt,
      }));

      await window.zeoAPI.startSceneWorkflow({
        bearerKey,
        downloadPath,
        flowProjectId,
        aspectRatio,
        veoModel,
        resolution,
        scenes: payloadPuzzles,
        uiLanguage,
      });
    } catch (error: any) {
      const message = error?.message || String(error);
      addLog('ERROR', `${t.logMessages.sceneGenerator.batchStarted}: ${message}`);
      setIsGeneratingPuzzle(false);
    }
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

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggingIndex(index);
    try {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('application/puzzle-index', String(index));
      e.dataTransfer.setData('text/plain', String(index));
    } catch {
      // ignore
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, idx: number) => {
    e.preventDefault();
    const toIdx = idx;
    if (draggingIndex === null || draggingIndex === toIdx) return;
    setPuzzleItems((prev) => {
      const copy = [...prev];
      const [removed] = copy.splice(draggingIndex, 1);
      copy.splice(toIdx, 0, removed);
      return copy.map((item, i) => ({ ...item, index: i + 1 }));
    });
    setDraggingIndex(null);
  };

  const handleDragEnd = () => {
    setDraggingIndex(null);
  };

  const handleFileDrop = async (
    e: React.DragEvent<HTMLDivElement>,
    cardIndex: number,
    target: 'start' | 'end',
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const fileList = Array.from(e.dataTransfer.files || []);
    if (!fileList.length) return;

    const dropped = fileList[0] as File & { path?: string };
    const pickedPath = dropped.path || dropped.name;
    const objectUrl = URL.createObjectURL(dropped);

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setPuzzleItems((prev) => {
        const next = [...prev];
        const item = next[cardIndex];
        if (!item) return prev;

        if (target === 'start') {
          item.startPath = pickedPath;
          item.startPreviewUrl = objectUrl;
          item.startImageBase64 = base64;
        } else {
          item.endPath = pickedPath;
          item.endPreviewUrl = objectUrl;
          item.endImageBase64 = base64;
        }
        return [...next];
      });
    };
    reader.readAsDataURL(dropped);
  };

  const handleAudioFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioFileName(file.name);
    addLog('SUCCESS', `Audio dipilih: ${file.name}`);
    void handleAnalyzeAudio(file);
  };

  const handleAnalyzeAudio = async (file: File) => {
    setIsAnalyzingAudio(true);
    setNarrativeText('');
    setStoryboardScenes([]);
    try {
      const apiKey = (typeof window !== 'undefined' && localStorage.getItem('zeoStudio.ai.apiKey')) || '';
      const model = (typeof window !== 'undefined' && localStorage.getItem('zeoStudio.ai.model')) || 'gemini-3-flash-preview';

      if (!apiKey) {
        addLog('ERROR', 'API Key Gemini belum dikonfigurasi. Silakan isi di Pengaturan.');
        return;
      }

      const useBridge = typeof window !== 'undefined' && (window as any).zeoAPI?.analyzeGeminiAudio;

      if (useBridge) {
        // Kirim base64 agar konsisten dengan contoh referensi
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1] || '');
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const result = await (window as any).zeoAPI.analyzeGeminiAudio({
          base64,
          mimeType: file.type || 'audio/mp3',
          fileName: file.name,
          apiKey,
          model,
          prompt:
            'Dengarkan audio ini dan tulis ulang seluruh isi ceritanya dalam Bahasa Indonesia tanpa meringkas atau menghilangkan detail. Wajib mulai dengan kalimat: "Kamu tau gaksih? kalau". Gunakan gaya percakapan santai yang menarik (seperti narasi viral), tapi tetap pertahankan panjang dan detail asli.',
        });

        if (result?.ok && typeof result.text === 'string') {
          setNarrativeText(result.text.trim());
          addLog('SUCCESS', `Analisis audio selesai (${file.name})`);
        } else {
          throw new Error(result?.error || 'Analisis audio gagal');
        }
        return;
      }

      // Fallback jika bridge tidak ada
      addLog('ERROR', 'Bridge analyzeGeminiAudio tidak tersedia. Jalankan via desktop app.');
    } catch (err: any) {
      const message = err?.message || String(err);
      setNarrativeText('');
      addLog('ERROR', `Analisis audio gagal: ${message}`);
    } finally {
      setIsAnalyzingAudio(false);
    }
  };

  const statusLabel = (() => {
    if (isLoading) return t.logMessages.sceneGenerator.statusArranging;
    if (!hasPuzzles) return t.logMessages.sceneGenerator.statusReadyArrange;
    if (!allPromptsSaved)
      return t.logMessages.sceneGenerator.statusPromptIncomplete;
    if (isGeneratingPuzzle) return t.logMessages.sceneGenerator.statusRunning;
    return t.logMessages.sceneGenerator.statusReady;
  })();

  const primaryActionIsGenerate = false;

  // Clamp max images when mode changes (single: 1-300, double: 1-600)
  useEffect(() => {
    const limit = puzzleMode === 'single' ? 300 : 600;
    setMaxImages((prev) => Math.min(Math.max(1, prev), limit));
  }, [puzzleMode]);

  const parseStoryboardText = (raw: string): StoryboardScene[] => {
    if (!raw) return [];
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    try {
      const parsed = JSON.parse(cleaned);
      if (parsed?.scenes && Array.isArray(parsed.scenes)) return parsed.scenes as StoryboardScene[];
    } catch {
      // ignore JSON parse error
    }
    return [];
  };

  const normalizeStoryboardScenes = (scenes: StoryboardScene[], narrative: string): StoryboardScene[] => {
    if (!scenes || scenes.length === 0) return [];
    const words = (narrative || '')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean);
    const chunkSize = words.length > 0 ? Math.ceil(words.length / scenes.length) : 0;
    const maxWordsPerScene = 22; // ~8 detik @ ~160 wpm
    return scenes.map((scene, idx) => {
      let narration = (scene.narration_segment || '').trim();
      if (narration.length === 0 || narration.split(' ').length < 4) {
        if (chunkSize > 0) {
          const chunk = words.slice(idx * chunkSize, (idx + 1) * chunkSize).join(' ');
          if (chunk) narration = chunk;
        }
        if (!narration) narration = `Narasi scene ${scene.id || idx + 1} belum terisi.`;
      }
      const narrationWords = narration.split(' ').filter(Boolean);
      if (narrationWords.length > maxWordsPerScene) {
        narration = `${narrationWords.slice(0, maxWordsPerScene).join(' ')}...`;
      }
      return {
        ...scene,
        duration_seconds: 8,
        narration_segment: narration,
      } as StoryboardScene;
    });
  };

  const generateStoryboard = async (params: {
    apiKey: string;
    model: string;
    narrative: string;
    style: string;
  }): Promise<StoryboardScene[]> => {
    const { apiKey, model, narrative, style } = params;
    if (typeof window !== 'undefined' && (window as any).zeoAPI?.generateGeminiStoryboard) {
      const res = await (window as any).zeoAPI.generateGeminiStoryboard({ apiKey, model, narrative, style });
      if (res?.ok && Array.isArray(res.scenes)) return res.scenes as StoryboardScene[];
      throw new Error(res?.error || 'Storyboard generation failed');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const prompt = `Analyze this narrative: "${narrative}".
Break this narrative down into a storyboard for a short video using the specific animation style: "${style}".
Rules:
1. TIMING RULE (CRITICAL): Each scene MUST be approximately 8 seconds long. If a sentence is too long to be spoken comfortably in 8 seconds, split it into multiple scenes.
2. VISUAL STYLE ENFORCEMENT: The visual prompt MUST strictly describe a "${style}" style. Use keywords specific to this medium.
3. SAFETY & POLICY COMPLIANCE (STRICT): Ensure all visual prompts are SafeSearch compliant. DO NOT generate prompts containing: Violence, Gore, Sexual Content, Hate Symbols, Harassment, or Personally Identifiable Information of real people.
4. PROMPT DETAIL: The visual prompt must be extremely detailed for Veo 3.1 video generation. Include: Texture & Material details specific to ${style}, Lighting (Cinematic, Studio, Volumetric), Camera movement.
5. MANDATORY FINAL SCENE (CTA): Add one final scene after the story ends. Narration: "Bagaimana pendapat kalian? Tulis di kolom komentar ya!" Visual Prompt: A closing shot in ${style} style. Duration: 8 seconds.
6. Return a JSON object with a 'scenes' array. Each scene has: id (integer), narration_segment (string), visual_prompt (string), duration_seconds (number).`;

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini storyboard failed: ${errText || response.statusText}`);
    }

    const json = await response.json();
    const text = json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join(' ').trim();
    const scenes = parseStoryboardText(text || '');
    if (!scenes.length) throw new Error('Gemini returned empty storyboard.');
    return scenes;
  };

  const handleGenerateStoryboard = async () => {
    const apiKey = (typeof window !== 'undefined' && localStorage.getItem('zeoStudio.ai.apiKey')) || '';
    const model = (typeof window !== 'undefined' && localStorage.getItem('zeoStudio.ai.model')) || 'gemini-3-flash-preview';
    const narrative = narrativeText.trim();

    if (!apiKey) {
      addLog('ERROR', 'API Key Gemini belum dikonfigurasi. Silakan isi di Pengaturan.');
      return;
    }
    if (!narrative) {
      addLog('ERROR', 'Teks narasi belum tersedia. Analisis audio terlebih dahulu.');
      return;
    }

    try {
      setIsGeneratingPuzzle(true);
      addLog('INFO', `Membuat storyboard (${storyStyle})...`);
      // cleanup audio urls dari hasil sebelumnya
      Object.values(sceneAudioUrl).forEach((url) => {
        if (typeof url === 'string' && url) URL.revokeObjectURL(url);
      });
      setSceneAudioUrl({});
      const scenes = await generateStoryboard({ apiKey, model, narrative, style: storyStyle });
      const normalized = normalizeStoryboardScenes(scenes, narrative);
      setStoryboardScenes(normalized);
      setSceneVoice(scenes.reduce<Record<number, string>>((acc, sc) => { acc[sc.id] = 'Kore'; return acc; }, {}));
      setSceneSpeed(scenes.reduce<Record<number, number>>((acc, sc) => { acc[sc.id] = 1; return acc; }, {}));
      setScenePitch(scenes.reduce<Record<number, number>>((acc, sc) => { acc[sc.id] = 0; return acc; }, {}));
      addLog('SUCCESS', `Storyboard siap: ${scenes.length} scene (${storyStyle}).`);
    } catch (err: any) {
      const msg = err?.message || String(err);
      addLog('ERROR', `Gagal membuat storyboard: ${msg}`);
    } finally {
      setIsGeneratingPuzzle(false);
    }
  };

  const handlePrimaryAction = async () => {
    await handleGenerateStoryboard();
  };

  const handleBuildAudio = async (scene: StoryboardScene) => {
    const apiKey = (typeof window !== 'undefined' && localStorage.getItem('zeoStudio.ai.apiKey')) || '';
    if (!apiKey) {
      addLog('ERROR', 'API Key Gemini belum dikonfigurasi. Silakan isi di Pengaturan.');
      return;
    }
    if (!scene?.narration_segment) {
      addLog('ERROR', 'Teks narasi scene kosong.');
      return;
    }
    addLog('INFO', `Membuat audio scene ${scene.id} (voice ${sceneVoice[scene.id] || 'Kore'}, speed ${(sceneSpeed[scene.id] || 1).toFixed(1)}x, pitch ${(scenePitch[scene.id] ?? 0).toFixed(1)}).`);
    setSceneAudioLoading((prev) => ({ ...prev, [scene.id]: true }));
    try {
      const url = await generateSpeech(
        apiKey,
        scene.narration_segment,
        sceneVoice[scene.id] || 'Kore',
        sceneSpeed[scene.id] || 1,
        scenePitch[scene.id] ?? 0,
      );
      // cleanup previous
      if (sceneAudioUrl[scene.id]) URL.revokeObjectURL(sceneAudioUrl[scene.id]);
      setSceneAudioUrl((prev) => ({ ...prev, [scene.id]: url }));
      addLog('SUCCESS', `Audio scene ${scene.id} berhasil dibuat (${sceneVoice[scene.id] || 'Kore'})`);
      setSceneAudioProgress((prev) => ({ ...prev, [scene.id]: 0 }));
      setSceneAudioDuration((prev) => ({ ...prev, [scene.id]: 0 }));
      setSceneAudioPlaying((prev) => ({ ...prev, [scene.id]: false }));
    } catch (err: any) {
      const msg = err?.message || String(err);
      addLog('ERROR', `Gagal membuat audio scene ${scene.id}: ${msg}`);
    } finally {
      setSceneAudioLoading((prev) => ({ ...prev, [scene.id]: false }));
    }
  };

  const performFullReset = () => {
    setPuzzleMode('single');
    setAspectRatio('16:9');
    setOutputFolder('');
    setMaxImages(50);

    setAudioFileName('');
    setNarrativeText('');
    setStoryStyle(STORY_STYLES[0].id);
    Object.values(sceneAudioUrl).forEach((url) => {
      if (typeof url === 'string' && url) URL.revokeObjectURL(url);
    });
    setSceneAudioUrl({});
    Object.values(sceneVideoUrl).forEach((url) => {
      if (typeof url === 'string' && url) URL.revokeObjectURL(url);
    });
    setSceneVideoUrl({});
    setSceneVideoLoading({});
    setSceneVideoEtaEnd({});
    setSceneVideoEtaText({});
    setSceneAudioProgress({});
    setSceneAudioDuration({});
    setSceneAudioPlaying({});
    setScenePitch({});
    setStoryboardScenes([]);
    setPuzzleItems([]);
    setActivityLogs([]);
    setIsGeneratingPuzzle(false);
    setIsLoading(false);
    setError(null);
  };

  const handleFullReset = () => {
    if (isLoading || isGeneratingPuzzle) return;
    setIsResetConfirmOpen(true);
  };

  const handleConfirmReset = () => {
    setIsResetConfirmOpen(false);
    if (isLoading || isGeneratingPuzzle) return;
    performFullReset();
  };

  return (
    <>
      <div className="h-full w-full flex flex-col min-h-0 text-gray-50">
        <PageHeader
          iconId="generate-storyteller"
          iconClassName="h-6 w-6 mr-3 text-white"
          title="Generate Story Teller"
          description="Ciptakan rangkaian cerita visual dan hasilkan video secara otomatis."
          showApiKeyTest
          tutorialUrl={STORY_TELLER_TUTORIAL_URL}
          tutorialTitle="Tutorial Story Teller"
          tutorialMode="direct"
        />

      <div className="flex-1 p-4 lg:p-6 min-h-0 overflow-hidden">
        <div className="flex h-full gap-4">
          <section 
            className="bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col min-h-0 h-full flex-none"
            style={{
              width: `${cardDimensions.parameter}px`,
              minWidth: `${cardDimensions.parameter}px`,
              backgroundColor: '#181818',
              backgroundImage:
                'linear-gradient(135deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.1) 75%, transparent 75%, transparent), linear-gradient(45deg, rgba(255,255,255,0.08) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.08) 75%, transparent 75%, transparent), linear-gradient(0deg, rgba(0,0,0,0.24), rgba(0,0,0,0.24))',
              backgroundSize: '12px 12px, 12px 12px, 100% 100%',
              backgroundBlendMode: 'overlay, overlay, normal',
            }}
          >
            <div className="flex flex-col h-full">
              <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar px-6 py-4 space-y-4">
                <div className="space-y-2 text-sm">
                  <label className="block text-xs font-semibold text-gray-300">Audio narasi</label>
                  <label className="flex items-center justify-between rounded-lg border border-dashed border-zinc-700 bg-zinc-800/60 px-3 py-3 cursor-pointer hover:border-purple-500 transition-colors">
                    <div className="min-w-0 pr-3">
                      <p className="text-sm text-gray-100 font-semibold truncate">{audioFileName || 'Pilih berkas audio (mp3/wav/aac)'}</p>
                      <p className="text-[11px] text-gray-400">Dipakai sebagai sumber cerita sebelum generate.</p>
                      {isAnalyzingAudio && (
                        <p className="text-[11px] text-purple-300 mt-1">Menganalisis audio...</p>
                      )}
                    </div>
                    <span className="text-[11px] text-gray-300 border border-zinc-700 rounded-md px-2 py-1">Pilih</span>
                    <input type="file" accept="audio/*" className="hidden" onChange={handleAudioFileSelect} />
                  </label>

                  {!isAnalyzingAudio && (
                    <textarea
                      value={narrativeText}
                      onChange={(e) => setNarrativeText(e.target.value)}
                      placeholder="Hasil analisis audio akan muncul di sini..."
                      className="w-full min-h-[140px] resize-y px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  )}
                </div>

                <div className="space-y-2 text-sm">
                  <label className="block text-xs font-semibold text-gray-300">Gaya animasi</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {STORY_STYLES.map((style) => {
                      const isActive = storyStyle === style.id;
                      return (
                        <button
                          key={style.id}
                          type="button"
                          onClick={() => setStoryStyle(style.id)}
                          className={`flex flex-col items-center justify-center gap-1.5 text-center px-3 py-3 rounded-xl border text-sm transition-all duration-200 h-20 shadow-[0_4px_16px_rgba(0,0,0,0.25)] ${
                            isActive
                              ? 'border-purple-400 bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                              : 'border-zinc-800 bg-zinc-900 text-gray-100 hover:border-purple-400/70 hover:text-white hover:bg-zinc-850'
                          }`}
                        >
                          <span className="text-lg" aria-hidden="true">{style.emoji}</span>
                          <span className="text-[12px] font-semibold leading-tight">{style.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="px-6 pb-5 pt-3 border-t border-zinc-800 space-y-3">
                {(isGeneratingPuzzle || isLoading) && (
                  <div className="mb-4">
                    <GradientLoader
                      size="sm"
                      text={t.workflow.status.processing}
                      subtitle="Menyiapkan cerita dan memproses video..."
                    />
                  </div>
                )}

                <div className="flex">
                  <button
                    type="button"
                    onClick={handlePrimaryAction}
                    disabled={
                      isLoading ||
                      isGeneratingPuzzle ||
                      (primaryActionIsGenerate ? !authReady : false) ||
                      !narrativeText.trim() ||
                      !outputFolder.trim()
                    }
                    className={`w-full min-h-[48px] px-4 rounded-lg text-white font-semibold transition-all duration-200 btn-glass-primary flex items-center justify-center
                      focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-zinc-900
                      ${
                        isLoading ||
                        isGeneratingPuzzle ||
                        (primaryActionIsGenerate ? !authReady : false) ||
                        !narrativeText.trim() ||
                        !outputFolder.trim()
                          ? 'bg-zinc-600 cursor-not-allowed'
                          : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
                      }`}
                    aria-label={primaryActionIsGenerate ? 'Generate Puzzle' : 'Build Puzzle'}
                  >
                    {isLoading || isGeneratingPuzzle
                      ? t.workflow.status.processing
                      : primaryActionIsGenerate
                      ? 'Generate Story'
                      : 'Generate Story Teller'}
                  </button>
                </div>

                <div className="max-h-48 bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-xs text-gray-200 flex flex-col">
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
                      <span className="text-[10px] text-gray-500">{activityLogs.length} {t.common.entries}</span>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
                    {activityLogs.length === 0 ? (
                      <p className="text-[11px] text-gray-500">{t.activityLog.noActivity}</p>
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
                                : 'border-zinc-600 text-gray-200'
                            }`}
                          >
                            {log.type}
                          </span>
                          <span className="text-[11px] text-gray-200 leading-snug break-words flex-1">{log.message}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Right panel: Preview */}
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
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-gray-50">Preview Story Teller</h3>
              </div>
              <button
                type="button"
                onClick={handleFullReset}
                disabled={isGeneratingPuzzle || isLoading}
                className={`inline-flex items-center px-4 py-2 text-[11px] font-semibold rounded-lg shadow-md transition-all duration-200
                  focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-zinc-900
                  ${
                    isGeneratingPuzzle || isLoading
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'btn-glass-primary bg-red-600 hover:bg-red-700 text-white'
                  }`}
              >
                <span className="mr-1.5 text-xs">🗑️</span>
                <span>
                  {t.buttons.clear} {t.common.data}
                </span>
              </button>
            </div>
            <div className="flex-1 p-4 lg:p-6 overflow-hidden">
              <div className="h-full overflow-y-auto custom-scrollbar space-y-4">
                {isGeneratingPuzzle && storyboardScenes.length === 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {Array.from({ length: 6 }).map((_, idx) => (
                      <div key={idx} className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 flex flex-col gap-3 shadow-[0_10px_30px_rgba(0,0,0,0.35)] animate-pulse">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-7 w-7 rounded-md bg-zinc-800" />
                          <span className="h-3 w-10 rounded bg-zinc-800" />
                        </div>
                        <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                          <div className="h-3 w-20 rounded bg-zinc-800" />
                          <div className="h-9 rounded bg-zinc-800" />
                          <div className="h-3 w-full rounded bg-zinc-800" />
                        </div>
                        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 h-16" />
                        <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 h-20" />
                        <div className="rounded-lg h-10 bg-zinc-800" />
                      </div>
                    ))}
                  </div>
                ) : storyboardScenes.length === 0 ? (
                  <div className="w-full h-full flex items-center justify-center bg-zinc-950/40 rounded-lg text-gray-500 text-center text-sm p-6">
                    <div className="max-w-sm space-y-2">
                      <p className="text-gray-400 text-sm leading-snug">
                        Story Scene lengkap akan tampil di sini setelah Anda menekan <span className="font-semibold text-gray-200">Generate Story Teller</span>.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {storyboardScenes.map((scene) => (
                      <div key={scene.id} className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 flex flex-col gap-3 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
                        <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-purple-600 via-fuchsia-500 to-blue-500 text-white text-xs font-semibold shadow-[0_6px_18px_rgba(0,0,0,0.35)]">{scene.id}</span>
                            <span className="text-[10px] uppercase tracking-wide text-gray-300 font-semibold">Scene</span>
                          </div>
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-zinc-800 text-gray-200 border border-zinc-700">{scene.duration_seconds || 8}s</span>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-[11px] text-gray-300 font-semibold uppercase tracking-wide">
                            <span>Audio Configuration</span>
                          </div>
                          <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                            <label className="text-[11px] text-gray-400">Select Voice</label>
                            <select
                              className="w-full rounded-md bg-zinc-900 border border-zinc-700 text-sm text-gray-100 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500"
                              value={sceneVoice[scene.id] || 'Kore'}
                              onChange={(e) => setSceneVoice((prev) => ({ ...prev, [scene.id]: e.target.value }))}
                            >
                              {VOICES.map((v) => (
                                <option key={v.name} value={v.name}>{v.label}</option>
                              ))}
                            </select>
                            <div>
                              <div className="flex justify-between text-[10px] text-gray-400">
                                <span>Speaking Speed</span>
                                <span className="text-gray-200 font-semibold">{(sceneSpeed[scene.id] || 1).toFixed(1)}x</span>
                              </div>
                              <input
                                type="range"
                                min={0.5}
                                max={2}
                                step={0.1}
                                value={sceneSpeed[scene.id] || 1}
                                onChange={(e) => setSceneSpeed((prev) => ({ ...prev, [scene.id]: parseFloat(e.target.value) }))}
                                className="w-full accent-purple-500"
                              />
                              <div className="flex justify-between text-[10px] text-gray-400 mt-2">
                                <span>Pitch</span>
                                <span className="text-gray-200 font-semibold">{(scenePitch[scene.id] ?? 0).toFixed(1)} st</span>
                              </div>
                              <input
                                type="range"
                                min={-12}
                                max={12}
                                step={0.5}
                                value={scenePitch[scene.id] ?? 0}
                                onChange={(e) => setScenePitch((prev) => ({ ...prev, [scene.id]: parseFloat(e.target.value) }))}
                                className="w-full accent-purple-500"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-[11px] text-gray-300 font-semibold uppercase tracking-wide">
                              <span>Script Text</span>
                            </div>
                            <button
                              type="button"
                              className="text-[10px] px-2 py-1 rounded-md border border-zinc-700 text-gray-200 hover:border-purple-500 hover:text-white"
                              onClick={() => copyText(scene.narration_segment)}
                            >
                              Copy Text
                            </button>
                          </div>
                          <textarea
                            value={scene.narration_segment}
                            onChange={(e) => handleScriptTextChange(scene.id, e.target.value)}
                            className="w-full rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-[12px] text-gray-200 h-24 whitespace-pre-wrap overflow-y-auto custom-scrollbar focus:outline-none focus:ring-1 focus:ring-purple-500"
                          />
                          <div className="flex justify-end text-[10px] text-gray-400">{(scene.narration_segment || '').length} characters</div>

                          <div className="pt-1">
                            <button
                              type="button"
                              disabled={!!sceneAudioLoading[scene.id]}
                              onClick={() => handleBuildAudio(scene)}
                              className={`w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition-all active:scale-[0.99] ${
                                sceneAudioLoading[scene.id]
                                  ? 'bg-zinc-700 text-gray-300 cursor-not-allowed'
                                  : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700'
                              }`}
                            >
                              🔊 {sceneAudioLoading[scene.id] ? 'Generating Audio...' : 'Generate Audio'}
                            </button>
                          </div>
                        </div>

                        {sceneAudioUrl[scene.id] && (
                          <div className="pt-1 space-y-2">
                            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 space-y-2">
                              <audio
                                ref={(el) => { if (el) sceneAudioRef.current[scene.id] = el; }}
                                preload="metadata"
                                className="hidden"
                                src={sceneAudioUrl[scene.id]}
                                onLoadedMetadata={(e) => {
                                  const d = (e.target as HTMLAudioElement).duration;
                                  setSceneAudioDuration((prev) => ({ ...prev, [scene.id]: isFinite(d) ? d : 0 }));
                                }}
                                onTimeUpdate={(e) => {
                                  const cur = (e.target as HTMLAudioElement).currentTime;
                                  setSceneAudioProgress((prev) => ({ ...prev, [scene.id]: cur }));
                                }}
                                onPlay={() => setSceneAudioPlaying((prev) => ({ ...prev, [scene.id]: true }))}
                                onPause={() => setSceneAudioPlaying((prev) => ({ ...prev, [scene.id]: false }))}
                                onEnded={() => setSceneAudioPlaying((prev) => ({ ...prev, [scene.id]: false }))}
                              />
                              <div className="space-y-1">
                                <div className="flex justify-between text-[10px] text-gray-400">
                                  <span>{(sceneAudioProgress[scene.id] || 0).toFixed(1)}s</span>
                                  <span className="text-gray-200">{sceneVoice[scene.id] || 'Kore'} • {(sceneSpeed[scene.id] || 1).toFixed(1)}x • {(scenePitch[scene.id] ?? 0).toFixed(1)} st</span>
                                  <span>{(sceneAudioDuration[scene.id] || 0).toFixed(1)}s</span>
                                </div>
                                <input
                                  type="range"
                                  min={0}
                                  max={sceneAudioDuration[scene.id] || 0}
                                  step={0.1}
                                  value={Math.min(sceneAudioProgress[scene.id] || 0, sceneAudioDuration[scene.id] || 0)}
                                  onChange={(e) => {
                                    const el = sceneAudioRef.current[scene.id];
                                    if (el) {
                                      el.currentTime = parseFloat(e.target.value);
                                    }
                                    setSceneAudioProgress((prev) => ({ ...prev, [scene.id]: parseFloat(e.target.value) }));
                                  }}
                                  className="w-full accent-purple-500"
                                />
                              </div>
                              <div className="flex items-center justify-between gap-2 text-[11px] text-gray-300">
                                <span className="px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700">WAV</span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    className="px-2 py-1 rounded-md border border-zinc-700 text-gray-200 hover:border-purple-500 hover:text-white"
                                    onClick={() => {
                                      const el = sceneAudioRef.current[scene.id];
                                      if (el) {
                                        if (sceneAudioPlaying[scene.id]) {
                                          el.pause();
                                        } else {
                                          el.play();
                                        }
                                      }
                                    }}
                                  >
                                    {sceneAudioPlaying[scene.id] ? 'Pause' : 'Play'}
                                  </button>
                                  <button
                                    type="button"
                                    className="px-2 py-1 rounded-md border border-zinc-700 text-gray-200 hover:border-purple-500 hover:text-white"
                                    onClick={() => {
                                      const a = document.createElement('a');
                                      a.href = sceneAudioUrl[scene.id];
                                      a.download = `scene_${scene.id}_${sceneVoice[scene.id] || 'voice'}.wav`;
                                      document.body.appendChild(a);
                                      a.click();
                                      document.body.removeChild(a);
                                    }}
                                  >
                                    Download
                                  </button>
                                  <button
                                    type="button"
                                    className="px-2 py-1 rounded-md border border-zinc-700 text-gray-200 hover:border-red-500 hover:text-red-300"
                                    onClick={() => {
                                      const el = sceneAudioRef.current[scene.id];
                                      if (el) { el.pause(); el.currentTime = 0; }
                                      if (sceneAudioUrl[scene.id]) URL.revokeObjectURL(sceneAudioUrl[scene.id]);
                                      setSceneAudioUrl((prev) => ({ ...prev, [scene.id]: '' }));
                                      setSceneAudioProgress((prev) => ({ ...prev, [scene.id]: 0 }));
                                      setSceneAudioDuration((prev) => ({ ...prev, [scene.id]: 0 }));
                                      setSceneAudioPlaying((prev) => ({ ...prev, [scene.id]: false }));
                                    }}
                                  >
                                    Reset
                                  </button>
                                </div>
                                <span className="text-gray-400">{sceneVoice[scene.id] || 'Kore'}</span>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-[11px] text-gray-300 font-semibold uppercase tracking-wide">
                              <span>Visual Prompt</span>
                            </div>
                            <button
                              type="button"
                              className="text-[10px] px-2 py-1 rounded-md border border-zinc-700 text-gray-200 hover:border-purple-500 hover:text-white"
                              onClick={() => copyText(scene.visual_prompt)}
                            >
                              Copy Prompt
                            </button>
                          </div>
                          <textarea
                            value={scene.visual_prompt}
                            onChange={(e) => handleVisualPromptChange(scene.id, e.target.value)}
                            className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 text-[12px] text-gray-200 h-44 whitespace-pre-wrap overflow-y-auto custom-scrollbar focus:outline-none focus:ring-1 focus:ring-purple-500"
                          />
                          <div className="pt-2">
                            <button
                              type="button"
                              onClick={() => handleGenerateVideo(scene)}
                              disabled={!!sceneVideoLoading[scene.id]}
                              className={`w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition-all active:scale-[0.99] ${
                                sceneVideoLoading[scene.id]
                                  ? 'bg-zinc-700 text-gray-300 cursor-not-allowed'
                                  : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700'
                              }`}
                            >
                              🎬 {sceneVideoLoading[scene.id] ? 'Generating Video...' : 'Generate Video'}
                            </button>
                            {sceneVideoLoading[scene.id] && (
                              <div className="mt-2 rounded-lg border border-zinc-800 bg-gradient-to-r from-zinc-900/80 via-zinc-800/80 to-zinc-900/80 p-3 space-y-2 animate-pulse">
                                <div className="h-40 w-full rounded-md bg-zinc-800/70" />
                                <div className="flex items-center justify-between text-[11px] text-gray-300">
                                  <span className="px-2 py-0.5 rounded-md bg-zinc-800/80 border border-zinc-700">Rendering...</span>
                                  <span className="text-gray-400">ETA {sceneVideoEtaText[scene.id] || '05:00'}</span>
                                  <span className="text-gray-400">{storyStyle}</span>
                                </div>
                              </div>
                            )}
                            {sceneVideoUrl[scene.id] && (
                              <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 space-y-2">
                                <video
                                  className="w-full rounded-md bg-black"
                                  src={sceneVideoUrl[scene.id]}
                                  controls
                                  preload="metadata"
                                />
                                <div className="flex items-center justify-between text-[11px] text-gray-300">
                                  <span className="px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700">MP4</span>
                                  <span className="text-gray-400">{storyStyle}</span>
                                  <button
                                    type="button"
                                    className="px-2 py-0.5 rounded-md border border-zinc-700 text-gray-200 hover:border-red-500 hover:text-red-300"
                                    onClick={() => {
                                      if (sceneVideoUrl[scene.id]) URL.revokeObjectURL(sceneVideoUrl[scene.id]);
                                      setSceneVideoUrl((prev) => ({ ...prev, [scene.id]: '' }));
                                    }}
                                  >
                                    Reset
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
    {/* Konfirmasi Reset */}
    {isResetConfirmOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md shadow-2xl p-5">
          <h2 className="text-base font-semibold text-gray-50 mb-2">Bersihkan data Story Teller?</h2>
          <div className="space-y-2 text-sm text-gray-200 mb-4">
            <p>Semua audio yang dipilih, hasil analisis, dan pengaturan gaya akan dikosongkan.</p>
            <p className="text-gray-400 text-xs">Tindakan ini tidak bisa dibatalkan.</p>
          </div>
          <div className="flex justify-end gap-2 text-xs">
            <button
              type="button"
              onClick={() => setIsResetConfirmOpen(false)}
              className="px-3 py-1.5 rounded-md border border-zinc-600 text-gray-200 hover:bg-zinc-800"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleConfirmReset}
              className="px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-700 text-white font-semibold"
            >
              Bersihkan
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
};

export default GenerateStoryTellerPage;
