'use client';

import { useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Draw-to-select crop rectangle over the oriented preview canvas. The parent
 * renders the <canvas> as children; this wrapper converts pointer movements
 * into a crop rect in oriented-image (natural) pixels.
 */
export default function CropOverlay({
  crop,
  onChange,
  children,
}: {
  crop: CropRect | null;
  onChange: (rect: CropRect | null) => void;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  const canvasEl = () => containerRef.current?.querySelector('canvas');

  const toNatural = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const el = canvasEl();
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const scaleX = el.width / rect.width;
    const scaleY = el.height / rect.height;
    return {
      x: Math.max(0, Math.min(el.width, (clientX - rect.left) * scaleX)),
      y: Math.max(0, Math.min(el.height, (clientY - rect.top) * scaleY)),
    };
  };

  const displayStyle = (rect: CropRect | null): React.CSSProperties | null => {
    const el = canvasEl();
    if (!el || !rect) return null;
    return {
      left: `${(rect.x / el.width) * 100}%`,
      top: `${(rect.y / el.height) * 100}%`,
      width: `${(rect.width / el.width) * 100}%`,
      height: `${(rect.height / el.height) * 100}%`,
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const point = toNatural(e.clientX, e.clientY);
    if (!point) return;
    dragStart.current = point;
    onChange({ x: point.x, y: point.y, width: 1, height: 1 });
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const point = toNatural(e.clientX, e.clientY);
    if (!point) return;
    onChange({
      x: Math.min(dragStart.current.x, point.x),
      y: Math.min(dragStart.current.y, point.y),
      width: Math.abs(point.x - dragStart.current.x),
      height: Math.abs(point.y - dragStart.current.y),
    });
  };

  const onPointerUp = () => {
    dragStart.current = null;
    // Too small to be intentional → treat as "no crop" (full image).
    if (crop && (crop.width < 40 || crop.height < 40)) onChange(null);
  };

  const style = displayStyle(crop);

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        ref={containerRef}
        className="relative max-h-[60vh] touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {children}
        {style && (
          <div
            aria-hidden
            className="pointer-events-none absolute rounded-md border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
            style={style}
          />
        )}
      </div>
      <p className="text-center text-sm text-gray-600 dark:text-gray-300">
        {style ? t('preview.tip') : `${t('preview.tip')} ${t('preview.dragToCrop')}`}
      </p>
    </div>
  );
}
