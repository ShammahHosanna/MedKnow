'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import LoadingSteps from '@/components/common/LoadingSteps';
import ErrorPanel from '@/components/common/ErrorPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { analyzeRequest, toAppError } from '@/lib/api/analyze-client';
import { saveAnalysis } from '@/lib/storage/session-store';
import type { Analysis, AppError } from '@/types/medknow';

const MAX_NAMES = 10;
const MIN_NAMES = 2;

export default function ManualPage() {
  const { t, lang } = useI18n();
  const router = useRouter();

  const [names, setNames] = useState<string[]>(['', '']);
  const [notice, setNotice] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  const filledNames = names.map((n) => n.trim()).filter((n) => n.length > 0);
  const canStart = filledNames.length >= 1 && !analyzing;

  const updateName = (index: number, value: string) => {
    setNames((prev) => prev.map((n, i) => (i === index ? value : n)));
  };

  const addName = () => {
    const last = names[names.length - 1] ?? '';
    if (last.trim().length === 0) {
      setNotice(t('manual.emptyName'));
      return;
    }
    if (names.length >= MAX_NAMES) {
      setNotice(t('manual.maxNames'));
      return;
    }
    setNotice(null);
    setNames((prev) => [...prev, '']);
  };

  const removeName = (index: number) => {
    setNotice(null);
    setNames((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : ['']));
  };

  const startAnalysis = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const analysis: Analysis = await analyzeRequest({ mode: 'manual', lang, names: filledNames });
      saveAnalysis(analysis, { isManual: true });
      router.push(`/result/${analysis.id}`);
    } catch (err) {
      setError(toAppError(err));
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="animate-fade-in-up flex flex-col gap-4 pt-2">
      <h1 className="text-center text-xl font-extrabold">{t('manual.title')}</h1>
      <p className="text-sm text-gray-600 dark:text-gray-300">{t('manual.hint')}</p>

      {error ? (
        <ErrorPanel
          error={error}
          onRetry={() => {
            setError(null);
          }}
          secondary={{ label: t('common.home'), onClick: () => router.push('/') }}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <Card className="flex flex-col gap-3">
            {names.map((name, index) => (
              <div key={index} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-sm font-bold text-primary dark:bg-teal-950/60 dark:text-primary-light"
                >
                  {index + 1}
                </span>
                <Input
                  value={name}
                  onChange={(e) => updateName(index, e.target.value)}
                  placeholder={t('manual.placeholder')}
                  aria-label={`${t('manual.placeholder')} ${index + 1}`}
                  maxLength={80}
                  autoComplete="off"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeName(index)}
                  aria-label={t('manual.remove')}
                  disabled={names.length <= 1}
                  className="text-gray-400 hover:text-red-600 dark:text-gray-500"
                >
                  <Trash2 aria-hidden className="h-5 w-5" />
                </Button>
              </div>
            ))}

            {names.length < MAX_NAMES && (
              <button
                type="button"
                onClick={addName}
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 px-4 text-sm font-semibold text-gray-600 transition hover:border-primary/50 hover:bg-teal-50/50 hover:text-primary dark:border-gray-700 dark:text-gray-300 dark:hover:bg-teal-950/30 dark:hover:text-primary-light"
              >
                <Plus aria-hidden className="h-4 w-4" /> {t('manual.add')}
              </button>
            )}
          </Card>

          {notice && (
            <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-100">
              {notice}
            </p>
          )}

          {filledNames.length > 0 && filledNames.length < MIN_NAMES && (
            <p role="status" className="text-sm text-gray-600 dark:text-gray-300">
              {t('manual.hint')}
            </p>
          )}

          <Button
            onClick={startAnalysis}
            disabled={!canStart}
            className="bg-gradient-to-r from-primary to-primary-light shadow-glow hover:brightness-110"
          >
            {analyzing ? t('preview.analyzing') : t('manual.start')}
          </Button>

          <p className="text-sm text-gray-600 dark:text-gray-400">{t('manual.note')}</p>
        </div>
      )}

      {analyzing && (
        <LoadingSteps
          onCancel={() => {
            setAnalyzing(false);
          }}
        />
      )}
    </div>
  );
}
