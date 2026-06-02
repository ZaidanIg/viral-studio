// src/pages/GenerateImageEditor/GenerateImageEditorPage.tsx
import React, { useEffect, useRef, useState } from 'react';

import Modal from '../../shared/components/Modal';
import PageHeader from '../../shared/components/PageHeader';
import GradientLoader from '../../shared/components/GradientLoader';
import { useImageResolution } from '../../shared/utils/useImageResolution';
import { useLanguage } from '../../shared/i18n';

export const ImageEditorPageHeaderIcon: React.FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-6 w-6 mr-3 text-cyan-400"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
    />
  </svg>
);

type ActivityLogEntry = {
  id: number;
  type: 'INFO' | 'SUCCESS' | 'ERROR';
  message: string;
  timestamp: string;
};

type FileData = {
  mimeType: string;
  data: string; // base64 only
  previewUrl: string;
  name: string;
  size: number;
};

type PreviewItem = {
  id: string;
  prompt: string;
  mediaUrl?: string; // Legacy/Fallback (local server URL)
  dataUrl?: string; // Base64 Data URL (preferred)
  afterMediaUrl?: string;
  afterDataUrl?: string; // Base64 Data URL for edited result
  status: 'running' | 'completed' | 'error';
  lastMessage?: string;
  startedAt?: number;
  estimatedTotalSeconds?: number;
  isEditing?: boolean;
  isEditRunning?: boolean;
  isApplied?: boolean; // Track if edited image has been applied to Before card
  generatingCountdown?: number;
};

const IMAGE_EDITOR_TUTORIAL_URL = 'https://www.youtube.com/embed/qZUL91NwUuQ?autoplay=1&mute=1&origin=http://localhost:3000';

const friendlyModelName = (raw?: string): string => {
  if (!raw) return 'Nano Banana Pro';
  const key = raw.toUpperCase();
  if (key === 'GEM_PIX_2') return 'Nano Banana Pro';
  if (key === 'GEM_PIX') return 'Nano Banana';
  if (key === 'IMAGEN_3_5') return 'Imagen 4';
  return raw;
};

