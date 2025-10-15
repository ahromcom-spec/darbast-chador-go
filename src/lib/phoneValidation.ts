/**
 * اعتبارسنجی شماره موبایل ایران
 * @param phone شماره تلفن
 * @returns true اگر شماره معتبر باشد
 */
export function validateIranianPhone(phone: string): boolean {
  // حذف فاصله‌ها و خط تیره‌ها
  const cleaned = phone.replace(/[\s-]/g, '');
  
  // بررسی فرمت: باید 11 رقم باشد و با 09 شروع شود
  const phoneRegex = /^09[0-9]{9}$/;
  return phoneRegex.test(cleaned);
}

/**
 * فرمت کردن شماره موبایل به صورت استاندارد
 * @param phone شماره تلفن
 * @returns شماره فرمت شده (09XX-XXX-XXXX)
 */
export function formatIranianPhone(phone: string): string {
  const cleaned = phone.replace(/[\s-]/g, '');
  
  if (!validateIranianPhone(cleaned)) {
    return phone; // اگر معتبر نیست، همان ورودی را برگردان
  }
  
  // فرمت: 09XX-XXX-XXXX
  return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
}

/**
 * پاکسازی شماره تلفن (حذف کاراکترهای غیرعددی)
 * @param phone شماره تلفن
 * @returns شماره پاکسازی شده
 */
export function cleanPhone(phone: string): string {
  return phone.replace(/\D/g, '');
}
