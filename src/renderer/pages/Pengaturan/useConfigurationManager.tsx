// src/pages/Pengaturan/useConfigurationManager.tsx
import { useState, useMemo, useCallback } from 'react';
import { ConfigStatus } from '../../shared/types/types';
import { useLanguage } from '../../shared/i18n';

// Helper function to get initial state from localStorage
const getInitialState = (key: string, defaultValue: string) => {
  const storedValue = localStorage.getItem(key);
  return storedValue !== null ? storedValue : defaultValue;
};

export const useConfigurationManager = () => {
  const { t } = useLanguage();
  // Input States
  const [flowProjectId, setFlowProjectId] = useState(() => getInitialState('zeoStudio.workflow.flowProjectId', ''));
  const [bearerToken, setBearerToken] = useState(() => getInitialState('zeoStudio.bearerToken', ''));
  const [folderOutput, setFolderOutput] = useState(() => getInitialState('zeoStudio.folder.output', ''));
  const [aiProvider, setAiProvider] = useState(() => getInitialState('zeoStudio.ai.provider', 'Gemini'));
  const [aiModel, setAiModel] = useState(() => getInitialState('zeoStudio.ai.model', 'gemini-2.5-flash'));
  const [aiMode, setAiMode] = useState<'single' | 'bulk'>(() => (getInitialState('zeoStudio.ai.mode', 'single') as 'single' | 'bulk'));
  const [aiModeLocked, setAiModeLocked] = useState<'single' | 'bulk' | null>(() => {
    const stored = localStorage.getItem('zeoStudio.ai.lockMode');
    return stored === 'single' || stored === 'bulk' ? stored : null;
  });
  const [apiKey, setApiKey] = useState(() => getInitialState('zeoStudio.ai.apiKey', ''));
  const [apiKeyList, setApiKeyList] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('zeoStudio.ai.keys');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((k) => String(k).trim()).filter((k) => k !== '');
      }
    } catch (_) {
      // ignore parsing error
    }
    return [];
  });
  const [activeAiKeyIndex, setActiveAiKeyIndex] = useState<number>(() => {
    const raw = localStorage.getItem('zeoStudio.ai.activeIndex');
    const idx = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(idx) ? idx : 0;
  });

  // Last saved states
  const [lastSavedFlowProjectId, setLastSavedFlowProjectId] = useState(() => getInitialState('zeoStudio.workflow.flowProjectId', ''));
  const [lastSavedBearerToken, setLastSavedBearerToken] = useState(() => getInitialState('zeoStudio.bearerToken', ''));
  const [lastSavedFolderOutput, setLastSavedFolderOutput] = useState(() => getInitialState('zeoStudio.folder.output', ''));
  const [lastSavedAiProvider, setLastSavedAiProvider] = useState(() => getInitialState('zeoStudio.ai.provider', 'Gemini'));
  const [lastSavedAiModel, setLastSavedAiModel] = useState(() => getInitialState('zeoStudio.ai.model', 'gemini-2.5-flash'));
  const [lastSavedAiMode, setLastSavedAiMode] = useState<'single' | 'bulk'>(() => (getInitialState('zeoStudio.ai.mode', 'single') as 'single' | 'bulk'));
  const [lastSavedAiModeLocked, setLastSavedAiModeLocked] = useState<'single' | 'bulk' | null>(() => {
    const stored = localStorage.getItem('zeoStudio.ai.lockMode');
    return stored === 'single' || stored === 'bulk' ? stored : null;
  });
  const [lastSavedApiKey, setLastSavedApiKey] = useState(() => getInitialState('zeoStudio.ai.apiKey', ''));
  const [lastSavedApiKeyList, setLastSavedApiKeyList] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('zeoStudio.ai.keys');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((k) => String(k).trim()).filter((k) => k !== '');
      }
    } catch (_) {
      // ignore parsing error
    }
    return [];
  });
  const [lastSavedActiveAiKeyIndex, setLastSavedActiveAiKeyIndex] = useState<number>(() => {
    const raw = localStorage.getItem('zeoStudio.ai.activeIndex');
    const idx = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(idx) ? idx : 0;
  });

  // Derived configs
  const bearerTokenConfig = useMemo(() => {
    const isModified = bearerToken !== lastSavedBearerToken || flowProjectId !== lastSavedFlowProjectId;
    const isConfigured = bearerToken.trim() !== '';
    const saveButtonDisabled = !isModified;
    const saveButtonText = isModified ? t.settings.saveLabel : (isConfigured ? t.settings.savedLabel : t.settings.saveLabel);
    const status = isConfigured ? ConfigStatus.Configured : ConfigStatus.NotConfigured;
    return { isModified, isConfigured, saveButtonDisabled, saveButtonText, status };
  }, [bearerToken, flowProjectId, lastSavedBearerToken, lastSavedFlowProjectId, t]);

  const folderConfig = useMemo(() => {
    const isModified = folderOutput !== lastSavedFolderOutput;
    const isConfigured = folderOutput.trim() !== '';
    const saveButtonDisabled = !isModified;
    const saveButtonText = isModified ? t.settings.saveLabel : (isConfigured ? t.settings.savedLabel : t.settings.saveLabel);
    const status = isConfigured ? ConfigStatus.Configured : ConfigStatus.NotConfigured;
    return { isModified, isConfigured, saveButtonDisabled, saveButtonText, status };
  }, [folderOutput, lastSavedFolderOutput, t]);

  const aiConfig = useMemo(() => {
    const listEqual = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);
    const isModified =
      aiProvider !== lastSavedAiProvider ||
      aiModel !== lastSavedAiModel ||
      aiMode !== lastSavedAiMode ||
      aiModeLocked !== lastSavedAiModeLocked ||
      (aiMode === 'single' ? apiKey !== lastSavedApiKey : !listEqual(apiKeyList, lastSavedApiKeyList)) ||
      (aiMode === 'bulk' && activeAiKeyIndex !== lastSavedActiveAiKeyIndex);

    const hasKeys = aiMode === 'single'
      ? apiKey.trim() !== ''
      : apiKeyList.filter((k) => k.trim() !== '').length > 0;
    const isConfigured = aiProvider.trim() !== '' && aiModel.trim() !== '' && hasKeys;
    const saveButtonDisabled = !isModified;
    const saveButtonText = isModified ? t.settings.saveLabel : (isConfigured ? t.settings.savedLabel : t.settings.saveLabel);
    const status = isConfigured ? ConfigStatus.Configured : ConfigStatus.NotConfigured;
    return { isModified, isConfigured, saveButtonDisabled, saveButtonText, status };
  }, [aiProvider, aiModel, apiKey, aiMode, apiKeyList, activeAiKeyIndex, lastSavedAiProvider, lastSavedAiModel, lastSavedAiMode, lastSavedApiKey, lastSavedApiKeyList, lastSavedActiveAiKeyIndex, t]);

  const isAnyConfigModified = useMemo(() => {
    return bearerTokenConfig.isModified || folderConfig.isModified || aiConfig.isModified;
  }, [bearerTokenConfig.isModified, folderConfig.isModified, aiConfig.isModified]);

  // Save handlers
  const handleSaveConfig = useCallback((configType: string): { success: boolean, message: string } => {
    try {
      switch (configType) {
        case "Global Bearer Token":
          if (bearerToken.trim() === '') {
            throw new Error(t.settings.bearerTokenEmpty);
          }
          localStorage.setItem('zeoStudio.bearerToken', bearerToken);
          if (flowProjectId && flowProjectId.trim() !== '') {
            localStorage.setItem('zeoStudio.workflow.flowProjectId', flowProjectId);
          } else {
            localStorage.removeItem('zeoStudio.workflow.flowProjectId');
          }
          setLastSavedBearerToken(bearerToken);
          setLastSavedFlowProjectId(flowProjectId);
          break;
        case "Global Folder Configuration":
          if (folderOutput.trim() === '') {
            throw new Error(t.settings.folderOutputEmpty);
          }
          localStorage.setItem('zeoStudio.folder.output', folderOutput);
          setLastSavedFolderOutput(folderOutput);
          break;
        case "AI Configuration": {
          const normalizedList = apiKeyList.map((k) => k.trim()).filter((k) => k !== '');
          if (aiProvider.trim() === '' || aiModel.trim() === '') {
            throw new Error(t.settings.aiFieldsRequired);
          }
          if (aiMode === 'single' && apiKey.trim() === '') {
            throw new Error(t.settings.aiFieldsRequired);
          }
          if (aiMode === 'bulk' && normalizedList.length === 0) {
            throw new Error(t.settings.aiFieldsRequired);
          }
          localStorage.setItem('zeoStudio.ai.provider', aiProvider);
          localStorage.setItem('zeoStudio.ai.model', aiModel);
          localStorage.setItem('zeoStudio.ai.mode', aiMode);
          localStorage.setItem('zeoStudio.ai.lockMode', aiMode);
          if (aiMode === 'single') {
            localStorage.setItem('zeoStudio.ai.apiKey', apiKey);
            localStorage.removeItem('zeoStudio.ai.keys');
            localStorage.setItem('zeoStudio.ai.activeIndex', '0');
            setActiveAiKeyIndex(0);
            setLastSavedActiveAiKeyIndex(0);
            setLastSavedApiKeyList([]);
          } else {
            const safeIndex = normalizedList[activeAiKeyIndex] ? activeAiKeyIndex : 0;
            const activeKey = normalizedList[safeIndex] || '';
            localStorage.setItem('zeoStudio.ai.keys', JSON.stringify(normalizedList));
            localStorage.setItem('zeoStudio.ai.apiKey', activeKey);
            localStorage.setItem('zeoStudio.ai.activeIndex', String(safeIndex));
            setApiKey(activeKey);
            setActiveAiKeyIndex(safeIndex);
            setLastSavedActiveAiKeyIndex(safeIndex);
            setLastSavedApiKeyList(normalizedList);
          }
          setLastSavedAiProvider(aiProvider);
          setLastSavedAiModel(aiModel);
          setLastSavedAiMode(aiMode);
          setAiModeLocked(aiMode);
          setLastSavedAiModeLocked(aiMode);
          setLastSavedApiKey(apiKey);
          break;
        }
        default:
          throw new Error(t.settings.unknownConfigType);
      }
      return { success: true, message: t.settings.configSavedMsg.replace('{config}', configType) };
    } catch (error: any) {
      return { success: false, message: error.message || t.settings.configSaveError };
    }
  }, [flowProjectId, bearerToken, folderOutput, aiProvider, aiModel, apiKey, t]);

  const handleSaveAllConfigurations = useCallback((): { success: boolean, message: string } => {
    const bearerTokenResult = handleSaveConfig("Global Bearer Token");
    const folderResult = handleSaveConfig("Global Folder Configuration");
    const aiResult = handleSaveConfig("AI Configuration");

    const allSuccess = bearerTokenResult.success && folderResult.success && aiResult.success;

    if (allSuccess) {
      return { success: true, message: t.settings.allConfigsSaved };
    }

    const messages = [
      bearerTokenResult.success ? null : bearerTokenResult.message,
      folderResult.success ? null : folderResult.message,
      aiResult.success ? null : aiResult.message,
    ].filter(Boolean);

    return { success: false, message: messages.join('\n') || t.settings.someConfigsFailed };
  }, [handleSaveConfig]);

  // Reset handlers
  const handleResetConfig = useCallback((configType: string): { success: boolean, message: string } => {
    try {
      switch (configType) {
        case "Global Bearer Token":
          setBearerToken('');
          setFlowProjectId('');
          localStorage.removeItem('zeoStudio.bearerToken');
          localStorage.removeItem('zeoStudio.workflow.flowProjectId');
          setLastSavedBearerToken('');
          setLastSavedFlowProjectId('');
          break;
        case "Global Folder Configuration":
          setFolderOutput('');
          localStorage.removeItem('zeoStudio.folder.output');
          setLastSavedFolderOutput('');
          break;
        case "AI Configuration":
          setAiProvider('Gemini');
          setAiModel('gemini-2.5-flash');
          setAiMode('single');
          setAiModeLocked(null);
          setApiKey('');
          setApiKeyList([]);
          setActiveAiKeyIndex(0);
          localStorage.removeItem('zeoStudio.ai.provider');
          localStorage.removeItem('zeoStudio.ai.model');
          localStorage.removeItem('zeoStudio.ai.apiKey');
          localStorage.removeItem('zeoStudio.ai.mode');
          localStorage.removeItem('zeoStudio.ai.lockMode');
          localStorage.removeItem('zeoStudio.ai.keys');
          localStorage.removeItem('zeoStudio.ai.activeIndex');
          setLastSavedAiProvider('Gemini');
          setLastSavedAiModel('gemini-2.5-flash');
          setLastSavedAiMode('single');
          setLastSavedAiModeLocked(null);
          setLastSavedApiKey('');
          setLastSavedApiKeyList([]);
          setLastSavedActiveAiKeyIndex(0);
          break;
        default:
          throw new Error(t.settings.unknownConfigType);
      }
      return { success: true, message: t.settings.configResetMsg.replace('{config}', configType) };
    } catch (error: any) {
      return { success: false, message: error.message || t.settings.configResetError };
    }
  }, [t]);

  // Clear all configurations
  const clearAllConfigurations = useCallback(() => {
    setFlowProjectId('');
    setBearerToken('');
    setFolderOutput('');
    setAiProvider('Gemini');
    setAiModel('gemini-2.5-flash');
    setAiMode('single');
    setAiModeLocked(null);
    setApiKey('');
    setApiKeyList([]);
    setActiveAiKeyIndex(0);

    localStorage.removeItem('zeoStudio.workflow.flowProjectId');
    localStorage.removeItem('zeoStudio.bearerToken');
    localStorage.removeItem('zeoStudio.folder.output');
    localStorage.removeItem('zeoStudio.ai.provider');
    localStorage.removeItem('zeoStudio.ai.model');
    localStorage.removeItem('zeoStudio.ai.apiKey');
    localStorage.removeItem('zeoStudio.ai.mode');
    localStorage.removeItem('zeoStudio.ai.lockMode');
    localStorage.removeItem('zeoStudio.ai.keys');
    localStorage.removeItem('zeoStudio.ai.activeIndex');

    setLastSavedFlowProjectId('');
    setLastSavedBearerToken('');
    setLastSavedFolderOutput('');
    setLastSavedAiProvider('Gemini');
    setLastSavedAiModel('gemini-2.5-flash');
    setLastSavedAiMode('single');
    setLastSavedAiModeLocked(null);
    setLastSavedApiKey('');
    setLastSavedApiKeyList([]);
    setLastSavedActiveAiKeyIndex(0);
  }, []);

  return {
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
  };
};
