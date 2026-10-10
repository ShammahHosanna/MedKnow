/**
 * MedKnow shared data model (spec § 7.1).
 * Used by both the client and the server; validated on the server by the
 * equivalent Zod schema in lib/ai/schema.ts. Never stored server-side.
 */

export type Lang = 'en' | 'fr' | 'es';
export type Severity = 'high' | 'medium' | 'low';
export type Confidence = 'high' | 'medium' | 'low';
export type Provenance = 'printed' | 'general_knowledge';

export type DocumentType =
  | 'prescription'
  | 'medication_label'
  | 'leaflet'
  | 'other_medical'
  | 'not_medical'
  | 'manual_entry';

export interface ImageQuality {
  readable: boolean;
  issues: (
    | 'blurry'
    | 'dark'
    | 'glare'
    | 'cropped'
    | 'low_resolution'
    | 'handwriting_unclear'
  )[];
}

/**
 * A value read from the document or completed from general knowledge.
 * Never invented. `value === null` means "not indicated" in the UI.
 */
export interface Field<T = string> {
  value: T | null;
  provenance: Provenance | null;
}

export interface Medication {
  id: string; // "m1", "m2", ...
  nameAsPrinted: string;
  genericName: Field; // if known
  purpose: Field; // plain language
  dosage: Field; // e.g. "500 mg"
  timing: Field; // e.g. "1 tablet morning and evening, with meals"
  duration: Field;
  sideEffectsCommon: string[];
  sideEffectsSerious: string[]; // "Seek urgent care if..."
  warnings: string[]; // alcohol, driving, pregnancy, etc.
  confidence: Confidence;
}

export interface Interaction {
  id: string; // "i1", "r1", ...
  medicationIds: [string, string, ...string[]];
  severity: Severity;
  explanation: string; // plain language, no injunctions
  whatToDo: string; // always: consult a professional
  confidence: Confidence;
  source: 'model' | 'local_rule' | 'model+local_rule';
}

export interface Analysis {
  schemaVersion: 1;
  id: string; // uuid, client-side
  createdAt: string; // ISO 8601
  lang: Lang;
  isMedicalDocument: boolean;
  documentType: DocumentType;
  imageQuality: ImageQuality;
  medications: Medication[];
  interactions: Interaction[];
  summaryPlain: string; // ≤ 150 words
  questionsForPharmacist: string[]; // 0 to 5
  highestSeverity: Severity | null;
  notices: string[]; // e.g. "possible duplicate"
}

export type ErrorCode =
  | 'INVALID_INPUT'
  | 'PAYLOAD_TOO_LARGE'
  | 'NOT_MEDICAL_DOC'
  | 'IMAGE_UNREADABLE'
  | 'RATE_LIMITED'
  | 'UPSTREAM_UNAVAILABLE'
  | 'TIMEOUT'
  | 'SCHEMA_INVALID'
  | 'NETWORK'
  | 'OFFLINE'
  | 'UNKNOWN';

export interface AppError {
  code: ErrorCode;
  retryable: boolean;
  retryAfterSec?: number;
}

export type AnalyzeMode = 'analyze' | 'translate' | 'manual';

export interface SessionRecord {
  id: string;
  createdAt: string;
  isExample: boolean;
  isManual: boolean;
  activeLang: Lang;
  translations: Partial<Record<Lang, Analysis>>;
}
