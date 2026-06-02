// src/pages/GenerateVisualImagery/GenerateVisualImageryPage.tsx
import React, { useEffect, useRef, useState } from 'react';

import Modal from '../../shared/components/Modal';
import PageHeader from '../../shared/components/PageHeader';
import GradientLoader from '../../shared/components/GradientLoader';
import { useImageResolution } from '../../shared/utils/useImageResolution';
import { useLanguage } from '../../shared/i18n';

export const VisualImageryPageHeaderIcon: React.FC = () => null; // legacy, replaced by iconId

type ActivityLogEntry = {
  id: number;
  type: 'INFO' | 'SUCCESS' | 'ERROR';
  message: string;
  timestamp: string;
};

const VISUAL_IMAGERY_TUTORIAL_URL = 'https://www.youtube.com/embed/mmKBFi_Ylf8?autoplay=1&mute=1&origin=http://localhost:3000';

type FileData = {
  mimeType: string;
  data: string; // base64 only
  previewUrl: string;
  name: string;
  size: number;
};

interface PreviewItem {
  id: string;
  prompt: string;
  referenceImages?: string[]; // Preview URLs for montage mode reference images
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

const VisualImageryPage: React.FC = () => {
  const { t, language } = useLanguage();
  const [imageResolution] = useImageResolution();

  // Calculate fixed card dimensions based on resolution
  const cardDimensions = imageResolution === '1366x768'
    ? { parameter: 427, preview: 907 }
    : { parameter: 599, preview: 1273 };

  const [ingredientImages, setIngredientImages] = useState<FileData[]>([]);
  const [startFrameImage, setStartFrameImage] = useState<FileData | null>(null);
  const [endFrameImage, setEndFrameImage] = useState<FileData | null>(null);
  const [promptText, setPromptText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [activityLogCopyLabel, setActivityLogCopyLabel] = useState(t.activityLog.copyLog);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [ratio, setRatio] = useState<'16:9' | '9:16'>('16:9');
  const [modeImaginary, setModeImaginary] = useState<'keyframe' | 'montage'>('keyframe');
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const [isOutputGenerating, setIsOutputGenerating] = useState(false);
  const [videoJob, setVideoJob] = useState<{ status: 'idle' | 'running' | 'completed' | 'error'; lastMessage?: string; videoUrl?: string; videoFilePath?: string; fileName?: string }>({ status: 'idle' });

  const ingredientFileInputRef = useRef<HTMLInputElement | null>(null);
  const startFrameFileInputRef = useRef<HTMLInputElement | null>(null);
  const endFrameFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setActivityLogCopyLabel(t.activityLog.copyLog);
  }, [t.activityLog.copyLog]);


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
        
        setVideoJob({ 
          status: 'completed', 
          lastMessage: message || 'Video selesai', 
          videoUrl, 
          videoFilePath: filePath,
          fileName 
        });
        
