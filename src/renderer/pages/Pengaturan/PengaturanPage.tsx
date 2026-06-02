// src/pages/Pengaturan/PengaturanPage.tsx
import React, { useState, useRef, useEffect } from 'react';
import Header from './Header';
import ConfigurationCard from './ConfigurationCard';
import { ConfigStatus } from '../../shared/types/types';
import { ChevronDownIcon } from '../../shared/constants/constants';
import {
  GlobalBearerTokenIcon,
  GlobalFolderConfigIcon,
  AIConfigIcon,
  LanguageIcon,
  GlobalWorkflowIcon,
  CookieConfigIcon,
} from './PengaturanConstants';
import Modal from '../../shared/components/Modal';
import { useConfigurationManager } from './useConfigurationManager'; // Import the new hook
import { useLanguage, LanguageCode } from '../../shared/i18n';
import { useImageResolution, type ImageResolutionOption } from '../../shared/utils/useImageResolution';
import { supabase } from '../../shared/utils/supabase';

const DEFAULT_AUTH_SHEET_URL = 'https://script.google.com/macros/s/AKfycbwq5rUjtrgpL94zoiIYvKKPbDaV-pWxNIzL7z2RLx27sEZgUn29mbwL0fnX_zRlg6_V/exec';
const MANUAL_BEARER_KEY = 'zeoStudio.auth.manualBearerToken';
const MANUAL_FLOW_ID_KEY = 'zeoStudio.auth.manualFlowProjectId';
const MANUAL_TEST_READY_KEY = 'zeoStudio.auth.manualTestReady';
const AUTO_TEST_READY_KEY = 'zeoStudio.auth.autoTestReady';
const LOCK_MODE_KEY = 'zeoStudio.auth.lockMode';

const formatJamUpdate = (value?: string) => {
  const raw = (value || '').trim();
  if (!raw) return '';
  // Try parse date/time and keep HH:mm
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }
  const match = raw.match(/\b(\d{1,2}:\d{2})\b/);
  if (match) return match[1];
  return raw;
};

