import { NextResponse } from 'next/server';
import { apiRequestSchema, analysisSchema, modelAnalysisSchema, MAX_IMAGE_BYTES } from '@/lib/ai/schema';
import { getProviderChain, ProviderError } from '@/lib/ai/provider';
import { extractJson, completeAnalysis, mergeTranslation } from '@/lib/ai/complete';
import { MissingProviderConfigError, SchemaInvalidError, runProviderChain } from '@/lib/ai/run-analysis';
import { checkRateLimit, clientKeyFromHeaders } from '@/lib/rate-limit';
import type { ZodAnalysis } from '@/lib/ai/schema';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_REQUEST_BYTES = 4_000_000; // under the Vercel ~4.5 MB body limit

function logEvent(code: string, durationMs: number, bytes: number): void {
  // BS-04 / EXN-26: logs never contain image, text or result content.
  console.log(
    JSON.stringify({ ts: new Date().toISOString(), route: 'analyze', code, durationMs, bytes }),
  );
}

function errorResponse(
  status: number,
  code: string,
  retryable: boolean,
  retryAfterSec?: number,
  durationMs = 0,
  bytes = 0,
): NextResponse {
  if (status >= 500) logEvent(code, durationMs, bytes);
  const headers: Record<string, string> = {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  };
  if (retryAfterSec) headers['Retry-After'] = String(retryAfterSec);
  return NextResponse.json({ error: { code, retryable, ...(retryAfterSec ? { retryAfterSec } : {}) } }, { status, headers });
}

const OK_HEADERS = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

export async function POST(request: Request): Promise<NextResponse> {
  const started = Date.now();

  // 1. Rate limiting (best-effort, per IP).
  const rateLimitPerMin = Number(process.env.RATE_LIMIT_PER_MIN) || 10;
  const limit = checkRateLimit(clientKeyFromHeaders(request.headers), rateLimitPerMin);
  if (!limit.allowed) {
    return errorResponse(429, 'RATE_LIMITED', true, limit.retryAfterSec);
  }

  // 2. Request size guard.
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (contentLength > MAX_REQUEST_BYTES) {
    return errorResponse(413, 'PAYLOAD_TOO_LARGE', false);
  }

  // 3. Parse + validate the body.
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return errorResponse(400, 'INVALID_INPUT', false);
  }
  if (rawBody.length > MAX_REQUEST_BYTES) {
    return errorResponse(413, 'PAYLOAD_TOO_LARGE', false);
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return errorResponse(400, 'INVALID_INPUT', false);
  }

  const body = apiRequestSchema.safeParse(parsedBody);
  if (!body.success) {
    return errorResponse(400, 'INVALID_INPUT', false, undefined, Date.now() - started, rawBody.length);
  }

  // 4. Analyze mode: image size guard (decoded bytes).
  if (body.data.mode === 'analyze') {
    const decodedLength = Math.floor((body.data.image.data.length * 3) / 4);
    if (decodedLength > MAX_IMAGE_BYTES) {
      return errorResponse(413, 'PAYLOAD_TOO_LARGE', false, undefined, Date.now() - started, rawBody.length);
    }
  }

  // 5. Provider chain.
  let chain;
  try {
    chain = getProviderChain();
  } catch (err) {
    if (err instanceof ProviderError && !err.retryable) {
      return errorResponse(503, 'UPSTREAM_UNAVAILABLE', false);
    }
    return errorResponse(500, 'UNKNOWN', false);
  }

  const mode = body.data;
  const outcome = await runProviderChain(
    chain,
    (provider, repair) => {
      if (mode.mode === 'analyze') {
        return { kind: 'analyze', lang: mode.lang, image: mode.image, repair };
      }
      if (mode.mode === 'manual') {
        return { kind: 'manual', lang: mode.lang, names: mode.names, repair };
      }
      return { kind: 'translate', lang: mode.lang, analysisJson: JSON.stringify(mode.analysis), repair };
    },
    (raw) => {
      const json = extractJson(raw);
      return modelAnalysisSchema.parse(json);
    },
  );

  const durationMs = Date.now() - started;
  const bytes = rawBody.length;

  // 6. Map failures to the API error catalogue (§ 9.2).
  if (outcome.schemaInvalid) {
    return errorResponse(422, 'SCHEMA_INVALID', true, undefined, durationMs, bytes);
  }
  if (outcome.result === undefined) {
    const err = outcome.lastError;
    if (!err) return errorResponse(502, 'UPSTREAM_UNAVAILABLE', true, undefined, durationMs, bytes);
    if (err.status === 429) {
      return errorResponse(429, 'RATE_LIMITED', true, err.retryAfterSec ?? 30, durationMs, bytes);
    }
    if (err.status === 504 || /timed out/i.test(err.message)) {
      return errorResponse(504, 'TIMEOUT', true, undefined, durationMs, bytes);
    }
    return errorResponse(502, 'UPSTREAM_UNAVAILABLE', true, undefined, durationMs, bytes);
  }

  // 7. Complete the Analysis server-side (§ 9.4).
  let analysis: ZodAnalysis;
  try {
    if (mode.mode === 'translate') {
      analysis = mergeTranslation(mode.analysis, outcome.result, mode.lang);
    } else {
      analysis = completeAnalysis(outcome.result, mode.lang, { isManual: mode.mode === 'manual' });
    }
    const check = analysisSchema.safeParse(analysis);
    if (!check.success) {
      return errorResponse(422, 'SCHEMA_INVALID', true, undefined, durationMs, bytes);
    }
  } catch (err) {
    if (err instanceof MissingProviderConfigError || err instanceof SchemaInvalidError) {
      return errorResponse(422, 'SCHEMA_INVALID', true, undefined, durationMs, bytes);
    }
    return errorResponse(500, 'UNKNOWN', false, undefined, durationMs, bytes);
  }

  logEvent('OK', durationMs, bytes);
  return NextResponse.json({ analysis }, { status: 200, headers: OK_HEADERS });
}
