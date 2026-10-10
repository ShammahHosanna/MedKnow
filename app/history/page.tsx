'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ChevronRight, Clock, Trash2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { deleteRecord, listHistory } from '@/lib/storage/session-store';
import type { SessionRecord } from '@/types/medknow';

export default function HistoryPage() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [records, setRecords] = useState<SessionRecord[]>([]);

  useEffect(() => {
    setRecords(listHistory());
  }, []);

  const formatDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(lang, { dateStyle: 'short', timeStyle: 'short' }).format(
        new Date(iso),
      );
    } catch {
      return iso;
    }
  };

  const medCount = (record: SessionRecord) => {
    const analysis = record.translations[lang] ?? record.translations[record.activeLang];
    return analysis?.medications.length ?? 0;
  };

  return (
    <div className="animate-fade-in-up flex flex-col gap-4 pt-2">
      <h1 className="text-center text-xl font-extrabold">{t('history.title')}</h1>

      {records.length === 0 ? (
        <div className="flex flex-col items-center gap-3 pt-8 text-center">
          <Clock aria-hidden className="h-10 w-10 text-gray-300 dark:text-gray-600" />
          <p className="font-semibold text-gray-700 dark:text-gray-200">{t('history.empty')}</p>
          <p className="text-sm text-gray-500">{t('history.emptyHint')}</p>
          <Button onClick={() => router.push('/')}>{t('common.home')}</Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {records.map((record) => (
            <li key={record.id}>
              <Card className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-extrabold">
                      {t('history.medications', { count: medCount(record) })}
                    </span>
                    {record.isExample && <Badge variant="neutral">{t('result.exampleBadge')}</Badge>}
                    {record.isManual && <Badge variant="primary">{t('result.manualBadge')}</Badge>}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-gray-500">
                    {formatDate(record.createdAt)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('common.delete')}
                  onClick={() => {
                    deleteRecord(record.id);
                    setRecords(listHistory());
                  }}
                  className="text-gray-400 hover:text-red-600 dark:text-gray-500"
                >
                  <Trash2 aria-hidden className="h-5 w-5" />
                </Button>
                <Button
                  size="sm"
                  onClick={() => router.push(`/result/${record.id}`)}
                  aria-label={t('history.open')}
                >
                  {t('history.open')} <ChevronRight aria-hidden className="h-4 w-4" />
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
