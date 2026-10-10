import type { Analysis, AppError } from '@/types/medknow';
import { MedknowApiError, classifyHttpError, isOfflineError, wasAborted } from './errors';

/**
 * /api/analyze client (spec § 6.2 AnalyzeClient). At most 2 automatic retries
 * per action for retryable failures (CA-15.4), with a short backoff.
 */

const BASE = '/api/analyze';
const MAX_AUTO_RETRIES = 2;

export interface AnalyzeRequestBody {
  mode: 'analyze' | 'translate' | 'manual';
  lang: Analysis['lang'];
  image?: { mimeType: string; data: string };
  analysis?: Analysis;
  names?: string[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postOnce(body: AnalyzeRequestBody, signal: AbortSignal): Promise<Analysis> {
  let response: Response;
  try {
    response = await fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (wasAborted(err)) throw err;
    throw new MedknowApiError({ code: isOfflineError(err) ? 'OFFLINE' : 'NETWORK', retryable: true });
  }

  if (!response.ok) {
    let errBody: { error?: { retryAfterSec?: number } } | undefined;
    try {
      errBody = (await response.json()) as { error?: { retryAfterSec?: number } };
    } catch {
      // no body or non-JSON error
    }
    throw new MedknowApiError(classifyHttpError(response.status, errBody));
  }

  const data = (await response.json()) as { analysis?: Analysis };
  if (!data.analysis) {
    throw new MedknowApiError({ code: 'SCHEMA_INVALID', retryable: true });
  }
  return data.analysis;
}

/** POST with automatic retries for retryable errors. Aborts propagate. */
export async function analyzeRequest(body: AnalyzeRequestBody, signal?: AbortSignal): Promise<Analysis> {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await postOnce(body, signal ?? new AbortController().signal);
    } catch (err) {
      if (wasAborted(err)) throw err;
      const retryable = err instanceof MedknowApiError && err.appError.retryable;
      if (!retryable || attempt >= MAX_AUTO_RETRIES) throw err;
      const retryAfter =
        err instanceof MedknowApiError && err.appError.retryAfterSec
          ? Math.min(err.appError.retryAfterSec * 1000, 5000)
          : 1000 * (attempt + 1);
      await sleep(retryAfter);
      attempt += 1;
    }
  }
}

/** Converts any thrown error into a displayable AppError (EF-15). */
export function toAppError(err: unknown): AppError {
  if (err instanceof MedknowApiError) return err.appError;
  if (wasAborted(err)) return { code: 'UNKNOWN', retryable: false };
  if (isOfflineError(err)) return { code: 'OFFLINE', retryable: true };
  return { code: 'UNKNOWN', retryable: true };
}