        // Update the latest preview item with video information
        const finalVideoSrc = getVideoSrc(videoUrl, filePath);
        if (finalVideoSrc) {
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

  const startVideoFromKeyframes = async () => {
    if (modeImaginary !== 'keyframe') return;
    if (!startFrameImage || !endFrameImage) {
      addLog('ERROR', 'Start/End frame belum lengkap untuk video.');
      return;
    }

    const bearerKey = window.localStorage.getItem('zeoStudio.bearerToken') || '';
    const outputFolder = await ensureOutputFolder();
    const flowProjectId = window.localStorage.getItem('zeoStudio.workflow.flowProjectId') || '';

    if (!bearerKey.trim()) {
      addLog('ERROR', t.logMessages.common.bearerTokenMissing);
      return;
    }
    if (!outputFolder) return;

    if (typeof window === 'undefined' || !window.zeoAPI?.startSceneWorkflow) {
      addLog('ERROR', t.logMessages.sceneGenerator.engineNotAvailable);
      return;
    }

    const startBase64 = startFrameImage.data;
    const endBase64 = endFrameImage.data;
    if (!startBase64 || !endBase64) {
      addLog('ERROR', 'Data start/end frame kosong.');
      return;
    }

    const videoPrompt = withLanguagePreference(promptText.trim());

    addLog('INFO', 'Memulai generate video dari start/end frame...');
    setIsOutputGenerating(true);

    try {
      await window.zeoAPI.startSceneWorkflow({
        bearerKey,
        downloadPath: outputFolder,
        flowProjectId,
        aspectRatio: ratio,
        resolution: '720p',
        uiLanguage: language,
        scenes: [
          {
            index: 1,
            mode: 'pair-chunk',
            startImageBase64: startBase64,
            endImageBase64: endBase64,
            prompt: videoPrompt,
          },
        ],
      });

      addLog('SUCCESS', 'Permintaan video dikirim. Lihat log engine untuk progres.');
    } catch (err: any) {
      addLog('ERROR', `${t.sceneGenerator?.videoStartError || 'Gagal memulai video'}: ${err?.message || String(err)}`);
    } finally {
      setIsOutputGenerating(false);
    }
  };

  const processSingleFrameFile = (file: File, setter: React.Dispatch<React.SetStateAction<FileData | null>>, label: 'Start Frame' | 'End Frame') => {
    if (!file.type.startsWith('image/')) {
      addLog('ERROR', t.visualImagery.invalidFileType);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result || '');
      const split = base64.split(',');
      const data = split.length > 1 ? split[1] : split[0];
      setter({
        mimeType: file.type,
        data,
        previewUrl: `data:${file.type};base64,${data}`,
        name: file.name,
        size: file.size,
      });
      addLog('INFO', `${label}: ${t.visualImagery.fileLoaded.replace('{name}', file.name)}`);
    };
    reader.onerror = () => {
      addLog('ERROR', t.visualImagery.fileReadError);
    };
    reader.readAsDataURL(file);
  };



  useEffect(() => {
    if (!error) return;
    const timeout = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(timeout);
  }, [error]);

  const resetAll = () => {
    setIngredientImages([]);
    setStartFrameImage(null);
    setEndFrameImage(null);
    setPromptText('');
    setError(null);
    setActivityLogs([]);
    setActivityLogCopyLabel(t.activityLog.copyLog);
    setPreviewItems([]);
    setIsOutputGenerating(false);
    setVideoJob({ status: 'idle' });
    if (ingredientFileInputRef.current) {
      ingredientFileInputRef.current.value = '';
    }
  };

  const maxIngredients = modeImaginary === 'montage' ? 3 : 10;

  useEffect(() => {
    // Trim ingredient list when switching to montage to respect 3-slot limit
    if (modeImaginary === 'montage' && ingredientImages.length > maxIngredients) {
      setIngredientImages((prev) => prev.slice(0, maxIngredients));
    }
  }, [modeImaginary, ingredientImages.length, maxIngredients]);

  const processIngredientFiles = (fileList: FileList | File[]) => {
    const remaining = maxIngredients - ingredientImages.length;
    if (remaining <= 0) {
      addLog('ERROR', t.visualImagery.ingredientImageMax);
      return;
    }

    const filesToProcess = Array.from(fileList as FileList).slice(0, remaining);
    for (const file of filesToProcess) {
      if (!file.type.startsWith('image/')) {
        addLog('ERROR', t.visualImagery.invalidFileType);
        continue;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = String(reader.result || '');
        const split = base64.split(',');
        const data = split.length > 1 ? split[1] : split[0];
        setIngredientImages((prev) => {
          if (prev.length >= maxIngredients) return prev;
          return [...prev, {
            mimeType: file.type,
            data,
            previewUrl: `data:${file.type};base64,${data}`,
            name: file.name,
            size: file.size,
          }];
        });
        addLog('INFO', t.visualImagery.fileLoaded.replace('{name}', file.name));
      };
      reader.onerror = () => {
        addLog('ERROR', t.visualImagery.fileReadError);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleIngredientFileSelect: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    processIngredientFiles(files);
    if (ingredientFileInputRef.current) ingredientFileInputRef.current.value = '';
  };

  const handleIngredientDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    processIngredientFiles(files);
    if (ingredientFileInputRef.current) ingredientFileInputRef.current.value = '';
  };

  const handleStartFrameSelect: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processSingleFrameFile(file, setStartFrameImage, 'Start Frame');
    if (startFrameFileInputRef.current) startFrameFileInputRef.current.value = '';
    
    // Auto-create preview item when both frames are ready
    setTimeout(() => createKeyframePreviewItem(), 100);
  };

