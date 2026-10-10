'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';

/**
 * E4 — analysis progress in 4 steps (EF-03). Steps advance on a timer as a
 * visual reassurance; the real completion comes from the request. Text-only
 * under prefers-reduced-motion (no animation).
 */
export default function LoadingSteps({ onCancel }: { onCancel: () => void }) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((s) => Math.min(s + 1, 3));
    }, 1600);
    return () => clearInterval(timer);
  }, []);

  const steps = [t('loading.step1'), t('loading.step2'), t('loading.step3'), t('loading.step4')];

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-white/95 p-6 dark:bg-[#0B1220]/95"
    >
      <div className="w-full max-w-xs">
        <ul className="flex flex-col gap-3">
          {steps.map((label, index) => {
            const active = index === step;
            const done = index < step;
            return (
              <li
                key={label}
                className={`flex items-center gap-3 rounded-xl border p-3 text-sm font-semibold ${
                  active
                    ? 'border-primary bg-teal-50 text-primary dark:bg-teal-950 dark:text-primary-light'
                    : done
                      ? 'border-severity-ok-border bg-severity-ok-bg text-severity-ok-text'
                      : 'border-gray-200 text-gray-500 dark:border-gray-700'
                }`}
                aria-current={active ? 'step' : undefined}
              >
                <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-full border border-current text-xs">
                  {done ? '✓' : index + 1}
                </span>
                {label}
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-center text-sm text-gray-500">{t('loading.slowHint')}</p>
      </div>
      <Button variant="ghost" onClick={onCancel}>
        {t('loading.cancel')}
      </Button>
    </div>
  );
}
