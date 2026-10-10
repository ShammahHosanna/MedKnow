'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Eraser, History as HistoryIcon, Info, Languages, Pill, Type } from 'lucide-react';
import { LANGS, LANG_LABELS, useI18n } from '@/lib/i18n';
import { getPrefs, setPrefs } from '@/lib/storage/session-store';
import { cn } from '@/lib/cn';
import ClearDataDialog from './ClearDataDialog';

export default function Header() {
  const { lang, setLang, t } = useI18n();
  const router = useRouter();
  const [largeText, setLargeText] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLargeText(getPrefs().largeText ?? false);
  }, []);

  // Close the menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const toggleLargeText = () => {
    const next = !largeText;
    setLargeText(next);
    setPrefs({ largeText: next });
    document.documentElement.classList.toggle('large-text', next);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200/80 bg-white/85 shadow-sm backdrop-blur-md dark:border-gray-800 dark:bg-[#0B1220]/85 no-print">
      <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-2 px-4 py-2">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg px-1 py-2"
        >
          <span
            aria-hidden
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-light text-white shadow-glow"
          >
            <Pill className="h-5 w-5" />
          </span>
          <span className="text-lg font-extrabold tracking-tight text-gradient">MedKnow</span>
        </Link>

        <div className="flex items-center gap-1">
          <label className="sr-only" htmlFor="lang-select">
            {t('common.language')}
          </label>
          <Languages aria-hidden className="h-5 w-5 text-gray-500" />
          <select
            id="lang-select"
            value={lang}
            onChange={(e) => setLang(e.target.value as (typeof LANGS)[number])}
            className="h-11 rounded-lg border border-gray-300 bg-white px-2 text-sm font-semibold dark:border-gray-700 dark:bg-gray-900"
          >
            {LANGS.map((l) => (
              <option key={l} value={l}>
                {LANG_LABELS[l]}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={toggleLargeText}
            aria-pressed={largeText}
            aria-label={t('aria.largeText')}
            title={t('common.largeText')}
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-lg border text-base font-bold',
              largeText
                ? 'border-primary bg-primary text-white'
                : 'border-gray-300 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200',
            )}
          >
            <Type aria-hidden className="h-5 w-5" />A+
          </button>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label={t('aria.mainMenu')}
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
            >
              <span aria-hidden className="text-xl leading-none">⋯</span>
            </button>
            {menuOpen && (
              <div role="menu" className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
                <Link role="menuitem" href="/history" onClick={() => setMenuOpen(false)} className="flex min-h-[48px] items-center gap-2 px-4 py-3 hover:bg-surface dark:hover:bg-gray-800">
                  <HistoryIcon aria-hidden className="h-5 w-5" /> {t('common.history')}
                </Link>
                <Link role="menuitem" href="/about" onClick={() => setMenuOpen(false)} className="flex min-h-[48px] items-center gap-2 px-4 py-3 hover:bg-surface dark:hover:bg-gray-800">
                  <Info aria-hidden className="h-5 w-5" /> {t('common.about')}
                </Link>
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setClearOpen(true);
                  }}
                  className="flex min-h-[48px] w-full items-center gap-2 px-4 py-3 text-left text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                >
                  <Eraser aria-hidden className="h-5 w-5" /> {t('common.clearData')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <ClearDataDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onCleared={() => {
          setClearOpen(false);
          router.push('/');
        }}
      />
    </header>
  );
}
