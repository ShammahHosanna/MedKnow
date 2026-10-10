'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Lang } from '@/types/medknow';
import en from './en.json';
import fr from './fr.json';
import es from './es.json';

export const LANGS: Lang[] = ['en', 'fr', 'es'];

export const LANG_LABELS: Record<Lang, string> = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
};

export type Dict = Record<string, string>;

export const DICTIONARIES: Record<Lang, Dict> = { en, fr, es };

/** Detects the initial language from navigator.language (EF-10). */
export function detectLang(): Lang {
  if (typeof navigator === 'undefined') return 'en';
  const candidates = [navigator.language, ...(navigator.languages ?? [])];
  for (const candidate of candidates) {
    const lower = candidate.toLowerCase();
    if (lower.startsWith('fr')) return 'fr';
    if (lower.startsWith('es')) return 'es';
    if (lower.startsWith('en')) return 'en';
  }
  return 'en';
}

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  children,
  initialLang = 'en',
}: {
  children: ReactNode;
  initialLang?: Lang;
}) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  // Client-side detection on mount (stored preference wins, then navigator).
  useEffect(() => {
    let stored: Lang | undefined;
    try {
      const raw = sessionStorage.getItem('medknow:v1:prefs');
      if (raw) {
        const prefs = JSON.parse(raw) as { lang?: Lang };
        if (prefs.lang && LANGS.includes(prefs.lang)) stored = prefs.lang;
      }
    } catch {
      // corrupted or unavailable storage → fall through to detection
    }
    setLangState(stored ?? detectLang());
  }, []);

  // Keep the document lang attribute in sync (CA-10.5 / BA-07).
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      const raw = sessionStorage.getItem('medknow:v1:prefs');
      const prefs = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      prefs.lang = next;
      sessionStorage.setItem('medknow:v1:prefs', JSON.stringify(prefs));
    } catch {
      // storage unavailable (private mode) → memory-only preference
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const dict = DICTIONARIES[lang] ?? DICTIONARIES.en;
      let value = dict[key] ?? DICTIONARIES.en[key] ?? key;
      if (vars) {
        for (const [name, replacement] of Object.entries(vars)) {
          value = value.replaceAll(`{${name}}`, String(replacement));
        }
      }
      return value;
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
