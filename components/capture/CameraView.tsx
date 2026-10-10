'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, RefreshCw, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';

export type CameraError = 'permission' | 'no_camera' | 'busy' | 'insecure';

/**
 * E2 — camera capture (EF-01). The stream is fully stopped when the overlay
 * closes or the component unmounts (CA-01.4). If anything blocks the camera,
 * the import path is offered instead (A1/A2/A5).
 */
export default function CameraView({
  onClose,
  onCaptured,
  onImportClick,
}: {
  onClose: () => void;
  onCaptured: (blob: Blob) => void;
  onImportClick: () => void;
}) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  /** Frame captured at freeze time — the <video> unmounts in 'frozen' state,
   * so the blob MUST be kept here instead of re-drawn from videoRef. */
  const capturedBlobRef = useRef<Blob | null>(null);
  const [state, setState] = useState<'opening' | 'live' | 'frozen'>('opening');
  const [error, setError] = useState<CameraError | null>(null);
  const [frozenFrame, setFrozenFrame] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const startStream = useCallback(async () => {
    setState('opening');
    setError(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('insecure');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 2560 }, height: { ideal: 1440 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setState('live');
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'SecurityError') setError('permission');
      else if (name === 'NotFoundError' || name === 'OverconstrainedError') setError('no_camera');
      else if (name === 'NotReadableError' || name === 'AbortError') setError('busy');
      else setError('permission');
    }
  }, []);

  useEffect(() => {
    void startStream();
    return () => stopStream(); // release the camera on unmount (A6)
  }, [startStream, stopStream]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        capturedBlobRef.current = blob; // kept for confirmPhoto
        setFrozenFrame(canvas.toDataURL('image/jpeg', 0.8));
        setState('frozen');
        // Keep the stream alive until the user confirms, so "retake" is instant.
      },
      'image/jpeg',
      0.9,
    );
  };

  const confirmPhoto = () => {
    // The captured blob was stored at freeze time — the <video> element is
    // no longer mounted in the 'frozen' state, so videoRef.current is null.
    const blob = capturedBlobRef.current;
    if (!blob) return;
    stopStream();
    capturedBlobRef.current = null;
    onCaptured(blob);
  };

  const retake = () => {
    capturedBlobRef.current = null;
    setFrozenFrame(null);
    setState('live');
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={t('camera.title')} className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between p-3">
        <span className="font-bold text-white">{t('camera.title')}</span>
        <button
          type="button"
          onClick={() => {
            stopStream();
            onClose();
          }}
          aria-label={t('common.close')}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white"
        >
          <X aria-hidden className="h-6 w-6" />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
            <p className="max-w-sm font-semibold text-white">
              {error === 'permission' && t('camera.permissionDenied')}
              {error === 'no_camera' && t('camera.noCamera')}
              {error === 'busy' && t('camera.busy')}
              {error === 'insecure' && t('camera.noCamera')}
            </p>
            {error === 'permission' && <p className="max-w-sm text-sm text-gray-300">{t('camera.permissionHelp')}</p>}
            <Button variant="secondary" onClick={onImportClick}>
              <ImagePlus aria-hidden className="h-5 w-5" /> {t('home.importImage')}
            </Button>
          </div>
        ) : state === 'frozen' && frozenFrame ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={frozenFrame} alt="" className="h-full w-full object-contain" />
        ) : (
          <>
            <video ref={videoRef} playsInline muted autoPlay className="h-full w-full object-contain" />
            {/* Guide frame */}
            <div aria-hidden className="pointer-events-none absolute inset-6 rounded-xl border-2 border-dashed border-white/70" />
          </>
        )}
      </div>

      {state === 'opening' && !error && (
        <p className="pb-24 text-center text-gray-300" aria-live="polite">{t('camera.opening')}</p>
      )}

      {state === 'live' && (
        <div className="flex items-center justify-center gap-4 p-6">
          <p className="absolute bottom-24 left-0 right-0 text-center text-sm text-gray-300">
            {t('camera.tip1')} · {t('camera.tip2')} · {t('camera.tip3')}
          </p>
          <button
            type="button"
            onClick={capture}
            aria-label={t('camera.capture')}
            className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/20 text-white"
          >
            <Camera aria-hidden className="h-9 w-9" />
          </button>
        </div>
      )}

      {state === 'frozen' && (
        <div className="flex items-center justify-center gap-3 p-6">
          <Button variant="secondary" onClick={retake}>
            <RefreshCw aria-hidden className="h-5 w-5" /> {t('camera.retake')}
          </Button>
          <Button onClick={confirmPhoto}>{t('camera.useThisPhoto')}</Button>
        </div>
      )}
    </div>
  );
}
