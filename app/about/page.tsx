'use client';

import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';

const LIMIT_KEYS = ['about.limit1', 'about.limit2', 'about.limit3', 'about.limit4', 'about.limit5', 'about.limit6'];

export default function AboutPage() {
  const { t } = useI18n();
  const router = useRouter();

  return (
    <div className="animate-fade-in-up flex flex-col gap-4 pt-2">
      <h1 className="text-center text-xl font-extrabold">{t('about.title')}</h1>

      <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-200">{t('about.intro')}</p>

      <Card>
        <CardTitle>{t('about.howTitle')}</CardTitle>
        <p className="mt-2 text-sm leading-relaxed text-gray-700 dark:text-gray-200">
          {t('about.howBody')}
        </p>
      </Card>

      <Card>
        <CardTitle>{t('about.limitsTitle')}</CardTitle>
        <ul className="mt-2 flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-gray-700 dark:text-gray-200">
          {LIMIT_KEYS.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>
      </Card>

      <Card>
        <div className="flex items-center gap-2">
          <ShieldCheck aria-hidden className="h-5 w-5 text-primary" />
          <CardTitle>{t('about.privacyTitle')}</CardTitle>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-gray-700 dark:text-gray-200">
          {t('about.privacyBody')}
        </p>
      </Card>

      <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
        <CardTitle>{t('disclaimer.title')}</CardTitle>
        <p className="mt-2 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
          {t('disclaimer.body')}
        </p>
      </Card>

      <Button variant="secondary" onClick={() => router.push('/')}>
        {t('common.back')}
      </Button>
    </div>
  );
}
