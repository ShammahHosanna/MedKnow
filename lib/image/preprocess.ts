'use client';

/**
 * Client-side image preprocessing (spec EF-02 / § 6.2 ImagePreprocessor).
 * Pipeline in two passes to keep the math obvious:
 *   1. orient: EXIF orientation + manual 90° rotation → oriented canvas
 *   2. frame: crop (in oriented coordinates) + resize long side ≤ 1600 px
 * then iterative JPEG re-encoding (q0.8 → 0.5, then dimension reduction) to
 * reach ≤ 1.5 MB. Canvas re-encoding strips all EXIF/GPS metadata (CA-02.2).
 */

export const MAX_LONG_SIDE = 1600;
export const MAX_BYTES = 1_500_000;

export interface PreprocessOptions {
  /** Clockwise rotation to apply on top of EXIF orientation, in degrees. */
  rotation?: 0 | 90 | 180 | 270;
  /** Crop rectangle in oriented-image pixel coordinates. */
  crop?: { x: number; y: number; width: number; height: number } | null;
}

export interface PreprocessResult {
  blob: Blob;
  width: number;
  height: number;
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  return canvas;
}

/** Pass 1 — bitmap + manual rotation → oriented canvas. */
function orientCanvas(bitmap: ImageBitmap, rotation: number): HTMLCanvasElement {
  const swap = rotation % 180 !== 0;
  const width = swap ? bitmap.height : bitmap.width;
  const height = swap ? bitmap.width : bitmap.height;
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.translate(width / 2, height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  return canvas;
}

/** Pass 2 — crop + scale from the oriented canvas. */
function frameCanvas(oriented: HTMLCanvasElement, crop: PreprocessOptions['crop'], maxLongSide: number): HTMLCanvasElement {
  const rect = crop ?? { x: 0, y: 0, width: oriented.width, height: oriented.height };
  // Clamp the rect inside the oriented image.
  const x = Math.max(0, Math.min(rect.x, oriented.width - 1));
  const y = Math.max(0, Math.min(rect.y, oriented.height - 1));
  const width = Math.max(1, Math.min(rect.width, oriented.width - x));
  const height = Math.max(1, Math.min(rect.height, oriented.height - y));

  const scale = Math.min(1, maxLongSide / Math.max(width, height));
  const canvas = makeCanvas(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(oriented, x, y, width, height, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Renders the EXIF-oriented (+ rotated) image to a canvas for the preview UI.
 * Returns the canvas so the crop overlay can work in oriented coordinates.
 */
export async function renderOriented(blob: Blob, rotation: 0 | 90 | 180 | 270 = 0): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  try {
    return orientCanvas(bitmap, rotation);
  } finally {
    bitmap.close?.();
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('JPEG encoding failed'))),
      'image/jpeg',
      quality,
    );
  });
}

/**
 * Full pipeline. Throws on hard failures (canvas unavailable) — callers show a
 * recovery message (EF-02 A2).
 */
export async function preprocessImage(blob: Blob, options: PreprocessOptions = {}): Promise<PreprocessResult> {
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  try {
    const oriented = orientCanvas(bitmap, options.rotation ?? 0);
    const work = () => frameCanvas(oriented, options.crop ?? null, MAX_LONG_SIDE);

    let canvas = work();
    let quality = 0.8;
    let outBlob = await canvasToBlob(canvas, quality);

    // EF-02 A1: quality 0.8 → 0.5, then reduce dimensions.
    while (outBlob.size > MAX_BYTES && quality > 0.5) {
      quality = Math.max(0.5, quality - 0.15);
      outBlob = await canvasToBlob(canvas, quality);
    }
    let longSide = Math.max(canvas.width, canvas.height);
    while (outBlob.size > MAX_BYTES && longSide > 800) {
      longSide = Math.round(longSide * 0.8);
      canvas = frameCanvas(oriented, options.crop ?? null, longSide);
      quality = 0.8;
      outBlob = await canvasToBlob(canvas, quality);
      while (outBlob.size > MAX_BYTES && quality > 0.5) {
        quality = Math.max(0.5, quality - 0.15);
        outBlob = await canvasToBlob(canvas, quality);
      }
    }

    return { blob: outBlob, width: canvas.width, height: canvas.height };
  } finally {
    bitmap.close?.();
  }
}

/** Source long side below this triggers the low-resolution warning (EF-02 A4). */
export function isLowResolution(width: number, height: number): boolean {
  return Math.max(width, height) < 600;
}
