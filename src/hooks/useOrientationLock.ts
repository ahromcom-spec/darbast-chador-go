import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'allow-screen-rotation';

/**
 * قفل چرخش صفحه روی موبایل.
 * به‌صورت پیش‌فرض سایت همیشه عمودی (portrait) می‌ماند، حتی اگر کاربر گوشی را
 * افقی بگیرد. تنها زمانی که کاربر کلید چرخش را فعال کند، صفحه با گوشی می‌چرخد.
 */
export const useOrientationLock = () => {
  const [allowRotation, setAllowRotation] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const root = document.documentElement;

    if (allowRotation) {
      root.removeAttribute('data-orientation-lock');
      try {
        const o: any = (screen as any)?.orientation;
        if (o && typeof o.unlock === 'function') o.unlock();
      } catch {}
    } else {
      root.setAttribute('data-orientation-lock', 'portrait');
      // در PWA نصب‌شده اندروید می‌توان قفل واقعی گرفت (در مرورگر خطا می‌دهد و نادیده گرفته می‌شود)
      try {
        const o: any = (screen as any)?.orientation;
        if (o && typeof o.lock === 'function') {
          const p = o.lock('portrait');
          if (p && typeof p.catch === 'function') p.catch(() => {});
        }
      } catch {}
    }

    try {
      localStorage.setItem(STORAGE_KEY, String(allowRotation));
    } catch {}
  }, [allowRotation]);

  const toggleRotation = useCallback(() => setAllowRotation((p) => !p), []);

  return { allowRotation, setAllowRotation, toggleRotation };
};
