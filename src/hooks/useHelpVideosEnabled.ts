import { useEffect, useState } from 'react';

const KEY = 'ahrom_help_videos_enabled';
const EVENT = 'ahrom-help-videos-enabled-change';

export const getHelpVideosEnabled = () => {
  try {
    return localStorage.getItem(KEY) !== 'false';
  } catch {
    return true;
  }
};

export const setHelpVideosEnabled = (enabled: boolean) => {
  try {
    localStorage.setItem(KEY, String(enabled));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: enabled }));
};

/** تنظیم «نمایش فیلم‌های راهنمای سایت» برای همین دستگاه */
export const useHelpVideosEnabled = () => {
  const [enabled, setEnabled] = useState(getHelpVideosEnabled);
  useEffect(() => {
    const sync = () => setEnabled(getHelpVideosEnabled());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return enabled;
};
