import { ProviderError, isTransientProviderError } from './provider';
import type { LLMProvider, ProviderMode } from './provider';

/**
 * Provider execution strategy (spec § 9.6):
 * - transient provider errors (429/5xx/timeout/network): one retry after a
 *   short exponential backoff with jitter, then move to the fallback provider
 *   if one is configured (EXN-61) ;
 * - non-JSON output: exactly one repair attempt with REPAIR_SUFFIX, then
 *   SCHEMA_INVALID — no fallback for structural failures (TI-03).
 */

export class SchemaInvalidError extends Error {
  constructor() {
    super('Model output is not schema-conformant after repair attempt');
    this.name = 'SchemaInvalidError';
  }
}

export class MissingProviderConfigError extends Error {
  constructor() {
    super('No AI provider is configured');
    this.name = 'MissingProviderConfigError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ChainOutcome<T> {
  result?: T;
  providerName?: string;
  lastError?: ProviderError;
  schemaInvalid?: boolean;
}

/**
 * Runs `makeRequest(provider, repair)` across the provider chain and parses
 * the raw text with `parseRaw`. Returns a discriminated outcome instead of
 * throwing so the route can map errors cleanly.
 */
export async function runProviderChain<T>(
  chain: LLMProvider[],
  makeRequest: (provider: LLMProvider, repair: boolean) => ProviderMode,
  parseRaw: (raw: string) => T,
): Promise<ChainOutcome<T>> {
  if (chain.length === 0) return { lastError: new ProviderError('No provider configured', false) };

  let lastError: ProviderError | undefined;

  for (const provider of chain) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const raw = await provider.run(makeRequest(provider, attempt === 1));
        try {
          return { result: parseRaw(raw), providerName: provider.name };
        } catch {
          // Structural failure → one repair attempt (attempt 1), else stop.
          if (attempt === 0) continue;
          return { schemaInvalid: true };
        }
      } catch (err) {
        if (err instanceof ProviderError) {
          lastError = err;
          if (err.retryable && attempt === 0) {
            await sleep(1000 + Math.floor(Math.random() * 1000));
            continue;
          }
        }
        break; // non-retryable, or second transient failure → next provider
      }
    }
  }

  return { lastError, schemaInvalid: false };
}

export { isTransientProviderError };
