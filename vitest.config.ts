import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'node',
    // Integration tests must not depend on local secrets:
    env: {
      LLM_PROVIDER: 'mock',
      GEMINI_API_KEY: '',
      OPENAI_API_KEY: '',
      FALLBACK_PROVIDER: '',
      RATE_LIMIT_PER_MIN: '1000',
      REQUEST_TIMEOUT_MS: '5000',
    },
  },
});
