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

const PUZZLE_TUTORIAL_URL = 'https://www.youtube.com/embed/gTDPWwMGBx8?autoplay=1&mute=1&origin=http://localhost:3000';

type ActivityLogEntry = {
  id: number;
  type: 'INFO' | 'SUCCESS' | 'ERROR';
  message: string;
  timestamp: string;
};

const GenerateDropItPuzzleHeaderIcon: React.FC = () => (
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

const getFileName = (filePath: string): string => {
  const parts = filePath.split(/[\\/]/);
  return parts[parts.length - 1] || filePath;
};

const GenerateDropItPuzzlePage: React.FC = () => {
  const { t, language: uiLanguage } = useLanguage();
  const authReady = useAuthReady();
  const [puzzleMode, setPuzzleMode] = useState<PuzzleMode>('single');
  const [aspectRatio, setAspectRatio] = useState<PuzzleAspectRatio>('16:9');
  const [imageResolution] = useImageResolution();
  const veoModel = '3.1-fast-low';
  // Calculate fixed card dimensions based on resolution
  const cardDimensions = imageResolution === '1366x768'
    ? { parameter: 427, preview: 907 }
    : { parameter: 599, preview: 1273 };
  const [outputFolder, setOutputFolder] = useState<string>('');
  const [maxImages, setMaxImages] = useState<number>(50);
  const [puzzleItems, setPuzzleItems] = useState<PuzzleItem[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isGeneratingPuzzle, setIsGeneratingPuzzle] = useState<boolean>(false);
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

  const addLog = (type: ActivityLogEntry['type'], message: string) => {
    if (!message) return;
    if (type === 'ERROR') {
      setError(message);
    }
    const prefixedMessage = `[Puzzle] ${message}`;
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
    if (!error) return;
    const timeout = setTimeout(() => {
      setError(null);
    }, 5000);
    return () => clearTimeout(timeout);
  }, [error]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedOutput = localStorage.getItem('zeoPuzzle.outputFolder') || '';
    if (storedOutput) {
      setOutputFolder(storedOutput);
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
      addLog('SUCCESS', `${t.logMessages.common.folderOutputUpdated}: ${folderPath}`);
    } catch (err: any) {
      addLog('ERROR', err?.message || t.logMessages.sceneGenerator.engineNotAvailable);
    }
  };

  const handleGeneratePuzzles = async () => {
    if (isLoading) return;

    if (!outputFolder.trim()) {
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

    addLog('INFO', `${t.logMessages.sceneGenerator.scanningImages}: ${outputFolder}`);

    try {
      const result = await window.zeoAPI.getImageFiles({ folderPath: outputFolder });

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
    const downloadPath = outputFolder || localStorage.getItem('zeoStudio.folder.output') || '';
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

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();

    // Ignore external file drops
    if (e.dataTransfer?.files?.length) return;

    const sourceStr = e.dataTransfer.getData('application/puzzle-index') || e.dataTransfer.getData('text/plain');
    const sourceIndex = parseInt(sourceStr, 10);
    if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;

    setPuzzleItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next.map((item, idx) => ({ ...item, index: idx + 1 }));
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

  const statusLabel = (() => {
    if (isLoading) return t.logMessages.sceneGenerator.statusArranging;
    if (!hasPuzzles) return t.logMessages.sceneGenerator.statusReadyArrange;
    if (!allPromptsSaved)
      return t.logMessages.sceneGenerator.statusPromptIncomplete;
    if (isGeneratingPuzzle) return t.logMessages.sceneGenerator.statusRunning;
    return t.logMessages.sceneGenerator.statusReady;
  })();

  const primaryActionIsGenerate = hasPuzzles && allPromptsSaved;

  // Clamp max images when mode changes (single: 1-300, double: 1-600)
  useEffect(() => {
    const limit = puzzleMode === 'single' ? 300 : 600;
    setMaxImages((prev) => Math.min(Math.max(1, prev), limit));
  }, [puzzleMode]);

  const handlePrimaryAction = async () => {
    if (hasPuzzles && allPromptsSaved) {
      await handleStartGeneratePuzzle();
    } else {
      await handleGeneratePuzzles();
    }
  };

  const performFullReset = () => {
    setPuzzleMode('single');
    setAspectRatio('16:9');
    setOutputFolder('');
    setMaxImages(50);

    setPuzzleItems([]);
    setActivityLogs([]);
    setActivityLogCopyLabel(t.activityLog.copyLog);

    setIsLoading(false);
    setIsGeneratingPuzzle(false);
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
          iconId="drop-it-puzzle"
          iconClassName="h-6 w-6 mr-3 text-white"
          title={t.dropItPuzzle.title}
          description={t.dropItPuzzle.description}
          showApiKeyTest={false}
          tutorialUrl={PUZZLE_TUTORIAL_URL}
          tutorialTitle="Tutorial Drop It Puzzle"
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
                <div className="space-y-1 text-sm">
                  <label className="block text-xs font-semibold text-gray-300">{t.dropItPuzzle.puzzleModeLabel}</label>
                  <div className="flex rounded-lg border border-zinc-700 overflow-hidden text-[11px]">
                    <button
                      type="button"
                      className={`flex-1 px-3 py-2 transition-all duration-200 ${
                        puzzleMode === 'single'
                          ? 'btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white'
                          : 'bg-zinc-800 text-gray-300 hover:bg-zinc-700'
                      }`}
                      onClick={() => setPuzzleMode('single')}
                    >
                      {t.dropItPuzzle.single}
                    </button>
                    <button
                      type="button"
                      className={`flex-1 px-3 py-2 border-l border-zinc-700 transition-all duration-200 ${
                        puzzleMode === 'double'
                          ? 'btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white'
                          : 'bg-zinc-800 text-gray-300 hover:bg-zinc-700'
                      }`}
                      onClick={() => setPuzzleMode('double')}
                    >
                      {t.dropItPuzzle.double}
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-gray-400 leading-snug">
                    {puzzleMode === 'single' && t.dropItPuzzle.singleDesc}
                    {puzzleMode === 'double' && t.dropItPuzzle.doubleDesc}
                  </p>
                </div>

                <div className="space-y-1 text-sm mt-4">
                  <label className="block text-xs font-semibold text-gray-300">{t.sceneGenerator.videoRatio}</label>
                  <div className="flex rounded-lg border border-zinc-700 overflow-hidden text-[11px]">
                    <button
                      type="button"
                      className={`flex-1 px-3 py-2 transition-all duration-200 ${
                        aspectRatio === '16:9'
                          ? 'btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white'
                          : 'bg-zinc-800 text-gray-300 hover:bg-zinc-700'
                      }`}
                      onClick={() => setAspectRatio('16:9')}
                    >
                      {t.sceneGenerator.landscapeLabel}
                    </button>
                    <button
                      type="button"
                      className={`flex-1 px-3 py-2 border-l border-zinc-700 transition-all duration-200 ${
                        aspectRatio === '9:16'
                          ? 'btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white'
                          : 'bg-zinc-800 text-gray-300 hover:bg-zinc-700'
                      }`}
                      onClick={() => setAspectRatio('9:16')}
                    >
                      {t.sceneGenerator.portraitLabel}
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-gray-400 leading-snug">
                    {t.sceneGenerator.ratioDesc}
                  </p>
                </div>

                <div className="space-y-2 text-sm mt-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-gray-300">{t.sceneGenerator.outputFolderLabel}</label>
                    <button
                      type="button"
                      onClick={handleSelectOutputFolder}
                      className="px-4 py-2 rounded-lg text-[11px] font-semibold text-white btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 transition-all duration-200"
                    >
                      {t.sceneGenerator.selectFolder}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400 break-all">
                    {outputFolder || t.logMessages.common.folderOutputMissing}
                  </p>
                </div>

                <div className="space-y-2 text-sm mt-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-gray-300">{t.dropItPuzzle.maxImagesLabel}</label>
                    <span className="text-[11px] text-gray-400">{t.dropItPuzzle.limitLabel}: {puzzleMode === 'single' ? t.dropItPuzzle.singleLimit : t.dropItPuzzle.doubleLimit}</span>
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={puzzleMode === 'single' ? 300 : 600}
                    value={maxImages}
                    onChange={(e) => {
                      const next = Number(e.target.value || '0');
                      const limit = puzzleMode === 'single' ? 300 : 600;
                      setMaxImages(Math.min(Math.max(1, next), limit));
                    }}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="text-[11px] text-gray-400">
                    {puzzleMode === 'single'
                      ? t.dropItPuzzle.singleLimitDesc
                      : t.dropItPuzzle.doubleLimitDesc}
                  </p>
                </div>
              </div>

              <div className="px-6 pb-5 pt-3 border-t border-zinc-800 space-y-3">
                {(isGeneratingPuzzle || isLoading) && (
                  <div className="mb-4">
                    <GradientLoader
                      size="sm"
                      text={t.workflow.status.processing}
                      subtitle={t.dropItPuzzle.processingSubtitle}
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
                      (primaryActionIsGenerate ? !authReady : false)
                    }
                    className={`w-full min-h-[48px] px-4 rounded-lg text-white font-semibold transition-all duration-200 btn-glass-primary flex items-center justify-center
                      focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-zinc-900
                      ${
                        isLoading || isGeneratingPuzzle || (primaryActionIsGenerate ? !authReady : false)
                          ? 'bg-zinc-600 cursor-not-allowed'
                          : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
                      }`}
                    aria-label={primaryActionIsGenerate ? 'Generate Puzzle' : 'Build Puzzle'}
                  >
                    {isLoading || isGeneratingPuzzle
                      ? t.workflow.status.processing
                      : primaryActionIsGenerate
                      ? t.dropItPuzzle.generatePuzzle
                      : t.dropItPuzzle.buildPuzzle}
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
                <h3 className="text-lg font-semibold text-gray-50">
                  {t.sceneGenerator.previewTitle || `${t.common.preview} Puzzle`}
                </h3>
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
              {puzzleItems.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center bg-zinc-950/40 rounded-lg text-gray-500 text-center text-sm p-6">
                  <div className="max-w-sm">
                    <p>{t.sceneGenerator.emptyScenes}</p>
                  </div>
                </div>
              ) : (
                <div className="h-full overflow-y-auto custom-scrollbar">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {puzzleItems.map((item, idx) => {
                      const startUrl = item.startPreviewUrl || getImageFileUrl(item.startPath);
                      const endUrl = item.endPreviewUrl || getImageFileUrl(item.endPath);
                      const isSingle = item.mode === 'single';

                      return (
                        <div
                          key={item.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, idx)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, idx)}
                          onDragEnd={handleDragEnd}
                          className={`bg-zinc-950 border rounded-lg p-3 flex flex-col gap-2 text-xs transition-colors ${
                            draggingIndex === idx ? 'border-purple-500/80' : 'border-zinc-800'
                          }`}
                          style={{ cursor: 'grab' }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-md bg-purple-900/40 text-[10px] text-purple-200 border border-purple-600/60">
                                Puzzle #{item.index}
                              </span>
                              {item.status !== 'idle' && (
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-md border ${
                                    item.status === 'completed'
                                      ? 'border-emerald-500/60 text-emerald-300'
                                      : item.status === 'error'
                                      ? 'border-red-500/60 text-red-300'
                                      : item.status === 'generating'
                                      ? 'border-blue-500/60 text-blue-200'
                                      : 'border-zinc-500/60 text-gray-300'
                                  }`}
                                >
                                  {item.status === 'completed'
                                    ? t.sceneGenerator.completed
                                    : item.status === 'error'
                                    ? t.sceneGenerator.error
                                    : item.status === 'generating'
                                    ? t.sceneGenerator.generating
                                    : t.sceneGenerator.idle}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleRemoveImage(idx, 'start')}
                                className="px-2 py-0.5 text-[10px] rounded-md bg-red-600 hover:bg-red-700 text-white"
                              >
                                Remove
                              </button>
                            </div>
                          </div>

                          {isSingle ? (
                            <div
                              className="mt-1 rounded-md overflow-hidden border border-zinc-700/70 bg-black relative"
                              onDragOver={handleDragOver}
                              onDrop={(e) => handleFileDrop(e, idx, 'start')}
                            >
                              {startUrl ? (
                                <img
                                  src={startUrl}
                                  alt={getFileName(item.startPath)}
                                  className="w-full h-40 object-contain"
                                  loading="lazy"
                                  draggable={false}
                                />
                              ) : (
                                <div className="h-40 flex flex-col items-center justify-center text-gray-400 text-[11px]">
                                  <span className="text-lg">+</span>
                                  <span>Drag / Drop</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="mt-1 grid grid-cols-2 gap-2">
                              <div
                                className="relative rounded-md overflow-hidden border border-dashed border-zinc-700 bg-black/60 h-24 flex items-center justify-center"
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleFileDrop(e, idx, 'start')}
                              >
                                {startUrl ? (
                                  <img
                                    src={startUrl}
                                    alt={getFileName(item.startPath)}
                                    className="w-full h-full object-contain"
                                    loading="lazy"
                                    draggable={false}
                                  />
                                ) : (
                                  <div className="flex flex-col items-center text-gray-400 text-[11px]">
                                    <span className="text-lg">+</span>
                                    <span>Drag / Drop</span>
                                  </div>
                                )}
                                <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] text-gray-100 border border-zinc-700/80">
                                  {t.sceneGenerator.startLabel}
                                </span>
                              </div>
                              <div
                                className="relative rounded-md overflow-hidden border border-dashed border-zinc-700 bg-black/60 h-24 flex items-center justify-center"
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleFileDrop(e, idx, 'end')}
                              >
                                {endUrl ? (
                                  <img
                                    src={endUrl}
                                    alt={getFileName(item.endPath)}
                                    className="w-full h-full object-contain"
                                    loading="lazy"
                                    draggable={false}
                                  />
                                ) : (
                                  <div className="flex flex-col items-center text-gray-400 text-[11px]">
                                    <span className="text-lg">+</span>
                                    <span>Drag / Drop</span>
                                  </div>
                                )}
                                <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] text-gray-100 border border-zinc-700/80">
                                  {t.sceneGenerator.endLabel}
                                </span>
                              </div>
                            </div>
                          )}

                          <div className="mt-1 space-y-0.5">
                            <p className="text-[10px] text-emerald-300 truncate" title={getFileName(item.startPath)}>
                              {t.sceneGenerator.startFile.replace('{filename}', getFileName(item.startPath))}
                            </p>
                            {!isSingle && (
                              <p className="text-[10px] text-sky-300 truncate" title={getFileName(item.endPath)}>
                                {t.sceneGenerator.endFile.replace('{filename}', getFileName(item.endPath))}
                              </p>
                            )}
                          </div>

                          {item.status === 'generating' && item.lastMessage && (
                            <p className="mt-1 text-[10px] text-amber-300" title={item.lastMessage}>
                              {item.lastMessage}
                            </p>
                          )}

                          <div className="mt-2 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-semibold text-gray-200">{t.sceneGenerator.promptScene}</span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-md border ${{
                                  true: item.isPromptSaved,
                                }.true
                                  ? item.promptSource === 'ai'
                                    ? 'border-emerald-500 text-emerald-400'
                                    : 'border-sky-500 text-sky-400'
                                  : 'border-zinc-600 text-zinc-300'}`}
                              >
                                {!item.prompt.trim()
                                  ? t.sceneGenerator.noPromptYet
                                  : item.isPromptSaved
                                  ? item.promptSource === 'ai'
                                    ? t.sceneGenerator.savedAi
                                    : t.sceneGenerator.savedManual
                                  : t.sceneGenerator.notSavedLabel}
                              </span>
                            </div>
                            <textarea
                              className="w-full mt-1 px-2 py-1.5 rounded-md bg-zinc-900 border border-zinc-700 text-[11px] text-gray-100 focus:outline-none focus:ring-1 focus:ring-purple-500 custom-scrollbar"
                              rows={3}
                              placeholder={t.sceneGenerator.promptPlaceholder}
                              value={item.prompt}
                              onChange={(e) => handlePromptChange(item.id, e.target.value)}
                            />
                            {item.lastMessage && item.status !== 'generating' && (
                              <p className="mt-1 text-[10px] text-gray-400 whitespace-pre-wrap">{item.lastMessage}</p>
                            )}
                            <div className="flex justify-end gap-2 mt-1">
                              <button
                                type="button"
                                onClick={() => handleSavePrompt(item.id)}
                                disabled={item.prompt.trim().length < 10 || item.isPromptSaved}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors duration-150 ${
                                  item.prompt.trim().length < 10 || item.isPromptSaved
                                    ? 'bg-zinc-800 border-zinc-700 text-zinc-500 cursor-not-allowed'
                                    : 'bg-emerald-600 border-emerald-500 text-white hover:bg-emerald-500'
                                }`}
                              >
                                {item.isPromptSaved ? t.sceneGenerator.savedManual : t.sceneGenerator.saveWithCount.replace('{count}', String(item.prompt.trim().length))}
                              </button>
                            </div>
                          </div>

                          {item.status === 'completed' && getPuzzleVideoSrc(item) && (
                            <div className="mt-2 rounded-md overflow-hidden border border-zinc-700/70 bg-black">
                              <video
                                className="w-full h-40 bg-black"
                                src={`${getPuzzleVideoSrc(item) ?? ''}#t=0.5`}
                                controls
                                preload="metadata"
                              />
                              {item.videoFileName && (
                                <p
                                  className="px-2 py-1 text-[10px] text-emerald-300 truncate bg-zinc-950 border-t border-zinc-800"
                                  title={item.videoFileName}
                                >
                                  📁 {item.videoFileName}
                                </p>
                              )}
                            </div>
                          )}
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
    </div>
    {/* Konfirmasi Reset */}
    {isResetConfirmOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md shadow-2xl p-5">
          <h2 className="text-base font-semibold text-gray-50 mb-2">{t.sceneGenerator.confirmResetTitle}</h2>
          <div className="space-y-2 text-sm text-gray-200 mb-4">
            <p>{t.sceneGenerator.confirmResetMessage}</p>
            <p className="text-gray-400 text-xs">{t.sceneGenerator.confirmResetWarning}</p>
          </div>
          <div className="flex justify-end gap-2 text-xs">
            <button
              type="button"
              onClick={() => setIsResetConfirmOpen(false)}
              className="px-3 py-1.5 rounded-md border border-zinc-600 text-gray-200 hover:bg-zinc-800"
            >
              {t.sceneGenerator.cancelBtn}
            </button>
            <button
              type="button"
              onClick={handleConfirmReset}
              className="px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-700 text-white font-semibold"
            >
              {t.sceneGenerator.deleteBtn}
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
};

export default GenerateDropItPuzzlePage;
