import { useEffect, useMemo, useState } from 'react';

type TestStatus = 'ok' | 'fail' | 'idle';

const KEY_BEARER_STATUS = 'zeoStudio.authTest.bearer.status';
const KEY_APIKEY_STATUS = 'zeoStudio.authTest.apiKey.status';

const readStatus = (key: string): TestStatus => {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === 'ok' || raw === 'fail') return raw;
    return 'idle';
  } catch {
    return 'idle';
  }
};

export const isAuthReady = (): boolean => {
  if (typeof window === 'undefined') return false;
  const bearer = readStatus(KEY_BEARER_STATUS);
  const apiKey = readStatus(KEY_APIKEY_STATUS);
  return bearer === 'ok' && apiKey === 'ok';
};

export const useAuthReady = (): boolean => {
  const [ready, setReady] = useState<boolean>(() => isAuthReady());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onReadyChanged = (event: Event) => {
      const custom = event as CustomEvent<any>;
      if (custom && custom.detail && typeof custom.detail.ready === 'boolean') {
        setReady(custom.detail.ready);
        return;
      }
      setReady(isAuthReady());
    };

    window.addEventListener('zeo:auth-ready-changed', onReadyChanged as EventListener);
    return () => window.removeEventListener('zeo:auth-ready-changed', onReadyChanged as EventListener);
  }, []);

  return useMemo(() => ready, [ready]);
};
