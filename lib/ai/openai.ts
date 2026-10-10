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
import { parseRetryAfter } from './gemini';
import type { LLMProvider, ProviderConfig, ProviderMode } from './provider';

const API_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * OpenAI provider over the plain REST API (no SDK dependency, spec § 6.4).
 * Uses response_format json_object; vision via image_url data URI.
 */
export class OpenAIProvider implements LLMProvider {
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

    type Content =
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } };

    const content: Content[] = [{ type: 'text', text: userText }];
    if (request.kind === 'analyze') {
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:${request.image.mimeType};base64,${request.image.data}`,
        },
      });
    }

    const timeoutMs = Number(process.env.REQUEST_TIMEOUT_MS) || 25000;
    let response: Response;
    try {
      response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content },
          ],
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'TimeoutError') {
        throw new ProviderError('OpenAI request timed out', true, 504);
      }
      throw new ProviderError('OpenAI request failed (network)', true, 502);
    }

    if (!response.ok) {
      const retryAfterSec = parseRetryAfter(response.headers.get('retry-after'));
      const retryable = response.status === 429 || response.status >= 500;
      throw new ProviderError(
        `OpenAI API error ${response.status}`,
        retryable,
        response.status,
        retryAfterSec,
      );
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw new ProviderError('OpenAI returned an empty response', true);
    }
    return text;
  }
}
