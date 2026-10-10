import { NextResponse } from 'next/server';
import { getProviderChain } from '@/lib/ai/provider';

export const runtime = 'nodejs';
// Must be evaluated per-request: provider configuration depends on runtime
// env vars (GEMINI_API_KEY etc.), not build-time ones.
export const dynamic = 'force-dynamic';

/** Minimal health check (EXN-72). Never exposes keys or request content. */
export async function GET(): Promise<NextResponse> {
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  let providerConfigured = true;
  try {
    getProviderChain();
  } catch {
    providerConfigured = false;
  }
  return NextResponse.json(
    {
      status: providerConfigured ? 'ok' : 'degraded',
      provider: process.env.LLM_PROVIDER || 'gemini',
      providerConfigured,
    },
    { status: 200, headers },
  );
}
