// src/pages/GenerateCinematicFilm/GenerateCinematicFilmPage.tsx
import React, { useEffect, useState } from 'react';

import Modal from '../../shared/components/Modal';
import PageHeader from '../../shared/components/PageHeader';
import GradientLoader from '../../shared/components/GradientLoader';
import { useImageResolution } from '../../shared/utils/useImageResolution';
import { useLanguage } from '../../shared/i18n';

export const CinematicFilmPageHeaderIcon: React.FC = () => null; // legacy, replaced by iconId

type ActivityLogEntry = {
  id: number;
  type: 'INFO' | 'SUCCESS' | 'ERROR';
  message: string;
  timestamp: string;
};

  const shortenPrompt = (text: string, maxChars = 220): string => {
    if (!text) return '';
    const trimmed = text.trim();
    if (trimmed.length <= maxChars) return trimmed;
    return `${trimmed.slice(0, maxChars)}…`;
  };

type CastingItem = {
  id: number;
  name: string;
  description: string;
  detailedDescription: string;
  prompt: string;
  imageUrl: string | null;
  imageHistory: string[];
  isGeneratingPrompt?: boolean;
  isGeneratingImage?: boolean;
};

type ShotItem = {
  id: number;
  time: string;
  act: string;
  detailedDescription: string;
  prompt: string;
  imageUrl: string | null;
  imageHistory: string[];
  isGeneratingPrompt?: boolean;
  isGeneratingImage?: boolean;
  videoUrl?: string | null;
  videoFilePath?: string | null;
  isGeneratingVideo?: boolean;
};

const CINEMATIC_FILM_TUTORIAL_URL = 'https://www.youtube.com/embed/mmKBFi_Ylf8?autoplay=1&mute=1&origin=http://localhost:3000';

const GENRE_OPTIONS = [
  'Sci-fi',
  'Noir',
  'Fantasi',
  'Aksi',
  'Horor',
  'Dokumenter',
  'Romantis',
  'Cyberpunk',
  'Sejarah',
  'Thriller',
  'Misteri',
  'Komedi',
  'Surrealis',
  'Biografi',
  'Keluarga',
  'Retro',
  'Drama',
  'Petualang',
  'Indie',
  'Custom',
];

const GENRE_ICONS: Record<string, string> = {
  'Sci-fi': '🛸',
  'Noir': '🎥',
  'Fantasi': '🧚',
  'Aksi': '⚔️',
  'Horor': '👻',
  'Dokumenter': '🎞️',
  'Romantis': '💘',
  'Cyberpunk': '🌌',
  'Sejarah': '🏰',
  'Thriller': '🧠',
  'Misteri': '🕵️',
  'Komedi': '🎭',
  'Surrealis': '🌈',
  'Biografi': '📜',
  'Keluarga': '👨‍👩‍👧',
  'Retro': '📼',
  'Drama': '🎬',
  'Petualang': '🌄',
  'Indie': '🎞️',
  'Custom': '✏️',
};

const MOOD_OPTIONS = [
  'Tegang',
  'Melankolis',
  'Ceria',
  'Misterius',
  'Epik',
  'Sunyi',
  'Chaotic',
  'Romantis',
  'Nostalgik',
  'Horor',
  'Tenang',
  'Gritty',
];

const STYLE_PRESETS = [
  'Cinematic Realism',
  'Film Noir (B&W)',
  'Cyberpunk Photoreal',
  'Vintage Film Grain',
  'Documentary Natural',
  'Neon Noir',
  'Studio Portrait',
  'Street Photography',
  'Arthouse Minimal',
  'High Fashion Editorial',
  'Desaturated Grit',
  'Golden Hour Natural',
];

const DURATION_OPTIONS = ['3', '4', '5', '6', '7', '8', '9', '10'];

interface PreviewItem {
  id: string;
  prompt: string;
  status: 'running' | 'completed' | 'error';
  lastMessage?: string;
  startedAt?: number;
  videoUrl?: string; // URL to generated video
  videoFilePath?: string; // Video file path
  videoFileName?: string; // Video file name
  hasVideo?: boolean; // Flag to indicate if this item has an associated video
};

const friendlyModelName = (raw?: string): string => {
  if (!raw) return 'Nano Banana Pro';
  const key = raw.toUpperCase();
  if (key === 'GEM_PIX_2') return 'Nano Banana Pro';
  if (key === 'GEM_PIX') return 'Nano Banana';
  if (key === 'IMAGEN_3_5') return 'Imagen 4';
  return raw;
};

const getFileUrl = (filePath?: string) => {
  if (!filePath) return undefined;
  const encoded = encodeURIComponent(filePath);
  return `http://localhost:3123/image?path=${encoded}`;
};

