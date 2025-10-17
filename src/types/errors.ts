// Error Types for the application

export type ErrorType =
  | 'network_error'
  | 'auth_error'
  | 'permission_error'
  | 'not_found'
  | 'validation_error'
  | 'server_error'
  | 'unknown_error';

export interface AppError {
  type: ErrorType;
  message: string;
  userMessage: string;
  originalError?: any;
  timestamp: Date;
}

// Common error messages for users
export const ERROR_MESSAGES: Record<ErrorType, string> = {
  network_error: 'Connection problem. Please check your internet and try again.',
  auth_error: 'Authentication failed. Please login again.',
  permission_error: 'You don\'t have permission for this action.',
  not_found: 'The requested item was not found.',
  validation_error: 'Please check your input and try again.',
  server_error: 'Something went wrong on our end. Please try again later.',
  unknown_error: 'An unexpected error occurred. Please try again.'
};

// Supabase error codes mapping
export const SUPABASE_ERROR_MAP: Record<string, ErrorType> = {
  'PGRST116': 'not_found',
  '23505': 'validation_error',
  '42501': 'permission_error',
  '08006': 'network_error',
  '28P01': 'auth_error',
  '22P02': 'validation_error'
};