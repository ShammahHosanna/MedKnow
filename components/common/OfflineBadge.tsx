'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export default function OfflineBadge() {
  const { t } = useI18n();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (!offline) return null;
  return (
    <div role="status" className="flex items-center justify-center gap-2 bg-amber-100 py-1 text-sm font-semibold text-amber-900 dark:bg-amber-900 dark:text-amber-100 no-print">
      <WifiOff aria-hidden className="h-4 w-4" /> {t('common.offline')}
    </div>
  );
}
