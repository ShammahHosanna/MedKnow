'use client';

import { useEffect } from 'react';
import { getPrefs } from '@/lib/storage/session-store';

/** Applies the large-text preference on every page (EF-11, CA-11.4). */
export default function LargeTextSync() {
  useEffect(() => {
    const enabled = getPrefs().largeText ?? false;
    document.documentElement.classList.toggle('large-text', enabled);
  }, []);
  return null;
}
