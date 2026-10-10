import type { Analysis, Lang, SessionRecord } from '@/types/medknow';

/**
 * Session storage wrapper (spec § 7.2). All reads/writes are guarded: corrupted
 * JSON resets the key, quota errors evict the oldest entry, and a strict
 * private-mode environment falls back to in-memory storage with a warning flag
 * (EF-12 A3/A4). Only MedKnow keys ("medknow:v1:*") are ever touched.
 */

const PREFIX = 'medknow:v1:';
const KEY_CONSENT = `${PREFIX}consent`;
const KEY_PREFS = `${PREFIX}prefs`;
const KEY_HISTORY = `${PREFIX}history`;
const KEY_LAST = `${PREFIX}last`;
const MAX_HISTORY = 10;

export interface Prefs {
  lang?: Lang;
  largeText?: boolean;
}

export interface Consent {
  accepted: true;
  at: string;
}

interface HistoryShape {
  items: SessionRecord[];
}

/** True when sessionStorage is unavailable and memory fallback is active. */
let memoryFallback = false;
let memoryStore = new Map<string, string>();

export function isMemoryFallback(): boolean {
  return memoryFallback;
}

function safeGet(key: string): string | null {
  if (memoryFallback) return memoryStore.get(key) ?? null;
  try {
    return sessionStorage.getItem(key);
  } catch {
    memoryFallback = true;
    return memoryStore.get(key) ?? null;
  }
}

function safeSet(key: string, value: string): boolean {
  if (memoryFallback) {
    memoryStore.set(key, value);
    return true;
  }
  try {
    sessionStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemove(key: string): void {
  if (memoryFallback) {
    memoryStore.delete(key);
    return;
  }
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function readJson<T>(key: string, validate: (value: unknown) => T | null): T | null {
  const raw = safeGet(key);
  if (!raw) return null;
  try {
    return validate(JSON.parse(raw));
  } catch {
    // Corrupted data → silent reset (EF-12 A3).
    safeRemove(key);
    return null;
  }
}

// ── Consent (EF-16) ─────────────────────────────────────────────────────────

export function getConsent(): Consent | null {
  return readJson<Consent>(KEY_CONSENT, (value) => {
    if (value && typeof value === 'object' && (value as Consent).accepted === true) {
      return value as Consent;
    }
    return null;
  });
}

export function setConsent(): void {
  safeSet(KEY_CONSENT, JSON.stringify({ accepted: true, at: new Date().toISOString() }));
}

// ── Preferences (EF-10 / EF-11) ─────────────────────────────────────────────

export function getPrefs(): Prefs {
  return (
    readJson<Prefs>(KEY_PREFS, (value) => {
      if (value && typeof value === 'object') return value as Prefs;
      return null;
    }) ?? {}
  );
}

export function setPrefs(prefs: Prefs): void {
  safeSet(KEY_PREFS, JSON.stringify({ ...getPrefs(), ...prefs }));
}

// ── History (EF-12) ─────────────────────────────────────────────────────────

export function listHistory(): SessionRecord[] {
  return (
    readJson<HistoryShape>(KEY_HISTORY, (value) => {
      if (value && Array.isArray((value as HistoryShape).items)) {
        return value as HistoryShape;
      }
      return null;
    })?.items ?? []
  );
}

export function getRecord(id: string): SessionRecord | null {
  return listHistory().find((r) => r.id === id) ?? null;
}

export function getAnalysis(id: string, lang: Lang): Analysis | null {
  const record = getRecord(id);
  if (!record) return null;
  return record.translations[lang] ?? record.translations[record.activeLang] ?? null;
}

export function saveAnalysis(analysis: Analysis, flags: { isExample?: boolean; isManual?: boolean } = {}): SessionRecord {
  const record: SessionRecord = {
    id: analysis.id,
    createdAt: analysis.createdAt,
    isExample: flags.isExample ?? false,
    isManual: flags.isManual ?? false,
    activeLang: analysis.lang,
    translations: { [analysis.lang]: analysis },
  };
  const items = listHistory().filter((r) => r.id !== record.id);
  items.unshift(record);
  const trimmed = items.slice(0, MAX_HISTORY); // CA-12.4: the 11th evicts the oldest

  if (!safeSet(KEY_HISTORY, JSON.stringify({ items: trimmed }))) {
    // Quota exceeded → drop the oldest entries and retry (EF-12 A2).
    const reduced = trimmed.slice(0, Math.max(1, trimmed.length - 1));
    safeSet(KEY_HISTORY, JSON.stringify({ items: reduced }));
  }
  safeSet(KEY_LAST, record.id);
  return record;
}

export function cacheTranslation(id: string, lang: Lang, analysis: Analysis): void {
  const items = listHistory();
  const record = items.find((r) => r.id === id);
  if (!record) return;
  record.translations[lang] = analysis;
  safeSet(KEY_HISTORY, JSON.stringify({ items }));
}

export function deleteRecord(id: string): void {
  const items = listHistory().filter((r) => r.id !== id);
  safeSet(KEY_HISTORY, JSON.stringify({ items }));
  if (safeGet(KEY_LAST) === id) safeRemove(KEY_LAST);
}

export function getLastAnalysisId(): string | null {
  return safeGet(KEY_LAST);
}

// ── Erase everything (EF-18) ────────────────────────────────────────────────

export function clearAllData(): void {
  if (memoryFallback) {
    for (const key of [...memoryStore.keys()]) {
      if (key.startsWith(PREFIX)) memoryStore.delete(key);
    }
    return;
  }
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(PREFIX)) toRemove.push(key);
    }
    for (const key of toRemove) sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
  memoryStore.clear();
}

/** Test helper. */
export function resetMemoryFallback(): void {
  memoryFallback = false;
  memoryStore = new Map();
}
