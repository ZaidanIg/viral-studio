import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getNavIconById } from '../constants/constants';

type TestStatus = 'idle' | 'testing' | 'ok' | 'fail';

type PageHeaderProps = {
  icon?: React.ReactNode;
  /** Use sidebar nav icon by id to keep header + sidebar consistent */
  iconId?: string;
  /** Override icon size/color classes (defaults to white h-6 w-6) */
  iconClassName?: string;
  title: string;
  description?: string;
  /**
   * Control whether the bearer token test is relevant for the page.
   * When false, the bearer test button is hidden and readiness ignores bearer status.
   */
  showBearerTest?: boolean;
  /**
   * Control whether the API key test is relevant for the page.
   * When false, the API key test is hidden and readiness ignores API key status.
   */
  showApiKeyTest?: boolean;

  /** Optional required bearer "jenis" (e.g., "image"). If set, bearer test passes only when jenis matches. */
  requiredBearerJenis?: string | string[];

  /** Optional tutorial video URL (YouTube). When provided, a blue "Tutorial" button appears. */
  tutorialUrl?: string;
  /** Optional title for tutorial modal. Defaults to "Tutorial". */
  tutorialTitle?: string;
  /** Control tutorial behavior: popover (default) or direct open like Settings header. */
  tutorialMode?: 'popover' | 'direct';
};

const KEY_BEARER_STATUS = 'zeoStudio.authTest.bearer.status';
const KEY_APIKEY_STATUS = 'zeoStudio.authTest.apiKey.status';
// Removed credit display (no longer needed)

const readStatus = (key: string): TestStatus => {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === 'ok' || raw === 'fail') return raw;
    return 'idle';
  } catch {
    return 'idle';
  }
};

