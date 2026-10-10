'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronRight,
  CircleAlert,
  FileDown,
  Info,
  MessageCircleQuestion,
  Pause,
  Pill,
  Play,
  Share2,
  ShieldAlert,
  Square,
  Volume2,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { getAnalysis, cacheTranslation } from '@/lib/storage/session-store';
import { analyzeRequest, toAppError } from '@/lib/api/analyze-client';
import { SpeechController, SPEEDS, speechSupported } from '@/lib/tts/speech-controller';
import type { Analysis, AppError, Field, Medication, Severity } from '@/types/medknow';

const SEVERITY_BADGE: Record<Severity, 'high' | 'medium' | 'low'> = {
  high: 'high',
  medium: 'medium',
  low: 'low',
};

export default function ResultPage() {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useI18n();
  const router = useRouter();

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [missing, setMissing] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translateFailed, setTranslateFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  // ── TTS state ────────────────────────────────────────────────────────────
  const langRef = useRef(lang);
  langRef.current = lang;
  const speechRef = useRef<SpeechController | null>(null);
  if (!speechRef.current) {
    speechRef.current = new SpeechController(() => langRef.current);
  }
  const speech = speechRef.current;
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(1);
  const [ttsNotice, setTtsNotice] = useState<string | null>(null);

  // ── Load the analysis (and re-translate when the language changes) ───────
  useEffect(() => {
    let cancelled = false;
    setTranslateFailed(false);
    const load = async () => {
      const cached = getAnalysis(id, lang);
      if (cancelled) return;
      if (!cached) {
        setMissing(true);
        return;
      }
      setAnalysis(cached);
      if (cached.lang !== lang) {
        // No translation yet → ask the API, then cache it for next time.
        setTranslating(true);
        try {
          const translated = await analyzeRequest({
            mode: 'translate',
            lang,
            analysis: cached,
          });
          if (cancelled) return;
          cacheTranslation(id, lang, translated);
          setAnalysis(translated);
        } catch {
          if (!cancelled) setTranslateFailed(true); // keep the original language
        } finally {
          if (!cancelled) setTranslating(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [id, lang]);

  // Stop speech on unmount / language change (A5).
  useEffect(() => {
    return () => {
      speechRef.current?.stop();
    };
  }, [lang]);

  const stopSpeaking = useCallback(() => {
    speech.stop();
    setSpeaking(false);
    setPaused(false);
  }, [speech]);

  const speak = useCallback(
    (text: string) => {
      if (!speechSupported()) {
        setTtsNotice(t('tts.unavailable'));
        return;
      }
      if (!speech.hasVoiceFor(lang)) {
        setTtsNotice(t('tts.noVoice'));
        return;
      }
      setTtsNotice(null);
      setSpeaking(true);
      setPaused(false);
      speech.speak(text, lang, {
        onEnd: () => {
          setSpeaking(false);
          setPaused(false);
        },
        onError: () => {
          setSpeaking(false);
          setPaused(false);
        },
      });
    },
    [speech, lang, t],
  );

  const fullText = useMemo(() => {
    if (!analysis) return '';
    const parts = [analysis.summaryPlain];
    for (const i of analysis.interactions) parts.push(i.explanation, i.whatToDo);
    if (analysis.questionsForPharmacist.length > 0) {
      parts.push(analysis.questionsForPharmacist.join(' '));
    }
    return parts.filter(Boolean).join(' ');
  }, [analysis]);

  if (missing) {
    return (
      <div className="flex flex-col items-center gap-4 pt-10 text-center">
        <CircleAlert aria-hidden className="h-10 w-10 text-gray-400" />
        <p className="font-semibold text-gray-700 dark:text-gray-200">{t('history.empty')}</p>
        <Button onClick={() => router.push('/')}>{t('common.home')}</Button>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="flex flex-col items-center gap-4 pt-16 text-center">
        <div
          aria-hidden
          className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary"
        />
        <p className="text-sm text-gray-500">{t('common.loading')}</p>
      </div>
    );
  }

  const isExample = false; // flags live on the record; badges come from storage
  void isExample;

  // ── Reject states ─────────────────────────────────────────────────────────
  if (!analysis.isMedicalDocument) {
    return (
      <RejectState
        icon={<CircleAlert aria-hidden className="h-10 w-10 text-amber-600" />}
        title={t('reject.notMedicalTitle')}
        body={<p className="text-sm text-gray-600 dark:text-gray-300">{t('reject.whatWeRead')}</p>}
      />
    );
  }
  if (!analysis.imageQuality.readable) {
    return (
      <RejectState
        icon={<AlertTriangle aria-hidden className="h-10 w-10 text-amber-600" />}
        title={t('reject.unreadableTitle')}
        body={
          <>
            {analysis.imageQuality.issues.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {analysis.imageQuality.issues.map((issue) => (
                  <Badge key={issue} variant="neutral">
                    {t(`reject.issue.${issue}`)}
                  </Badge>
                ))}
              </div>
            )}
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{t('reject.tips')}</p>
          </>
        }
      />
    );
  }

  // ── Share / PDF ────────────────────────────────────────────────────────────
  const shareResult = async () => {
    const text = `MedKnow — ${analysis.summaryPlain}`;
    const nav = navigator as Navigator & { share?: (data: { title: string; text: string }) => Promise<void> };
    try {
      if (typeof nav.share === 'function') {
        await nav.share({ title: 'MedKnow', text });
        return;
      }
      await nav.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // user cancelled or clipboard unavailable
    }
  };

  return (
    <div className="animate-fade-in-up flex flex-col gap-4 pt-2">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold">{t('result.title')}</h1>
        <div className="flex items-center gap-2">
          {analysis.highestSeverity && (
            <Badge variant={SEVERITY_BADGE[analysis.highestSeverity]}>
              {t(`severity.${analysis.highestSeverity}`)}
            </Badge>
          )}
          {analysis.documentType === 'manual_entry' && (
            <Badge variant="primary">{t('result.manualBadge')}</Badge>
          )}
        </div>
      </div>

      <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
        ⚠️ {t('banner.short')}
      </p>

      {translateFailed && (
        <p role="status" className="text-sm text-gray-600 dark:text-gray-300">
          {t('translate.failed')}
        </p>
      )}
      {translating && (
        <p role="status" className="text-sm text-gray-500">
          {t('common.loading')}
        </p>
      )}

      {/* ── Summary + voice ───────────────────────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{t('summary.title')}</CardTitle>
          <Badge variant="neutral">{analysis.lang.toUpperCase()}</Badge>
        </div>
        <p className="mt-2 text-base leading-relaxed">{analysis.summaryPlain}</p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!speaking ? (
            <Button size="sm" onClick={() => speak(fullText)}>
              <Volume2 aria-hidden className="h-4 w-4" /> {t('actions.listenAll')}
            </Button>
          ) : (
            <>
              {paused ? (
                <Button
                  size="sm"
                  onClick={() => {
                    speech.resume();
                    setPaused(false);
                  }}
                >
                  <Play aria-hidden className="h-4 w-4" /> {t('actions.resume')}
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => {
                    speech.pause();
                    setPaused(true);
                  }}
                >
                  <Pause aria-hidden className="h-4 w-4" /> {t('actions.pause')}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={stopSpeaking}>
                <Square aria-hidden className="h-4 w-4" /> {t('actions.stop')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const next = (speedIndex + 1) % SPEEDS.length;
                  setSpeedIndex(next);
                  speech.setSpeed(SPEEDS[next]);
                }}
                aria-label={t('actions.speed')}
              >
                {SPEEDS[speedIndex]}×
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={shareResult}>
            <Share2 aria-hidden className="h-4 w-4" /> {copied ? t('common.copied') : t('actions.share')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => window.print()} className="no-print">
            <FileDown aria-hidden className="h-4 w-4" /> {t('actions.pdf')}
          </Button>
        </div>
        {ttsNotice && (
          <p role="status" className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            {ttsNotice}
          </p>
        )}
      </Card>

      {/* ── Interactions ──────────────────────────────────────────────────── */}
      <section aria-labelledby="interactions-title" className="flex flex-col gap-3">
        <h2 id="interactions-title" className="text-lg font-extrabold">
          {t('interactions.title')}
        </h2>

        {analysis.medications.length === 1 && (
          <p className="text-sm text-gray-600 dark:text-gray-300">{t('interactions.singleMed')}</p>
        )}

        {analysis.interactions.length === 0 ? (
          <Card className="border-severity-ok-border bg-severity-ok-bg">
            <p className="font-semibold text-severity-ok-text">{t('interactions.none')}</p>
            <p className="mt-1 text-sm text-severity-ok-text/90">{t('interactions.reserve')}</p>
          </Card>
        ) : (
          analysis.interactions.map((interaction) => (
            <Card key={interaction.id} className="border-severity-high-border/40">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={SEVERITY_BADGE[interaction.severity]}>
                  {t(`severity.${interaction.severity}`)}
                </Badge>
                {interaction.confidence === 'low' && (
                  <Badge variant="neutral">{t('interactions.toConfirm')}</Badge>
                )}
                {interaction.source !== 'model' && (
                  <Badge variant="primary">{t('interactions.localRule')}</Badge>
                )}
              </div>
              <p className="mt-2 text-sm leading-relaxed">{interaction.explanation}</p>
              <p className="mt-2 rounded-xl bg-surface p-3 text-sm dark:bg-gray-800">
                <span className="font-bold">{t('interactions.whatToDo')} </span>
                {interaction.whatToDo}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {t(`severity.${interaction.severity}.desc`)}
              </p>
            </Card>
          ))
        )}
      </section>

      {/* ── Medications ───────────────────────────────────────────────────── */}
      <section aria-labelledby="medications-title" className="flex flex-col gap-3">
        <h2 id="medications-title" className="text-lg font-extrabold">
          {t('medications.title', { count: analysis.medications.length })}
        </h2>

        {analysis.medications.map((med) => (
          <MedicationCard key={med.id} med={med} />
        ))}
      </section>

      {/* ── Questions ─────────────────────────────────────────────────────── */}
      {analysis.questionsForPharmacist.length > 0 && (
        <Card>
          <div className="flex items-center gap-2">
            <MessageCircleQuestion aria-hidden className="h-5 w-5 text-primary" />
            <CardTitle>{t('questions.title')}</CardTitle>
          </div>
          <ol className="mt-2 flex list-decimal flex-col gap-2 pl-5 text-sm">
            {analysis.questionsForPharmacist.map((question) => (
              <li key={question} className="leading-relaxed">
                {question}
              </li>
            ))}
          </ol>
        </Card>
      )}

      {/* ── Notices ───────────────────────────────────────────────────────── */}
      {analysis.notices.length > 0 && (
        <div className="flex flex-col gap-2">
          {analysis.notices.map((notice) => (
            <p
              key={notice}
              className="flex items-start gap-2 rounded-xl bg-sky-50 p-3 text-sm text-sky-900 dark:bg-sky-950 dark:text-sky-100"
            >
              <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
              {notice}
            </p>
          ))}
        </div>
      )}

      <div className="flex gap-3 no-print">
        <Button variant="secondary" className="flex-1" onClick={() => router.push('/')}>
          {t('common.home')}
        </Button>
        <Button variant="secondary" className="flex-1" onClick={() => router.push('/history')}>
          {t('common.history')} <ChevronRight aria-hidden className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Reject state (shared) ─────────────────────────────────────────────────────

function RejectState({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
}) {
  const { t } = useI18n();
  const router = useRouter();

  return (
    <div className="animate-fade-in-up flex flex-col gap-4 pt-6">
      <Card className="text-center">
        <div className="flex flex-col items-center gap-3">
          {icon}
          <h1 className="text-lg font-extrabold">{title}</h1>
          {body}
        </div>
      </Card>
      <div className="flex flex-col gap-3">
        <Button onClick={() => router.push('/')}>{t('reject.retake')}</Button>
        <Button variant="secondary" onClick={() => router.push('/manual')}>
          {t('home.typeNames')}
        </Button>
      </div>
    </div>
  );
}

// ── Medication card ───────────────────────────────────────────────────────────

function FieldRow({ label, field }: { label: string; field: Field }) {
  const { t } = useI18n();
  const shown = field.value !== null && field.value !== '';
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</span>
      {shown ? (
        <span className="text-sm leading-relaxed">{field.value}</span>
      ) : (
        <span className="text-sm italic text-gray-400">{t('medications.notIndicated')}</span>
      )}
    </div>
  );
}

function MedicationCard({ med }: { med: Medication }) {
  const { t } = useI18n();
  const isPrinted = med.purpose.provenance === 'printed';

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <span
          aria-hidden
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-light text-white"
        >
          <Pill className="h-4 w-4" />
        </span>
        <span className="text-base font-extrabold">{med.nameAsPrinted}</span>
        {med.genericName.value && (
          <Badge variant="neutral">{med.genericName.value}</Badge>
        )}
        {med.confidence === 'low' && (
          <Badge variant="medium">{t('medications.uncertainName')}</Badge>
        )}
      </div>

      <p className="mt-1 text-xs font-semibold text-gray-500">
        {isPrinted ? t('medications.printed') : t('medications.general')}
      </p>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FieldRow label={t('medications.purpose')} field={med.purpose} />
        <FieldRow label={t('medications.dosage')} field={med.dosage} />
        <FieldRow label={t('medications.timing')} field={med.timing} />
        <FieldRow label={t('medications.duration')} field={med.duration} />
      </div>

      {med.sideEffectsCommon.length > 0 && (
        <div className="mt-3">
          <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500">
            {t('medications.sideEffectsCommon')}
          </h4>
          <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-sm">
            {med.sideEffectsCommon.map((effect) => (
              <li key={effect}>{effect}</li>
            ))}
          </ul>
        </div>
      )}

      {med.sideEffectsSerious.length > 0 && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
          <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-red-800 dark:text-red-200">
            <ShieldAlert aria-hidden className="h-4 w-4" /> {t('medications.urgent')}
          </h4>
          <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-sm text-red-900 dark:text-red-100">
            {med.sideEffectsSerious.map((effect) => (
              <li key={effect}>{effect}</li>
            ))}
          </ul>
        </div>
      )}

      {med.warnings.length > 0 && (
        <div className="mt-3">
          <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500">
            {t('medications.warnings')}
          </h4>
          <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-sm">
            {med.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
