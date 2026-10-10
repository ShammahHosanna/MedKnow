'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';

/** Service-worker registration + update notification (EF-14). */
export default function PwaRegister() {
  const { t } = useI18n();
  const [updateReady, setUpdateReady] = useState(false);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return;
    let cancelled = false;
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      if (cancelled) return;
      const sw = reg.waiting;
      if (sw) {
        setWaiting(sw);
        setUpdateReady(true);
      }
      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        installing?.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            setWaiting(installing);
            setUpdateReady(true);
          }
        });
      });
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!updateReady) return null;
  return (
    <div role="status" className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-gray-900 px-4 py-2 text-sm text-white shadow-lg no-print">
      {t('common.updateAvailable')}
      <Button
        size="sm"
        onClick={() => {
          waiting?.postMessage({ type: 'SKIP_WAITING' });
          window.location.reload();
        }}
      >
        {t('common.reload')}
      </Button>
    </div>
  );
}
