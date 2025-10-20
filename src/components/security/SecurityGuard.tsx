import { useEffect } from 'react';

export const SecurityGuard = () => {
  useEffect(() => {
    // جلوگیری از باز کردن DevTools
    const detectDevTools = () => {
      const threshold = 160;
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;
      
      if (widthThreshold || heightThreshold) {
        // اگر DevTools باز است، صفحه را خالی کن
        document.body.innerHTML = '';
        window.location.href = 'about:blank';
      }
    };

    // غیرفعال کردن کلیدهای میانبر DevTools
    const disableDevToolsShortcuts = (e: KeyboardEvent) => {
      // F12
      if (e.key === 'F12') {
        e.preventDefault();
        return false;
      }
      
      // Ctrl+Shift+I / Cmd+Option+I
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        return false;
      }
      
      // Ctrl+Shift+J / Cmd+Option+J
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'J') {
        e.preventDefault();
        return false;
      }
      
      // Ctrl+Shift+C / Cmd+Option+C
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        return false;
      }
      
      // Ctrl+U / Cmd+U (View Source)
      if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
        return false;
      }
      
      // Ctrl+S / Cmd+S (Save)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        return false;
      }
    };

    // غیرفعال کردن راست کلیک
    const disableRightClick = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    // غیرفعال کردن انتخاب متن در المان‌های حساس
    const disableTextSelection = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return true;
      }
      e.preventDefault();
      return false;
    };

    // غیرفعال کردن کپی
    const disableCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      return false;
    };

    // بررسی دوره‌ای برای DevTools
    const devToolsInterval = setInterval(detectDevTools, 1000);

    // اضافه کردن event listeners
    document.addEventListener('keydown', disableDevToolsShortcuts);
    document.addEventListener('contextmenu', disableRightClick);
    document.addEventListener('selectstart', disableTextSelection);
    document.addEventListener('copy', disableCopy);

    // پاک کردن console در production
    if (import.meta.env.PROD) {
      console.log = () => {};
      console.warn = () => {};
      console.error = () => {};
      console.info = () => {};
      console.debug = () => {};
    }

    // Cleanup
    return () => {
      clearInterval(devToolsInterval);
      document.removeEventListener('keydown', disableDevToolsShortcuts);
      document.removeEventListener('contextmenu', disableRightClick);
      document.removeEventListener('selectstart', disableTextSelection);
      document.removeEventListener('copy', disableCopy);
    };
  }, []);

  return null;
};
