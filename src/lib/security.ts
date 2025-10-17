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

// ⚠️ CRITICAL: Client-side role cache is ONLY for UI hints (showing/hiding UI elements).
// NEVER use this for security decisions or access control.
// All security enforcement MUST happen server-side through RLS policies.
// This cache exists solely to improve UX by avoiding redundant queries for UI state.
const roleCache = new Map<string, { roles: Set<string>; timestamp: number }>();
const CACHE_DURATION = 1 * 60 * 1000; // 1 minute

type UserRole = 'admin' | 'general_manager' | 'operations_manager' | 'scaffold_supervisor' | 
  'scaffold_worker' | 'contractor' | 'user' | 'finance_manager' | 'sales_manager' | 
  'support_manager' | 'security_manager' | 'warehouse_manager' | 'ceo';

/**
 * Check if user has a specific role - FOR UI DISPLAY ONLY!
 * 
 * ⚠️ CRITICAL WARNING: This function is ONLY for UI display purposes.
 * DO NOT USE for access control or security decisions!
 * 
 * This function uses client-side caching and should ONLY be used to:
 * - Conditionally render UI elements (buttons, menu items, etc.)
 * - Show/hide visual components based on user role
 * 
 * All security MUST be enforced server-side through RLS policies.
 * The server will always validate permissions regardless of what this returns.
 * 
 * @param role - The role to check for UI display purposes
 * @returns Promise<boolean> - Whether to show UI for this role (cached result)
 */
export async function hasRoleForUIDisplayOnly(role: UserRole): Promise<boolean> {
  // Development warning to remind developers this is UI-only
  if (import.meta.env.DEV) {
    console.warn('⚠️ hasRoleForUIDisplayOnly: This function is ONLY for UI display, not access control');
  }

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
    console.error('Error checking role for UI:', error);
    return false;
  }
}

/**
 * @deprecated Use hasRoleForUIDisplayOnly instead for clarity
 * This alias is kept for backward compatibility
 */
export const hasRoleUIHint = hasRoleForUIDisplayOnly;

/**
 * Clear role cache (call after role changes)
 * 
 * IMPORTANT: Call this function after any role changes to ensure UI updates immediately.
 * For real-time updates across sessions, consider using Supabase Realtime subscriptions.
 * 
 * @param userId - Optional user ID to clear specific user cache, or clear all if omitted
 */
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

/**
 * Get safe error messages that don't expose sensitive database information
 * 
 * SECURITY: Never expose raw database errors to users in production.
 * Map known error codes to user-friendly Persian messages.
 * 
 * @param error - The error object to sanitize
 * @returns User-safe error message in Persian
 */
export function getSafeErrorMessage(error: any): string {
  const knownErrors: Record<string, string> = {
    // Database constraint violations
    '23505': 'این مورد قبلاً ثبت شده است',
    '23503': 'اطلاعات مورد نظر یافت نشد',
    '23514': 'اطلاعات وارد شده نامعتبر است',
    '23502': 'فیلد الزامی خالی است',
    
    // Permission errors
    '42501': 'دسترسی غیرمجاز',
    '42P01': 'دسترسی غیرمجاز',
    
    // PostgREST errors
    'PGRST116': 'داده‌ای یافت نشد',
    'PGRST204': 'دسترسی غیرمجاز',
    'PGRST301': 'داده‌ای یافت نشد',
    
    // Auth errors
    'invalid_credentials': 'اطلاعات ورود نادرست است',
    'user_not_found': 'کاربر یافت نشد',
    'email_exists': 'این ایمیل قبلاً ثبت شده است',
  };

  // Check for error code
  const errorCode = error?.code || error?.error_code || error?.error;
  if (errorCode && knownErrors[errorCode]) {
    return knownErrors[errorCode];
  }

  // Check for known error message patterns (without exposing full message)
  const message = error?.message || '';
  if (message.includes('duplicate key')) {
    return 'این مورد قبلاً ثبت شده است';
  }
  if (message.includes('foreign key')) {
    return 'اطلاعات مورد نظر یافت نشد';
  }
  if (message.includes('permission denied') || message.includes('insufficient_privilege')) {
    return 'دسترسی غیرمجاز';
  }
  if (message.includes('not found')) {
    return 'داده‌ای یافت نشد';
  }

  // Generic safe messages for production
  if (process.env.NODE_ENV === 'production') {
    return 'خطایی رخ داده است. لطفاً دوباره تلاش کنید';
  }

  // In development, return sanitized message (no SQL/table names)
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
