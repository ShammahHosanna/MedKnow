import {
  ANALYZE_SYSTEM_PROMPT,
  MANUAL_SYSTEM_PROMPT,
  REPAIR_SUFFIX,
  TRANSLATE_SYSTEM_PROMPT,
  analyzeUserPrompt,
  manualUserPrompt,
  translateUserPrompt,
} from './prompt';
import { ProviderError } from './provider';
import { MODEL_ANALYSIS_RESPONSE_SCHEMA } from './schema';
import type { LLMProvider, ProviderConfig, ProviderMode } from './provider';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}
interface GeminiBody {
  systemInstruction?: { parts: GeminiPart[] };
  contents: { role: 'user' | 'model'; parts: GeminiPart[] }[];
  generationConfig: { temperature: number; responseMimeType: string; responseSchema?: object };
}

/**
 * Gemini provider over the plain REST API (no SDK dependency, spec § 6.4).
 * Uses responseMimeType application/json to constrain the output to JSON.
 */
export class GeminiProvider implements LLMProvider {
  readonly name: string;
  readonly model: string;
  private readonly apiKey: string;

  constructor(config: ProviderConfig) {
    this.name = config.name;
    this.model = config.model;
    this.apiKey = config.apiKey;
  }

  async run(request: ProviderMode): Promise<string> {
    const system =
      request.kind === 'analyze'
        ? ANALYZE_SYSTEM_PROMPT
        : request.kind === 'translate'
          ? TRANSLATE_SYSTEM_PROMPT
          : MANUAL_SYSTEM_PROMPT;

    const userText =
      (request.kind === 'analyze'
        ? analyzeUserPrompt(request.lang)
        : request.kind === 'translate'
          ? translateUserPrompt(request.lang, request.analysisJson)
          : manualUserPrompt(request.lang, request.names)) + (request.repair ? REPAIR_SUFFIX : '');

    const parts: GeminiPart[] = [{ text: userText }];
    if (request.kind === 'analyze') {
      parts.push({ inlineData: { mimeType: request.image.mimeType, data: request.image.data } });
    }

    const body: GeminiBody = {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: MODEL_ANALYSIS_RESPONSE_SCHEMA,
      },
    };

    const timeoutMs = Number(process.env.REQUEST_TIMEOUT_MS) || 25000;
    let response: Response;
    try {
      response = await fetch(`${API_BASE}/${encodeURIComponent(this.model)}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'TimeoutError') {
        throw new ProviderError('Gemini request timed out', true, 504);
      }
      throw new ProviderError('Gemini request failed (network)', true, 502);
    }

    if (!response.ok) {
      const retryAfterSec = parseRetryAfter(response.headers.get('retry-after'));
      const retryable = response.status === 429 || response.status >= 500;
      let detail = '';
      try {
        const errBody = (await response.json()) as { error?: { message?: string } };
        detail = errBody?.error?.message ? `: ${errBody.error.message}` : '';
      } catch {
        // ignore body parse errors
      }
      throw new ProviderError(
        `Gemini API error ${response.status}${detail}`,
        retryable,
        response.status,
        retryAfterSec,
      );
    }

    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? '')
      .join('')
      .trim();
    if (!text) {
      throw new ProviderError('Gemini returned an empty response', true);
    }
    return text;
  }
}

export function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(Math.ceil(seconds), 120);
  const date = Date.parse(header);
  if (Number.isFinite(date)) {
    return Math.min(Math.max(Math.ceil((date - Date.now()) / 1000), 1), 120);
  }
  return undefined;
}