const ImageEditorPage: React.FC = () => {
  const { t, language } = useLanguage();
  const [imageResolution] = useImageResolution();

  // Calculate fixed card dimensions based on resolution
  const cardDimensions = imageResolution === '1366x768'
    ? { parameter: 427, preview: 907 }
    : { parameter: 599, preview: 1273 };

  const [ingredientImages, setIngredientImages] = useState<FileData[]>([]);
  const [promptText, setPromptText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [activityLogCopyLabel, setActivityLogCopyLabel] = useState(t.activityLog.copyLog);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [ratio, setRatio] = useState<'16:9' | '9:16'>('16:9');
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const [now, setNow] = useState<number>(Date.now());
  const [isOutputGenerating, setIsOutputGenerating] = useState(false);
  const [selectedPreview, setSelectedPreview] = useState<PreviewItem | null>(null);
  const [editedPrompt, setEditedPrompt] = useState('');
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [editInstructions, setEditInstructions] = useState<Record<string, string>>({});

  const ingredientFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setActivityLogCopyLabel(t.activityLog.copyLog);
  }, [t.activityLog.copyLog]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
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



  useEffect(() => {
    if (!error) return;
    const timeout = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(timeout);
  }, [error]);

  const resetAll = () => {
    setIngredientImages([]);
    setPromptText('');
    setError(null);
    setActivityLogs([]);
    setActivityLogCopyLabel(t.activityLog.copyLog);
    setPreviewItems([]);
    setIsOutputGenerating(false);
    if (ingredientFileInputRef.current) {
      ingredientFileInputRef.current.value = '';
    }
  };

  const handleIngredientFileSelect: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remaining = 10 - ingredientImages.length;
    if (remaining <= 0) {
      addLog('ERROR', t.imageEditor.ingredientImageMax);
      return;
    }

    const filesToProcess = Array.from(files as FileList).slice(0, remaining);
    for (const file of filesToProcess) {
      if (!file.type.startsWith('image/')) {
        addLog('ERROR', t.imageEditor.invalidFileType);
        continue;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = String(reader.result || '');
        const split = base64.split(',');
        const data = split.length > 1 ? split[1] : split[0];
        setIngredientImages((prev) => {
          if (prev.length >= 10) return prev;
          return [...prev, {
            mimeType: file.type,
            data,
            previewUrl: `data:${file.type};base64,${data}`,
            name: file.name,
            size: file.size,
          }];
        });
        addLog('INFO', t.imageEditor.fileLoaded.replace('{name}', file.name));
      };
      reader.onerror = () => {
        addLog('ERROR', t.imageEditor.fileReadError);
      };
      reader.readAsDataURL(file);
    }

    if (ingredientFileInputRef.current) ingredientFileInputRef.current.value = '';
  };

  const removeIngredientImage = (index: number) => {
    setIngredientImages((prev) => prev.filter((_, i) => i !== index));
  };


  const addPreviewItem = (item: PreviewItem) => {
    setPreviewItems([item]);
    setSelectedPreview(null);
    setEditedPrompt('');
  };

  const updatePreviewItem = (id: string, updater: (item: PreviewItem) => PreviewItem) => {
    setPreviewItems((prev) => prev.map((item) => (item.id === id ? updater(item) : item)));
    if (selectedPreview && selectedPreview.id === id) {
      setSelectedPreview((prev) => (prev ? updater(prev) : null));
    }
  };

  const handleStartEdit = (id: string, currentPrompt: string) => {
    updatePreviewItem(id, (item) => ({ ...item, isEditing: true }));
    setEditedPrompt(currentPrompt);
  };

  const handleSaveEdit = (id: string) => {
    const trimmed = editedPrompt.trim();
    if (!trimmed) return;
    updatePreviewItem(id, (item) => ({ ...item, prompt: trimmed, isEditing: false }));
    if (selectedPreview && selectedPreview.id === id) {
      setSelectedPreview((prev) => (prev ? { ...prev, prompt: trimmed, isEditing: false } : null));
    }
  };

  const handleBlurEdit = (id: string) => {
    handleSaveEdit(id);
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
      addLog('INFO', t.imageEditor.usingGlobalFolder.replace('{folder}', outputFolder));
      return outputFolder;
    }

    if (typeof window !== 'undefined' && window.zeoAPI?.selectFolder) {
      addLog('INFO', t.imageEditor.selectingFolder);
      const picked = await window.zeoAPI.selectFolder({ title: t.imageEditor.selectFolderTitle });
      if (picked && !picked.canceled && picked.path) {
        outputFolder = picked.path;
        try {
          window.localStorage.setItem('zeoStudio.folder.output', outputFolder);
          window.localStorage.setItem('zeoStudio.folder.output.lastSaved', outputFolder);
        } catch {
          /* ignore */
        }
        addLog('SUCCESS', t.imageEditor.folderSet.replace('{folder}', outputFolder));
        return outputFolder;
      }
    }
    addLog('ERROR', t.imageEditor.folderNotConfigured);
    return null;
  };

  const handleEditImage = async (item: PreviewItem) => {
    // Prefer dataUrl if available, otherwise fallback to mediaUrl
    const sourceImage = item.dataUrl || item.mediaUrl;
    
    if (!sourceImage || item.isEditRunning) return;
    
    const instruction = (editInstructions[item.id] || '').trim();
    if (!instruction) {
      addLog('ERROR', t.imageEditor.editInstructionEmpty);
      return;
    }

    const bearerKey = window.localStorage.getItem('zeoStudio.bearerToken') || '';
    if (!bearerKey.trim()) {
      addLog('ERROR', t.logMessages.common.bearerTokenMissing);
      return;
    }

    if (!window.zeoAPI?.editStoryFrame) {
      addLog('ERROR', t.logMessages.common.engineNotAvailable);
      return;
    }

    updatePreviewItem(item.id, (curr) => ({ ...curr, isEditRunning: true }));
    addLog('INFO', t.imageEditor.editStarted);

    try {
      let base64 = '';
      if (sourceImage.startsWith('data:')) {
        base64 = sourceImage.split(',')[1] || '';
      } else {
        // Fallback: fetch from URL (likely local server)
        try {
          const response = await fetch(sourceImage);
          const blob = await response.blob();
          base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const dataUrl = reader.result as string;
              resolve(dataUrl.split(',')[1] || '');
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (fetchErr) {
          throw new Error(`Failed to fetch source image: ${fetchErr}`);
        }
      }

      const result = await window.zeoAPI.editStoryFrame({
        bearerKey,
        aspectRatio: ratio,
        imageResolution: 'default',
        instruction,
        imageBase64: base64,
        mode: 'edit',
      });

      if (!result || !result.ok || !result.dataUrl) {
        const message = result?.error || t.imageEditor.editFailed;
        updatePreviewItem(item.id, (curr) => ({ ...curr, isEditRunning: false }));
        addLog('ERROR', message);
        return;
      }

      updatePreviewItem(item.id, (curr) => ({ 
        ...curr, 
        afterDataUrl: result.dataUrl,
        afterMediaUrl: result.dataUrl, // Use dataUrl for display
        isEditRunning: false 
      }));
      setEditInstructions((prev) => ({ ...prev, [item.id]: '' }));
      addLog('SUCCESS', t.imageEditor.editSuccess);
    } catch (err: any) {
      updatePreviewItem(item.id, (curr) => ({ ...curr, isEditRunning: false }));
      addLog('ERROR', `${t.imageEditor.editFailed}: ${err?.message || String(err)}`);
    }
  };

  const handleApplyImage = (item: PreviewItem) => {
    if (!item.afterMediaUrl && !item.afterDataUrl) return;
    updatePreviewItem(item.id, (curr) => ({
      ...curr,
      mediaUrl: curr.afterMediaUrl,
      dataUrl: curr.afterDataUrl,
      afterMediaUrl: undefined,
      afterDataUrl: undefined,
      isApplied: true,
    }));
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
      ? t.imageEditor.languageInstructionId
      : t.imageEditor.languageInstructionOther.replace('{lang}', lang);

    return `${prompt}\n\n${instruction}`;
  };

  const regenerateFromItem = async (item: PreviewItem) => {
    if (!item.prompt.trim()) return;
    setRegeneratingId(item.id);
    const bearerKey = window.localStorage.getItem('zeoStudio.bearerToken') || '';
    const outputFolder = await ensureOutputFolder();
    if (!bearerKey.trim()) {
      addLog('ERROR', t.logMessages.common.bearerTokenMissing);
      return;
    }
    if (!outputFolder) return;

    const operationId = `${Date.now()}`;
    const baseItem: PreviewItem = {
      ...item,
      id: operationId,
      status: 'running',
      startedAt: Date.now(),
      estimatedTotalSeconds: 300,
      generatingCountdown: 300,
      lastMessage: undefined,
      mediaUrl: undefined,
      dataUrl: undefined,
      afterMediaUrl: undefined,
      afterDataUrl: undefined,
      isEditing: false,
    };

    addPreviewItem(baseItem);
    setIsOutputGenerating(true);
    addLog('INFO', t.imageEditor.regenerateStarted.replace('{prompt}', item.prompt.slice(0, 60)));

    const countdownInterval = setInterval(() => {
      setPreviewItems((prev) => {
        const current = prev.find(i => i.id === operationId);
        if (!current || current.status !== 'running') {
          clearInterval(countdownInterval);
          return prev;
        }
        const newCountdown = (current.generatingCountdown ?? 0) - 1;
        if (newCountdown <= 0) {
          clearInterval(countdownInterval);
          addLog('ERROR', t.imageEditor.timeout || 'Image regeneration timeout (90s exceeded)');
          return prev.map(i => 
            i.id === operationId 
              ? { ...i, status: 'error', lastMessage: 'Timeout', generatingCountdown: undefined }
              : i
          );
        }
        return prev.map(i => 
          i.id === operationId 
            ? { ...i, generatingCountdown: newCountdown }
            : i
        );
      });
    }, 1000);

    try {
      const flowProjectId = window.localStorage.getItem('zeoStudio.workflow.flowProjectId') || '';
      const imgPayload = ingredientImages.length > 0
        ? ingredientImages.map((img) => ({ data: img.data, mimeType: img.mimeType }))
        : undefined;
      if (imgPayload) {
        addLog('INFO', `Uploading ${imgPayload.length} ingredient image(s) as reference...`);
        console.log('[ImageEditor] Regenerate - Ingredient images payload:', { count: imgPayload.length, sampleDataLength: imgPayload[0]?.data?.length });
      } else {
        console.log('[ImageEditor] Regenerate - No ingredient images to upload');
      }

      const res = await window.zeoAPI?.generateSingleImage?.({
        bearerKey,
        aspectRatio: ratio,
        imageResolution: 'default',
        outputFolder,
        flowProjectId,
        prompt: withLanguagePreference(item.prompt.trim()),
        ingredientImages: imgPayload,
      });

      if (!res?.ok) {
        updatePreviewItem(operationId, (curr) => ({ ...curr, status: 'error', lastMessage: res?.error || t.imageEditor.generateImageFailed, generatingCountdown: undefined }));
        addLog('ERROR', res?.error || t.imageEditor.generateImageFailed);
        return;
      }

      const modelLabel = friendlyModelName(res.modelUsed);
      updatePreviewItem(operationId, (curr) => ({
        ...curr,
        status: 'completed',
        mediaUrl: res.dataUrl || getFileUrl(res.filePath) || curr.mediaUrl, // Prefer Data URL
        dataUrl: res.dataUrl,
        generatingCountdown: undefined,
      }));
      addLog('SUCCESS', t.imageEditor.imageDone.replace('{file}', res.fileName || 'file').replace('{model}', modelLabel));
    } catch (err: any) {
      updatePreviewItem(operationId, (curr) => ({ ...curr, status: 'error', lastMessage: err?.message || String(err), generatingCountdown: undefined }));
      addLog('ERROR', `${t.imageEditor.failed}: ${err?.message || String(err)}`);
    } finally {
      setIsOutputGenerating(false);
      setRegeneratingId(null);
    }
  };

  const getFileUrl = (filePath?: string) => {
    if (!filePath) return undefined;
    const encoded = encodeURIComponent(filePath);
    return `http://localhost:3123/image?path=${encoded}`;
  };

  const startGenerationFromPrompt = async () => {
    if (!promptText.trim()) {
      addLog('ERROR', t.imageEditor.noResult);
      return;
    }

    const bearerKey = window.localStorage.getItem('zeoStudio.bearerToken') || '';
    const outputFolder = await ensureOutputFolder();

    if (!bearerKey.trim()) {
      addLog('ERROR', t.logMessages.common.bearerTokenMissing);
      return;
    }
    if (!outputFolder) return;

    const operationId = `${Date.now()}`;
    const baseItem: PreviewItem = {
      id: operationId,
      prompt: promptText.trim(),
      status: 'running',
      startedAt: Date.now(),
      estimatedTotalSeconds: 300,
      generatingCountdown: 300,
    };

    addPreviewItem(baseItem);
    addLog('INFO', t.imageEditor.generateStarted.replace('{prompt}', promptText.slice(0, 60)));
    setIsOutputGenerating(true);

    const countdownInterval = setInterval(() => {
      setPreviewItems((prev) => {
        const current = prev.find(item => item.id === operationId);
        if (!current || current.status !== 'running') {
          clearInterval(countdownInterval);
          return prev;
        }
        const newCountdown = (current.generatingCountdown ?? 0) - 1;
        if (newCountdown <= 0) {
          clearInterval(countdownInterval);
          addLog('ERROR', t.imageEditor.timeout || 'Image generation timeout (180s exceeded)');
          return prev.map(item => 
            item.id === operationId 
              ? { ...item, status: 'error', lastMessage: 'Timeout', generatingCountdown: undefined }
              : item
          );
        }
        return prev.map(item => 
          item.id === operationId 
            ? { ...item, generatingCountdown: newCountdown }
            : item
        );
      });
    }, 1000);

    try {
      const flowProjectId = window.localStorage.getItem('zeoStudio.workflow.flowProjectId') || '';
      const imgPayload = ingredientImages.length > 0
        ? ingredientImages.map((img) => ({ data: img.data, mimeType: img.mimeType }))
        : undefined;
      if (imgPayload) {
        addLog('INFO', `Uploading ${imgPayload.length} ingredient image(s) as reference...`);
        console.log('[ImageEditor] Ingredient images payload:', { count: imgPayload.length, sampleDataLength: imgPayload[0]?.data?.length });
      } else {
        console.log('[ImageEditor] No ingredient images to upload');
      }

      const res = await window.zeoAPI?.generateSingleImage?.({
        bearerKey,
        aspectRatio: ratio,
        imageResolution: 'default',
        outputFolder,
        flowProjectId,
        prompt: withLanguagePreference(promptText.trim()),
        ingredientImages: imgPayload,
      });

      // Debug response
      console.log('[ImageEditor] Generation response:', { ok: res.ok, hasDataUrl: !!res.dataUrl, filePath: res.filePath });

      if (!res?.ok) {
        updatePreviewItem(operationId, (item) => ({ ...item, status: 'error', lastMessage: res?.error || t.imageEditor.generateImageFailed, generatingCountdown: undefined }));
        addLog('ERROR', res?.error || t.imageEditor.generateImageFailed);
        return;
      }

      const modelLabel = friendlyModelName(res.modelUsed);
      updatePreviewItem(operationId, (item) => ({
        ...item,
        status: 'completed',
        mediaUrl: res.dataUrl || getFileUrl(res.filePath), // Prefer Data URL
        dataUrl: res.dataUrl,
        generatingCountdown: undefined,
      }));
      addLog('SUCCESS', t.imageEditor.imageDone.replace('{file}', res.fileName || 'file').replace('{model}', modelLabel));
    } catch (err: any) {
      updatePreviewItem(operationId, (item) => ({ ...item, status: 'error', lastMessage: err?.message || String(err), generatingCountdown: undefined }));
      addLog('ERROR', `${t.imageEditor.failed}: ${err?.message || String(err)}`);
    } finally {
      setIsOutputGenerating(false);
    }
  };


  const handleGenerateOrPreview = () => {
    if (!promptText.trim()) return;
    startGenerationFromPrompt();
  };

  const getRemainingSeconds = (item: PreviewItem): number | null => {
    if (!item.startedAt || !item.estimatedTotalSeconds) return null;
    const elapsed = Math.floor((now - item.startedAt) / 1000);
    return Math.max(0, item.estimatedTotalSeconds - elapsed);
  };

  const handleDownload = async (url?: string, fileName = 'image.png') => {
    if (!url) return;
    console.log('[ImageEditor] Downloading:', { fileName, urlLength: url.length, isDataUrl: url.startsWith('data:') });
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
      addLog('ERROR', t.imageEditor.failed + ': ' + String(err));
    }
  };

  return (
    <div className="h-full w-full flex flex-col min-h-0 text-gray-50">
      <PageHeader
        iconId="image-editor"
        iconClassName="h-6 w-6 mr-3 text-white"
        title={t.imageEditor.title}
        description={t.imageEditor.description}
        tutorialUrl={IMAGE_EDITOR_TUTORIAL_URL}
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
                  <div className="space-y-1">
                    <h3 className="text-[11px] font-semibold text-gray-200 tracking-wide">
                      {t.imageEditor.promptLabel}
                    </h3>
                    <p className="text-[10px] text-gray-500">{t.imageEditor.promptDescription}</p>
                    <textarea
                      value={promptText}
                      onChange={(e) => setPromptText(e.target.value)}
                      placeholder={t.imageEditor.promptPlaceholder}
                      className="w-full min-h-[120px] bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-gray-50 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 resize-y"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[11px] font-semibold text-gray-200 tracking-wide">
                        {t.imageEditor.ingredientImage}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500">{ingredientImages.length}/10</span>
                        <span className="text-[10px] text-gray-500 bg-zinc-800 px-2 py-0.5 rounded">{t.imageEditor.ingredientImageOptional}</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-500">{t.imageEditor.ingredientImageDesc}</p>

                    <div className="grid grid-cols-4 gap-2">
                      {ingredientImages.map((img, idx) => (
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
                            title={t.imageEditor.removeFile}
                          >
                            ×
                          </button>
                          <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-[8px] text-gray-300 px-1 py-0.5 truncate">
                            {img.name}
                          </span>
                        </div>
                      ))}
                      {ingredientImages.length < 10 && (
                        <label className="aspect-square rounded-lg border border-dashed border-zinc-700 cursor-pointer hover:border-purple-500/70 transition-colors flex flex-col items-center justify-center text-gray-400 hover:text-purple-400 bg-zinc-900/50">
                          <input
                            ref={ingredientFileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={handleIngredientFileSelect}
                          />
                          <span className="text-xl leading-none">+</span>
                          <span className="text-[8px] mt-1">{t.imageEditor.uploadImage}</span>
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-[11px] font-semibold text-gray-200 tracking-wide">
                      {t.imageEditor.ratioLabel}
                    </h3>
                    <div className="flex rounded-lg border border-zinc-800 overflow-hidden bg-zinc-900">
                      {([
                        { key: '16:9' as const, label: t.imageEditor.ratio169 },
                        { key: '9:16' as const, label: t.imageEditor.ratio918 },
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
                  aria-label={t.imageEditor.generateButton}
                >
                  {isOutputGenerating
                    ? t.imageEditor.processingBtn
                    : t.imageEditor.generateButton}
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
                              setActivityLogCopyLabel(t.imageEditor.copied);
                              setTimeout(() => setActivityLogCopyLabel(t.activityLog.copyLog), 1200);
                            })
                            .catch(() => {
                              setActivityLogCopyLabel(t.imageEditor.copyFailedLabel);
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
              width: `${cardDimensions.preview}px`,
              backgroundColor: '#181818',
              backgroundImage:
                'linear-gradient(135deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.1) 75%, transparent 75%, transparent), linear-gradient(45deg, rgba(255,255,255,0.08) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.08) 75%, transparent 75%, transparent), linear-gradient(0deg, rgba(0,0,0,0.24), rgba(0,0,0,0.24))',
              backgroundSize: '12px 12px, 12px 12px, 100% 100%',
              backgroundBlendMode: 'overlay, overlay, normal',
            }}
          >
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-50">{t.imageEditor.previewTitle}</h3>
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
              {isOutputGenerating && previewItems.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950/40 rounded-lg text-gray-500 text-center p-6">
                  <GradientLoader
                    size="md"
                    text={t.imageEditor.processing}
                    subtitle="Mohon tunggu"
                  />
                </div>
              ) : previewItems.length === 0 ? (
                <div className="flex-1 flex items-center justify-center bg-zinc-950/40 rounded-lg text-gray-500 text-center text-xs p-4">
                  <p>{t.imageEditor.noResult}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-4">
                    {previewItems.map((item) => {
                      const isRegeneratingCurrent = regeneratingId === item.id;
                      const isAnyRegenerating = !!regeneratingId;
                      if (item.status === 'running') {
                        return (
                          <div key={item.id} className="border border-zinc-800 bg-zinc-950/60 rounded-xl overflow-hidden shadow-sm min-h-[700px] flex flex-col items-center justify-center gap-3">
                            <GradientLoader
                              size="sm"
                              text={t.imageEditor.processing}
                              subtitle="Mohon tunggu"
                            />
                            {item.generatingCountdown !== undefined && item.generatingCountdown > 0 && (
                              <div className="text-gray-300 text-sm font-semibold">
                                ⏱️ ~{item.generatingCountdown}s remaining
                              </div>
                            )}
                          </div>
                        );
                      }
                      return (
                        <div
                          key={item.id}
                          className="border border-zinc-800 bg-zinc-950/60 rounded-xl overflow-visible shadow-sm min-h-[700px]"
                        >
                          <div className="p-4 pb-6 space-y-3">
                            <div className="flex items-center gap-2 text-[11px] text-gray-400">
                              <span className="px-2 py-0.5 rounded-md border border-zinc-700 text-gray-200 uppercase tracking-wide">
                                {t.imageEditor.typeImage}
                              </span>
                              <span className="text-gray-500">{new Date(Number(item.id)).toLocaleTimeString(language === 'ms' ? 'ms-MY' : language === 'id' ? 'id-ID' : 'en-US', { hour12: false })}</span>
                              <span
                                className={`px-2 py-0.5 rounded-md border text-[10px] ${
                                  item.status === 'completed'
                                    ? 'border-emerald-500 text-emerald-300'
                                    : item.status === 'error'
                                    ? 'border-red-500 text-red-300'
                                    : 'border-yellow-400 text-yellow-200'
                                }`}
                              >
                                {item.status === 'completed'
                                  ? t.imageEditor.statusCompleted
                                  : item.status === 'error'
                                  ? t.imageEditor.statusError
                                  : t.imageEditor.statusRunning}
                              </span>
                              {item.status === 'running' && getRemainingSeconds(item) !== null && (
                                <span className="text-[10px] text-gray-400">ETA {getRemainingSeconds(item)}s</span>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="flex flex-col">
                                <span className="text-[10px] font-semibold text-gray-300 mb-1 uppercase tracking-wide">{t.imageEditor.beforeLabel}</span>
                                <div
                                  className="relative flex-1 bg-zinc-900/60 border border-zinc-800 rounded-lg flex items-center justify-center min-h-[200px] max-h-[520px] cursor-pointer overflow-hidden"
                                  onClick={() => (item.dataUrl || item.mediaUrl) && setSelectedPreview(item)}
                                >
                                  {(item.dataUrl || item.mediaUrl) ? (
                                    <img src={item.dataUrl || item.mediaUrl} alt="before" className="w-full max-h-[520px] rounded-lg object-contain" />
                                  ) : (
                                    <span className="text-[11px] text-gray-500">
                                      {item.status === 'running' ? t.imageEditor.processing : t.imageEditor.noResult}
                                    </span>
                                  )}
                                  {(item.dataUrl || item.mediaUrl) && (
                                    <div className="absolute inset-0 flex items-end justify-end p-2 pointer-events-none">
                                      <div className="flex items-center gap-2 pointer-events-auto">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDownload(item.dataUrl || item.mediaUrl, 'before-image.png');
                                          }}
                                          className="px-3 py-1 rounded-lg text-white text-[10px] font-semibold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 btn-glass-primary shadow-lg transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_10px_30px_rgba(99,102,241,0.35)] focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:opacity-60"
                                        >
                                          {t.buttons.download}
                                        </button>
                                        {!item.isApplied && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              regenerateFromItem(item);
                                            }}
                                            className="px-3 py-1 rounded-lg text-white text-[10px] font-semibold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 btn-glass-primary shadow-lg transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_10px_30px_rgba(251,146,60,0.35)] focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:opacity-60"
                                          >
                                            {t.imageEditor.regenerateBtn}
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex flex-col">
                                <span className="text-[10px] font-semibold text-gray-300 mb-1 uppercase tracking-wide">{t.imageEditor.afterLabel}</span>
                                <div
                                  className="relative flex-1 bg-zinc-900/60 border border-zinc-800 rounded-lg flex items-center justify-center min-h-[200px] max-h-[520px] overflow-hidden"
                                >
                                  {item.isEditRunning ? (
                                    <GradientLoader
                                      size="sm"
                                      text={t.imageEditor.editProcessing}
                                      mode="spinner-only"
                                    />
                                  ) : item.afterMediaUrl ? (
                                    <img src={item.afterMediaUrl} alt="after" className="w-full max-h-[520px] rounded-lg object-contain" />
                                  ) : (
                                    <span className="text-[11px] text-gray-500">{t.imageEditor.afterPlaceholder}</span>
                                  )}
                                  {item.afterMediaUrl && (
                                    <div className="absolute inset-0 flex items-end justify-end p-2 pointer-events-none">
                                      <div className="flex items-center gap-2 pointer-events-auto">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDownload(item.afterMediaUrl, 'after-image.png');
                                          }}
                                          className="px-3 py-1 rounded-lg text-white text-[10px] font-semibold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 btn-glass-primary shadow-lg transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_10px_30px_rgba(99,102,241,0.35)] focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:opacity-60"
                                        >
                                          {t.buttons.download}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleApplyImage(item);
                                          }}
                                          className="px-3 py-1 rounded-lg text-white text-[10px] font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 btn-glass-primary shadow-lg transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_10px_30px_rgba(16,185,129,0.35)] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:opacity-60"
                                        >
                                          {t.buttons.apply}
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {item.status === 'completed' && item.mediaUrl && (
                              <div className="space-y-2 pt-1">
                                <label className="text-[11px] font-semibold text-gray-200">{t.imageEditor.editInstructionLabel}</label>
                                <textarea
                                  value={editInstructions[item.id] || ''}
                                  onChange={(e) => setEditInstructions((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                  onClick={(e) => e.stopPropagation()}
                                  placeholder={t.imageEditor.editPlaceholder}
                                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-gray-50 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 resize-y min-h-[64px]"
                                  rows={2}
                                />
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleEditImage(item); }}
                                    disabled={item.isEditRunning || !(editInstructions[item.id] || '').trim()}
                                    className="px-4 py-2 rounded-lg text-white text-xs font-semibold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 btn-glass-primary shadow-lg transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_10px_30px_rgba(99,102,241,0.35)] focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:opacity-60 disabled:cursor-not-allowed"
                                  >
                                    {item.isEditRunning ? t.imageEditor.editProcessing : t.imageEditor.editBtn}
                                  </button>
                                </div>
                              </div>
                            )}

                            {item.lastMessage && item.status === 'error' && (
                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-red-300">
                                <span>{item.lastMessage}</span>
                                <button
                                  type="button"
                                  className="px-2 py-0.5 rounded-md border border-amber-500 text-amber-200 hover:bg-amber-500/10"
                                  onClick={() => regenerateFromItem(item)}
                                >
                                  {t.imageEditor.regenerateBtn}
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
            <p>{t.imageEditor.clearData}</p>
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

      <Modal
        isOpen={!!selectedPreview}
        onClose={() => setSelectedPreview(null)}
        title={selectedPreview ? t.imageEditor.previewImageTitle : ''}
        message={
          selectedPreview ? (
            <div className="space-y-3 max-w-[480px]">
              <div className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex items-center justify-center">
                {(selectedPreview.dataUrl || selectedPreview.mediaUrl) ? (
                  <img src={selectedPreview.dataUrl || selectedPreview.mediaUrl} alt="preview" className="w-full max-h-[35vh] object-contain rounded-lg" />
                ) : (
                  <p className="text-sm text-gray-300">{t.imageEditor.processing}</p>
                )}
              </div>
              <div className="space-y-1 text-sm text-gray-100">
                <div className="flex items-center gap-2 text-[11px] text-gray-400">
                  <span className="px-2 py-0.5 rounded-md border border-zinc-700 text-gray-200 uppercase tracking-wide">
                    {t.imageEditor.typeImage}
                  </span>
                  <span className="text-gray-500">{new Date(Number(selectedPreview.id)).toLocaleTimeString(language === 'ms' ? 'ms-MY' : language === 'id' ? 'id-ID' : 'en-US', { hour12: false })}</span>
                  <span
                    className={`px-2 py-0.5 rounded-md border text-[10px] ${
                      selectedPreview.status === 'completed'
                        ? 'border-emerald-500 text-emerald-300'
                        : selectedPreview.status === 'error'
                        ? 'border-red-500 text-red-300'
                        : 'border-yellow-400 text-yellow-200'
                    }`}
                  >
                    {selectedPreview.status === 'completed'
                      ? t.imageEditor.statusCompleted
                      : selectedPreview.status === 'error'
                      ? t.imageEditor.statusError
                      : t.imageEditor.statusRunning}
                  </span>
                </div>
                <textarea
                  value={selectedPreview.isEditing ? editedPrompt : selectedPreview.prompt}
                  onFocus={() => {
                    handleStartEdit(selectedPreview.id, selectedPreview.prompt);
                    setSelectedPreview((prev) => (prev ? { ...prev, isEditing: true } : null));
                  }}
                  onChange={(e) => setEditedPrompt(e.target.value)}
                  onBlur={() => {
                    handleBlurEdit(selectedPreview.id);
                    setSelectedPreview((prev) => (prev ? { ...prev, isEditing: false } : null));
                  }}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-gray-50 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                  style={{ minHeight: '22vh' }}
                />
                {selectedPreview.lastMessage && selectedPreview.status === 'error' && (
                  <p className="text-[11px] text-red-300">{selectedPreview.lastMessage}</p>
                )}
              </div>
            </div>
          ) : undefined
        }
        confirmButtonText={t.common.close}
        onConfirm={() => setSelectedPreview(null)}
      />
    </div>
  );
};

export default ImageEditorPage;
