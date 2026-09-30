/**
 * جلوگیری از نمایش راهنماهای ویدیویی شناور در صفحه‌ای که آن‌ها را نمی‌خواهد
 * (مثلاً تب «لوکیشن اجرایی پروژه» در ماژول گزارش روزانه).
 * هر صفحه با فراخوانی setFloatingHelpSuppressed(true) راهنماها را پنهان می‌کند
 * و با unmount یا خروج از حالت، دوباره آزاد می‌شود.
 */
export const FLOATING_HELP_SUPPRESS_EVENT = 'ahrom:floating-help-suppress';

export const setFloatingHelpSuppressed = (suppressed: boolean) => {
  window.dispatchEvent(new CustomEvent(FLOATING_HELP_SUPPRESS_EVENT, { detail: { suppressed } }));
};
