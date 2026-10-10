'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { ArrowRight, Camera, FileText, ImagePlus, Lock, Sparkles } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import ConsentGate from '@/components/common/ConsentGate';
import CameraView from '@/components/capture/CameraView';
import { setPendingImage } from '@/lib/state/app-state';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMPORT_BYTES = 15_000_000;

export default function HomePage() {
  const { t } = useI18n();
  const router = useRouter();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | undefined) => {
    setFileError(null);
    if (!file) return;
    // EF-01 A4: unsupported format or oversized file → precise message.
    if (!ACCEPTED_TYPES.includes(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
      setFileError(t('errors.INVALID_INPUT'));
      return;
    }
    if (file.size > MAX_IMPORT_BYTES) {
      setFileError(t('errors.PAYLOAD_TOO_LARGE'));
      return;
    }
    setPendingImage({ blob: file, source: 'import', isExample: false });
    router.push('/preview');
  };

  const startDemo = () => {
    setPendingImage({ blob: new Blob(), source: 'demo', isExample: true });
    router.push('/preview');
  };

  return (
    <ConsentGate>
      <div className="flex flex-col gap-6 pt-6">
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="animate-fade-in-up text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-teal-50/80 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary shadow-sm dark:bg-teal-950/60 dark:text-primary-light">
            <Sparkles aria-hidden className="h-3.5 w-3.5" /> MedKnow
          </span>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight">
            <span className="text-gradient">{t('home.heroTitle')}</span>
          </h1>
          <p className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-sm font-medium text-gray-600 shadow-sm dark:bg-gray-800/70 dark:text-gray-300">
            <Lock aria-hidden className="h-4 w-4 text-primary dark:text-primary-light" />
            {t('home.heroSubtitle')}
          </p>
        </section>

        {/* ── Illustration ─────────────────────────────────────────────────── */}
        <div
          className="animate-fade-in-up relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary-dark to-[#0B1220] p-8 text-center shadow-glow"
          aria-hidden
        >
          <div className="pointer-events-none absolute -left-8 -top-10 h-32 w-32 rounded-full bg-teal-300/20 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-12 -right-6 h-36 w-36 rounded-full bg-teal-400/15 blur-2xl" />
          <div className="relative flex items-center justify-center gap-5 text-5xl sm:text-6xl">
            <span className="animate-float drop-shadow-lg">📄</span>
            <ArrowRight className="h-8 w-8 text-white/60" />
            <span className="animate-float-delayed drop-shadow-lg">💊</span>
          </div>
          <p className="relative mt-4 text-sm font-semibold text-teal-100/90">
            {t('app.tagline')}
          </p>
        </div>

        {fileError && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800 dark:bg-red-950 dark:text-red-200"
          >
            {fileError}
          </p>
        )}

        {/* ── Actions ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <Button
            onClick={() => setCameraOpen(true)}
            className="bg-gradient-to-r from-primary to-primary-light text-base shadow-glow transition hover:brightness-110 active:translate-y-px"
          >
            <Camera aria-hidden className="h-5 w-5" /> {t('home.takePhoto')}
          </Button>

          <HomeAction
            onClick={startDemo}
            label={t('home.tryExample')}
            icon={<Sparkles aria-hidden className="h-5 w-5" />}
            chipClass="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
          />
          <HomeAction
            onClick={() => fileInputRef.current?.click()}
            label={t('home.importImage')}
            icon={<ImagePlus aria-hidden className="h-5 w-5" />}
            chipClass="bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300"
          />
          <HomeAction
            onClick={() => router.push('/manual')}
            label={t('home.typeNames')}
            icon={<FileText aria-hidden className="h-5 w-5" />}
            chipClass="bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300"
          />
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        <p className="text-center text-sm text-gray-600 dark:text-gray-400">
          {t('home.footerNote')}{' '}
          <a href="/about" className="font-semibold text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary dark:text-primary-light">
            {t('home.learnMore')}
          </a>
        </p>
      </div>

      {cameraOpen && (
        <CameraView
          onClose={() => setCameraOpen(false)}
          onCaptured={(blob) => {
            setCameraOpen(false);
            setPendingImage({ blob, source: 'camera', isExample: false });
            router.push('/preview');
          }}
          onImportClick={() => {
            setCameraOpen(false);
            fileInputRef.current?.click();
          }}
        />
      )}
    </ConsentGate>
  );
}

function HomeAction({
  onClick,
  label,
  icon,
  chipClass,
}: {
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
  chipClass: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[64px] items-center gap-3 rounded-2xl border border-gray-200 bg-white/80 p-4 text-left font-semibold text-gray-800 shadow-card backdrop-blur transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900/70 dark:text-gray-100"
    >
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', chipClass)}>
        {icon}
      </span>
      {label}
      <ArrowRight
        aria-hidden
        className="ml-auto h-4 w-4 text-gray-400 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100"
      />
    </button>
  );
}
