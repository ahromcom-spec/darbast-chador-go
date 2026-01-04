/**
 * بررسی اینکه آیا مدیر در حال مشاهده حساب کاربر دیگری است یا خیر
 * در حالت impersonation، نباید اعلان‌ها به کاربر ارسال شود
 */
export const isAdminImpersonating = (): boolean => {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('original_admin_session');
};
