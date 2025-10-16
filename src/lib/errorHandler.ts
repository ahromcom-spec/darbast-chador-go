import { getSafeErrorMessage } from './security';

/**
 * Centralized error handler for consistent, safe error display
 */

export interface ErrorHandlerOptions {
  /** Custom user-facing title for the error */
  title?: string;
  /** Whether to log error details to console (only in development) */
  logError?: boolean;
  /** Additional context for logging */
  context?: string;
}

/**
 * Handle errors safely without exposing sensitive information
 * 
 * @param error - The error object to handle
 * @param options - Configuration options
 * @returns Object with safe message for display
 */
export function handleError(error: any, options: ErrorHandlerOptions = {}) {
  const { title = 'خطا', logError = true, context } = options;
  
  // Log full error in development only
  if (logError && process.env.NODE_ENV === 'development') {
    console.error(`[Error${context ? ` - ${context}` : ''}]:`, error);
  }
  
  // Return safe message for user display
  const safeMessage = getSafeErrorMessage(error);
  
  return {
    title,
    message: safeMessage,
  };
}

/**
 * Create a toast-ready error object
 */
export function toastError(error: any, title?: string) {
  const { title: errorTitle, message } = handleError(error, { title });
  
  return {
    title: errorTitle,
    description: message,
    variant: 'destructive' as const,
  };
}
