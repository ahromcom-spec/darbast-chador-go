/** تنظیم شخصی هر کاربر روی این دستگاه: نمایش یا عدم نمایش فیلم‌های راهنمای سایت */
const KEY = 'ahrom:help-videos-enabled';
export const HELP_VIDEO_PREF_EVENT = 'ahrom:help-videos-pref';

export const getHelpVideosEnabled = (): boolean => {
  try {
    return localStorage.getItem(KEY) !== '0';
  } catch {
    return true;
  }
};

export const setHelpVideosEnabled = (enabled: boolean) => {
  try {
    localStorage.setItem(KEY, enabled ? '1' : '0');
  } catch {}
  window.dispatchEvent(new CustomEvent(HELP_VIDEO_PREF_EVENT, { detail: { enabled } }));
};