const writeStatus = (key: string, value: TestStatus) => {
  try {
    if (value === 'ok' || value === 'fail') {
      window.localStorage.setItem(key, value);
      return;
    }
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
};

const PageHeader: React.FC<PageHeaderProps> = ({
  icon,
  iconId,
  iconClassName,
  title,
  description,
  showBearerTest = true,
  showApiKeyTest = true,
  requiredBearerJenis,
  tutorialUrl,
  tutorialTitle = 'Tutorial',
  tutorialMode = 'popover',
}) => {
  const [bearerStatus, setBearerStatus] = useState<TestStatus>(() => readStatus(KEY_BEARER_STATUS));
  const [apiKeyStatus, setApiKeyStatus] = useState<TestStatus>(() => readStatus(KEY_APIKEY_STATUS));

  const [bearerMessage, setBearerMessage] = useState<string>('');
  const [apiKeyMessage, setApiKeyMessage] = useState<string>('');

  const isBearerRelevant = showBearerTest;
  const isApiKeyRelevant = showApiKeyTest;

  const [isTutorialOpen, setTutorialOpen] = useState(false);

  const openTutorialUrl = useCallback(() => {
    if (!tutorialUrl) return;
    const url = tutorialUrl.replace('/embed/', '/watch?v=');
    const api = (window as any).zeoAPI;
    if (api?.openTutorialWindow) {
      api.openTutorialWindow({ url });
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, [tutorialUrl]);

  const isReady = useMemo(
    () => (isBearerRelevant ? bearerStatus === 'ok' : true) && (isApiKeyRelevant ? apiKeyStatus === 'ok' : true),
    [apiKeyStatus, bearerStatus, isApiKeyRelevant, isBearerRelevant],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncStatusFromStorage = () => {
      const nextBearer = readStatus(KEY_BEARER_STATUS);
      const nextApiKey = readStatus(KEY_APIKEY_STATUS);

      setBearerStatus((prev) => (prev === 'testing' ? prev : nextBearer));
      setApiKeyStatus((prev) => (prev === 'testing' ? prev : nextApiKey));

      if (nextBearer !== 'fail') setBearerMessage('');
      if (nextApiKey !== 'fail') setApiKeyMessage('');
    };

    const onReadyChanged = () => syncStatusFromStorage();
    window.addEventListener('zeo:auth-ready-changed', onReadyChanged as EventListener);

    return () => {
      window.removeEventListener('zeo:auth-ready-changed', onReadyChanged as EventListener);
    };
  }, []);

  const hasAnyFailure = useMemo(
    () => (isBearerRelevant && bearerStatus === 'fail') || (isApiKeyRelevant && apiKeyStatus === 'fail'),
    [apiKeyStatus, bearerStatus, isApiKeyRelevant, isBearerRelevant],
  );

  const testBearer = useCallback(async () => {
    setBearerMessage('');

    const bearerToken = (() => {
      try {
        if (requiredBearerJenis) {
          const jenisKey = Array.isArray(requiredBearerJenis)
            ? requiredBearerJenis[0]
            : requiredBearerJenis;
          const specificToken = window.localStorage.getItem(`zeoStudio.bearerToken.${jenisKey.trim().toLowerCase()}`);
          if (specificToken) return specificToken;
        }
        return window.localStorage.getItem('zeoStudio.bearerToken') || '';
      } catch {
        return '';
      }
    })();

    if (!bearerToken.trim()) {
      setBearerStatus('fail');
      writeStatus(KEY_BEARER_STATUS, 'fail');
      setBearerMessage('Bearer token belum diatur di Pengaturan.');
      try {
        window.dispatchEvent(new CustomEvent('zeo:auth-ready-changed', { detail: { ready: false } }));
      } catch {
        // ignore
      }
      return;
    }

    if (!window.zeoAPI?.testBearerToken) {
      setBearerStatus('fail');
      writeStatus(KEY_BEARER_STATUS, 'fail');
      setBearerMessage('Bridge Electron belum aktif. Jalankan versi desktop untuk test server.');
      try {
        window.dispatchEvent(new CustomEvent('zeo:auth-ready-changed', { detail: { ready: false } }));
      } catch {
        // ignore
      }
      return;
    }

    setBearerStatus('testing');

    const result = await window.zeoAPI.testBearerToken({ bearerToken });

    if (result && result.ok) {
      setBearerStatus('ok');
      writeStatus(KEY_BEARER_STATUS, 'ok');
      setBearerMessage('');
      try {
        const nextReady = (isApiKeyRelevant ? readStatus(KEY_APIKEY_STATUS) === 'ok' : true) && (isBearerRelevant ? true : true);
        window.dispatchEvent(new CustomEvent('zeo:auth-ready-changed', { detail: { ready: nextReady } }));
      } catch {
        // ignore
      }
      return;
    }

    setBearerStatus('fail');
    writeStatus(KEY_BEARER_STATUS, 'fail');
    setBearerMessage(result && typeof result.error === 'string' ? result.error : 'Test server gagal.');
    try {
      window.dispatchEvent(new CustomEvent('zeo:auth-ready-changed', { detail: { ready: false } }));
    } catch {
      // ignore
    }
  }, [apiKeyStatus, requiredBearerJenis]);

  const testApiKey = useCallback(async () => {
    try {
      setApiKeyMessage('');

      const apiKey = (() => {
        try {
          return window.localStorage.getItem('zeoStudio.ai.apiKey') || '';
        } catch {
          return '';
        }
      })();

      const provider = (() => {
        try {
          return window.localStorage.getItem('zeoStudio.ai.provider') || '';
        } catch {
          return '';
        }
      })();

      const model = (() => {
        try {
          return window.localStorage.getItem('zeoStudio.ai.model') || '';
        } catch {
          return '';
        }
      })();

      // Debug helper: visible in DevTools
      try {
        // eslint-disable-next-line no-console
        console.log('[PageHeader] Test ApiKey clicked', {
          hasBridge: typeof window !== 'undefined' && !!window.zeoAPI,
          hasTestApiKey: typeof window !== 'undefined' && typeof window.zeoAPI?.testApiKey,
          provider,
          model,
          apiKeyLength: apiKey ? apiKey.length : 0,
        });
      } catch {
        // ignore
      }

      if (!apiKey.trim()) {
        setApiKeyStatus('fail');
        writeStatus(KEY_APIKEY_STATUS, 'fail');
        setApiKeyMessage('API key belum diatur di Pengaturan.');
        try {
          window.dispatchEvent(new CustomEvent('zeo:auth-ready-changed', { detail: { ready: false } }));
        } catch {
          // ignore
        }
        return;
      }

      if (!window.zeoAPI?.testApiKey) {
        setApiKeyStatus('fail');
        writeStatus(KEY_APIKEY_STATUS, 'fail');
        setApiKeyMessage('Bridge Electron belum aktif. Jalankan versi desktop untuk test api key.');
        try {
          window.dispatchEvent(new CustomEvent('zeo:auth-ready-changed', { detail: { ready: false } }));
        } catch {
          // ignore
        }
        return;
      }

      setApiKeyStatus('testing');

      const result = await window.zeoAPI.testApiKey({ apiKey, provider, model });

      if (result && result.ok) {
        setApiKeyStatus('ok');
        writeStatus(KEY_APIKEY_STATUS, 'ok');
        setApiKeyMessage('');
        try {
          const nextReady = (isBearerRelevant ? readStatus(KEY_BEARER_STATUS) === 'ok' : true) && (isApiKeyRelevant ? true : true);
          window.dispatchEvent(new CustomEvent('zeo:auth-ready-changed', { detail: { ready: nextReady } }));
        } catch {
          // ignore
        }
        return;
      }

      setApiKeyStatus('fail');
      writeStatus(KEY_APIKEY_STATUS, 'fail');
      setApiKeyMessage(result && typeof result.error === 'string' ? result.error : 'Test api key gagal.');
      try {
        window.dispatchEvent(new CustomEvent('zeo:auth-ready-changed', { detail: { ready: false } }));
      } catch {
        // ignore
      }
    } catch (err: any) {
      try {
        // eslint-disable-next-line no-console
        console.error('[PageHeader] Test ApiKey failed with exception:', err);
      } catch {
        // ignore
      }
      setApiKeyStatus('fail');
      writeStatus(KEY_APIKEY_STATUS, 'fail');
      setApiKeyMessage(err && err.message ? String(err.message) : 'Test api key gagal karena error tidak terduga.');
      try {
        window.dispatchEvent(new CustomEvent('zeo:auth-ready-changed', { detail: { ready: false } }));
      } catch {
        // ignore
      }
    }
  }, [bearerStatus]);

  const statusBadgeClasses = isReady
    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-600/40'
    : hasAnyFailure
      ? 'bg-red-500/15 text-red-300 border-red-600/40'
      : 'bg-zinc-800 text-gray-300 border-zinc-700';

  const statusText = isReady ? 'Ready' : 'Not Ready';

  const buttonBase =
    'px-3 py-2 rounded-lg text-xs font-semibold border transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-zinc-950';

  const buttonNeutral = 'border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-gray-100';
  const buttonSuccess = 'border-emerald-600/40 bg-emerald-600/15 hover:bg-emerald-600/20 text-emerald-200';
  const buttonFailure = 'border-red-600/40 bg-red-600/15 hover:bg-red-600/20 text-red-200';
  const buttonDisabled = 'border-zinc-800 bg-zinc-900 text-gray-500 cursor-not-allowed';
  const buttonTutorial = 'border-blue-500 bg-blue-600 hover:bg-blue-500 text-white';

  const getButtonVariant = (status: TestStatus) => {
    if (status === 'ok') return buttonSuccess;
    if (status === 'fail') return buttonFailure;
    return buttonNeutral;
  };

  const derivedIcon = useMemo(() => {
    if (iconId) {
      return getNavIconById(iconId, iconClassName ?? 'h-6 w-6 mr-3 text-white');
    }

    if (icon && React.isValidElement(icon)) {
      const mergedClass = `${icon.props.className ?? ''} text-white`.trim();
      return React.cloneElement(icon, { className: mergedClass });
    }

    return icon ?? null;
  }, [icon, iconClassName, iconId]);

  return (
    <div className="px-6 pt-4 pb-2 border-b border-zinc-800 flex items-center justify-between electron-drag select-none">
      <div className="flex items-center min-w-0">
        {derivedIcon}
        <div className="ml-2 min-w-0">
          <h1 className="text-lg font-semibold tracking-wide text-gray-50 truncate">{title}</h1>
          {description && <p className="text-xs text-gray-400 truncate">{description}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex flex-col items-end">
          <div className="flex items-center gap-2">
            {tutorialUrl && tutorialMode === 'popover' && (
              <button
                type="button"
                onClick={() => setTutorialOpen((v) => !v)}
                className={`electron-no-drag ${buttonBase} ${buttonTutorial}`}
              >
                Tutorial
              </button>
            )}
            {tutorialUrl && tutorialMode === 'direct' && (
              <button
                type="button"
                onClick={openTutorialUrl}
                className={`electron-no-drag ${buttonBase} ${buttonTutorial}`}
                aria-label="Tutorial"
              >
                Tutorial
              </button>
            )}
            {isBearerRelevant && (
              <button
                type="button"
                onClick={testBearer}
                disabled={bearerStatus === 'testing'}
                className={`electron-no-drag ${buttonBase} ${bearerStatus === 'testing' ? buttonDisabled : getButtonVariant(bearerStatus)}`}
                aria-label="Test Server Token"
                title={bearerStatus === 'fail' && bearerMessage ? bearerMessage : ''}
              >
                {bearerStatus === 'testing' ? 'Testing...' : 'Test Server'}
              </button>
            )}
            {isApiKeyRelevant && (
              <button
                type="button"
                onClick={testApiKey}
                disabled={apiKeyStatus === 'testing'}
                className={`electron-no-drag ${buttonBase} ${apiKeyStatus === 'testing' ? buttonDisabled : getButtonVariant(apiKeyStatus)}`}
                aria-label="Test API Key"
                title={apiKeyStatus === 'fail' && apiKeyMessage ? apiKeyMessage : ''}
              >
                {apiKeyStatus === 'testing' ? 'Testing...' : 'Test ApiKey'}
              </button>
            )}
          </div>

          {tutorialUrl && tutorialMode === 'popover' && isTutorialOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl p-3 z-50">
              <p className="text-xs text-gray-300 mb-2">Tonton tutorial singkat halaman ini.</p>
              <button
                type="button"
                onClick={() => {
                  openTutorialUrl();
                  setTutorialOpen(false);
                }}
                className="w-full px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition shadow-md"
              >
                Tonton di YouTube
              </button>
            </div>
          )}
        </div>

        <div className={`px-3 py-2 rounded-xl border ${statusBadgeClasses} bg-zinc-900 min-w-[108px]`}
        >
          <div className="text-[10px] uppercase tracking-wide">Status</div>
          <div className="text-sm font-semibold leading-tight">{statusText}</div>
        </div>

      </div>
    </div>
  );
};

export default PageHeader;
