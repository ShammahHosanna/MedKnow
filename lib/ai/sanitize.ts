import type { ZodLang } from './schema';

/**
 * Output safety filters (spec § 10.2, NR-1…NR-7 — defense in depth).
 * The prompt forbids diagnostics and injunctions; these regexes are the second
 * line of defense: any offending sentence is replaced by the safe template and
 * whatToDo is always standardized (NR-6). Counters are returned so the route
 * can log events without logging any content (BS-04 / EXN-26).
 */

export const SAFE_WHAT_TO_DO: Record<ZodLang, string> = {
  fr: 'Demandez conseil à votre pharmacien ou à votre médecin avant la prochaine prise.',
  en: 'Ask your pharmacist or doctor before the next dose.',
  es: 'Consulte a su farmacéutico o a su médico antes de la próxima toma.',
};

export const SAFE_SENTENCE: Record<ZodLang, string> = {
  fr: 'Demandez conseil à votre pharmacien ou à votre médecin.',
  en: 'Ask your pharmacist or doctor.',
  es: 'Consulte a su farmacéutico o a su médico.',
};

/** NR-2: any injunction to start/stop/change a treatment. */
const INJUNCTION_PATTERNS: RegExp[] = [
  // FR
  /\b(arr[eê]tez|cessez|stoppez|ne prenez plus|doublez|augmentez|diminuez|remplacez)\b/i,
  /\b(ne (prenez|consommez) (pas|plus|jamais))\b/i,
  // EN
  /\b(stop taking|do not take|discontinue|double (the )?dose|increase (the )?dose|decrease (the )?dose|switch to|avoid taking)\b/i,
  // ES
  /\b(deje de tomar|suspenda|duplique|aumente|disminuya|sustituya)\b/i,
];

/** NR-1: any diagnostic statement about the user. */
const DIAGNOSIS_PATTERNS: RegExp[] = [
  // FR
  /\bvous (avez|souffrez|([eê]tes atteint))\b/i,
  /\bporteur (de|d')\b/i,
  // EN
  /\byou (have|suffer from) (a |an )?[a-z ]*(disease|disorder|syndrome|infection|condition)\b/i,
  /\byou are (suffering|diagnosed)\b/i,
  // ES
  /\busted (tiene|padece)\b/i,
];

/** BS-06: identity leakage detection (patient, prescriber, contact details). */
const IDENTITY_LABEL_PATTERNS: RegExp[] = [
  /\b(patient|patiente|prescripteur|prescriber|prescribed by|prescrit par)\b/i,
  /\b(doctor|docteur|docteure|d\.?r\.?|m\.?d\.?)\b/i,
  /\b(date of birth|date de naissance|n[ée]e? le|born on)\b/i,
  /\b(insurance|s[ée]curit[ée] sociale|nir|ssn)\b/i,
];

const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+/;
/** 8+ digit runs with common separators — never matches doses like "500 mg". */
const PHONE_PATTERN = /(\+?\d[\d\s().-]{7,}\d)/;

export interface SanitizeCounters {
  injunctionReplacements: number;
  diagnosisReplacements: number;
  identityRedactions: number;
}

function emptyCounters(): SanitizeCounters {
  return { injunctionReplacements: 0, diagnosisReplacements: 0, identityRedactions: 0 };
}

function sentenceMatches(text: string): 'injunction' | 'diagnosis' | null {
  if (INJUNCTION_PATTERNS.some((re) => re.test(text))) return 'injunction';
  if (DIAGNOSIS_PATTERNS.some((re) => re.test(text))) return 'diagnosis';
  return null;
}

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Sanitizes free text sentence by sentence: offending sentences are replaced by
 * the localized safe template (spec § 10.2).
 */
export function sanitizeText(text: string, lang: ZodLang, counters?: SanitizeCounters): string {
  if (!text) return text;
  const c = counters ?? emptyCounters();
  const parts = text.split(/(?<=[.!?…])(\s+)/);
  return parts
    .map((part) => {
      if (/^\s+$/.test(part)) return part;
      const kind = sentenceMatches(part);
      if (kind === 'injunction') c.injunctionReplacements += 1;
      if (kind === 'diagnosis') c.diagnosisReplacements += 1;
      return kind ? SAFE_SENTENCE[lang] : part;
    })
    .join('');
}

export function sanitizeList(
  items: string[],
  lang: ZodLang,
  counters?: SanitizeCounters,
): string[] {
  return items.map((item) => sanitizeText(item, lang, counters));
}

/**
 * Redacts obvious PII (emails, phone numbers) from a string (BS-06).
 * Used on narrative fields only — never on dosage fields.
 */
export function redactPii(
  text: string,
  counters?: SanitizeCounters,
): string {
  if (!text) return text;
  const c = counters ?? emptyCounters();
  let out = text;
  if (EMAIL_PATTERN.test(out)) {
    out = out.replace(new RegExp(EMAIL_PATTERN, 'g'), '[…]');
    c.identityRedactions += 1;
  }
  if (PHONE_PATTERN.test(out) && /\d{8,}/.test(out.replace(/\D/g, ''))) {
    out = out.replace(new RegExp(PHONE_PATTERN, 'g'), '[…]');
    c.identityRedactions += 1;
  }
  return out;
}

/** True if a medication name is actually an identity fragment (BS-06). */
export function looksLikeIdentity(text: string): boolean {
  if (!text) return false;
  return IDENTITY_LABEL_PATTERNS.some((re) => re.test(text));
}

export { emptyCounters };
