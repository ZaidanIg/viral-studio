import { useCallback, useEffect, useMemo, useState } from 'react';

export type ImageResolutionOption = '1366x768' | '1920x1080' | '2560x1440';

const KEY_IMAGE_RESOLUTION = 'zeoStudio.image.resolution';

const isAllowed = (value: any): value is ImageResolutionOption => 
  value === '1366x768' || value === '1920x1080' || value === '2560x1440';

const detectResolution = (): ImageResolutionOption => {
  if (typeof window === 'undefined') return '1920x1080';
  
  const width = window.screen.width;
  const height = window.screen.height;
  
  if (width <= 1366 || height <= 768) {
    return '1366x768';
  }

  if (width >= 2560 || height >= 1440) {
    return '2560x1440';
  }
  
  return '1920x1080';
};

export const readImageResolution = (): ImageResolutionOption => {
  if (typeof window === 'undefined') return '1920x1080';
  try {
    const raw = window.localStorage.getItem(KEY_IMAGE_RESOLUTION);
    if (isAllowed(raw)) return raw;
  } catch {
    // ignore and fallback to detection
  }
  return detectResolution();
};

export const writeImageResolution = (value: ImageResolutionOption) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY_IMAGE_RESOLUTION, value);
  } catch {
  }

  try {
    window.dispatchEvent(
      new CustomEvent('zeo:image-resolution-changed', { detail: { imageResolution: value } }),
    );
  } catch {
  }
};

export const useImageResolution = (): [
  ImageResolutionOption,
  (value: ImageResolutionOption) => void,
] => {
  const [value, setValue] = useState<ImageResolutionOption>(() => readImageResolution());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onChanged = (event: Event) => {
      const custom = event as CustomEvent<any>;
      const next = custom && custom.detail ? custom.detail.imageResolution : undefined;
      if (isAllowed(next)) {
        setValue(next);
        return;
      }
      setValue(readImageResolution());
    };

    window.addEventListener('zeo:image-resolution-changed', onChanged as EventListener);
    return () => window.removeEventListener('zeo:image-resolution-changed', onChanged as EventListener);
  }, []);

  const setter = useCallback((next: ImageResolutionOption) => {
    setValue(next);
    writeImageResolution(next);
  }, []);

  return useMemo(() => [value, setter] as const, [setter, value]);
};
