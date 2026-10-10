'use client';

import { useEffect, useRef, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { getConsent, setConsent } from '@/lib/storage/session-store';
import { Button } from '@/components/ui/button';

/**
 * E0 — disclaimer de session (EF-16). Blocks children (capture) until
 * "I understand" is pressed; acceptance is stored for the session only.
 */
export default function ConsentGate({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [accepted, setAccepted] = useState<boolean | null>(null);
  const acceptRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setAccepted(Boolean(getConsent()));
  }, []);

  useEffect(() => {
    if (accepted === false) acceptRef.current?.focus(); // CA-16.4
  }, [accepted]);

  if (accepted === null) {
    return <div aria-busy="true" className="py-16 text-center text-gray-500">{t('common.loading')}</div>;
  }

  if (accepted) return <>{children}</>;

  return (
    <div className="py-6">
      <div className="rounded-2xl border-2 border-primary/40 bg-teal-50 p-5 dark:bg-teal-950">
        <div className="flex items-center gap-2">
          <ShieldAlert aria-hidden className="h-7 w-7 text-primary" />
          <h1 className="text-xl font-extrabold">{t('disclaimer.title')}</h1>
        </div>
        <p className="mt-3 text-[0.95em] leading-relaxed">{t('disclaimer.body')}</p>
        <p className="mt-3 rounded-lg bg-white/70 p-3 text-sm text-gray-700 dark:bg-gray-900/70 dark:text-gray-200">
          {t('disclaimer.dataNote')}
        </p>
        <Button ref={acceptRef} className="mt-4 w-full" onClick={() => { setConsent(); setAccepted(true); }}>
          {t('disclaimer.accept')}
        </Button>
      </div>
    </div>
  );
}
