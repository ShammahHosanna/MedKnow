import type { Analysis, Interaction, Medication, Severity } from '@/types/medknow';
import type { ModelAnalysis, ZodAnalysis, ZodLang } from './schema';
import { SAFE_WHAT_TO_DO, emptyCounters, looksLikeIdentity, redactPii, sanitizeList, sanitizeText } from './sanitize';
import { capSummary } from '@/lib/text/readability';
import { applyLocalRules } from '@/lib/interactions/match';

/**
 * Server-side post-processing (spec § 9.4): turns a schema-validated model
 * output into a complete Analysis. Nothing here is stored — this only shapes
 * the HTTP response.
 */

type NoticeBuilder = (...args: string[]) => string;

const DUPLICATE_NOTICE: Record<ZodLang, NoticeBuilder> = {
  fr: (a, b) => `Possible doublon : ${a} et ${b} semblent contenir la même substance.`,
  en: (a, b) => `Possible duplicate: ${a} and ${b} may contain the same substance.`,
  es: (a, b) => `Posible duplicado: ${a} y ${b} parecen contener la misma sustancia.`,
};

const IDENTITY_NOTICE: Record<ZodLang, string> = {
  fr: 'Des informations personnelles ont été retirées par mesure de confidentialité.',
  en: 'Personal information has been removed for privacy.',
  es: 'La información personal se ha eliminado por privacidad.',
};

const REDACTED_NAME: Record<ZodLang, string> = {
  fr: '[Retiré — information personnelle]',
  en: '[Removed — personal information]',
  es: '[Eliminado — información personal]',
};

/**
 * Extracts a JSON object from raw model text, tolerating markdown fences or
 * surrounding commentary (CL-16).
 */
export function extractJson(raw: string): unknown {
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) {
    throw new Error('No JSON object found in model output');
  }
  return JSON.parse(text.slice(first, last + 1));
}

export function highestSeverityOf(interactions: Interaction[]): Severity | null {
  const rank: Record<Severity, number> = { high: 3, medium: 2, low: 1 };
  let highest: Severity | null = null;
  for (const i of interactions) {
    if (highest === null || rank[i.severity] > rank[highest]) highest = i.severity;
  }
  return highest;
}

function cleanMedication(
  med: Medication,
  lang: ZodLang,
  counters: ReturnType<typeof emptyCounters>,
  isManual: boolean,
  notices: string[],
): Medication {
  let name = med.nameAsPrinted.trim();
  if (looksLikeIdentity(name)) {
    name = REDACTED_NAME[lang];
    notices.push(IDENTITY_NOTICE[lang]);
  }
  const generic = med.genericName.value ? med.genericName : { value: null, provenance: null };
  return {
    ...med,
    nameAsPrinted: name,
    genericName: generic,
    purpose: {
      value: med.purpose.value ? redactPii(sanitizeText(med.purpose.value, lang, counters), counters) : null,
      provenance: isManual && med.purpose.provenance === 'printed' ? 'general_knowledge' : med.purpose.provenance,
    },
    // Manual mode never claims a value was read on a document (CA-20.2):
    dosage: isManual ? { value: null, provenance: null } : med.dosage,
    timing: {
      value: med.timing.value ? redactPii(med.timing.value, counters) : null,
      provenance: isManual && med.timing.provenance === 'printed' ? 'general_knowledge' : med.timing.provenance,
    },
    duration: {
      value: med.duration.value ? redactPii(med.duration.value, counters) : null,
      provenance: isManual && med.duration.provenance === 'printed' ? 'general_knowledge' : med.duration.provenance,
    },
    sideEffectsCommon: sanitizeList(redactList(med.sideEffectsCommon, counters), lang, counters),
    sideEffectsSerious: sanitizeList(redactList(med.sideEffectsSerious, counters), lang, counters),
    warnings: sanitizeList(redactList(med.warnings, counters), lang, counters),
  };
}

function redactList(items: string[], counters: ReturnType<typeof emptyCounters>): string[] {
  return items.map((item) => redactPii(item, counters));
}

/**
 * Builds the final Analysis from validated model output (analyze / manual).
 */
