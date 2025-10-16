import { supabase } from '@/integrations/supabase/client';

/**
 * Security utilities for safe data handling
 */

// Sanitize user input to prevent XSS
export function sanitizeHtml(input: string): string {
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
}

// Validate and sanitize phone numbers
export function sanitizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '').slice(0, 11);
}

// WARNING: Client-side cache only for UI hints. Never use for security decisions.
// All API calls are protected by server-side RLS policies.
// Check if user has specific role with caching
const roleCache = new Map<string, { roles: Set<string>; timestamp: number }>();
const CACHE_DURATION = 1 * 60 * 1000; // 1 minute (reduced from 5 for security)

type UserRole = 'admin' | 'general_manager' | 'operations_manager' | 'scaffold_supervisor' | 
  'scaffold_worker' | 'contractor' | 'user' | 'finance_manager' | 'sales_manager' | 
  'support_manager' | 'security_manager' | 'warehouse_manager';

export async function hasRole(role: UserRole): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const cached = roleCache.get(user.id);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      return cached.roles.has(role);
    }

    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (error) throw error;

    const roles = new Set(data?.map(r => r.role as string) || []);
    roleCache.set(user.id, { roles, timestamp: now });

    return roles.has(role);
  } catch (error) {
    console.error('Error checking role:', error);
    return false;
  }
}

// Clear role cache (call after role changes)
export function clearRoleCache(userId?: string) {
  if (userId) {
    roleCache.delete(userId);
  } else {
    roleCache.clear();
  }
}

// Rate limiting helper
const rateLimitMap = new Map<string, number[]>();

export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const attempts = rateLimitMap.get(key) || [];
  
  // Remove old attempts outside the window
  const recentAttempts = attempts.filter(time => now - time < windowMs);
  
  if (recentAttempts.length >= maxAttempts) {
    return false;
  }
  
  recentAttempts.push(now);
  rateLimitMap.set(key, recentAttempts);
  return true;
}

// Safe error messages (don't expose sensitive info)
export function getSafeErrorMessage(error: any): string {
  const knownErrors: Record<string, string> = {
    '23505': 'این مورد قبلاً ثبت شده است',
    '23503': 'اطلاعات مورد نظر یافت نشد',
    '42501': 'دسترسی غیرمجاز',
    'PGRST116': 'داده‌ای یافت نشد',
  };

  const errorCode = error?.code || error?.error_code;
  if (errorCode && knownErrors[errorCode]) {
    return knownErrors[errorCode];
  }

  // Don't expose raw error messages to users
  if (process.env.NODE_ENV === 'production') {
    return 'خطایی رخ داده است. لطفاً دوباره تلاش کنید';
  }

  return error?.message || 'خطای نامشخص';
}

// Content Security Policy headers helper
export function getCSPHeaders(): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://gclbltatkbwbqxqqrcea.supabase.co",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://gclbltatkbwbqxqqrcea.supabase.co wss://gclbltatkbwbqxqqrcea.supabase.co",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');
}

// Validate file uploads
export function validateFileUpload(
  file: File,
  maxSizeMB: number = 5,
  allowedTypes: string[] = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
): { valid: boolean; error?: string } {
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'فرمت فایل مجاز نیست'
    };
  }

  const maxSize = maxSizeMB * 1024 * 1024;
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `حجم فایل نباید بیش از ${maxSizeMB} مگابایت باشد`
    };
  }

  return { valid: true };
}