  const handleEndFrameSelect: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processSingleFrameFile(file, setEndFrameImage, 'End Frame');
    if (endFrameFileInputRef.current) endFrameFileInputRef.current.value = '';
    
    // Auto-create preview item when both frames are ready
    setTimeout(() => createKeyframePreviewItem(), 100);
  };

  const handleStartFrameDrop: React.DragEventHandler<HTMLLabelElement> = (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    processSingleFrameFile(file, setStartFrameImage, 'Start Frame');
    
    // Auto-create preview item when both frames are ready
    setTimeout(() => createKeyframePreviewItem(), 100);
  };

  const handleEndFrameDrop: React.DragEventHandler<HTMLLabelElement> = (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    processSingleFrameFile(file, setEndFrameImage, 'End Frame');
    
    // Auto-create preview item when both frames are ready
    setTimeout(() => createKeyframePreviewItem(), 100);
  };

  const createKeyframePreviewItem = () => {
    if (modeImaginary !== 'keyframe') return;
    if (!startFrameImage || !endFrameImage) return;
    
    // Create preview item showing start and end frames
    const operationId = `keyframe-${Date.now()}`;
    const previewItem: PreviewItem = {
      id: operationId,
      prompt: promptText.trim() || 'Video dari Start & End Frame',
      status: 'completed',
      referenceImages: [startFrameImage.previewUrl, endFrameImage.previewUrl],
    };
    
    // Replace existing preview or add new one
    setPreviewItems([previewItem]);
    addLog('INFO', `Preview dibuat: Start Frame (${startFrameImage.name}) → End Frame (${endFrameImage.name})`);
  };

  const removeIngredientImage = (index: number) => {
    setIngredientImages((prev) => prev.filter((_, i) => i !== index));
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
      addLog('INFO', t.visualImagery.usingGlobalFolder.replace('{folder}', outputFolder));
      return outputFolder;
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

  const startVideoFromMontage = async () => {
    if (modeImaginary !== 'montage') return;
    if (ingredientImages.length === 0) {
      addLog('ERROR', 'Mode Montage memerlukan minimal 1 reference image.');
      return;
    }

    const bearerKey = window.localStorage.getItem('zeoStudio.bearerToken') || '';
    const outputFolder = await ensureOutputFolder();
    const flowProjectId = window.localStorage.getItem('zeoStudio.workflow.flowProjectId') || '';

    if (!bearerKey.trim()) {
      addLog('ERROR', t.logMessages.common.bearerTokenMissing);
      return;
    }
    if (!outputFolder) return;

    if (typeof window === 'undefined' || !window.zeoAPI?.startSceneWorkflow) {
      addLog('ERROR', t.logMessages.sceneGenerator.engineNotAvailable);
      return;
    }

    const videoPrompt = withLanguagePreference(promptText.trim() || 'Create smooth video from reference images');

    addLog('INFO', `Memulai generate video dari ${ingredientImages.length} reference image(s)...`);
    setIsOutputGenerating(true);

    try {
      // Create preview item showing reference images
      const operationId = `montage-${Date.now()}`;
      const previewItem: PreviewItem = {
        id: operationId,
        prompt: videoPrompt,
        status: 'completed',
        referenceImages: ingredientImages.map(img => img.previewUrl),
      };
      setPreviewItems([previewItem]);

      await window.zeoAPI.startSceneWorkflow({
        bearerKey,
        downloadPath: outputFolder,
        flowProjectId,
        aspectRatio: ratio,
        resolution: '720p',
        uiLanguage: language,
        scenes: [
          {
            index: 1,
            mode: 'montage',
            referenceImages: ingredientImages.map((img) => ({
              data: img.data,
              mimeType: img.mimeType,
            })),
            prompt: videoPrompt,
          },
        ],
      });

      addLog('SUCCESS', 'Permintaan video montage dikirim. Lihat log engine untuk progres.');
    } catch (err: any) {
      addLog('ERROR', `${t.sceneGenerator?.videoStartError || 'Gagal memulai video'}: ${err?.message || String(err)}`);
    } finally {
      setIsOutputGenerating(false);
    }
  };


  const handleGenerateOrPreview = () => {
    if (modeImaginary === 'keyframe') {
      if (!startFrameImage || !endFrameImage) {
        addLog('ERROR', 'Mode Keyframe memerlukan Start Frame dan End Frame.');
        return;
      }
      startVideoFromKeyframes();
      return;
    }
    
    if (modeImaginary === 'montage') {
      if (ingredientImages.length === 0) {
        addLog('ERROR', 'Mode Montage memerlukan minimal 1 reference image.');
        return;
      }
      startVideoFromMontage();
      return;
    }
  };


  const handleDownload = async (url?: string, fileName = 'image.png') => {
    if (!url) return;
    console.log('[VisualImagery] Downloading:', { fileName, urlLength: url.length, isDataUrl: url.startsWith('data:') });
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

    console.log('[VisualImagery] Downloading video:', { fileName, videoUrl });
    
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
        iconId="visual-imagery"
        iconClassName="h-6 w-6 mr-3 text-white"
        title={t.visualImagery.title}
        description={t.visualImagery.description}
        tutorialUrl={VISUAL_IMAGERY_TUTORIAL_URL}
        tutorialTitle="Tutorial Visual Imagery"
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
                  <h3 className="text-[11px] font-semibold text-gray-200 tracking-wide">
                    {t.visualImagery.modeImaginaryLabel || 'Mode Imaginary'}
                  </h3>
                  <p className="text-[10px] text-gray-500">{t.visualImagery.modeImaginaryDescription || ''}</p>
                  <div className="flex rounded-lg border border-zinc-800 overflow-hidden bg-zinc-900">
                    {([
                      { key: 'keyframe', label: t.visualImagery.modeKeyframe || 'Keyframe', sub: 'Cinematic cuts' },
                      { key: 'montage', label: t.visualImagery.modeMontage || 'Montage', sub: 'Smooth sequence' },
                    ] as const).map((item, idx) => {
                      const isActive = modeImaginary === item.key;
                      return (
                        <button
                          type="button"
                          key={item.key}
                          onClick={() => setModeImaginary(item.key)}
                          className={`flex-1 px-4 py-2 text-center transition-all duration-200 text-xs font-semibold border-r border-zinc-800 last:border-r-0
                            ${isActive
                              ? 'bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 text-white shadow-inner'
                              : 'text-gray-300 hover:bg-zinc-800'}
                          `}
                          aria-pressed={isActive}
                        >
                          <div className="flex items-center justify-center gap-1">
                            <span>{item.label}</span>
                          </div>
                          <p className={`mt-0.5 text-[10px] text-center ${isActive ? 'text-white/80' : 'text-gray-500'}`}>{item.sub}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="text-[11px] font-semibold text-gray-200 tracking-wide">
                    {t.visualImagery.promptLabel}
                  </h3>
                  <p className="text-[10px] text-gray-500">{t.visualImagery.promptDescription}</p>
                  <textarea
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    placeholder={t.visualImagery.promptPlaceholder}
                    className="w-full min-h-[120px] bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-gray-50 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 resize-y"
                  />
                </div>

                <div className="space-y-1">
                {modeImaginary === 'montage' ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[11px] font-semibold text-gray-200 tracking-wide">
                        {t.visualImagery.ingredientImage}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500">{ingredientImages.length}/{maxIngredients}</span>
                        <span className="text-[10px] text-gray-500 bg-zinc-800 px-2 py-0.5 rounded">{t.visualImagery.ingredientImageOptional}</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-500">{t.visualImagery.ingredientImageDesc}</p>

                    <div className="grid grid-cols-3 gap-2">
                      {Array.from({ length: 3 }).map((_, idx) => {
                        const img = ingredientImages[idx];
                        const isEmpty = !img;
                        return img ? (
                          <div key={idx} className="relative group aspect-square rounded-lg border border-zinc-700 overflow-hidden bg-zinc-900">
                            <img
                              src={img.previewUrl}
                              alt={img.name}
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => removeIngredientImage(idx)}
                              className="absolute top-1 right-1 w-5 h-5 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                              title={t.visualImagery.removeFile}
                            >
                              ×
                            </button>
                            <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-[8px] text-gray-300 px-1 py-0.5 truncate">
                              {img.name}
                            </span>
                          </div>
                        ) : (
                          <label
                            key={idx}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleIngredientDrop}
                            className="aspect-square rounded-lg border border-dashed border-zinc-700 cursor-pointer hover:border-purple-500/70 transition-colors flex flex-col items-center justify-center text-gray-400 hover:text-purple-400 bg-zinc-900/50"
                          >
                            <input
                              ref={idx === ingredientImages.length ? ingredientFileInputRef : undefined}
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              onChange={handleIngredientFileSelect}
                            />
                            <span className="text-xl leading-none">+</span>
                            <span className="text-[8px] mt-1">{t.visualImagery.uploadImage}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[11px] font-semibold text-gray-200 tracking-wide">Start / End Frame</h3>
                      <span className="text-[10px] text-gray-500 bg-zinc-800 px-2 py-0.5 rounded">Upload & Drag</span>
                    </div>
                    <p className="text-[10px] text-gray-500">Unggah atau drag-drop referensi start frame dan end frame seperti pada Generate Scene (single, pairing, sliding) untuk konsistensi visual.</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        {
                          key: 'start',
                          title: 'Start Frame',
                          desc: 'Komposisi awal sebelum pergerakan besar.',
                          image: startFrameImage,
                          onDrop: handleStartFrameDrop,
                          inputRef: startFrameFileInputRef,
                          onSelect: handleStartFrameSelect,
                          onRemove: () => setStartFrameImage(null),
                        },
                        {
                          key: 'end',
                          title: 'End Frame',
                          desc: 'Momen puncak sebelum pindah scene.',
                          image: endFrameImage,
                          onDrop: handleEndFrameDrop,
                          inputRef: endFrameFileInputRef,
                          onSelect: handleEndFrameSelect,
                          onRemove: () => setEndFrameImage(null),
                        },
                      ].map((card) => (
                        <div key={card.key} className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/70 space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-[11px] font-semibold text-gray-100">{card.title}</div>
                              <p className="text-[10px] text-gray-400 leading-snug">{card.desc}</p>
                            </div>
                            {card.image && (
                              <button
                                type="button"
                                onClick={card.onRemove}
                                className="text-[10px] px-2 py-1 rounded-md bg-red-600/80 hover:bg-red-600 text-white"
                              >
                                Hapus
                              </button>
                            )}
                          </div>
                          <label
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={card.onDrop}
                            className="aspect-video w-full rounded-lg border border-dashed border-zinc-700 cursor-pointer hover:border-purple-500/70 transition-colors flex items-center justify-center bg-zinc-900/60 overflow-hidden"
                          >
                            <input
                              ref={card.inputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={card.onSelect}
                            />
                            {card.image ? (
                              <img src={card.image.previewUrl} alt={card.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="flex flex-col items-center text-gray-400 text-[11px] gap-1">
                                <span className="text-xl">+</span>
                                <span>Upload / Drag & Drop</span>
                              </div>
                            )}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

                <div className="space-y-2">
                  <h3 className="text-[11px] font-semibold text-gray-200 tracking-wide">
                    {t.visualImagery.ratioLabel}
                  </h3>
                  <div className="flex rounded-lg border border-zinc-800 overflow-hidden bg-zinc-900">
                    {([
                      { key: '16:9' as const, label: t.visualImagery.ratio169 },
                      { key: '9:16' as const, label: t.visualImagery.ratio918 },
                    ]).map((item) => {
                      const isActive = ratio === item.key;
                      return (
                        <button
                          type="button"
                          key={item.key}
                          onClick={() => setRatio(item.key)}
                          className={`flex-1 px-4 py-2 text-center transition-all duration-200 text-xs font-semibold border-r border-zinc-800 last:border-r-0
                            ${isActive
                              ? 'bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 text-white shadow-inner'
                              : 'text-gray-300 hover:bg-zinc-800'}
                          `}
                          aria-pressed={isActive}
                        >
                          <span>{item.label}</span>
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
                  onClick={handleGenerateOrPreview}
                  disabled={isOutputGenerating || !promptText.trim() || !ratio}
                  className={`w-full min-h-[48px] px-4 rounded-lg text-white font-semibold transition-all duration-200 btn-glass-primary flex items-center justify-center
                    focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-zinc-900
                    ${
                      isOutputGenerating || !promptText.trim() || !ratio
                        ? 'bg-zinc-600 cursor-not-allowed'
                        : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
                    }`}
                  aria-label={t.visualImagery.generateButton}
                >
                  {isOutputGenerating
                    ? t.visualImagery.processingBtn
                    : t.visualImagery.generateButton}
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
              <h3 className="text-lg font-semibold text-gray-50">{t.visualImagery.previewTitle}</h3>
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(true)}
                className="inline-flex items-center px-4 py-2 text-[11px] font-semibold rounded-lg shadow-md transition-all duration-200 btn-glass-primary bg-red-600 hover:bg-red-700 text-white"
              >
                <span className="mr-1.5 text-xs">🗑️</span>
                <span>{t.buttons.clear} {t.common.data}</span>
              </button>
            </div>

            <div className="flex-1 flex flex-col px-6 py-4 pb-6 min-h-[760px] min-w-0 space-y-3 overflow-y-auto custom-scrollbar" id="image-editor-result">
              {videoJob.status !== 'idle' ? (
                <div className="border border-zinc-800 bg-zinc-950/60 rounded-xl overflow-visible shadow-sm p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-md border text-[10px] ${
                          videoJob.status === 'completed'
                            ? 'border-emerald-500 text-emerald-300'
                            : videoJob.status === 'error'
                            ? 'border-red-500 text-red-300'
                            : 'border-yellow-400 text-yellow-200'
                        }`}>
                          {videoJob.status === 'completed'
                            ? 'Ready'
                            : videoJob.status === 'error'
                            ? 'Error'
                            : 'Processing'}
                        </span>
                        {videoJob.fileName && (
                          <span className="text-[11px] text-gray-300 truncate max-w-[280px] font-medium bg-zinc-900/60 px-2 py-1 rounded-md border border-zinc-700" title={videoJob.fileName}>
                            📁 {videoJob.fileName}
                          </span>
                        )}
                      </div>
                      {videoJob.status === 'completed' && videoJob.fileName && (
                        <div className="text-[11px] text-emerald-300 bg-emerald-950/20 border border-emerald-500/30 rounded-lg px-3 py-2 flex items-center gap-2">
                          <span>✅</span>
                          <span>Video tersimpan otomatis di: <span className="font-semibold">{videoJob.fileName}</span></span>
                        </div>
                      )}
                      {videoJob.lastMessage && videoJob.status === 'error' && (
                        <div className="text-[11px] text-red-300 bg-red-950/20 border border-red-500/30 rounded-lg px-3 py-2">
                          {videoJob.lastMessage}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setVideoJob({ status: 'idle' })}
                        className="px-3 py-1 rounded-md text-[10px] font-semibold border border-zinc-700 text-gray-200 hover:bg-zinc-800 hover:border-zinc-600 transition-all duration-200"
                      >
                        ✖️ Close
                      </button>
                    </div>
                  </div>

                  {videoJob.status === 'completed' && getVideoSrc(videoJob.videoUrl, videoJob.videoFilePath) && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-emerald-300 flex items-center gap-2">
                          <span>🎬</span>
                          <span>Video Result</span>
                        </label>
                        {videoJob.fileName && (
                          <span className="text-[10px] text-gray-400 truncate max-w-[200px]" title={videoJob.fileName}>
                            📁 {videoJob.fileName}
                          </span>
                        )}
                      </div>
                      <div className="rounded-xl overflow-hidden border-2 border-emerald-500/40 bg-black shadow-lg">
                        <video
                          className="w-full max-h-[450px] object-contain bg-black"
                          src={`${getVideoSrc(videoJob.videoUrl, videoJob.videoFilePath) ?? ''}#t=0.5`}
                          controls
                          preload="metadata"
                        />
                        <div className="px-3 py-2 text-[10px] text-gray-200 bg-zinc-900/90 border-t border-emerald-500/30">
                          <div className="flex items-center gap-2">
                            <span className="text-emerald-400 font-semibold">▶️ Video Preview</span>
                            <span className="text-gray-500">•</span>
                            <span className="truncate max-w-[300px]" title={videoJob.fileName || videoJob.videoUrl}>
                              {videoJob.fileName || 'video-result.mp4'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {videoJob.status === 'running' && (
                    <div className="py-10">
                      <GradientLoader 
                        size="md"
                        text="Generating video..."
                        subtitle="Mohon tunggu, proses sedang berjalan"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center bg-zinc-950/40 rounded-lg text-gray-500 text-center text-xs p-4">
                  <p>{t.visualImagery.noResult}</p>
                </div>
              )}

            </div>
          </section>
        </div>
      </div>
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

export default VisualImageryPage;