const GenerateCinematicFilmPage: React.FC = () => {
  const { t, language } = useLanguage();
  const [imageResolution] = useImageResolution();

  // Calculate fixed card dimensions based on resolution
  const cardDimensions = imageResolution === '1366x768'
    ? { parameter: 427, preview: 907 }
    : { parameter: 599, preview: 1273 };

  const stripIdTags = (text: string) => (text || '').replace(/\((?:ID\s*)?\d+\)/gi, '').replace(/\s{2,}/g, ' ').trim();
  const formatTimeFromSeconds = (sec: number) => {
    const total = Math.max(0, Math.floor(sec));
    const m = Math.floor(total / 60)
      .toString()
      .padStart(1, '0');
    const s = (total % 60)
      .toString()
      .padStart(2, '0');
    return `${m}:${s}`;
  };

  const formatShotVideoCountdown = (id: number) => {
    const total = shotVideoCountdowns[id] || 0;
    const m = Math.floor(total / 60)
      .toString()
      .padStart(1, '0');
    const s = (total % 60)
      .toString()
      .padStart(2, '0');
    return `${m}:${s}`;
  };

  const [error, setError] = useState<string | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [activityLogCopyLabel, setActivityLogCopyLabel] = useState(t.activityLog.copyLog);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const ratio: '16:9' = '16:9';
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const shotVideoRef = React.useRef<Record<number, HTMLVideoElement | null>>({});
  const [isOutputGenerating, setIsOutputGenerating] = useState(false);
  const [videoJob, setVideoJob] = useState<{ status: 'idle' | 'running' | 'completed' | 'error'; lastMessage?: string; videoUrl?: string; videoFilePath?: string; fileName?: string }>({ status: 'idle' });

  const [filmTitle, setFilmTitle] = useState('');
  const [logline, setLogline] = useState('');
  const [coreMessage, setCoreMessage] = useState('');
  const [duration, setDuration] = useState('');
  const [mood, setMood] = useState('');
  const [genre, setGenre] = useState<string[]>([]);
  const [customGenre, setCustomGenre] = useState('');
  const [characterList, setCharacterList] = useState<{ id: number; name: string; desc: string }[]>([
    { id: Date.now(), name: '', desc: '' },
  ]);
  const [visualStyle, setVisualStyle] = useState('');
  const [stylePreset, setStylePreset] = useState('Cinematic Realism');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [act1Text, setAct1Text] = useState('');
  const [act2Text, setAct2Text] = useState('');
  const [act3Text, setAct3Text] = useState('');
  const [conceptGenerated, setConceptGenerated] = useState(false);
  const [isRecommendingTitle, setIsRecommendingTitle] = useState(false);
  const [isCasting, setIsCasting] = useState(false);
  const [isLockingShotlist, setIsLockingShotlist] = useState(false);
  const [castingCharacters, setCastingCharacters] = useState<CastingItem[]>([]);
  const [castingLocations, setCastingLocations] = useState<CastingItem[]>([]);
  const [castingElements, setCastingElements] = useState<CastingItem[]>([]);
  const [castingTab, setCastingTab] = useState<'actor' | 'element' | 'location'>('actor');
  const [previewAsset, setPreviewAsset] = useState<{ url: string; id: number; type: 'actor' | 'location' | 'element' | 'shot' } | null>(null);
  const [shots, setShots] = useState<any[]>([]);
  const [workflowStep, setWorkflowStep] = useState<'casting' | 'shotlist'>('casting');
  const [castingCountdowns, setCastingCountdowns] = useState<Record<string, number>>({});
  const [castingTimeoutAlerts, setCastingTimeoutAlerts] = useState<Record<string, string>>({});
  const [shotCountdowns, setShotCountdowns] = useState<Record<number, number>>({});
  const [shotVideoCountdowns, setShotVideoCountdowns] = useState<Record<number, number>>({});
  const [shotPreviewTabs, setShotPreviewTabs] = useState<Record<number, 'photo' | 'video'>>({});
  const hasShotlist = shots.length > 0;
  const shotSizeOptions = ['Extreme Close Up', 'Close Up', 'Medium Shot', 'Medium Close Up', 'Medium Wide', 'Wide Shot', 'Extreme Wide'];
  const cameraAngleOptions = ['Eye Level', 'Low Angle', 'High Angle', 'Dutch Tilt', 'Bird Eye', 'Worm Eye'];
  const allCastingDone =
    castingCharacters.length > 0 &&
    castingElements.length > 0 &&
    castingLocations.length > 0 &&
    castingCharacters.every((i) => !!i.imageUrl) &&
    castingElements.every((i) => !!i.imageUrl) &&
    castingLocations.every((i) => !!i.imageUrl);

  const sanitizeShotlistJson = (raw: string): string => {
    let cleaned = (raw || '').trim();
    cleaned = cleaned.replace(/```json|```/gi, '');
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }
    // Hilangkan koma gantung sebelum array/objek ditutup
    cleaned = cleaned.replace(/,\s*]/g, ']');
    cleaned = cleaned.replace(/,\s*}/g, '}');
    return cleaned;
  };

  const lockCastingAndBuildShotlist = async () => {
    try {
      setIsLockingShotlist(true);
      addLog('INFO', 'Membangun shotlist dari casting...');

      const durationVal = parseFloat(duration || '3');
      const targetShots = Math.ceil(durationVal * 20);

      const charactersContext = castingCharacters.map((c) => `- ID ${c.id}: ${c.name}`).join('\n');
      const locationsContext = castingLocations.map((l) => `- ID ${l.id}: ${l.name}`).join('\n');
      const elementsContext = castingElements.map((e) => `- ID ${e.id}: ${e.name}`).join('\n');

      const prompt = `
Role: Expert Director of Photography & Storyboard Artist.
Task: Create a sequential shotlist for a film.
OUTPUT: INDONESIAN for "action"/"mood".
IMPORTANT: Output STRICT JSON.

Story Context: ${[act1Text, act2Text, act3Text].filter(Boolean).join(' ')}

Assets Available:
CHARACTERS:
${charactersContext}
LOCATIONS:
${locationsContext}
ELEMENTS:
${elementsContext}

Instructions:
1. Break down story linearly into approx ${targetShots} shots.
2. MANDATORY: Select distinct and cinematic "shotSize" and "cameraAngle" for each shot based on the drama. Use Extreme Close Ups for emotion, Low Angles for power, etc.
3. Use characterIds/locationId/elementIds ONLY for ID mapping. DO NOT mention ID in "action". Use the actual names in descriptions.
4. characterIds: array of integers.
5. locationId: integer ID.
6. elementIds: array of integers (optional).

Output Format (JSON):
{
  "shots": [
    {
      "time": "0:00",
      "act": "Setup",
      "shotSize": "String",
      "cameraAngle": "String",
      "mood": "String",
      "action": "Visual description...",
      "characterIds": [1],
      "locationId": 1,
      "elementIds": [1]
    }
  ]
}
`.trim();

      const text = await callGeminiText(prompt);
      let parsed: any = {};
      try {
        parsed = JSON.parse(text);
      } catch {
        const cleaned = sanitizeShotlistJson(text);
        parsed = JSON.parse(cleaned);
      }

      if (parsed && Array.isArray(parsed.shots)) {
        const processed = parsed.shots.map((s: any, idx: number) => ({
          id: idx + 1,
          time: formatTimeFromSeconds(idx * 8),
          act: s.act,
          shotSize: s.shotSize,
          cameraAngle: s.cameraAngle,
          mood: s.mood,
          action: stripIdTags(s.action),
          characterRefIds: Array.isArray(s.characterIds) ? s.characterIds : [],
          locationRefId: s.locationId ? String(s.locationId) : '',
          elementRefIds: Array.isArray(s.elementIds) ? s.elementIds : [],
          prompt: null,
          isGeneratingPrompt: false,
          imageUrl: null,
          imageHistory: [],
          isGeneratingImage: false,
        }));

        setShots(processed);
        setWorkflowStep('shotlist');
        addLog('SUCCESS', 'Shotlist berhasil dibuat.');
      } else {
        addLog('ERROR', 'Gagal membuat shotlist.');
      }
    } catch (err: any) {
      addLog('ERROR', err?.message || 'Gagal membuat shotlist.');
    } finally {
      setIsLockingShotlist(false);
    }
  };

  const generateShotVideo = async (id: number) => {
    const shot = shots.find((s) => s.id === id);
    if (!shot) return;
    if (!shot.imageUrl) {
      addLog('ERROR', 'Shot belum punya image. Generate image dulu.');
      return;
    }
    if (!shot.prompt) {
      await generateShotPrompt(id);
    }

    try {
      const bearerKey = (typeof window !== 'undefined' && localStorage.getItem('zeoStudio.bearerToken')) || '';
      const outputFolder = await ensureOutputFolder();
      const flowProjectId = (typeof window !== 'undefined' && localStorage.getItem('zeoStudio.workflow.flowProjectId')) || '';
      if (!bearerKey || !outputFolder || !(window as any)?.zeoAPI?.startSceneWorkflow) {
        addLog('ERROR', 'Flow Media belum siap untuk generate video.');
        return;
      }

      setShots((prev) => prev.map((s) => (s.id === id ? { ...s, isGeneratingVideo: true } : s)));
      setShotVideoCountdowns((prev) => ({ ...prev, [id]: 300 }));
      addLog('INFO', `Generate video untuk shot #${id}...`);

      // Extract image reference
      let startPath = '';
      let startImageBase64 = '';
      if (shot.imageUrl.startsWith('data:image')) {
        startImageBase64 = shot.imageUrl.split(',')[1] || '';
      } else {
        try {
          const urlObj = new URL(shot.imageUrl);
          const pathParam = urlObj.searchParams.get('path');
          if (pathParam) startPath = decodeURIComponent(pathParam);
        } catch (_) {
          // ignore
        }
      }

      const scenePayload = {
        index: id,
        prompt: shortenPrompt(shot.prompt || '', 220),
        mode: 'single',
        startPath: startPath || undefined,
        startImageBase64: startImageBase64 || undefined,
        referenceImages: [],
      };

      const res = await (window as any).zeoAPI.startSceneWorkflow({
        bearerKey,
        downloadPath: outputFolder,
        aspectRatio: ratio,
        veoModel: '3.1-fast-low',
        resolution: '720p',
        scenes: [scenePayload],
        flowProjectId,
        uiLanguage: language,
      });

      if (res?.ok) {
        const rawVideoPath = res.videoUrl || res.filePath || res?.scenes?.[0]?.filePath || null;
        const finalVideoUrl = getVideoSrc(res.videoUrl, rawVideoPath || undefined);

        setShots((prev) =>
          prev.map((s) =>
            s.id === id
              ? {
                  ...s,
                  videoUrl: finalVideoUrl || s.videoUrl || null,
                  videoFilePath: rawVideoPath || s.videoFilePath || null,
                  isGeneratingVideo: false,
                }
              : s,
          ),
        );
        if (finalVideoUrl) {
          handleShotTabChange(id, 'video');
        }

        if (finalVideoUrl || rawVideoPath) addLog('SUCCESS', `Video untuk shot #${id} selesai.`);
        else addLog('INFO', `Generate video shot #${id} selesai tanpa URL. Cek log.`);
      } else {
        addLog('ERROR', res?.error || 'Gagal generate video scene.');
        setShots((prev) => prev.map((s) => (s.id === id ? { ...s, isGeneratingVideo: false } : s)));
      }
    } catch (err: any) {
      addLog('ERROR', err?.message || `Gagal generate video untuk shot #${id}.`);
      setShots((prev) => prev.map((s) => (s.id === id ? { ...s, isGeneratingVideo: false } : s)));
    } finally {
      setShotVideoCountdowns((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const updateShotField = (id: number, payload: Partial<any>) => {
    setShots((prev) => prev.map((shot) => (shot.id === id ? { ...shot, ...payload } : shot)));
  };

  const toggleShotArrayField = (id: number, field: 'characterRefIds' | 'elementRefIds', value: number) => {
    setShots((prev) =>
      prev.map((shot) => {
        if (shot.id !== id) return shot;
        const current: number[] = Array.isArray(shot[field]) ? shot[field] : [];
        const exists = current.includes(value);
        const next = exists ? current.filter((v) => v !== value) : [...current, value];
        return { ...shot, [field]: next };
      })
    );
  };

  const generateShotPrompt = async (id: number) => {
    setShots((prev) => prev.map((s) => (s.id === id ? { ...s, isGeneratingPrompt: true } : s)));
    try {
      const shot = shots.find((s) => s.id === id);
      if (!shot) return;
      const actorNames = (shot.characterRefIds || [])
        .map((cid) => castingCharacters.find((c) => c.id === Number(cid))?.name)
        .filter(Boolean);
      const elementNames = (shot.elementRefIds || [])
        .map((eid) => castingElements.find((e) => e.id === Number(eid))?.name)
        .filter(Boolean);
      const locationName = castingLocations.find((l) => l.id === Number(shot.locationRefId))?.name;

      const prompt = `Role: Expert storyboard prompt writer for image generation.\n` +
        `Task: Buat prompt YAML singkat untuk satu shot film. Bahasa Indonesia di field narasi.\n` +
        `Shot Info: time=${shot.time || '0:00'}, act=${shot.act || ''}, shotSize=${shot.shotSize || ''}, cameraAngle=${shot.cameraAngle || ''}.\n` +
        `Visual Action: ${stripIdTags(shot.action || '-')}\n` +
        `Aktor: ${actorNames.join(', ') || '-'}\n` +
        `Elemen: ${elementNames.join(', ') || '-'}\n` +
        `Lokasi: ${locationName || '-'}\n` +
        `OUTPUT STRICT YAML: gunakan key subject, aksi, latar, cahaya, gaya. Tanpa "." akhir di setiap nilai.`;

      const text = await callGeminiText(prompt);
      setShots((prev) => prev.map((s) => (s.id === id ? { ...s, prompt: text } : s)));
      addLog('INFO', `Prompt shot #${id} berhasil dibuat.`);
    } catch (err: any) {
      addLog('ERROR', err?.message || `Gagal membuat prompt untuk shot #${id}.`);
    } finally {
      setShots((prev) => prev.map((s) => (s.id === id ? { ...s, isGeneratingPrompt: false } : s)));
    }
  };

  const generateShotImage = async (id: number) => {
    const shot = shots.find((s) => s.id === id);
    if (!shot) return;
    try {
      // pastikan prompt tersedia
      if (!shot.prompt) {
        await generateShotPrompt(id);
      }
      const bearerKey = (typeof window !== 'undefined' && localStorage.getItem('zeoStudio.bearerToken')) || '';
      const outputFolder = await ensureOutputFolder();
      const flowProjectId = (typeof window !== 'undefined' && localStorage.getItem('zeoStudio.workflow.flowProjectId')) || '';
      if (!bearerKey || !outputFolder || !(window as any)?.zeoAPI?.generateSingleImage) {
        addLog('ERROR', 'Flow Media belum siap untuk generate shot.');
        return;
      }

      const updateFlag = (flag: 'isGeneratingImage', value: boolean) => {
        setShots((prev) => prev.map((x) => (x.id === id ? { ...x, [flag]: value } : x)));
      };

      updateFlag('isGeneratingImage', true);
      setShotCountdowns((prev) => ({ ...prev, [id]: 300 }));
      addLog('INFO', `Generate image untuk shot #${id}...`);

      // Kumpulkan referensi base64 dari casting yang dipakai
      const refIds = {
        actors: shot.characterRefIds || [],
        elements: shot.elementRefIds || [],
        location: shot.locationRefId ? [Number(shot.locationRefId)] : [],
      };
      const refs: string[] = [];
      refIds.actors.forEach((aid) => {
        const found = castingCharacters.find((c) => c.id === Number(aid));
        if (found) refs.push(...(found.imageHistory || []).filter((u) => typeof u === 'string' && u.startsWith('data:image')));
      });
      refIds.elements.forEach((eid) => {
        const found = castingElements.find((e) => e.id === Number(eid));
        if (found) refs.push(...(found.imageHistory || []).filter((u) => typeof u === 'string' && u.startsWith('data:image')));
      });
      refIds.location.forEach((lid) => {
        const found = castingLocations.find((l) => l.id === Number(lid));
        if (found) refs.push(...(found.imageHistory || []).filter((u) => typeof u === 'string' && u.startsWith('data:image')));
      });
      const ingredientImages = refs.slice(0, 3).map((url) => {
        const [meta, data] = url.split(',');
        const mimeMatch = meta.match(/^data:(.*?);base64$/i);
        return { data: data || '', mimeType: mimeMatch ? mimeMatch[1] : 'image/png' };
      });

      const res = await (window as any).zeoAPI.generateSingleImage({
        bearerKey,
        aspectRatio: ratio,
        imageResolution: 'default',
        outputFolder,
        flowProjectId,
        prompt: `${shot.prompt} LANDSCAPE 16:9. NO TEXT, TEXTLESS, NO TYPOGRAPHY.`,
        ingredientImages: ingredientImages.length ? ingredientImages : undefined,
      });

      if (res?.ok) {
        const imageUrl = res.dataUrl || getFileUrl(res.filePath);
        if (imageUrl) {
          setShots((prev) =>
            prev.map((s) => (s.id === id ? { ...s, imageUrl, isGeneratingImage: false } : s)),
          );
          addLog('SUCCESS', `Shot #${id} selesai digenerate.`);
        } else {
          addLog('ERROR', 'Gagal memuat URL gambar shot.');
        }
      } else {
        addLog('ERROR', res?.error || 'Gagal generate image shot.');
      }
    } catch (err: any) {
      addLog('ERROR', err?.message || `Gagal generate shot #${id}.`);
    } finally {
      setShots((prev) => prev.map((s) => (s.id === id ? { ...s, isGeneratingImage: false } : s)));
      setShotCountdowns((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  useEffect(() => {
    setActivityLogCopyLabel(t.activityLog.copyLog);
  }, [t.activityLog.copyLog]);

  const formatShotCountdown = (id: number) => {
    const total = shotCountdowns[id] || 0;
    const m = Math.floor(total / 60)
      .toString()
      .padStart(1, '0');
    const s = (total % 60)
      .toString()
      .padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleShotTimeout = (shotId: number) => {
    setShots((prev) => prev.map((s) => (s.id === shotId ? { ...s, isGeneratingImage: false } : s)));
    addLog('ERROR', `Generate image untuk shot #${shotId} timeout (5 menit). Coba ulang.`);
    setShotCountdowns((prev) => {
      const next = { ...prev };
      delete next[shotId];
      return next;
    });
  };

  const handleShotTabChange = (shotId: number, tab: 'photo' | 'video') => {
    // Jika pindah tab, hentikan playback video dulu agar tidak auto-play
    if (tab === 'photo') {
      const v = shotVideoRef.current[shotId];
      if (v) {
        try {
          v.pause();
          v.currentTime = v.currentTime; // keep position
        } catch (err) {
          console.warn('Pause video failed', err);
        }
      }
    }
    setShotPreviewTabs((prev) => ({ ...prev, [shotId]: tab }));
  };

  const handleShotVideoTimeout = (shotId: number) => {
    setShots((prev) => prev.map((s) => (s.id === shotId ? { ...s, isGeneratingVideo: false } : s)));
    addLog('ERROR', `Generate video untuk shot #${shotId} timeout (5 menit). Coba ulang.`);
    setShotVideoCountdowns((prev) => {
      const next = { ...prev };
      delete next[shotId];
      return next;
    });
  };

  useEffect(() => {
    if (!Object.values(shotCountdowns).some((v) => (v as number) > 0)) return undefined;
    const timer = window.setInterval(() => {
      setShotCountdowns((prev) => {
        const next: Record<number, number> = {};
        Object.entries(prev).forEach(([key, val]) => {
          const id = Number(key);
          const num = typeof val === 'number' ? val : 0;
          const updated = Math.max(num - 1, 0);
          if (updated > 0) next[id] = updated;
          else handleShotTimeout(id);
        });
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [shotCountdowns]);

  useEffect(() => {
    if (!Object.values(shotVideoCountdowns).some((v) => (v as number) > 0)) return undefined;
    const timer = window.setInterval(() => {
      setShotVideoCountdowns((prev) => {
        const next: Record<number, number> = {};
        Object.entries(prev).forEach(([key, val]) => {
          const id = Number(key);
          const num = typeof val === 'number' ? val : 0;
          const updated = Math.max(num - 1, 0);
          if (updated > 0) next[id] = updated;
          else handleShotVideoTimeout(id);
        });
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [shotVideoCountdowns]);

  const handleCastingTimeout = (key: string) => {
    const [type, idStr] = key.split('-');
    const id = Number(idStr);
    const listKey = type === 'actor' ? 'castingCharacters' : type === 'location' ? 'castingLocations' : 'castingElements';
    const list = listKey === 'castingCharacters' ? castingCharacters : listKey === 'castingLocations' ? castingLocations : castingElements;
    const setter = listKey === 'castingCharacters' ? setCastingCharacters : listKey === 'castingLocations' ? setCastingLocations : setCastingElements;
    const item = list.find((i) => i.id === id);
    setter((prev) => prev.map((x) => (x.id === id ? { ...x, isGeneratingImage: false } : x)));
    if (item) addLog('ERROR', `Generate image untuk ${item.name} timeout (5 menit). Coba ulang.`);
    setCastingTimeoutAlerts((prev) => ({ ...prev, [key]: 'timeout' }));
  };

  useEffect(() => {
    if (!Object.values(castingCountdowns).some((v) => (v as number) > 0)) return;
    const timer = window.setInterval(() => {
      setCastingCountdowns((prev) => {
        const next: Record<string, number> = {};
        Object.entries(prev).forEach(([k, v]) => {
          const num = typeof v === 'number' ? v : 0;
          const updated = Math.max(num - 1, 0);
          if (updated > 0) next[k] = updated;
          else handleCastingTimeout(k);
        });
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [castingCountdowns, castingCharacters, castingElements, castingLocations]);


  const handleCastingUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    id: number,
    type: 'actor' | 'location' | 'element',
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const listKey = type === 'actor' ? 'castingCharacters' : type === 'location' ? 'castingLocations' : 'castingElements';
      const list = listKey === 'castingCharacters' ? castingCharacters : listKey === 'castingLocations' ? castingLocations : castingElements;
      const setter = listKey === 'castingCharacters' ? setCastingCharacters : listKey === 'castingLocations' ? setCastingLocations : setCastingElements;

      setter(
        list.map((item) =>
          item.id === id
            ? {
                ...item,
                // keep generated preview intact; uploaded image stored in history only
                imageHistory: [result, ...(item.imageHistory || [])],
                isGeneratingImage: false,
              }
            : item,
        ),
      );
    };
    reader.readAsDataURL(file);
    // allow re-uploading same file after deletion
    e.target.value = '';
  };

  const handleRemoveUploadedImage = (id: number, type: 'actor' | 'location' | 'element', urlToRemove?: string) => {
    const listKey = type === 'actor' ? 'castingCharacters' : type === 'location' ? 'castingLocations' : 'castingElements';
    const list = listKey === 'castingCharacters' ? castingCharacters : listKey === 'castingLocations' ? castingLocations : castingElements;
    const setter = listKey === 'castingCharacters' ? setCastingCharacters : listKey === 'castingLocations' ? setCastingLocations : setCastingElements;

    setter(
      list.map((item) =>
        item.id === id
          ? {
              ...item,
              imageUrl: item.imageUrl === (urlToRemove || item.imageUrl) ? null : item.imageUrl,
              imageHistory: (item.imageHistory || []).filter((u) => u !== (urlToRemove || item.imageUrl)),
            }
          : item,
      ),
    );

    setPreviewAsset(null);
  };

  useEffect(() => {
    if (typeof window === 'undefined' || !window.zeoAPI?.onBatchUpdate) return undefined;

    const getVideoFileUrl = (filePath?: string) => {
      if (!filePath) return undefined;
      const encoded = encodeURIComponent(filePath);
      return `http://localhost:3123/video?path=${encoded}`;
    };

    const unsubscribe = window.zeoAPI.onBatchUpdate?.((update: any) => {
      if (!update) return;
      const workflow = (update.workflow || '').toLowerCase();
      if (!workflow.includes('generate scene')) return;

      const message: string = update.message || '';

      if (update.type === 'INFO') {
        if (message) addLog('INFO', message);
        setVideoJob((prev) => ({ ...prev, lastMessage: message || prev.lastMessage }));
        return;
      }

      if (update.type === 'PROGRESS') {
        setVideoJob((prev) => ({ ...prev, status: prev.status === 'idle' ? 'running' : prev.status, lastMessage: message || prev.lastMessage }));
        if (message) addLog('INFO', message);
        return;
      }

      if (update.type === 'SCENE_STARTED') {
        setVideoJob({ status: 'running', lastMessage: message || 'Video mulai diproses' });
        if (message) addLog('INFO', message);
        return;
      }

      if (update.type === 'SCENE_COMPLETED') {
        const filePath = typeof update.filePath === 'string' ? update.filePath : undefined;
        const fileName = typeof update.fileName === 'string' ? update.fileName : undefined;
        const videoUrl = typeof update.videoUrl === 'string' ? update.videoUrl : undefined;
        const sceneId = typeof update.sceneId === 'number' ? update.sceneId : typeof update.index === 'number' ? update.index : undefined;

        setVideoJob({ 
          status: 'completed', 
          lastMessage: message || 'Video selesai', 
          videoUrl, 
          videoFilePath: filePath,
          fileName 
        });

        // Update shot list video data so Tab Video bisa aktif/play
        const finalVideoSrc = getVideoSrc(videoUrl, filePath);
        if (finalVideoSrc) {
          let resolvedId: number | undefined;
          setShots((prev) => {
            const targetId = sceneId ?? prev.find((s) => s.isGeneratingVideo)?.id ?? prev[prev.length - 1]?.id;
            resolvedId = targetId;
            if (!targetId) return prev;
            return prev.map((s) =>
              s.id === targetId
                ? {
                    ...s,
                    videoUrl: finalVideoSrc,
                    videoFilePath: filePath || s.videoFilePath || null,
                    isGeneratingVideo: false,
                  }
                : s,
            );
          });

          if (resolvedId) {
            handleShotTabChange(resolvedId, 'video');
          }

          // Update the latest preview item with video information
          setPreviewItems((prev) => {
            if (prev.length === 0) return prev;
            const updated = [...prev];
            const lastItem = updated[updated.length - 1];
            updated[updated.length - 1] = {
              ...lastItem,
              videoUrl: finalVideoSrc,
              videoFilePath: filePath,
              videoFileName: fileName,
              hasVideo: true,
            };
            return updated;
          });
        }

        if (message) addLog('SUCCESS', message);
        return;
      }

      if (update.type === 'SCENE_ERROR') {
        setVideoJob({ status: 'error', lastMessage: message || 'Video error' });
        if (message) addLog('ERROR', message);
        return;
      }

      if (update.type === 'BATCH_COMPLETE') {
        setVideoJob((prev) => ({ ...prev, status: prev.status === 'error' ? prev.status : 'completed', lastMessage: message || prev.lastMessage }));
        if (message) addLog('SUCCESS', message);
        return;
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        try {
          unsubscribe();
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  const addLog = (type: ActivityLogEntry['type'], message: string) => {
    setActivityLogs((prev) => [
      ...prev,
      {
        id: prev.length ? prev[prev.length - 1].id + 1 : 1,
        type,
        message,
        timestamp: new Date().toLocaleTimeString(language === 'ms' ? 'ms-MY' : language === 'id' ? 'id-ID' : 'en-US', { hour12: false }),
      },
    ]);
    if (type === 'ERROR') {
      setError(message);
    }
  };

  const buildCastingPrompt = (item: any, type: 'actor' | 'location' | 'element') => {
    const styleInstruction = stylePreset === 'Custom' ? 'Custom Style' : stylePreset;
    const cinematicBase = 'Raw photography, cinematic movie screencap, shot on ARRI Alexa 65, 35mm film grain, photorealistic, depth of field, bokeh, cinematic lighting, color graded, live action footage, highly detailed texture, not animation, not drawing, not 3d render, not illustration';
    const desc = item?.detailedDescription || item?.description || '';

    if (type === 'actor') {
      return `${styleInstruction}. ${cinematicBase}. Character Reference Sheet of ${item?.name}. Description: ${desc}. Layout: Close-up Portrait, Full Body Front View, and Full Body Back View. Isolated on clean background, professional concept art, 8k.`;
    }

    if (type === 'location') {
      return `${styleInstruction}. ${cinematicBase}. Cinematic Environment Design: ${item?.name}. Description: ${desc}. Wide angle 16:9, establishing shot, highly detailed texture, volumetric lighting, 8k.`;
    }

    return `${styleInstruction}. ${cinematicBase}. Product shot of ${item?.name}. Description: ${desc}. Isolated on pure white background, studio lighting, highly detailed, 8k.`;
  };

  const generateCasting = async () => {
    try {
      setIsCasting(true);
      addLog('INFO', 'Menyiapkan casting list dari Gemini...');

      const characterLines = characterList
        .map((c, idx) => `${idx + 1}. ${c.name || 'Karakter'} - ${c.desc || '-'}`)
        .join('\n');

      const prompt = `Role: Casting Director.
Task: Breakdown film menjadi aset visual.
OUTPUT: JSON tanpa markdown dengan kunci: characters (array), locations (array), elements (array). Tiap item punya: name, description singkat, detailedDescription (visual detail).
Gunakan Bahasa Indonesia.

Judul: ${filmTitle || '(belum ada judul)'}
Logline: ${logline || '-'}
Genre: ${(genre || []).join(', ') || '-'}
Mood: ${mood || '-'}
Style Preset: ${stylePreset}
Visual Style: ${visualStyle || '-'}
Daftar karakter dari parameter (jaga nama persis, jangan ganti):\n${characterLines || '-'}
Jumlah karakter minimal ikuti daftar di atas.

Format contoh:
{
  "characters": [{"name": "", "description": "", "detailedDescription": ""}],
  "locations": [{"name": "", "description": "", "detailedDescription": ""}],
  "elements": [{"name": "", "description": "", "detailedDescription": ""}]
}`;

      const text = await callGeminiText(prompt);
      let parsed: any = {};
      try {
        parsed = JSON.parse(text);
      } catch {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
        else throw new Error('Gagal parsing casting JSON.');
      }

      const mapItems = (arr: any[], type: 'actor' | 'location' | 'element'): CastingItem[] => (arr || []).map((item: any, idx: number) => ({
        id: Date.now() + idx,
        name: item?.name || 'Item',
        description: item?.description || '-',
        detailedDescription: item?.detailedDescription || item?.description || '-',
        prompt: buildCastingPrompt(item, type),
        imageUrl: null,
        imageHistory: [],
        isGeneratingPrompt: false,
        isGeneratingImage: false,
      }));

      setCastingCharacters(mapItems(parsed.characters || [], 'actor'));
      setCastingLocations(mapItems(parsed.locations || [], 'location'));
      setCastingElements(mapItems(parsed.elements || [], 'element'));

      addLog('SUCCESS', 'Casting list siap. Lanjutkan generate image per item.');
    } catch (err: any) {
      addLog('ERROR', err?.message || 'Gagal generate casting.');
    } finally {
      setIsCasting(false);
    }
  };

  const generateCastingImage = async (id: number, type: 'actor' | 'location' | 'element') => {
    const listKey = type === 'actor' ? 'castingCharacters' : type === 'location' ? 'castingLocations' : 'castingElements';
    const list = listKey === 'castingCharacters' ? castingCharacters : listKey === 'castingLocations' ? castingLocations : castingElements;
    const setter = listKey === 'castingCharacters' ? setCastingCharacters : listKey === 'castingLocations' ? setCastingLocations : setCastingElements;
    const item = list.find((i) => i.id === id);
    if (!item) return;
    if (!item.prompt) {
      addLog('ERROR', 'Prompt belum dibuat untuk item ini.');
      return;
    }

    const updateFlag = (flag: 'isGeneratingImage', value: boolean) => {
      setter((prev) => prev.map((x) => (x.id === id ? { ...x, [flag]: value } : x)));
    };

    const countdownKey = `${type}-${id}`;
    setCastingTimeoutAlerts((prev) => {
      const next = { ...prev };
      delete next[countdownKey];
      return next;
    });

    try {
      const bearerKey = (typeof window !== 'undefined' && localStorage.getItem('zeoStudio.bearerToken')) || '';
      const outputFolder = await ensureOutputFolder();
      const flowProjectId = (typeof window !== 'undefined' && localStorage.getItem('zeoStudio.workflow.flowProjectId')) || '';

      if (!bearerKey || !outputFolder || !(window as any)?.zeoAPI?.generateSingleImage) {
        addLog('ERROR', 'Flow Media belum siap untuk generate image.');
        return;
      }

      updateFlag('isGeneratingImage', true);
      setCastingCountdowns((prev) => ({ ...prev, [countdownKey]: 300 }));
      addLog('INFO', `Generate image untuk ${item.name}...`);

      // Ambil referensi upload (data URL) sebagai ingredientImages
      const referenceDataUrls = (item.imageHistory || []).filter((u) => typeof u === 'string' && u.startsWith('data:image'));
      const ingredientImages = referenceDataUrls.slice(0, 3).map((url) => {
        const [meta, data] = url.split(',');
        const mimeMatch = meta.match(/^data:(.*?);base64$/i);
        return {
          data: data || '',
          mimeType: mimeMatch ? mimeMatch[1] : 'image/png',
        };
      });
      if (ingredientImages.length) {
        addLog('INFO', `Memakai ${ingredientImages.length} image referensi (upload) untuk ${item.name}.`);
      }

      const res = await (window as any).zeoAPI.generateSingleImage({
        bearerKey,
        aspectRatio: ratio,
        imageResolution: 'default',
        outputFolder,
        flowProjectId,
        prompt: `${item.prompt} LANDSCAPE 16:9. NO TEXT, TEXTLESS, NO TYPOGRAPHY.`,
        ingredientImages: ingredientImages.length ? ingredientImages : undefined,
      });

      if (res?.ok) {
        const imageUrl = res.dataUrl || getFileUrl(res.filePath);
        if (imageUrl) {
          setter((prev) =>
            prev.map((x) => {
              if (x.id !== id) return x;
              const uploadOnly = (x.imageHistory || []).filter((u) => typeof u === 'string' && u.startsWith('data:image'));
              const nextHistory = res.dataUrl && res.dataUrl.startsWith('data:image')
                ? [res.dataUrl, ...uploadOnly]
                : uploadOnly;
              return { ...x, imageUrl, imageHistory: nextHistory };
            }),
          );
          addLog('SUCCESS', `Image untuk ${item.name} siap.`);
        } else {
          addLog('ERROR', 'Gagal memuat URL gambar dari hasil generate.');
        }
      } else {
        addLog('ERROR', res?.error || 'Gagal generate image.');
      }
    } catch (err: any) {
      addLog('ERROR', err?.message || 'Gagal generate image.');
    } finally {
      updateFlag('isGeneratingImage', false);
      setCastingCountdowns((prev) => {
        const next = { ...prev };
        delete next[countdownKey];
        return next;
      });
    }
  };

  const formatCountdown = (key: string) => {
    const val = castingCountdowns[key];
    const total = typeof val === 'number' && val > 0 ? val : 0;
    const m = Math.floor(total / 60)
      .toString()
      .padStart(1, '0');
    const s = (total % 60)
      .toString()
      .padStart(2, '0');
    return `${m}:${s}`;
  };

  const startVideoFromKeyframes = async () => {
    addLog('ERROR', 'Start/End frame telah dinonaktifkan pada mode ini.');
  };



  useEffect(() => {
    if (!error) return;
    const timeout = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(timeout);
  }, [error]);

  const resetAll = () => {
    setError(null);
    setActivityLogs([]);
    setActivityLogCopyLabel(t.activityLog.copyLog);
    setPreviewItems([]);
    setIsOutputGenerating(false);
    setVideoJob({ status: 'idle' });
    setFilmTitle('');
    setLogline('');
    setCoreMessage('');
    setDuration('');
    setMood('');
    setGenre([]);
    setCustomGenre('');
    setCharacterList([{ id: Date.now(), name: '', desc: '' }]);
    setVisualStyle('');
    setStylePreset('Cinematic Realism');
    setCoverImageUrl('');
    setAct1Text('');
    setAct2Text('');
    setAct3Text('');
    setConceptGenerated(false);
    setCastingCharacters([]);
    setCastingLocations([]);
    setCastingElements([]);
    setIsCasting(false);
  };

  const handleStartFrameSelect: React.ChangeEventHandler<HTMLInputElement> = () => undefined;
  const handleEndFrameSelect: React.ChangeEventHandler<HTMLInputElement> = () => undefined;
  const handleStartFrameDrop: React.DragEventHandler<HTMLLabelElement> = (e) => e.preventDefault();
  const handleEndFrameDrop: React.DragEventHandler<HTMLLabelElement> = (e) => e.preventDefault();
  const createKeyframePreviewItem = () => undefined;

  const addCharacter = () => {
    setCharacterList((prev) => [...prev, { id: Date.now(), name: '', desc: '' }]);
  };

  const updateCharacter = (id: number, key: 'name' | 'desc', value: string) => {
    setCharacterList((prev) => prev.map((c) => (c.id === id ? { ...c, [key]: value } : c)));
  };

  const removeCharacter = (id: number) => {
    setCharacterList((prev) => (prev.length > 1 ? prev.filter((c) => c.id !== id) : prev));
  };

  const updatePreviewItem = (id: string, updater: (item: PreviewItem) => PreviewItem) => {
    setPreviewItems((prev) => prev.map((item) => (item.id === id ? updater(item) : item)));
  };

  const ensureOutputFolder = async (): Promise<string | null> => {
    let outputFolder = '';
    try {
      outputFolder =
        window.localStorage.getItem('zeoStudio.folder.output') ||
        window.localStorage.getItem('zeoStudio.folder.output.lastSaved') ||
        '';
    } catch {
      outputFolder = '';
    }

    if (outputFolder.trim()) {
      return outputFolder; // suppress log to keep activity cleaner
    }

    if (typeof window !== 'undefined' && window.zeoAPI?.selectFolder) {
      addLog('INFO', t.visualImagery.selectingFolder);
      const picked = await window.zeoAPI.selectFolder({ title: t.visualImagery.selectFolderTitle });
      if (picked && !picked.canceled && picked.path) {
        outputFolder = picked.path;
        try {
          window.localStorage.setItem('zeoStudio.folder.output', outputFolder);
          window.localStorage.setItem('zeoStudio.folder.output.lastSaved', outputFolder);
        } catch {
          /* ignore */
        }
        addLog('SUCCESS', t.visualImagery.folderSet.replace('{folder}', outputFolder));
        return outputFolder;
      }
    }
    addLog('ERROR', t.visualImagery.folderNotConfigured);
    return null;
  };


  const withLanguagePreference = (prompt: string): string => {
    const lang = (language || '').trim();
    if (!lang) return prompt;
    const lowerPrompt = prompt.toLowerCase();
    const lowerLang = lang.toLowerCase();

    // If prompt already mentions the target language, keep it
    if (lowerPrompt.includes(lowerLang) || lowerPrompt.includes('bahasa')) {
      return prompt;
    }

    const instruction = lowerLang.includes('indones')
      ? t.visualImagery.languageInstructionId
      : t.visualImagery.languageInstructionOther.replace('{lang}', lang);

    return `${prompt}\n\n${instruction}`;
  };


  const getFileUrl = (filePath?: string) => {
    if (!filePath) return undefined;
    const encoded = encodeURIComponent(filePath);
    return `http://localhost:3123/image?path=${encoded}`;
  };

  const getVideoFileUrl = (filePath?: string): string | null => {
    if (!filePath) return null;
    const encoded = encodeURIComponent(filePath);
    return `http://localhost:3123/video?path=${encoded}`;
  };

  const getVideoSrc = (videoUrl?: string, videoFilePath?: string): string | null => {
    // Jika videoUrl sudah http(s), pakai langsung
    if (videoUrl && /^https?:\/\//i.test(videoUrl)) return videoUrl;
    // Gunakan videoFilePath untuk generate URL server lokal
    const fromFilePath = getVideoFileUrl(videoFilePath);
    if (fromFilePath) return fromFilePath;
    // Fallback ke videoUrl
    return videoUrl || null;
  };

  const callGeminiText = async (prompt: string): Promise<string> => {
    const apiKey = (typeof window !== 'undefined' && localStorage.getItem('zeoStudio.ai.apiKey')) || '';
    const model = (typeof window !== 'undefined' && localStorage.getItem('zeoStudio.ai.model')) || 'gemini-2.5-flash';

    if (!apiKey) throw new Error('API Key Gemini belum dikonfigurasi di Pengaturan.');

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          topP: 0.8,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gemini error ${res.status}: ${text || res.statusText}`);
    }

    const json: any = await res.json();
    const candidate = json?.candidates?.[0];
    const partText = candidate?.content?.parts?.find((p: any) => typeof p.text === 'string')?.text;
    if (!partText) throw new Error('Respons Gemini kosong.');
    return partText.trim();
  };

  const generateConcept = async () => {
    try {
      setIsOutputGenerating(true);
      addLog('INFO', 'Mengirim prompt ke Gemini untuk generate konsep...');

      const characterLines = characterList
        .map((c, idx) => `${idx + 1}. ${c.name || 'Karakter'} - ${c.desc || '-'}`)
        .join('\n');

      const prompt = `Anda adalah asisten penulis film. Buat konsep singkat dalam format JSON:
{
  "act1": "teks setup",
  "act2": "teks conflict",
  "act3": "teks resolution",
  "coreMessage": "pesan utama",
  "visualDirection": "arah visual sinematik (tone, lighting, lensa, tekstur)"
}

Judul: ${filmTitle || '(belum ada judul)'}
Logline/Premis: ${logline || '(belum ada premis)'}
Pesan Utama: ${coreMessage || '(belum ada pesan)'}
Durasi target (menit): ${duration || '-'}
Mood: ${mood || '-'}
Genre: ${(genre || []).join(', ') || '-'}${genre.includes('Custom') && customGenre ? ` (Custom: ${customGenre})` : ''}
Style Preset: ${stylePreset}
Visual Style detail: ${visualStyle || '-'}
Daftar karakter:\n${characterLines || '-'}

Berikan JSON valid tanpa markdown, tanpa penjelasan tambahan.`;

      const text = await callGeminiText(prompt);
      let parsed: any = {};
      try {
        parsed = JSON.parse(text);
      } catch {
        // coba ekstrak JSON di dalam teks
        const match = text.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
        else throw new Error('Gagal parsing JSON dari Gemini.');
      }

      const act1 = typeof parsed.act1 === 'string' ? parsed.act1.trim() : '';
      const act2 = typeof parsed.act2 === 'string' ? parsed.act2.trim() : '';
      const act3 = typeof parsed.act3 === 'string' ? parsed.act3.trim() : '';
      const visualDir = typeof parsed.visualDirection === 'string' ? parsed.visualDirection.trim() : '';
      const coreMsg = typeof parsed.coreMessage === 'string' ? parsed.coreMessage.trim() : '';

      if (act1) {
        setAct1Text(act1);
        setLogline(act1);
      } else {
        setAct1Text(logline);
      }
      setAct2Text(act2 || coreMessage);
      setAct3Text(act3 || visualStyle);

      if (coreMsg) setCoreMessage(coreMsg);
      if (visualDir) setVisualStyle(visualDir);

      // Siapkan cover (prefer AI, fallback placeholder)
      await generateCoverFromFlow();

      setConceptGenerated(true);
      addLog('SUCCESS', 'Konsep Cinematic Film siap ditinjau.');
    } catch (err: any) {
      addLog('ERROR', err?.message || 'Gagal generate konsep.');
      setConceptGenerated(false);
    } finally {
      setIsOutputGenerating(false);
    }
  };

  const handleRecommendAi = async () => {
    try {
      setIsRecommendingTitle(true);
      addLog('INFO', 'Meminta rekomendasi AI untuk semua parameter...');

      const prompt = `Buat rekomendasi konsep film dalam JSON lengkap:
{
  "title": "judul 2-6 kata",
  "logline": "satu kalimat premis",
  "coreMessage": "pesan emosional",
  "visualStyle": "arah visual (tone, lighting, lensa)",
  "duration": "angka menit (string)",
  "mood": "Mood utama sesuai opsi",
  "stylePreset": "preset gaya",
  "genres": ["Genre1","Genre2"],
  "customGenre": "isi jika pilih Custom, jika tidak kosongkan",
  "characters": [{"name": "Nama", "description": "deskripsi singkat"}] // optional 2-3 karakter
}

Konteks sekarang:
Genre saat ini: ${(genre || []).join(', ') || 'Tidak ditentukan'}
Mood saat ini: ${mood || 'Netral'}
Durasi: ${duration ? duration + ' menit' : '-'}
Style Preset: ${stylePreset}
Visual detail: ${visualStyle || 'Cinematic, depth, lighting dramatis'}
Karakter: ${(characterList || []).map((c) => c.name || 'Karakter').join(', ') || '-'}

Balas hanya JSON tanpa markdown.`;

      const text = await callGeminiText(prompt);
      let parsed: any = {};
      try {
        parsed = JSON.parse(text);
      } catch {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
        else throw new Error('Gagal parsing rekomendasi AI.');
      }

      const pickString = (v: any) => (typeof v === 'string' ? v.trim() : '');
      const normalizeDuration = (val: string) => {
        if (!val) return '';
        const match = val.match(/\d+(?:\.\d+)?/);
        return match ? match[0] : val;
      };
      const normalizeMood = (val: string) => {
        if (!val) return '';
        const lower = val.toLowerCase();
        const found = MOOD_OPTIONS.find((m) => m.toLowerCase() === lower);
        return found || val;
      };
      const title = pickString(parsed.title);
      const log = pickString(parsed.logline);
      const core = pickString(parsed.coreMessage);
      const vis = pickString(parsed.visualStyle);
      const moodAi = normalizeMood(pickString(parsed.mood));
      const durationAi = normalizeDuration(pickString(parsed.duration));
      const styleAi = pickString(parsed.stylePreset);
      const customGenreAi = pickString(parsed.customGenre);
      const genresAi: string[] = Array.isArray(parsed.genres)
        ? parsed.genres.filter((g: any) => typeof g === 'string' && g.trim()).map((g: string) => g.trim())
        : [];

      if (title) setFilmTitle(title);
      if (log) {
        setLogline(log);
        setAct1Text(log);
      }
      if (core) {
        setCoreMessage(core);
        setAct2Text(core);
      }
      if (vis) {
        setVisualStyle(vis);
        setAct3Text(vis);
      }
      if (durationAi) setDuration(durationAi);
      if (moodAi) setMood(moodAi);
      if (styleAi) setStylePreset(styleAi);
      if (genresAi.length) {
        setGenre(genresAi);
        if (genresAi.includes('Custom') && customGenreAi) setCustomGenre(customGenreAi);
      }

      if (Array.isArray(parsed.characters) && parsed.characters.length) {
        const mapped = parsed.characters.slice(0, 3).map((c: any, idx: number) => ({
          id: Date.now() + idx,
          name: pickString(c.name) || `Karakter ${idx + 1}`,
          desc: pickString(c.description) || '-',
        }));
        setCharacterList(mapped);
      }

      addLog('SUCCESS', 'Rekomendasi AI diterapkan ke form.');
    } catch (err: any) {
      addLog('ERROR', err?.message || 'Gagal mendapatkan rekomendasi AI.');
    } finally {
      setIsRecommendingTitle(false);
    }
  };

  const handleGenerateOrPreview = async () => {
    await generateConcept();
  };

  const buildCoverPlaceholder = () => {
    const title = (filmTitle || 'Cinematic Film').replace(/</g, '').replace(/>/g, '');
    const subtitle = stylePreset || 'Visual Cover';
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b1224"/>
      <stop offset="100%" stop-color="#111827"/>
    </linearGradient>
    <linearGradient id="glow" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#8b5cf6"/>
      <stop offset="50%" stop-color="#ec4899"/>
      <stop offset="100%" stop-color="#3b82f6"/>
    </linearGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#bg)"/>
  <rect x="40" y="40" width="1200" height="640" rx="24" fill="url(#glow)" opacity="0.25"/>
  <text x="50%" y="48%" fill="#ffffff" font-family="'Segoe UI', sans-serif" font-size="54" font-weight="700" text-anchor="middle">${title}</text>
  <text x="50%" y="56%" fill="#cbd5e1" font-family="'Segoe UI', sans-serif" font-size="28" font-weight="600" text-anchor="middle">${subtitle}</text>
</svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  };

  const generateCoverFromFlow = async () => {
    try {
      const bearerKey = (typeof window !== 'undefined' && localStorage.getItem('zeoStudio.bearerToken')) || '';
      const outputFolder = (typeof window !== 'undefined' && localStorage.getItem('zeoStudio.folder.output')) || '';
      const flowProjectId = (typeof window !== 'undefined' && localStorage.getItem('zeoStudio.workflow.flowProjectId')) || '';

      if (!bearerKey || !outputFolder || !(window as any)?.zeoAPI?.generateSingleImage) {
        setCoverImageUrl(buildCoverPlaceholder());
        addLog('INFO', 'Cover placeholder dipakai (bearer/output/bridge tidak siap).');
        return;
      }

      const styleInstruction = stylePreset || 'Cinematic Realism (Live Action)';
      const coverPrompt = `STYLE: ${styleInstruction}. VISUAL CONCEPT ART. World Building untuk film "${filmTitle || 'Film Tanpa Judul'}". ${visualStyle || 'Cinematic, depth, lighting dramatis, resolusi tinggi.'} Cinematic establishing shot of the main setting. Mood: ${mood || 'Netral'}. Genre: ${(genre || []).join(', ') || 'Tidak ditentukan'}. High detail, masterpiece. LANDSCAPE 16:9. NO TEXT, TEXTLESS, NO TYPOGRAPHY.`;

      addLog('INFO', 'Mengirim prompt cover ke Flow Media...');
      const res = await (window as any).zeoAPI.generateSingleImage({
        bearerKey,
        aspectRatio: ratio,
        imageResolution: 'default',
        outputFolder,
        flowProjectId,
        prompt: coverPrompt,
      });

      if (res?.ok && res.dataUrl) {
        setCoverImageUrl(res.dataUrl);
        addLog('SUCCESS', 'Cover berhasil di-generate.');
        return;
      }

      const errMsg = res?.error || 'Gagal generate cover, gunakan placeholder.';
      addLog('ERROR', errMsg);
      setCoverImageUrl(buildCoverPlaceholder());
    } catch (error: any) {
      addLog('ERROR', error?.message || 'Gagal generate cover, gunakan placeholder.');
      setCoverImageUrl(buildCoverPlaceholder());
    }
  };

  const handleGenerateCoverImage = async () => {
    await generateCoverFromFlow();
  };


  const handleDownload = async (url?: string, fileName = 'image.png') => {
    if (!url) return;
    console.log('[CinematicFilm] Downloading:', { fileName, urlLength: url.length, isDataUrl: url.startsWith('data:') });
    try {
      // If it's a data URL, download directly via anchor tag
      if (url.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }
      
      // Fallback for remote/local server URLs
      const res = await fetch(url);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error('Failed to download image', err);
      addLog('ERROR', t.visualImagery.failed + ': ' + String(err));
    }
  };

  const handleDownloadVideo = async () => {
    const videoUrl = getVideoSrc(videoJob.videoUrl, videoJob.videoFilePath);
    const fileName = videoJob.fileName || 'video.mp4';
    
    if (!videoUrl) {
      addLog('ERROR', 'Video URL not found');
      return;
    }

    console.log('[CinematicFilm] Downloading video:', { fileName, videoUrl });
    
    try {
      const res = await fetch(videoUrl);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
      
      addLog('SUCCESS', `Video downloaded: ${fileName}`);
    } catch (err) {
      console.error('Failed to download video', err);
      addLog('ERROR', 'Failed to download video: ' + String(err));
    }
  };

  return (
    <div className="h-full w-full flex flex-col min-h-0 text-gray-50">
      <PageHeader
        iconId="generate-cinematicfilm"
        iconClassName="h-6 w-6 mr-3 text-white"
        title="Cinematic Film"
        description="Buat video sinematik dari keyframe atau montage referensi."
        tutorialUrl={CINEMATIC_FILM_TUTORIAL_URL}
        tutorialTitle="Tutorial Cinematic Film"
        tutorialMode="direct"
        showApiKeyTest={false}
        showBearerTest={true}
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
            <div className="flex flex-col h-full">
              <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar px-6 py-4 space-y-4">
              <div className="space-y-3">
                <div className="space-y-2">
                  <h3 className="text-[11px] font-semibold text-gray-200 tracking-wide">Judul Film</h3>
                  <div className="flex items-stretch gap-2">
                    <input
                      value={filmTitle}
                      onChange={(e) => setFilmTitle(e.target.value)}
                      placeholder="Contoh: Bayang-Bayang Kota Neon"
                      className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-gray-50 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                    />
                    <button
                      type="button"
                      onClick={handleRecommendAi}
                      disabled={isRecommendingTitle || isOutputGenerating}
                      className={`relative px-3 rounded-lg border border-purple-500/70 text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 hover:shadow-lg hover:shadow-purple-500/30 transition transform hover:-translate-y-0.5 text-[11px] font-semibold overflow-hidden ${isRecommendingTitle || isOutputGenerating ? 'opacity-60 cursor-not-allowed' : ''}`}
                      style={{
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)',
                        backgroundImage:
                          'linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.08) 40%, rgba(255,255,255,0) 60%), linear-gradient(90deg, #8b5cf6, #ec4899, #3b82f6)',
                      }}
                    >
                      {isRecommendingTitle ? 'Memproses...' : 'Rekom AI'}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-[11px] font-semibold text-gray-200 tracking-wide">Logline / Premis</h3>
                  <textarea
                    value={logline}
                    onChange={(e) => setLogline(e.target.value)}
                    placeholder="Satu kalimat premis yang merangkum konflik utama."
                    className="w-full min-h-[72px] bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-gray-50 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 resize-y"
                  />
                </div>

                <div className="space-y-2">
                  <h3 className="text-[11px] font-semibold text-gray-200 tracking-wide">Pesan Utama / Emosional</h3>
                  <textarea
                    value={coreMessage}
                    onChange={(e) => setCoreMessage(e.target.value)}
                    placeholder="Apa emosi atau pesan inti yang ingin dirasakan penonton?"
                    className="w-full min-h-[72px] bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-gray-50 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 resize-y"
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <h3 className="text-[11px] font-semibold text-gray-200 tracking-wide">Durasi</h3>
                    <select
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-gray-50 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                    >
                      {DURATION_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt} menit</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-[11px] font-semibold text-gray-200 tracking-wide">Mood Utama</h3>
                    <select
                      value={mood}
                      onChange={(e) => setMood(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-gray-50 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                    >
                      {MOOD_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-[11px] font-semibold text-gray-200 tracking-wide">Genre</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                    {GENRE_OPTIONS.map((opt) => {
                      const isActive = genre.includes(opt);
                      const icon = GENRE_ICONS[opt] || '🎬';
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            setGenre((prev) => (
                              prev.includes(opt)
                                ? prev.filter((g) => g !== opt)
                                : [...prev, opt]
                            ));
                          }}
                          className={`w-full h-full text-center px-3 py-3 rounded-xl border transition-all duration-150 shadow-sm flex flex-col items-center justify-center gap-2
                            ${isActive
                              ? 'border-transparent bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-500/25 hover:from-purple-700 hover:to-blue-700 hover:shadow-purple-500/30 transform hover:-translate-y-0.5'
                              : 'border-zinc-700 bg-zinc-900 text-gray-200 hover:border-purple-400 hover:text-white hover:bg-zinc-900/70'}`}
                        >
                          <span className="text-lg leading-none">{icon}</span>
                          <span className="text-[11px] font-semibold leading-tight text-center line-clamp-2">{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                  {genre.includes('Custom') && (
                    <div className="space-y-1">
                      <h4 className="text-[10px] font-semibold text-gray-400">Genre Custom</h4>
                      <textarea
                        value={customGenre}
                        onChange={(e) => setCustomGenre(e.target.value)}
                        placeholder="Tulis genre spesifik di sini"
                        className="w-full min-h-[60px] bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-gray-50 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 resize-y"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-semibold text-gray-200 tracking-wide">Daftar Karakter Utama</h3>
                    <button
                      type="button"
                      onClick={addCharacter}
                      className="text-[11px] px-2 py-1 rounded-md border border-purple-500/70 text-purple-100 hover:bg-purple-600/20 transition"
                    >
                      + Tambah Karakter
                    </button>
                  </div>
                  <div className="space-y-2 bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                    {characterList.map((char, idx) => (
                      <div key={char.id} className="flex items-start gap-2 bg-zinc-950/60 border border-zinc-800 rounded-lg p-2">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-8 h-8 rounded-md bg-purple-600/30 border border-purple-500/50 text-purple-50 font-semibold flex items-center justify-center text-xs">
                            {idx + 1}
                          </div>
                          {characterList.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeCharacter(char.id)}
                              className="text-gray-400 hover:text-red-200 w-8 h-8 rounded-md border border-zinc-700 flex items-center justify-center text-lg transition-all duration-150 hover:border-red-400 hover:bg-red-500/20 hover:scale-105 cursor-pointer"
                              aria-label="Hapus karakter"
                              title="Hapus karakter"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                        <div className="flex-1 space-y-2">
                          <input
                            value={char.name}
                            onChange={(e) => updateCharacter(char.id, 'name', e.target.value)}
                            placeholder="Nama karakter"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-gray-50 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                          />
                          <input
                            value={char.desc}
                            onChange={(e) => updateCharacter(char.id, 'desc', e.target.value)}
                            placeholder="Peran / deskripsi singkat"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-gray-50 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-[11px] font-semibold text-gray-200 tracking-wide">Style Preset</h3>
                  <select
                    value={stylePreset}
                    onChange={(e) => setStylePreset(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-gray-50 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                  >
                    {STYLE_PRESETS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <div className="space-y-1">
                    <h4 className="text-[10px] font-semibold text-gray-400">Style Visual</h4>
                    <input
                      value={visualStyle}
                      onChange={(e) => setVisualStyle(e.target.value)}
                      placeholder="Detail visual: lens, tone, tekstur"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-gray-50 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>

            </div>

            <div className="px-6 pb-5 pt-3 border-t border-zinc-800 space-y-3">
                <button
                  type="button"
                  onClick={handleGenerateOrPreview}
                  disabled={isOutputGenerating}
                  className={`relative w-full min-h-[48px] px-4 rounded-lg text-white font-semibold transition-all duration-200 btn-glass-primary flex items-center justify-center overflow-hidden
                    focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-zinc-900
                    ${
                      isOutputGenerating
                        ? 'bg-zinc-600 cursor-not-allowed'
                        : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 hover:shadow-lg hover:shadow-purple-500/30 transform hover:-translate-y-0.5'
                    }`}
                  style={isOutputGenerating ? undefined : {
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)'
                  }}
                  aria-label="Generate Cinematic Film"
                >
                  {isOutputGenerating
                    ? 'Processing...'
                    : 'Generate Cinematic Film'}
                </button>

                <div className="max-h-48 bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-xs text-gray-200 flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-gray-100">{t.activityLog.title}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!activityLogs.length) return;
                          const text = activityLogs
                            .map((log) => `[${log.timestamp}] [${log.type}] ${log.message}`)
                            .join('\n');
                          navigator.clipboard
                            .writeText(text)
                            .then(() => {
                              setActivityLogCopyLabel(t.visualImagery.copied);
                              setTimeout(() => setActivityLogCopyLabel(t.activityLog.copyLog), 1200);
                            })
                            .catch(() => {
                              setActivityLogCopyLabel(t.visualImagery.copyFailedLabel);
                              setTimeout(() => setActivityLogCopyLabel(t.activityLog.copyLog), 1200);
                            });
                        }}
                        disabled={activityLogs.length === 0}
                        className="px-2 py-0.5 rounded-md border border-zinc-600 text-[10px] text-gray-200 hover:bg-zinc-800 disabled:opacity-40"
                      >
                        {activityLogCopyLabel}
                      </button>
                      <span className="text-[10px] text-gray-500">
                        {activityLogs.length} {t.common.entries}
                      </span>
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
              <h3 className="text-lg font-semibold text-gray-50">Preview Cinematic Film</h3>
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(true)}
                className="inline-flex items-center px-4 py-2 text-[11px] font-semibold rounded-lg shadow-md transition-all duration-200 btn-glass-primary bg-red-600 hover:bg-red-700 text-white"
              >
                <span className="mr-1.5 text-xs">🗑️</span>
                <span>{t.buttons.clear} {t.common.data}</span>
              </button>
            </div>

            <div className="flex-1 flex flex-col px-6 py-4 pb-6 min-h-[760px] min-w-0 space-y-4 overflow-y-auto custom-scrollbar" id="image-editor-result">
              {!conceptGenerated ? (
                <div className="flex-1 flex items-center justify-center bg-zinc-950/40 rounded-lg text-center p-6 border border-dashed border-zinc-700">
                  <div className="max-w-sm">
                    <p className="text-sm leading-snug text-gray-400">
                      Story scene Cinematic Film akan tampil di sini setelah Anda menekan
                      <span className="font-semibold text-gray-200"> Generate Cinematic Film</span>.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-white uppercase tracking-wide">{filmTitle || 'Judul Cinematic Film'}</h3>
                    <div className="w-full aspect-video rounded-xl overflow-hidden flex items-center justify-center bg-zinc-900 border border-zinc-800">
                      {coverImageUrl ? (
                        <img src={coverImageUrl} alt="Cover Visual" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-gray-500 text-sm">Cover akan muncul setelah generate.</div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                    <div className="space-y-3 flex flex-col h-full">
                      <h4 className="text-sm font-semibold text-white uppercase tracking-wide">Sinopsis & Struktur</h4>
                      {[{
                        title: 'Act I: Setup',
                        value: act1Text,
                        fallback: logline,
                        onChange: setAct1Text,
                        placeholder: 'Belum ada premis. Tambahkan premis untuk memulai.'
                      }, {
                        title: 'Act II: Conflict',
                        value: act2Text,
                        fallback: coreMessage,
                        onChange: setAct2Text,
                        placeholder: 'Belum ada pesan utama. Tambahkan konflik atau pesan inti.'
                      }, {
                        title: 'Act III: Resolution',
                        value: act3Text,
                        fallback: visualStyle,
                        onChange: setAct3Text,
                        placeholder: 'Tambahkan arah visual/resolusi cerita.'
                      }].map((item) => (
                        <div key={item.title} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2 shadow-sm">
                          <div className="text-[11px] font-semibold text-white">{item.title}</div>
                          <textarea
                            className="w-full bg-zinc-900/80 border border-zinc-700 rounded-lg text-xs text-gray-100 leading-relaxed whitespace-pre-wrap p-3 focus:outline-none focus:ring-2 focus:ring-purple-500/60 h-[135px] resize-none"
                            rows={5}
                            value={item.value || ''}
                            onChange={(e) => item.onChange(e.target.value)}
                            placeholder={item.fallback || item.placeholder}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="space-y-3 flex flex-col h-full">
                      <h4 className="text-sm font-semibold text-white uppercase tracking-wide">Visual Concept</h4>

                      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3 shadow-sm flex-1 flex flex-col overflow-auto">
                        <div className="space-y-1">
                          <div className="text-[10px] uppercase tracking-wide text-white font-semibold">Genre & Tema</div>
                          <p className="text-sm text-gray-100 font-semibold">
                            {genre.length ? genre.join(', ') : 'Belum dipilih'}
                            {genre.includes('Custom') && customGenre ? ` — ${customGenre}` : ''}
                          </p>
                          <p className="text-[11px] text-gray-400">Mood: {mood || 'Belum dipilih'}</p>
                        </div>

                        <div className="space-y-1">
                          <div className="text-[10px] uppercase tracking-wide text-white font-semibold">Style Preset (Selected)</div>
                          <p className="text-sm text-white font-semibold">{stylePreset}</p>
                        </div>

                        <div className="space-y-2">
                          <div className="text-[10px] uppercase tracking-wide text-white font-semibold">Pesan Utama</div>
                          <div className="bg-gradient-to-r from-purple-600 via-fuchsia-600 to-blue-600 text-white font-semibold text-sm rounded-xl px-3 py-3 shadow-inner min-h-[120px] flex items-start">
                            <span>{coreMessage || 'Tambahkan pesan emosional yang ingin dirasakan penonton.'}</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="text-[10px] uppercase tracking-wide text-white font-semibold">Visual Direction</div>
                            <button
                              type="button"
                              disabled={isOutputGenerating}
                              className={`text-[11px] px-3 py-1 rounded-md border border-purple-400/60 text-purple-100 transition ${isOutputGenerating ? 'opacity-60 cursor-not-allowed' : 'hover:bg-purple-500/15'}`}
                              onClick={() => !isOutputGenerating && generateConcept()}
                            >
                              {isOutputGenerating ? 'Sedang memproses ...' : 'Regenerate Concept Art'}
                            </button>
                          </div>
                          <textarea
                            className="w-full bg-zinc-900/80 border border-zinc-700 rounded-xl p-3 text-xs text-gray-100 h-[180px] whitespace-pre-wrap focus:outline-none focus:ring-2 focus:ring-purple-500/60 resize-none"
                            value={visualStyle}
                            onChange={(e) => setVisualStyle(e.target.value)}
                            placeholder="Tulis arah visual: estetika, lighting, lensa, tone."
                          />
                          <p className="text-[11px] text-gray-400 mt-2">*Edit teks di atas lalu klik "Regenerate Concept Art" untuk mengubah gambar dunia cerita.</p>
                        </div>
                      </div>

                      <div className="flex">
                        <button
                          type="button"
                          className="relative w-full min-h-[48px] px-4 rounded-lg text-white font-semibold transition-all duration-200 btn-glass-primary flex items-center justify-center overflow-hidden bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 hover:shadow-lg hover:shadow-purple-500/30 transform hover:-translate-y-0.5"
                          style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)' }}
                          onClick={() => !isCasting && generateCasting()}
                          disabled={isCasting}
                        >
                          {isCasting ? 'Sedang memproses ...' : 'Start Casting'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {(castingCharacters.length + castingLocations.length + castingElements.length) > 0 && (
                    <div className="mt-4 space-y-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {hasShotlist && workflowStep === 'shotlist' ? (
                          <>
                            <button
                              type="button"
                              className={`px-4 h-12 text-[11px] font-semibold rounded-md border transition flex items-center ${
                                workflowStep === 'casting'
                                  ? 'border-purple-500/70 text-white bg-purple-600/20'
                                  : 'border-zinc-700 text-gray-300 hover:border-purple-400 hover:text-white'
                              }`}
                              onClick={() => setWorkflowStep('casting')}
                            >
                              Casting Asset
                            </button>
                            <button
                              type="button"
                              className="relative px-4 h-12 rounded-lg text-white font-semibold text-[11px] tracking-wide transition-all duration-200 overflow-hidden flex items-center bg-emerald-600"
                              style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)' }}
                              onClick={() => setWorkflowStep('shotlist')}
                              disabled
                            >
                              Shot List
                            </button>
                          </>
                        ) : (
                          <>
                            {[
                              {
                                key: 'actor' as const,
                                label: 'Karakter',
                                count: castingCharacters.length,
                                allGenerated: castingCharacters.length > 0 && castingCharacters.every((i) => !!i.imageUrl),
                              },
                              {
                                key: 'element' as const,
                                label: 'Elemen',
                                count: castingElements.length,
                                allGenerated: castingElements.length > 0 && castingElements.every((i) => !!i.imageUrl),
                              },
                              {
                                key: 'location' as const,
                                label: 'Lokasi',
                                count: castingLocations.length,
                                allGenerated: castingLocations.length > 0 && castingLocations.every((i) => !!i.imageUrl),
                              },
                            ].map((tab) => {
                              const isActive = castingTab === tab.key;
                              const isDone = tab.allGenerated;
                              const base = 'px-4 h-12 text-[11px] font-semibold rounded-md border transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center';
                              const activePurple = 'border-purple-500/70 text-white bg-purple-600/20';
                              const inactiveGray = 'border-zinc-700 text-gray-300 hover:border-purple-400 hover:text-white';
                              const activeGreen = 'border-emerald-400 text-white bg-emerald-500/20 shadow-[0_0_0_1px_rgba(16,185,129,0.35)]';
                              const inactiveGreen = 'border-emerald-500/70 text-emerald-200 bg-emerald-500/10 hover:bg-emerald-500/20';
                              const classes = `${base} ${isDone ? (isActive ? activeGreen : inactiveGreen) : isActive ? activePurple : inactiveGray}`;
                              return (
                                <button
                                  key={tab.key}
                                  type="button"
                                  onClick={() => setCastingTab(tab.key)}
                                  className={classes}
                                  disabled={tab.count === 0}
                                >
                                  {tab.label} {tab.count ? `(${tab.count})` : ''}
                                </button>
                              );
                            })}
                            {hasShotlist && (
                              <button
                                type="button"
                                className="relative px-4 h-12 rounded-lg text-white font-semibold text-[11px] tracking-wide transition-all duration-200 overflow-hidden flex items-center bg-emerald-600"
                                style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)' }}
                                onClick={() => setWorkflowStep('shotlist')}
                              >
                                Shot List
                              </button>
                            )}
                            {!hasShotlist && allCastingDone && (
                              <button
                                className="relative px-4 h-12 rounded-lg text-white font-semibold text-[11px] tracking-wide transition-all duration-200 overflow-hidden flex items-center bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 hover:shadow-lg hover:shadow-purple-500/30 transform hover:-translate-y-0.5"
                                style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)' }}
                                onClick={() => !isLockingShotlist && allCastingDone && lockCastingAndBuildShotlist()}
                                disabled={isLockingShotlist || !allCastingDone}
                              >
                                {isLockingShotlist ? 'Mempersiapkan Shot List...' : 'Lock Casting & Build Shotlist'}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                      {workflowStep === 'casting' && castingTab === 'actor' && castingCharacters.length > 0 && (
                        <div className="space-y-3 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                          <div className="text-xs font-semibold text-white uppercase tracking-wide">Karakter</div>
                          <div className="space-y-3">
                            {castingCharacters.map((item) => {
                            const uploadViewUrl = (item.imageHistory || []).filter((u) => typeof u === 'string' && u.startsWith('data:image')).slice(-1)[0] || null;
                            const isUploadAvailable = !!uploadViewUrl;
                            const viewClass = hasShotlist
                              ? 'text-[11px] px-3 py-2 rounded-md border border-zinc-700 text-gray-400 bg-zinc-900/60 cursor-not-allowed'
                              : isUploadAvailable
                              ? 'text-[11px] px-3 py-2 rounded-md border border-emerald-400 text-emerald-100 cursor-pointer bg-emerald-500/15 hover:bg-emerald-500/25 transition'
                              : 'text-[11px] px-3 py-2 rounded-md border border-zinc-700 text-gray-200 cursor-pointer bg-zinc-900/80 hover:bg-zinc-800 transition';
                            return (
                            <div key={item.id} className="bg-zinc-900/90 border border-zinc-800 rounded-lg p-3 shadow-sm grid grid-cols-[minmax(0,1fr)_420px] gap-3 items-stretch min-h-[320px]">
                                <div className="flex flex-col gap-2 h-full">
                                  <div>
                                    <div className="text-sm font-semibold text-white">{item.name}</div>
                                    <p className="text-xs text-gray-300 leading-snug min-h-[32px]">{item.description}</p>
                                  </div>
                                  <div className="bg-zinc-900/70 border border-zinc-800 rounded-md p-2 space-y-2 flex-1 min-h-[236px] overflow-y-auto custom-scrollbar">
                                    <p className="text-xs text-gray-100 leading-relaxed whitespace-pre-wrap">{item.detailedDescription}</p>
                                  </div>
                                </div>
                                <div className="relative bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden">
                                  {(() => {
                                    const previewUrl = item.imageUrl || null;
                                    const clickable = !!previewUrl;
                                    return (
                                      <div
                                        className={`w-full aspect-video bg-zinc-900/80 flex items-center justify-center text-[11px] text-gray-500 ${clickable ? 'cursor-pointer group' : ''}`}
                                        onClick={() => {
                                          if (previewUrl) setPreviewAsset({ url: previewUrl, id: item.id, type: 'actor' });
                                        }}
                                      >
                                        {previewUrl ? (
                                          <img src={previewUrl} alt={item.name} className="w-full h-full object-cover transition group-hover:opacity-95" />
                                        ) : (
                                          <span>Preview 16:9</span>
                                        )}
                                      </div>
                                    );
                                  })()}
                                  <div className="absolute inset-x-0 bottom-0 bg-zinc-900/80 border-t border-zinc-800 px-3 py-3 flex items-center justify-between gap-3">
                                    <button
                                      type="button"
                                      className={`relative overflow-hidden text-[11px] px-3 py-2 rounded-md font-semibold transition-all duration-200 border border-purple-400/60 text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 hover:shadow-lg hover:shadow-purple-500/30 transform hover:-translate-y-0.5 ${item.isGeneratingImage || hasShotlist ? 'opacity-60 cursor-not-allowed' : ''}`}
                                      style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)' }}
                                      onClick={() => generateCastingImage(item.id, 'actor')}
                                      disabled={item.isGeneratingImage || hasShotlist}
                                    >
                                      {hasShotlist
                                        ? 'Locked'
                                        : castingTimeoutAlerts[`actor-${item.id}`]
                                        ? 'Timeout, coba ulang'
                                        : item.isGeneratingImage
                                        ? 'Memproses...'
                                        : 'Generate Image'}
                                    </button>
                                    <label
                                      className={viewClass}
                                      onClick={(ev) => {
                                        if (hasShotlist) return;
                                        if (uploadViewUrl) {
                                          ev.preventDefault();
                                          setPreviewAsset({ url: uploadViewUrl, id: item.id, type: 'actor' });
                                        }
                                      }}
                                    >
                                      <span>{hasShotlist ? 'Locked' : isUploadAvailable ? 'Lihat Image' : 'Upload Image'}</span>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => handleCastingUpload(e, item.id, 'actor')}
                                        disabled={hasShotlist}
                                      />
                                    </label>
                                  </div>
                                  {item.isGeneratingImage && (
                                    <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center text-white text-xs font-semibold">
                                      Estimasi selesai ~ {formatCountdown(`actor-${item.id}`)}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          </div>
                        </div>
                      )}

                      {workflowStep === 'casting' && castingTab === 'element' && castingElements.length > 0 && (
                        <div className="space-y-3 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                          <div className="text-xs font-semibold text-white uppercase tracking-wide">Elemen</div>
                          <div className="space-y-3">
                            {castingElements.map((item) => {
                              const uploadViewUrl = (item.imageHistory || []).filter((u) => typeof u === 'string' && u.startsWith('data:image')).slice(-1)[0] || null;
                              const isUploadAvailable = !!uploadViewUrl;
                              const viewClass = hasShotlist
                                ? 'text-[11px] px-3 py-2 rounded-md border border-zinc-700 text-gray-400 bg-zinc-900/60 cursor-not-allowed'
                                : isUploadAvailable
                                ? 'text-[11px] px-3 py-2 rounded-md border border-emerald-400 text-emerald-100 cursor-pointer bg-emerald-500/15 hover:bg-emerald-500/25 transition'
                                : 'text-[11px] px-3 py-2 rounded-md border border-zinc-700 text-gray-200 cursor-pointer bg-zinc-900/80 hover:bg-zinc-800 transition';
                              return (
                              <div key={item.id} className="bg-zinc-900/90 border border-zinc-800 rounded-lg p-3 shadow-sm grid grid-cols-[minmax(0,1fr)_420px] gap-3 items-stretch min-h-[320px]">
                                <div className="flex flex-col gap-2 h-full">
                                  <div>
                                    <div className="text-sm font-semibold text-white">{item.name}</div>
                                    <p className="text-xs text-gray-300 leading-snug min-h-[32px]">{item.description}</p>
                                  </div>
                                  <div className="bg-zinc-900/70 border border-zinc-800 rounded-md p-2 space-y-2 flex-1 min-h-[236px] overflow-y-auto custom-scrollbar">
                                    <p className="text-xs text-gray-100 leading-relaxed whitespace-pre-wrap">{item.detailedDescription}</p>
                                  </div>
                                </div>
                                <div className="relative bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden">
                                  <div
                                    className={`w-full aspect-video bg-zinc-900/80 flex items-center justify-center text-[11px] text-gray-500 ${item.imageUrl ? 'cursor-pointer group' : ''}`}
                                    onClick={() => {
                                      if (item.imageUrl) setPreviewAsset({ url: item.imageUrl, id: item.id, type: 'element' });
                                    }}
                                  >
                                    {item.imageUrl ? (
                                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover transition group-hover:opacity-95" />
                                    ) : (
                                      <span>Preview 16:9</span>
                                    )}
                                  </div>
                                  <div className="absolute inset-x-0 bottom-0 bg-zinc-900/80 border-t border-zinc-800 px-3 py-3 flex items-center justify-between gap-3">
                                    <button
                                      type="button"
                                      className={`relative overflow-hidden text-[11px] px-3 py-2 rounded-md font-semibold transition-all duration-200 border border-purple-400/60 text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 hover:shadow-lg hover:shadow-purple-500/30 transform hover:-translate-y-0.5 ${item.isGeneratingImage || hasShotlist ? 'opacity-60 cursor-not-allowed' : ''}`}
                                      style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)' }}
                                      onClick={() => generateCastingImage(item.id, 'element')}
                                      disabled={item.isGeneratingImage || hasShotlist}
                                    >
                                      {hasShotlist
                                        ? 'Locked'
                                        : castingTimeoutAlerts[`element-${item.id}`]
                                        ? 'Timeout, coba ulang'
                                        : item.isGeneratingImage
                                        ? 'Memproses...'
                                        : 'Generate Image'}
                                    </button>
                                    <label
                                      className={viewClass}
                                      onClick={(ev) => {
                                        if (hasShotlist) return;
                                        if (uploadViewUrl) {
                                          ev.preventDefault();
                                          setPreviewAsset({ url: uploadViewUrl, id: item.id, type: 'element' });
                                        }
                                      }}
                                    >
                                      <span>{hasShotlist ? 'Locked' : isUploadAvailable ? 'Lihat Image' : 'Upload Image'}</span>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => handleCastingUpload(e, item.id, 'element')}
                                        disabled={hasShotlist}
                                      />
                                    </label>
                                  </div>
                                  {item.isGeneratingImage && (
                                    <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center text-white text-xs font-semibold">
                                      Estimasi selesai ~ {formatCountdown(`element-${item.id}`)}
                                    </div>
                                  )}
                                </div>
                              </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {workflowStep === 'casting' && castingTab === 'location' && castingLocations.length > 0 && (
                        <div className="space-y-3 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                          <div className="text-xs font-semibold text-white uppercase tracking-wide">Lokasi</div>
                          <div className="space-y-3">
                            {castingLocations.map((item) => {
                              const uploadViewUrl = (item.imageHistory || []).filter((u) => typeof u === 'string' && u.startsWith('data:image')).slice(-1)[0] || null;
                              const isUploadAvailable = !!uploadViewUrl;
                              const viewClass = isUploadAvailable
                                ? 'text-[11px] px-3 py-2 rounded-md border border-emerald-400 text-emerald-100 cursor-pointer bg-emerald-500/15 hover:bg-emerald-500/25 transition'
                                : 'text-[11px] px-3 py-2 rounded-md border border-zinc-700 text-gray-200 cursor-pointer bg-zinc-900/80 hover:bg-zinc-800 transition';
                              return (
                              <div key={item.id} className="bg-zinc-900/90 border border-zinc-800 rounded-lg p-3 shadow-sm grid grid-cols-[minmax(0,1fr)_420px] gap-3 items-stretch">
                                <div className="flex flex-col gap-2 h-full">
                                  <div>
                                    <div className="text-sm font-semibold text-white">{item.name}</div>
                                    <p className="text-xs text-gray-300 leading-snug min-h-[32px]">{item.description}</p>
                                  </div>
                                  <div className="bg-zinc-900/70 border border-zinc-800 rounded-md p-2 space-y-2 flex-1 min-h-[236px] overflow-y-auto custom-scrollbar">
                                    <p className="text-xs text-gray-100 leading-relaxed whitespace-pre-wrap">{item.detailedDescription}</p>
                                  </div>
                                </div>
                                <div className="relative bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden">
                                  <div
                                    className={`w-full aspect-video bg-zinc-900/80 flex items-center justify-center text-[11px] text-gray-500 ${item.imageUrl ? 'cursor-pointer group' : ''}`}
                                    onClick={() => {
                                      if (item.imageUrl) setPreviewAsset({ url: item.imageUrl, id: item.id, type: 'location' });
                                    }}
                                  >
                                    {item.imageUrl ? (
                                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover transition group-hover:opacity-95" />
                                    ) : (
                                      <span>Preview 16:9</span>
                                    )}
                                  </div>
                                  <div className="absolute inset-x-0 bottom-0 bg-zinc-900/80 border-t border-zinc-800 px-3 py-3 flex items-center justify-between gap-3">
                                    <button
                                      type="button"
                                      className={`relative overflow-hidden text-[11px] px-3 py-2 rounded-md font-semibold transition-all duration-200 border border-purple-400/60 text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 hover:shadow-lg hover:shadow-purple-500/30 transform hover:-translate-y-0.5 ${item.isGeneratingImage || hasShotlist ? 'opacity-60 cursor-not-allowed' : ''}`}
                                      style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)' }}
                                      onClick={() => generateCastingImage(item.id, 'location')}
                                      disabled={item.isGeneratingImage || hasShotlist}
                                    >
                                      {hasShotlist
                                        ? 'Locked'
                                        : castingTimeoutAlerts[`location-${item.id}`]
                                        ? 'Timeout, coba ulang'
                                        : item.isGeneratingImage
                                        ? 'Memproses...'
                                        : 'Generate Image'}
                                    </button>
                                    <label
                                      className={viewClass}
                                      onClick={(ev) => {
                                        if (hasShotlist) return;
                                        if (uploadViewUrl) {
                                          ev.preventDefault();
                                          setPreviewAsset({ url: uploadViewUrl, id: item.id, type: 'location' });
                                        }
                                      }}
                                    >
                                      <span>{hasShotlist ? 'Locked' : isUploadAvailable ? 'Lihat Image' : 'Upload Image'}</span>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => handleCastingUpload(e, item.id, 'location')}
                                        disabled={hasShotlist}
                                      />
                                    </label>
                                  </div>
                                  {item.isGeneratingImage && (
                                    <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center text-white text-xs font-semibold">
                                      Estimasi selesai ~ {formatCountdown(`location-${item.id}`)}
                                    </div>
                                  )}
                                </div>
                              </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {workflowStep === 'shotlist' && hasShotlist && (
                        <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-white tracking-wide">Shot List</h3>
                            <span className="text-[10px] text-neutral-400">{shots.length} Shots</span>
                          </div>
                          <div className="space-y-2 max-h-[680px] overflow-y-auto custom-scrollbar">
                            {shots.map((s) => {
                              const actLabel = s.act || 'Act';
                              const timeLabel = s.time || '0:00';
                              const actorNames = (s.characterRefIds || []).map((id) => {
                                const found = castingCharacters.find((c) => c.id === Number(id));
                                return found?.name || `ID ${id}`;
                              });
                              const elementNames = (s.elementRefIds || []).map((id) => {
                                const found = castingElements.find((e) => e.id === Number(id));
                                return found?.name || `ID ${id}`;
                              });
                              const locationName = (() => {
                                if (!s.locationRefId) return '';
                                const found = castingLocations.find((l) => l.id === Number(s.locationRefId));
                                return found?.name || `ID ${s.locationRefId}`;
                              })();
                              return (
                                <div
                                  key={s.id}
                                  className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-3 md:p-4 shadow-sm grid grid-cols-1 md:grid-cols-[0.28fr_0.72fr] gap-4"
                                >
                                  <div className="space-y-4 h-full flex flex-col justify-between">
                                    <div className="flex items-center gap-2 text-[11px] text-neutral-300">
                                      <span className="inline-flex items-center justify-center w-7 h-6 rounded-md bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold border border-purple-400/60 shadow-inner">
                                        {s.id}
                                      </span>
                                      <div className="px-2 py-1 rounded-md border border-purple-400/50 bg-purple-500/10 text-purple-100 font-semibold text-[10px] min-w-[64px] text-center select-none">
                                        {timeLabel}
                                      </div>
                                      <div className="flex-1 px-3 py-1 rounded-md border border-zinc-700 bg-zinc-800 text-white font-semibold uppercase tracking-wide text-[11px] select-none">
                                        {actLabel}
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                                      <div className="space-y-1">
                                        <div className="text-neutral-400">Jarak Shot</div>
                                        <select
                                          value={s.shotSize || ''}
                                          onChange={(e) => updateShotField(s.id, { shotSize: e.target.value })}
                                          className="w-full h-10 px-3 rounded-md border border-zinc-700 text-neutral-100 bg-zinc-900/70 text-[11px] font-semibold focus:outline-none focus:ring-2 focus:ring-zinc-500"
                                        >
                                          {shotSizeOptions.map((opt) => (
                                            <option key={opt} value={opt} className="bg-zinc-900 text-white">
                                              {opt}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                      <div className="space-y-1">
                                        <div className="text-neutral-400">Sudut Kamera</div>
                                        <select
                                          value={s.cameraAngle || ''}
                                          onChange={(e) => updateShotField(s.id, { cameraAngle: e.target.value })}
                                          className="w-full h-10 px-3 rounded-md border border-zinc-700 text-neutral-100 bg-zinc-900/70 text-[11px] font-semibold focus:outline-none focus:ring-2 focus:ring-zinc-500"
                                        >
                                          {cameraAngleOptions.map((opt) => (
                                            <option key={opt} value={opt} className="bg-zinc-900 text-white">
                                              {opt}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    </div>

                                    <div className="text-[11px] space-y-3">
                                      <div className="space-y-1">
                                        <div className="text-neutral-400">Actors (Multi-Select)</div>
                                        <div className="py-2 min-h-[44px] flex flex-wrap gap-2 items-center">
                                          {castingCharacters.map((c) => {
                                            const active = s.characterRefIds?.includes(c.id);
                                            return (
                                              <button
                                                key={c.id}
                                                type="button"
                                                disabled
                                                className={`px-2 py-1 rounded border text-[10px] transition ${
                                                  active
                                                    ? 'bg-zinc-800 border-zinc-600 text-white cursor-not-allowed'
                                                    : 'bg-transparent border-zinc-800 text-neutral-500 cursor-not-allowed'
                                                }`}
                                              >
                                                {c.name}
                                              </button>
                                            );
                                          })}
                                          {!castingCharacters.length && <span className="text-neutral-500">-</span>}
                                        </div>
                                      </div>

                                      <div className="space-y-1">
                                        <div className="text-neutral-400">Elements (Multi-Select)</div>
                                        <div className="py-2 min-h-[44px] flex flex-wrap gap-2 items-center">
                                          {castingElements.map((e) => {
                                            const active = s.elementRefIds?.includes(e.id);
                                            return (
                                              <button
                                                key={e.id}
                                                type="button"
                                                disabled
                                                className={`px-2 py-1 rounded border text-[10px] transition ${
                                                  active
                                                    ? 'bg-zinc-800 border-zinc-600 text-white cursor-not-allowed'
                                                    : 'bg-transparent border-zinc-800 text-neutral-500 cursor-not-allowed'
                                                }`}
                                              >
                                                {e.name}
                                              </button>
                                            );
                                          })}
                                          {!castingElements.length && <span className="text-neutral-500">-</span>}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="text-[11px] space-y-1">
                                      <div className="text-neutral-400">Location</div>
                                      <div className="py-2 min-h-[44px] flex flex-wrap gap-2 items-center">
                                        {castingLocations.map((l) => {
                                          const active = s.locationRefId === String(l.id);
                                          return (
                                            <button
                                              key={l.id}
                                              type="button"
                                              disabled
                                              className={`px-2 py-1 rounded border text-[10px] transition ${
                                                active
                                                  ? 'bg-zinc-800 border-zinc-600 text-white cursor-not-allowed'
                                                  : 'bg-transparent border-zinc-800 text-neutral-500 cursor-not-allowed'
                                              }`}
                                            >
                                              {l.name}
                                            </button>
                                          );
                                        })}
                                        {!castingLocations.length && <span className="text-neutral-500">-</span>}
                                      </div>
                                    </div>

                                    <div className="space-y-1 text-[11px] text-neutral-300">
                                      <div className="text-neutral-400">Visual Action</div>
                                      <textarea
                                        value={stripIdTags(s.action || '')}
                                        onChange={(e) => updateShotField(s.id, { action: stripIdTags(e.target.value) })}
                                        className="w-full px-3 py-2 rounded-md border border-zinc-700 bg-zinc-900/70 text-white text-[12px] whitespace-pre-wrap leading-snug min-h-[120px] focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                      />
                                    </div>

                                  </div>

                                  <div className="space-y-3 w-full">
                                    <div className="relative w-full aspect-video bg-zinc-950 border border-zinc-800 rounded-lg flex items-center justify-center overflow-hidden">
                                      <div className="absolute top-2 right-2 text-[10px] px-2 py-1 rounded-md border border-purple-400/60 text-white bg-gradient-to-r from-purple-600 to-blue-600 shadow-sm">16:9</div>
                                      <div className="absolute top-2 left-2 flex gap-1 z-20 pointer-events-auto">
                                        <button
                                          type="button"
                                          className={`px-2 py-1 rounded-md text-[10px] font-semibold border ${
                                            (shotPreviewTabs[s.id] || 'photo') === 'photo'
                                              ? 'border-purple-400/60 text-white bg-purple-600/30'
                                              : 'border-zinc-700 text-neutral-300 bg-black/40'
                                          }`}
                                          onClick={() => handleShotTabChange(s.id, 'photo')}
                                        >
                                          Photo
                                        </button>
                                        <button
                                          type="button"
                                          className={`px-2 py-1 rounded-md text-[10px] font-semibold border ${
                                            (shotPreviewTabs[s.id] || 'photo') === 'video'
                                              ? 'border-purple-400/60 text-white bg-purple-600/30'
                                              : 'border-zinc-700 text-neutral-300 bg-black/40'
                                          } ${!s.videoUrl ? 'opacity-60 cursor-not-allowed' : ''}`}
                                          onClick={() => s.videoUrl && handleShotTabChange(s.id, 'video')}
                                          disabled={!s.videoUrl}
                                        >
                                          Video
                                        </button>
                                      </div>

                                      {((shotPreviewTabs[s.id] || 'photo') === 'video' && s.videoUrl) ? (
                                        <video
                                          controls
                                          className="w-full h-full object-cover"
                                          ref={(el) => { if (el) shotVideoRef.current[s.id] = el; }}
                                          src={s.videoUrl || undefined}
                                        />
                                      ) : s.imageUrl ? (
                                        <img
                                          src={s.imageUrl}
                                          alt={`Shot #${s.id}`}
                                          className="w-full h-full object-cover cursor-pointer"
                                          onClick={() => setPreviewAsset({ url: s.imageUrl!, id: s.id, type: 'shot' })}
                                        />
                                      ) : (
                                        <div className="text-center text-neutral-500 text-[11px] space-y-2">
                                          <div className="w-12 h-12 rounded-lg border border-dashed border-neutral-700 mx-auto flex items-center justify-center text-neutral-600">🎞️</div>
                                          <div>{s.prompt ? 'Preview belum tersedia' : 'Shot belum digenerate'}</div>
                                        </div>
                                      )}

                                      {s.isGeneratingImage && (
                                        <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center text-white text-xs font-semibold">
                                          Estimasi selesai ~ {formatShotCountdown(s.id)}
                                        </div>
                                      )}

                                      {s.isGeneratingVideo && (
                                        <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center text-white text-xs font-semibold">
                                          Video diproses ~ {formatShotVideoCountdown(s.id)}
                                        </div>
                                      )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                                      {(() => {
                                        const isVideoTab = (shotPreviewTabs[s.id] || 'photo') === 'video';
                                        return (
                                          <>
                                            <button
                                              type="button"
                                              onClick={() => generateShotImage(s.id)}
                                              disabled={isVideoTab || s.isGeneratingPrompt || s.isGeneratingImage}
                                              className={`w-full h-11 text-[11px] rounded-md border ${isVideoTab || s.isGeneratingPrompt || s.isGeneratingImage ? 'border-zinc-700 text-zinc-500 bg-zinc-800/80 cursor-not-allowed' : s.imageUrl ? 'border-zinc-700 text-neutral-100 bg-zinc-800 hover:border-zinc-500' : 'border-purple-400/60 text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'} transition`}
                                            >
                                              {s.isGeneratingPrompt || s.isGeneratingImage ? 'Mempersiapkan...' : s.imageUrl ? 'Regenerate Shot' : 'Generate Shot'}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => generateShotVideo(s.id)}
                                              disabled={isVideoTab || !s.imageUrl || s.isGeneratingVideo}
                                              className={`w-full h-11 text-[11px] rounded-md border transition ${(isVideoTab || !s.imageUrl || s.isGeneratingVideo)
                                                ? 'border-zinc-700 text-zinc-500 bg-zinc-800/80 cursor-not-allowed'
                                                : 'border-purple-400/60 text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'}`}
                                            >
                                              {s.isGeneratingVideo ? 'Mempersiapkan Video...' : 'Generate Video Scene'}
                                            </button>
                                          </>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </section>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
      {previewAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4" onClick={() => setPreviewAsset(null)}>
          <div className="relative bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <span className="text-sm font-semibold text-white">Preview Image</span>
              <button
                type="button"
                className="text-gray-300 hover:text-white text-2xl font-semibold px-2 py-1 transition-transform hover:scale-110"
                onClick={() => setPreviewAsset(null)}
                aria-label="Tutup preview"
              >
                ×
              </button>
            </div>
            <div className="p-4">
              <div className="w-full max-h-[70vh] rounded-lg overflow-hidden border border-zinc-800 bg-black">
                <img src={previewAsset.url} alt="Preview" className="w-full h-full object-contain" />
              </div>
              {!hasShotlist && (
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    className="px-4 py-2 text-sm font-semibold rounded-md border border-red-400 text-red-200 hover:bg-red-500/15 transition"
                    onClick={() => handleRemoveUploadedImage(previewAsset.id, previewAsset.type, previewAsset.url)}
                  >
                    Hapus Foto
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <Modal
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        title={t.modals.confirmReset.title}
        message={
          <div className="space-y-2">
            <p>{t.visualImagery.clearData}</p>
            <p className="text-gray-400 text-sm">{t.modals.confirmReset.warning}</p>
          </div>
        }
        onConfirm={() => {
          resetAll();
          setIsResetConfirmOpen(false);
        }}
        confirmButtonText={t.modals.confirmReset.confirm}
        cancelButtonText={t.modals.confirmReset.cancel}
        confirmButtonColor="bg-red-600 hover:bg-red-700"
      />
    </div>
  );
};

export default GenerateCinematicFilmPage;
