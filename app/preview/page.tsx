'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCw } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import CropOverlay, { type CropRect } from '@/components/capture/CropOverlay';
import LoadingSteps from '@/components/common/LoadingSteps';
import ErrorPanel from '@/components/common/ErrorPanel';
import { Button } from '@/components/ui/button';
import { consumePendingImage } from '@/lib/state/app-state';
import { isLowResolution, preprocessImage, renderOriented } from '@/lib/image/preprocess';
import { createDemoImageBlob } from '@/lib/demo/demo-image';
import { analyzeRequest, toAppError } from '@/lib/api/analyze-client';
import { saveAnalysis } from '@/lib/storage/session-store';
import type { Analysis, AppError } from '@/types/medknow';

export default function PreviewPage() {
  const { t, lang } = useI18n();
  const router = useRouter();

  const [blob, setBlob] = useState<Blob | null>(null);
  const [isExample, setIsExample] = useState(false);
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [lowRes, setLowRes] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const canvasHost = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load the pending image (or generate the demo image) once.
  useEffect(() => {
    let cancelled = false;
    const pending = consumePendingImage();
    if (!pending) {
      router.replace('/');
      return;
    }
    const load = async () => {
      const sourceBlob =
        pending.source === 'demo' ? await createDemoImageBlob().catch(() => null) : pending.blob;
      if (cancelled) return;
      if (!sourceBlob) {
        setError({ code: 'UNKNOWN', retryable: false });
        return;
      }
      setBlob(sourceBlob);
      setIsExample(pending.isExample);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Render the oriented canvas whenever the blob or rotation changes.
  useEffect(() => {
    if (!blob || !canvasHost.current) return;
    let cancelled = false;
    void (async () => {
      try {
        const canvas = await renderOriented(blob, rotation);
        if (cancelled || !canvasHost.current) return;
        canvas.className = 'max-h-[60vh] max-w-full rounded-xl border border-gray-300 dark:border-gray-700';
        canvasHost.current.replaceChildren(canvas);
        setLowRes(isLowResolution(canvas.width, canvas.height));
      } catch {
        setError({ code: 'INVALID_INPUT', retryable: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [blob, rotation]);

  const runAnalysis = useCallback(async () => {
    if (!blob) return;
    setAnalyzing(true);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await preprocessImage(blob, { rotation, crop });
      const base64 = await blobToBase64(result.blob);
      const analysis: Analysis = await analyzeRequest(
        { mode: 'analyze', lang, image: { mimeType: 'image/jpeg', data: base64 } },
        controller.signal,
      );
      saveAnalysis(analysis, { isExample });
      router.push(`/result/${analysis.id}`);
    } catch (err) {
      if (controller.signal.aborted) return; // user cancel — back to preview
      setError(toAppError(err));
    } finally {
      abortRef.current = null;
      setAnalyzing(false);
    }
  }, [blob, rotation, crop, lang, isExample, router]);

  return (
    <div className="flex flex-col gap-4 pt-2">
      <h1 className="text-center text-xl font-extrabold">{t('preview.title')}</h1>

      {error ? (
        <ErrorPanel
          error={error}
          onRetry={() => {
            setError(null);
          }}
          secondary={{ label: t('common.home'), onClick: () => router.push('/') }}
        />
      ) : (
        <CropOverlay crop={crop} onChange={setCrop}>
          <div ref={canvasHost} className="flex justify-center" aria-label={t('preview.title')} role="img" />
        </CropOverlay>
      )}

      {lowRes && !error && (
        <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          {t('preview.lowResolution')}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex gap-3">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => {
              setCrop(null);
              setRotation((r) => (((r + 90) % 360) as 0 | 90 | 180 | 270));
            }}
          >
            <RotateCw aria-hidden className="h-5 w-5" /> {t('preview.rotate')}
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => {
              router.push('/');
            }}
          >
            {t('preview.retake')}
          </Button>
        </div>
        <Button onClick={runAnalysis} disabled={analyzing || !blob || Boolean(error)}>
          {analyzing ? t('preview.analyzing') : t('preview.analyze')}
        </Button>
      </div>

      {analyzing && (
        <LoadingSteps
          onCancel={() => {
            abortRef.current?.abort();
            setAnalyzing(false);
          }}
        />
      )}
    </div>
  );
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      resolve(dataUrl.slice(dataUrl.indexOf(',') + 1));
    };
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}
