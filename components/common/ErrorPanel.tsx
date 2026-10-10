'use client';

import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { AppError } from '@/types/medknow';
import { Button } from '@/components/ui/button';

export function errorMessage(appError: AppError, t: (key: string, vars?: Record<string, string | number>) => string): string {
  const key = `errors.${appError.code}`;
  const text = t(key, { seconds: appError.retryAfterSec ?? 30 });
  return text === key ? t('errors.UNKNOWN') : text;
}

/**
 * Error panel (EF-15): what happened, a short reason, and what to do.
 * Focus is moved to the panel and the region is announced (CA-15.3).
 */
export default function ErrorPanel({
  error,
  onRetry,
  secondary,
}: {
  error: AppError;
  onRetry?: () => void;
  secondary?: { label: string; onClick: () => void };
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, [error]);

  return (
    <div
      ref={ref}
      role="alert"
      aria-live="assertive"
      tabIndex={-1}
      className="rounded-2xl border-2 border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle aria-hidden className="mt-1 h-6 w-6 shrink-0 text-red-700 dark:text-red-300" />
        <div>
          <p className="font-semibold text-red-800 dark:text-red-200">{errorMessage(error, t)}</p>
          {/* Discreet short code for support (CA-15.2) — no technical trace. */}
          <p className="mt-1 text-xs text-red-700/70 dark:text-red-300/70">Code : {error.code}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {onRetry && error.retryable && (
          <Button onClick={onRetry}>{t('common.retry')}</Button>
        )}
        {secondary && (
          <Button variant="secondary" onClick={secondary.onClick}>
            {secondary.label}
          </Button>
        )}
      </div>
    </div>
  );
}
