/**
 * Input validation utilities for Edge Functions
 * Uses zod for robust schema validation
 */

// Define validation schemas
export const phoneSchema = {
  validate: (phone: string): { valid: boolean; error?: string } => {
    if (typeof phone !== 'string') {
      return { valid: false, error: 'شماره تلفن باید رشته متنی باشد' };
    }
    
    if (phone.length > 20) {
      return { valid: false, error: 'شماره تلفن خیلی طولانی است' };
    }
    
    // Check format after normalization
    const normalized = phone.replace(/[^0-9]/g, '');
    
    if (!/^09[0-9]{9}$/.test(normalized) && normalized.length === 11) {
      return { valid: false, error: 'فرمت شماره تلفن نامعتبر است' };
    }
    
    return { valid: true };
  }
};

export const otpSchema = {
  validate: (code: string): { valid: boolean; error?: string } => {
    if (typeof code !== 'string') {
      return { valid: false, error: 'کد تایید باید رشته متنی باشد' };
    }
    
    if (code.length !== 5) {
      return { valid: false, error: 'کد تایید باید 5 رقم باشد' };
    }
    
    if (!/^[0-9]{5}$/.test(code)) {
      return { valid: false, error: 'کد تایید فقط باید شامل اعداد باشد' };
    }
    
    return { valid: true };
  }
};

export const fullNameSchema = {
  validate: (name: string): { valid: boolean; error?: string } => {
    if (!name || typeof name !== 'string') {
      return { valid: false, error: 'نام الزامی است' };
    }
    
    if (name.length > 100) {
      return { valid: false, error: 'نام خیلی طولانی است' };
    }
    
    if (name.length < 3) {
      return { valid: false, error: 'نام باید حداقل 3 کاراکتر باشد' };
    }
    
    return { valid: true };
  }
};

/**
 * Sanitize string input to prevent injection attacks
 */
export function sanitizeString(input: string, maxLength: number = 1000): string {
  if (typeof input !== 'string') return '';
  
  return input
    .slice(0, maxLength)
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .trim();
}
