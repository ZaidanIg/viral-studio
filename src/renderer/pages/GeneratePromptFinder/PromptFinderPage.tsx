// src/pages/GeneratePromptFinder/PromptFinderPage.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';

import Modal from '../../shared/components/Modal';
import PageHeader from '../../shared/components/PageHeader';
import GradientLoader from '../../shared/components/GradientLoader';
import { useImageResolution } from '../../shared/utils/useImageResolution';
import { useLanguage } from '../../shared/i18n';

export const PromptFinderPageHeaderIcon: React.FC = () => (
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
  mediaUrl?: string;
  type: TabKey;
  status: 'running' | 'completed' | 'error';
  lastMessage?: string;
  startedAt?: number;
  estimatedTotalSeconds?: number;
  isEditing?: boolean;
};

type TabKey = 'image' | 'video';

const PROMPT_FINDER_TUTORIAL_URL = 'https://www.youtube.com/embed/VNotztQdCHw?autoplay=1&mute=1&origin=http://localhost:3000';

const PromptFinderPage: React.FC = () => {
  const { t, language } = useLanguage();
  const [imageResolution] = useImageResolution();

  // Calculate fixed card dimensions based on resolution
  const cardDimensions = imageResolution === '1366x768' 
    ? { parameter: 427, preview: 907 }
    : { parameter: 599, preview: 1273 };

  const [activeTab, setActiveTab] = useState<TabKey>('image');
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [resultText, setResultText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [activityLogCopyLabel, setActivityLogCopyLabel] = useState(t.activityLog.copyLog);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [shouldAutoGenerate, setShouldAutoGenerate] = useState(false);
  const [ratio, setRatio] = useState<'16:9' | '9:16'>('16:9');
  const [model, setModel] = useState<'veo-fast' | 'nano-pro'>('nano-pro');
  const [startedByButton, setStartedByButton] = useState(false);
  const [previewSpinnerActive, setPreviewSpinnerActive] = useState(false);
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const [now, setNow] = useState<number>(Date.now());
  const [isOutputGenerating, setIsOutputGenerating] = useState(false);
  const [selectedPreview, setSelectedPreview] = useState<PreviewItem | null>(null);
  const [editedPrompt, setEditedPrompt] = useState('');
  const [promptCount, setPromptCount] = useState('5');
  const [promptMode, setPromptMode] = useState<'similar' | 'variant'>('similar');
  const [promptFileName, setPromptFileName] = useState('prompt-finder.txt');
  const [isPromptBatchRunning, setIsPromptBatchRunning] = useState(false);
  const [batchSummary, setBatchSummary] = useState<{ file: string; count: number; mode: 'similar' | 'variant'; folder: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [batchPage, setBatchPage] = useState(1);
  const [batchPrompts, setBatchPrompts] = useState<{ index: number; prompt: string; rawPrompt?: string; notes?: string }[]>([]);
  const [successModalMessage, setSuccessModalMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setActivityLogCopyLabel(t.activityLog.copyLog);
  }, [t.activityLog.copyLog]);

  useEffect(() => {
    setStartedByButton(false);
    setPreviewSpinnerActive(false);
  }, [fileData]);

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
    if (typeof window === 'undefined' || !window.zeoAPI?.onBatchUpdate) return undefined;

    const unsubscribe = window.zeoAPI.onBatchUpdate?.((update: any) => {
      if (!update) return;
      const workflow = String(update.workflow || '').toLowerCase();
      if (workflow !== 'prompt generator') return;

      const rawMessage: string = update.message || '';
      if (update.type === 'INFO' && rawMessage) {
        addLog('INFO', rawMessage);
        return;
      }

      if (update.type === 'ERROR') {
        if (rawMessage) addLog('ERROR', rawMessage);
        setIsPromptBatchRunning(false);
        setToast({ message: rawMessage || t.promptFinder.generatePromptFailed, type: 'error' });
        return;
      }

      if (update.type === 'PROMPT_PREVIEW_RESET') {
        const totalCount = typeof update.total === 'number' ? update.total : null;
        if (totalCount && batchSummary) {
          setBatchSummary({ ...batchSummary, count: totalCount });
        }
        setBatchPrompts([]);
        setBatchPage(1);
        return;
      }

      if (update.type === 'PROMPT_PREVIEW') {
        const index = typeof update.index === 'number' ? update.index : 0;
        const promptText: string = update.prompt || '';
        const rawPrompt: string | undefined = update.rawPrompt;
        const notes: string | undefined = update.notes;

        if (index <= 0) return;

        // Debug log for tracing prompt previews
        addLog('INFO', `Preview prompt #${index}: ${promptText.slice(0, 60)}${promptText.length > 60 ? '...' : ''}`);

        setBatchPrompts((prev) => {
          const next = prev.filter((p) => p.index !== index);
          next.push({ index, prompt: promptText || t.promptFinder.emptyPrompt, rawPrompt, notes });
          return next.sort((a, b) => a.index - b.index);
        });
        return;
      }

      if (update.type === 'PROGRESS') {
        if (typeof update.message === 'string' && update.message) addLog('INFO', update.message);
        return;
      }

      if (update.type === 'BATCH_COMPLETE') {
        setIsPromptBatchRunning(false);
        const successCount = typeof update.successCount === 'number' ? update.successCount : null;
        const totalCount = typeof update.totalCount === 'number' ? update.totalCount : null;
        if (successCount !== null && totalCount !== null) {
          setBatchSummary((prev) => {
            if (!prev) return prev;
            return { ...prev, count: totalCount };
          });
          setToast({ message: `${t.promptFinder.generatePromptDoneModal} (${successCount}/${totalCount})`, type: 'success' });
        }
      }
    });

    return unsubscribe;
  }, [addLog, batchSummary]);

  const renderBatchList = () => null;

  const handleGeneratePromptBatch = async () => {
    if (!resultText.trim()) {
      addLog('ERROR', t.promptFinder.noAnalysisPrompt);
      return;
    }

    const total = parseInt(promptCount || '0', 10) || 0;
    if (total <= 0 || total > 1000) {
      addLog('ERROR', t.promptFinder.promptCountRange);
      return;
    }

    const bearerToken = window.localStorage.getItem('zeoStudio.bearerToken') || '';
    const apiKey = window.localStorage.getItem('zeoStudio.ai.apiKey') || '';
    if (!bearerToken.trim()) {
      addLog('ERROR', t.logMessages.common.bearerTokenMissing);
      return;
    }
    if (!apiKey.trim()) {
      addLog('ERROR', t.logMessages.common.apiKeyMissing);
      return;
    }

    const folderOutput = await ensureOutputFolder();
    if (!folderOutput) return;

    const finalFileName = ensureTxtFileName(promptFileName);
    setPromptFileName(finalFileName);

    if (!window.zeoAPI?.startPromptBatch) {
      addLog('ERROR', t.logMessages.common.engineNotAvailable);
      return;
    }

    setIsPromptBatchRunning(true);
    addLog('INFO', t.promptFinder.generatePromptStarted.replace('{count}', String(total)).replace('{mode}', promptMode));
    setBatchPrompts([]);
    setBatchPage(1);

    try {
      await window.zeoAPI.startPromptBatch({
        config: {
          bearerToken,
          folderOutput,
          aiProvider: 'Gemini',
          apiKey,
        },
        options: {
          promptType: 'photo',
          jumlahPrompt: String(total),
          promptFileName: finalFileName,
          autoOpen: false,
          characterSourcePrompt: withLanguagePreference(resultText.trim()),
          promptMode: promptMode === 'variant' ? 'independent' : 'continuous',
          language: [language.toLowerCase()],
        },
      });
      addLog('SUCCESS', t.promptFinder.generatePromptDone.replace('{file}', finalFileName));
      setBatchSummary({ file: finalFileName, count: total, mode: promptMode, folder: folderOutput });
      setSuccessModalMessage(t.promptFinder.generatePromptSuccess.replace('{path}', `${folderOutput}\\${finalFileName}`));
    } catch (err: any) {
      addLog('ERROR', err?.message || t.promptFinder.generatePromptFailed);
      setToast({ message: err?.message || t.promptFinder.generatePromptFailed, type: 'error' });
    } finally {
      setIsPromptBatchRunning(false);
    }
  };

  useEffect(() => {
    if (shouldAutoGenerate && fileData && !isGenerating) {
      handleGenerate('auto');
      setShouldAutoGenerate(false);
    }
  }, [shouldAutoGenerate, fileData, isGenerating]);

  // Auto-hide toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!error) return;
    const timeout = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(timeout);
  }, [error]);

  const resetAll = () => {
    setFileData(null);
    setResultText('');
    setError(null);
    setActivityLogs([]);
    setActivityLogCopyLabel(t.activityLog.copyLog);
    setStartedByButton(false);
    setPreviewSpinnerActive(false);
    setPreviewItems([]);
    setIsOutputGenerating(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleTabChange = (tab: TabKey) => {
    if (activeTab === tab) return;
    setActiveTab(tab);
    if (tab === 'video') {
      setRatio('16:9');
      setModel('veo-fast');
    } else {
      setRatio('16:9');
      setModel('nano-pro');
    }
    resetAll();
  };

  const handleFileSelect: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if ((activeTab === 'image' && !isImage) || (activeTab === 'video' && !isVideo)) {
      addLog('ERROR', t.promptFinder.invalidFileType);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result || '');
      const split = base64.split(',');
      const data = split.length > 1 ? split[1] : split[0];
      setFileData({
        mimeType: file.type,
        data,
        previewUrl: `data:${file.type};base64,${data}`,
        name: file.name,
        size: file.size,
      });
      addLog('INFO', t.promptFinder.fileLoaded.replace('{name}', file.name));
      setStartedByButton(false);
      setPreviewSpinnerActive(false);
      setShouldAutoGenerate(true);
    };
    reader.onerror = () => {
      addLog('ERROR', t.promptFinder.fileReadError);
    };
    reader.readAsDataURL(file);
  };

  const removeFile = () => {
    setFileData(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setResultText('');
    setStartedByButton(false);
    setPreviewSpinnerActive(false);
  };

  const apiEndpoint = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const modelId = (window.localStorage.getItem('zeoStudio.ai.model') || 'gemini-1.5-pro-latest').trim();
    const apiKey = window.localStorage.getItem('zeoStudio.ai.apiKey') || '';
    return apiKey ? `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}` : '';
  }, []);

  const sanitizeGeneratedPrompt = (raw: string): string => {
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .filter((l) => {
        const lower = l.toLowerCase();
        if (lower.startsWith('rasio:') || lower.startsWith('model:') || lower.startsWith('prompt deskriptif:')) return false;
        if (lower.startsWith('**rasio:**') || lower.startsWith('**model:**') || lower.startsWith('**prompt deskriptif:**')) return false;
        if (lower.startsWith('ratio:') || lower.startsWith('aspect ratio:')) return false;
        return true;
      });
    if (lines.length > 1) {
      const first = lines[0].toLowerCase();
      if (
        first.includes('berikut adalah prompt') ||
        first.includes('prompt deskriptif') ||
        first.includes('berikut adalah deskripsi') ||
        first.includes('here is a prompt') ||
        first.includes('here is the prompt') ||
        first.startsWith('prompt:')
      ) {
        lines.shift();
      }
    }
    return lines.join('\n').trim();
  };

  const buildPrompt = (): { text: string } | null => {
    if (!fileData) return null;
    const baseInstruction =
      activeTab === 'image'
        ? t.promptFinder.instructionImage
        : t.promptFinder.instructionVideo;

    const extras: string[] = [];
    if (ratio) extras.push(`${t.promptFinder.ratioLabel}: ${ratio}`);
    extras.push(
      `${t.promptFinder.modelLabel}: ${model === 'veo-fast' ? t.promptFinder.modelVeoFast : t.promptFinder.modelNanoPro}`,
    );
    extras.push(`${t.promptFinder.languageLabel}: ${language}`);
    const extraText = extras.join('\n');

    return {
      text: `${baseInstruction}\n${extraText}\n${t.promptFinder.textInstruction}`,
    };
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
      addLog('INFO', t.promptFinder.usingGlobalFolder.replace('{folder}', outputFolder));
      return outputFolder;
    }

    if (typeof window !== 'undefined' && window.zeoAPI?.selectFolder) {
      addLog('INFO', t.promptFinder.selectingFolder);
      const picked = await window.zeoAPI.selectFolder({ title: t.promptFinder.selectFolderTitle });
      if (picked && !picked.canceled && picked.path) {
        outputFolder = picked.path;
        try {
          window.localStorage.setItem('zeoStudio.folder.output', outputFolder);
          window.localStorage.setItem('zeoStudio.folder.output.lastSaved', outputFolder);
        } catch {
          /* ignore */
        }
        addLog('SUCCESS', t.promptFinder.folderSet.replace('{folder}', outputFolder));
        return outputFolder;
      }
    }
    addLog('ERROR', t.promptFinder.folderNotConfigured);
    return null;
  };

  const ensureTxtFileName = (name: string) => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const datePrefix = `${yyyy}${mm}${dd}`;
    const base = name.trim() || 'prompt-finder';
    const sanitizedBase = base.replace(/[^a-zA-Z0-9-_]+/g, '_');
    const withDate = `${datePrefix}_${sanitizedBase || 'prompt-finder'}`;
    return withDate.toLowerCase().endsWith('.txt') ? withDate : `${withDate}.txt`;
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
      ? t.promptFinder.languageInstructionId
      : t.promptFinder.languageInstructionOther.replace('{lang}', lang);

    return `${prompt}\n\n${instruction}`;
  };

  const regenerateFromItem = async (item: PreviewItem) => {
    if (!item.prompt.trim()) return;
    const bearerKey = window.localStorage.getItem('zeoStudio.bearerToken') || '';
    const outputFolder = await ensureOutputFolder();
    if (!bearerKey.trim()) {
      addLog('ERROR', t.logMessages.common.bearerTokenMissing);
      return;
    }
    if (!outputFolder) return;

    const operationId = `${Date.now()}`;
    const estimatedTotalSeconds = 300;
    const baseItem: PreviewItem = {
      ...item,
      id: operationId,
      status: 'running',
      startedAt: Date.now(),
      estimatedTotalSeconds,
      lastMessage: undefined,
      mediaUrl: undefined,
      isEditing: false,
    };

    addPreviewItem(baseItem);
    setIsOutputGenerating(true);
    addLog('INFO', t.promptFinder.regenerateStarted.replace('{type}', item.type).replace('{prompt}', item.prompt.slice(0, 60)));

    try {
      if (item.type === 'image') {
        const res = await window.zeoAPI?.generateSingleImage?.({
          bearerKey,
          aspectRatio: ratio,
          imageResolution: 'default',
          outputFolder,
          prompt: withLanguagePreference(item.prompt.trim()),
        });

        if (!res?.ok) {
          updatePreviewItem(operationId, (curr) => ({ ...curr, status: 'error', lastMessage: res?.error || t.promptFinder.generateImageFailed }));
          addLog('ERROR', res?.error || t.promptFinder.generateImageFailed);
          return;
        }

        updatePreviewItem(operationId, (curr) => ({
          ...curr,
          status: 'completed',
          mediaUrl: getFileUrl(res.filePath) || curr.mediaUrl,
        }));
        addLog('SUCCESS', t.promptFinder.imageDone.replace('{file}', res.fileName || 'file'));
      } else {
        const res = await window.zeoAPI?.generateSingleVideo?.({
          bearerKey,
          aspectRatio: ratio,
          veoModel: model === 'veo-fast' ? 'VEO 3.1 Fast (Low Priority)' : model,
          downloadPath: outputFolder,
          prompt: item.prompt.trim(),
        });

        if (!res?.ok) {
          updatePreviewItem(operationId, (curr) => ({ ...curr, status: 'error', lastMessage: res?.error || t.promptFinder.generateVideoFailed }));
          addLog('ERROR', res?.error || t.promptFinder.generateVideoFailed);
          return;
        }

        updatePreviewItem(operationId, (curr) => ({
          ...curr,
          status: 'completed',
          mediaUrl: getFileUrl(res.filePath) || curr.mediaUrl,
        }));
        addLog('SUCCESS', t.promptFinder.videoDone.replace('{file}', res.fileName || 'file'));
      }
    } catch (err: any) {
      updatePreviewItem(operationId, (curr) => ({ ...curr, status: 'error', lastMessage: err?.message || String(err) }));
      addLog('ERROR', `${t.promptFinder.failed}: ${err?.message || String(err)}`);
    } finally {
      setIsOutputGenerating(false);
    }
  };

  const getFileUrl = (filePath?: string) => {
    if (!filePath) return undefined;
    const encoded = encodeURIComponent(filePath);
    return `http://localhost:3123/${activeTab === 'video' ? 'video' : 'image'}?path=${encoded}`;
  };

  const startGenerationFromPrompt = async () => {
    if (!fileData || !resultText.trim()) {
      addLog('ERROR', t.promptFinder.noResult);
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
    const estimatedTotalSeconds = activeTab === 'video' ? 120 : 90;
    const baseItem: PreviewItem = {
      id: operationId,
      prompt: resultText.trim(),
      type: activeTab,
      status: 'running',
      startedAt: Date.now(),
      estimatedTotalSeconds,
    };

    addPreviewItem(baseItem);
    addLog('INFO', t.promptFinder.generateStarted.replace('{type}', activeTab).replace('{prompt}', resultText.slice(0, 60)));
    setIsOutputGenerating(true);

    try {
      if (activeTab === 'image') {
        const res = await window.zeoAPI?.generateSingleImage?.({
          bearerKey,
          aspectRatio: ratio,
          imageResolution: 'default',
          outputFolder,
          prompt: withLanguagePreference(resultText.trim()),
        });

        if (!res?.ok) {
          updatePreviewItem(operationId, (item) => ({ ...item, status: 'error', lastMessage: res?.error || t.promptFinder.generateImageFailed }));
          addLog('ERROR', res?.error || t.promptFinder.generateImageFailed);
          return;
        }

        updatePreviewItem(operationId, (item) => ({
          ...item,
          status: 'completed',
          mediaUrl: getFileUrl(res.filePath) || item.mediaUrl,
        }));
        addLog('SUCCESS', t.promptFinder.imageDone.replace('{file}', res.fileName || 'file'));
      } else {
        const res = await window.zeoAPI?.generateSingleVideo?.({
          bearerKey,
          aspectRatio: ratio,
          veoModel: model === 'veo-fast' ? 'VEO 3.1 Fast (Low Priority)' : model,
          downloadPath: outputFolder,
          prompt: withLanguagePreference(resultText.trim()),
        });

        if (!res?.ok) {
          updatePreviewItem(operationId, (item) => ({ ...item, status: 'error', lastMessage: res?.error || t.promptFinder.generateVideoFailed }));
          addLog('ERROR', res?.error || t.promptFinder.generateVideoFailed);
          return;
        }

        updatePreviewItem(operationId, (item) => ({
          ...item,
          status: 'completed',
          mediaUrl: getFileUrl(res.filePath) || item.mediaUrl,
        }));
        addLog('SUCCESS', t.promptFinder.videoDone.replace('{file}', res.fileName || 'file'));
      }
    } catch (err: any) {
      updatePreviewItem(operationId, (item) => ({ ...item, status: 'error', lastMessage: err?.message || String(err) }));
      addLog('ERROR', `${t.promptFinder.failed}: ${err?.message || String(err)}`);
    } finally {
      setIsOutputGenerating(false);
    }
  };

  const handleGenerate = async (source: 'auto' | 'button' = 'button') => {
    if (!fileData) {
      addLog('ERROR', t.promptFinder.noFile);
      return;
    }
    if (typeof window === 'undefined') {
      addLog('ERROR', t.logMessages.common.engineNotAvailable);
      return;
    }
    const byButton = source === 'button';
    setStartedByButton(byButton);
    setPreviewSpinnerActive(byButton);
    addLog(
      'INFO',
      t.promptFinder.startProcess.replace('{type}', activeTab).replace('{ratio}', ratio).replace('{model}', model === 'veo-fast' ? 'VEO 3.1 Fast' : 'Nano Banana Pro'),
    );
    const apiKey = window.localStorage.getItem('zeoStudio.ai.apiKey') || '';
    const provider = window.localStorage.getItem('zeoStudio.ai.provider') || '';

    if (!apiKey || provider !== 'Gemini') {
      addLog('ERROR', t.logMessages.ai.configIncomplete);
      return;
    }
    if (!apiEndpoint) {
      addLog('ERROR', t.logMessages.ai.requestFailed);
      return;
    }

    setIsGenerating(true);
    setError(null);
    addLog('INFO', `File: ${fileData.name} (${(fileData.size / 1024 / 1024).toFixed(2)} MB)`);
    addLog('INFO', t.promptFinder.sendingToGemini);
    const instruction = buildPrompt();
    if (!instruction) return;

    setIsGenerating(true);
    setResultText('');
    addLog('INFO', t.promptFinder.generating);

    try {
      const payload = {
        contents: [
          {
            parts: [
              { text: withLanguagePreference(instruction.text) },
              { inlineData: { mimeType: fileData.mimeType, data: fileData.data } },
            ],
          },
        ],
        generationConfig: { temperature: 0.35, maxOutputTokens: 2048 },
      };

      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const statusMessage = res.status === 503 ? t.promptFinder.aiBusy : res.statusText || 'Request failed';
        addLog('ERROR', `${t.promptFinder.failed}: ${res.status} ${statusMessage}`);
        return;
      }

      const json = await res.json();
      let text: string = json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join(' ') || '';
      text = sanitizeGeneratedPrompt(text || '');

      if (!text) {
        addLog('ERROR', t.promptFinder.emptyResult);
        return;
      }

      setResultText(text.trim());
      addLog('SUCCESS', `${t.promptFinder.success} | ${t.promptFinder.charLength.replace('{length}', String(text.trim().length))}`);
      setTimeout(() => {
        const resultSection = document.getElementById('prompt-finder-result');
        resultSection?.scrollTo({ top: 0, behavior: 'smooth' });
      }, 150);
    } catch (err: any) {
      addLog('ERROR', `${t.promptFinder.failed}: ${err?.message || String(err)}`);
    } finally {
      setIsGenerating(false);
      setPreviewSpinnerActive(false);
    }
  };

  const handleGenerateOrPreview = () => {
    if (resultText.trim() && fileData && !isGenerating && !isOutputGenerating) {
      startGenerationFromPrompt();
      return;
    }
    handleGenerate('button');
  };

  const getRemainingSeconds = (item: PreviewItem): number | null => {
    if (!item.startedAt || !item.estimatedTotalSeconds) return null;
    const elapsed = Math.floor((now - item.startedAt) / 1000);
    return Math.max(0, item.estimatedTotalSeconds - elapsed);
  };

  const handleCopyResult = () => {
    if (!resultText) return;
    navigator.clipboard
      .writeText(resultText)
      .then(() => {
        setActivityLogCopyLabel(t.promptFinder.copied);
        setTimeout(() => setActivityLogCopyLabel(t.activityLog.copyLog), 1200);
        addLog('SUCCESS', t.promptFinder.copySuccess);
      })
      .catch(() => {
        addLog('ERROR', t.promptFinder.copyFailed);
      });
  };

  return (
    <div className="h-full w-full flex flex-col min-h-0 text-gray-50">
      <PageHeader
        iconId="prompt-finder"
        iconClassName="h-6 w-6 mr-3 text-white"
        title={t.promptFinder.title}
        description={t.promptFinder.description}
        showBearerTest={true}
        tutorialUrl={PROMPT_FINDER_TUTORIAL_URL}
        tutorialTitle="Tutorial Prompt Finder"
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
            <div className="flex flex-col h-full">
              <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar px-6 py-4 space-y-4">
              <div className="space-y-2">
                <h3 className="text-[11px] font-semibold text-gray-200 tracking-wide">
                  {t.promptFinder.mode}
                </h3>
                <div className="flex bg-zinc-800/60 border border-zinc-700 rounded-lg p-1">
                  <button
                    type="button"
                    className={`flex-1 py-2 px-3 text-xs font-semibold rounded-md transition-colors ${
                      activeTab === 'image'
                        ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                        : 'text-gray-300 hover:text-white'
                    }`}
                    onClick={() => handleTabChange('image')}
                  >
                    {t.promptFinder.tabImage}
                  </button>
                  <button
                    type="button"
                    className={`flex-1 py-2 px-3 text-xs font-semibold rounded-md transition-colors ${
                      activeTab === 'video'
                        ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                        : 'text-gray-300 hover:text-white'
                    }`}
                    onClick={() => handleTabChange('video')}
                  >
                    {t.promptFinder.tabVideo}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-[11px] font-semibold text-gray-200 tracking-wide">
                      {activeTab === 'image' ? t.promptFinder.uploadImage : t.promptFinder.uploadVideo}
                    </h3>
                    <p className="text-[11px] text-gray-500">
                      {t.promptFinder.uploadDescription}
                    </p>
                  </div>
                  <span className="text-[10px] text-gray-500">{t.promptFinder.uploadLimit}</span>
                </div>

                <div className="grid grid-cols-[120px,1fr] gap-3 bg-zinc-900 border border-dashed border-zinc-700 rounded-xl p-4">
                  <label
                    className="flex items-center justify-center h-28 rounded-lg border border-dashed border-zinc-700 cursor-pointer hover:border-purple-500/70 transition-colors text-gray-200 text-xs"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={activeTab === 'image' ? 'image/*' : 'video/*'}
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    {fileData ? (
                      <div className="w-full h-full flex items-center justify-center">
                        {activeTab === 'image' ? (
                          <img
                            src={fileData.previewUrl}
                            alt="preview"
                            className="max-h-24 w-auto object-contain"
                          />
                        ) : (
                          <video
                            src={fileData.previewUrl}
                            className="max-h-24 w-auto rounded"
                            autoPlay
                            loop
                            muted
                          />
                        )}
                      </div>
                    ) : (
                      <span>{t.promptFinder.uploadCTA}</span>
                    )}
                  </label>

                  <div className="text-[11px] text-gray-400 space-y-2">
                    <p>{t.promptFinder.uploadInfo}</p>
                    {fileData && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between bg-zinc-800/70 border border-zinc-700 rounded-lg px-3 py-2 text-gray-200">
                          <div className="flex flex-col">
                            <span className="font-semibold">{fileData.name}</span>
                            <span className="text-[10px] text-gray-400">{(fileData.size / 1024 / 1024).toFixed(2)} MB</span>
                          </div>
                          <button
                            type="button"
                            onClick={removeFile}
                            className="text-red-400 hover:text-red-200 text-[11px]"
                          >
                            {t.promptFinder.removeFile}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-2">
                    <h3 className="text-[11px] font-semibold text-gray-200 tracking-wide">
                      {t.promptFinder.ratioLabel}
                    </h3>
                    <div className="flex rounded-lg border border-zinc-800 overflow-hidden bg-zinc-900">
                      {([
                        { key: '16:9' as const, label: t.promptFinder.ratio169 },
                        { key: '9:16' as const, label: t.promptFinder.ratio918 },
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

                {fileData && (
                  <div className="space-y-1">
                    <h4 className="text-[11px] font-semibold text-gray-200">{t.promptFinder.resultTitle}</h4>
                    <textarea
                      value={isGenerating ? t.promptFinder.processing : resultText}
                      readOnly={isGenerating}
                      onChange={(e) => {
                        if (isGenerating) return;
                        setResultText(e.target.value);
                      }}
                      onBlur={(e) => {
                        if (isGenerating) return;
                        setResultText(e.target.value.trim());
                      }}
                      placeholder={t.promptFinder.noResult}
                      className="w-full min-h-[140px] bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-gray-50 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                    />
                    {isGenerating && (
                      <p className="text-[10px] text-gray-500">{t.promptFinder.processing}</p>
                    )}
                  </div>
                )}
              </div>

              </div>

              <div className="px-6 pb-5 pt-3 border-t border-zinc-800 space-y-3">
                <button
                  type="button"
                  onClick={handleGenerateOrPreview}
                  disabled={isGenerating || isOutputGenerating || !fileData || !ratio}
                  className={`w-full min-h-[48px] px-4 rounded-lg text-white font-semibold transition-all duration-200 btn-glass-primary flex items-center justify-center
                    focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-zinc-900
                    ${
                      isGenerating || isOutputGenerating || !fileData || !ratio
                        ? 'bg-zinc-600 cursor-not-allowed'
                        : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
                    }`}
                  aria-label={t.promptFinder.generateButton}
                >
                  {isGenerating || isOutputGenerating
                    ? t.promptFinder.processingBtn
                    : resultText.trim()
                    ? t.promptFinder.previewButton || t.promptFinder.generateButton
                    : t.promptFinder.generateButton}
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
                              setActivityLogCopyLabel(t.promptFinder.copied);
                              setTimeout(() => setActivityLogCopyLabel(t.activityLog.copyLog), 1200);
                            })
                            .catch(() => {
                              setActivityLogCopyLabel(t.promptFinder.copyFailedLabel);
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
              <h3 className="text-lg font-semibold text-gray-50">{t.promptFinder.previewTitle}</h3>
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(true)}
                className="inline-flex items-center px-4 py-2 text-[11px] font-semibold rounded-lg shadow-md transition-all duration-200 btn-glass-primary bg-red-600 hover:bg-red-700 text-white"
              >
                <span className="mr-1.5 text-xs">🗑️</span>
                <span>{t.buttons.clear} {t.common.data}</span>
              </button>
            </div>

            <div className="flex-1 flex flex-col px-6 py-4 min-h-0 min-w-0 space-y-3 overflow-y-auto custom-scrollbar" id="prompt-finder-result">
              {previewSpinnerActive && isGenerating ? (
                <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950/40 rounded-lg p-6">
                  <GradientLoader 
                    size="md"
                    text={t.promptFinder.processing}
                    subtitle="Mohon tunggu sebentar"
                  />
                </div>
              ) : previewItems.length === 0 ? (
                <div className="flex-1 flex items-center justify-center bg-zinc-950/40 rounded-lg text-gray-500 text-center text-xs p-4">
                  <p>{t.promptFinder.noResult}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-4">
                    {previewItems.map((item) => (
                      <div
                        key={item.id}
                        className="border border-zinc-800 bg-zinc-950/60 rounded-xl overflow-hidden shadow-sm cursor-pointer hover:border-purple-500/60 transition-colors"
                        onClick={() => setSelectedPreview(item)}
                      >
                        <div className="grid grid-cols-1 md:grid-cols-[220px,1fr]">
                          {item.mediaUrl ? (
                            <div className="bg-zinc-900/60 border-b md:border-b-0 md:border-r border-zinc-800 p-3 flex items-center justify-center">
                              {item.type === 'video' ? (
                                <video src={item.mediaUrl} className="w-full rounded-lg" controls muted loop />
                              ) : (
                                <img src={item.mediaUrl} alt="preview" className="w-full rounded-lg object-contain" />
                              )}
                            </div>
                          ) : (
                            <div className="bg-zinc-900/60 border-b md:border-b-0 md:border-r border-zinc-800 p-3 flex items-center justify-center text-[11px] text-gray-500">
                              {item.status === 'running' ? t.promptFinder.processing : t.promptFinder.noResult}
                            </div>
                          )}
                          <div className="p-4 space-y-2">
                            <div className="flex items-center gap-2 text-[11px] text-gray-400">
                              <span className="px-2 py-0.5 rounded-md border border-zinc-700 text-gray-200 uppercase tracking-wide">
                                {item.type === 'video' ? t.promptFinder.typeVideo : t.promptFinder.typeImage}
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
                                  ? t.promptFinder.statusCompleted
                                  : item.status === 'error'
                                  ? t.promptFinder.statusError
                                  : t.promptFinder.statusRunning}
                              </span>
                              {item.status === 'running' && getRemainingSeconds(item) !== null && (
                                <span className="text-[10px] text-gray-400">ETA {getRemainingSeconds(item)}s</span>
                              )}
                            </div>
                            <textarea
                              value={item.isEditing ? editedPrompt : item.prompt}
                              onFocus={() => handleStartEdit(item.id, item.prompt)}
                              onChange={(e) => setEditedPrompt(e.target.value)}
                              onBlur={() => handleBlurEdit(item.id)}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-gray-50 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                              rows={6}
                              style={{ minHeight: '180px' }}
                            />
                            {item.lastMessage && item.status === 'error' && (
                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-red-300">
                                <span>{item.lastMessage}</span>
                                <button
                                  type="button"
                                  className="px-2 py-0.5 rounded-md border border-amber-500 text-amber-200 hover:bg-amber-500/10"
                                  onClick={() => regenerateFromItem(item)}
                                >
                                  {t.promptFinder.regenerateBtn}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Prompt batch card */}
                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-100">{t.promptFinder.batchTitle}</p>
                          <p className="text-xs text-gray-400">{t.promptFinder.batchDesc}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-[11px] text-gray-300 font-semibold">{t.promptFinder.promptCountLabel}</label>
                          <input
                            type="number"
                            min={1}
                            max={1000}
                            value={promptCount}
                            onChange={(e) => setPromptCount(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-gray-50 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                            placeholder="5"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] text-gray-300 font-semibold">{t.promptFinder.modeLabel}</label>
                          <select
                            value={promptMode}
                            onChange={(e) => setPromptMode(e.target.value as 'similar' | 'variant')}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-gray-50 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                          >
                            <option value="similar">{t.promptFinder.modeSimilar}</option>
                            <option value="variant">{t.promptFinder.modeVariant}</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] text-gray-300 font-semibold">{t.promptFinder.fileNameLabel}</label>
                          <input
                            type="text"
                            value={promptFileName}
                            onChange={(e) => setPromptFileName(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-gray-50 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                            placeholder="prompt-finder.txt"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-wrap">
                        <button
                          type="button"
                          className="px-3 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 text-white text-sm font-semibold shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                          onClick={handleGeneratePromptBatch}
                          disabled={isPromptBatchRunning || isGenerating || isOutputGenerating || !resultText.trim()}
                        >
                          {isPromptBatchRunning ? t.promptFinder.processingPrompts : t.promptFinder.generatePromptBtn}
                        </button>
                        <p className="text-[11px] text-gray-400">{t.promptFinder.batchOutputHint}</p>
                      </div>

                      {batchSummary && (
                        <div className="mt-3 space-y-2 text-[11px] text-gray-300">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md border border-emerald-500/60 text-emerald-300 text-[10px]">{t.promptFinder.batchDone}</span>
                            <span>{batchSummary.count} prompt ({batchSummary.mode}) → {batchSummary.folder}\\{batchSummary.file}</span>
                          </div>
                          {renderBatchList()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
  {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-lg text-xs">
                  <div className="font-semibold">{t.promptFinder.errorTitle}</div>
                  <div>{error}</div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {error && (
        <div className="px-6 pb-4">
          <div className="bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-lg text-xs">
            <div className="font-semibold">{t.promptFinder.errorTitle}</div>
            <div>{error}</div>
          </div>
        </div>
      )}

      {toast && toast.type === 'error' && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg text-sm text-white bg-red-600`}>
          {toast.message}
        </div>
      )}

      <Modal
        isOpen={!!successModalMessage}
        onClose={() => setSuccessModalMessage(null)}
        title={t.promptFinder.generatePromptDoneModal}
        message={successModalMessage || ''}
        onConfirm={() => setSuccessModalMessage(null)}
        confirmButtonText="OK"
        confirmButtonColor="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
      />

      <Modal
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        title={t.modals.confirmReset.title}
        message={
          <div className="space-y-2">
            <p>{t.promptFinder.clearData}</p>
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
        title={selectedPreview ? (selectedPreview.type === 'video' ? t.promptFinder.previewVideoTitle : t.promptFinder.previewImageTitle) : ''}
        message={
          selectedPreview ? (
            <div className="space-y-3 max-w-[480px]">
              <div className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex items-center justify-center">
                {selectedPreview.mediaUrl ? (
                  selectedPreview.type === 'video' ? (
                    <video src={selectedPreview.mediaUrl} className="w-full max-h-[35vh] rounded-lg" controls autoPlay muted loop />
                  ) : (
                    <img src={selectedPreview.mediaUrl} alt="preview" className="w-full max-h-[35vh] object-contain rounded-lg" />
                  )
                ) : (
                  <p className="text-sm text-gray-300">{t.promptFinder.processing}</p>
                )}
              </div>
              <div className="space-y-1 text-sm text-gray-100">
                <div className="flex items-center gap-2 text-[11px] text-gray-400">
                  <span className="px-2 py-0.5 rounded-md border border-zinc-700 text-gray-200 uppercase tracking-wide">
                    {selectedPreview.type === 'video' ? t.promptFinder.typeVideo : t.promptFinder.typeImage}
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
                      ? t.promptFinder.statusCompleted
                      : selectedPreview.status === 'error'
                      ? t.promptFinder.statusError
                      : t.promptFinder.statusRunning}
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

export default PromptFinderPage;
