import type { AppError, ErrorCode } from '@/types/medknow';

/**
 * Client-side error classification (EF-15, § 9.5). HTTP codes and network
 * failures map to localized, actionable error codes.
 */

export class MedknowApiError extends Error {
  constructor(public readonly appError: AppError) {
    super(appError.code);
    this.name = 'MedknowApiError';
  }
}

export function classifyHttpError(status: number, body?: { error?: { retryAfterSec?: number } }): AppError {
  switch (status) {
    case 400:
      return { code: 'INVALID_INPUT', retryable: false };
    case 413:
      return { code: 'PAYLOAD_TOO_LARGE', retryable: false };
    case 422:
      return { code: 'SCHEMA_INVALID', retryable: true };
    case 429:
      return { code: 'RATE_LIMITED', retryable: true, retryAfterSec: body?.error?.retryAfterSec ?? 30 };
    case 504:
      return { code: 'TIMEOUT', retryable: true };
    case 502:
    case 503:
      return { code: 'UPSTREAM_UNAVAILABLE', retryable: true };
    default:
      return { code: 'UNKNOWN', retryable: status >= 500 };
  }
}

export function isOfflineError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (err instanceof TypeError) return true; // fetch network failure
  return false;
}

export function wasAborted(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}
