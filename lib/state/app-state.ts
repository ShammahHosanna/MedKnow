'use client';

/**
 * In-memory app state (spec § 7.2: "Aucune image n'est stockée"). The photo
 * exists only as a Blob while the user walks capture → preview → analysis.
 * Kept in a module singleton — never in sessionStorage, never persisted.
 */

export interface PendingImage {
  blob: Blob;
  source: 'camera' | 'import' | 'demo';
  isExample: boolean;
}

let pending: PendingImage | null = null;

export function setPendingImage(image: PendingImage | null): void {
  pending = image;
}

export function getPendingImage(): PendingImage | null {
  return pending;
}

export function consumePendingImage(): PendingImage | null {
  const value = pending;
  pending = null;
  return value;
}
