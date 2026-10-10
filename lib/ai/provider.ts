import type { ZodLang } from './schema';
import { GeminiProvider } from './gemini';
import { OpenAIProvider } from './openai';
import { MockProvider } from './mock';

/**
 * LLMProvider abstraction (spec § 6.2 / EXN-60). One method per mode; the
 * implementation returns raw JSON text that the route handler validates with
 * Zod. Failures throw ProviderError with a retryable flag so the route can
 * apply the fallback strategy (spec § 9.6).
 */

export interface ProviderImage {
  mimeType: string;
  /** base64 payload without the data: prefix */
  data: string;
}

export type ProviderMode =
  | { kind: 'analyze'; lang: ZodLang; image: ProviderImage; repair?: boolean }
  | { kind: 'translate'; lang: ZodLang; analysisJson: string; repair?: boolean }
  | { kind: 'manual'; lang: ZodLang; names: string[]; repair?: boolean };

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
    public readonly status?: number,
    public readonly retryAfterSec?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export interface LLMProvider {
  readonly name: string;
  readonly model: string;
  run(request: ProviderMode): Promise<string>;
}

export interface ProviderConfig {
  name: string;
  apiKey: string;
  model: string;
}

function createProvider(name: string, apiKey: string, model: string): LLMProvider {
  // Static imports: dynamic require() is not traced by Next's standalone
  // output bundler, which left the providers missing at runtime in Docker.
  switch (name) {
    case 'gemini':
      return new GeminiProvider({ name: 'gemini', apiKey, model });
    case 'openai':
      return new OpenAIProvider({ name: 'openai', apiKey, model });
    case 'mock':
      return new MockProvider({ name: 'mock', apiKey: 'mock', model: 'mock-1' });
    default:
      throw new ProviderError(`Unknown LLM_PROVIDER "${name}"`, false);
  }
}

function providerFor(
  name: string,
  apiKeyEnv: string,
  modelEnv: string,
  defaultModel: string,
  fallbackApiKeyEnv?: string,
  fallbackModelEnv?: string,
): LLMProvider {
  const apiKey = process.env[fallbackApiKeyEnv ?? ''] || process.env[apiKeyEnv];
  if (!apiKey) {
    throw new ProviderError(`Missing environment variable ${apiKeyEnv}`, false);
  }
  const model = process.env[fallbackModelEnv ?? ''] || process.env[modelEnv] || defaultModel;
  return createProvider(name, apiKey, model);
}

/**
 * Builds the provider chain: primary provider first, then the optional
 * FALLBACK_PROVIDER used when the primary fails with 429/5xx (EXN-61).
 */
export function getProviderChain(): LLMProvider[] {
  const primary = process.env.LLM_PROVIDER || 'gemini';
  const chain: LLMProvider[] = [];

  const primaryKeyEnv = primary === 'openai' ? 'OPENAI_API_KEY' : 'GEMINI_API_KEY';
  const primaryModelEnv = primary === 'openai' ? 'OPENAI_MODEL' : 'GEMINI_MODEL';
  const primaryDefault = primary === 'openai' ? 'gpt-4o-mini' : 'gemini-3.5-flash-lite';
  chain.push(providerFor(primary, primaryKeyEnv, primaryModelEnv, primaryDefault));

  const fallbackName = process.env.FALLBACK_PROVIDER;
  if (fallbackName && fallbackName !== primary && fallbackName !== 'mock') {
    const keyEnv = fallbackName === 'openai' ? 'OPENAI_API_KEY' : 'GEMINI_API_KEY';
    const modelEnv = fallbackName === 'openai' ? 'OPENAI_MODEL' : 'GEMINI_MODEL';
    const defaultModel = fallbackName === 'openai' ? 'gpt-4o-mini' : 'gemini-3.5-flash-lite';
    chain.push(
      providerFor(
        fallbackName,
        keyEnv,
        modelEnv,
        defaultModel,
        'FALLBACK_API_KEY',
        'FALLBACK_MODEL',
      ),
    );
  }
  return chain;
}

export function isTransientProviderError(err: unknown): boolean {
  if (err instanceof ProviderError) return err.retryable;
  return false;
}
