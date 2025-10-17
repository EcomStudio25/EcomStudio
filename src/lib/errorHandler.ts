import { AppError, ErrorType, ERROR_MESSAGES, SUPABASE_ERROR_MAP } from '@/types/errors';

/**
 * Central error handler for the application
 * Converts any error to a user-friendly message
 */
export function handleError(error: any, context?: string): AppError {
  const timestamp = new Date();
  
  // Log error for developers (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.error(`[Error Handler${context ? ` - ${context}` : ''}]:`, {
      error,
      timestamp: timestamp.toISOString()
    });
  }

  // Determine error type
  const errorType = determineErrorType(error);
  
  // Get user-friendly message
  const userMessage = ERROR_MESSAGES[errorType];
  
  // Get technical message
  const message = error?.message || 'Unknown error occurred';

  return {
    type: errorType,
    message,
    userMessage,
    originalError: error,
    timestamp
  };
}

/**
 * Determines the type of error based on error object
 */
function determineErrorType(error: any): ErrorType {
  // Check if it's a network error
  if (
    error?.message?.toLowerCase().includes('network') ||
    error?.message?.toLowerCase().includes('fetch') ||
    error?.message?.toLowerCase().includes('connection') ||
    error?.code === 'ECONNREFUSED' ||
    error?.code === 'ETIMEDOUT'
  ) {
    return 'network_error';
  }

  // Check Supabase specific errors
  if (error?.code && SUPABASE_ERROR_MAP[error.code]) {
    return SUPABASE_ERROR_MAP[error.code];
  }

  // Check for authentication errors
  if (
    error?.message?.toLowerCase().includes('auth') ||
    error?.message?.toLowerCase().includes('unauthorized') ||
    error?.message?.toLowerCase().includes('token') ||
    error?.status === 401
  ) {
    return 'auth_error';
  }

  // Check for permission errors
  if (
    error?.message?.toLowerCase().includes('permission') ||
    error?.message?.toLowerCase().includes('forbidden') ||
    error?.status === 403
  ) {
    return 'permission_error';
  }

  // Check for not found errors
  if (
    error?.message?.toLowerCase().includes('not found') ||
    error?.status === 404 ||
    error?.code === 'PGRST116'
  ) {
    return 'not_found';
  }

  // Check for validation errors
  if (
    error?.message?.toLowerCase().includes('invalid') ||
    error?.message?.toLowerCase().includes('validation') ||
    error?.status === 400 ||
    error?.status === 422
  ) {
    return 'validation_error';
  }

  // Check for server errors
  if (
    error?.status >= 500 ||
    error?.message?.toLowerCase().includes('server')
  ) {
    return 'server_error';
  }

  // Default to unknown error
  return 'unknown_error';
}

/**
 * Async wrapper for error handling
 * Usage: await safeAsync(() => someAsyncFunction())
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  context?: string
): Promise<{ data: T | null; error: AppError | null }> {
  try {
    const data = await fn();
    return { data, error: null };
  } catch (error) {
    return { data: null, error: handleError(error, context) };
  }
}

/**
 * Check if an error is of a specific type
 */
export function isErrorType(error: AppError, type: ErrorType): boolean {
  return error.type === type;
}

/**
 * Format error for logging
 */
export function formatErrorForLog(error: AppError): string {
  return `[${error.timestamp.toISOString()}] ${error.type}: ${error.message}`;
}