const PengaturanPage: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();

  // Sheet sync state (Apps Script web app JSON endpoint)
  const [sheetUrl, setSheetUrl] = useState<string>(() => DEFAULT_AUTH_SHEET_URL);
  const [authMode, setAuthMode] = useState<'auto' | 'manual'>(() => (localStorage.getItem('zeoStudio.auth.mode') as 'auto' | 'manual') || 'auto');
  const [lockedMode, setLockedMode] = useState<'auto' | 'manual' | null>(() => {
    const stored = localStorage.getItem(LOCK_MODE_KEY);
    return stored === 'auto' || stored === 'manual' ? stored : null;
  });
  const [sheetEntries, setSheetEntries] = useState<{ bearerToken: string; flowProjectId?: string; jenis?: string; jamUpdate?: string }[]>([]);
  const [entryStatuses, setEntryStatuses] = useState<Array<'untested' | 'ok' | 'failed' | 'limit'>>([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState<number>(-1);
  const [isSyncingSheet, setIsSyncingSheet] = useState<boolean>(false);
  const [isSynced, setIsSynced] = useState<boolean>(false);
  const [isApplied, setIsApplied] = useState<boolean>(false);
  const [isTestingToken, setIsTestingToken] = useState<boolean>(false);
  const [isTestReady, setIsTestReady] = useState<boolean>(false);
  const [isBearerVisible, setIsBearerVisible] = useState<boolean>(false);
  const [isProjectVisible, setIsProjectVisible] = useState<boolean>(false);
  const [manualBearerInput, setManualBearerInput] = useState('');
  const [manualProjectIdInput, setManualProjectIdInput] = useState('');

  // User Agent state
  const [userAgent, setUserAgent] = useState<string>('');
  const [isLoadingUserAgent, setIsLoadingUserAgent] = useState<boolean>(false);
  const [isRefreshingUserAgent, setIsRefreshingUserAgent] = useState<boolean>(false);
  const [userAgentRefreshedAt, setUserAgentRefreshedAt] = useState<string>('');

  // Load persisted User-Agent from main (Electron store)
  useEffect(() => {
    const loadUA = async () => {
      const maybe = (window as any)?.zeoAPI?.getUserAgent;
      if (typeof maybe !== 'function') return;
      setIsLoadingUserAgent(true);
      try {
        const res = await maybe();
        if (res && res.ok && typeof res.userAgent === 'string') {
          setUserAgent(res.userAgent);
        }
        if (res && res.refreshedAt) {
          setUserAgentRefreshedAt(res.refreshedAt);
        }
      } catch (_) {
        // ignore load error; keep default blank
      } finally {
        setIsLoadingUserAgent(false);
      }
    };
    loadUA();
  }, []);

  const handleRefreshUserAgent = async () => {
    const maybe = (window as any)?.zeoAPI?.refreshUserAgent;
    if (typeof maybe !== 'function') {
      handleOpenModal(t.common.success, t.settings.modalRefreshUAElectronOnly, undefined, 'OK', undefined, 'bg-blue-600 hover:bg-blue-700');
      return;
    }
    setIsRefreshingUserAgent(true);
    try {
      const res = await maybe();
      if (res && res.ok && typeof res.userAgent === 'string') {
        setUserAgent(res.userAgent);
        if (res.refreshedAt) {
          setUserAgentRefreshedAt(res.refreshedAt);
        } else {
          setUserAgentRefreshedAt(new Date().toISOString());
        }
        handleOpenModal(t.settings.modalUAUpdated, t.settings.modalUAUpdatedMsg, undefined, 'OK', undefined, 'bg-green-600 hover:bg-green-700');
      } else {
        const msg = res?.error || t.settings.modalUAFailed;
        handleOpenModal(t.common.error, msg, undefined, 'OK', undefined, 'bg-red-600 hover:bg-red-700');
      }
    } catch (error: any) {
      handleOpenModal(t.common.error, error?.message || t.settings.modalUAFailed, undefined, 'OK', undefined, 'bg-red-600 hover:bg-red-700');
    } finally {
      setIsRefreshingUserAgent(false);
    }
  };

  // Language Settings State
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>(language);
  const [lastSavedLanguage, setLastSavedLanguage] = useState<LanguageCode>(language);

  // Sync selectedLanguage and lastSavedLanguage with context language on mount and language change
  useEffect(() => {
    setSelectedLanguage(language);
    setLastSavedLanguage(language);
  }, [language]);

  // Language Config Status
  const languageConfig = {
    isModified: selectedLanguage !== lastSavedLanguage,
    isConfigured: true,
    saveButtonDisabled: selectedLanguage === lastSavedLanguage,
    saveButtonText: selectedLanguage !== lastSavedLanguage ? t.buttons.save : t.configStatus.saved,
    status: ConfigStatus.Configured, // Use enum, not translation string
  };

  // Use the custom hook to manage all configuration states and logic
  const {
    flowProjectId, setFlowProjectId,
    bearerToken, setBearerToken,
    folderOutput, setFolderOutput,
    aiProvider, setAiProvider,
    aiModel, setAiModel,
    aiMode, setAiMode,
    aiModeLocked,
    apiKeyList, setApiKeyList,
    activeAiKeyIndex, setActiveAiKeyIndex,
    apiKey, setApiKey,
    bearerTokenConfig,
    folderConfig,
    aiConfig,
    handleSaveConfig,
    handleResetConfig,
    clearAllConfigurations,
    handleSaveAllConfigurations,
    isAnyConfigModified,
  } = useConfigurationManager();

  const [isTestingApiKey, setIsTestingApiKey] = useState(false);
  const [isApiKeyReady, setIsApiKeyReady] = useState(false);
  const [newBulkApiKey, setNewBulkApiKey] = useState('');

  // Image resolution setting (UI density)
  const [imageResolution, setImageResolution] = useImageResolution();
  const [lastSavedResolution, setLastSavedResolution] = useState<ImageResolutionOption>(imageResolution);
  const resolutionConfig = {
    isModified: imageResolution !== lastSavedResolution,
    isConfigured: true,
    saveButtonDisabled: imageResolution === lastSavedResolution,
    saveButtonText: imageResolution !== lastSavedResolution ? t.buttons.save : t.configStatus.saved,
    status: ConfigStatus.Configured,
  };

  // State for Modal (remains in PengaturanPage as it's UI-specific)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalOnConfirm, setModalOnConfirm] = useState<(() => void) | undefined>(undefined);
  const [modalConfirmButtonText, setModalConfirmButtonText] = useState(t.common.confirm);
  const [modalCancelButtonText, setModalCancelButtonText] = useState(t.common.cancel);
  const [modalConfirmButtonColor, setModalConfirmButtonColor] = useState('bg-blue-600 hover:bg-blue-700');
  const [modalShowUpdateLabel, setModalShowUpdateLabel] = useState<boolean>(false);

  // Refs untuk fallback pemilihan folder di mode browser/dev
  const folderOutputRef = useRef<HTMLInputElement>(null);

  // Helper function to open modal
  const handleOpenModal = (
    title: string,
    message: string,
    onConfirm?: () => void,
    confirmText?: string,
    cancelText?: string,
    confirmColor?: string,
    showUpdateLabel?: boolean,
  ) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalOnConfirm(() => onConfirm);
    setModalConfirmButtonText(confirmText || t.common.confirm);
    setModalCancelButtonText(cancelText || t.common.cancel);
    setModalConfirmButtonColor(confirmColor || 'bg-blue-600 hover:bg-blue-700');
    setModalShowUpdateLabel(!!showUpdateLabel);
    setIsModalOpen(true);
  };

  // Helper function to close modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setModalOnConfirm(undefined);
  };

  // Persist sheet URL and allow backend-provided URL (hidden from UI)
  useEffect(() => {
    // Force new default to avoid stale URL
    localStorage.setItem('zeoStudio.sheet.url', sheetUrl && sheetUrl.trim() !== '' ? sheetUrl.trim() : DEFAULT_AUTH_SHEET_URL);
  }, [sheetUrl]);

  // Persist auth mode
  useEffect(() => {
    localStorage.setItem('zeoStudio.auth.mode', authMode);
    try {
      window.dispatchEvent(new CustomEvent('zeo:auth-mode-changed', { detail: { mode: authMode } }));
    } catch {
      // ignore
    }
  }, [authMode]);

  // Ensure UI mode aligns with locked mode if present
  useEffect(() => {
    if (lockedMode && authMode !== lockedMode) {
      setAuthMode(lockedMode);
    }
  }, [lockedMode, authMode]);

  // When switching modes, hydrate credentials and test status appropriately
  useEffect(() => {
    if (authMode === 'manual') {
      const storedManualBearer = localStorage.getItem(MANUAL_BEARER_KEY) || '';
      const storedManualFlowId = localStorage.getItem(MANUAL_FLOW_ID_KEY) || '';
      setManualBearerInput(storedManualBearer);
      setManualProjectIdInput(storedManualFlowId);
      setBearerToken(storedManualBearer);
      setFlowProjectId(storedManualFlowId);
      setIsApplied(false);
      setIsTestReady(localStorage.getItem(MANUAL_TEST_READY_KEY) === 'true');
    } else {
      const storedAutoBearer = localStorage.getItem('zeoStudio.bearerToken') || '';
      const storedAutoFlowId = localStorage.getItem('zeoStudio.workflow.flowProjectId') || '';
      setBearerToken(storedAutoBearer);
      setFlowProjectId(storedAutoFlowId);
      setIsApplied(false);
      setIsTestReady(localStorage.getItem(AUTO_TEST_READY_KEY) === 'true');
    }
  }, [authMode]);

  useEffect(() => {
    // Try to get sheet URL from backend (e.g., license-like config)
    const fetchBackendSheetUrl = async () => {
      try {
        const maybe = (window as any)?.zeoAPI?.getAuthSheetUrl;
        if (typeof maybe === 'function') {
          const url = await maybe();
          if (url && typeof url === 'string') {
            setSheetUrl(url);
          }
        }
      } catch (_) {
        // ignore; will fall back to stored/local value
      }
    };
    fetchBackendSheetUrl();
  }, []);

  const handleSyncSheet = async () => {
    if (!sheetUrl || sheetUrl.trim() === '') {
      handleOpenModal(t.settings.modalWarning, t.settings.modalSheetUrlEmpty, undefined, 'OK', undefined, 'bg-yellow-600 hover:bg-yellow-700');
      return;
    }
    setIsSyncingSheet(true);
    setIsSynced(false);
    setIsApplied(false);
    try {
      const { data, error } = await supabase
        .from('api_credentials')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      const raw = data || [];
      const normalized = raw
        .map((item: any) => ({
          bearerToken: item.bearer_token || '',
          flowProjectId: item.flow_project_id || '',
          jenis: item.jenis || '',
          jamUpdate: item.updated_at || '',
          status: item.status || 'untested',
        }))
        .filter((item: any) => item.bearerToken && String(item.bearerToken).trim() !== '');

      setSheetEntries(normalized);
      setEntryStatuses(normalized.map(item => item.status));
      setActiveSheetIndex(-1);
      setIsTestReady(false);
      setIsSynced(true);
      handleOpenModal(
        t.settings.modalSyncSuccess,
        normalized.length > 0
          ? t.settings.modalSyncSuccessMsg.replace('{count}', String(normalized.length))
          : t.settings.modalSyncEmptyMsg,
        undefined,
        'OK',
        undefined,
        normalized.length > 0 ? 'bg-green-600 hover:bg-green-700' : 'bg-yellow-600 hover:bg-yellow-700',
        false,
      );
    } catch (error: any) {
      console.error('Error generating image:', error);
      handleOpenModal(
        t.common.error,
        error.message || String(error),
        undefined,
        'OK',
        undefined,
        'bg-red-600 hover:bg-red-700'
      );
    } finally {
      setIsSyncingSheet(false);
    }
  };
  
  const handleSelectServerCard = (idx: number) => {
    if (entryStatuses[idx] !== 'ok') {
      handleOpenModal(
        t.settings.modalWarning,
        'Please test this server first before selecting it.',
        undefined,
        'OK',
        undefined,
        'bg-yellow-600 hover:bg-yellow-700',
      );
      return;
    }
    
    // Jika ada card aktif sebelumnya dan berbeda dengan card yang diklik
    if (activeSheetIndex !== -1 && activeSheetIndex !== idx) {
      handleOpenModal(
        'Konfirmasi Perpindahan Server',
        'Apakah server sebelumnya ini sudah limit harian?',
        () => {
          // OK clicked: mark previous card as 'limit' and switch to new card
          const newStatuses = [...entryStatuses];
          newStatuses[activeSheetIndex] = 'limit';
          setEntryStatuses(newStatuses);
          
          const entry = sheetEntries[idx];
          setActiveSheetIndex(idx);
          setBearerToken(entry.bearerToken || '');
          setFlowProjectId(entry.flowProjectId || '');
          setIsTestReady(true);
          setIsApplied(true);
          // Save to localStorage for immediate use in other pages
          localStorage.setItem('zeoStudio.bearerToken', entry.bearerToken || '');
          localStorage.setItem('zeoStudio.workflow.flowProjectId', entry.flowProjectId || '');
          localStorage.setItem('zeoStudio.bearerJenis', (entry.jenis || 'lengkap').toLowerCase());
          localStorage.setItem(AUTO_TEST_READY_KEY, 'true');
          // Dispatch event to notify sidebar about bearer change
          try {
            window.dispatchEvent(new CustomEvent('storage'));
          } catch {
            // ignore
          }
          handleCloseModal();
        },
        'OK',
        'Cancel',
        'bg-blue-600 hover:bg-blue-700',
      );
      return;
    }
    
    // Jika tidak ada card aktif sebelumnya atau klik card yang sama, langsung switch
    const entry = sheetEntries[idx];
    setActiveSheetIndex(idx);
    setBearerToken(entry.bearerToken || '');
    setFlowProjectId(entry.flowProjectId || '');
    setIsTestReady(true);
    setIsApplied(true);
    // Save to localStorage for immediate use in other pages
    localStorage.setItem('zeoStudio.bearerToken', entry.bearerToken || '');
    localStorage.setItem('zeoStudio.workflow.flowProjectId', entry.flowProjectId || '');
    localStorage.setItem('zeoStudio.bearerJenis', (entry.jenis || 'lengkap').toLowerCase());
    localStorage.setItem(AUTO_TEST_READY_KEY, 'true');
    // Dispatch event to notify sidebar about bearer change
    try {
      window.dispatchEvent(new CustomEvent('storage'));
    } catch {
      // ignore
    }
  };
  const handleTestToken = async () => {
    setIsTestingToken(true);
    try {
      const maybeTester = (window as any)?.zeoAPI?.testBearerToken;

      // Manual mode: keep existing behavior
      if (authMode === 'manual') {
        if (!bearerToken || bearerToken.trim() === '') {
          throw new Error(t.settings.modalTokenEmpty);
        }

        if (typeof maybeTester === 'function') {
          const res = await maybeTester({ bearerToken: bearerToken.trim(), flowProjectId: flowProjectId.trim() || undefined });
          const ok = res?.ok ?? res === true;
          const message = res?.message || (ok ? t.settings.modalTokenValid : t.settings.modalTokenInvalid);
          setIsTestReady(!!ok);
          const testKey = MANUAL_TEST_READY_KEY;
          localStorage.setItem(testKey, ok ? 'true' : 'false');
          if (ok) {
            localStorage.setItem('zeoStudio.bearerJenis', 'manual');
          } else {
            localStorage.removeItem('zeoStudio.bearerJenis');
          }
          handleOpenModal(
            ok ? t.settings.modalTestSuccess : t.settings.modalTestFailed,
            ok ? t.settings.modalTokenValid : message,
            undefined,
            'OK',
            undefined,
            ok ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700',
          );
          return;
        }

        const ok = true; // fallback assume ok if tester missing
        setIsTestReady(ok);
        localStorage.setItem(MANUAL_TEST_READY_KEY, ok ? 'true' : 'false');
        handleOpenModal(t.settings.modalTestSuccess, t.settings.modalTokenValid, undefined, 'OK', undefined, 'bg-green-600 hover:bg-green-700');
        return;
      }

      // Auto mode: iterate all synced entries to test them (no auto-select)
      if (sheetEntries.length === 0) {
        throw new Error(t.settings.modalSyncEmptyMsg);
      }

      const tester = typeof maybeTester === 'function' ? maybeTester : null;
      const nextStatuses = new Array(sheetEntries.length).fill('untested') as Array<'untested' | 'ok' | 'failed' | 'limit'>;
      const successIndices: number[] = [];

      // Fallback when tester not available: mark all as ok
      if (!tester) {
        const allOk = new Array(sheetEntries.length).fill('ok') as Array<'untested' | 'ok' | 'failed' | 'limit'>;
        setEntryStatuses(allOk);
        setIsTestReady(false);
        setIsApplied(false);
        handleOpenModal(t.settings.modalTestSuccess, t.settings.modalTestNotAvailable + ' Please select a server manually.', undefined, 'OK', undefined, 'bg-green-600 hover:bg-green-700');
        return;
      }

      let lastMessage = '';

      // Test all entries without auto-selecting
      for (let idx = 0; idx < sheetEntries.length; idx += 1) {
        const entry = sheetEntries[idx];
        const token = entry.bearerToken?.trim();
        if (!token) continue;
        const res = await tester({ bearerToken: token, flowProjectId: entry.flowProjectId?.trim() || undefined });
        const ok = res?.ok ?? res === true;
        lastMessage = res?.message || (ok ? t.settings.modalTokenValid : t.settings.modalTokenInvalid);
        nextStatuses[idx] = ok ? 'ok' : 'failed';
        if (ok) {
          successIndices.push(idx);
        }
      }

      setEntryStatuses(nextStatuses);

      // Save pool of all valid tokens for reference
      const allValidPool = successIndices
        .map((i) => sheetEntries[i])
        .map((e) => ({
          bearerToken: e.bearerToken || '',
          flowProjectId: e.flowProjectId || '',
          jenis: (e.jenis || '').trim().toLowerCase(),
        }));
      
      if (allValidPool.length > 0) {
        localStorage.setItem('zeoStudio.bearerTokenPool', JSON.stringify(allValidPool));
        
        // Save image token separately if exists
        const imageEntry = successIndices
          .map((i) => sheetEntries[i])
          .find((e) => (e.jenis || '').trim().toLowerCase() === 'image');
        if (imageEntry) {
          localStorage.setItem('zeoStudio.bearerToken.image', imageEntry.bearerToken || '');
          localStorage.setItem('zeoStudio.workflow.flowProjectId.image', imageEntry.flowProjectId || '');
        } else {
          localStorage.removeItem('zeoStudio.bearerToken.image');
          localStorage.removeItem('zeoStudio.workflow.flowProjectId.image');
        }
        
        handleOpenModal(
          t.settings.modalTestSuccess,
          `${successIndices.length} server(s) ready. Please select one to activate.`,
          undefined,
          'OK',
          undefined,
          'bg-green-600 hover:bg-green-700',
        );
      } else {
        setActiveSheetIndex(-1);
        setBearerToken('');
        setFlowProjectId('');
        setIsTestReady(false);
        setIsApplied(false);
        localStorage.removeItem('zeoStudio.bearerJenis');
        localStorage.removeItem('zeoStudio.bearerToken.image');
        localStorage.removeItem('zeoStudio.workflow.flowProjectId.image');
        localStorage.removeItem('zeoStudio.bearerTokenPool');
        localStorage.setItem(AUTO_TEST_READY_KEY, 'false');
        handleOpenModal(t.settings.modalTestFailed, lastMessage || t.settings.modalTokenInvalid, undefined, 'OK', undefined, 'bg-red-600 hover:bg-red-700');
      }
    } catch (error: any) {
      setIsTestReady(false);
      const testKey = authMode === 'manual' ? MANUAL_TEST_READY_KEY : AUTO_TEST_READY_KEY;
      localStorage.setItem(testKey, 'false');
      handleOpenModal(t.common.error, error?.message || t.settings.modalTestFail, undefined, 'OK', undefined, 'bg-red-600 hover:bg-red-700');
    } finally {
      setIsTestingToken(false);
    }
  };

  // Handler for clearing all data (uses the hook's `clearAllConfigurations`)
  const handleClearData = () => {
    handleOpenModal(
      t.settings.modalConfirmDeleteTitle,
      t.settings.modalConfirmDeleteMsg,
      () => {
        clearAllConfigurations();
        localStorage.removeItem(LOCK_MODE_KEY);
        setLockedMode(null);
        handleOpenModal(t.settings.modalDataDeleted, t.settings.modalDataDeletedMsg, undefined, 'OK', undefined, 'bg-green-600 hover:bg-green-700');
      },
      t.settings.modalDeleteBtn,
      t.settings.modalCancelBtn,
      'bg-red-600 hover:bg-red-700'
    );
  };

  // Wrapper for saving a specific configuration type
  const onSave = (configName: string) => {
    const result = handleSaveConfig(configName);
    if (result.success) {
      if (configName === 'Global Bearer Token' && authMode === 'manual') {
        localStorage.setItem(MANUAL_BEARER_KEY, bearerToken || '');
        if (flowProjectId && flowProjectId.trim() !== '') {
          localStorage.setItem(MANUAL_FLOW_ID_KEY, flowProjectId);
        } else {
          localStorage.removeItem(MANUAL_FLOW_ID_KEY);
        }
      }
      if (configName === 'Global Bearer Token') {
        setLockedMode(authMode);
        localStorage.setItem(LOCK_MODE_KEY, authMode);
      }
      handleOpenModal(t.settings.modalConfigSaved, result.message, undefined, 'OK', undefined, 'bg-green-600 hover:bg-green-700');
    } else {
      handleOpenModal(t.settings.modalWarning, result.message, undefined, 'OK', undefined, 'bg-yellow-600 hover:bg-yellow-700');
    }
  };

  // Wrapper for saving all configurations globally
  const onSaveAllConfigurations = () => {
    const result = handleSaveAllConfigurations();
    handleOpenModal(result.success ? t.common.success : t.common.error, result.message, undefined, 'OK', undefined, result.success ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700');
  };

  const handleTestApiKey = async () => {
    setIsTestingApiKey(true);
    try {
      const tester = (window as any)?.zeoAPI?.testApiKey;
      const keys = aiMode === 'single'
        ? [apiKey.trim()].filter(Boolean)
        : apiKeyList.map((k) => k.trim()).filter((k) => k !== '');

      if (!tester || typeof tester !== 'function') {
        throw new Error(t.settings.modalTestNotAvailable || 'Tester tidak tersedia');
      }

      if (keys.length === 0) {
        throw new Error(t.settings.aiFieldsRequired);
      }

      let idx = aiMode === 'single' ? 0 : (activeAiKeyIndex % keys.length + keys.length) % keys.length;
      let attempts = keys.length;
      let successIndex = -1;
      let lastMessage = '';

      while (attempts > 0) {
        const key = keys[idx];
        const res = await tester({ apiKey: key, provider: aiProvider, model: aiModel });
        const ok = res?.ok ?? res === true;
        lastMessage = res?.message || (ok ? t.settings.modalTokenValid || t.settings.modalTestSuccess : t.settings.modalTokenInvalid || t.settings.modalTestFailed);
        if (ok) {
          successIndex = idx;
          break;
        }
        idx = (idx + 1) % keys.length;
        attempts -= 1;
      }

      const nextIndex = successIndex >= 0 ? successIndex : ((activeAiKeyIndex + 1) % keys.length);
      const nextKey = keys[nextIndex];
      setActiveAiKeyIndex(nextIndex);
      setApiKey(nextKey);
      localStorage.setItem('zeoStudio.ai.activeIndex', String(nextIndex));
      localStorage.setItem('zeoStudio.ai.apiKey', nextKey);

      setIsApiKeyReady(successIndex >= 0);

      if (successIndex >= 0) {
        handleOpenModal(t.settings.modalTestSuccess, lastMessage, undefined, 'OK', undefined, 'bg-green-600 hover:bg-green-700');
      } else {
        handleOpenModal(t.settings.modalTestFailed, lastMessage, undefined, 'OK', undefined, 'bg-red-600 hover:bg-red-700');
      }
    } catch (error: any) {
      setIsApiKeyReady(false);
      handleOpenModal(t.common.error, error?.message || t.settings.modalTestFail, undefined, 'OK', undefined, 'bg-red-600 hover:bg-red-700');
    } finally {
      setIsTestingApiKey(false);
    }
  };

  const handleAddBulkKey = () => {
    const trimmed = newBulkApiKey.trim();
    if (!trimmed) return;
    const nextList = [...apiKeyList, trimmed];
    setApiKeyList(nextList);
    const nextIndex = nextList.length - 1;
    setActiveAiKeyIndex(nextIndex);
    setApiKey(trimmed);
    setNewBulkApiKey('');
    setIsApiKeyReady(false);
  };

  const handleDeleteBulkKey = () => {
    if (apiKeyList.length === 0) return;
    const nextList = apiKeyList.filter((_, idx) => idx !== activeAiKeyIndex);
    const nextIndex = nextList.length > 0 ? Math.min(activeAiKeyIndex, nextList.length - 1) : 0;
    const nextKey = nextList[nextIndex] || '';
    setApiKeyList(nextList);
    setActiveAiKeyIndex(nextIndex);
    setApiKey(nextKey);
    setIsApiKeyReady(false);
  };

  // Handler for Language Settings
  const handleSaveLanguage = () => {
    setLanguage(selectedLanguage);
    setLastSavedLanguage(selectedLanguage);
    const langNameMap: Record<string, string> = {
      en: t.settings.languageEnglish,
      id: t.settings.languageIndonesian,
      ms: t.settings.languageMalay,
      pt: t.settings.languagePortuguese,
      es: t.settings.languageSpanish,
      fr: t.settings.languageFrench,
      ru: t.settings.languageRussian,
    };
    const languageName = langNameMap[selectedLanguage] || selectedLanguage;
    handleOpenModal(t.settings.modalLanguageSaved, t.settings.modalLanguageSavedMsg.replace('{language}', languageName), undefined, 'OK', undefined, 'bg-green-600 hover:bg-green-700');
  };

  const handleResetLanguage = () => {
    setSelectedLanguage(lastSavedLanguage);
  };

  // Handlers for resolution settings
  const handleSaveResolution = () => {
    setLastSavedResolution(imageResolution);
    handleOpenModal(
      t.settings.modalResolutionSaved,
      t.settings.modalResolutionSavedMsg.replace('{resolution}',
        imageResolution === '1366x768'
          ? t.settings.resolutionCompact
          : imageResolution === '2560x1440'
            ? t.settings.resolutionQHD
            : t.settings.resolutionFullHD
      ),
      undefined,
      'OK',
      undefined,
      'bg-green-600 hover:bg-green-700',
    );
  };

  const handleResetResolution = () => {
    setImageResolution(lastSavedResolution);
  };

  // Handler for folder selection using Electron dialog (select-folder IPC).
  // Falls back to a hidden webkitdirectory input when window.zeoAPI is not available (e.g. in browser dev mode).
  const handleSelectFolder = async (folderType: 'output') => {
    const isElectron = typeof window !== 'undefined' && !!window.zeoAPI && typeof window.zeoAPI.selectFolder === 'function';

    if (isElectron) {
      try {
        const currentPath = folderOutput;
        const result = await window.zeoAPI!.selectFolder?.({
          defaultPath: currentPath && currentPath.trim() !== '' ? currentPath : undefined,
          title: t.settings.folderSelectTitle,
        });

        if (!result || result.canceled || !result.path) {
          handleOpenModal(
            t.settings.modalWarning,
            t.settings.modalFolderNoSelection,
            undefined,
            'OK',
            undefined,
            'bg-yellow-600 hover:bg-yellow-700',
          );
          return;
        }

        const selectedPath = result.path;
        setFolderOutput(selectedPath);

        handleOpenModal(
          t.settings.modalFolderSelected,
          t.settings.modalFolderSelectedMsg.replace('{path}', selectedPath),
          undefined,
          'OK',
          undefined,
          'bg-green-600 hover:bg-green-700',
        );
      } catch (error) {
        handleOpenModal(
          t.common.error,
          t.settings.modalFolderError.replace('{error}', String(error)),
          undefined,
          'OK',
          undefined,
          'bg-red-600 hover:bg-red-700',
        );
      }
      return;
    }

    // Fallback: use hidden file input + webkitdirectory like before when not running in Electron.
    const inputRef = folderOutputRef;
    if (inputRef.current) {
      inputRef.current.click();
    }
  };

  // Wrapper for resetting a specific configuration type
  const onReset = (configName: string) => {
    handleOpenModal(t.settings.modalConfirmReset, t.settings.modalConfirmResetMsg.replace('{config}', configName), () => {
      const result = handleResetConfig(configName);
      setSheetEntries([]);
      setActiveSheetIndex(-1);
      setIsTestReady(false);
      setIsSynced(false);
      setIsApplied(false);
      if (configName === 'Global Bearer Token') {
        localStorage.removeItem(MANUAL_BEARER_KEY);
        localStorage.removeItem(MANUAL_FLOW_ID_KEY);
        localStorage.removeItem(MANUAL_TEST_READY_KEY);
        localStorage.removeItem(AUTO_TEST_READY_KEY);
        localStorage.removeItem(LOCK_MODE_KEY);
        setManualBearerInput('');
        setManualProjectIdInput('');
        setLockedMode(null);
      }
      if (result.success) {
        handleOpenModal(t.settings.modalConfigReset, result.message, undefined, 'OK', undefined, 'bg-green-600 hover:bg-green-700');
      } else {
        handleOpenModal(t.settings.modalWarning, result.message, undefined, 'OK', undefined, 'bg-red-600 hover:bg-red-700');
      }
    }, t.settings.resetBtn, t.settings.modalCancelBtn, 'bg-red-600 hover:bg-red-700');
  };

  const authAndCookiesDetails = (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="text-gray-300 text-sm font-semibold">{t.settings.authModeLabel}</div>
          <div className="text-gray-500 text-xs">
            {authMode === 'auto' ? t.settings.authAutoDesc : t.settings.authManualDesc}
          </div>
        </div>
        <div className="bg-zinc-800 rounded-md p-1 flex border border-zinc-700">
          <button
            onClick={() => {
              if (lockedMode === 'manual') return;
              setAuthMode('auto');
            }}
            disabled={lockedMode === 'manual'}
            aria-disabled={lockedMode === 'manual'}
            className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors duration-200 ${authMode === 'auto' ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-[0_0_0_1px_rgba(59,130,246,0.4)]' : 'text-gray-300 hover:text-white'} ${lockedMode === 'manual' ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-pressed={authMode === 'auto'}
          >
            {t.settings.authAutoLabel}
          </button>
          <button
            onClick={() => {
              if (lockedMode === 'auto') return;
              setAuthMode('manual');
            }}
            disabled={lockedMode === 'auto'}
            aria-disabled={lockedMode === 'auto'}
            className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors duration-200 ${authMode === 'manual' ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-[0_0_0_1px_rgba(59,130,246,0.4)]' : 'text-gray-300 hover:text-white'} ${lockedMode === 'auto' ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-pressed={authMode === 'manual'}
          >
            {t.settings.authManualLabel}
          </button>
        </div>
      </div>

      {authMode === 'manual' && (
        <div className="space-y-4">
          <div className="text-gray-300 text-sm">{t.settings.manualFormHint}</div>
          <div className="space-y-2">
            <label className="text-gray-400 text-sm font-bold" htmlFor="manual-bearer">
              {t.settings.manualBearerLabel}
            </label>
            <textarea
              id="manual-bearer"
              className="w-full h-24 px-3 py-2 bg-zinc-700 text-gray-50 rounded-lg border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors duration-200 resize-y"
              value={manualBearerInput}
              onChange={(e) => {
                const val = e.target.value;
                setManualBearerInput(val);
                setBearerToken(val);
                setIsTestReady(false);
                localStorage.setItem(MANUAL_TEST_READY_KEY, 'false');
              }}
              placeholder={t.settings.manualBearerPlaceholder}
            />
          </div>
          <div className="space-y-2">
            <label className="text-gray-400 text-sm font-bold" htmlFor="manual-project-id">
              {t.settings.manualProjectIdLabel}
            </label>
            <input
              id="manual-project-id"
              type="text"
              className="w-full px-3 py-2 bg-zinc-700 text-gray-50 rounded-lg border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors duration-200"
              value={manualProjectIdInput}
              onChange={(e) => {
                const val = e.target.value;
                setManualProjectIdInput(val);
                setFlowProjectId(val);
                setIsTestReady(false);
                localStorage.setItem(MANUAL_TEST_READY_KEY, 'false');
              }}
              placeholder={t.settings.manualProjectIdPlaceholder}
            />
          </div>
        </div>
      )}

      {authMode === 'auto' && (
        <div className="space-y-3">
          <div className="text-gray-300 text-sm">{t.settings.authSyncDesc}</div>
          <div className="space-y-2">
            <div className="text-gray-400 text-sm font-bold flex items-center justify-between">
              <span>{t.settings.selectEntry}</span>
              <span className="text-xs text-gray-500">{sheetEntries.length} {sheetEntries.length === 1 ? 'server' : 'servers'}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 max-h-96 overflow-y-auto pr-1">
              {sheetEntries.length === 0 && (
                <div className="px-3 py-2 bg-zinc-800 text-gray-500 rounded-lg border border-dashed border-zinc-700">
                  {t.settings.noEntries}
                </div>
              )}
              {sheetEntries.map((entry, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectServerCard(idx)}
                  className={`px-3 py-2 rounded-lg border transition-all duration-200 text-left w-full ${
                    activeSheetIndex === idx
                      ? 'border-purple-500 bg-purple-900/30 shadow-[0_0_0_1px_rgba(168,85,247,0.4)]'
                      : entryStatuses[idx] === 'ok'
                      ? 'border-zinc-700 bg-zinc-800 hover:border-purple-400 hover:bg-zinc-750 cursor-pointer'
                      : entryStatuses[idx] === 'limit'
                      ? 'border-red-700 bg-red-900/20 cursor-default'
                      : 'border-zinc-700 bg-zinc-800 cursor-default'
                  }`}
                  disabled={entryStatuses[idx] !== 'ok'}
                >
                  <div className="flex items-center justify-between text-sm text-gray-200 font-semibold">
                    <span className="flex items-center gap-2">
                      {activeSheetIndex === idx && (
                        <svg className="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                      {t.settings.entryLabel.replace('{index}', String(idx + 1)).replace('{type}', entry.jenis ? entry.jenis : t.settings.entryTypeUnknown)}
                    </span>
                    <span className={`text-[11px] px-2 py-0.5 rounded border ${(entryStatuses[idx] || 'untested') === 'ok'
                      ? 'border-green-500 text-green-400'
                      : (entryStatuses[idx] || 'untested') === 'failed'
                        ? 'border-red-500 text-red-400'
                        : (entryStatuses[idx] || 'untested') === 'limit'
                          ? 'border-red-600 text-red-500 font-bold'
                          : 'border-zinc-600 text-gray-400'
                      }`}>
                      {(entryStatuses[idx] || 'untested') === 'ok' ? 'Ready' : (entryStatuses[idx] || 'untested') === 'failed' ? 'Failed' : (entryStatuses[idx] || 'untested') === 'limit' ? 'Limit' : 'Not tested'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1 break-all">
                    <div>Token: {entry.bearerToken ? '•••' : '-'}</div>
                    <div>Flow ID: {entry.flowProjectId ? '•••' : '-'}</div>
                    {entry.jamUpdate && <div className="text-[10px] text-gray-600 mt-1">{formatJamUpdate(entry.jamUpdate)}</div>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center space-x-3 mt-6">
        <div className="flex space-x-2">
          {authMode === 'auto' && (
            <button
              onClick={handleSyncSheet}
              disabled={isSyncingSheet || isSynced}
              className={`px-4 py-2 text-white font-medium rounded-lg transition-all duration-200 ${isSyncingSheet || isSynced
                  ? 'bg-gray-600'
                  : 'btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
                }`}
              aria-label={t.settings.syncAuthBtn}
            >
              {isSyncingSheet ? t.settings.syncingBtn : isSynced ? t.settings.syncedBtn : t.settings.syncAuthBtn}
            </button>
          )}
          <button
            onClick={handleTestToken}
            disabled={isTestingToken}
            className={`px-4 py-2 text-white font-medium rounded-lg transition-colors duration-200 ${isTestingToken ? 'bg-gray-600' : isTestReady ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-500'
              }`}
            aria-label={t.settings.testTokenBtn}
          >
            {isTestingToken ? t.settings.testingBtn : isTestReady ? 'Done' : t.settings.testTokenBtn}
          </button>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => onSave("Global Bearer Token")}
            className={`px-4 py-2 text-white font-medium rounded-lg transition-colors duration-200 ${bearerTokenConfig.saveButtonDisabled ? 'bg-gray-600 hover:bg-gray-700' : 'bg-blue-600 hover:bg-blue-700'}`}
            aria-label={t.settings.saveLabel}
            disabled={bearerTokenConfig.saveButtonDisabled}
          >
            {bearerTokenConfig.saveButtonText}
          </button>
          <button
            onClick={() => onReset("Global Bearer Token")}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors duration-200"
            aria-label={t.settings.resetBtn}
          >
            {t.settings.resetBtn}
          </button>
        </div>
      </div>
    </div>
  );

  const userAgentDetails = (
    <div className="space-y-4">
      <div className="text-gray-300 text-sm">{t.settings.userAgentDesc}</div>
      <label className="block text-gray-400 text-sm font-bold mb-2" htmlFor="ua-display">
        {t.settings.userAgentActiveLabel}
      </label>
      <textarea
        id="ua-display"
        className="w-full h-32 px-3 py-2 bg-zinc-800 text-gray-100 rounded-lg border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors duration-200 resize-y"
        readOnly
        value={userAgent || (isLoadingUserAgent ? t.settings.userAgentLoading : t.settings.userAgentNotAvailable)}
      />
      <div className="flex justify-end space-x-3 mt-2">
        <button
          onClick={handleRefreshUserAgent}
          className={`px-4 py-2 text-white font-medium rounded-lg transition-all duration-200 ${isRefreshingUserAgent
              ? 'bg-gray-600 cursor-wait'
              : 'btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
            }`}
          disabled={isRefreshingUserAgent}
        >
          {isRefreshingUserAgent ? t.settings.refreshingBtn : t.settings.refreshUABtn}
        </button>
      </div>
      <p className="text-xs text-gray-500">
        {userAgentRefreshedAt
          ? t.settings.lastRefreshed.replace('{date}', new Date(userAgentRefreshedAt).toLocaleString())
          : t.settings.neverRefreshed}
      </p>
      <p className="text-xs text-gray-500">
        {t.settings.refreshHint}
      </p>
    </div>
  );

  const resolutionDetails = (
    <div className="space-y-4">
      <div className="text-gray-300 text-sm">{t.settings.resolution.description}</div>
      <label className="block text-gray-400 text-sm font-bold mb-2" htmlFor="resolution-select">
        {t.settings.resolution.selectLabel}
      </label>
      <select
        id="resolution-select"
        className="w-full px-3 py-2 bg-zinc-700 text-gray-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors duration-200"
        value={imageResolution}
        onChange={(e) => setImageResolution(e.target.value as ImageResolutionOption)}
        aria-label={t.settings.resolution.selectLabel}
      >
        <option value="1366x768">{t.settings.resolutionCompact}</option>
        <option value="1920x1080">{t.settings.resolutionFullHD}</option>
        <option value="2560x1440">{t.settings.resolutionQHD}</option>
      </select>
      <div className="mt-3 p-3 bg-zinc-800 rounded-lg">
        <p className="text-xs text-gray-400">
          <strong>{t.settings.noteLabel}</strong> {t.settings.resolution.note}
        </p>
      </div>
      <div className="flex justify-end space-x-3 mt-4">
        <button
          onClick={handleSaveResolution}
          className={`px-4 py-2 text-white font-medium rounded-lg transition-colors duration-200 ${resolutionConfig.saveButtonDisabled ? 'bg-gray-600 hover:bg-gray-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          aria-label={t.settings.saveLabel}
          disabled={resolutionConfig.saveButtonDisabled}
        >
          {resolutionConfig.saveButtonText}
        </button>
        <button
          onClick={handleResetResolution}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors duration-200"
          aria-label={t.settings.resetBtn}
        >
          {t.buttons.reset}
        </button>
      </div>
    </div>
  );

  const globalFolderDetails = (
    <div className="space-y-4">
      <div className="text-gray-300 text-sm">{t.settings.folderDesc}</div>
      <label className="block text-gray-400 text-sm font-bold mb-2" htmlFor="folder-output">
        {t.settings.folderLabel}
      </label>
      <div className="flex items-center space-x-2">
        {/* Hidden input kept only for browser/dev fallback when Electron APIs are unavailable */}
        <input
          type="file"
          ref={folderOutputRef}
          // @ts-ignore - webkitdirectory is a non-standard attribute but supported by Chromium
          webkitdirectory="true"
          // @ts-ignore
          directory="true"
          style={{ display: 'none' }}
          onChange={(e) => {
            const files = e.target.files;
            if (files && files.length > 0) {
              const relativePath = (files[0] as any).webkitRelativePath || '';
              const folderName = relativePath.split('/')[0] || '';
              const mockPath = folderName ? `C\\Users\\YourUser\\${folderName}\\` : '';
              if (mockPath) {
                setFolderOutput(mockPath);
                handleOpenModal(
                  t.settings.modalFolderSelected,
                  t.settings.modalFolderMockMsg.replace('{path}', mockPath),
                  undefined,
                  'OK',
                  undefined,
                  'bg-green-600 hover:bg-green-700',
                );
              }
            }
            if (e.target) {
              e.target.value = '';
            }
          }}
          aria-hidden="true"
          tabIndex={-1}
        />

        <input
          type="text"
          id="folder-output"
          className="flex-grow px-3 py-2 bg-zinc-700 text-gray-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors duration-200"
          value={folderOutput}
          placeholder={t.settings.folderPlaceholder}
          aria-label={t.settings.folderLabel}
          disabled // Make the input field disabled
        />
        <button
          onClick={() => handleSelectFolder('output')}
          className="px-4 py-2 text-white font-medium rounded-lg transition-all duration-200 btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          aria-label={t.settings.folderSelectTitle}
        >
          {t.settings.folderSelectBtn}
        </button>
      </div>
      <div className="flex justify-end space-x-3 mt-4">
        <button
          onClick={() => onSave("Global Folder Configuration")}
          className={`px-4 py-2 text-white font-medium rounded-lg transition-colors duration-200 ${folderConfig.saveButtonDisabled ? 'bg-gray-600 hover:bg-gray-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          aria-label={t.settings.saveLabel}
          disabled={folderConfig.saveButtonDisabled}
        >
          {folderConfig.saveButtonText}
        </button>
        <button
          onClick={() => onReset("Global Folder Configuration")}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors duration-200"
          aria-label={t.settings.resetBtn}
        >
          {t.settings.resetBtn}
        </button>
      </div>
    </div>
  );

  const aiConfigurationDetails = (
    <div className="space-y-4">
      <div className="text-gray-300 text-sm">{t.settings.aiConfigDesc}</div>
      <div className="p-3 bg-zinc-800 text-gray-300 text-sm rounded-lg border border-zinc-700">
        Konfigurasi ini khusus untuk Gemini dengan model <span className="font-semibold text-gray-100">Gemini 2.5 Flash</span>.
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-gray-400 text-sm font-bold">{t.settings.aiModeLabel}</div>
          <div className="bg-zinc-800 rounded-md p-1 flex border border-zinc-700">
            <button
              onClick={() => {
                if (aiModeLocked === 'bulk') return;
                setAiMode('single');
                setActiveAiKeyIndex(0);
              }}
              disabled={aiModeLocked === 'bulk'}
              aria-disabled={aiModeLocked === 'bulk'}
              className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors duration-200 ${aiMode === 'single' ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-[0_0_0_1px_rgba(59,130,246,0.4)]' : 'text-gray-300 hover:text-white'} ${aiModeLocked === 'bulk' ? 'cursor-not-allowed opacity-60' : ''}`}
              aria-pressed={aiMode === 'single'}
            >
              Single
            </button>
            <button
              onClick={() => {
                if (aiModeLocked === 'single') return;
                setAiMode('bulk');
                if (apiKeyList.length === 0 && apiKey.trim()) {
                  setApiKeyList([apiKey.trim()]);
                }
              }}
              disabled={aiModeLocked === 'single'}
              aria-disabled={aiModeLocked === 'single'}
              className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors duration-200 ${aiMode === 'bulk' ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-[0_0_0_1px_rgba(59,130,246,0.4)]' : 'text-gray-300 hover:text-white'} ${aiModeLocked === 'single' ? 'cursor-not-allowed opacity-60' : ''}`}
              aria-pressed={aiMode === 'bulk'}
            >
              Bulk
            </button>
          </div>
        </div>

        {aiMode === 'single' && (
          <div className="space-y-2">
            <label className="block text-gray-400 text-sm font-bold" htmlFor="api-key-single">
              {t.settings.apiKeyLabel}
            </label>
            <textarea
              id="api-key-single"
              className="w-full h-24 px-3 py-2 bg-zinc-700 text-gray-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors duration-200 resize-y"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setIsApiKeyReady(false);
              }}
              placeholder={t.settings.apiKeyPlaceholder}
              aria-label={t.settings.apiKeyLabel}
            />
          </div>
        )}

        {aiMode === 'bulk' && (
          <div className="space-y-3">
            <label className="block text-gray-400 text-sm font-bold" htmlFor="api-key-bulk">
              {t.settings.apiKeyLabel} (satu baris satu key)
            </label>

            <div
              id="api-key-bulk"
              className="max-h-40 overflow-auto rounded-lg border border-zinc-700 bg-zinc-800 divide-y divide-zinc-700"
            >
              {apiKeyList.length === 0 && (
                <div className="px-3 py-2 text-sm text-gray-500">{t.settings.noEntries}</div>
              )}
              {apiKeyList.map((key, idx) => {
                const isActive = idx === activeAiKeyIndex;
                const shortKey = key.length > 28 ? `${key.slice(0, 12)}…${key.slice(-6)}` : key;
                return (
                  <div
                    key={idx}
                    className={`flex items-center justify-between px-3 py-2 ${isActive ? 'bg-gradient-to-r from-purple-600/40 to-blue-600/30' : ''}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-md ${isActive ? 'bg-purple-600 text-white' : 'bg-zinc-700 text-gray-200'}`}>
                        {t.settings.aiActiveKeyLabel.replace('{index}', String(idx + 1)) || `Key ${idx + 1}`}
                      </span>
                      <span className="text-sm text-gray-100 font-mono truncate" title={key}>
                        {shortKey}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2 items-center">
              <input
                type="text"
                className="flex-1 px-3 py-2 bg-zinc-700 text-gray-50 rounded-lg border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder={t.settings.aiAddKeyPlaceholder || 'Tambah API Key'}
                value={newBulkApiKey}
                onChange={(e) => setNewBulkApiKey(e.target.value)}
              />
              <button
                onClick={handleAddBulkKey}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors duration-200"
              >
                {t.settings.aiAddKeyBtn}
              </button>
              <button
                onClick={handleDeleteBulkKey}
                disabled={apiKeyList.length === 0}
                className={`px-3 py-2 rounded-lg font-semibold transition-colors duration-200 ${apiKeyList.length === 0 ? 'bg-gray-600 text-gray-300' : 'bg-red-600 hover:bg-red-700 text-white'}`}
              >
                {t.settings.aiDeleteKeyBtn}
              </button>
            </div>
            <div className="text-xs text-gray-500">{t.settings.aiRotationNote}</div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap justify-between gap-3 mt-4">
        <div className="flex space-x-2">
          <button
            onClick={handleTestApiKey}
            disabled={isTestingApiKey}
            className={`px-4 py-2 text-white font-medium rounded-lg transition-colors duration-200 ${isTestingApiKey
                ? 'bg-gray-600'
                : isApiKeyReady
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
              }`}
          >
            {isTestingApiKey ? t.settings.testingBtn : isApiKeyReady ? t.settings.readyBtn : 'Test API Key'}
          </button>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => onSave("AI Configuration")}
            className={`px-4 py-2 text-white font-medium rounded-lg transition-colors duration-200 ${aiConfig.saveButtonDisabled ? 'bg-gray-600 hover:bg-gray-700' : 'bg-blue-600 hover:bg-blue-700'}`}
            aria-label={t.settings.saveLabel}
            disabled={aiConfig.saveButtonDisabled}
          >
            {aiConfig.saveButtonText}
          </button>
          <button
            onClick={() => onReset("AI Configuration")}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors duration-200"
            aria-label={t.settings.resetBtn}
          >
            {t.settings.resetBtn}
          </button>
        </div>
      </div>
    </div>
  );


  return (
    <div role="main">
      <Header
        onClearData={handleClearData}
        onSaveAll={onSaveAllConfigurations} // NEW
        isAnyConfigModified={isAnyConfigModified} // NEW
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        <ConfigurationCard
          icon={<GlobalBearerTokenIcon />}
          title={(
            <span className="block leading-tight">
              {t.settings.authTitle}
            </span>
          )}
          description={t.settings.authDescription}
          status={bearerTokenConfig.status}
          detailsComponent={authAndCookiesDetails}
        />
        <ConfigurationCard
          icon={<GlobalFolderConfigIcon />}
          title={t.settings.folder.title.toUpperCase()}
          description={t.settings.folder.description}
          status={folderConfig.status}
          detailsComponent={globalFolderDetails}
        />
        <ConfigurationCard
          icon={<AIConfigIcon />}
          title={t.settings.ai.title.toUpperCase()}
          description={t.settings.ai.description}
          status={aiConfig.status}
          detailsComponent={aiConfigurationDetails}
        />
        <ConfigurationCard
          icon={<LanguageIcon />}
          title={t.settings.language.title.toUpperCase()}
          description={t.settings.language.description}
          status={languageConfig.status}
          detailsComponent={(
            <div className="space-y-4">
              <label className="block text-gray-400 text-sm font-bold mb-2" htmlFor="language-select">
                {t.settings.language.selectLanguage}
              </label>
              <select
                id="language-select"
                className="w-full px-3 py-2 bg-zinc-700 text-gray-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors duration-200"
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value as LanguageCode)}
                aria-label={t.settings.language.selectLanguage}
              >
                <option value="en">{t.settings.optionEnglish}</option>
                <option value="id">{t.settings.optionIndonesian}</option>
                <option value="ms">{t.settings.optionMalay}</option>
                <option value="pt">{t.settings.optionPortuguese}</option>
                <option value="es">{t.settings.optionSpanish}</option>
                <option value="fr">{t.settings.optionFrench}</option>
                <option value="ru">{t.settings.optionRussian}</option>
              </select>
              <div className="mt-3 p-3 bg-zinc-800 rounded-lg">
                <p className="text-xs text-gray-400">
                  <strong>{t.settings.noteLabel}</strong> {t.settings.language.description}
                </p>
              </div>
              <div className="flex justify-end space-x-3 mt-4">
                <button
                  onClick={handleSaveLanguage}
                  className={`px-4 py-2 text-white font-medium rounded-lg transition-colors duration-200 ${languageConfig.saveButtonDisabled ? 'bg-gray-600 hover:bg-gray-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                  aria-label={t.settings.saveLabel}
                  disabled={languageConfig.saveButtonDisabled}
                >
                  {languageConfig.saveButtonText}
                </button>
                <button
                  onClick={handleResetLanguage}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors duration-200"
                  aria-label={t.settings.resetBtn}
                >
                  {t.buttons.reset}
                </button>
              </div>
            </div>
          )}
        />
        <ConfigurationCard
          icon={<GlobalWorkflowIcon />}
          title={t.settings.resolution.title.toUpperCase()}
          description={t.settings.resolution.description}
          status={resolutionConfig.status}
          detailsComponent={resolutionDetails}
        />
        <ConfigurationCard
          icon={<CookieConfigIcon />}
          title={t.settings.userAgentTitle}
          description={t.settings.userAgentDescription}
          status={ConfigStatus.Configured}
          detailsComponent={userAgentDetails}
        />
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onConfirm={modalOnConfirm}
        title={modalTitle}
        message={modalMessage}
        confirmButtonText={modalConfirmButtonText}
        cancelButtonText={modalCancelButtonText}
        confirmButtonColor={modalConfirmButtonColor}
        showUpdateLabel={modalShowUpdateLabel}
      />
    </div>
  );
};

export default PengaturanPage;