export function completeAnalysis(
  model: ModelAnalysis,
  lang: ZodLang,
  options: { isManual?: boolean } = {},
): ZodAnalysis {
  const counters = emptyCounters();
  const isManual = options.isManual ?? false;
  const notices: string[] = [];

  const medications = model.medications.map((m) => cleanMedication(m, lang, counters, isManual, notices));

  // Keep only interactions referencing ≥ 2 known medication ids (CA-06.5).
  const knownIds = new Set(medications.map((m) => m.id));
  const validModelInteractions: Interaction[] = model.interactions
    .filter((i) => i.medicationIds.filter((id) => knownIds.has(id)).length >= 2)
    .map((i) => ({ ...i, medicationIds: i.medicationIds.filter((id) => knownIds.has(id)) as [string, string, ...string[]] }));

  const { interactions, duplicateSubstanceNotice } = applyLocalRules(medications, validModelInteractions, lang);
  if (duplicateSubstanceNotice) {
    notices.push(DUPLICATE_NOTICE[lang](duplicateSubstanceNotice.medA, duplicateSubstanceNotice.medB));
  }
  // NR-6: whatToDo is always the standardized safe template.
  const finalInteractions = interactions.map((i) => ({ ...i, whatToDo: SAFE_WHAT_TO_DO[lang] }));

  const summary = capSummary(
    redactPii(sanitizeText(model.summaryPlain.trim(), lang, counters), counters),
  );
  const questions = sanitizeList(model.questionsForPharmacist, lang, counters)
    .map((q) => q.trim())
    .filter((q) => q.endsWith('?'));

  const analysis: Analysis = {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    lang,
    isMedicalDocument: model.isMedicalDocument,
    documentType: isManual ? 'manual_entry' : model.documentType,
    imageQuality: model.imageQuality,
    medications,
    interactions: finalInteractions,
    summaryPlain: summary,
    questionsForPharmacist: questions,
    highestSeverity: highestSeverityOf(finalInteractions),
    notices: sanitizeList(notices, lang, counters),
  };
  return analysis as ZodAnalysis;
}

/**
 * Merges a translated model output into the original Analysis (mode
 * "translate", TI-08): technical fields (ids, severities, provenances,
 * medication names) come from the original; only human-readable text is
 * taken from the translation. Non-diagnosis filters are re-applied.
 */
export function mergeTranslation(
  original: ZodAnalysis,
  translated: ModelAnalysis,
  lang: ZodLang,
): ZodAnalysis {
  const counters = emptyCounters();

  const medications: Medication[] = original.medications.map((med, index) => {
    const t = translated.medications[index];
    if (!t) return med;
    return {
      ...med,
      purpose: {
        value: t.purpose.value
          ? redactPii(sanitizeText(t.purpose.value, lang, counters), counters)
          : med.purpose.value,
        provenance: med.purpose.provenance,
      },
      timing: {
        value: t.timing.value ? redactPii(t.timing.value, counters) : med.timing.value,
        provenance: med.timing.provenance,
      },
      duration: {
        value: t.duration.value ? redactPii(t.duration.value, counters) : med.duration.value,
        provenance: med.duration.provenance,
      },
      sideEffectsCommon: sanitizeList(redactList(t.sideEffectsCommon, counters), lang, counters),
      sideEffectsSerious: sanitizeList(redactList(t.sideEffectsSerious, counters), lang, counters),
      warnings: sanitizeList(redactList(t.warnings, counters), lang, counters),
    };
  });

  const interactions: Interaction[] = original.interactions.map((interaction, index) => {
    const t = translated.interactions[index];
    return {
      ...interaction,
      explanation: t
        ? redactPii(sanitizeText(t.explanation, lang, counters), counters)
        : interaction.explanation,
      whatToDo: SAFE_WHAT_TO_DO[lang],
    };
  });

  return {
    ...original,
    lang,
    medications,
    interactions,
    summaryPlain: capSummary(
      redactPii(sanitizeText(translated.summaryPlain || original.summaryPlain, lang, counters), counters),
    ),
    questionsForPharmacist: translated.questionsForPharmacist.length
      ? sanitizeList(translated.questionsForPharmacist, lang, counters)
      : original.questionsForPharmacist,
    notices: sanitizeList(translated.notices, lang, counters),
    highestSeverity: highestSeverityOf(interactions),
  };
}
